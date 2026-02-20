/**
 * Ableton AI Producer — Node.js Backend
 *
 * Main entry point for the node.script object inside Max for Live.
 * Bridges the Claude API with Max/MSP for an AI-powered music
 * production assistant embedded in Ableton Live.
 *
 * Communication:
 *   Max -> Node: maxApi.addHandler("name", callback)
 *   Node -> Max: maxApi.outlet("name", ...args)
 */

const { createClient, sendMessage, buildSystemPrompt } = require("./claude-api");
const { tools } = require("./tools");
const library = require("./library");
const persistence = require("./persistence");

// ---------------------------------------------------------------------------
// max-api: injected by Max at runtime, gracefully absent during testing
// ---------------------------------------------------------------------------
let maxApi;
try {
  maxApi = require("max-api");
} catch {
  // Running outside Max (testing/development). Provide a stub.
  const POST_LEVELS = { ERROR: "error", WARN: "warn" };
  maxApi = {
    outlet: (...args) => console.log("[outlet]", ...args),
    addHandler: (name, fn) => console.log(`[handler registered] ${name}`),
    post: (msg, level) => {
      const prefix = level === POST_LEVELS.ERROR ? "ERROR" : "LOG";
      console.log(`[max ${prefix}] ${msg}`);
    },
    POST_LEVELS,
  };
  console.log("Running outside Max for Live — using stub max-api");
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

// Restore persisted settings on startup
const savedState = persistence.load();

/** @type {object|null} Anthropic client instance */
let client = null;

/** @type {string} Current model identifier */
let model = savedState.model;

/** @type {string} Default context depth for session state */
let contextDepth = savedState.contextDepth;

/** @type {string|null} Claude API key */
let apiKey = savedState.apiKey;

// Destructive tools that require confirmed=true
const DESTRUCTIVE_TOOLS = new Set([
  "delete_track", "delete_clip", "remove_device", "remove_notes_from_clip",
]);

/** @type {object|null} Latest Ableton session state from Max */
let sessionState = null;

/** @type {string|null} Cached session summary for token efficiency */
let sessionSummary = null;

/** @type {Array} Conversation history in Anthropic message format */
let conversationHistory = [];

/** @type {boolean} Whether a chat request is currently being processed */
let isBusy = false;

/**
 * Pending tool call resolver.
 * When Claude requests a tool call, we emit it to Max and wait for the result.
 * This stores the resolve/reject functions for the pending Promise.
 * @type {{ resolve: Function, reject: Function, toolUseId: string } | null}
 */
let pendingToolResult = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  maxApi.post(`[ableton-ai] ${msg}`);
}

function logError(msg) {
  maxApi.post(`[ableton-ai] ERROR: ${msg}`, maxApi.POST_LEVELS?.ERROR || "error");
}

/**
 * Safe JSON parse with fallback.
 * @param {string} str - JSON string
 * @param {*} fallback - Fallback value on parse failure
 * @returns {*} Parsed object or fallback
 */
function safeParse(str, fallback = null) {
  if (typeof str === "object" && str !== null) return str;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Estimate API cost based on token usage and current model.
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number} Estimated cost in USD
 */
function estimateCost(inputTokens, outputTokens) {
  const rates = {
    opus: { input: 15, output: 75 },
    sonnet: { input: 3, output: 15 },
    haiku: { input: 0.80, output: 4 },
  };
  let rate = rates.sonnet;
  const m = model.toLowerCase();
  if (m.includes("opus")) rate = rates.opus;
  else if (m.includes("haiku")) rate = rates.haiku;
  return (inputTokens * rate.input + outputTokens * rate.output) / 1000000;
}

// ---------------------------------------------------------------------------
// Handler: set_api_key
// ---------------------------------------------------------------------------
maxApi.addHandler("set_api_key", (key) => {
  if (!key || typeof key !== "string" || key.trim() === "") {
    logError("Invalid API key provided");
    maxApi.outlet("chat_error", "Invalid API key. Please provide a valid Claude API key.");
    return;
  }

  apiKey = key.trim();
  try {
    client = createClient(apiKey);
    log("API key set and client created successfully");
    persistence.save({ model, contextDepth, apiKey });
    maxApi.outlet("chat_response", "API key configured successfully.");
    maxApi.outlet("chat_done");
  } catch (err) {
    logError(`Failed to create client: ${err.message}`);
    maxApi.outlet("chat_error", `Failed to initialize Claude client: ${err.message}`);
    client = null;
    apiKey = null;
  }
});

