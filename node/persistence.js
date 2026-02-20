/**
 * State persistence module.
 *
 * Saves and restores user settings (API key, model, context depth)
 * to a local JSON file so they survive Ableton save/load and restarts.
 */

const fs = require("fs");
const path = require("path");

const STATE_PATH = path.join(__dirname, "..", ".ableton-ai-state.json");

const DEFAULTS = {
  model: "claude-sonnet-4-6",
  contextDepth: "standard",
  apiKey: null,
};

/**
 * Load saved state from disk. Returns defaults if no file exists.
 * @returns {object} Saved state merged with defaults
 */
function load() {
  try {
    if (!fs.existsSync(STATE_PATH)) return { ...DEFAULTS };
    const raw = fs.readFileSync(STATE_PATH, "utf-8");
    const saved = JSON.parse(raw);
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Save current state to disk.
 * @param {object} state - State to persist
 */
function save(state) {
  try {
    const toSave = {
      model: state.model || DEFAULTS.model,
      contextDepth: state.contextDepth || DEFAULTS.contextDepth,
      apiKey: state.apiKey || null,
    };
    fs.writeFileSync(STATE_PATH, JSON.stringify(toSave, null, 2), "utf-8");
  } catch {
    // Non-fatal — settings will just need to be re-entered
  }
}

module.exports = { load, save, DEFAULTS };
