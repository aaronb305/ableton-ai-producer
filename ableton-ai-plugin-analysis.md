# Ableton AI Production Assistant — Technical Analysis & Architecture Plan

## 1. Competitive Landscape Teardown

### Output Co-Producer — What It Does Well & Where It Falls Short

**How it works:** Sits on your master bus, captures 4-8 bars of audio, analyzes rhythm/harmony, then queries Output's cloud library for matching samples. Results are categorized by type, mood, and musical function. Drag-and-drop into DAW. $9.99/mo subscription.

**Strengths:**
- In-context auditioning (samples play synced to session key/tempo)
- 73% relevance rate on searches — genuinely useful
- Combines audio analysis + text prompts for refinement
- Drag-and-drop workflow stays in-DAW
- Recently added "Re-imagine" — AI-generated variations of samples

**Weaknesses & Opportunities:**
- **Locked to Output's library** — you're paying for their sample subscription, not using YOUR sounds or Ableton's built-in instruments
- **No awareness of Ableton's native instruments** — doesn't know about Operator, Analog, Wavetable, Drift, Drum Rack presets, etc.
- **No production advice** — finds samples but doesn't tell you *why* or *how* to use them
- **No genre/label targeting** — can't say "make this sound like Drumcode" or "fit this for Anjunadeep"
- **No chat/conversation** — it's a one-way search tool, not an assistant
- **Plugin, not Max for Live** — no deep Ableton integration (can't read your device chains, see your arrangements, etc.)

### AbletonGPT — What It Does Well & Where It Falls Short

**How it works:** Desktop app ($39 beta) that connects to Ableton via a bridge. Uses natural language to control Ableton: create tracks, add effects, generate MIDI (chords, melodies, bass lines). Coming soon: AI sound design for NI/Serum.

**Strengths:**
- Natural language control of Ableton (create tracks, effects, sends, automation)
- MIDI generation (chord progressions, counter-melodies, bass lines)
- Real-time updates — watch Ableton change as you type
- Clean, minimal interface

**Weaknesses & Opportunities:**
- **Uses GPT, not Claude** — you specifically want Claude's reasoning capabilities
- **No audio analysis** — can't listen to your track and make suggestions
- **Doesn't leverage Ableton's built-in sounds** — creates tracks but doesn't intelligently select from your installed instruments/presets
- **No genre/label awareness** — no concept of what makes a track fit a specific label's sound
- **No sample finding** — only generates MIDI, doesn't help with sample selection
- **Desktop app, not in-DAW** — requires switching between windows
- **No drum cloning/sound matching** — can't reverse-engineer reference tracks

### DrumClone (RARE/DSP) — What It Does Well & Where It Falls Short

**How it works:** VST3 plugin that isolates and resynthesizes individual drum sounds from full audio. Uses spectral analysis to decompose percussion into tone, noise, transient, foundation components, then resynthesizes each. Free beta (kick model only). Fully offline, sub-second processing.

**Strengths:**
- Genuinely novel DSP — spectral decomposition into tone/noise/transient/foundation layers
- Resynthesis avoids filtering artifacts (sounds clean, not processed)
- Sample-level resolution for tweaking
- Drag-and-drop output
- Fully offline — no cloud dependency
- Free (current beta)

**Weaknesses & Opportunities:**
- **Only kicks right now** — snares, hats, percussion models are planned but not available
- **Manual process** — you have to feed it audio and tweak parameters yourself
- **No AI/intelligence layer** — it's a DSP tool, not an assistant
- **No integration with Beatport/labels** — you'd have to manually source reference tracks
- **No context about your project** — doesn't know what your track needs
- **No suggestion engine** — isolates what you give it, doesn't recommend

### AbletonMCP (Siddharth Ahuja) — The Most Relevant Piece

**How it works:** MCP server that connects Claude Desktop directly to Ableton Live via TCP sockets. Uses a MIDI Remote Script loaded in Ableton that exposes the Live API over a socket connection. Claude can create tracks, load instruments/effects, create MIDI clips, control transport.

**Strengths:**
- **Claude-native** — uses MCP protocol, which is exactly your target
- **Bidirectional** — Claude can both read from and write to Ableton
- **Access to Ableton's browser** — can load native instruments, effects, sounds
- **Open source (MIT)** — you can fork and extend this
- **Active community** — Discord, multiple forks already

**Weaknesses & Opportunities:**
- **No audio analysis** — Claude can control Ableton but can't hear your track
- **No sample recommendation** — doesn't search through your libraries
- **No genre/label intelligence** — no Beatport integration
- **No drum cloning** — no DSP processing
- **Only works with Claude Desktop** — not a Max for Live device

---

## 2. Max for Live as the Integration Layer — Why It's the Right Choice

### What Max for Live Gives You

Max for Live is the **only way** to get deep, bidirectional access to Ableton Live's internals from within the DAW itself. Here's what the Live API exposes:

**Live Object Model (LOM) — Full Access To:**
- `Song` — tempo, time_signature, current_song_time, is_playing, scenes, tracks
- `Track` — name, mute, solo, arm, devices, clip_slots, mixer_device (volume, pan, sends)
- `Clip` — notes, length, pitch_coarse, playing_position, warp_mode
- `Device` — name, parameters, type, class_name (identifies Operator, Analog, etc.)
- `DeviceParameter` — value, min, max, name (every knob on every device)
- `Browser` — **this is key** — navigate Ableton's browser to find packs, presets, instruments

**Two Ways to Code:**
1. **Max patchers** — visual programming with `live.path`, `live.object`, `live.observer`
2. **JavaScript (LiveAPI)** — code-first approach using the `js` or `v8` object

**Node for Max (node.script)** — This is the killer feature for your use case:
- Full Node.js runtime inside Max for Live
- `npm` packages available (fetch, axios, WebSocket, etc.)
- `max-api` module for bidirectional communication between Node and Max
- Can make HTTP calls to external APIs (Claude API, Beatport, your backend)
- Async/await support

### Architecture: Max for Live + Node.js + Claude API

```
┌─────────────────────────────────────────────────────┐
│                   ABLETON LIVE                       │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         Max for Live Device (.amxd)           │   │
│  │                                                │   │
│  │  ┌──────────────┐    ┌─────────────────────┐  │   │
│  │  │  live.path    │    │   node.script        │  │   │
│  │  │  live.object  │◄──►│   (Node.js runtime)  │  │   │
│  │  │  live.observer│    │                       │  │   │
│  │  └──────────────┘    │  ┌─────────────────┐  │  │   │
│  │       ▲               │  │ Claude API       │  │  │   │
│  │       │               │  │ (Anthropic)      │  │  │   │
│  │  ┌────┴─────┐        │  ├─────────────────┤  │  │   │
│  │  │ Audio    │        │  │ Audio Analyzer   │  │  │   │
│  │  │ Analysis │        │  │ (spectral/FFT)   │  │  │   │
│  │  │ (MSP)    │        │  ├─────────────────┤  │  │   │
│  │  └──────────┘        │  │ Beatport Scraper │  │  │   │
│  │                       │  │ / Label Intel    │  │  │   │
│  │  ┌──────────────┐    │  ├─────────────────┤  │  │   │
│  │  │  UI          │    │  │ DrumClone-style  │  │  │   │
│  │  │  (live.dial,  │    │  │ Resynthesis      │  │  │   │
│  │  │  live.text,   │    │  │ (WASM/native)    │  │  │   │
│  │  │  live.tab)    │    │  └─────────────────┘  │  │   │
│  │  └──────────────┘    └─────────────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 3. Ableton Link SDK — Role in This Project

Ableton Link synchronizes beat/tempo/phase across applications on a local network. It's a C++ header-only library (open source under GPLv2+ for open source projects; contact Ableton for proprietary use).

**Relevance to your plugin:** **Low-to-moderate.** Link is useful if:
- You build a companion mobile app that syncs with Ableton
- You want external processes (e.g., a separate Python/Node backend doing heavy AI processing) to stay beat-synced with Ableton
- Multi-device collaboration scenarios

**For your core use case, you don't need Link.** Max for Live already gives you direct access to Ableton's transport, tempo, and timeline through the Live API. Link is for *external* apps that need to stay in time with Ableton — since your plugin lives *inside* Ableton as a Max for Live device, you already have native sync.

**Recommendation:** Skip Link for MVP. Revisit if you build a companion app (e.g., mobile UI for browsing label catalogs, or a standalone analysis tool).

---

## 4. Consolidated Plugin Architecture — "Ableton AI Producer"

### Feature Modules

#### Module 1: Track Analyzer (replaces Co-Producer's analysis)
**What it does:** Listens to your project (or individual tracks) and extracts:
- Key and scale (using spectral analysis via MSP objects like `sigmund~`, `fiddle~`, or a custom FFT chain)
- Tempo and groove feel
- Spectral profile (frequency distribution, dynamics)
- Instrumentation detection (kick, snare, bass, leads, pads, etc.)
- Arrangement structure (intro, verse, chorus, drop)

**How it's better than Co-Producer:**
- Analyzes your *entire project*, not just master bus audio
- Understands individual tracks (reads device chains, clip content)
- Uses Live API to see what instruments/effects you're already using
- Recommends from **Ableton's built-in library** — not a paid external sample library

**Implementation:**
- MSP audio objects for real-time spectral analysis
- `live.path` + `live.object` to read track names, device chains, clip data
- Node.js backend sends analysis data to Claude API for interpretation
- Claude returns recommendations: "Your track is in F minor at 128 BPM with a driving techno feel. Your kick needs more sub-bass — try loading the 'Sub Thunder' preset in Operator, or layer with Drum Rack preset 'Kit-Core 808'. Your hi-hats could use more movement — try adding Auto Filter with LFO modulation."

#### Module 2: Claude Chat Assistant (replaces AbletonGPT)
**What it does:** In-device chat interface where you can ask Claude questions about your project. Claude has full context of your session via the Live API.

**How it's better than AbletonGPT:**
- **Claude, not GPT** — better reasoning, longer context, more nuanced music theory
- **Lives inside Ableton** — no window switching
- **Full session context** — Claude knows your tracks, devices, clips, tempo, key
- **Can take action** — not just advice, Claude can modify your session
- **Project-aware** — remembers context across the session

**Key capabilities:**
- "How should I fill out this arrangement?"
- "What effects would make my lead sit better in the mix?"
- "How do I get the reverb tail on my snare to sound like Bicep's Glue?"
- "Add a sidechain compressor to my bass triggered by the kick"
- Claude can respond with both text advice AND direct Ableton actions

**Implementation:**
- `live.text` or custom `jsui` for chat UI within the Max for Live device
- Node.js handles Claude API calls with session context
- Live API provides Claude with full session state (serialized LOM snapshot)
- Claude's tool-use capabilities to execute Ableton commands

#### Module 3: Label Intelligence & Sound Matching (replaces DrumClone + Beatport)
**What it does:** You give it a Beatport label URL or reference track, and it:
1. Scrapes the label's catalog for sonic characteristics
2. Analyzes reference tracks to identify production signatures
3. Tells you how to adapt your current project to fit that label's sound
4. Extracts/resynthesizes drum sounds from reference material

**How it's better than DrumClone alone:**
- **Intelligent, not just DSP** — Claude interprets what the analysis means
- **Label-level analysis** — not just one track, patterns across a catalog
- **Actionable** — "Drumcode releases typically use kicks at -6dB with a 50-60Hz fundamental and minimal harmonics above 200Hz. Your kick has too much mid-range presence — try rolling off at 200Hz and boosting the sub with Operator's FM synthesis."
- **Sample extraction + contextualization** — extracts sounds AND explains where they fit

**Implementation — Beatport Integration:**
- Beatport API v4 is accessible (with workarounds — use the public client_id from their Swagger docs frontend)
- Node.js in Max for Live can make API calls to `api.beatport.com/v4/`
- Query by label ID → get releases → get tracks → get metadata (genre, key, BPM, style tags)
- A Beatport MCP server already exists (larsenweigle/beatport-mcp) — reference implementation
- **Important:** Beatport's TOS requires linking back to their site; you cannot stream or download audio via their API. For audio analysis of reference tracks, users would need to supply their own purchased audio files.

**Implementation — Drum Sound Extraction:**
- Port DrumClone's approach: spectral decomposition → component isolation → resynthesis
- Can be done in MSP (Max's audio processing) using `pfft~` for spectral processing
- Or use a compiled external (C++ or Rust → Max external) for performance
- Or WASM module called from node.script for portability

#### Module 4: Ableton Sound Library Navigator
**What it does:** Intelligently browses Ableton's built-in content library based on AI analysis.

**This is your killer differentiator.** No existing tool does this well.

**Key insight:** Every Ableton user has access to a massive library of sounds they've already paid for — Core Library, Packs, Live's built-in instruments (Operator, Analog, Wavetable, Drift, Collision, Tension, Electric). Most producers use maybe 10% of what's available. Your plugin makes the other 90% discoverable.

**How it works:**
1. Catalog all installed Ableton content (instruments, presets, samples, drum kits) via Live API browser access
2. Build a local index with metadata (instrument type, genre tags, tonal character, energy level)
3. When the analyzer identifies a need ("you need a pad in F minor with a warm, evolving character"), search the index
4. Present results ranked by relevance, with preview capability
5. One-click to load the instrument/sample onto a new track

**Implementation:**
- `live.path` to navigate `live_app browser` → enumerate categories, items
- Cache the index locally (JSON) for fast lookups — Ableton's browser API is slow
- Claude API to match analysis results to index entries
- `live.object` to load instruments and create tracks

#### Module 5: Mix & Master Intelligence (replaces Ozone/Neutron/Mastering The Mix)
**What it does:** An AI-powered mixing and mastering advisor that lives inside your session, analyzes your mix in real-time, and gives you actionable guidance — using Ableton's native tools when possible, and recommending specific third-party plugins only when needed.

This is NOT about replacing Ozone or Mastering The Mix's DSP (you can't beat their years of algorithm R&D in a Max for Live device). It's about adding the **intelligence layer they're missing** — the layer that connects analysis to action within YOUR specific Ableton session.

**Competitive Teardown:**

**iZotope Ozone 12** ($55–$499):
- *Strengths:* 20 mastering modules, Master Assistant with genre targets and custom flow, Stem EQ (EQ individual stems in a stereo master), Unlimiter (restore dynamics from over-compressed audio), IRC 5 Maximizer, Audiolens reference matching, Bass Control. Industry standard for a reason.
- *Weaknesses:* Closed ecosystem — Ozone doesn't know what's on your individual tracks. Master Assistant is a black box that operates on the master bus only. No awareness of your arrangement, your device chains, or your mixing decisions upstream. Can't tell you "your reverb on track 3 is causing mud at 300Hz" — it can only try to fix it on the master. No chat interface. No label-aware targeting beyond generic genre presets.

**iZotope Neutron 5** ($55–$269):
- *Strengths:* Mix Assistant with inter-plugin communication (identifies tracks with Neutron/Relay instances), AI source detection (knows if it's hearing guitar vs. vocals), Clipper, Upward Compressor, Mid/Side and Transient/Sustain modes across all modules.
- *Weaknesses:* Requires Neutron instances on every track you want analyzed. Mix Assistant only suggests levels, not specific EQ/compression decisions per track. No understanding of Ableton-native devices — if you're using Ableton's Compressor or EQ Eight, Neutron can't see or interact with those settings. Audiolens integration is powerful but requires a separate app and only passes tonal profiles.

**Mastering The Mix Suite** ($15–$350):
- *Strengths:* Each plugin solves ONE problem extremely well. LEVELS (metering), REFERENCE (A/B comparison), FUSER (frequency clash detection + resolution), RESO (resonance detection), BASSROOM (low-end EQ), MIXROOM (mid/high EQ with targets), LIMITER (smart limiting), FASTER MASTER (one-click mastering chain co-created with David Guetta/Nicky Romero), EXPOSE 2 (standalone pre-release QC — checks for clipping, phase, mono compatibility, harsh EQ).
- *Weaknesses:* Each is a separate plugin — no unified intelligence across them. No chat/advice. No awareness of your session beyond the audio passing through each instance. FUSER can detect clashes between two channels but you have to manually set up the sidechain routing. No label targeting. REFERENCE requires manually loading reference tracks. EXPOSE is standalone only (can't run inside Ableton).

**How your plugin is better — the "Mix Doctor" approach:**

The key insight: **your plugin already sees everything.** Via the Live API, you have access to every track, every device, every parameter, every clip. No other mixing/mastering tool has this. You can:

1. **Diagnose problems at the source, not the symptom.** Ozone finds a 300Hz buildup on the master and EQs it out. Your plugin can trace the buildup to the specific track(s) causing it and tell you: "Tracks 4 (Bass) and 7 (Piano) are both heavy at 280-320Hz. Try cutting 3dB at 300Hz on your Piano's EQ Eight, or use FUSER-style sidechain ducking." Then it can *do it* — load an EQ Eight, set the frequency, apply the cut.

2. **Reference-match against labels, not just generic genres.** Ozone 12 has genre targets (Pop, Hip-Hop, EDM, etc.). Your plugin can analyze a specific label's catalog via Beatport metadata and build a *custom tonal/dynamic profile* for that label. "Anjunadeep releases typically have -8 to -10 LUFS integrated, wide stereo imaging above 8kHz, and restrained sub-bass below 40Hz compared to other progressive house labels."

3. **Pre-release checklist as conversation.** Instead of EXPOSE's pass/fail standalone app, Claude can walk you through: "Your master is at -6.2 LUFS integrated — that's loud for Spotify normalization (-14 LUFS target). You'll lose about 7.8dB of perceived loudness on Spotify vs. what you're hearing now. Your true peak is at -0.1 dBTP which is cutting it close — recommend pulling back to -1.0 dBTP minimum. Phase correlation dips to -0.3 in the 200-400Hz range during the chorus — check your bass and pad layers for phase cancellation."

4. **Mix feedback that's contextual and educational.** Instead of a meter turning red, Claude can explain *why* and *how to fix it*: "Your kick's transient is getting eaten by the limiter because it peaks at +3dB above everything else. Instead of limiting harder, try parallel compression on the drum bus — add a Glue Compressor with 30ms attack, 100ms release, 10:1 ratio, mix at 40%. This will tame the peaks while keeping the punch."

**Implementation — what you build vs. what you recommend:**

BUILD (in M4L):
- **Real-time spectral analysis per track** — MSP objects (`pfft~`, `spectroscope~`) to capture frequency snapshots of every track
- **LUFS/True Peak/RMS metering** — K-weighted loudness measurement (the math is well-documented, BS.1770 spec)
- **Phase correlation** — cross-correlate L/R channels per track and on master
- **Frequency clash detection** — compare spectral profiles of track pairs to find overlapping energy
- **Dynamic range measurement** — crest factor, LRA (loudness range)
- **Stereo width analysis** — mid/side energy ratio per frequency band
- **Tonal balance curve** — aggregate spectral snapshot vs. genre/label target

DON'T BUILD (recommend existing tools when appropriate):
- Actual limiting/compression/EQ processing — Ableton's native Compressor, Glue Compressor, EQ Eight, Limiter, Multiband Dynamics are excellent. Your plugin should recommend and configure them.
- Stem separation — defer to iZotope's neural nets (Ozone Stem EQ, or third-party like LALAL.AI/Demucs)
- If the user owns Ozone/Neutron, your plugin can *complement* them by providing the session-aware intelligence layer those tools lack

**Architecture for Mix/Master module:**

```
┌─────────────────────────────────────────────────┐
│              Mix & Master Intelligence            │
│                                                   │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ Per-Track    │  │ Master Bus Analysis       │  │
│  │ Analysis     │  │                            │  │
│  │ • Spectrum   │  │ • Integrated LUFS          │  │
│  │ • RMS/Peak   │  │ • True Peak                │  │
│  │ • Phase      │  │ • Stereo Width             │  │
│  │ • Transient  │  │ • Tonal Balance Curve      │  │
│  │   density    │  │ • Dynamic Range (LRA)      │  │
│  │ • Device     │  │ • Phase Correlation        │  │
│  │   chain read │  │ • Frequency Clash Matrix   │  │
│  └──────┬──────┘  └─────────────┬──────────────┘  │
│         │                        │                  │
│         ▼                        ▼                  │
│  ┌──────────────────────────────────────────────┐  │
│  │           Claude Analysis Engine              │  │
│  │                                                │  │
│  │  Context: All track data + device chains +     │  │
│  │  spectral snapshots + label target profile     │  │
│  │                                                │  │
│  │  Outputs:                                      │  │
│  │  • Mix issues with root-cause identification   │  │
│  │  • Specific fix recommendations (with params)  │  │
│  │  • One-click actions (add EQ, set compressor)  │  │
│  │  • Pre-release checklist (streaming targets)   │  │
│  │  • Label comparison ("your mix vs Drumcode")   │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**UI for this module (within the tabbed M4L device):**

Tab: **MIX CHECK**
- Frequency clash matrix (grid showing which track pairs conflict and where)
- Per-track tonal balance bars (visual overview of spectral distribution)
- Phase correlation overview
- One-button "Analyze Mix" → Claude generates a mix report card

Tab: **MASTER CHECK**
- LUFS meter (momentary, short-term, integrated) with streaming platform targets
- True peak meter with dBTP warning
- Tonal balance curve vs. selected reference/label target
- Dynamic range indicator
- Stereo width per band
- Pre-release checklist (Spotify/Apple Music/Club/Vinyl readiness)

Tab: **REFERENCE**
- Drop in a reference track → spectral comparison overlay
- Or select a Beatport label → auto-generated aggregate target profile
- Delta view showing where your mix differs from reference
- Claude explains: "Your high-end (10kHz+) is 3dB quieter than your reference. This could be intentional for a darker mix, or you may want to add a shelf boost with EQ Eight on your master. The reference also has wider stereo imaging above 5kHz — try Ableton's Utility with 120% width on a high-pass filtered send."

#### Module 6: AI Music Generation & Stem Tools (ElevenLabs Eleven Music)
**What it does:** Integrates ElevenLabs' Eleven Music API directly into Ableton to generate musical elements — loops, stems, reference layers, vocal ideas, transition fills — from natural language prompts, informed by your session's key/tempo/genre context. Also leverages their stem separation API for extracting elements from reference tracks.

This is NOT about generating entire songs and calling it a day. A serious producer isn't going to replace their craft with AI-generated tracks. The power is in **using generative audio as a production tool** — the same way you'd reach for a sample pack, except the samples are generated on-demand, perfectly matched to your session.

**What ElevenLabs Eleven Music offers:**

- **Compose API** (`POST /v1/music/compose`): Text prompt → full audio. Supports `force_instrumental`, duration control (3s–300s/600s), 44.1kHz output. Simple prompt mode or structured `composition_plan` mode.
- **Composition Plan** (structured generation): Define sections (verse, chorus, bridge) with per-section style tags (`positive_local_styles`, `negative_local_styles`), duration per section, lyrics per section. Returns composition plan + audio + metadata (title, genres, languages).
- **Streaming** (`POST /v1/music/stream`): Same params as compose but streams audio back — useful for auditioning before committing.
- **Inpainting API** (enterprise): Modify specific sections of a generated track — change lyrics, extend/trim passages, restyle sections. This is the "fix just the chorus" capability.
- **Stem Separation** (`POST /v1/music/separate-stems`): Upload audio → get separated stems (vocals, drums, bass, other — 2-stem or 4/6-stem variants). Works on ANY audio, not just ElevenLabs-generated content.
- **Word Timestamps**: Returns precise per-word timing for generated lyrics — useful for syncing with arrangement.
- **Fine-tuning** (`finetune_id`): Custom music fine-tunes for consistent style generation.
- **Commercial licensing**: Licensed via Merlin Network + Kobalt Music Group deals. Cleared for commercial use (YouTube, film, ads). No major label catalogs (UMG/Sony/Warner) but independent catalog is extensive.

**How this fits into the plugin — use cases:**

1. **Context-aware generation.** Your plugin already knows the session's key (via spectral analysis), tempo (via Live API), and genre target (via label intelligence). Claude can construct an optimized Eleven Music prompt automatically:
   - User: "I need a pad layer for this section"
   - Claude reads: Key of F minor, 124 BPM, Anjunadeep-style progressive house
   - Claude generates prompt: "Atmospheric, lush pad, F minor, 124 BPM, deep house, ethereal, reverb-heavy, wide stereo, no drums, no bass"
   - Calls Eleven Music API with `force_instrumental: true`, duration matched to section length
   - Audio drops into a new Ableton track, tempo-synced

2. **Compositional scaffolding / arrangement prototyping.** Use the `composition_plan` API to generate a full arrangement skeleton:
   - User: "Generate a 16-bar idea with intro → build → drop structure in my current key and tempo"
   - Claude constructs composition_plan with 3 sections, style tags matching the project's genre
   - Generated audio lands in Ableton as a reference track the producer can build on top of or draw inspiration from

3. **Stem extraction from reference tracks.** User drops a reference track (a Beatport purchase, a Spotify rip for personal reference, etc.):
   - Eleven Music stem separation → vocals, drums, bass, other
   - Each stem lands on its own Ableton track for A/B comparison with the producer's own layers
   - Claude can then analyze: "Your reference's kick sits at -6dB with a 50Hz fundamental and 2kHz click. Your kick is 3dB louder with more sub content. Consider a high-pass at 35Hz and a slight cut at 80Hz to match."
   - This replaces the need for external stem separation tools (LALAL.AI, Demucs, etc.)

4. **Fill generation.** Need a transition riser, a vocal chop layer, a percussion fill, or an ambient texture?
   - "Generate a 4-bar riser in D minor" → Eleven Music → drops into arrangement at the right point
   - "Create a vocal chop pattern, 128 BPM, tech house style" → generated, chopped, placed

5. **Vocal demo / topline prototyping.** Eleven Music generates vocals with lyrics. A producer working on an instrumental can:
   - "Write and generate a vocal hook idea for this chorus — uplifting house, female voice, English"
   - Use it as a placeholder/demo topline to pitch to vocalists, or as inspiration for melody writing
   - Multilingual support (EN/ES/DE/JP+) opens up ideas for international releases

6. **Sound design via generation + resampling.** Generate a short clip → resample it in Ableton's Simpler/Sampler:
   - "Generate a 5-second metallic drone texture, dark ambient, atonal"
   - Drop into Simpler, map across MIDI keyboard, now it's a playable instrument
   - This is a creative workflow that doesn't exist in any other DAW plugin

**What you DON'T use it for:**
- Generating entire finished tracks (defeats the purpose of being a producer)
- Replacing the user's creative decisions (always a tool, never the artist)
- Anything requiring the user's specific sound/brand (AI generation is generic by nature — it's for scaffolding and elements, not final product)

