/**
 * State persistence module — extended for multi-provider support.
 *
 * Saves and restores user settings (provider, model, API keys, context depth)
 * to a local JSON file so they survive Ableton save/load and restarts.
 */

const fs = require("fs");
const path = require("path");

const STATE_PATH = path.join(__dirname, "..", ".ableton-ai-state.json");

const DEFAULTS = {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  contextDepth: "standard",
  apiKeys: {},
};

/**
 * Load saved state from disk. Returns defaults if no file exists.
 * Handles migration from old format (single apiKey → apiKeys map).
 * @returns {object} Saved state merged with defaults
 */
function load() {
  try {
    if (!fs.existsSync(STATE_PATH)) return { ...DEFAULTS, apiKeys: {} };
    const raw = fs.readFileSync(STATE_PATH, "utf-8");
    const saved = JSON.parse(raw);

    // Migrate from old single-key format
    if (saved.apiKey && !saved.apiKeys) {
      saved.apiKeys = { anthropic: saved.apiKey };
      delete saved.apiKey;
    }

    return { ...DEFAULTS, ...saved, apiKeys: { ...saved.apiKeys } };
  } catch {
    return { ...DEFAULTS, apiKeys: {} };
  }
}

/**
 * Save current state to disk.
 * @param {object} state - State to persist
 */
function save(state) {
  try {
    const toSave = {
      provider: state.provider || DEFAULTS.provider,
      model: state.model || DEFAULTS.model,
      contextDepth: state.contextDepth || DEFAULTS.contextDepth,
      apiKeys: state.apiKeys || {},
    };
    fs.writeFileSync(STATE_PATH, JSON.stringify(toSave, null, 2), "utf-8");
  } catch {
    // Non-fatal — settings will just need to be re-entered
  }
}

module.exports = { load, save, DEFAULTS };
