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
  type VoiceProviderEvents
} from "./types";

const LIVE_MODEL = "gemini-3.1-flash-live-preview";

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
  private sessionGeneration = 0;
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

  async connect() {
    this.intentionalDisconnect = false;
    this.ephemeralToken = undefined;
    this.events.onStatusChange("connecting");
    // Create and resume audio synchronously from the Start Cooking gesture.
    // Safari can otherwise block native audio after the token request finishes.
    this.outputContext = new AudioContext({ sampleRate: 24000 });
    const audioReady = this.outputContext.resume();
    this.sessionSystemInstruction =
      `${BASE_SYSTEM_INSTRUCTION}\n\n${formatRecipeContext(this.context)}`;
    await Promise.all([audioReady, this.openSession()]);

    try {
      await this.startMicrophone();
      if (!this.intentionalDisconnect && this.session) {
        this.events.onStatusChange("listening");
      }
    } catch (error) {
      if (this.intentionalDisconnect) return;
      this.isMuted = true;
      this.events.onError(
        new Error(
          error instanceof Error
            ? `Gemini Live connected, but the microphone is unavailable: ${error.message}`
            : "Gemini Live connected, but the microphone is unavailable."
        )
      );
      this.events.onStatusChange("muted");
    }
  }

  async disconnect() {
    this.intentionalDisconnect = true;
    this.reconnecting = false;
    this.sessionGeneration += 1;
    this.stopMicrophone();
    this.stopAudioQueue();
    this.session?.close();
    this.session = undefined;
    this.resumptionHandle = undefined;
    this.ephemeralToken = undefined;
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
    this.events.onStatusChange("disconnected");
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
      this.session?.sendRealtimeInput({ audioStreamEnd: true });
      this.stopMicrophone();
      this.stopAudioQueue();
      this.events.onStatusChange("muted");
    } else {
      try {
        await this.startMicrophone();
        if (!this.intentionalDisconnect && this.session) {
          this.events.onStatusChange("listening");
        }
      } catch (error) {
        this.isMuted = true;
        this.events.onStatusChange("muted");
        throw error;
      }
    }
  }

  async sendText(text: string) {
    if (!this.session) throw new Error("Gemini Live is not connected.");
    const cleanText = text.trim();
    if (!cleanText) return;
    this.pendingContext = undefined;
    this.modelTurnActive = true;
    this.events.onUserTranscript(cleanText);
    this.events.onStatusChange("thinking");
    const prompt = cleanText.startsWith(NARRATION_REQUEST_PREFIX)
      ? cleanText
      : `Cook's question: ${cleanText}`;
    this.session.sendRealtimeInput({
      text: `${formatRecipeContext(this.context)}\n\n${prompt}`
    });
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
      this.resumptionHandle = message.sessionResumptionUpdate.newHandle;
    }
    if (message.goAway) {
      this.pendingGoAway = true;
      this.scheduleGoAwayReconnect(message.goAway.timeLeft);
    }
    if (message.toolCallCancellation?.ids?.length) {
      this.events.onToolCallCancellation?.(message.toolCallCancellation.ids);
    }

    const content = message.serverContent;
    const inputText = content?.inputTranscription?.text?.trim();
    const outputText = content?.outputTranscription?.text;

    if (inputText) {
      this.modelTurnActive = true;
      this.events.onUserTranscript(inputText);
      this.events.onStatusChange("thinking");
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
      this.stopAudioQueue();
      this.modelTurnActive = false;
      this.receivingAssistantTranscript = false;
      this.events.onStatusChange(this.isMuted ? "muted" : "listening");
      this.flushPendingContext();
    }

    if (!content?.interrupted) {
      for (const part of content?.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) this.playPcmAudio(part.inlineData.data);
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
        } catch (error) {
          functionResponses.push({
            id: call.id,
            name: call.name,
            response: {
              error: error instanceof Error ? error.message : "Tool execution failed."
            }
          });
        }
      }
      this.pendingContext = undefined;
      this.executingTool = false;
      this.session?.sendToolResponse({ functionResponses });
    }

    if (content?.turnComplete) {
      this.modelTurnActive = false;
      this.receivingAssistantTranscript = false;
      const stillPlaying =
        this.outputContext && this.nextPlaybackTime > this.outputContext.currentTime;
      if (!stillPlaying) {
        this.events.onStatusChange(this.isMuted ? "muted" : "listening");
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
    const token = this.ephemeralToken ?? (await this.fetchEphemeralToken());
    this.ephemeralToken = token;
    const ai = new GoogleGenAI({
      apiKey: token,
      httpOptions: { apiVersion: "v1alpha" }
    });
    const generation = ++this.sessionGeneration;

    const session = await ai.live.connect({
      model: LIVE_MODEL,
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
        onopen: () => undefined,
        onmessage: (message) => void this.handleMessage(message, generation),
        onerror: (event) => {
          if (generation !== this.sessionGeneration || this.intentionalDisconnect) return;
          const message =
            event.error instanceof Error
              ? event.error.message
              : "Gemini Live connection error.";
          this.events.onError(new Error(message));
        },
        onclose: () => this.handleSessionClose(generation)
      }
    });

    if (generation !== this.sessionGeneration || this.intentionalDisconnect) {
      session.close();
      return;
    }
    this.session = session;
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

    const { token } = (await tokenResponse.json()) as { token: string };
    if (!token) throw new Error("The server returned an empty Gemini token.");
    return token;
  }

  private handleSessionClose(generation: number) {
    if (generation !== this.sessionGeneration) return;
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
    this.events.onStatusChange("disconnected");
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
    this.events.onStatusChange("connecting");
    const handle = this.resumptionHandle;
    const previousSession = this.session;
    this.session = undefined;
    this.sessionGeneration += 1;
    this.stopAudioQueue();
    previousSession?.close();

    try {
      await this.openSession(handle);
      if (!this.session) return;
      this.events.onStatusChange(this.isMuted ? "muted" : "listening");
      this.flushPendingContext();
    } catch (error) {
      this.events.onError(
        new Error(
          error instanceof Error
            ? `Could not resume Gemini Live: ${error.message}`
            : "Could not resume Gemini Live."
        )
      );
      this.stopMicrophone();
      this.events.onStatusChange("disconnected");
    } finally {
      this.reconnecting = false;
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
    this.pendingContext = undefined;
    this.modelTurnActive = true;
    this.session.sendRealtimeInput({
      text:
        `[Recipe state update. Do not respond yet; use this state for the cook's next request.]\n` +
        formatRecipeContext(context)
    });
  }

  private async startMicrophone() {
    if (this.isMuted || this.inputStream || !this.session) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access is not supported in this browser.");
    }

    const requestId = ++this.microphoneRequestId;
    const generation = this.sessionGeneration;
    const session = this.session;
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
        this.session.sendRealtimeInput({
          audio: {
            data: bytesToBase64(new Uint8Array(pcm.buffer)),
            mimeType: "audio/pcm;rate=16000"
          }
        });
      };

      inputSource.connect(inputProcessor);
      inputProcessor.connect(silentGain);
      silentGain.connect(inputContext.destination);
      this.inputStream = stream;
      this.inputContext = inputContext;
      this.inputSource = inputSource;
      this.inputProcessor = inputProcessor;
      this.silentGain = silentGain;
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      await inputContext?.close().catch(() => undefined);
      throw error;
    }
  }

  private stopMicrophone() {
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
        this.events.onStatusChange(this.isMuted ? "muted" : "listening");
      }
      if (!this.activeSources.size) this.rotateSessionAfterGoAway();
    };
    source.start(startAt);
    this.events.onStatusChange("speaking");
  }

  private stopAudioQueue() {
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
  }
}
