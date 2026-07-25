import {
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  type LiveServerMessage,
  type Session
} from "@google/genai";
import { MAX_TIMER_SECONDS } from "../constants";
import {
  base64ToPcm16,
  bytesToBase64,
  downsampleToPcm16
} from "./audio";
import { analyzeImageWithGemini } from "./imageAnalysis";
import { isRecipeContext } from "./recipeContext";
import {
  BASE_SYSTEM_INSTRUCTION,
  formatRecipeContext,
  NARRATION_REQUEST_PREFIX
} from "./systemInstruction";
import {
  GeminiUnavailableError,
  type ImageAssessment,
  type RecipeContext,
  type ToolCall,
  type VoiceProvider,
  type VoiceProviderEvents,
  type VoiceStatus
} from "./types";

export const FALLBACK_LIVE_MODEL = "gemini-3.1-flash-live-preview";

type RealtimeInput = Parameters<Session["sendRealtimeInput"]>[0];
type ToolResponse = Parameters<Session["sendToolResponse"]>[0];

function sanitizedErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return message
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-api-key]")
    .replace(
      /([?&](?:key|access_token)=)[^&\s]+/gi,
      "$1[redacted-token]"
    )
    .replace(
      /\b(?:auth_tokens|authTokens)\/[^\s"'&]+/gi,
      "[redacted-token]"
    );
}

function liveLog(
  event: string,
  details?: Record<string, boolean | number | string | undefined>
) {
  if (details) {
    console.info(`[Mise Live] ${event}`, details);
  } else {
    console.info(`[Mise Live] ${event}`);
  }
}

export function buildFunctionDeclarations(totalSteps: number) {
  const maximumStep = Math.max(
    1,
    Number.isFinite(totalSteps) ? Math.floor(totalSteps) : 1
  );

  return [
    {
      name: "start_timer",
      description: "Create and start a visible timer in the cooking interface.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          label: { type: "string", description: "Short cooking action label." },
          durationSeconds: {
            type: "integer",
            minimum: 1,
            maximum: MAX_TIMER_SECONDS,
            description: "Timer duration in seconds."
          }
        },
        required: ["label", "durationSeconds"],
        additionalProperties: false
      }
    },
    {
      name: "advance_step",
      description:
        "Move the selected recipe to the requested next step after the cook is done.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          stepNumber: { type: "integer", minimum: 1, maximum: maximumStep }
        },
        required: ["stepNumber"],
        additionalProperties: false
      }
    },
    {
      name: "repeat_step",
      description: "Repeat the current instruction without changing recipe state."
    },
    {
      name: "set_current_step",
      description: "Jump to a specific step in the selected recipe.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          stepNumber: { type: "integer", minimum: 1, maximum: maximumStep }
        },
        required: ["stepNumber"],
        additionalProperties: false
      }
    }
  ];
}

export class GeminiLiveProvider implements VoiceProvider {
  readonly mode = "gemini-live" as const;
  private session?: Session;
  private context: RecipeContext;
  private sessionSystemInstruction = "";
  private isMuted = false;
  private intentionalDisconnect = false;
  private reconnecting = false;
  private modelTurnActive = false;
  private executingTool = false;
  private receivingAssistantTranscript = false;
  private assistantTranscript = "";
  private pendingContext?: RecipeContext;
  private pendingGoAway = false;
  private goAwayTimer?: number;
  private resumptionHandle?: string;
  private ephemeralToken?: string;
  private liveModel = FALLBACK_LIVE_MODEL;
  private sessionGeneration = 0;
  private failedGeneration?: number;
  private lastStatus?: VoiceStatus;
  private inputContext?: AudioContext;
  private inputStream?: MediaStream;
  private inputProcessor?: ScriptProcessorNode;
  private inputSource?: MediaStreamAudioSourceNode;
  private silentGain?: GainNode;
  private microphoneRequestId = 0;
  private outputContext?: AudioContext;
  private nextPlaybackTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();

  constructor(
    private readonly events: VoiceProviderEvents,
    initialContext: RecipeContext
  ) {
    this.context = initialContext;
  }

  private emitStatus(status: VoiceStatus) {
    if (status !== this.lastStatus) {
      liveLog("status", { status });
      this.lastStatus = status;
    }
    this.events.onStatusChange(status);
  }

