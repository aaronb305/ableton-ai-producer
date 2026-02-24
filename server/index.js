/**
 * Ableton AI Producer — Backend Server
 *
 * Express server with Vercel AI SDK for multi-provider AI support.
 * Runs as a separate process spawned by node.script in Max.
 *
 * Communication:
 *   jweb → HTTP/SSE → this server (chat, settings, library)
 *   this server → SSE → node.script (action requests)
 *   node.script → HTTP → this server (action results, session state)
 */

const path = require("path");
const express = require("express");
const cors = require("cors");
const { streamText } = require("ai");

const { tools, DESTRUCTIVE_TOOLS } = require("./tools");
const library = require("./library");
const persistence = require("./persistence");
const conversation = require("./conversation");
const aiProvider = require("./ai-provider");

const PORT = process.env.PORT || 9320;
const MAX_TOOL_ROUNDS = 10;

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Serve the UI files (jweb loads from here to avoid M4L path issues)
app.use(express.static(path.join(__dirname, "..", "ui")));

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const savedState = persistence.load();
let currentModel = savedState.model;
let contextDepth = savedState.contextDepth;

// Restore provider configurations from saved API keys
if (savedState.apiKeys) {
  for (const [provider, key] of Object.entries(savedState.apiKeys)) {
    if (key) aiProvider.configureProvider(provider, key);
  }
}
// Ollama is always available (local, no API key needed)
aiProvider.configureProvider("ollama");
aiProvider.setActiveProvider(savedState.provider || "anthropic");

// SSE clients waiting for action requests (node.script connects here)
let actionStreamClients = [];

// Pending action results: toolUseId → { resolve, reject, timer }
const pendingActions = new Map();

// Whether a chat request is in progress
let isBusy = false;

// ---------------------------------------------------------------------------
// Helper: send SSE event
// ---------------------------------------------------------------------------

function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", port: PORT });
});

// ---------------------------------------------------------------------------
// GET /api/settings
// ---------------------------------------------------------------------------

app.get("/api/settings", (_req, res) => {
  res.json({
    provider: aiProvider.getActiveProviderName(),
    model: currentModel,
    contextDepth,
    hasApiKey: aiProvider.isConfigured(),
  });
});

// ---------------------------------------------------------------------------
// PUT /api/settings
// ---------------------------------------------------------------------------

app.put("/api/settings", (req, res) => {
  const { provider, model, apiKey, contextDepth: depth } = req.body;

  if (provider) {
    aiProvider.setActiveProvider(provider);
  }

  if (model) {
    currentModel = model;
  }

  if (depth && ["minimal", "standard", "detailed", "full"].includes(depth)) {
    contextDepth = depth;
  }

  if (apiKey) {
    const providerName = provider || aiProvider.getActiveProviderName();
    aiProvider.configureProvider(providerName, apiKey);
    // Save key for this provider
    savedState.apiKeys = savedState.apiKeys || {};
    savedState.apiKeys[providerName] = apiKey;
  }

  // Persist
  persistence.save({
    provider: aiProvider.getActiveProviderName(),
    model: currentModel,
    contextDepth,
    apiKeys: savedState.apiKeys || {},
  });

  res.json({
    status: "ok",
    provider: aiProvider.getActiveProviderName(),
    model: currentModel,
    contextDepth,
    hasApiKey: aiProvider.isConfigured(),
  });
});

// ---------------------------------------------------------------------------
// POST /api/chat — SSE streaming chat
// ---------------------------------------------------------------------------

app.post("/api/chat", async (req, res) => {
  if (!aiProvider.isConfigured()) {
    return res.status(400).json({
      error: "No API key configured. Set your API key in Settings first.",
    });
  }

  const { message } = req.body;
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Empty message" });
  }

  if (isBusy) {
    return res
      .status(429)
      .json({ error: "Please wait for the current response to finish." });
  }

  isBusy = true;

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    // Add user message
    conversation.addMessage({ role: "user", content: message.trim() });

    const systemPrompt = conversation.buildSystemPrompt();

    await runConversationLoop(res, systemPrompt);

    sendSSE(res, "done", {});
  } catch (err) {
    const errorMsg = err.message || String(err);
    console.error("[chat error]", errorMsg);
    sendSSE(res, "error", { message: errorMsg });
  } finally {
    isBusy = false;
    res.end();
  }
});

