import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_TIMER_SECONDS } from "../constants";

export interface ActiveTimer {
  id: string;
  label: string;
  durationSeconds: number;
  remainingSeconds: number;
  running: boolean;
}

function playTimerChime() {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.8);
  gain.connect(context.destination);

  [0, 0.2].forEach((offset, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = index ? 880 : 660;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + 0.55);
  });
  window.setTimeout(() => void context.close(), 1200);
}

export function useTimers() {
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const completedIds = useRef(new Set<string>());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimers((current) =>
        current.map((timer) => {
          if (!timer.running) return timer;
          const remainingSeconds = Math.max(0, timer.remainingSeconds - 1);
          if (remainingSeconds === 0 && !completedIds.current.has(timer.id)) {
            completedIds.current.add(timer.id);
            playTimerChime();
          }
          return {
            ...timer,
            remainingSeconds,
            running: remainingSeconds > 0
          };
        })
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const startTimer = useCallback((label: string, durationSeconds: number) => {
    const safeDuration = Math.min(
      Math.max(Math.round(durationSeconds), 1),
      MAX_TIMER_SECONDS
    );
    const timer: ActiveTimer = {
      id: crypto.randomUUID(),
      label: label.trim().slice(0, 42) || "Cooking timer",
      durationSeconds: safeDuration,
      remainingSeconds: safeDuration,
      running: true
    };
    setTimers((current) => [timer, ...current].slice(0, 4));
    return timer;
  }, []);

  const toggleTimer = useCallback((id: string) => {
    setTimers((current) =>
      current.map((timer) =>
        timer.id === id && timer.remainingSeconds > 0
          ? { ...timer, running: !timer.running }
          : timer
      )
    );
  }, []);

  const removeTimer = useCallback((id: string) => {
    setTimers((current) => current.filter((timer) => timer.id !== id));
  }, []);

  const clearTimers = useCallback(() => {
    completedIds.current.clear();
    setTimers([]);
  }, []);

  return { timers, startTimer, toggleTimer, removeTimer, clearTimers };
}

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
