# Ableton AI Producer - Project Instructions

## Architecture

Max for Live audio_effect device with four communication layers:

1. **Backend Server** (`server/`) — Express on localhost:9320, Vercel AI SDK for multi-provider streaming (Anthropic + OpenAI). Handles chat, tool definitions, conversation history, settings, library search.

2. **Node.js Bridge** (`node/index.js`) — Thin bridge running in node.script (Node 16). Spawns the backend server (Node 18+), connects to its SSE action stream, relays LiveAPI results and session/audio data.

3. **Max JS** (`patchers/*.js`) — Runs in Max's SpiderMonkey context (ES5 only) with LiveAPI access. Reads session state, executes actions, indexes library, analyzes audio.

4. **Chat UI** (`ui/`) — HTML/CSS/JS running in jweb (embedded Chromium). Communicates directly with backend server via HTTP/SSE for chat, settings, library search, cost estimates.

Data flow:
- Chat: jweb → HTTP POST → server → SSE stream → jweb
- Actions: server → SSE action-stream → node.script → Max → action-executor.js → result → node.script → POST → server
- Session state: Max → session-reader.js → node.script → POST → server
- Audio: MSP → audio-analyzer.js → node.script → POST → server

## Key Constraints

- LiveAPI is ONLY accessible from Max's `js` objects (ES5 SpiderMonkey), NOT from node.script or server
- node.script runs Max's bundled Node.js (v16.x) — spawns server process for Node 18+
- node.script cannot use native npm modules (C++ addons) — pure JS only
- ES5 only in patchers/*.js: no const, let, arrow functions, template literals, destructuring
- Max `prepend` + `js` gotcha: prepend changes messagename, not content
- The .amxd is the device file — it IS the Max for Live device, tracked in git

## Dev Workflow

- Server dependencies: `cd server && npm install`
- Node bridge dependencies: `cd node && npm install`
- Test server standalone: `cd server && node index.js` (health check on :9320)
- Device file (`device/AbletonAI.amxd`) is JSON — can be edited as text
- To load in Ableton: drag .amxd onto any audio track

## File Structure

```
device/         — Max for Live device
  AbletonAI.amxd — The M4L audio_effect device (JSON format)
server/         — Backend server (Node 18+, runs as child process)
  index.js      — Express server on port 9320
  ai-provider.js — Vercel AI SDK multi-provider abstraction
  conversation.js — Message history + system prompt builder
  tools.js      — 28 tool definitions in AI SDK format
  library.js    — Sound library search
  persistence.js — Settings persistence
node/           — Thin bridge (runs in node.script, Node 16)
  index.js      — Spawns server, SSE relay, session/audio forwarding
ui/             — Chat UI (runs in jweb)
  index.html    — Main interface with Chat/Analyze/Browse tabs
  styles.css    — Dark theme, Ableton aesthetic
  app.js        — HTTP/SSE to server, all tab logic
patchers/       — Max JavaScript (ES5, runs in js object, has LiveAPI)
  session-reader.js — Reads Ableton session state via LOM
  action-executor.js — Executes Claude's tool-use actions in Ableton
  library-indexer.js — Scans Ableton browser tree
  audio-analyzer.js — MSP pitch/key detection + LUFS metering
```