**Implementation:**

```
┌─────────────────────────────────────────────────────────┐
│              AI Generation (Eleven Music)                 │
│                                                           │
│  ┌──────────────┐    ┌────────────────────────────────┐  │
│  │ Session       │    │ Claude Prompt Constructor       │  │
│  │ Context       │───▶│                                │  │
│  │ • Key/Scale   │    │ Converts session context +     │  │
│  │ • Tempo       │    │ user request into optimized    │  │
│  │ • Genre       │    │ Eleven Music API params        │  │
│  │ • Section len │    │                                │  │
│  └──────────────┘    └──────────┬─────────────────────┘  │
│                                  │                        │
│                                  ▼                        │
│  ┌──────────────────────────────────────────────────┐    │
│  │         ElevenLabs Music API                      │    │
│  │                                                    │    │
│  │  /v1/music/compose    → Generate audio             │    │
│  │  /v1/music/stream     → Stream/audition            │    │
│  │  /v1/music/detailed   → Get composition plan       │    │
│  │  /v1/music/separate-stems → Stem separation        │    │
│  │                                                    │    │
│  │  Output: 44.1kHz audio (PCM/MP3) + metadata        │    │
│  └──────────┬───────────────────────────────────────┘    │
│              │                                            │
│              ▼                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │         Ableton Integration                       │    │
│  │                                                    │    │
│  │  • Create new audio track via Live API             │    │
│  │  • Write audio to clip slot (or arrangement)       │    │
│  │  • Warp to session tempo                           │    │
│  │  • Name track descriptively                        │    │
│  │  • For stems: create track per stem                │    │
│  │  • For Simpler/Sampler: load into instrument       │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

**API Cost Model (BYOK — user brings own ElevenLabs API key):**
- ~$0.50 per minute of generated audio (varies by plan)
- Stem separation: 0.5x–1x generation cost
- Pro tier required for 44.1kHz PCM output (ideal for DAW work)
- Starter plan works for MP3 output (lower quality but functional)

**Technical notes:**
- Node.js SDK available (`@elevenlabs/elevenlabs-js`) — installs via npm in node.script
- Streaming endpoint enables audition-before-commit workflow
- PCM 44.1kHz output avoids lossy compression artifacts when importing to Ableton
- Audio files need to be written to disk then loaded via Live API (no direct buffer injection in M4L)
- Composition plan API returns structured JSON — Claude can interpret and present section-by-section
- `finetune_id` parameter could enable users to train a consistent style model (if they're on enterprise)

---



### Architecture Revision Notes

The original plan proposed 6 modules over 20 weeks. After technical review, several critical issues were identified that required architectural changes and scope adjustment for the MVP.

**Critical issues addressed:**
1. **Multi-track audio routing** — A single M4L device only hears its own track. Per-track analysis requires a satellite device architecture (see below).
2. **Chat UI** — `jsui` is a canvas API, not a text engine. Building a chat UI in jsui would mean hand-implementing text input, word wrap, scrolling, copy/paste. Replaced with `jweb` (embedded Chromium).
3. **Token cost management** — Serializing a full 50-track session with all device parameters could hit 50-100K tokens per message ($1-2 per interaction at Opus rates). Need selective serialization and summarization.
4. **Beatport API** — Using an undocumented public client_id is not a foundation for a commercial product. Deferred until official API partnership is secured.
5. **Timeline** — 20 weeks for 6 ambitious modules is unrealistic. Revised to focused MVP.

---

### Multi-Track Audio Routing Architecture

**Problem:** M4L audio devices only receive audio from the track they live on. Modules 1 and 5 require per-track spectral analysis.

**Solution: Satellite + Hub Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                    ABLETON LIVE                           │
│                                                           │
│  Track 1 (Kick)     Track 2 (Bass)     Track 3 (Lead)   │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │ [Satellite]  │   │ [Satellite]  │   │ [Satellite]  │ │
│  │  sigmund~    │   │  sigmund~    │   │  sigmund~    │ │
│  │  spectral →  │   │  spectral →  │   │  spectral →  │ │
│  │  send "sat1" │   │  send "sat2" │   │  send "sat3" │ │
│  └──────────────┘   └──────────────┘   └──────────────┘ │
│         │                  │                  │           │
│         └──────────────────┼──────────────────┘           │
│                            ▼                              │
│  Master Track (or dedicated analysis track)               │
│  ┌──────────────────────────────────────────────────┐    │
│  │              [Hub Device — Main Plugin]            │    │
│  │                                                    │    │
│  │  receive "sat1..N" → aggregate spectral data       │    │
│  │  node.script → Claude API + chat UI + actions      │    │
│  │  jweb → chat interface                             │    │
│  │  Live API → session state + browser + control      │    │
│  └──────────────────────────────────────────────────┘    │
│                                                           │
│  Alternative for MVP: Use Live API to read clip/device    │
│  data without audio routing (metadata-only analysis).     │
│  Audio spectral analysis can be single-track (the track   │
│  the hub device lives on) for v1, with satellite          │
│  architecture added in v2.                                │
└─────────────────────────────────────────────────────────┘
```

