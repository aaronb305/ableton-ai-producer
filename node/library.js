/**
 * Sound library module — known Ableton content + search.
 *
 * Ships with a built-in database of Ableton's native instruments,
 * audio effects, and MIDI effects. Can be extended at runtime by
 * a browser-indexer scan that writes user-specific content to
 * library-index.json.
 */

const fs = require("fs");
const path = require("path");

// Path to the user-extended index (written by library-indexer.js via Max)
const INDEX_PATH = path.join(__dirname, "..", "library-index.json");

// ---------------------------------------------------------------------------
// Built-in Ableton content database
// ---------------------------------------------------------------------------

const BUILTIN_INSTRUMENTS = [
  { name: "Analog", category: "instruments", tags: ["synth", "subtractive", "analog", "warm", "classic", "bass", "lead", "pad"], description: "Analog-modeled subtractive synthesizer with two oscillators, filters, and amp envelopes" },
  { name: "Collision", category: "instruments", tags: ["physical modeling", "mallet", "percussion", "bell", "metallic", "resonant"], description: "Physical modeling instrument combining mallet and resonator components" },
  { name: "Drift", category: "instruments", tags: ["synth", "subtractive", "wavetable", "organic", "evolving", "warm", "lo-fi"], description: "Subtractive/wavetable synth with organic, slightly unstable character" },
  { name: "Electric", category: "instruments", tags: ["electric piano", "keys", "rhodes", "wurlitzer", "vintage", "warm"], description: "Electric piano physical model (Rhodes, Wurlitzer styles)" },
  { name: "Operator", category: "instruments", tags: ["synth", "fm", "digital", "bass", "lead", "pad", "bell", "metallic", "versatile"], description: "FM synthesis with up to 4 oscillators, built-in filter and LFO" },
  { name: "Sampler", category: "instruments", tags: ["sampler", "multisampled", "zone", "layer", "modulation"], description: "Advanced multisampling instrument with modulation matrix and zone editing" },
  { name: "Simpler", category: "instruments", tags: ["sampler", "simple", "one-shot", "slice", "warp"], description: "Streamlined sampler with Classic, One-Shot, and Slicing modes" },
  { name: "Tension", category: "instruments", tags: ["physical modeling", "string", "pluck", "bow", "guitar", "organic"], description: "Physical modeling string instrument (plucked, bowed, hammered)" },
  { name: "Wavetable", category: "instruments", tags: ["synth", "wavetable", "digital", "evolving", "modern", "pad", "lead", "bass", "movement"], description: "Wavetable synthesizer with two oscillators, sub, and extensive modulation" },
  { name: "Drum Rack", category: "instruments", tags: ["drums", "percussion", "kit", "sampler", "beat", "rhythm"], description: "Multi-pad drum sampler with per-pad effects chains" },
  { name: "Instrument Rack", category: "instruments", tags: ["rack", "layer", "split", "macro", "chain"], description: "Container for layering and splitting multiple instruments with macro controls" },
];

