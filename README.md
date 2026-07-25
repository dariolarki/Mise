# Mise

Mise is a mobile-first visual AI sous chef with a five-recipe editorial
library. **Steak au Poivre** remains the featured, most polished hackathon demo;
Red-Wine Braised Short Ribs, French Omelette, Roast Chicken, and Pasta
Carbonara share the same guided-cooking system.

The production voice path uses the Google GenAI SDK and Gemini Live. A
server-side endpoint provisions a one-use ephemeral token, then the browser
connects directly to Gemini Live over its bidirectional WebSocket session. The
permanent API key never enters the browser bundle.

## Run locally

```bash
npm install
cp .env.example .env
# Add your server-side GEMINI_API_KEY to .env
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

Without `GEMINI_API_KEY`, Mise automatically uses `MockVoiceProvider`. The full
recipe library, timers, typed commands, navigation, and image-checkpoint UI
remain usable, and the interface clearly labels the session as a local preview.

Steak au Poivre retains its original instructional photographs in responsive
720 px and 1200 px variants. The additional recipes use restrained editorial
step markers within the same cooking composition. Mise reads the current
action, practical detail, and immediate safety note aloud when cooking begins,
when the cook navigates with the interface, or when “Read step aloud” is
pressed. The Live session then stays open for natural follow-up questions and
interruptions.

For the strongest demo checkpoint, open:

```text
http://127.0.0.1:5173/?demo=crust
```

This enters step 4 with a two-minute first-side timer.

## Architecture

- `VoiceProvider` keeps model interactions behind `connect`, `disconnect`,
  `sendText`, `sendImage`, and `updateRecipeContext`.
- `MockVoiceProvider` supports immediate local work and deterministic tool
  demonstrations.
- `GeminiLiveProvider` streams 16 kHz PCM microphone input and plays Gemini’s
  24 kHz native audio output. It clears queued audio when the cook interrupts,
  uses sliding-window context compression, and resumes the session when Google
  rotates the underlying WebSocket connection.
- `/api/gemini/token` creates a short-lived, one-use Live API token with the
  server-side `GEMINI_API_KEY`. The endpoint is same-origin protected and
  rate-limited.
- Client-side function calls create timers and move through recipe steps.
- Recipe context includes the selected recipe, technique, visible instruction,
  practical detail, relevant safety notes, suggested timers, visual checkpoint,
  completed steps, and active timers so spoken guidance stays aligned with the
  interface.
- `/api/gemini/analyze-image` uses `gemini-3.5-flash` for the reliable server
  fallback behind “Does this look right?”

The Live model is `gemini-3.1-flash-live-preview`, the current model documented
for low-latency native-audio Live API sessions.

## Public demo hardening

The included same-origin checks, one-use constrained tokens, strict request
limits, and in-memory per-IP throttles are appropriate for a bounded hackathon
demo. Before an unrestricted public launch, put the token endpoint behind your
real user/session proof, move rate limits to a shared store, and configure
Gemini quota and billing alerts. If the server is behind exactly one trusted
reverse proxy, set `TRUST_PROXY=1` so throttling uses the visitor IP.

## Verify

```bash
npm test
npm run build
npm audit
```