**MVP simplification:** For v1, the hub device reads session *metadata* (tracks, devices, parameters, clip notes) via Live API — no audio routing needed. Audio analysis is limited to the track the device lives on (typically master bus). Satellite architecture is a v2 feature.

---

### Token Budget Management Strategy

**Problem:** A 50-track session serialized naively could be 50-100K tokens.

**Solution: Tiered context injection**

| Tier | Content | Token Estimate | When Used |
|------|---------|---------------|-----------|
| **Minimal** | Track names + types + armed/solo/mute state | ~500 tokens | Every message (always included) |
| **Standard** | Minimal + device chain names + clip names + tempo/key | ~2-5K tokens | Default for chat interactions |
| **Detailed** | Standard + device parameter values for relevant tracks | ~5-15K tokens | When user asks about specific tracks/mixing |
| **Full** | Everything including all parameter values | ~20-50K+ tokens | Only on explicit "analyze everything" request |

Claude selects the tier based on the user's question. The serializer accepts a `depth` parameter and a `trackFilter` to control what's included.

Additionally:
- **Session summary caching** — Claude generates a 500-token summary of the session on first analysis; this summary is reused for subsequent messages until the session changes
- **Incremental updates** — After initial context, only send deltas (what changed since last message)
- **Cost display** — Show estimated token cost in the UI before sending expensive queries

