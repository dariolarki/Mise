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
  const payload = (await response.json().catch(() => ({}))) as
    | ImageAssessment
    | { error?: string; code?: string };

  if (!response.ok || !("assessment" in payload)) {
    const message =
      ("error" in payload && payload.error) || "Gemini image analysis failed.";
    if ("code" in payload && payload.code === "GEMINI_NOT_CONFIGURED") {
      throw new GeminiUnavailableError(message);
    }
    throw new Error(message);
  }
  return payload;
}