  private reportFailure(
    operation: string,
    error: unknown,
    generation = this.sessionGeneration
  ) {
    if (this.intentionalDisconnect || this.failedGeneration === generation) return;
    this.failedGeneration = generation;
    const detail = sanitizedErrorMessage(error, "Unknown Gemini Live error.");
    liveLog("failure", { operation, detail, generation });
    this.events.onError(
      new Error(`Gemini Live ${operation} failed. ${detail}`)
    );
    this.emitStatus("error");
  }

  private safeSendRealtimeInput(
    input: RealtimeInput,
    operation: string,
    reportMissingSession = true
  ) {
    const session = this.session;
    if (!session) {
      if (reportMissingSession) {
        this.reportFailure(operation, new Error("The Live session is not connected."));
      }
      return false;
    }
    try {
      session.sendRealtimeInput(input);
      if (operation !== "microphone audio") {
        liveLog("realtime-input-sent", { operation });
      }
      return true;
    } catch (error) {
      this.reportFailure(operation, error);
      queueMicrotask(() => {
        if (this.session === session) this.closeSessionTransport(session);
      });
      return false;
    }
  }

  private safeSendToolResponse(response: ToolResponse) {
    const session = this.session;
    if (!session) {
      this.reportFailure(
        "tool response",
        new Error("The Live session closed before the tool result was sent.")
      );
      return false;
    }
    try {
      session.sendToolResponse(response);
      liveLog("tool-response-sent", {
        responseCount: Array.isArray(response.functionResponses)
          ? response.functionResponses.length
          : 1
      });
      return true;
    } catch (error) {
      this.reportFailure("tool response", error);
      queueMicrotask(() => {
        if (this.session === session) this.closeSessionTransport(session);
      });
      return false;
    }
  }

  private closeSessionTransport(session = this.session) {
    if (!session) return;
    try {
      session.close();
    } catch (error) {
      liveLog("transport-close-skipped", {
        detail: sanitizedErrorMessage(error, "Transport already closed.")
      });
    }
  }

  async connect() {
    if (this.session && !this.intentionalDisconnect) {
      liveLog("connect-skipped", { reason: "already-connected" });
      this.emitStatus(this.isMuted ? "muted" : "listening");
      return;
    }
    this.intentionalDisconnect = false;
    this.ephemeralToken = undefined;
    this.liveModel = FALLBACK_LIVE_MODEL;
    this.failedGeneration = undefined;
    this.isMuted = false;
    this.emitStatus("connecting");
    liveLog("connect-start", { fallbackModel: FALLBACK_LIVE_MODEL });

    try {
      // Create and resume audio synchronously from the Start Cooking gesture.
      // Safari can otherwise block native audio after the token request finishes.
      this.outputContext = new AudioContext({ sampleRate: 24000 });
      const audioReady = this.outputContext.resume().then(() => {
        liveLog("output-audio-ready", {
          sampleRate: this.outputContext?.sampleRate
        });
      });
      this.sessionSystemInstruction =
        `${BASE_SYSTEM_INSTRUCTION}\n\n${formatRecipeContext(this.context)}`;
      await Promise.all([audioReady, this.openSession()]);
    } catch (error) {
      this.reportFailure("connection", error);
      this.closeSessionTransport();
      this.session = undefined;
      await this.outputContext?.close().catch(() => undefined);
      this.outputContext = undefined;
      if (error instanceof GeminiUnavailableError) throw error;
      throw new Error(
        sanitizedErrorMessage(error, "Could not connect to Gemini Live.")
      );
    }

    try {
      await this.startMicrophone();
      if (!this.intentionalDisconnect && this.session) {
        this.emitStatus("listening");
      }
    } catch (error) {
      if (this.intentionalDisconnect) return;
      this.isMuted = true;
      const message =
        error instanceof Error
          ? `Gemini Live connected, but the microphone is unavailable: ${sanitizedErrorMessage(
              error,
              "Microphone unavailable."
            )}`
          : "Gemini Live connected, but the microphone is unavailable.";
      liveLog("microphone-unavailable", {
        detail: sanitizedErrorMessage(error, "Microphone unavailable.")
      });
      this.events.onError(
        new Error(message)
      );
      this.emitStatus("muted");
    }
  }