---

### Revised MVP Scope — 3 Modules, 12-16 Weeks

**MVP modules (what we build first):**
1. **Claude Chat Assistant** — In-device AI chat with full session context and Ableton control actions
2. **Track Analyzer** — Session metadata analysis + single-track audio analysis (master bus)
3. **Sound Library Navigator** — Index and search Ableton's built-in instruments/presets/samples

**Deferred to v2:**
- Mix & Master Intelligence (requires satellite architecture for per-track audio)
- Beatport / Label Intelligence (requires official API access)
- Drum Sound Extraction (heavy DSP R&D)
- AI Generation / Eleven Music (additive feature, not core)

### Phase 1: Foundation (Weeks 1-4)
1. **Create Max for Live device scaffold**
   - Hub device `.amxd` with `node.script` bridge
   - `jweb` for chat UI (embedded Chromium — HTML/CSS/JS)
   - Live API connection for session state reading
   - Tabbed interface: Chat / Analyze / Browse
   - API key configuration (stored in device parameters or local file)

2. **Claude API integration via Node.js**
   - Anthropic SDK (`@anthropic-ai/sdk`) in node.script
   - Tiered session state serializer (tracks, devices, clips → JSON with depth control)
   - Streaming response support (show tokens as they arrive in chat)
   - Tool-use definitions for Ableton actions (create track, load device, add effect, etc.)
   - Token budget tracker (estimate cost before sending, display to user)

