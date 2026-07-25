import { Pause, Play, X } from "lucide-react";
import { formatTime, type ActiveTimer } from "../hooks/useTimers";

interface TimerRailProps {
  timers: ActiveTimer[];
  onToggle(id: string): void;
  onRemove(id: string): void;
}

export function TimerRail({ timers, onToggle, onRemove }: TimerRailProps) {
  if (!timers.length) {
    return (
      <div className="timer-empty">
        <span>Timers</span>
        <p>Ask Mise to start one when the pan gets busy.</p>
      </div>
    );
  }

  return (
    <section className="timer-rail" aria-label="Active timers">
      {timers.map((timer) => {
        const progress =
          ((timer.durationSeconds - timer.remainingSeconds) / timer.durationSeconds) * 100;
        return (
          <article className="timer" key={timer.id}>
            <div className="timer__copy">
              <span>{timer.label}</span>
              <strong>{timer.remainingSeconds ? formatTime(timer.remainingSeconds) : "Ready"}</strong>
            </div>
            <div className="timer__track" aria-hidden="true">
              <i style={{ width: `${progress}%` }} />
            </div>
            <div className="timer__actions">
              <button
                type="button"
                onClick={() => onToggle(timer.id)}
                disabled={!timer.remainingSeconds}
                aria-label={timer.running ? `Pause ${timer.label}` : `Resume ${timer.label}`}
              >
                {timer.running ? <Pause /> : <Play />}
              </button>
              <button
                type="button"
                onClick={() => onRemove(timer.id)}
                aria-label={`Remove ${timer.label}`}
              >
                <X />
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