// ---------------------------------------------------------------------------
// Handler: set_model
// ---------------------------------------------------------------------------
maxApi.addHandler("set_model", (newModel) => {
  if (!newModel || typeof newModel !== "string") {
    logError("Invalid model name");
    return;
  }
  model = newModel.trim();
  log(`Model set to: ${model}`);
  persistence.save({ model, contextDepth, apiKey });
});

// ---------------------------------------------------------------------------
// Handler: set_depth
// ---------------------------------------------------------------------------
maxApi.addHandler("set_depth", (depth) => {
  const valid = ["minimal", "standard", "detailed", "full"];
  if (!depth || !valid.includes(depth)) {
    logError(`Invalid depth: ${depth}. Use: ${valid.join(", ")}`);
    return;
  }
  contextDepth = depth;
  log(`Context depth set to: ${contextDepth}`);
  persistence.save({ model, contextDepth, apiKey });
});

// ---------------------------------------------------------------------------
// Handler: session_state
// ---------------------------------------------------------------------------
maxApi.addHandler("session_state", (stateJson) => {
  const parsed = safeParse(stateJson);
  if (!parsed) {
    logError("Failed to parse session state JSON");
    return;
  }
  sessionState = parsed;
  log(`Session state updated (${Object.keys(parsed).length} top-level keys)`);
});

// ---------------------------------------------------------------------------
// Handler: library_index (receives browser scan results from library-indexer.js)
// ---------------------------------------------------------------------------
maxApi.addHandler("library_index", (indexJson) => {
  const parsed = safeParse(indexJson);
  if (!parsed || !Array.isArray(parsed)) {
    logError("Failed to parse library index JSON");
    return;
  }
  library.updateIndex(parsed);
  log(`Library index updated with ${parsed.length} scanned items`);
});

// ---------------------------------------------------------------------------
// Handler: clear_history
// ---------------------------------------------------------------------------
maxApi.addHandler("clear_history", () => {
  conversationHistory = [];
  sessionSummary = null;
  isBusy = false;
  pendingToolResult = null;
  log("Conversation history cleared");
  maxApi.outlet("chat_response", "Conversation cleared.");
  maxApi.outlet("chat_done");
});

// ---------------------------------------------------------------------------
// Handler: action_result
// ---------------------------------------------------------------------------
maxApi.addHandler("action_result", (resultJson) => {
  const result = safeParse(resultJson);
  if (!result) {
    logError("Failed to parse action result JSON");
    // If there's a pending tool call, reject it so the conversation can continue
    if (pendingToolResult) {
      const pending = pendingToolResult;
      pendingToolResult = null;
      pending.resolve({
        tool_use_id: pending.toolUseId,
        type: "tool_result",
        content: JSON.stringify({ error: "Failed to parse action result" }),
        is_error: true,
      });
    }
    return;
  }

  if (!pendingToolResult) {
    logError("Received action_result but no tool call is pending");
    return;
  }

  const pending = pendingToolResult;
  pendingToolResult = null;

  log(`Action result received for tool_use ${pending.toolUseId}`);

  pending.resolve({
    tool_use_id: pending.toolUseId,
    type: "tool_result",
    content: JSON.stringify(result),
    is_error: !!result.error,
  });
});

// ---------------------------------------------------------------------------
// Handler: chat — Main conversation handler
// ---------------------------------------------------------------------------
maxApi.addHandler("chat", async (userMessage) => {
  // --- Guard checks ---
  if (!client || !apiKey) {
    maxApi.outlet(
      "chat_error",
      "No API key configured. Please set your Claude API key first."
    );
    return;
  }

  if (!userMessage || typeof userMessage !== "string" || userMessage.trim() === "") {
    return;
  }

  if (isBusy) {
    maxApi.outlet("chat_error", "Please wait for the current response to finish.");
    return;
  }

  isBusy = true;
  const trimmedMessage = userMessage.trim();

  try {
    // Add user message to history
    conversationHistory.push({
      role: "user",
      content: trimmedMessage,
    });

    // Build the system prompt with current session context
    const systemPrompt = buildSystemPrompt(sessionState, sessionSummary);

    // Run the conversation loop (handles tool_use -> tool_result cycles)
    await runConversationLoop(systemPrompt);

    maxApi.outlet("chat_done");
  } catch (err) {
    const errorMsg = err.message || String(err);
    logError(`Chat error: ${errorMsg}`);
    maxApi.outlet("chat_error", errorMsg);
  } finally {
    isBusy = false;
  }
});

