import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Mic,
  MicOff,
  Send,
  Timer,
  Volume2
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { ActiveTimer } from "../hooks/useTimers";
import type { ProviderMode, VoiceStatus as VoiceStatusValue } from "../providers/types";
import {
  getRecipeStep,
  type Recipe,
  type SuggestedTimer
} from "../data/recipe";
import { TimerRail } from "./TimerRail";
import { VoiceStatus } from "./VoiceStatus";

interface KitchenScreenProps {
  recipe: Recipe;
  currentStep: number;
  status: VoiceStatusValue;
  mode: ProviderMode;
  muted: boolean;
  timers: ActiveTimer[];
  lastAssistantText: string;
  connectionNotice: string;
  suggestedTimers: SuggestedTimer[];
  onReturnToLibrary(): void;
  onPrevious(): void;
  onNext(): void;
  onReadStep(): void;
  onConnectVoice(): void;
  onUseMock(): void;
  onToggleMuted(): void;
  onOpenCamera(): void;
  onSendText(text: string): Promise<void>;
  onStartSuggestedTimer(timer: SuggestedTimer): void;
  onToggleTimer(id: string): void;
  onRemoveTimer(id: string): void;
}

function smallRecipeImage(source: string) {
  return source.replace("-1200.jpg", "-720.jpg");
}

function formatSuggestedTime(durationSeconds: number) {
  if (durationSeconds >= 3600) {
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.round((durationSeconds % 3600) / 60);
    return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }
  if (durationSeconds >= 60) return `${Math.round(durationSeconds / 60)} min`;
  return `${durationSeconds} sec`;
}

