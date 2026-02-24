/**
 * Ableton AI Producer — Node.js Bridge (Thin)
 *
 * Runs inside Max's node.script object. Responsibilities:
 * 1. Spawn the backend server (server/index.js) as a child process
 * 2. Connect to the server's action-stream SSE to receive action requests
 * 3. Forward action requests to Max → action-executor.js → return results
 * 4. Forward session_state, audio_analysis, library_index from Max to server
 * 5. Kill server process on unload
 */

const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

// ---------------------------------------------------------------------------
// max-api: injected by Max at runtime, gracefully absent during testing
// ---------------------------------------------------------------------------
let maxApi;
try {
  maxApi = require("max-api");
} catch {
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
// Config
// ---------------------------------------------------------------------------

const SERVER_DIR = path.join(__dirname, "..", "server");
const SERVER_SCRIPT = path.join(SERVER_DIR, "index.js");
const SERVER_PORT = 9320;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const HEALTH_CHECK_INTERVAL = 500;
const HEALTH_CHECK_TIMEOUT = 15000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let serverProcess = null;
let sseConnection = null;

// Pending action results: actionId → resolve function
const pendingActions = new Map();

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
 * Make an HTTP request (simple helper for Node 16 compat — no fetch).
 */
function httpRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: SERVER_PORT,
      path: urlPath,
      method,
      headers: { "Content-Type": "application/json" },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

function startServer() {
  if (serverProcess) {
    log("Server already running");
    return;
  }

  log("Starting backend server...");

  serverProcess = spawn("node", [SERVER_SCRIPT], {
    cwd: SERVER_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(SERVER_PORT) },
  });

  serverProcess.stdout.on("data", (data) => {
    log(`[server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on("data", (data) => {
    logError(`[server] ${data.toString().trim()}`);
  });

  serverProcess.on("exit", (code) => {
    log(`Server exited with code ${code}`);
    serverProcess = null;
    sseConnection = null;
  });

  serverProcess.on("error", (err) => {
    logError(`Server spawn error: ${err.message}`);
    serverProcess = null;
  });

  // Wait for health check, then connect SSE
  waitForHealth()
    .then(() => {
      log("Server is healthy, connecting action stream...");
      connectActionStream();
      // Tell Max to load the UI in jweb (served from Express)
      maxApi.outlet("jweb_url", `http://localhost:${SERVER_PORT}`);
    })
    .catch((err) => {
      logError(`Server health check failed: ${err.message}`);
    });
}

function stopServer() {
  if (sseConnection) {
    sseConnection.destroy();
    sseConnection = null;
  }
  if (serverProcess) {
    log("Stopping server...");
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}

function waitForHealth() {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function check() {
      if (Date.now() - start > HEALTH_CHECK_TIMEOUT) {
        return reject(new Error("Health check timeout"));
      }

      const req = http.get(`${SERVER_URL}/api/health`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.status === "ok") return resolve();
          } catch {}
          setTimeout(check, HEALTH_CHECK_INTERVAL);
        });
      });

      req.on("error", () => {
        setTimeout(check, HEALTH_CHECK_INTERVAL);
      });

      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(check, HEALTH_CHECK_INTERVAL);
      });
    }

    check();
  });
}

// ---------------------------------------------------------------------------
// SSE connection to action-stream
// ---------------------------------------------------------------------------

function connectActionStream() {
  const req = http.get(`${SERVER_URL}/api/action-stream`, (res) => {
    sseConnection = res;
    log("Connected to action stream");

    let buffer = "";

    res.on("data", (chunk) => {
      buffer += chunk.toString();

      // Parse SSE events from buffer
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line in buffer

      let currentEvent = "";
      let currentData = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          currentData = line.slice(6).trim();
        } else if (line === "" && currentEvent && currentData) {
          handleSSEEvent(currentEvent, currentData);
          currentEvent = "";
          currentData = "";
        }
      }
    });

    res.on("end", () => {
      log("Action stream disconnected, reconnecting in 2s...");
      sseConnection = null;
      setTimeout(connectActionStream, 2000);
    });

    res.on("error", (err) => {
      logError(`Action stream error: ${err.message}`);
      sseConnection = null;
      setTimeout(connectActionStream, 2000);
    });
  });

  req.on("error", (err) => {
    logError(`Action stream connection error: ${err.message}`);
    setTimeout(connectActionStream, 2000);
  });
}

function handleSSEEvent(event, data) {
  if (event === "action_request") {
    const action = safeParse(data);
    if (!action || !action.id || !action.tool) return;

    log(`Action request: ${action.tool}(${JSON.stringify(action.params)})`);

    // Store the action ID so we can match the result
    pendingActions.set("current", action.id);

    // Emit to Max → action-executor.js
    maxApi.outlet(
      "action_request",
      action.tool,
      JSON.stringify(action.params || {})
    );
  }
}

// ---------------------------------------------------------------------------
// Max handlers
// ---------------------------------------------------------------------------

// Action result from action-executor.js
maxApi.addHandler("action_result", (resultJson) => {
  const result = safeParse(resultJson);
  if (!result) {
    logError("Failed to parse action result JSON");
    return;
  }

  const actionId = pendingActions.get("current");
  if (!actionId) {
    logError("Received action_result but no action is pending");
    return;
  }
  pendingActions.delete("current");

  log(`Action result received, posting to server (id: ${actionId})`);

  httpRequest("POST", "/api/action-result", {
    id: actionId,
    result,
  }).catch((err) => {
    logError(`Failed to post action result: ${err.message}`);
  });
});

// Session state from session-reader.js
maxApi.addHandler("session_state", (stateJson) => {
  const parsed = safeParse(stateJson);
  if (!parsed) {
    logError("Failed to parse session state JSON");
    return;
  }

  log(`Session state updated (${Object.keys(parsed).length} top-level keys)`);

  httpRequest("POST", "/api/session-state", { state: parsed }).catch(
    (err) => {
      logError(`Failed to post session state: ${err.message}`);
    }
  );
});

// Audio analysis from audio-analyzer.js
maxApi.addHandler("audio_analysis", (analysisJson) => {
  const parsed = safeParse(analysisJson);
  if (!parsed) return;

  httpRequest("POST", "/api/audio-analysis", { analysis: parsed }).catch(
    (err) => {
      logError(`Failed to post audio analysis: ${err.message}`);
    }
  );
});

// Library index from library-indexer.js
maxApi.addHandler("library_index", (indexJson) => {
  const parsed = safeParse(indexJson);
  if (!parsed || !Array.isArray(parsed)) {
    logError("Failed to parse library index JSON");
    return;
  }

  log(`Library index received (${parsed.length} items), posting to server`);

  httpRequest("POST", "/api/library-index", { items: parsed }).catch(
    (err) => {
      logError(`Failed to post library index: ${err.message}`);
    }
  );
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

startServer();

// Handle process exit (Max unloads node.script)
process.on("exit", stopServer);
process.on("SIGTERM", stopServer);
process.on("SIGINT", stopServer);

log("Ableton AI bridge loaded");
