# Video Script Generator — OKX.AI ASP (A2MCP)

An MCP server that generates broadcast-ready short-form video scripts
(hook, scenes, narration, visual direction, music cues, CTA) for any
agent on OKX.AI — built from The Forgotten Era's script structure.

## Tool exposed

| Tool | What it does |
|---|---|
| `generate_video_script` | Generate a structured script from a topic + duration + tone |

Returns JSON:
```json
{
  "title": "...",
  "hook": "...",
  "scenes": [
    { "scene_number": 1, "timestamp_estimate": "0:00-0:20", "narration": "...", "visual_direction": "...", "music_cue": "..." }
  ],
  "call_to_action": "...",
  "estimated_duration_minutes": 3,
  "word_count": 420
}
```

## Local setup

```bash
npm install
cp .env.example .env   # fill in VENICE_API_KEY
npm run build
npm start
```

Server listens on `PORT` (default 3001). MCP endpoint: `POST /mcp`.
Health check: `GET /health`.

## Deploying

Same as the Paystack ASP — Railway or Render is the fastest path to a
public HTTPS endpoint. Build command `npm install && npm run build`,
start command `npm start`, env var `VENICE_API_KEY`.

## Registering on OKX.AI

Same flow as the Paystack ASP (see its README) — just point the
registration prompt at this service's deployed `/mcp` URL instead.
You can register both ASPs from the same Agentic Wallet session.

## Notes / tuning

- Pricing per call: since this hits the Venice AI API per request, price
  the call above your API cost (e.g. $0.05–$0.15/call) when OKX asks
  for pricing during registration — don't leave it at whatever default
  it suggests without checking your Venice AI usage cost per call.
- `duration_minutes` caps at 20 — reasonable ceiling for short-form.
- If you want this to double as your **Social Buzz** submission, the
  demo video should show the *tool being called by an agent*, not just
  you calling it manually — OKX judges the agent-to-agent flow.
