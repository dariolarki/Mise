import type {
  RecipeContext,
  RecipeContextStep,
  RecipeContextSuggestedTimer,
  RecipeContextTimer,
  RecipeContextVisualCheckpoint
} from "./types";

interface RecipeContextSourceStep {
  title?: string;
  instruction: string;
  detail: string;
  safety?: string;
}

interface RecipeContextSourceSafetyNote {
  stepNumber?: number;
  text: string;
}

interface RecipeContextSourceSuggestedTimer {
  stepNumber: number;
  label: string;
  durationSeconds: number;
  recommendation?: "recommended" | "optional";
  cue?: string;
}

interface RecipeContextSourceVisualCheckpoint {
  stepNumber: number;
  question: string;
  guidance?: string;
  immediateAction?: string;
  requiresMeasurement?: boolean;
}

export interface RecipeContextSource {
  id?: string;
  title: string;
  description?: string;
  technique?: string;
  steps: readonly RecipeContextSourceStep[];
  safetyNotes?: readonly RecipeContextSourceSafetyNote[];
  suggestedTimers?: readonly RecipeContextSourceSuggestedTimer[];
  visualCheckpoints?: readonly RecipeContextSourceVisualCheckpoint[];
}

export interface BuildRecipeContextInput {
  recipe: RecipeContextSource;
  currentStep: number;
  completedSteps: readonly number[];
  activeTimers: readonly RecipeContextTimer[];
}

function uniqueStrings(values: readonly (string | undefined)[]) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  );
}

