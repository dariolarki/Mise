import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { ImageCheckpoint } from "./components/ImageCheckpoint";
import { KitchenScreen } from "./components/KitchenScreen";
import { RecipeLibraryScreen } from "./components/RecipeLibraryScreen";
import { RecipeOverviewScreen } from "./components/RecipeOverviewScreen";
import {
  featuredRecipe,
  getRecipeById,
  getRecipeStep,
  getSuggestedTimers,
  getVisualCheckpoint,
  type Recipe,
  type SuggestedTimer
} from "./data/recipe";
import { useTimers } from "./hooks/useTimers";
import { createGeminiProvider, createMockProvider } from "./providers/createProvider";
import { analyzeImageWithGemini } from "./providers/imageAnalysis";
import { buildRecipeContext } from "./providers/recipeContext";
import { STEP_NARRATION_REQUEST } from "./providers/systemInstruction";
import {
  GeminiUnavailableError,
  type ImageAssessment,
  type ProviderMode,
  type RecipeContext,
  type ToolCall,
  type VoiceProvider,
  type VoiceProviderEvents,
  type VoiceStatus
} from "./providers/types";

type Screen = "library" | "overview" | "kitchen";

const demoMode = new URLSearchParams(window.location.search).get("demo");
const isTestKitchenDemo = import.meta.env.DEV && demoMode === "true";
const isCrustDemo = import.meta.env.DEV && demoMode === "crust";

function safeClientError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : fallback;
  return raw
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-api-key]")
    .replace(/([?&](?:key|access_token)=)[^&\s]+/gi, "$1[redacted-token]")
    .replace(
      /\b(?:auth_tokens|authTokens)\/[^\s"'&]+/gi,
      "[redacted-token]"
    )
    .slice(0, 500);
}

