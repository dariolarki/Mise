import type { ProviderMode, VoiceStatus as VoiceStatusValue } from "../providers/types";

const statusLabels: Record<VoiceStatusValue, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  muted: "Muted",
  error: "Connection error"
};

interface VoiceStatusProps {
  status: VoiceStatusValue;
  mode: ProviderMode | null;
}

export function VoiceStatus({ status, mode }: VoiceStatusProps) {
  return (
    <div className={`voice-status voice-status--${status}`} aria-live="polite">
      <div className="voice-status__identity">
        <span>{mode === "mock" ? "Local preview" : "Gemini Live"}</span>
        <strong>{statusLabels[status]}</strong>
      </div>
      <div className="voice-status__wave" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
    </div>
  );
}
