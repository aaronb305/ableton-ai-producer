/**
 * Claude API client module for the Ableton AI Assistant.
 *
 * Handles Anthropic SDK client creation, message sending with streaming,
 * tool-use response handling, and system prompt construction.
 */

const { tools } = require("./tools");

// Lazy-loaded Anthropic SDK reference
let Anthropic = null;

/**
 * Load the Anthropic SDK. Separated for clearer error handling.
 * @returns {Function} The Anthropic constructor
 */
function loadSDK() {
  if (!Anthropic) {
    try {
      Anthropic = require("@anthropic-ai/sdk").default || require("@anthropic-ai/sdk");
    } catch (err) {
      throw new Error(
        "Failed to load @anthropic-ai/sdk. Run 'npm install' in the node directory. " +
          err.message
      );
    }
  }
  return Anthropic;
}

/**
 * Create an Anthropic client instance.
 * @param {string} apiKey - The Claude API key
 * @returns {object} Anthropic client instance
 */
function createClient(apiKey) {
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error("A valid API key is required");
  }
  const SDK = loadSDK();
  return new SDK({ apiKey: apiKey.trim() });
}

/**
 * Build the system prompt from session context.
 *
 * @param {object|null} sessionState - Current Ableton session state (JSON)
 * @param {string|null} sessionSummary - Cached session summary from a previous analysis
 * @returns {string} The complete system prompt
 */
function buildSystemPrompt(sessionState, sessionSummary) {
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
    `- Always confirm destructive actions (deleting tracks/clips) before executing.\n` +
    `- If you need current session information, use the get_session_state tool.\n` +
    `- Reference specific tracks by name and index for clarity.\n` +
    `- Use music theory terminology appropriate for the user's apparent skill level.\n` +
    `- When writing MIDI notes, remember: middle C = 60, each semitone = 1, each octave = 12.`
  );

  if (sessionSummary) {
    parts.push(`\nSession Summary (cached):\n${sessionSummary}`);
  }

  if (sessionState) {
    parts.push(`\nCurrent Session State:\n${formatSessionState(sessionState)}`);
  }

  return parts.join("\n");
}

/**
 * Format session state for inclusion in the system prompt.
 * Handles different depths of detail by simply stringifying the object
 * with reasonable formatting.
 *
 * @param {object} state - The session state object
 * @returns {string} Formatted string representation
 */
function formatSessionState(state) {
  if (typeof state === "string") {
    try {
      state = JSON.parse(state);
    } catch {
      return state;
    }
  }
  return JSON.stringify(state, null, 2);
}

/**
 * Send a message to Claude with streaming support.
 *
 * @param {object} client - Anthropic client instance
 * @param {Array} messages - Conversation history (Anthropic message format)
 * @param {object} options - Additional options
 * @param {string} options.model - Model to use (default: claude-sonnet-4-6)
 * @param {number} options.maxTokens - Max tokens in response (default: 4096)
 * @param {number} options.temperature - Temperature (default: 0.7)
 * @param {string} options.systemPrompt - System prompt
 * @param {Function} options.onText - Callback for streamed text chunks: (text) => void
 * @param {Function} options.onToolUse - Callback for tool use blocks: (toolUse) => void
 * @param {Function} options.onUsage - Callback for token usage: ({inputTokens, outputTokens}) => void
 * @param {Function} options.onError - Callback for errors: (error) => void
 * @returns {Promise<{response: object, toolUses: Array, stopReason: string}>}
 */
async function sendMessage(client, messages, options = {}) {
  const {
    model = "claude-sonnet-4-6",
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt = "",
    onText = () => {},
    onToolUse = () => {},
    onUsage = () => {},
    onError = () => {},
  } = options;

  const toolUses = [];
  let fullText = "";
  let stopReason = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages,
      tools,
    });

    // Handle streamed events
    stream.on("text", (text) => {
      fullText += text;
      onText(text);
    });

    stream.on("contentBlock", (block) => {
      if (block.type === "tool_use") {
        toolUses.push({
          id: block.id,
          name: block.name,
          input: block.input,
        });
        onToolUse(block);
      }
    });

    // Wait for the stream to complete and get the final message
    const finalMessage = await stream.finalMessage();

    stopReason = finalMessage.stop_reason || "";
    inputTokens = finalMessage.usage?.input_tokens || 0;
    outputTokens = finalMessage.usage?.output_tokens || 0;

    onUsage({ inputTokens, outputTokens });

    return {
      response: finalMessage,
      toolUses,
      stopReason,
      fullText,
      usage: { inputTokens, outputTokens },
    };
  } catch (err) {
    // Classify errors for the caller
    const errorInfo = classifyError(err);
    onError(errorInfo);
    throw errorInfo;
  }
}

/**
 * Classify an API error into a user-friendly message with retry guidance.
 *
 * @param {Error} err - The raw error
 * @returns {object} Classified error with message and retryable flag
 */
function classifyError(err) {
  const status = err.status || err.statusCode || 0;
  const message = err.message || String(err);

  if (status === 401) {
    return {
      code: "auth_error",
      message: "Invalid API key. Please check your Claude API key and try again.",
      retryable: false,
      original: err,
    };
  }
  if (status === 429) {
    return {
      code: "rate_limit",
      message: "Rate limited by Claude API. Please wait a moment and try again.",
      retryable: true,
      original: err,
    };
  }
  if (status === 529 || status === 503) {
    return {
      code: "overloaded",
      message: "Claude API is temporarily overloaded. Please try again in a few seconds.",
      retryable: true,
      original: err,
    };
  }
  if (status >= 500) {
    return {
      code: "server_error",
      message: "Claude API server error. Please try again.",
      retryable: true,
      original: err,
    };
  }
  if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
    return {
      code: "network_error",
      message: "Cannot reach Claude API. Check your internet connection.",
      retryable: true,
      original: err,
    };
  }

  return {
    code: "unknown_error",
    message: `Claude API error: ${message}`,
    retryable: false,
    original: err,
  };
}

module.exports = {
  createClient,
  sendMessage,
  buildSystemPrompt,
  classifyError,
  formatSessionState,
};