3. **Basic audio analysis (master bus only for MVP)**
   - Key detection via `sigmund~` on master
   - BPM from `live_set` properties (no DSP needed)
   - Basic spectral snapshot for genre hints

### Phase 2: Core Features (Weeks 5-10)
4. **Chat interface (jweb-based)**
   - HTML/CSS/JS chat UI running in `jweb` object
   - Markdown rendering for Claude's responses
   - Message history with conversation management
   - `max-api` bridge for bidirectional communication (jweb ↔ node.script ↔ Max)
   - Settings panel (API key, model selection, context depth)
   - Estimated cost display per message

5. **Sound library indexer**
   - Lazy background enumeration via `live.path` → browser tree
   - Local JSON cache with metadata (instrument type, category, pack)
   - Claude-powered semantic search ("warm evolving pad" → matching presets)
   - One-click loading: `live.object` to load instrument onto new track
   - User-triggered index refresh (not automatic — browser API is slow)

6. **Session state reader + recommendations**
   - Full LOM traversal (tracks → devices → parameters)
   - Device chain analysis (what's on each track)
   - MIDI clip content reading (notes, timing, velocity)
   - Claude-powered project analysis: "Here's what I see in your session..."
   - Instrument/preset recommendations based on what's missing

### Phase 3: Polish + Satellite Prep (Weeks 11-16)
7. **Action engine**
   - Claude tool-use → Live API execution bridge
   - Actions: create track, load instrument/effect, set device parameters, create MIDI clip
   - Undo safety: confirm destructive actions before executing
   - Action history log in chat

8. **Error handling & offline resilience**
   - Graceful API failure handling (timeout, rate limit, auth error)
   - Offline mode: audio analysis + session reading work without API
   - Retry with exponential backoff for transient failures
   - Clear error messages in chat UI

9. **Performance & polish**
   - Lazy loading for library index
   - Response streaming for perceived speed
   - UI polish (loading states, animations, dark theme matching Ableton)
   - State persistence across save/load (serialize to device parameters)
   - Package as downloadable `.amxd` with setup instructions

### Post-MVP Roadmap (v2+)
10. **Satellite device for multi-track audio analysis**
    - Lightweight `.amxd` for each track (spectral snapshot → send to hub)
    - Hub aggregates per-track spectral data
    - Frequency clash detection, per-track LUFS, phase correlation

11. **Mix & Master Intelligence**
    - Requires satellite architecture from step 10
    - BS.1770 LUFS metering, true peak, stereo width, tonal balance
    - Claude-powered "mix doctor" with root-cause diagnosis
    - Pre-release checklist (streaming platform targets)

12. **Label Intelligence**
    - Pending official Beatport API partnership
    - Or: user-supplied reference tracks + manual metadata
    - Label sonic profiling, style-matching recommendations

13. **AI Generation (Eleven Music)**
    - ElevenLabs API integration (BYOK)
    - Context-aware prompt construction
    - Audio import pipeline (API → temp file → Ableton track)

14. **Drum Sound Extraction**
    - Spectral decomposition → resynthesis (MSP-based)
    - Significant DSP R&D required — evaluate build vs. partner

---

## 6. Distribution: Max for Live vs. VST/AU/VST3

### Recommendation: **Max for Live first, standalone VST3 later**

**Why M4L first:**
- Direct Live API access — no reverse engineering needed
- Node.js runtime built-in — trivial to add HTTP/API capabilities
- Fastest path to a working product
- Large existing M4L marketplace (maxforlive.com, Isotonik, etc.)
- Users already expect M4L devices with novel capabilities

**Why NOT VST/AU/VST3 for MVP:**
- VST/AU plugins run in a sandbox — they can't access Ableton's internal state
- No way to browse Ableton's instrument library from a VST
- No way to create tracks or load devices from a VST
- You'd need JUCE + C++ for the plugin, plus a bridge to Ableton (like AbletonMCP's socket approach)
- Much more complex development with less capability

