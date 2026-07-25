import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRecipeById, type Recipe } from "../data/recipe";
import { buildRecipeContext } from "./recipeContext";
import { STEP_NARRATION_REQUEST } from "./systemInstruction";
import { MockVoiceProvider } from "./MockVoiceProvider";
import type {
  RecipeContext,
  ToolCall,
  VoiceProviderEvents,
  VoiceStatus
} from "./types";

function requireRecipe(id: string): Recipe {
  const recipe = getRecipeById(id);
  if (!recipe) throw new Error(`Missing test recipe: ${id}`);
  return recipe;
}

function contextFor(recipeId: string, currentStep: number): RecipeContext {
  return buildRecipeContext({
    recipe: requireRecipe(recipeId),
    currentStep,
    completedSteps: [],
    activeTimers: []
  });
}

function createHarness(initialContext: RecipeContext) {
  const statuses: VoiceStatus[] = [];
  const transcripts: string[] = [];
  const calls: ToolCall[] = [];
  let toolResult: Record<string, unknown> = { ok: true };

  const events: VoiceProviderEvents = {
    onStatusChange: (status) => statuses.push(status),
    onUserTranscript: () => undefined,
    onAssistantTranscript: (text) => transcripts.push(text),
    onToolCall: async (call) => {
      calls.push(call);
      return toolResult;
    },
    onError: (error) => {
      throw error;
    }
  };
  const provider = new MockVoiceProvider(events, initialContext);

  return {
    provider,
    statuses,
    transcripts,
    calls,
    setToolResult(result: Record<string, unknown>) {
      toolResult = result;
    }
  };
}

async function finishTimedOperation(operation: Promise<unknown>) {
  await vi.runAllTimersAsync();
  await operation;
}

describe("MockVoiceProvider recipe behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("narrates the selected recipe step and its safety notes", async () => {
    const harness = createHarness(contextFor("pasta-carbonara", 7));
    await finishTimedOperation(harness.provider.connect());
    await finishTimedOperation(harness.provider.sendText(STEP_NARRATION_REQUEST));

    expect(harness.transcripts.at(-1)).toMatch(/add the egg and cheese mixture/i);
    expect(harness.transcripts.at(-1)).toMatch(/off direct heat/i);
    expect(harness.transcripts.at(-1)).not.toMatch(/steak|crust|cognac/i);
    expect(harness.statuses).toEqual(
      expect.arrayContaining(["connecting", "listening", "thinking"])
    );
  });

  it("uses the selected recipe boundary and authoritative tool context", async () => {
    const stepEight = contextFor("french-omelette", 8);
    const stepNine = contextFor("french-omelette", 9);
    const harness = createHarness(stepEight);
    harness.setToolResult({ ok: true, recipeContext: stepNine });

    await finishTimedOperation(harness.provider.connect());
    await finishTimedOperation(harness.provider.sendText("Next"));

    expect(harness.calls.at(-1)).toMatchObject({
      name: "advance_step",
      args: { stepNumber: 9 }
    });
    expect(harness.transcripts.at(-1)).toContain(stepNine.currentInstruction);

    harness.setToolResult({ ok: true, recipeContext: stepNine });
    await finishTimedOperation(harness.provider.sendText("Next"));
    expect(harness.calls.at(-1)).toMatchObject({
      name: "advance_step",
      args: { stepNumber: 9 }
    });
  });

  it("starts the current recipe's suggested timer when no duration is spoken", async () => {
    const context = contextFor("red-wine-braised-short-ribs", 8);
    const harness = createHarness(context);
    await finishTimedOperation(harness.provider.connect());
    await finishTimedOperation(harness.provider.sendText("Start the timer"));

    expect(harness.calls.at(-1)).toMatchObject({
      name: "start_timer",
      args: {
        label: "First tenderness check",
        durationSeconds: 9_000
      }
    });
    expect(harness.transcripts.at(-1)).toBe("Timer started for 150 minutes.");
  });

  it("requires a thermometer reading for a visual chicken-doneness question", async () => {
    const harness = createHarness(contextFor("roast-chicken", 7));
    await finishTimedOperation(harness.provider.connect());
    await finishTimedOperation(harness.provider.sendText("Does it look done?"));

    expect(harness.calls).toHaveLength(0);
    expect(harness.transcripts.at(-1)).toMatch(/appearance alone cannot confirm/i);
    expect(harness.transcripts.at(-1)).toMatch(/internal temperature.*thermometer/i);
    expect(harness.transcripts.at(-1)).not.toMatch(/\bit is (done|safe|ready)\b/i);
  });

  it("answers a recipe checkpoint question with its immediate action", async () => {
    const harness = createHarness(contextFor("pasta-carbonara", 8));
    await finishTimedOperation(harness.provider.connect());
    await finishTimedOperation(
      harness.provider.sendText("Why is my sauce clumping?")
    );

    expect(harness.calls).toHaveLength(0);
    expect(harness.transcripts.at(-1)).toMatch(/excess heat|too little pasta water/i);
    expect(harness.transcripts.at(-1)).toMatch(/off heat.*splash of pasta water/i);
  });
});