const BUILTIN_AUDIO_EFFECTS = [
  { name: "Auto Filter", category: "audio_effects", tags: ["filter", "envelope follower", "lfo", "resonance", "sweep"] },
  { name: "Auto Pan", category: "audio_effects", tags: ["pan", "tremolo", "lfo", "stereo", "movement"] },
  { name: "Beat Repeat", category: "audio_effects", tags: ["glitch", "stutter", "repeat", "creative", "rhythmic"] },
  { name: "Cabinet", category: "audio_effects", tags: ["amp", "cabinet", "guitar", "distortion", "warmth"] },
  { name: "Channel EQ", category: "audio_effects", tags: ["eq", "equalizer", "simple", "3-band", "mixing"] },
  { name: "Chorus-Ensemble", category: "audio_effects", tags: ["chorus", "ensemble", "modulation", "width", "lush"] },
  { name: "Compressor", category: "audio_effects", tags: ["compressor", "dynamics", "punch", "glue", "mixing", "sidechain"] },
  { name: "Corpus", category: "audio_effects", tags: ["resonator", "physical modeling", "metallic", "tuned", "body"] },
  { name: "Delay", category: "audio_effects", tags: ["delay", "echo", "time", "feedback", "stereo"] },
  { name: "Drum Buss", category: "audio_effects", tags: ["drums", "bus", "distortion", "compression", "transient", "boom"] },
  { name: "Dynamic Tube", category: "audio_effects", tags: ["saturation", "tube", "warmth", "distortion", "analog"] },
  { name: "Echo", category: "audio_effects", tags: ["delay", "echo", "modulation", "reverb", "feedback", "creative"] },
  { name: "EQ Eight", category: "audio_effects", tags: ["eq", "equalizer", "8-band", "parametric", "mixing", "surgical"] },
  { name: "EQ Three", category: "audio_effects", tags: ["eq", "equalizer", "3-band", "dj", "kill", "simple"] },
  { name: "Erosion", category: "audio_effects", tags: ["distortion", "noise", "lo-fi", "digital", "creative"] },
  { name: "Filter Delay", category: "audio_effects", tags: ["delay", "filter", "creative", "3-tap", "stereo"] },
  { name: "Flanger", category: "audio_effects", tags: ["flanger", "modulation", "sweep", "jet", "metallic"] },
  { name: "Frequency Shifter", category: "audio_effects", tags: ["frequency", "shift", "ring mod", "creative", "experimental"] },
  { name: "Gate", category: "audio_effects", tags: ["gate", "dynamics", "noise gate", "sidechain", "mixing"] },
  { name: "Glue Compressor", category: "audio_effects", tags: ["compressor", "glue", "bus", "ssl", "mixing", "mastering", "sidechain"] },
  { name: "Grain Delay", category: "audio_effects", tags: ["delay", "granular", "pitch", "texture", "creative"] },
  { name: "Hybrid Reverb", category: "audio_effects", tags: ["reverb", "convolution", "algorithmic", "space", "large", "creative"] },
  { name: "Limiter", category: "audio_effects", tags: ["limiter", "dynamics", "mastering", "loudness", "ceiling"] },
  { name: "Looper", category: "audio_effects", tags: ["looper", "recording", "overdub", "live", "performance"] },
  { name: "Multiband Dynamics", category: "audio_effects", tags: ["multiband", "compressor", "expander", "dynamics", "mastering"] },
  { name: "Overdrive", category: "audio_effects", tags: ["distortion", "overdrive", "saturation", "drive", "warmth"] },
  { name: "Pedal", category: "audio_effects", tags: ["distortion", "overdrive", "fuzz", "guitar", "pedal"] },
  { name: "Phaser-Flanger", category: "audio_effects", tags: ["phaser", "flanger", "modulation", "sweep", "space"] },
  { name: "Redux", category: "audio_effects", tags: ["bitcrusher", "downsample", "lo-fi", "digital", "retro"] },
  { name: "Resonators", category: "audio_effects", tags: ["resonator", "tuned", "harmonic", "tonal", "creative"] },
  { name: "Reverb", category: "audio_effects", tags: ["reverb", "space", "room", "hall", "ambient"] },
  { name: "Saturator", category: "audio_effects", tags: ["saturation", "warmth", "distortion", "analog", "color"] },
  { name: "Shifter", category: "audio_effects", tags: ["pitch shift", "frequency", "creative", "harmonizer"] },
  { name: "Spectral Resonator", category: "audio_effects", tags: ["spectral", "resonator", "creative", "experimental", "sidechain"] },
  { name: "Spectral Time", category: "audio_effects", tags: ["spectral", "delay", "freeze", "creative", "experimental"] },
  { name: "Tuner", category: "audio_effects", tags: ["tuner", "pitch", "utility", "reference"] },
  { name: "Utility", category: "audio_effects", tags: ["utility", "gain", "pan", "phase", "mono", "width", "mixing"] },
  { name: "Vinyl Distortion", category: "audio_effects", tags: ["vinyl", "distortion", "lo-fi", "crackle", "warmth", "creative"] },
  { name: "Vocoder", category: "audio_effects", tags: ["vocoder", "voice", "carrier", "modulator", "creative", "robotic"] },
];

const BUILTIN_MIDI_EFFECTS = [
  { name: "Arpeggiator", category: "midi_effects", tags: ["arpeggiator", "arp", "sequence", "pattern", "rhythmic"] },
  { name: "Chord", category: "midi_effects", tags: ["chord", "harmony", "interval", "layer"] },
  { name: "Note Length", category: "midi_effects", tags: ["note length", "gate", "duration", "trigger"] },
  { name: "Pitch", category: "midi_effects", tags: ["pitch", "transpose", "octave", "semitone"] },
  { name: "Random", category: "midi_effects", tags: ["random", "chance", "probability", "generative"] },
  { name: "Scale", category: "midi_effects", tags: ["scale", "key", "quantize", "constrain", "music theory"] },
  { name: "Velocity", category: "midi_effects", tags: ["velocity", "dynamics", "random", "range", "expression"] },
];

