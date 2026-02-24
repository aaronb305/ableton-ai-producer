# Ableton AI Producer

A Max for Live audio effect that puts an AI production assistant inside Ableton Live. Chat about your session, get mixing advice, browse sounds, and let the AI take actions — all without leaving your DAW.

## Features

- **Multi-Provider AI** — Anthropic Claude, OpenAI GPT, or local models via Ollama. Switch providers on the fly.
- **28 Ableton Actions** — Create tracks, load instruments/effects, write MIDI, control transport, adjust mixer — all via natural language.
- **Session Analysis** — AI reads your tracks, devices, clips, and parameters. Audio analysis detects key and LUFS in real time.
- **Sound Library** — Search Ableton's built-in instruments/effects plus user packs and presets from the Browse tab.
- **Streaming Chat** — See responses as they generate, with markdown rendering and inline action history.
- **Tiered Context** — Smart session serialization (minimal/standard/detailed/full) keeps token costs under control.
- **Safety Gates** — Destructive actions (delete track, delete clip, etc.) require explicit confirmation.
- **Cost Estimates** — See estimated token count and cost before sending each message.
- **Settings Persistence** — API keys, model, provider, and context depth survive restarts.

## Architecture

```
jweb (Chat UI) ── HTTP/SSE ──> Backend Server (Express, port 9320)
                                    |
                                    v
                              AI Provider (Vercel AI SDK)
                              Claude / GPT / Ollama
                                    |
                             SSE action-stream
                                    |
                                    v
                           node.script (thin bridge)
                                    |
                                    v
                          Max js objects (LiveAPI)
                          session-reader, action-executor,
                          library-indexer, audio-analyzer
```

- **Backend server** (`server/`) — Express on localhost:9320. Vercel AI SDK for multi-provider streaming. Handles chat, tool cycling, settings, library search, cost estimates.
- **Node bridge** (`node/index.js`) — Thin bridge in node.script (Node 16). Spawns the backend server, connects to its SSE action stream, relays LiveAPI results and session/audio data.
- **Chat UI** (`ui/`) — HTML/CSS/JS served by the backend server, loaded in jweb. Three tabs: Chat, Analyze, Browse.
- **Max JS** (`patchers/`) — ES5 JavaScript with LiveAPI access. Reads session state, executes actions, indexes library, analyzes audio.

## Setup

### Prerequisites

- Ableton Live 11+ with Max for Live
- Node.js 18+ installed on your system (the backend server requires it)
- An API key from one of:
  - [Anthropic](https://console.anthropic.com) (Claude)
  - [OpenAI](https://platform.openai.com) (GPT)
  - Or [Ollama](https://ollama.com) running locally (free, no key needed)

### Install

```bash
git clone https://github.com/your-username/ableton-ai.git
cd ableton-ai

# Install backend server dependencies
cd server && npm install && cd ..
```

That's it. The node bridge (`node/`) has no external dependencies — it uses Max's bundled Node.js.

### Load the Device

1. In Ableton Live, drag `device/AbletonAI.amxd` onto any audio track
2. Wait a few seconds for the server to start (the chat UI will appear automatically)
3. Click the gear icon and enter your API key (or select Ollama for local models)
4. Start chatting

### Using Ollama (Local Models)

If you want to run models locally with no API key:

```bash
# Install Ollama from https://ollama.com
# Pull a model:
ollama pull qwen2.5-coder:7b

# Select "Ollama (Local)" as provider in the device settings
```

Available model presets: Qwen 2.5 Coder 7B, Llama 3.1 8B, Mistral 7B, DeepSeek R1 8B, Gemma 3 12B. You can use any model you've pulled — just type the model name.

## Development

### Server

```bash
cd server
npm start          # Start server standalone (port 9320)
npm run dev        # Start with --watch for auto-reload
```

Health check: `curl http://localhost:9320/api/health`

### Editing the Device

The `.amxd` file is a binary format (not plain JSON). To edit the Max patch:

```bash
# Extract JSON from .amxd
python3 scripts/unwrap-amxd.py device/AbletonAI.amxd device/patch.json

# Edit device/patch.json ...

# Re-wrap into .amxd
python3 scripts/wrap-amxd.py device/patch.json device/AbletonAI.amxd
```

Or open the `.amxd` directly in Max for visual patching.

### Other Components

- **Chat UI** (`ui/`): Edit files, then refresh jweb or reload the device
- **LiveAPI scripts** (`patchers/`): ES5 only. Edit files, re-instantiate the js object
- **Node bridge** (`node/index.js`): Auto-reloads via `@watch 1` in node.script

## File Structure

```
device/
  AbletonAI.amxd          — Max for Live audio effect (binary TLV format)
server/
  index.js                — Express server, SSE endpoints, tool cycling
  ai-provider.js          — Vercel AI SDK multi-provider abstraction
  conversation.js         — Message history + system prompt builder
  tools.js                — 28 tool definitions with Zod schemas
  library.js              — Sound library search engine
  persistence.js          — Settings save/restore
node/
  index.js                — Thin bridge: spawns server, relays actions
ui/
  index.html              — Chat/Analyze/Browse tabs
  styles.css              — Ableton dark theme
  app.js                  — HTTP/SSE client, markdown renderer
patchers/
  session-reader.js       — Reads Ableton session via LiveAPI (4 depth tiers)
  action-executor.js      — Executes AI tool-use actions in Ableton
  library-indexer.js      — Scans Ableton browser tree
  audio-analyzer.js       — Key detection + LUFS metering from MSP
scripts/
  wrap-amxd.py            — Convert JSON patcher → binary .amxd
  unwrap-amxd.py          — Extract JSON from binary .amxd
```

## Status

Core features implemented. Early testing in Ableton Live.

- Chat with streaming and multi-step tool-use cycling
- Multi-provider support (Anthropic, OpenAI, Ollama)
- Session state reading (4 depth tiers)
- 28 action tools (tracks, devices, clips, transport, sends, mixer)
- Sound library search (built-in DB + browser indexer)
- Audio analysis (key detection via sigmund~, LUFS via loudness~)
- Browse tab with library search and one-click loading
- Analyze tab for session overview
- Pre-send cost estimates
- Action history inline in chat
- Retry with exponential backoff
- Destructive action confirmation gate
- Settings persistence across restarts
