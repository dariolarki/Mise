import { GeminiLiveProvider } from "./GeminiLiveProvider";
import { MockVoiceProvider } from "./MockVoiceProvider";
import type { RecipeContext, VoiceProviderEvents } from "./types";

export function createGeminiProvider(
  events: VoiceProviderEvents,
  context: RecipeContext
) {
  return new GeminiLiveProvider(events, context);
}

export function createMockProvider(
  events: VoiceProviderEvents,
  context: RecipeContext,
  options?: { allowMockImageFallback?: boolean }
) {
  return new MockVoiceProvider(
    events,
    context,
    options?.allowMockImageFallback ?? true
  );
}
