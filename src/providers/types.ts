export type VoiceStatus =
  | "disconnected"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "muted";

export type ProviderMode = "gemini-live" | "mock";

export interface RecipeContextTimer {
  label: string;
  remainingSeconds: number;
}

export interface RecipeContextSuggestedTimer {
  label: string;
  durationSeconds: number;
  recommendation?: "recommended" | "optional";
  cue?: string;
}

export interface RecipeContextVisualCheckpoint {
  question: string;
  guidance?: string;
  immediateAction?: string;
  requiresMeasurement?: boolean;
}

export interface RecipeContext {
  recipeId?: string;
  recipeTitle: string;
  recipeDescription?: string;
  recipeTechnique?: string;
  currentStep: number;
  totalSteps: number;
  currentInstruction: string;
  currentDetail: string;
  currentSafety?: string;
  relevantSafetyNotes?: string[];
  suggestedTimers?: RecipeContextSuggestedTimer[];
  visualCheckpoint?: RecipeContextVisualCheckpoint;
  completedSteps: number[];
  activeTimers: RecipeContextTimer[];
}

export type ToolName =
  | "start_timer"
  | "advance_step"
  | "repeat_step"
  | "set_current_step";

export interface ToolCall {
  id: string;
  name: ToolName;
  args: Record<string, unknown>;
}

export interface ImageAssessment {
  assessment: string;
  action: string;
  safetyWarning?: string;
  isMock?: boolean;
}

export interface VoiceProviderEvents {
  onStatusChange(status: VoiceStatus): void;
  onUserTranscript(text: string): void;
  onAssistantTranscript(text: string): void;
  onToolCall(call: ToolCall): Promise<Record<string, unknown>>;
  onToolCallCancellation?(ids: string[]): void;
  onError(error: Error): void;
}

export interface VoiceProvider {
  readonly mode: ProviderMode;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendText(text: string): Promise<void>;
  sendImage(image: File, question: string): Promise<ImageAssessment>;
  updateRecipeContext(context: RecipeContext): void;
  setMuted?(muted: boolean): Promise<void>;
}

export class GeminiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiUnavailableError";
  }
}
