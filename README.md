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
# Add GEMINI_API_KEY to the existing server-only .env.local file.
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

Without `GEMINI_API_KEY`, Mise keeps the full recipe library, timers,
navigation, and image-checkpoint UI available, shows the Live connection error,
and offers an explicit `MockVoiceProvider` local preview for typed commands.

Steak au Poivre retains its original instructional photographs in responsive
720 px and 1200 px variants. The additional recipes use restrained editorial
step markers within the same cooking composition. Mise reads the current
action, practical detail, and immediate safety note aloud when cooking begins,
when the cook navigates with the interface, or when “Read step aloud” is
pressed. The Live session then stays open for natural follow-up questions and
interruptions.

For the strongest demo checkpoint, open:

```text
http://127.0.0.1:5173/?demo=true
```

This opens Steak au Poivre directly, exposes the Test Kitchen image selector
after cooking starts, and leaves every Gemini response and timer action real.

## Deploy to Vercel

Import the GitHub repository into Vercel and keep the detected Vite settings:

- Build command: `npm run build`
- Output directory: `dist`
- Node.js runtime: 24.x

Add `GEMINI_API_KEY` as a sensitive, server-only environment variable for the
Production and Preview environments, then redeploy. Never prefix the variable
with `VITE_`; that would expose it to the browser bundle.

Vercel serves the built interface from its CDN and routes `/api/*` through the
Express application as a Vercel Function. The browser still connects directly
to Gemini Live using the constrained one-use token returned by
`/api/gemini/token`.

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
  complete ordered step list, visible instruction, practical detail, relevant
  safety notes, suggested timers, visual checkpoint, completed steps, and
  active timers so spoken guidance stays aligned with the interface.
- `/api/gemini/analyze-image` uses `gemini-3.5-flash` for the reliable server
  request behind “Does this look right?” and returns a brief assessment, one
  next action, and an optional safety note.

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