// Combine all built-in content
const BUILTIN_ITEMS = [
  ...BUILTIN_INSTRUMENTS,
  ...BUILTIN_AUDIO_EFFECTS,
  ...BUILTIN_MIDI_EFFECTS,
];

// ---------------------------------------------------------------------------
// Index management
// ---------------------------------------------------------------------------

/** @type {Array} Combined index (built-in + user-scanned) */
let fullIndex = [...BUILTIN_ITEMS];

/** @type {boolean} Whether the user-extended index has been loaded */
let userIndexLoaded = false;

/**
 * Load the user-extended index from disk if it exists.
 * Merges with built-in items, deduplicating by name+category.
 */
function loadUserIndex() {
  if (userIndexLoaded) return;
  userIndexLoaded = true;

  try {
    if (!fs.existsSync(INDEX_PATH)) return;

    const raw = fs.readFileSync(INDEX_PATH, "utf-8");
    const userItems = JSON.parse(raw);

    if (!Array.isArray(userItems)) return;

    // Build a set of existing name+category combos for dedup
    const existing = new Set(fullIndex.map((item) => `${item.name}|${item.category}`));

    for (const item of userItems) {
      const key = `${item.name}|${item.category}`;
      if (!existing.has(key)) {
        fullIndex.push(item);
        existing.add(key);
      }
    }
  } catch {
    // Silently ignore — user index is optional
  }
}

/**
 * Update the index with fresh browser scan results.
 * Called when node.script receives scanned data from the library-indexer js object.
 *
 * @param {Array} items - Array of browser items from the scanner
 */
function updateIndex(items) {
  if (!Array.isArray(items)) return;

  // Write to disk for persistence
  try {
    fs.writeFileSync(INDEX_PATH, JSON.stringify(items, null, 2), "utf-8");
  } catch {
    // Non-fatal — index still works in memory
  }

  // Merge into fullIndex
  const existing = new Set(fullIndex.map((item) => `${item.name}|${item.category}`));
  for (const item of items) {
    const key = `${item.name}|${item.category}`;
    if (!existing.has(key)) {
      fullIndex.push(item);
      existing.add(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search the library index.
 *
 * @param {string} query - Search query (natural language)
 * @param {string} [category] - Optional category filter
 * @param {number} [limit=15] - Max results to return
 * @returns {Array} Matching items sorted by relevance
 */
function search(query, category, limit = 15) {
  loadUserIndex();

  if (!query || typeof query !== "string") return [];

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const results = [];

  for (const item of fullIndex) {
    // Category filter
    if (category && category !== "all" && item.category !== category) continue;

    // Score based on token matches
    let score = 0;
    const searchText = [
      item.name,
      item.category,
      item.description || "",
      ...(item.tags || []),
      item.path || "",
    ]
      .join(" ")
      .toLowerCase();

    for (const token of tokens) {
      if (item.name.toLowerCase() === token) {
        score += 10; // Exact name match
      } else if (item.name.toLowerCase().includes(token)) {
        score += 5; // Partial name match
      } else if ((item.tags || []).some((t) => t === token)) {
        score += 4; // Exact tag match
      } else if ((item.tags || []).some((t) => t.includes(token))) {
        score += 2; // Partial tag match
      } else if (searchText.includes(token)) {
        score += 1; // General text match
      }
    }

    if (score > 0) {
      results.push({ ...item, _score: score });
    }
  }

  // Sort by score descending, then by name
  results.sort((a, b) => b._score - a._score || a.name.localeCompare(b.name));

  // Strip internal score and limit
  return results.slice(0, limit).map(({ _score, ...item }) => item);
}

/**
 * Get all items in a category.
 *
 * @param {string} category - Category name
 * @returns {Array} All items in that category
 */
function listCategory(category) {
  loadUserIndex();
  return fullIndex
    .filter((item) => item.category === category)
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { search, listCategory, updateIndex, loadUserIndex };
