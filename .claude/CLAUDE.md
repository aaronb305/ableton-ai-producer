# Ableton AI Producer - Project Instructions

## Architecture

Max for Live device with three communication layers:

1. **Max JS** (`patchers/*.js`) — Runs in Max's JavaScript context with LiveAPI access. Reads/writes Ableton session state via Live Object Model (LOM). Communicates with Max patch via outlets.

2. **Node.js** (`node/`) — Runs in node.script (separate Node process). Handles Claude API calls, processes responses, manages conversation history. Communicates with Max via max-api module (`outlet()`, `addHandler()`).

3. **Chat UI** (`ui/`) — HTML/CSS/JS running in jweb (embedded Chromium). Displays messages, handles user input. Communicates with Max patch via window.max object.

Data flow: User input (jweb) → Max patch → node.script → Claude API → node.script → Max patch → jweb (display) + js object (execute Ableton actions)

## Key Constraints

- LiveAPI is ONLY accessible from Max's `js`/`v8` objects, NOT from node.script
- node.script runs Max's bundled Node.js (v16.x in Max 8) — use npm, NOT bun
- node.script cannot use native npm modules (C++ addons) — pure JS only
- jweb communicates with Max via `window.max.bindInlet()` / `window.max.outlet()`
- Max patch routes messages between all three contexts
- Token budget management is critical — serialize session state at appropriate depth

## Dev Workflow

- Node dependencies: `cd node && npm install`
- Testing Node code outside Max: `node node/test.js`
- Max patch (.maxpat) files are JSON — can be edited as text
- To load in Ableton: open .maxpat in Max, save as .amxd

## File Structure

```
node/           — Node.js backend (runs in node.script)
  index.js      — Entry point, max-api bridge
  claude-api.js — Claude API client with streaming
  tools.js      — Tool definitions for Claude
ui/             — Chat UI (runs in jweb)
  index.html    — Main chat interface
  styles.css    — Styling (dark theme, Ableton aesthetic)
  app.js        — Chat logic, max-api bridge
patchers/       — Max JavaScript (runs in js object, has LiveAPI)
  session-reader.js — Reads Ableton session state via LOM
  action-executor.js — Executes Claude's tool-use actions in Ableton
```