// ---------------------------------------------------------------------------
// Conversation loop: streaming + tool-use cycles
// ---------------------------------------------------------------------------

async function runConversationLoop(res, systemPrompt) {
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;

    const model = aiProvider.getModel(currentModel);
    const messages = conversation.getMessages();

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      maxTokens: 4096,
      temperature: 0.7,
      maxSteps: 1, // we handle multi-step ourselves for action relay
    });

    let fullText = "";

    // Stream text chunks to client
    for await (const chunk of result.textStream) {
      fullText += chunk;
      sendSSE(res, "text", { text: chunk });
    }

    // Get final values from the stream result
    const [toolCalls, usage] = await Promise.all([
      result.toolCalls,
      result.usage,
    ]);

    // Report token usage
    if (usage) {
      const cost = aiProvider.estimateCost(
        currentModel,
        usage.promptTokens || 0,
        usage.completionTokens || 0
      );
      sendSSE(res, "token_usage", {
        input: usage.promptTokens || 0,
        output: usage.completionTokens || 0,
        cost,
      });
    }

    // Build assistant message content
    const assistantContent = [];
    if (fullText) {
      assistantContent.push({ type: "text", text: fullText });
    }

    // Check for tool calls
    const resolvedToolCalls = toolCalls || [];
    for (const tc of resolvedToolCalls) {
      assistantContent.push({
        type: "tool-call",
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: tc.args,
      });
    }

    // Add assistant message to history
    conversation.addMessage({ role: "assistant", content: assistantContent });

    // If no tool calls, we're done
    if (resolvedToolCalls.length === 0) {
      break;
    }

    // Process tool calls
    const toolResults = [];
    for (const tc of resolvedToolCalls) {
      sendSSE(res, "tool_use", { name: tc.toolName, input: tc.args });

      let toolResult;

      // Gate destructive tools
      if (DESTRUCTIVE_TOOLS.has(tc.toolName) && !tc.args?.confirmed) {
        toolResult = {
          type: "tool-result",
          toolCallId: tc.toolCallId,
          result: JSON.stringify({
            error:
              "Destructive action blocked: you must ask the user for confirmation first, then call this tool again with confirmed: true.",
          }),
          isError: true,
        };
      } else if (tc.toolName === "get_session_state") {
        // Handle locally — return cached session state
        const state = conversation.getSessionState();
        toolResult = {
          type: "tool-result",
          toolCallId: tc.toolCallId,
          result: JSON.stringify(
            state || { error: "No session state available yet" }
          ),
        };
      } else if (tc.toolName === "search_library") {
        // Handle locally
        const results = library.search(
          tc.args?.query || "",
          tc.args?.category || "all"
        );
        toolResult = {
          type: "tool-result",
          toolCallId: tc.toolCallId,
          result: JSON.stringify({
            status: "ok",
            query: tc.args?.query,
            category: tc.args?.category || "all",
            results_count: results.length,
            results,
            note:
              results.length === 0
                ? "No matches found. Try broader terms or a different category."
                : "Use load_instrument or load_effect with the item name to load onto a track.",
          }),
        };
      } else {
        // Dispatch to Max via action-stream SSE
        toolResult = await dispatchAction(tc);
      }

      // Send result back to UI
      sendSSE(res, "action_result", {
        tool: tc.toolName,
        result: JSON.parse(
          typeof toolResult.result === "string"
            ? toolResult.result
            : JSON.stringify(toolResult.result)
        ),
      });

      toolResults.push(toolResult);
    }

    // Add tool results to conversation
    conversation.addMessage({ role: "tool", content: toolResults });
  }

  if (round >= MAX_TOOL_ROUNDS) {
    sendSSE(res, "text", {
      text: "\n\n[Stopped: too many consecutive tool calls. Please continue the conversation.]",
    });
  }
}

// ---------------------------------------------------------------------------
// Action dispatch: send tool call to node.script via SSE, wait for result
// ---------------------------------------------------------------------------

