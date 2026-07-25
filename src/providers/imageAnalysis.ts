import { fileToOptimizedDataUrl } from "./audio";
import {
  GeminiUnavailableError,
  type ImageAssessment,
  type RecipeContext
} from "./types";

export async function analyzeImageWithGemini(
  image: File,
  question: string,
  recipeContext: RecipeContext
): Promise<ImageAssessment> {
  const imageDataUrl = await fileToOptimizedDataUrl(image);
  const response = await fetch("/api/gemini/analyze-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageDataUrl,
      question,
      recipeContext
    })
  });
  const payload = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok || !isImageAssessment(payload)) {
    const errorPayload =
      payload && typeof payload === "object"
        ? (payload as { error?: unknown; code?: unknown })
        : {};
    const message =
      typeof errorPayload.error === "string"
        ? errorPayload.error
        : "Gemini image analysis failed.";
    if (errorPayload.code === "GEMINI_NOT_CONFIGURED") {
      throw new GeminiUnavailableError(message);
    }
    throw new Error(message);
  }
  return payload;
}

function isImageAssessment(value: unknown): value is ImageAssessment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const assessment = value as Partial<ImageAssessment>;
  return (
    typeof assessment.assessment === "string" &&
    Boolean(assessment.assessment.trim()) &&
    typeof assessment.nextAction === "string" &&
    Boolean(assessment.nextAction.trim()) &&
    (assessment.safetyNote === null ||
      typeof assessment.safetyNote === "string")
  );
}
