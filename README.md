# Ableton AI Producer

A Max for Live device that embeds Claude as an AI-powered production assistant inside Ableton Live. Chat with Claude about your session, get production advice, and execute actions — all without leaving your DAW.

## Features

- **Chat Assistant** — In-device AI chat with full session context. Claude can read your tracks, devices, clips, and parameters, give production advice, and take action.
- **28 Ableton Actions** — Create tracks, load instruments/effects, write MIDI notes, control transport, adjust mixer settings — all via natural language.
- **Sound Library Search** — Built-in database of Ableton's instruments and effects + runtime browser indexer for user packs/presets.
- **Tiered Context** — Smart session serialization (minimal → full) keeps token costs under control on large sessions.
- **Streaming Responses** — See Claude's response as it's generated, with markdown rendering.
- **Destructive Action Safety** — Tools that delete tracks, clips, or devices require explicit user confirmation before execution.
- **Auto-retry** — API calls retry up to 3 times with exponential backoff on transient failures.
- **Settings Persistence** — API key, model, and context depth survive restarts.
- **BYOK** — Bring your own Claude API key. No subscription, no middleman.

## Architecture

Three communication layers wired through a Max patch:

```
User Input (jweb) → Max patch → node.script (Claude API) → Max patch → jweb (display)
                                                          → js object (Ableton actions)
```

- **node.script** (`node/`) — Node.js process handling Claude API calls, conversation history, and tool-use cycling
- **jweb** (`ui/`) — Embedded Chromium browser with chat UI, dark theme matching Ableton's aesthetic
- **js objects** (`patchers/`) — Max JavaScript with LiveAPI access for reading session state and executing actions

## Setup

### Prerequisites
- Ableton Live 11+ with Max for Live
- Claude API key from [console.anthropic.com](https://console.anthropic.com)

### Install

1. Clone this repo
2. Install Node dependencies:
   ```
   cd node && npm install
   ```
3. Open `device/AbletonAI.maxpat` in Max, or drag it onto a track in Ableton Live
4. Enter your Claude API key in the settings panel (gear icon)

### Development

- Node backend: edit files in `node/`, auto-reloads via `@watch 1`
- Chat UI: edit files in `ui/`, refresh jweb to see changes
- LiveAPI scripts: edit files in `patchers/`, re-instantiate js object to reload
- Max patch: `device/AbletonAI.maxpat` is JSON — editable as text

## File Structure

```
node/
  index.js          — Entry point, max-api bridge, conversation loop
  claude-api.js     — Claude API client with streaming + retry
  tools.js          — 28 tool definitions for Claude
  library.js        — Sound library: built-in DB + search engine
  persistence.js    — Settings save/restore to disk
ui/
  index.html        — Chat interface
  styles.css        — Ableton dark theme
  app.js            — Chat logic, markdown renderer, Max bridge
patchers/
  session-reader.js    — Reads Ableton session state via LiveAPI (4 depth tiers)
  action-executor.js   — Executes Claude's tool-use actions in Ableton
  library-indexer.js   — Scans Ableton's browser tree for presets/samples
device/
  AbletonAI.maxpat  — Max patch wiring all components together
```

## Status

**MVP complete.** All core features implemented and contract-verified. Not yet tested in Ableton Live.

Implemented:
- Chat + streaming + tool-use cycling
- Session state reading (4 depth tiers)
- 28 action tools (tracks, devices, clips, transport, sends)
- Sound library search (built-in DB + browser indexer)
- Retry with exponential backoff
- Settings persistence
- Destructive action confirmation gate

Planned:
- Audio analysis (key detection, spectral analysis on master bus)
- Conversation history persistence across sessions