function logClientError(event: string, error: unknown) {
  console.error(`[Mise] ${event}`, {
    name: error instanceof Error ? error.name : "UnknownError",
    message: safeClientError(error, "No safe error detail was available.")
  });
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(
    isTestKitchenDemo || isCrustDemo ? "overview" : "library"
  );
  const [selectedRecipeId, setSelectedRecipeId] = useState(featuredRecipe.id);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [status, setStatus] = useState<VoiceStatus>("disconnected");
  const [mode, setMode] = useState<ProviderMode>("gemini-live");
  const [muted, setMuted] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState("");
  const [lastAssistantText, setLastAssistantText] = useState("");
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const {
    timers,
    startTimer,
    toggleTimer,
    removeTimer,
    clearTimers
  } = useTimers();

  const selectedRecipe =
    getRecipeById(selectedRecipeId) ?? featuredRecipe;
  const providerRef = useRef<VoiceProvider | undefined>(undefined);
  const selectedRecipeRef = useRef<Recipe>(selectedRecipe);
  const lastAssistantRef = useRef(lastAssistantText);
  const stepRef = useRef(currentStep);
  const completedRef = useRef(completedSteps);
  const timersRef = useRef(timers);
  const toolUndoRef = useRef(new Map<string, () => void>());
  const toolExecutorRef = useRef<
    ((call: ToolCall) => Promise<Record<string, unknown>>) | undefined
  >(undefined);
  selectedRecipeRef.current = selectedRecipe;
  stepRef.current = currentStep;
  completedRef.current = completedSteps;
  timersRef.current = timers;
  lastAssistantRef.current = lastAssistantText;

  const buildContext = useCallback(
    (): RecipeContext =>
      buildRecipeContext({
        recipe: selectedRecipeRef.current,
        currentStep: stepRef.current,
        completedSteps: completedRef.current,
        activeTimers: timersRef.current.map((timer) => ({
          label: timer.label,
          remainingSeconds: timer.remainingSeconds
        }))
      }),
    []
  );

  const navigateToStep = useCallback(
    (stepNumber: number, markCurrentComplete = false) => {
      if (!Number.isFinite(stepNumber)) return;
      const totalSteps = selectedRecipeRef.current.steps.length;
      const target = Math.min(Math.max(Math.round(stepNumber), 1), totalSteps);
      if (markCurrentComplete && target > stepRef.current) {
        const nextCompleted = Array.from(
          new Set([...completedRef.current, stepRef.current])
        ).sort((a, b) => a - b);
        completedRef.current = nextCompleted;
        setCompletedSteps(nextCompleted);
      }
      stepRef.current = target;
      setCurrentStep(target);
    },
    []
  );

  const registerToolUndo = useCallback((callId: string, undo: () => void) => {
    toolUndoRef.current.set(callId, undo);
    window.setTimeout(() => {
      if (toolUndoRef.current.get(callId) === undo) {
        toolUndoRef.current.delete(callId);
      }
    }, 30_000);
  }, []);

  toolExecutorRef.current = async (call) => {
    switch (call.name) {
      case "start_timer": {
        const label = String(call.args.label ?? "Cooking timer");
        const durationSeconds = Number(call.args.durationSeconds);
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
          throw new Error("Timer duration must be a positive number of seconds.");
        }
        const timer = startTimer(label, durationSeconds);
        registerToolUndo(call.id, () => removeTimer(timer.id));
        const recipeContext: RecipeContext = {
          ...buildContext(),
          activeTimers: [
            { label: timer.label, remainingSeconds: timer.remainingSeconds },
            ...timersRef.current.map((activeTimer) => ({
              label: activeTimer.label,
              remainingSeconds: activeTimer.remainingSeconds
            }))
          ].slice(0, 4)
        };
        return {
          ok: true,
          timer: {
            id: timer.id,
            label: timer.label,
            durationSeconds: timer.durationSeconds
          },
          recipeContext
        };
      }
      case "advance_step": {
        const previousStep = stepRef.current;
        const previousCompleted = [...completedRef.current];
        const requestedStep = Number(call.args.stepNumber ?? stepRef.current + 1);
        if (!Number.isFinite(requestedStep) || !Number.isInteger(requestedStep)) {
          throw new Error("advance_step requires an integer stepNumber.");
        }
        const totalSteps = selectedRecipeRef.current.steps.length;
        const target = Math.min(Math.max(requestedStep, 1), totalSteps);
        navigateToStep(target, true);
        registerToolUndo(call.id, () => {
          if (stepRef.current !== target) return;
          completedRef.current = previousCompleted;
          setCompletedSteps(previousCompleted);
          navigateToStep(previousStep);
        });
        return { ok: true, currentStep: target, recipeContext: buildContext() };
      }
      case "set_current_step": {
        const previousStep = stepRef.current;
        const requestedStep = Number(call.args.stepNumber);
        if (!Number.isFinite(requestedStep) || !Number.isInteger(requestedStep)) {
          throw new Error("set_current_step requires an integer stepNumber.");
        }
        const totalSteps = selectedRecipeRef.current.steps.length;
        const target = Math.min(Math.max(requestedStep, 1), totalSteps);
        navigateToStep(target);
        registerToolUndo(call.id, () => {
          if (stepRef.current === target) navigateToStep(previousStep);
        });
        return { ok: true, currentStep: target, recipeContext: buildContext() };
      }
      case "repeat_step": {
        const previousAssistantText = lastAssistantRef.current;
        const instruction = getRecipeStep(
          selectedRecipeRef.current,
          stepRef.current
        ).instruction;
        lastAssistantRef.current = instruction;
        setLastAssistantText(instruction);
        registerToolUndo(call.id, () => {
          if (lastAssistantRef.current !== instruction) return;
          lastAssistantRef.current = previousAssistantText;
          setLastAssistantText(previousAssistantText);
        });
        return {
          ok: true,
          currentStep: stepRef.current,
          instruction,
          recipeContext: buildContext()
        };
      }
      default:
        throw new Error(`Unknown tool: ${String(call.name)}`);
    }
  };

  const events = useMemo<VoiceProviderEvents>(
    () => ({
      onStatusChange: (nextStatus) => {
        setStatus(nextStatus);
        if (nextStatus === "muted") setMuted(true);
        if (nextStatus === "listening") setMuted(false);
      },
      onUserTranscript: () => undefined,
      onAssistantTranscript: (text) => {
        lastAssistantRef.current = text;
        setLastAssistantText(text);
      },
      onToolCall: (call) =>
        toolExecutorRef.current?.(call) ?? Promise.resolve({ ok: false }),
      onToolCallCancellation: (ids) => {
        for (const id of [...ids].reverse()) {
          toolUndoRef.current.get(id)?.();
          toolUndoRef.current.delete(id);
        }
      },
      onError: (error) => {
        logClientError("voice-provider-error", error);
        setConnectionNotice(safeClientError(error, "Voice connection error."));
        setStatus("error");
      }
    }),
    []
  );

  const narrateCurrentStep = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) return;
    provider.updateRecipeContext(buildContext());
    try {
      await provider.sendText(STEP_NARRATION_REQUEST);
    } catch (error) {
      setConnectionNotice(
        error instanceof Error ? error.message : "Could not read this step aloud."
      );
    }
  }, [buildContext]);

  const navigateAndNarrate = useCallback(
    (stepNumber: number, markCurrentComplete = false) => {
      navigateToStep(stepNumber, markCurrentComplete);
      void narrateCurrentStep();
    },
    [navigateToStep, narrateCurrentStep]
  );

  const startCooking = useCallback(
    (recipeToStart: Recipe, initialStep = 1) => {
      const previousProvider = providerRef.current;
      providerRef.current = undefined;
      if (previousProvider) void previousProvider.disconnect().catch(() => undefined);

      const safeInitialStep = Math.min(
        Math.max(Math.round(initialStep), 1),
        recipeToStart.steps.length
      );
      selectedRecipeRef.current = recipeToStart;
      setSelectedRecipeId(recipeToStart.id);
      stepRef.current = safeInitialStep;
      completedRef.current = [];
      timersRef.current = [];
      setCurrentStep(safeInitialStep);
      setCompletedSteps([]);
      clearTimers();
      toolUndoRef.current.clear();
      setCheckpointOpen(false);
      setScreen("kitchen");
      setStatus("disconnected");
      setMode("gemini-live");
      setMuted(false);
      setConnectionNotice("");
      lastAssistantRef.current = "";
      setLastAssistantText("");
    },
    [clearTimers]
  );

  const connectGeminiVoice = useCallback(async () => {
    const previousProvider = providerRef.current;
    providerRef.current = undefined;
    if (previousProvider) await previousProvider.disconnect().catch(() => undefined);

    setStatus("connecting");
    setMode("gemini-live");
    setMuted(false);
    setConnectionNotice("");

    const geminiProvider = createGeminiProvider(events, buildContext());
    providerRef.current = geminiProvider;
    try {
      await geminiProvider.connect();
      setConnectionNotice("Gemini Live connected · native audio");
    } catch (error) {
      logClientError("gemini-live-connection-failed", error);
      await geminiProvider.disconnect().catch(() => undefined);
      providerRef.current = undefined;
      setStatus("error");
      const detail = safeClientError(error, "Retry or use Local Preview.");
      setConnectionNotice(
        error instanceof GeminiUnavailableError ||
          (error instanceof Error && error.name === "GeminiUnavailableError")
          ? detail
          : `Gemini Live unavailable · ${detail}`
      );
    }
  }, [buildContext, events]);

  const connectMockVoice = useCallback(async () => {
    const previousProvider = providerRef.current;
    providerRef.current = undefined;
    if (previousProvider) await previousProvider.disconnect().catch(() => undefined);

    setStatus("connecting");
    setMode("mock");
    setMuted(false);
    setConnectionNotice("Local Preview · responses are simulated");

    try {
      const mockProvider = createMockProvider(events, buildContext(), {
        allowMockImageFallback: !isTestKitchenDemo
      });
      providerRef.current = mockProvider;
      await mockProvider.connect();
    } catch (error) {
      logClientError("local-preview-connection-failed", error);
      providerRef.current = undefined;
      setStatus("error");
      setConnectionNotice(
        `Local Preview unavailable · ${safeClientError(
          error,
          "No safe error detail was available."
        )}`
      );
    }
  }, [buildContext, events]);

  const returnToLibrary = useCallback(() => {
    const provider = providerRef.current;
    providerRef.current = undefined;
    if (provider) void provider.disconnect().catch(() => undefined);
    toolUndoRef.current.clear();
    clearTimers();
    timersRef.current = [];
    completedRef.current = [];
    stepRef.current = 1;
    setCompletedSteps([]);
    setCurrentStep(1);
    setCheckpointOpen(false);
    setConnectionNotice("");
    setLastAssistantText("");
    lastAssistantRef.current = "";
    setMuted(false);
    setMode("gemini-live");
    setStatus("disconnected");
    setScreen("library");
  }, [clearTimers]);

  const selectRecipe = useCallback((recipeToSelect: Recipe) => {
    selectedRecipeRef.current = recipeToSelect;
    setSelectedRecipeId(recipeToSelect.id);
    stepRef.current = 1;
    completedRef.current = [];
    setCurrentStep(1);
    setCompletedSteps([]);
    setScreen("overview");
  }, []);

  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) return;
    provider.updateRecipeContext(buildContext());
    // Timer seconds deliberately do not trigger context messages every second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRecipeId, currentStep, completedSteps, timers.length, buildContext]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen, selectedRecipeId]);

  useEffect(
    () => () => {
      toolUndoRef.current.clear();
      void providerRef.current?.disconnect();
    },
    []
  );

  async function toggleMuted() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    try {
      await providerRef.current?.setMuted?.(nextMuted);
    } catch (error) {
      setConnectionNotice(
        error instanceof Error
          ? error.message
          : "Could not change microphone state."
      );
    }
  }

  async function sendText(text: string) {
    const provider = providerRef.current;
    if (!provider) {
      setConnectionNotice(
        "Connect Gemini Live or continue in Local Preview before asking Mise."
      );
      return;
    }
    try {
      await provider.sendText(text);
    } catch (error) {
      setConnectionNotice(
        error instanceof Error ? error.message : "Could not send that."
      );
    }
  }

  async function analyzeImage(
    file: File,
    question: string
  ): Promise<ImageAssessment> {
    const context = buildContext();
    const provider = providerRef.current;
    if (!provider) return analyzeImageWithGemini(file, question, context);
    provider.updateRecipeContext(context);
    return provider.sendImage(file, question);
  }

  function startSuggestedTimer(timer: SuggestedTimer) {
    startTimer(timer.label, timer.durationSeconds);
  }

  if (screen === "library") {
    return (
      <RecipeLibraryScreen
        onSelect={selectRecipe}
        onStart={(recipeToStart) =>
          startCooking(
            recipeToStart,
            isCrustDemo && recipeToStart.id === featuredRecipe.id ? 4 : 1
          )
        }
      />
    );
  }

  if (screen === "overview") {
    return (
      <RecipeOverviewScreen
        recipe={selectedRecipe}
        onBack={() => setScreen("library")}
        onStart={() =>
          startCooking(
            selectedRecipe,
            isCrustDemo && selectedRecipe.id === featuredRecipe.id ? 4 : 1
          )
        }
      />
    );
  }

  const checkpoint = getVisualCheckpoint(selectedRecipe, currentStep);
  const suggestedTimers = getSuggestedTimers(selectedRecipe, currentStep).filter(
    (suggestion) =>
      !timers.some(
        (timer) =>
          timer.label.toLocaleLowerCase() ===
          suggestion.label.toLocaleLowerCase()
      )
  );

  return (
    <>
      <KitchenScreen
        recipe={selectedRecipe}
        currentStep={currentStep}
        status={status}
        mode={mode}
        muted={muted}
        timers={timers}
        lastAssistantText={lastAssistantText}
        connectionNotice={connectionNotice}
        suggestedTimers={suggestedTimers}
        onReturnToLibrary={returnToLibrary}
        onPrevious={() => navigateAndNarrate(currentStep - 1)}
        onNext={() => navigateAndNarrate(currentStep + 1, true)}
        onReadStep={() => void narrateCurrentStep()}
        onConnectVoice={() => void connectGeminiVoice()}
        onUseMock={() => void connectMockVoice()}
        onToggleMuted={() => void toggleMuted()}
        onOpenCamera={() => setCheckpointOpen(true)}
        onSendText={sendText}
        onStartSuggestedTimer={startSuggestedTimer}
        onToggleTimer={toggleTimer}
        onRemoveTimer={removeTimer}
      />
      <ImageCheckpoint
        open={checkpointOpen}
        defaultQuestion={
          checkpoint?.question ?? "Does this look right for the current step?"
        }
        uploadPrompt={
          checkpoint?.question ?? `Photograph step ${currentStep}`
        }
        showTestKitchenImages={
          isTestKitchenDemo && selectedRecipe.id === featuredRecipe.id
        }
        onClose={() => setCheckpointOpen(false)}
        onAnalyze={analyzeImage}
      />
      <Analytics />
    </>
  );
}