function dispatchAction(toolCall) {
  return new Promise((resolve) => {
    const actionId = toolCall.toolCallId;

    // Timeout after 30s
    const timer = setTimeout(() => {
      pendingActions.delete(actionId);
      resolve({
        type: "tool-result",
        toolCallId: actionId,
        result: JSON.stringify({
          error: "Action timed out waiting for Ableton to respond",
        }),
        isError: true,
      });
    }, 30000);

    pendingActions.set(actionId, { resolve, timer });

    // Push action to all connected node.script SSE clients
    const actionData = {
      id: actionId,
      tool: toolCall.toolName,
      params: toolCall.args,
    };

    for (const client of actionStreamClients) {
      try {
        client.write(
          `event: action_request\ndata: ${JSON.stringify(actionData)}\n\n`
        );
      } catch {
        // Client disconnected — will be cleaned up
      }
    }
  });
}

// ---------------------------------------------------------------------------
// GET /api/action-stream — SSE for node.script to receive action requests
// ---------------------------------------------------------------------------

app.get("/api/action-stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send initial heartbeat
  res.write(`event: connected\ndata: {}\n\n`);

  actionStreamClients.push(res);
  console.log(
    `[action-stream] node.script connected (${actionStreamClients.length} clients)`
  );

  req.on("close", () => {
    actionStreamClients = actionStreamClients.filter((c) => c !== res);
    console.log(
      `[action-stream] node.script disconnected (${actionStreamClients.length} clients)`
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/action-result — node.script sends action results here
// ---------------------------------------------------------------------------

app.post("/api/action-result", (req, res) => {
  const { id, result, error } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Missing action id" });
  }

  const pending = pendingActions.get(id);
  if (!pending) {
    return res.status(404).json({ error: "No pending action with that id" });
  }

  clearTimeout(pending.timer);
  pendingActions.delete(id);

  pending.resolve({
    type: "tool-result",
    toolCallId: id,
    result: JSON.stringify(error ? { error } : result || { status: "ok" }),
    isError: !!error,
  });

  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// POST /api/session-state — node.script forwards session state
// ---------------------------------------------------------------------------

app.post("/api/session-state", (req, res) => {
  const { state } = req.body;
  if (state) {
    conversation.setSessionState(state);
    console.log("[session-state] Updated");
  }
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// POST /api/audio-analysis — node.script forwards audio analysis
// ---------------------------------------------------------------------------

app.post("/api/audio-analysis", (req, res) => {
  const { analysis } = req.body;
  if (analysis) {
    conversation.setAudioAnalysis(analysis);
  }
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// POST /api/library-index — node.script forwards library scan results
// ---------------------------------------------------------------------------

app.post("/api/library-index", (req, res) => {
  const { items } = req.body;
  if (items && Array.isArray(items)) {
    library.updateIndex(items);
    console.log(`[library-index] Updated with ${items.length} items`);
  }
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// GET /api/library/search — search sound library
// ---------------------------------------------------------------------------

app.get("/api/library/search", (req, res) => {
  const query = req.query.q || "";
  const category = req.query.category || "all";
  const limit = parseInt(req.query.limit, 10) || 15;

  const results = library.search(query, category, limit);
  res.json({ results, query, category, count: results.length });
});

// ---------------------------------------------------------------------------
// GET /api/cost-estimate — estimate cost for current conversation
// ---------------------------------------------------------------------------

app.get("/api/cost-estimate", (_req, res) => {
  const estimatedTokens = conversation.estimateTokenCount();
  const cost = aiProvider.estimateCost(currentModel, estimatedTokens, 500);
  res.json({
    estimatedInputTokens: estimatedTokens,
    estimatedOutputTokens: 500,
    estimatedCost: cost,
    model: currentModel,
  });
});

// ---------------------------------------------------------------------------
// POST /api/clear — clear conversation history
// ---------------------------------------------------------------------------

app.post("/api/clear", (_req, res) => {
  conversation.clear();
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[ableton-ai-server] Running on http://127.0.0.1:${PORT}`);
  console.log(
    `[ableton-ai-server] Provider: ${aiProvider.getActiveProviderName()}, Model: ${currentModel}`
  );
});
