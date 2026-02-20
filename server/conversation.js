/**
 * Conversation history management and system prompt builder.
 *
 * Manages the message history for the AI conversation,
 * builds context-aware system prompts including session state
 * and audio analysis data.
 */

/** @type {Array} Conversation messages in Vercel AI SDK format */
let messages = [];

/** @type {object|null} Latest Ableton session state */
let sessionState = null;

/** @type {object|null} Latest audio analysis data */
let audioAnalysis = null;

/**
 * Add a message to conversation history.
 * @param {object} message - { role, content, ... }
 */
function addMessage(message) {
  messages.push(message);
}

/**
 * Get all messages.
 * @returns {Array}
 */
function getMessages() {
  return messages;
}

/**
 * Clear conversation history.
 */
function clear() {
  messages = [];
}

/**
 * Update the cached session state.
 * @param {object} state
 */
function setSessionState(state) {
  sessionState = state;
}

/**
 * Get the cached session state.
 * @returns {object|null}
 */
function getSessionState() {
  return sessionState;
}

/**
 * Update the cached audio analysis.
 * @param {object} analysis
 */
function setAudioAnalysis(analysis) {
  audioAnalysis = analysis;
}

/**
 * Get the cached audio analysis.
 * @returns {object|null}
 */
function getAudioAnalysis() {
  return audioAnalysis;
}

/**
 * Build the system prompt with current context.
 * @returns {string}
 */
function buildSystemPrompt() {
  const parts = [];

  parts.push(
    `You are an AI music production assistant embedded inside Ableton Live as a Max for Live device. ` +
      `You have direct access to the user's session and can both analyze it and make changes through tool calls.`
  );

  parts.push(
    `\nYour capabilities:\n` +
      `- Read the current session state (tracks, devices, clips, parameters, tempo, time signature)\n` +
      `- Create and manage tracks (MIDI and audio)\n` +
      `- Load instruments, effects, and presets from Ableton's built-in library\n` +
      `- Set device parameters (every knob on every device)\n` +
      `- Create MIDI clips and add/remove notes\n` +
      `- Control transport (play, stop, tempo, time signature)\n` +
      `- Launch and stop clips and scenes in Session View\n` +
      `- Search Ableton's sound library for instruments, presets, and samples\n` +
      `- Manage sends/returns for effect routing`
  );

  parts.push(
    `\nGuidelines:\n` +
      `- Be concise but informative. Producers value efficiency.\n` +
      `- When suggesting sounds or presets, prefer Ableton's built-in content first.\n` +
      `- Explain your reasoning when making production suggestions.\n` +
      `- When creating MIDI content, use musically appropriate values (correct scales, rhythms, velocities).\n` +
      `- If you need current session information, use the get_session_state tool.\n` +
      `- Reference specific tracks by name and index for clarity.\n` +
      `- Use music theory terminology appropriate for the user's apparent skill level.\n` +
      `- When writing MIDI notes, remember: middle C = 60, each semitone = 1, each octave = 12.`
  );

  parts.push(
    `\nDestructive action safety:\n` +
      `Tools marked DESTRUCTIVE (delete_track, delete_clip, remove_device, remove_notes_from_clip) ` +
      `require a "confirmed" parameter set to true. You MUST:\n` +
      `1. Tell the user exactly what will be deleted (track name, clip name, device name, etc.).\n` +
      `2. Wait for the user to explicitly confirm (e.g., "yes", "go ahead", "do it").\n` +
      `3. Only then call the tool with confirmed: true.\n` +
      `Never set confirmed: true without explicit user approval in the current conversation.`
  );

  if (audioAnalysis) {
    parts.push(
      `\nReal-time Audio Analysis:\n${JSON.stringify(audioAnalysis, null, 2)}`
    );
  }

  if (sessionState) {
    parts.push(
      `\nCurrent Session State:\n${JSON.stringify(sessionState, null, 2)}`
    );
  }

  return parts.join("\n");
}

/**
 * Estimate the token count for the current conversation.
 * Rough approximation: ~4 chars per token.
 * @returns {number}
 */
function estimateTokenCount() {
  const systemLen = buildSystemPrompt().length;
  const messagesLen = messages.reduce((sum, m) => {
    if (typeof m.content === "string") return sum + m.content.length;
    if (Array.isArray(m.content)) {
      return (
        sum +
        m.content.reduce((s, part) => {
          if (typeof part === "string") return s + part.length;
          if (part.text) return s + part.text.length;
          return s + JSON.stringify(part).length;
        }, 0)
      );
    }
    return sum + JSON.stringify(m.content).length;
  }, 0);

  return Math.ceil((systemLen + messagesLen) / 4);
}

module.exports = {
  addMessage,
  getMessages,
  clear,
  setSessionState,
  getSessionState,
  setAudioAnalysis,
  getAudioAnalysis,
  buildSystemPrompt,
  estimateTokenCount,
};