**The VST3 path (for later):**
If you want cross-DAW support eventually, you'd build:
1. A JUCE-based VST3 plugin with the UI and Claude integration
2. A DAW-specific bridge for each target (Ableton Remote Script, Logic Script, FL Studio scripting)
3. Audio analysis would work universally (the plugin can analyze its input signal)
4. DAW control features would be DAW-specific

**Ableton Link's role in a VST3 version:** If you go VST3, Link becomes more relevant because the plugin is no longer "inside" Ableton. Link would let the VST3 plugin stay beat-synced even when running as an external process.

---

## 7. Key Technical Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Platform | Max for Live device | Only way to get full Live API access |
| AI Backend | Claude API (Anthropic) | Better reasoning, tool-use, longer context |
| Node runtime | node.script (Max built-in) | Full npm ecosystem, async HTTP, no external deps |
| **Chat UI** | **jweb (embedded Chromium)** | **HTML/CSS/JS — real text input, markdown rendering, scrolling. jsui rejected (canvas-only, no text engine)** |
| Audio analysis (MVP) | MSP on master bus only | Key detection via `sigmund~`; per-track deferred to v2 satellite architecture |
| Audio analysis (v2) | Satellite + Hub architecture | Lightweight M4L device per track sends spectral data to hub via `send`/`receive` |
| Mix/Master DSP | DON'T build — recommend native + 3rd party | Can't compete with Ozone/FabFilter DSP; add intelligence layer instead |
| **Context management** | **Tiered serialization (4 levels)** | **Minimal/Standard/Detailed/Full — prevents runaway token costs on large sessions** |
| **Beatport data** | **DEFERRED — requires official API** | **Unauthorized client_id is fragile and TOS-violating; not suitable for commercial product** |
| AI generation | ElevenLabs Eleven Music API (BYOK) — deferred to v2 | Additive feature, not core differentiator for MVP |
| Drum extraction | DEFERRED to v2+ | Heavy DSP R&D; evaluate build vs. partner after MVP |
| Distribution | maxforlive.com + direct download | Established marketplace for M4L devices |
| Pricing model | One-time purchase + API key (BYOK) | Users bring their own Claude API key |
| Ableton Link | Not needed for MVP | Max for Live already has native Ableton access |

