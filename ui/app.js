/* ==========================================================================
   Ableton AI Producer — Chat Application Logic
   Runs inside jweb (embedded Chromium) in a Max for Live device.

   Communication:
     Chat, settings, library → HTTP/SSE to backend server (localhost:9320)
     Action display → SSE events from server

   Security:
     All text is escaped via escapeHtml() before any HTML rendering.
     renderMarkdown/renderInline apply escapeHtml first, then convert
     markdown tokens to HTML elements. User messages use textContent.
   ========================================================================== */

(function () {
  "use strict";

  var SERVER_URL = "http://127.0.0.1:9320";

  // ---------- State ----------

  var state = {
    isStreaming: false,
    currentStreamEl: null,
    currentStreamText: "",
    settingsVisible: false,
    activeTab: "chat",
    messageCount: 0,
    abortController: null,
    costEstimateTimer: null,
  };

  // ---------- DOM References ----------

  var dom = {
    chatArea: null,
    chatInput: null,
    sendBtn: null,
    settingsPanel: null,
    settingsBtn: null,
    tokenUsage: null,
    typingIndicator: null,
    tabs: null,
    tabContents: null,
    apiKeyInput: null,
    providerSelect: null,
    modelSelect: null,
    contextSelect: null,
    clearBtn: null,
    emptyState: null,
    costEstimate: null,
    browseInput: null,
    browseCategorySelect: null,
    browseResults: null,
    analyzeBtn: null,
  };

  // ---------- Initialization ----------

  function init() {
    cacheDom();
    bindEvents();
    loadSettings();
    autoResizeInput();
  }

  function cacheDom() {
    dom.chatArea = document.getElementById("chat-area");
    dom.chatInput = document.getElementById("chat-input");
    dom.sendBtn = document.getElementById("send-btn");
    dom.settingsPanel = document.getElementById("settings-panel");
    dom.settingsBtn = document.getElementById("settings-btn");
    dom.tokenUsage = document.getElementById("token-usage");
    dom.typingIndicator = document.getElementById("typing-indicator");
    dom.apiKeyInput = document.getElementById("api-key-input");
    dom.providerSelect = document.getElementById("provider-select");
    dom.modelSelect = document.getElementById("model-select");
    dom.contextSelect = document.getElementById("context-select");
    dom.clearBtn = document.getElementById("clear-btn");
    dom.emptyState = document.getElementById("empty-state");
    dom.costEstimate = document.getElementById("cost-estimate");
    dom.tabs = document.querySelectorAll(".tab");
    dom.tabContents = document.querySelectorAll(".tab-content");
    dom.browseInput = document.getElementById("browse-input");
    dom.browseCategorySelect = document.getElementById("browse-category");
    dom.browseResults = document.getElementById("browse-results");
    dom.analyzeBtn = document.getElementById("analyze-btn");
  }

  function bindEvents() {
    dom.sendBtn.addEventListener("click", handleSend);
    dom.chatInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    dom.chatInput.addEventListener("input", function () {
      autoResizeInput();
      debouncedCostEstimate();
    });

    dom.settingsBtn.addEventListener("click", toggleSettings);

    dom.tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        switchTab(tab.dataset.tab);
      });
    });

    dom.apiKeyInput.addEventListener("change", function () {
      saveSettings();
    });

    if (dom.providerSelect) {
      dom.providerSelect.addEventListener("change", function () {
        updateModelOptions();
        saveSettings();
      });
    }

    dom.modelSelect.addEventListener("change", function () {
      saveSettings();
    });

    dom.contextSelect.addEventListener("change", function () {
      saveSettings();
    });

    dom.clearBtn.addEventListener("click", clearHistory);

    if (dom.browseInput) {
      dom.browseInput.addEventListener("input", debounce(handleBrowseSearch, 300));
    }
    if (dom.browseCategorySelect) {
      dom.browseCategorySelect.addEventListener("change", handleBrowseSearch);
    }

    if (dom.analyzeBtn) {
      dom.analyzeBtn.addEventListener("click", handleAnalyzeSession);
    }
  }

  // ---------- Settings via HTTP ----------

  function loadSettings() {
    setConnectionStatus("connecting");
    fetch(SERVER_URL + "/api/settings")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.provider && dom.providerSelect) {
          dom.providerSelect.value = data.provider;
          updateModelOptions();
        }
        if (data.model) dom.modelSelect.value = data.model;
        if (data.contextDepth) dom.contextSelect.value = data.contextDepth;
        setConnectionStatus("connected");
      })
      .catch(function () {
        setConnectionStatus("waiting");
        setTimeout(loadSettings, 2000);
      });
  }

  function setConnectionStatus(status) {
    var subtitle = document.querySelector(".empty-state-subtitle");
    if (!subtitle) return;
    if (status === "connecting") {
      subtitle.textContent = "Connecting to AI server...";
    } else if (status === "waiting") {
      subtitle.textContent = "Waiting for server to start...";
    } else {
      subtitle.textContent = "Ask about your session, get mixing advice, find sounds, or let the AI take actions in Ableton.";
    }
  }

  function saveSettings() {
    var body = {};
    if (dom.providerSelect) body.provider = dom.providerSelect.value;
    if (dom.modelSelect) body.model = dom.modelSelect.value;
    if (dom.contextSelect) body.contextDepth = dom.contextSelect.value;
    if (dom.apiKeyInput && dom.apiKeyInput.value.trim()) {
      body.apiKey = dom.apiKeyInput.value.trim();
    }

    fetch(SERVER_URL + "/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.status === "ok" && body.apiKey) {
          dom.apiKeyInput.value = "";
          dom.apiKeyInput.placeholder = "Key saved";
          setTimeout(function () {
            dom.apiKeyInput.placeholder = "sk-ant-... or sk-...";
          }, 2000);
        }
      })
      .catch(function (err) {
        console.error("Failed to save settings:", err);
      });
  }

  function updateModelOptions() {
    if (!dom.providerSelect || !dom.modelSelect) return;
    var provider = dom.providerSelect.value;
    var select = dom.modelSelect;

    while (select.firstChild) select.removeChild(select.firstChild);

    if (provider === "anthropic") {
      addOption(select, "claude-sonnet-4-6", "Claude Sonnet 4.6");
      addOption(select, "claude-haiku-4-5-20251001", "Claude Haiku 4.5");
      addOption(select, "claude-opus-4-6", "Claude Opus 4.6");
    } else if (provider === "openai") {
      addOption(select, "gpt-4o", "GPT-4o");
      addOption(select, "gpt-4o-mini", "GPT-4o Mini");
      addOption(select, "gpt-4.1", "GPT-4.1");
      addOption(select, "gpt-4.1-mini", "GPT-4.1 Mini");
      addOption(select, "gpt-4.1-nano", "GPT-4.1 Nano");
    } else if (provider === "ollama") {
      addOption(select, "qwen2.5-coder:7b", "Qwen 2.5 Coder 7B");
      addOption(select, "llama3.1:8b", "Llama 3.1 8B");
      addOption(select, "mistral:7b", "Mistral 7B");
      addOption(select, "deepseek-r1:8b", "DeepSeek R1 8B");
      addOption(select, "gemma3:12b", "Gemma 3 12B");
    }

    // Update API key placeholder based on provider
    if (dom.apiKeyInput) {
      if (provider === "ollama") {
        dom.apiKeyInput.placeholder = "No key needed (or custom URL)";
      } else {
        dom.apiKeyInput.placeholder = "sk-ant-... or sk-...";
      }
    }
  }

  function addOption(select, value, text) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  }

  // ---------- Chat via HTTP/SSE ----------

  function handleSend() {
    var text = dom.chatInput.value.trim();
    if (!text || state.isStreaming) return;

    hideEmptyState();
    appendMessage("user", text);

    dom.chatInput.value = "";
    autoResizeInput();
    clearCostEstimate();

    showTypingIndicator();
    state.isStreaming = true;
    updateSendButton();

    sendChatMessage(text);
  }

  function sendChatMessage(text) {
    state.abortController = new AbortController();

    fetch(SERVER_URL + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
      signal: state.abortController.signal,
    })
      .then(function (response) {
        if (!response.ok) {
          return response.json().then(function (err) {
            throw new Error(err.error || "Server error");
          });
        }
        return readSSEStream(response.body.getReader());
      })
      .catch(function (err) {
        if (err.name !== "AbortError") {
          handleChatError(err.message || "Connection failed");
        }
      });
  }

  function readSSEStream(reader) {
    var decoder = new TextDecoder();
    var buffer = "";

    function processBuffer() {
      var lines = buffer.split("\n");
      buffer = lines.pop() || "";

      var currentEvent = "";
      var currentData = "";

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.indexOf("event: ") === 0) {
          currentEvent = line.slice(7).trim();
        } else if (line.indexOf("data: ") === 0) {
          currentData = line.slice(6).trim();
        } else if (line === "" && currentEvent && currentData) {
          handleSSEEvent(currentEvent, currentData);
          currentEvent = "";
          currentData = "";
        }
      }
    }

    function read() {
      return reader.read().then(function (result) {
        if (result.done) {
          if (buffer) processBuffer();
          handleStreamDone();
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        processBuffer();
        return read();
      });
    }

    return read();
  }

  function handleSSEEvent(event, dataStr) {
    var data;
    try {
      data = JSON.parse(dataStr);
    } catch (e) {
      return;
    }

    switch (event) {
      case "text":
        handleStreamChunk(data.text || "");
        break;
      case "tool_use":
        appendActionMessage("executing", data.name, data.input);
        break;
      case "action_result":
        appendActionMessage("result", data.tool, data.result);
        break;
      case "token_usage":
        updateTokenUsage(data.input, data.output, data.cost);
        break;
      case "error":
        handleChatError(data.message || "Unknown error");
        break;
      case "done":
        handleStreamDone();
        break;
    }
  }

  // ---------- Action History Display ----------

  function appendActionMessage(type, toolName, data) {
    var messageEl = document.createElement("div");
    messageEl.className = "message action";

    var roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = "Action";

    var contentEl = document.createElement("div");
    contentEl.className = "message-content action-content";

    var toolLabel = formatToolName(toolName);

    if (type === "executing") {
      // Build action message using safe DOM methods
      var iconSpan = document.createElement("span");
      iconSpan.className = "action-icon";
      iconSpan.textContent = ">";
      contentEl.appendChild(iconSpan);

      var boldEl = document.createElement("strong");
      boldEl.textContent = " Executing: ";
      contentEl.appendChild(boldEl);
      contentEl.appendChild(document.createTextNode(toolLabel));

      if (data && Object.keys(data).length > 0) {
        var pre = document.createElement("pre");
        pre.className = "action-params";
        var code = document.createElement("code");
        code.textContent = JSON.stringify(data, null, 2);
        pre.appendChild(code);
        contentEl.appendChild(pre);
      }
    } else {
      var resultIcon = document.createElement("span");

      if (data && data.error) {
        resultIcon.className = "action-icon action-error";
        resultIcon.textContent = "x";
        contentEl.appendChild(resultIcon);

        var boldLabel = document.createElement("strong");
        boldLabel.textContent = " " + toolLabel + ": ";
        contentEl.appendChild(boldLabel);
        contentEl.appendChild(document.createTextNode(data.error));
      } else {
        resultIcon.className = "action-icon action-success";
        resultIcon.textContent = "ok";
        contentEl.appendChild(resultIcon);

        var boldLabel2 = document.createElement("strong");
        boldLabel2.textContent = " " + toolLabel + ": ";
        contentEl.appendChild(boldLabel2);
        contentEl.appendChild(document.createTextNode(formatActionResult(toolName, data)));
      }
    }

    messageEl.appendChild(roleLabel);
    messageEl.appendChild(contentEl);
    dom.chatArea.appendChild(messageEl);
    scrollToBottom();
  }

  function formatToolName(name) {
    return (name || "").replace(/_/g, " ").replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
  }

  function formatActionResult(toolName, result) {
    if (!result) return "Done";
    if (result.status === "ok") {
      if (result.name) return "'" + result.name + "'" + (result.track_index !== undefined ? " at index " + result.track_index : "");
      if (result.action) return result.action.replace(/_/g, " ") + " completed";
      return "Success";
    }
    return JSON.stringify(result);
  }

  // ---------- Message Handling ----------

  function appendMessage(role, content) {
    var messageEl = document.createElement("div");
    messageEl.className = "message " + role;
    messageEl.dataset.index = state.messageCount++;

    var roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    if (role === "user") {
      roleLabel.textContent = "You";
    } else if (role === "assistant") {
      roleLabel.textContent = "AI";
    } else if (role === "error") {
      roleLabel.textContent = "Error";
    } else {
      roleLabel.textContent = "System";
    }

    var contentEl = document.createElement("div");
    contentEl.className = "message-content";

    if (role === "user") {
      // User messages: plain text only — no HTML
      contentEl.textContent = content;
    } else {
      // AI/system/error messages: markdown rendering.
      // Content originates from our own backend (AI API responses).
      // All text is escaped via escapeHtml() inside renderInline
      // before inline markdown tokens are converted to HTML.
      contentEl.innerHTML = renderMarkdown(content);
    }

    messageEl.appendChild(roleLabel);
    messageEl.appendChild(contentEl);
    dom.chatArea.appendChild(messageEl);
    scrollToBottom();

    return messageEl;
  }

  // ---------- Streaming ----------

  function handleStreamChunk(text) {
    hideTypingIndicator();

    if (!state.currentStreamEl) {
      state.currentStreamEl = appendMessage("assistant", "");
      state.currentStreamText = "";
    }

    state.currentStreamText += text;

    // Re-render markdown. Text from our AI backend, escaped in renderInline.
    var contentEl = state.currentStreamEl.querySelector(".message-content");
    contentEl.innerHTML = renderMarkdown(state.currentStreamText);
    scrollToBottom();
  }

  function handleStreamDone() {
    state.isStreaming = false;
    state.currentStreamEl = null;
    state.currentStreamText = "";
    state.abortController = null;
    hideTypingIndicator();
    updateSendButton();
  }

  function handleChatError(errorMsg) {
    state.isStreaming = false;
    state.currentStreamEl = null;
    state.currentStreamText = "";
    state.abortController = null;
    hideTypingIndicator();
    updateSendButton();

    appendMessage("error", errorMsg || "An unexpected error occurred.");
  }

  // ---------- Cost Estimate ----------

  function debouncedCostEstimate() {
    if (state.costEstimateTimer) clearTimeout(state.costEstimateTimer);
    state.costEstimateTimer = setTimeout(fetchCostEstimate, 500);
  }

  function fetchCostEstimate() {
    var text = dom.chatInput.value.trim();
    if (!text || !dom.costEstimate) return;

    fetch(SERVER_URL + "/api/cost-estimate")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (dom.costEstimate) {
          var tokens = formatTokenCount(data.estimatedInputTokens || 0);
          var cost = "$" + (data.estimatedCost || 0).toFixed(4);
          dom.costEstimate.textContent = "~" + tokens + " tokens / ~" + cost;
          dom.costEstimate.style.display = "";
        }
      })
      .catch(function () {});
  }

  function clearCostEstimate() {
    if (dom.costEstimate) {
      dom.costEstimate.textContent = "";
      dom.costEstimate.style.display = "none";
    }
  }

  // ---------- Token Usage ----------

  function updateTokenUsage(inputTokens, outputTokens, cost) {
    if (!dom.tokenUsage) return;

    var totalTokens = (inputTokens || 0) + (outputTokens || 0);
    var costStr = "";

    if (cost !== undefined && cost !== null) {
      costStr = " / $" + parseFloat(cost).toFixed(4);
    }

    dom.tokenUsage.textContent = "";
    var span = document.createElement("span");
    span.className = "cost";
    span.textContent = formatTokenCount(totalTokens) + " tokens" + costStr;
    dom.tokenUsage.appendChild(span);
  }

  function formatTokenCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  }

  // ---------- Typing Indicator ----------

  function showTypingIndicator() {
    if (dom.typingIndicator) {
      dom.typingIndicator.classList.add("visible");
      scrollToBottom();
    }
  }

  function hideTypingIndicator() {
    if (dom.typingIndicator) {
      dom.typingIndicator.classList.remove("visible");
    }
  }

  // ---------- Settings ----------

  function toggleSettings() {
    state.settingsVisible = !state.settingsVisible;
    dom.settingsPanel.classList.toggle("visible", state.settingsVisible);
    dom.settingsBtn.classList.toggle("active", state.settingsVisible);
  }

  // ---------- Clear History ----------

  function clearHistory() {
    var messages = dom.chatArea.querySelectorAll(".message");
    messages.forEach(function (msg) {
      msg.remove();
    });

    state.messageCount = 0;
    state.currentStreamEl = null;
    state.currentStreamText = "";
    showEmptyState();

    fetch(SERVER_URL + "/api/clear", { method: "POST" }).catch(function () {});
  }

  // ---------- Tabs ----------

  function switchTab(tabName) {
    state.activeTab = tabName;

    dom.tabs.forEach(function (tab) {
      tab.classList.toggle("active", tab.dataset.tab === tabName);
    });

    dom.tabContents.forEach(function (panel) {
      panel.classList.toggle("active", panel.dataset.tab === tabName);
    });
  }

  // ---------- Browse Tab ----------

  function handleBrowseSearch() {
    var query = dom.browseInput ? dom.browseInput.value.trim() : "";
    var category = dom.browseCategorySelect ? dom.browseCategorySelect.value : "all";

    if (!query) {
      if (dom.browseResults) {
        while (dom.browseResults.firstChild) dom.browseResults.removeChild(dom.browseResults.firstChild);
      }
      return;
    }

    fetch(
      SERVER_URL +
        "/api/library/search?q=" +
        encodeURIComponent(query) +
        "&category=" +
        encodeURIComponent(category)
    )
      .then(function (res) { return res.json(); })
      .then(function (data) {
        renderBrowseResults(data.results || []);
      })
      .catch(function () {
        if (dom.browseResults) {
          while (dom.browseResults.firstChild) dom.browseResults.removeChild(dom.browseResults.firstChild);
          var emptyDiv = document.createElement("div");
          emptyDiv.className = "browse-empty";
          emptyDiv.textContent = "Server not available";
          dom.browseResults.appendChild(emptyDiv);
        }
      });
  }

  function renderBrowseResults(results) {
    if (!dom.browseResults) return;

    while (dom.browseResults.firstChild) dom.browseResults.removeChild(dom.browseResults.firstChild);

    if (results.length === 0) {
      var emptyDiv = document.createElement("div");
      emptyDiv.className = "browse-empty";
      emptyDiv.textContent = "No results found";
      dom.browseResults.appendChild(emptyDiv);
      return;
    }

    for (var i = 0; i < results.length; i++) {
      var item = results[i];

      var card = document.createElement("div");
      card.className = "browse-card";

      var nameDiv = document.createElement("div");
      nameDiv.className = "browse-card-name";
      nameDiv.textContent = item.name;
      card.appendChild(nameDiv);

      var catDiv = document.createElement("div");
      catDiv.className = "browse-card-category";
      catDiv.textContent = item.category;
      card.appendChild(catDiv);

      if (item.tags && item.tags.length > 0) {
        var tagsDiv = document.createElement("div");
        tagsDiv.className = "browse-card-tags";
        tagsDiv.textContent = item.tags.slice(0, 4).join(", ");
        card.appendChild(tagsDiv);
      }

      var loadBtn = document.createElement("button");
      loadBtn.className = "browse-load-btn";
      loadBtn.textContent = "Load";
      loadBtn.dataset.name = item.name;
      loadBtn.addEventListener("click", (function (name) {
        return function () {
          switchTab("chat");
          dom.chatInput.value = "Load " + name + " onto a new track";
          handleSend();
        };
      })(item.name));
      card.appendChild(loadBtn);

      dom.browseResults.appendChild(card);
    }
  }

  // ---------- Analyze Tab ----------

  function handleAnalyzeSession() {
    switchTab("chat");
    dom.chatInput.value =
      "Analyze my current session. Get the session state and give me a detailed overview of the tracks, devices, and any suggestions for improvement.";
    handleSend();
  }

  // ---------- Empty State ----------

  function hideEmptyState() {
    if (dom.emptyState) {
      dom.emptyState.style.display = "none";
    }
  }

  function showEmptyState() {
    if (dom.emptyState) {
      dom.emptyState.style.display = "";
    }
  }

  // ---------- UI Helpers ----------

  function scrollToBottom() {
    requestAnimationFrame(function () {
      dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
    });
  }

  function autoResizeInput() {
    var el = dom.chatInput;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function updateSendButton() {
    dom.sendBtn.disabled = state.isStreaming;
  }

  function debounce(fn, delay) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  // ---------- Markdown Renderer ----------

  /**
   * Lightweight markdown-to-HTML renderer.
   * All raw text is escaped via escapeHtml() before inline tokens
   * (bold, italic, links, etc.) are converted to HTML elements.
   * This prevents any script injection from the source text.
   */
  function renderMarkdown(text) {
    if (!text) return "";

    var html = "";
    var lines = text.split("\n");
    var inCodeBlock = false;
    var codeBlockContent = "";
    var codeBlockLang = "";
    var inList = false;
    var listType = "";

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (line.trim().indexOf("```") === 0) {
        if (!inCodeBlock) {
          if (inList) { html += "</" + listType + ">"; inList = false; }
          inCodeBlock = true;
          codeBlockLang = line.trim().slice(3).trim();
          codeBlockContent = "";
        } else {
          var langTag = codeBlockLang
            ? '<span class="code-lang">' + escapeHtml(codeBlockLang) + "</span>"
            : "";
          html += "<pre>" + langTag + "<code>" +
            escapeHtml(codeBlockContent.replace(/\n$/, "")) +
            "</code></pre>";
          inCodeBlock = false;
          codeBlockLang = "";
        }
        continue;
      }

      if (inCodeBlock) { codeBlockContent += line + "\n"; continue; }

      if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
        if (inList) { html += "</" + listType + ">"; inList = false; }
        html += "<hr>";
        continue;
      }

      var headingMatch = line.match(/^(#{1,4})\s+(.+)/);
      if (headingMatch) {
        if (inList) { html += "</" + listType + ">"; inList = false; }
        var level = headingMatch[1].length;
        html += "<h" + level + ">" + renderInline(headingMatch[2]) + "</h" + level + ">";
        continue;
      }

      if (line.trim().indexOf("> ") === 0) {
        if (inList) { html += "</" + listType + ">"; inList = false; }
        html += "<blockquote>" + renderInline(line.trim().slice(2)) + "</blockquote>";
        continue;
      }

      var ulMatch = line.match(/^(\s*)[*\-+]\s+(.+)/);
      if (ulMatch) {
        if (!inList || listType !== "ul") {
          if (inList) html += "</" + listType + ">";
          html += "<ul>"; inList = true; listType = "ul";
        }
        html += "<li>" + renderInline(ulMatch[2]) + "</li>";
        continue;
      }

      var olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
      if (olMatch) {
        if (!inList || listType !== "ol") {
          if (inList) html += "</" + listType + ">";
          html += "<ol>"; inList = true; listType = "ol";
        }
        html += "<li>" + renderInline(olMatch[2]) + "</li>";
        continue;
      }

      if (inList && line.trim() === "") { html += "</" + listType + ">"; inList = false; continue; }
      if (inList && !ulMatch && !olMatch) { html += "</" + listType + ">"; inList = false; }
      if (line.trim() === "") continue;

      html += "<p>" + renderInline(line) + "</p>";
    }

    if (inCodeBlock) {
      var langTag2 = codeBlockLang
        ? '<span class="code-lang">' + escapeHtml(codeBlockLang) + "</span>"
        : "";
      html += "<pre>" + langTag2 + "<code>" +
        escapeHtml(codeBlockContent.replace(/\n$/, "")) +
        "</code></pre>";
    }

    if (inList) html += "</" + listType + ">";

    return html;
  }

  /**
   * Render inline markdown: bold, italic, inline code, links.
   * Text is escaped before token conversion to prevent injection.
   */
  function renderInline(text) {
    text = escapeHtml(text);
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    text = text.replace(/__(.+?)__/g, "<strong>$1</strong>");
    text = text.replace(/\b_(.+?)_\b/g, "<em>$1</em>");
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );
    return text;
  }

  function escapeHtml(text) {
    var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return text.replace(/[&<>"']/g, function (c) { return map[c]; });
  }

  // ---------- Boot ----------

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