  async disconnect() {
    liveLog("disconnect-start");
    this.intentionalDisconnect = true;
    this.reconnecting = false;
    this.sessionGeneration += 1;
    this.stopMicrophone();
    this.stopAudioQueue();
    this.closeSessionTransport();
    this.session = undefined;
    this.resumptionHandle = undefined;
    this.ephemeralToken = undefined;
    this.liveModel = FALLBACK_LIVE_MODEL;
    this.pendingContext = undefined;
    this.pendingGoAway = false;
    if (this.goAwayTimer) window.clearTimeout(this.goAwayTimer);
    this.goAwayTimer = undefined;
    this.modelTurnActive = false;
    this.executingTool = false;
    this.receivingAssistantTranscript = false;
    this.assistantTranscript = "";
    await this.outputContext?.close().catch(() => undefined);
    this.outputContext = undefined;
    this.failedGeneration = undefined;
    this.emitStatus("disconnected");
    liveLog("disconnect-complete");
  }

  updateRecipeContext(context: RecipeContext) {
    this.context = context;
    this.pendingContext = context;
    // Give an immediate UI narration request the chance to absorb this context.
    // Otherwise Live can receive a silent state turn and a spoken turn back-to-back.
    queueMicrotask(() => this.flushPendingContext());
  }

  async setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.safeSendRealtimeInput(
        { audioStreamEnd: true },
        "microphone stream end",
        false
      );
      this.stopMicrophone();
      this.stopAudioQueue();
      this.emitStatus("muted");
    } else {
      try {
        await this.startMicrophone();
        if (!this.intentionalDisconnect && this.session) {
          this.emitStatus("listening");
        }
      } catch (error) {
        this.isMuted = true;
        liveLog("microphone-unavailable", {
          detail: sanitizedErrorMessage(error, "Microphone unavailable.")
        });
        this.emitStatus("muted");
        throw error;
      }
    }
  }

  async mute() {
    await this.setMuted(true);
  }

  async unmute() {
    await this.setMuted(false);
  }

  async sendText(text: string) {
    if (!this.session) throw new Error("Gemini Live is not connected.");
    const cleanText = text.trim();
    if (!cleanText) return;
    this.pendingContext = undefined;
    const prompt = cleanText.startsWith(NARRATION_REQUEST_PREFIX)
      ? cleanText
      : `Cook's question: ${cleanText}`;
    const sent = this.safeSendRealtimeInput({
      text: `${formatRecipeContext(this.context)}\n\n${prompt}`
    }, "typed input");
    if (!sent) throw new Error("Gemini Live could not send that message.");
    this.modelTurnActive = true;
    this.events.onUserTranscript(cleanText);
    this.emitStatus("thinking");
  }

  async sendImage(image: File, question: string): Promise<ImageAssessment> {
    return analyzeImageWithGemini(image, question, this.context);
  }

  private async handleMessage(message: LiveServerMessage, generation: number) {
    if (generation !== this.sessionGeneration) return;

    if (
      message.sessionResumptionUpdate?.resumable &&
      message.sessionResumptionUpdate.newHandle
    ) {
      const firstResumableHandle = !this.resumptionHandle;
      this.resumptionHandle = message.sessionResumptionUpdate.newHandle;
      if (firstResumableHandle) liveLog("session-resumable");
    }
    if (message.goAway) {
      this.pendingGoAway = true;
      liveLog("server-go-away", {
        timeLeft: message.goAway.timeLeft
      });
      this.scheduleGoAwayReconnect(message.goAway.timeLeft);
    }
    if (message.toolCallCancellation?.ids?.length) {
      liveLog("tool-calls-cancelled", {
        count: message.toolCallCancellation.ids.length
      });
      this.events.onToolCallCancellation?.(message.toolCallCancellation.ids);
    }

    const content = message.serverContent;
    const inputText = content?.inputTranscription?.text?.trim();
    const outputText = content?.outputTranscription?.text;

    if (inputText) {
      this.modelTurnActive = true;
      this.events.onUserTranscript(inputText);
      this.emitStatus("thinking");
    }
    if (outputText) {
      this.modelTurnActive = true;
      if (!this.receivingAssistantTranscript) {
        this.assistantTranscript = "";
        this.receivingAssistantTranscript = true;
      }
      this.assistantTranscript += outputText;
      this.events.onAssistantTranscript(this.assistantTranscript.trim());
    }

    if (content?.interrupted) {
      liveLog("response-interrupted");
      this.stopAudioQueue();
      this.modelTurnActive = false;
      this.receivingAssistantTranscript = false;
      this.emitStatus(this.isMuted ? "muted" : "listening");
      this.flushPendingContext();
    }

    if (!content?.interrupted) {
      for (const part of content?.modelTurn?.parts ?? []) {
        if (
          part.inlineData?.data &&
          (!part.inlineData.mimeType ||
            part.inlineData.mimeType.startsWith("audio/"))
        ) {
          this.playPcmAudio(part.inlineData.data);
        }
      }
    }

    if (message.toolCall?.functionCalls?.length && this.session) {
      this.modelTurnActive = true;
      this.executingTool = true;
      const functionResponses = [];
      for (const functionCall of message.toolCall.functionCalls) {
        const call: ToolCall = {
          id: functionCall.id ?? crypto.randomUUID(),
          name: functionCall.name as ToolCall["name"],
          args: functionCall.args ?? {}
        };
        liveLog("tool-call", {
          id: call.id,
          name: call.name,
          argumentCount: Object.keys(call.args).length
        });
        try {
          const result = await this.events.onToolCall(call);
          const authoritativeContext = isRecipeContext(result.recipeContext)
            ? result.recipeContext
            : this.context;
          this.context = authoritativeContext;
          const { recipeContext: _recipeContext, ...toolResult } = result;
          functionResponses.push({
            id: call.id,
            name: call.name,
            response: {
              result: toolResult,
              recipeContext: formatRecipeContext(authoritativeContext)
            }
          });
          liveLog("tool-result", {
            id: call.id,
            name: call.name,
            ok: result.ok !== false
          });
        } catch (error) {
          const detail = sanitizedErrorMessage(error, "Tool execution failed.");
          liveLog("tool-result", {
            id: call.id,
            name: call.name,
            ok: false,
            detail
          });
          functionResponses.push({
            id: call.id,
            name: call.name,
            response: {
              error: detail
            }
          });
        }
      }
      this.pendingContext = undefined;
      this.executingTool = false;
      this.safeSendToolResponse({ functionResponses });
    }

    if (content?.turnComplete) {
      this.modelTurnActive = false;
      this.receivingAssistantTranscript = false;
      const stillPlaying =
        this.outputContext && this.nextPlaybackTime > this.outputContext.currentTime;
      if (!stillPlaying) {
        this.emitStatus(this.isMuted ? "muted" : "listening");
      }
      if (this.pendingGoAway) {
        this.rotateSessionAfterGoAway();
      } else {
        this.flushPendingContext();
      }
    }

    if (message.goAway) this.rotateSessionAfterGoAway();
  }

  private async openSession(handle?: string) {
    if (!this.ephemeralToken) {
      const credentials = await this.fetchEphemeralToken();
      this.ephemeralToken = credentials.token;
      this.liveModel = credentials.model;
    }
    const token = this.ephemeralToken;
    if (!token) throw new Error("Gemini returned an empty ephemeral token.");
    const ai = new GoogleGenAI({
      apiKey: token,
      httpOptions: { apiVersion: "v1alpha" }
    });
    const generation = ++this.sessionGeneration;
    this.failedGeneration = undefined;
    liveLog("session-opening", {
      generation,
      model: this.liveModel,
      resuming: Boolean(handle)
    });

    const session = await ai.live.connect({
      model: this.liveModel,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: this.sessionSystemInstruction,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" }
          }
        },
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [
          {
            functionDeclarations: buildFunctionDeclarations(
              this.context.totalSteps
            )
          }
        ],
        sessionResumption: handle ? { handle } : {},
        contextWindowCompression: { slidingWindow: {} }
      },
      callbacks: {
        onopen: () => {
          liveLog("websocket-open", { generation, model: this.liveModel });
        },
        onmessage: (message) => {
          void this.handleMessage(message, generation).catch((error) => {
            this.reportFailure("message handling", error, generation);
          });
        },
        onerror: (event) => {
          if (generation !== this.sessionGeneration || this.intentionalDisconnect) return;
          this.reportFailure(
            "connection",
            event.error instanceof Error
              ? event.error
              : new Error("The Gemini Live WebSocket reported an error."),
            generation
          );
        },
        onclose: (event) => this.handleSessionClose(generation, event)
      }
    });

    if (generation !== this.sessionGeneration || this.intentionalDisconnect) {
      this.closeSessionTransport(session);
      return;
    }
    this.session = session;
    liveLog("session-ready", {
      generation,
      model: this.liveModel,
      resuming: Boolean(handle)
    });
  }

  private async fetchEphemeralToken() {
    const tokenResponse = await fetch("/api/gemini/token", { method: "POST" });
    if (!tokenResponse.ok) {
      const payload = (await tokenResponse.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (payload.code === "GEMINI_NOT_CONFIGURED") {
        throw new GeminiUnavailableError(payload.error ?? "Gemini is not configured.");
      }
      throw new Error(payload.error ?? "Could not create a Gemini Live token.");
    }

    const payload = (await tokenResponse.json()) as {
      token?: unknown;
      model?: unknown;
    };
    const token = typeof payload.token === "string" ? payload.token : "";
    if (!token) throw new Error("The server returned an empty Gemini token.");
    const model =
      typeof payload.model === "string" &&
      /^[a-z0-9][a-z0-9._/-]*$/i.test(payload.model)
        ? payload.model
        : FALLBACK_LIVE_MODEL;
    liveLog("ephemeral-token-received", { model });
    return { token, model };
  }

  private handleSessionClose(generation: number, event?: CloseEvent) {
    if (generation !== this.sessionGeneration) return;
    liveLog("websocket-close", {
      generation,
      code: event?.code,
      clean: event?.wasClean
    });
    this.stopAudioQueue();
    this.session = undefined;
    this.pendingGoAway = false;
    if (this.goAwayTimer) window.clearTimeout(this.goAwayTimer);
    this.goAwayTimer = undefined;
    if (this.intentionalDisconnect || this.reconnecting) return;
    if (this.resumptionHandle) {
      void this.reconnectSession();
      return;
    }
    this.stopMicrophone();
    this.reportFailure(
      "connection",
      new Error("The Live session closed before it could be resumed."),
      generation
    );
  }

  private async reconnectSession() {
    if (
      this.reconnecting ||
      this.intentionalDisconnect ||
      !this.resumptionHandle
    ) {
      return;
    }

    this.reconnecting = true;
    this.pendingGoAway = false;
    if (this.goAwayTimer) window.clearTimeout(this.goAwayTimer);
    this.goAwayTimer = undefined;
    this.emitStatus("connecting");
    liveLog("session-resume-start");
    const handle = this.resumptionHandle;
    const previousSession = this.session;
    this.session = undefined;
    this.sessionGeneration += 1;
    this.stopAudioQueue();
    this.closeSessionTransport(previousSession);

    let resumed = false;
    try {
      await this.openSession(handle);
      if (!this.session) return;
      resumed = true;
    } catch (error) {
      this.reportFailure("session resume", error);
      this.stopMicrophone();
    } finally {
      this.reconnecting = false;
      if (resumed && this.session && !this.intentionalDisconnect) {
        liveLog("session-resume-complete");
        this.emitStatus(this.isMuted ? "muted" : "listening");
        // flushPendingContext intentionally runs after reconnecting is false.
        this.flushPendingContext();
      }
    }
  }

  private scheduleGoAwayReconnect(timeLeft?: string) {
    if (this.goAwayTimer) window.clearTimeout(this.goAwayTimer);
    const seconds = Number.parseFloat(timeLeft ?? "");
    const delay = Number.isFinite(seconds)
      ? Math.max(250, seconds * 1000 - 1000)
      : 5000;
    this.goAwayTimer = window.setTimeout(() => {
      this.goAwayTimer = undefined;
      this.rotateSessionAfterGoAway(true);
    }, delay);
  }

  private rotateSessionAfterGoAway(force = false) {
    if (
      !this.pendingGoAway ||
      !this.resumptionHandle ||
      this.reconnecting ||
      this.intentionalDisconnect
    ) {
      return;
    }
    if (
      !force &&
      (this.modelTurnActive || this.executingTool || this.activeSources.size > 0)
    ) {
      return;
    }
    this.pendingGoAway = false;
    if (this.goAwayTimer) window.clearTimeout(this.goAwayTimer);
    this.goAwayTimer = undefined;
    void this.reconnectSession();
  }

  private flushPendingContext() {
    if (
      !this.pendingContext ||
      !this.session ||
      this.modelTurnActive ||
      this.executingTool ||
      this.reconnecting
    ) {
      return;
    }
    const context = this.pendingContext;
    const sent = this.safeSendRealtimeInput({
      text:
        `[Recipe state update. Do not respond yet; use this state for the cook's next request.]\n` +
        formatRecipeContext(context)
    }, "recipe context update");
    if (!sent) return;
    this.pendingContext = undefined;
    this.modelTurnActive = true;
  }

  private async startMicrophone() {
    if (this.isMuted || this.inputStream || !this.session) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access is not supported in this browser.");
    }

    const requestId = ++this.microphoneRequestId;
    const generation = this.sessionGeneration;
    const session = this.session;
    liveLog("microphone-permission-requested", { generation });
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    if (
      requestId !== this.microphoneRequestId ||
      generation !== this.sessionGeneration ||
      session !== this.session ||
      this.intentionalDisconnect ||
      this.isMuted
    ) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    let inputContext: AudioContext | undefined;
    try {
      inputContext = new AudioContext();
      await inputContext.resume();
      if (
        requestId !== this.microphoneRequestId ||
        generation !== this.sessionGeneration ||
        session !== this.session ||
        this.intentionalDisconnect ||
        this.isMuted
      ) {
        stream.getTracks().forEach((track) => track.stop());
        await inputContext.close().catch(() => undefined);
        return;
      }

      const inputSource = inputContext.createMediaStreamSource(stream);
      const inputProcessor = inputContext.createScriptProcessor(4096, 1, 1);
      const silentGain = inputContext.createGain();
      silentGain.gain.value = 0;

      inputProcessor.onaudioprocess = (event) => {
        if (!this.session || this.isMuted) return;
        const pcm = downsampleToPcm16(
          event.inputBuffer.getChannelData(0),
          inputContext?.sampleRate ?? 48000
        );
        const sent = this.safeSendRealtimeInput({
          audio: {
            data: bytesToBase64(new Uint8Array(pcm.buffer)),
            mimeType: "audio/pcm;rate=16000"
          }
        }, "microphone audio", false);
        if (!sent) queueMicrotask(() => this.stopMicrophone());
      };

      inputSource.connect(inputProcessor);
      inputProcessor.connect(silentGain);
      silentGain.connect(inputContext.destination);
      this.inputStream = stream;
      this.inputContext = inputContext;
      this.inputSource = inputSource;
      this.inputProcessor = inputProcessor;
      this.silentGain = silentGain;
      liveLog("microphone-streaming", {
        generation,
        inputSampleRate: inputContext.sampleRate,
        outputSampleRate: 16000
      });
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      await inputContext?.close().catch(() => undefined);
      throw error;
    }
  }

  private stopMicrophone() {
    const wasStreaming = Boolean(this.inputStream || this.inputContext);
    this.microphoneRequestId += 1;
    if (this.inputProcessor) this.inputProcessor.onaudioprocess = null;
    this.inputProcessor?.disconnect();
    this.inputSource?.disconnect();
    this.silentGain?.disconnect();
    this.inputStream?.getTracks().forEach((track) => track.stop());
    void this.inputContext?.close();
    this.inputProcessor = undefined;
    this.inputSource = undefined;
    this.silentGain = undefined;
    this.inputStream = undefined;
    this.inputContext = undefined;
    if (wasStreaming) liveLog("microphone-stopped");
  }

  private playPcmAudio(base64Audio: string) {
    if (this.isMuted || !this.outputContext) return;
    this.modelTurnActive = true;
    const pcm = base64ToPcm16(base64Audio);
    const buffer = this.outputContext.createBuffer(1, pcm.length, 24000);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < pcm.length; index += 1) {
      channel[index] = pcm[index] / 0x8000;
    }

    const source = this.outputContext.createBufferSource();
    const generation = this.sessionGeneration;
    const startingPlayback = this.lastStatus !== "speaking";
    source.buffer = buffer;
    source.connect(this.outputContext.destination);
    const startAt = Math.max(this.outputContext.currentTime, this.nextPlaybackTime);
    this.nextPlaybackTime = startAt + buffer.duration;
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      if (
        !this.activeSources.size &&
        generation === this.sessionGeneration &&
        this.session &&
        !this.modelTurnActive &&
        !this.reconnecting &&
        !this.intentionalDisconnect
      ) {
        this.emitStatus(this.isMuted ? "muted" : "listening");
      }
      if (!this.activeSources.size) {
        if (!this.modelTurnActive) liveLog("native-audio-idle");
        this.rotateSessionAfterGoAway();
      }
    };
    source.start(startAt);
    if (startingPlayback) {
      liveLog("native-audio-playing", {
        sampleRate: buffer.sampleRate
      });
    }
    this.emitStatus("speaking");
  }

  private stopAudioQueue() {
    const stoppedCount = this.activeSources.size;
    this.activeSources.forEach((source) => {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // A source may already have ended.
      }
    });
    this.activeSources.clear();
    this.nextPlaybackTime = this.outputContext?.currentTime ?? 0;
    if (stoppedCount) {
      liveLog("native-audio-cleared", { sourceCount: stoppedCount });
    }
  }
}
