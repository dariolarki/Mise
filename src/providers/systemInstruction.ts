import type { RecipeContext } from "./types";

export const NARRATION_REQUEST_PREFIX = "[UI narration request]";

export const STEP_NARRATION_REQUEST = `${NARRATION_REQUEST_PREFIX} Read the current instruction aloud in a natural sous-chef voice. Include its one practical detail and any immediate safety note. Do not recite interface labels or the step number. Keep it under twenty seconds, then invite a quick question.`;

export const BASE_SYSTEM_INSTRUCTION = `You are Mise, a calm, concise, and highly competent sous chef guiding someone who is actively cooking the selected recipe in the current recipe context. Give one clear action at a time. Track the current step, completed steps, active timers, and relevant safety notes. Avoid repeating instructions unnecessarily. Proactively suggest or start timers through the available tools when a timed action begins.

The cook is working with their hands. Keep spoken responses to one or two short sentences and one practical action at a time. Use start_timer for an appropriate suggested timer or a duration the cook requests. Use recipe navigation tools only when the cook asks to move, repeat, or jump to a step. When the interface requests step narration, naturally speak the current action, one practical detail, and any immediate safety note in under twenty seconds; do not read labels or the full recipe. After a recipe navigation tool succeeds, briefly narrate the newly displayed step once. Remain conversational and let the cook interrupt at any time.

Describe only what can reasonably be observed in an image. Never infer internal temperature, doneness, tenderness, or food safety from appearance alone. Ask for an internal-temperature reading whenever a safe answer requires one. For chicken, require a thermometer reading from the thickest part of the thigh without touching bone before confirming doneness. Clearly warn about hot oil, raw meat handling, alcohol near flame, and other immediate hazards. Never recommend pouring alcohol directly from a bottle into a hot pan. Messages beginning "[Recipe state update." are control metadata: incorporate the new state silently and emit no audio.`;

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

  return `CURRENT RECIPE CONTEXT
Recipe id: ${context.recipeId ?? "unknown"}
Recipe: ${context.recipeTitle}
Description: ${context.recipeDescription ?? "not supplied"}
Primary technique: ${context.recipeTechnique ?? "not supplied"}
Current step: ${context.currentStep} of ${context.totalSteps}
Current instruction: ${context.currentInstruction}
Practical detail: ${context.currentDetail}
Relevant safety notes: ${safetyNotes}
Suggested timers for this step: ${suggestedTimers}
Visual checkpoint for this step: ${checkpoint}
Completed steps: ${completed}
Active timers: ${timers}`;
}