---

## 8. Nish's Project as Starting Point

The `infoofficialnish-hub/ableton-claude` GitHub project appears to be an early prototype connecting Claude to Ableton. This aligns with the AbletonMCP ecosystem — multiple developers have built Claude-Ableton bridges using:
- MIDI Remote Scripts (Python running inside Ableton)
- TCP socket communication
- MCP protocol for Claude Desktop integration

**What to take from the ecosystem:**
- The Remote Script pattern is proven — use it for the Live API bridge
- MCP is useful for Claude Desktop but **your plugin should call Claude API directly** from node.script (no need for MCP when you're already inside Ableton)
- The JSON-over-TCP protocol works well for command/response patterns

**What to build differently:**
- Audio analysis (none of the existing tools do this)
- Library awareness (none of them index Ableton's built-in content)
- Label intelligence (completely novel)
- Unified UI inside the device (not a separate desktop app)

---

## 9. Risk Analysis

| Risk | Severity | Mitigation |
|------|----------|------------|
| Claude API latency | Medium | Stream responses, show typing indicator, cache session summaries |
| **Claude API cost per interaction** | **High** | **Tiered context (500-50K tokens), session summary caching, cost display in UI, default to Haiku for simple queries** |
| **Multi-track audio routing complexity** | **High** | **MVP uses metadata-only analysis (no audio routing). Satellite architecture deferred to v2** |
| Max for Live UI constraints (~300x200px default) | Medium | `jweb` gives full HTML/CSS; use expandable/popout UI pattern |
| Ableton browser API slowness | Medium | Lazy background indexing, local JSON cache, user-triggered refresh |
| **node.script limitations** | **Medium** | **No native npm modules, memory constraints within Max process. Stick to pure JS packages. Profile memory usage.** |
| **Offline/API failure** | **Medium** | **Audio analysis + session reading work offline. Graceful error messages. Retry with backoff.** |
| **State persistence across save/load** | **Medium** | **Serialize conversation + settings to device parameters or companion file** |
| Competition from Ableton themselves | Low-Med | Ableton moves slowly on AI; first-mover advantage is real |
| Cycling '74 / Max deprecation | Low | Max is deeply embedded in Ableton's roadmap through v12+ |
| **AI-generated music copyright uncertainty** | **Low-Med** | **Inform users; position AI generation as scaffolding/inspiration, not final content** |

---

## 10. Summary

### MVP — What We're Building First

The MVP focuses on three modules that deliver the core differentiator — **session-aware AI assistance inside Ableton** — without the riskiest technical bets:

1. **Claude Chat Assistant** — An in-device AI chat (via `jweb`) with full session context. Claude can read your tracks, devices, clips, and parameters, give production advice, and take action (create tracks, load instruments, modify effects). This alone replaces AbletonGPT with better reasoning, better context, and native Ableton integration.

2. **Track Analyzer** — Reads session metadata via Live API + basic spectral analysis on the master bus. Claude interprets the analysis and makes recommendations using Ableton's own terminology and instruments. No per-track audio routing needed for v1.

3. **Sound Library Navigator** — Indexes Ableton's built-in instruments, presets, and samples. When Claude identifies a gap ("you need a warm pad"), it searches the index and can load the result directly. This makes 90% of the user's existing library discoverable.

These three modules are sufficient to ship a product no one else offers. The key differentiator is **context** — your plugin knows what's in the project, what devices are on every track, and what Ableton can do natively.

### Full Vision — v2 and Beyond

The remaining modules (Mix & Master Intelligence, Label Intelligence, Drum Extraction, AI Generation) are deferred to post-MVP. Each has specific prerequisites:
- **Mix/Master** requires the satellite device architecture for per-track audio analysis
- **Label Intelligence** requires an official Beatport API partnership (or alternative data source)
- **Drum Extraction** requires significant DSP R&D
- **AI Generation** is additive and can be bolted on once the core experience is proven

The full vision remains: combining six separate tools into one session-aware M4L device. But the path there is incremental — ship a great chat assistant first, then layer capabilities on a proven foundation.

### Fastest Path to Working Prototype

1. Scaffold M4L device with `node.script` + `jweb`
2. Wire Claude API calls with streaming + tool-use
3. Build Live API session state reader with tiered serialization
4. Create chat UI in HTML/CSS/JS (runs in `jweb`)
5. Add tool-use actions for basic Ableton control
6. Build library indexer with local JSON cache

A functional MVP (chat + basic analysis + library search) is achievable in **12-16 weeks**.