export function buildRecipeContext({
  recipe,
  currentStep,
  completedSteps,
  activeTimers
}: BuildRecipeContextInput): RecipeContext {
  if (!recipe.steps.length) {
    throw new Error(`Recipe "${recipe.title}" must contain at least one step.`);
  }

  const safeStep = Math.min(
    Math.max(Number.isFinite(currentStep) ? Math.round(currentStep) : 1, 1),
    recipe.steps.length
  );
  const step = recipe.steps[safeStep - 1];
  const recipeSteps: RecipeContextStep[] = recipe.steps.map(
    ({ title, instruction, detail, safety }, index) => ({
      stepNumber: index + 1,
      title,
      instruction,
      detail,
      safety
    })
  );
  const relevantSafetyNotes = uniqueStrings([
    step.safety,
    ...(recipe.safetyNotes ?? [])
      .filter((note) => note.stepNumber === undefined || note.stepNumber === safeStep)
      .map((note) => note.text)
  ]);
  const suggestedTimers: RecipeContextSuggestedTimer[] = (
    recipe.suggestedTimers ?? []
  )
    .filter((timer) => timer.stepNumber === safeStep)
    .map(({ label, durationSeconds, recommendation, cue }) => ({
      label,
      durationSeconds,
      recommendation,
      cue
    }));
  const checkpoint = recipe.visualCheckpoints?.find(
    (candidate) => candidate.stepNumber === safeStep
  );
  const visualCheckpoint: RecipeContextVisualCheckpoint | undefined = checkpoint
    ? {
        question: checkpoint.question,
        guidance: checkpoint.guidance,
        immediateAction: checkpoint.immediateAction,
        requiresMeasurement: checkpoint.requiresMeasurement
      }
    : undefined;

  return {
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    recipeDescription: recipe.description,
    recipeTechnique: recipe.technique,
    recipeSteps,
    currentStep: safeStep,
    totalSteps: recipe.steps.length,
    currentInstruction: step.instruction,
    currentDetail: step.detail,
    currentSafety: step.safety,
    relevantSafetyNotes,
    suggestedTimers,
    visualCheckpoint,
    completedSteps: Array.from(
      new Set(
        completedSteps.filter(
          (stepNumber) =>
            Number.isInteger(stepNumber) &&
            stepNumber >= 1 &&
            stepNumber <= recipe.steps.length
        )
      )
    ).sort((a, b) => a - b),
    activeTimers: activeTimers.map(({ label, remainingSeconds }) => ({
      label,
      remainingSeconds
    }))
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isRecipeStepArray(
  value: unknown,
  totalSteps: number | undefined
): value is RecipeContextStep[] {
  return (
    Array.isArray(value) &&
    value.length === totalSteps &&
    value.every((step, index) => {
      if (!step || typeof step !== "object") return false;
      const candidate = step as RecipeContextStep;
      return (
        candidate.stepNumber === index + 1 &&
        (candidate.title === undefined || typeof candidate.title === "string") &&
        typeof candidate.instruction === "string" &&
        typeof candidate.detail === "string" &&
        (candidate.safety === undefined || typeof candidate.safety === "string")
      );
    })
  );
}

function isTimerArray(value: unknown): value is RecipeContextTimer[] {
  return (
    Array.isArray(value) &&
    value.every(
      (timer) =>
        Boolean(timer) &&
        typeof timer === "object" &&
        typeof (timer as RecipeContextTimer).label === "string" &&
        Number.isFinite((timer as RecipeContextTimer).remainingSeconds) &&
        (timer as RecipeContextTimer).remainingSeconds >= 0
    )
  );
}

function isSuggestedTimerArray(
  value: unknown
): value is RecipeContextSuggestedTimer[] {
  return (
    Array.isArray(value) &&
    value.every(
      (timer) =>
        Boolean(timer) &&
        typeof timer === "object" &&
        typeof (timer as RecipeContextSuggestedTimer).label === "string" &&
        Number.isFinite(
          (timer as RecipeContextSuggestedTimer).durationSeconds
        ) &&
        (timer as RecipeContextSuggestedTimer).durationSeconds > 0 &&
        ((timer as RecipeContextSuggestedTimer).recommendation === undefined ||
          ["recommended", "optional"].includes(
            (timer as RecipeContextSuggestedTimer).recommendation as string
          )) &&
        ((timer as RecipeContextSuggestedTimer).cue === undefined ||
          typeof (timer as RecipeContextSuggestedTimer).cue === "string")
    )
  );
}

function isVisualCheckpoint(
  value: unknown
): value is RecipeContextVisualCheckpoint {
  if (!value || typeof value !== "object") return false;
  const checkpoint = value as RecipeContextVisualCheckpoint;
  return (
    typeof checkpoint.question === "string" &&
    (checkpoint.guidance === undefined ||
      typeof checkpoint.guidance === "string") &&
    (checkpoint.immediateAction === undefined ||
      typeof checkpoint.immediateAction === "string") &&
    (checkpoint.requiresMeasurement === undefined ||
      typeof checkpoint.requiresMeasurement === "boolean")
  );
}

export function isRecipeContext(value: unknown): value is RecipeContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<RecipeContext>;
  const hasValidBounds =
    Number.isInteger(context.currentStep) &&
    Number.isInteger(context.totalSteps) &&
    (context.totalSteps ?? 0) >= 1 &&
    (context.currentStep ?? 0) >= 1 &&
    (context.currentStep ?? 0) <= (context.totalSteps ?? 0);
  return (
    (context.recipeId === undefined || typeof context.recipeId === "string") &&
    typeof context.recipeTitle === "string" &&
    (context.recipeDescription === undefined ||
      typeof context.recipeDescription === "string") &&
    (context.recipeTechnique === undefined ||
      typeof context.recipeTechnique === "string") &&
    hasValidBounds &&
    isRecipeStepArray(context.recipeSteps, context.totalSteps) &&
    typeof context.currentInstruction === "string" &&
    typeof context.currentDetail === "string" &&
    (context.currentSafety === undefined ||
      typeof context.currentSafety === "string") &&
    (context.relevantSafetyNotes === undefined ||
      isStringArray(context.relevantSafetyNotes)) &&
    (context.suggestedTimers === undefined ||
      isSuggestedTimerArray(context.suggestedTimers)) &&
    (context.visualCheckpoint === undefined ||
      isVisualCheckpoint(context.visualCheckpoint)) &&
    Array.isArray(context.completedSteps) &&
    context.completedSteps.every(
      (stepNumber) =>
        Number.isInteger(stepNumber) &&
        stepNumber >= 1 &&
        stepNumber <= (context.totalSteps ?? 0)
    ) &&
    isTimerArray(context.activeTimers)
  );
}