// ---------------------------------------------------------------------------
// Conversation loop: handles streaming + tool_use cycles
// ---------------------------------------------------------------------------

/**
 * Run the conversation loop. Sends messages to Claude, streams text back,
 * and handles tool_use blocks by emitting action_requests to Max and waiting
 * for results before continuing the conversation.
 *
 * @param {string} systemPrompt - The system prompt to use
 */
async function runConversationLoop(systemPrompt) {
  const MAX_TOOL_ROUNDS = 10; // Safety limit to prevent infinite tool loops
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;

    const result = await sendMessage(client, conversationHistory, {
      model,
      systemPrompt,
      onText: (text) => {
        maxApi.outlet("chat_response", text);
      },
      onUsage: ({ inputTokens, outputTokens }) => {
        const cost = estimateCost(inputTokens, outputTokens);
        maxApi.outlet("token_usage", inputTokens, outputTokens, cost);
      },
      onError: (errorInfo) => {
        logError(`API error: ${errorInfo.message}`);
      },
    });

    // Build the assistant message content from the response
    const assistantContent = [];

    if (result.fullText) {
      assistantContent.push({
        type: "text",
        text: result.fullText,
      });
    }

    for (const toolUse of result.toolUses) {
      assistantContent.push({
        type: "tool_use",
        id: toolUse.id,
        name: toolUse.name,
        input: toolUse.input,
      });
    }

    // Add assistant response to history
    conversationHistory.push({
      role: "assistant",
      content: assistantContent,
    });

    // If no tool calls, we're done
    if (result.stopReason !== "tool_use" || result.toolUses.length === 0) {
      break;
    }

    // Process tool calls sequentially
    const toolResults = [];
    for (const toolUse of result.toolUses) {
      log(`Tool call: ${toolUse.name}(${JSON.stringify(toolUse.input)})`);

      let toolResult;

      // Gate destructive tools — require confirmed=true
      if (DESTRUCTIVE_TOOLS.has(toolUse.name) && !toolUse.input?.confirmed) {
        toolResult = {
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            error: "Destructive action blocked: you must ask the user for confirmation first, then call this tool again with confirmed: true.",
          }),
          is_error: true,
        };
        toolResults.push(toolResult);
        continue;
      }

      // Handle tools that can be resolved locally (no Max round-trip)
      if (toolUse.name === "get_session_state") {
        toolResult = await handleGetSessionState(toolUse);
      } else if (toolUse.name === "search_library") {
        toolResult = handleSearchLibrary(toolUse);
      } else {
        // Emit action request to Max and wait for result
        toolResult = await requestAction(toolUse);
      }

      toolResults.push(toolResult);
    }

    // Add all tool results to history
    conversationHistory.push({
      role: "user",
      content: toolResults,
    });

    // Loop continues — Claude will process the tool results and respond
  }

  if (round >= MAX_TOOL_ROUNDS) {
    logError("Tool call loop hit safety limit");
    maxApi.outlet(
      "chat_response",
      "\n\n[Stopped: too many consecutive tool calls. Please continue the conversation.]"
    );
  }
}

/**
 * Handle the get_session_state tool call locally (no need to round-trip to Max).
 *
 * @param {object} toolUse - The tool_use block from Claude
 * @returns {object} Tool result message
 */
async function handleGetSessionState(toolUse) {
  // If session state is available, return it. Otherwise request it from Max.
  if (sessionState) {
    const depth = toolUse.input?.depth || contextDepth;
    const trackFilter = toolUse.input?.track_filter || null;
    const filtered = filterSessionState(sessionState, depth, trackFilter);

    return {
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: JSON.stringify(filtered),
    };
  }

  // Request fresh state from Max
  maxApi.outlet("action_request", "get_session_state", JSON.stringify(toolUse.input || {}));
  return waitForActionResult(toolUse.id);
}

/**
 * Handle the search_library tool call locally using the built-in index.
 *
 * @param {object} toolUse - The tool_use block from Claude
 * @returns {object} Tool result message
 */