export function KitchenScreen({
  recipe,
  currentStep,
  status,
  mode,
  muted,
  timers,
  lastAssistantText,
  connectionNotice,
  suggestedTimers,
  onReturnToLibrary,
  onPrevious,
  onNext,
  onReadStep,
  onConnectVoice,
  onUseMock,
  onToggleMuted,
  onOpenCamera,
  onSendText,
  onStartSuggestedTimer,
  onToggleTimer,
  onRemoveTimer
}: KitchenScreenProps) {
  const [text, setText] = useState("");
  const totalSteps = recipe.steps.length;
  const step = getRecipeStep(recipe, currentStep);
  const progress = (currentStep / totalSteps) * 100;
  const hasVoiceError = String(status) === "error";
  const needsVoiceConnection = status === "disconnected" || hasVoiceError;
  const voiceControlLabel = needsVoiceConnection
    ? hasVoiceError
      ? "Retry Gemini"
      : "Connect Gemini"
    : status === "connecting"
      ? "Connecting"
      : muted
        ? "Unmute"
        : status === "speaking"
          ? "Speaking"
          : "Listening";

  useEffect(() => {
    const nextStepNumber = currentStep + 1;
    if (nextStepNumber > totalSteps) return;
    const nextStep = getRecipeStep(recipe, nextStepNumber);
    if (!nextStep.image) return;
    const image = new Image();
    image.src = smallRecipeImage(nextStep.image);
  }, [currentStep, recipe, totalSteps]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    setText("");
    await onSendText(message);
  }

  return (
    <main className="kitchen">
      <header className="kitchen__header">
        <div className="kitchen__identity">
          <button
            className="kitchen__brand"
            type="button"
            onClick={onReturnToLibrary}
            aria-label="Return to recipe library"
          >
            Mise
          </button>
          <button className="kitchen__library-return" type="button" onClick={onReturnToLibrary}>
            <ArrowLeft aria-hidden="true" />
            <span>Recipes</span>
          </button>
        </div>
        <VoiceStatus status={status} mode={mode} />
      </header>

      {connectionNotice && (
        <section
          className={`connection-notice ${hasVoiceError ? "connection-notice--error" : ""}`}
          role={hasVoiceError ? "alert" : "status"}
        >
          <p>{connectionNotice}</p>
          {hasVoiceError && mode === "gemini-live" && (
            <button type="button" onClick={onUseMock}>
              Continue in Local Preview
            </button>
          )}
        </section>
      )}

      <section className="recipe-folio" aria-label={`Step ${currentStep} of ${totalSteps}`}>
        <div className="recipe-folio__heading">
          <span>{recipe.title}</span>
          <div>
            <strong>{String(currentStep).padStart(2, "0")}</strong>
            <i>/</i>
            <span>{String(totalSteps).padStart(2, "0")}</span>
          </div>
        </div>
        <div className="recipe-folio__progress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section
        className={`instruction-stage ${step.image ? "" : "instruction-stage--text-only"}`}
        aria-labelledby={`step-title-${currentStep}`}
      >
        {step.image && step.imageAlt ? (
          <figure className="instruction-media" key={`image-${currentStep}`}>
            <img
              src={step.image}
              srcSet={`${smallRecipeImage(step.image)} 720w, ${step.image} 1200w`}
              sizes="(min-width: 1100px) 36vw, (min-width: 760px) 68vw, 100vw"
              alt={step.imageAlt}
              loading="eager"
              decoding="async"
            />
          </figure>
        ) : (
          <div className="instruction-marker" key={`marker-${currentStep}`} aria-hidden="true">
            <span>{String(currentStep).padStart(2, "0")}</span>
            <strong>{recipe.technique}</strong>
          </div>
        )}

        <button
          className="read-step"
          type="button"
          onClick={onReadStep}
          disabled={
            status === "disconnected" ||
            status === "connecting" ||
            hasVoiceError ||
            muted
          }
          aria-label={`Read step ${currentStep} aloud`}
        >
          <Volume2 aria-hidden="true" />
          <span>
            {muted
              ? "Unmute to hear"
              : status === "speaking"
                ? "Mise is speaking"
                : "Read step aloud"}
          </span>
          <i aria-hidden="true" />
        </button>

        <section className="instruction">
          <h1 id={`step-title-${currentStep}`} key={`title-${currentStep}`}>
            {step.instruction}
          </h1>
          <div className="instruction__detail">
            <i aria-hidden="true" />
            <p>{step.detail}</p>
          </div>
          {step.safety && <p className="instruction__safety">{step.safety}</p>}
        </section>
      </section>

      <aside className="kitchen-rail" aria-label="Cooking activity">
        {suggestedTimers.length > 0 && (
          <section className="suggested-timers" aria-label="Suggested timers">
            <span>Suggested now</span>
            {suggestedTimers.map((timer) => (
              <button
                type="button"
                key={`${timer.stepNumber}-${timer.label}`}
                onClick={() => onStartSuggestedTimer(timer)}
              >
                <Timer aria-hidden="true" />
                <strong>{timer.label}</strong>
                <small>{formatSuggestedTime(timer.durationSeconds)}</small>
              </button>
            ))}
          </section>
        )}
        <TimerRail timers={timers} onToggle={onToggleTimer} onRemove={onRemoveTimer} />

        {lastAssistantText && (
          <p className="mise-note" aria-live="polite">
            <span>Mise</span>
            {lastAssistantText}
          </p>
        )}
      </aside>

      <section className="kitchen-controls" aria-label="Voice and camera controls">
        <button
          className={`voice-control ${status === "listening" ? "is-active" : ""}`}
          type="button"
          onClick={needsVoiceConnection ? onConnectVoice : onToggleMuted}
          disabled={status === "connecting"}
          aria-label={
            needsVoiceConnection
              ? hasVoiceError
                ? "Retry Gemini Live"
                : "Connect Gemini Live"
              : muted
                ? "Unmute microphone"
                : "Mute microphone"
          }
        >
          {muted ? <MicOff /> : <Mic />}
          <span>{voiceControlLabel}</span>
        </button>

        <button className="camera-control" type="button" onClick={onOpenCamera}>
          <Camera />
          <span>Does this<br />look right?</span>
        </button>

        <button
          className="sound-control"
          type="button"
          onClick={onToggleMuted}
          disabled={needsVoiceConnection || status === "connecting"}
          aria-label={muted ? "Turn voice on" : "Mute voice"}
        >
          {muted ? <MicOff /> : <Volume2 />}
          <span>{needsVoiceConnection ? "Voice off" : muted ? "Muted" : "Voice on"}</span>
        </button>
      </section>

      <form className="text-fallback" onSubmit={submit}>
        <label htmlFor="mise-question">Ask Mise</label>
        <input
          id="mise-question"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ask a quick question…"
          autoComplete="off"
        />
        <button type="submit" aria-label="Send question" disabled={!text.trim()}>
          <Send />
        </button>
      </form>

      <nav className="step-navigation" aria-label="Recipe steps">
        <button type="button" onClick={onPrevious} disabled={currentStep === 1}>
          <ArrowLeft />
          <span>Previous</span>
        </button>
        <span>{step.title}</span>
        <button type="button" onClick={onNext} disabled={currentStep === totalSteps}>
          <span>Next</span>
          <ArrowRight />
        </button>
      </nav>
    </main>
  );
}
