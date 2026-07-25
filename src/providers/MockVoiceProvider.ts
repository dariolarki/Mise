import { analyzeImageWithGemini } from "./imageAnalysis";
import { isRecipeContext } from "./recipeContext";
import { NARRATION_REQUEST_PREFIX } from "./systemInstruction";
import type {
  ImageAssessment,
  RecipeContext,
  ToolCall,
  VoiceProvider,
  VoiceProviderEvents,
} from "./types";
import { GeminiUnavailableError } from "./types";

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export class MockVoiceProvider implements VoiceProvider {
  readonly mode = "mock" as const;
  private context: RecipeContext;
  private connected = false;
  private muted = false;

  constructor(
    private readonly events: VoiceProviderEvents,
    initialContext: RecipeContext,
    private readonly allowMockImageFallback = true
  ) {
    this.context = initialContext;
  }

  async connect() {
    this.events.onStatusChange("connecting");
    await wait(500);
    this.connected = true;
    this.events.onStatusChange("listening");
  }

  async disconnect() {
    window.speechSynthesis?.cancel();
    this.connected = false;
    this.events.onStatusChange("disconnected");
  }

  updateRecipeContext(context: RecipeContext) {
    this.context = context;
  }

  async setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) window.speechSynthesis?.cancel();
    this.events.onStatusChange(muted ? "muted" : "listening");
  }

  async sendText(text: string) {
    if (!this.connected) throw new Error("Mock voice provider is not connected.");
    const cleanText = text.trim();
    if (!cleanText) return;

    this.events.onUserTranscript(cleanText);
    this.events.onStatusChange("thinking");
    await wait(450);

    const lower = cleanText.toLowerCase();
    let response = "";

    if (cleanText.startsWith(NARRATION_REQUEST_PREFIX)) {
      response = this.narrateCurrentStep();
    } else if (lower.includes("timer")) {
      const requestedToken = lower.match(
        /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/
      )?.[1];
      const numberWords: Record<string, number> = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10
      };
      const requestedNumber = requestedToken
        ? numberWords[requestedToken] ?? Number(requestedToken)
        : Number.NaN;
      const suggestedTimer = this.context.suggestedTimers?.[0];
      const hasRequestedDuration = Number.isFinite(requestedNumber);
      const durationSeconds = hasRequestedDuration
        ? lower.includes("second")
          ? requestedNumber
          : requestedNumber * 60
        : suggestedTimer?.durationSeconds ?? 120;
      const label =
        suggestedTimer?.label ??
        (this.isSteakContext() && this.context.currentStep === 4
          ? "First side"
          : "Cooking timer");
      await this.runTool("start_timer", {
        label,
        durationSeconds
      });
      response = `Timer started for ${this.formatDuration(durationSeconds)}.`;
    } else if (
      (this.context.visualCheckpoint?.requiresMeasurement ||
        this.isChickenContext()) &&
      /\b(done|doneness|safe|ready|temperature|temp|look)\b/.test(lower)
    ) {
      response =
        "Appearance alone cannot confirm that. Check the internal temperature with a thermometer before deciding.";
    } else if (/\b(next|advance|done)\b/.test(lower)) {
      const stepNumber = Math.min(
        this.context.currentStep + 1,
        this.context.totalSteps
      );
      await this.runTool("advance_step", {
        stepNumber
      });
      response = this.narrateCurrentStep();
    } else if (/\b(back|previous)\b/.test(lower)) {
      const stepNumber = Math.max(this.context.currentStep - 1, 1);
      await this.runTool("set_current_step", { stepNumber });
      response = this.narrateCurrentStep();
    } else if (lower.includes("repeat")) {
      await this.runTool("repeat_step", {});
      response = this.context.currentInstruction;
    } else if (lower.includes("crust") && this.isSteakContext()) {
      response = "Look for an even deep-brown surface that releases cleanly. If it still sticks, give it another 30 seconds.";
    } else if (
      this.context.visualCheckpoint &&
      /\b(look|right|ready|hot|clump\w*|thick|brown|curd|roll|liquid|tender|dark)\b/.test(
        lower
      )
    ) {
      response = [
        this.context.visualCheckpoint.guidance,
        this.context.visualCheckpoint.immediateAction
      ]
        .filter(Boolean)
        .join(" ");
    } else {
      response = `${this.context.currentInstruction} ${this.context.currentDetail}`;
    }

    await this.speak(response);
  }

  async sendImage(image: File, question: string): Promise<ImageAssessment> {
    this.events.onStatusChange("thinking");
    try {
      return await analyzeImageWithGemini(image, question, this.context);
    } catch (error) {
      if (
        !(error instanceof GeminiUnavailableError) ||
        !this.allowMockImageFallback
      ) {
        throw error;
      }
      await wait(900);
      const requiresMeasurement =
        this.context.visualCheckpoint?.requiresMeasurement ||
        this.isChickenContext();
      return {
        assessment: "Mock assessment: image analysis needs a Gemini API credential.",
        nextAction:
          this.context.visualCheckpoint?.immediateAction ??
          (this.isSteakContext()
            ? "If the steak releases cleanly and the crust is deep brown, flip it; otherwise give it 30 more seconds."
            : this.context.currentInstruction),
        safetyNote: requiresMeasurement
          ? "Appearance cannot confirm doneness or safety. Use a thermometer and provide the internal reading."
          : this.context.relevantSafetyNotes?.[0] ??
            this.context.currentSafety ??
            "Use normal hot-pan and food-handling precautions.",
        isMock: true
      };
    } finally {
      this.events.onStatusChange(this.muted ? "muted" : "listening");
    }
  }

  private async runTool(name: ToolCall["name"], args: Record<string, unknown>) {
    const result = await this.events.onToolCall({
      id: `mock-${Date.now()}`,
      name,
      args
    });
    if (isRecipeContext(result.recipeContext)) {
      this.context = result.recipeContext;
    }
    return result;
  }

  private narrateCurrentStep() {
    const safetyNotes = this.context.relevantSafetyNotes?.length
      ? ` ${this.context.relevantSafetyNotes[0]}`
      : this.context.currentSafety
        ? ` ${this.context.currentSafety}`
        : "";
    return `${this.context.currentInstruction} ${this.context.currentDetail}${safetyNotes} Ask me if anything looks off.`;
  }

  private isSteakContext() {
    return (
      this.context.recipeId === "steak-au-poivre" ||
      this.context.recipeTitle.toLowerCase() === "steak au poivre"
    );
  }

  private isChickenContext() {
    return (
      this.context.recipeId === "roast-chicken" ||
      this.context.recipeTitle.toLowerCase().includes("chicken")
    );
  }

  private formatDuration(durationSeconds: number) {
    if (durationSeconds % 60 === 0) {
      const minutes = durationSeconds / 60;
      return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }
    return `${durationSeconds} second${durationSeconds === 1 ? "" : "s"}`;
  }

  private async speak(text: string) {
    this.events.onAssistantTranscript(text);
    if (this.muted || !("speechSynthesis" in window)) {
      this.events.onStatusChange(this.muted ? "muted" : "listening");
      return;
    }

    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.08;
      utterance.pitch = 0.92;
      utterance.onstart = () => this.events.onStatusChange("speaking");
      utterance.onend = () => {
        this.events.onStatusChange(this.muted ? "muted" : "listening");
        resolve();
      };
      utterance.onerror = () => {
        this.events.onStatusChange(this.muted ? "muted" : "listening");
        resolve();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }
}