function handleSearchLibrary(toolUse) {
  const query = toolUse.input?.query || "";
  const category = toolUse.input?.category || "all";
  const results = library.search(query, category);

  return {
    type: "tool_result",
    tool_use_id: toolUse.id,
    content: JSON.stringify({
      status: "ok",
      query,
      category,
      results_count: results.length,
      results,
      note: results.length === 0
        ? "No matches found. Try broader terms or a different category."
        : "Use load_instrument or load_effect with the item name to load onto a track.",
    }),
  };
}

/**
 * Filter session state based on requested depth and track filter.
 *
 * @param {object} state - Full session state
 * @param {string} depth - "minimal" | "standard" | "detailed" | "full"
 * @param {Array|null} trackFilter - Array of track indices to include, or null for all
 * @returns {object} Filtered state
 */
function filterSessionState(state, depth, trackFilter) {
  // If state is not an object or has no tracks, return as-is
  if (!state || typeof state !== "object") return state;

  const result = { ...state };

  // Filter tracks if requested
  if (trackFilter && Array.isArray(trackFilter) && Array.isArray(result.tracks)) {
    result.tracks = result.tracks.filter((_, i) => trackFilter.includes(i));
  }

  // Apply depth filtering to tracks
  if (Array.isArray(result.tracks)) {
    result.tracks = result.tracks.map((track) => filterTrackByDepth(track, depth));
  }

  return result;
}

/**
 * Filter a single track object by depth level.
 *
 * @param {object} track - Track data
 * @param {string} depth - Depth level
 * @returns {object} Filtered track
 */
function filterTrackByDepth(track, depth) {
  if (!track || typeof track !== "object") return track;

  switch (depth) {
    case "minimal":
      return {
        index: track.index,
        name: track.name,
        type: track.type,
        mute: track.mute,
        solo: track.solo,
        arm: track.arm,
      };

    case "standard":
      return {
        ...track,
        devices: Array.isArray(track.devices)
          ? track.devices.map((d) => ({
              index: d.index,
              name: d.name,
              type: d.type,
              class_name: d.class_name,
            }))
          : track.devices,
        clips: Array.isArray(track.clips)
          ? track.clips.map((c) => ({
              index: c.index,
              name: c.name,
              length: c.length,
              is_playing: c.is_playing,
            }))
          : track.clips,
      };

    case "detailed":
      // Include device parameters but not clip note data
      return {
        ...track,
        clips: Array.isArray(track.clips)
          ? track.clips.map((c) => {
              const { notes, ...rest } = c || {};
              return rest;
            })
          : track.clips,
      };

    case "full":
    default:
      return track;
  }
}

/**
 * Request an action from Max by emitting an action_request outlet,
 * then waiting for the action_result handler to be called.
 *
 * @param {object} toolUse - The tool_use block from Claude
 * @returns {Promise<object>} Tool result message
 */
function requestAction(toolUse) {
  const paramsJson = JSON.stringify(toolUse.input || {});

  // Emit the action request to Max
  maxApi.outlet("action_request", toolUse.name, paramsJson);

  return waitForActionResult(toolUse.id);
}

/**
 * Wait for an action result from Max, with a timeout.
 *
 * @param {string} toolUseId - The tool_use ID to match
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns {Promise<object>} Tool result message
 */
function waitForActionResult(toolUseId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    // Set up timeout
    const timer = setTimeout(() => {
      if (pendingToolResult && pendingToolResult.toolUseId === toolUseId) {
        pendingToolResult = null;
        resolve({
          type: "tool_result",
          tool_use_id: toolUseId,
          content: JSON.stringify({
            error: "Action timed out waiting for Ableton to respond",
          }),
          is_error: true,
        });
      }
    }, timeoutMs);

    // Store the resolver so action_result handler can call it
    pendingToolResult = {
      toolUseId,
      resolve: (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

// Restore API client from saved key if available
if (apiKey) {
  try {
    client = createClient(apiKey);
    log("Restored API client from saved settings");
  } catch (err) {
    logError(`Failed to restore API client: ${err.message}`);
    apiKey = null;
    client = null;
  }
}

log("Ableton AI backend loaded and ready");
log(`Default model: ${model}`);
log(`Tools available: ${tools.length}`);
