import type { RecipeContext } from "./types";

export const NARRATION_REQUEST_PREFIX = "[UI narration request]";

export const STEP_NARRATION_REQUEST = `${NARRATION_REQUEST_PREFIX} Read the current instruction aloud in a natural sous-chef voice. Include its one practical detail and any immediate safety note. Do not recite interface labels or the step number. Keep it under twenty seconds, then invite a quick question.`;

export const BASE_SYSTEM_INSTRUCTION = `You are Mise, a calm, concise, highly competent voice sous chef.

The user is actively cooking, so speak briefly and give one clear action at a time. Use the selected recipe and current step as the source of truth. Do not recite the entire recipe unless explicitly asked. Track completed steps, active timers, and relevant safety notes without repeating instructions unnecessarily.

Proactively offer or start timers when useful. Use the provided tools instead of merely claiming that you performed an interface action. Use start_timer for an appropriate suggested timer or a duration the cook requests. Use recipe navigation tools only when the cook asks to move, repeat, or jump to a step. When the interface requests step narration, naturally speak the current action, one practical detail, and any immediate safety note in under twenty seconds; do not read labels or the full recipe. After a recipe navigation tool succeeds, briefly narrate the newly displayed step once.

When evaluating food images, describe only what is visually observable. Never infer a safe internal meat temperature, doneness, tenderness, or food safety from appearance alone. Ask for an internal-temperature reading whenever a safe answer requires one. For chicken, require a thermometer reading from the thickest part of the thigh without touching bone before confirming doneness. Clearly warn about immediate hazards involving raw meat, hot oil, steam, sharp knives, and alcohol near open flames. Never recommend pouring alcohol directly from a bottle into a hot pan.

When the cook asks about an alcoholic deglazing substitute, answer the substitution briefly, then instruct them to measure it separately, move the pan off direct heat, and never pour from the bottle.

Allow natural interruptions and immediately respond to the user's newest request. Messages beginning "[Recipe state update." are control metadata: incorporate the new state silently and emit no audio.`;

export function formatRecipeContext(context: RecipeContext) {
  const completed = context.completedSteps.length
    ? context.completedSteps.join(", ")
    : "none";
  const timers = context.activeTimers.length
    ? context.activeTimers
        .map((timer) => `${timer.label}: ${timer.remainingSeconds}s`)
        .join("; ")
    : "none";
  const safetyNotes = context.relevantSafetyNotes?.length
    ? context.relevantSafetyNotes.join("; ")
    : context.currentSafety ?? "none";
  const suggestedTimers = context.suggestedTimers?.length
    ? context.suggestedTimers
        .map(
          (timer) =>
            `${timer.label}: ${timer.durationSeconds}s${
              timer.cue ? ` (${timer.cue})` : ""
            }`
        )
        .join("; ")
    : "none";
  const checkpoint = context.visualCheckpoint
    ? `${context.visualCheckpoint.question}${
        context.visualCheckpoint.requiresMeasurement
          ? " (requires a measurement; appearance alone is insufficient)"
          : ""
      }`
    : "none";
  const recipeSteps = context.recipeSteps
    .map(
      (step) =>
        `${step.stepNumber}. ${step.title ? `${step.title}: ` : ""}${step.instruction} ` +
        `Detail: ${step.detail}${step.safety ? ` Safety: ${step.safety}` : ""}`
    )
    .join("\n");

  return `CURRENT RECIPE CONTEXT
Product: Mise
Recipe id: ${context.recipeId ?? "unknown"}
Recipe: ${context.recipeTitle}
Description: ${context.recipeDescription ?? "not supplied"}
Primary technique: ${context.recipeTechnique ?? "not supplied"}
Full ordered recipe steps:
${recipeSteps}
Current step: ${context.currentStep} of ${context.totalSteps}
Current instruction: ${context.currentInstruction}
Practical detail: ${context.currentDetail}
Relevant safety notes: ${safetyNotes}
Suggested timers for this step: ${suggestedTimers}
Visual checkpoint for this step: ${checkpoint}
Completed steps: ${completed}
Active timers: ${timers}`;
}
