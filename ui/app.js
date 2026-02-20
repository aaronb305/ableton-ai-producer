/* ==========================================================================
   Ableton AI Producer — Chat Application Logic
   Runs inside jweb (embedded Chromium) in a Max for Live device.
   Communicates with Max via window.max object.
   ========================================================================== */

(function () {
  "use strict";

  // ---------- State ----------

  const state = {
    isStreaming: false,
    currentStreamEl: null,
    currentStreamText: "",
    settingsVisible: false,
    activeTab: "chat",
    messageCount: 0,
  };

  // ---------- DOM References ----------

  const dom = {
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
    modelSelect: null,
    contextSelect: null,
    clearBtn: null,
    emptyState: null,
  };

  // ---------- Initialization ----------

  function init() {
    cacheDom();
    bindEvents();
    initMax();
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
    dom.modelSelect = document.getElementById("model-select");
    dom.contextSelect = document.getElementById("context-select");
    dom.clearBtn = document.getElementById("clear-btn");
    dom.emptyState = document.getElementById("empty-state");
    dom.tabs = document.querySelectorAll(".tab");
    dom.tabContents = document.querySelectorAll(".tab-content");
  }

  function bindEvents() {
    // Send message
    dom.sendBtn.addEventListener("click", handleSend);
    dom.chatInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Auto-resize textarea
    dom.chatInput.addEventListener("input", autoResizeInput);

    // Settings toggle
    dom.settingsBtn.addEventListener("click", toggleSettings);

    // Tabs
    dom.tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        if (tab.classList.contains("disabled")) return;
        switchTab(tab.dataset.tab);
      });
    });

    // Settings controls
    dom.apiKeyInput.addEventListener("change", function () {
      setApiKey(dom.apiKeyInput.value.trim());
    });

    dom.modelSelect.addEventListener("change", function () {
      sendToMax("set_model", dom.modelSelect.value);
    });

    dom.contextSelect.addEventListener("change", function () {
      sendToMax("set_depth", dom.contextSelect.value);
    });

    dom.clearBtn.addEventListener("click", clearHistory);
  }

  // ---------- Max Communication ----------

  /**
   * Mock for testing outside Max (when window.max is undefined).
   * Logs all calls to console so the UI can be developed in a browser.
   */
  function createMaxMock() {
    console.log("[Max Mock] window.max not found — running in standalone mode");
    return {
      bindInlet: function (name, callback) {
        console.log("[Max Mock] bindInlet:", name);
        // Store callbacks so they can be triggered from the console for testing
        if (!window._maxCallbacks) window._maxCallbacks = {};
        window._maxCallbacks[name] = callback;
      },
      outlet: function () {
        var args = Array.prototype.slice.call(arguments);
        console.log("[Max Mock] outlet:", args.join(", "));
      },
    };
  }

  function initMax() {
    var max = window.max || createMaxMock();

    // Bind incoming messages from Max
    max.bindInlet("chat_response", function (text) {
      handleStreamChunk(text);
    });

    max.bindInlet("chat_done", function () {
      handleStreamDone();
    });

    max.bindInlet("chat_error", function (errorMsg) {
      handleChatError(errorMsg);
    });

    max.bindInlet("token_usage", function (inputTokens, outputTokens, cost) {
      updateTokenUsage(inputTokens, outputTokens, cost);
    });

    max.bindInlet("session_info", function (summary) {
      appendMessage("system", summary);
    });

    // Store reference for sending
    window._max = max;
  }

  function sendToMax() {
    if (window._max) {
      window._max.outlet.apply(window._max, arguments);
    }
  }

  // ---------- Message Handling ----------

  function handleSend() {
    var text = dom.chatInput.value.trim();
    if (!text || state.isStreaming) return;

    // Hide empty state
    hideEmptyState();

    // Display user message
    appendMessage("user", text);

    // Send to Max
    sendToMax("chat", text);

    // Clear input
    dom.chatInput.value = "";
    autoResizeInput();

    // Show typing indicator
    showTypingIndicator();
    state.isStreaming = true;
    updateSendButton();
  }

  function appendMessage(role, content) {
    var messageEl = document.createElement("div");
    messageEl.className = "message " + role;
    messageEl.dataset.index = state.messageCount++;

    var roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    if (role === "user") {
      roleLabel.textContent = "You";
    } else if (role === "assistant") {
      roleLabel.textContent = "Claude";
    } else if (role === "error") {
      roleLabel.textContent = "Error";
    } else {
      roleLabel.textContent = "System";
    }

    var contentEl = document.createElement("div");
    contentEl.className = "message-content";

    if (role === "user") {
      // User messages are plain text — no HTML interpretation
      contentEl.textContent = content;
    } else {
      // AI / system / error messages get markdown rendering.
      // Content originates from our own backend (Claude API responses
      // routed through node.script) or from system strings defined in
      // this file. It does not contain arbitrary third-party HTML.
      // All text is escaped via escapeHtml() before inline markdown
      // tokens are converted, so script injection is not possible.
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
      // Create a new assistant message for this stream
      state.currentStreamEl = appendMessage("assistant", "");
      state.currentStreamText = "";
    }

    state.currentStreamText += text;

    // Re-render the full markdown content.
    // The text comes from our Claude API backend via Max messages.
    // escapeHtml() is applied inside renderMarkdown/renderInline
    // before any inline tokens are processed.
    var contentEl = state.currentStreamEl.querySelector(".message-content");
    contentEl.innerHTML = renderMarkdown(state.currentStreamText);
    scrollToBottom();
  }

  function handleStreamDone() {
    state.isStreaming = false;
    state.currentStreamEl = null;
    state.currentStreamText = "";
    hideTypingIndicator();
    updateSendButton();
  }

  function handleChatError(errorMsg) {
    state.isStreaming = false;
    state.currentStreamEl = null;
    state.currentStreamText = "";
    hideTypingIndicator();
    updateSendButton();

    appendMessage("error", errorMsg || "An unexpected error occurred.");
  }

  // ---------- Token Usage ----------

  function updateTokenUsage(inputTokens, outputTokens, cost) {
    if (!dom.tokenUsage) return;

    var totalTokens = (inputTokens || 0) + (outputTokens || 0);
    var costStr = "";

    if (cost !== undefined && cost !== null) {
      costStr = " / $" + parseFloat(cost).toFixed(4);
    }

    var span = document.createElement("span");
    span.className = "cost";
    span.textContent = formatTokenCount(totalTokens) + " tokens" + costStr;

    dom.tokenUsage.textContent = "";
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

  function showSettings() {
    state.settingsVisible = true;
    dom.settingsPanel.classList.add("visible");
    dom.settingsBtn.classList.add("active");
  }

  function hideSettings() {
    state.settingsVisible = false;
    dom.settingsPanel.classList.remove("visible");
    dom.settingsBtn.classList.remove("active");
  }

  function setApiKey(key) {
    if (!key) return;
    sendToMax("set_api_key", key);
  }

  // ---------- Clear History ----------

  function clearHistory() {
    // Remove all message elements from the chat area
    var messages = dom.chatArea.querySelectorAll(".message");
    messages.forEach(function (msg) {
      msg.remove();
    });

    state.messageCount = 0;
    state.currentStreamEl = null;
    state.currentStreamText = "";
    showEmptyState();

    // Notify Max
    sendToMax("clear_history");
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

  // ---------- Markdown Renderer ----------

  /**
   * Lightweight markdown-to-HTML renderer.
   * Handles: code blocks, inline code, bold, italic, headings,
   * ordered/unordered lists, links, blockquotes, and horizontal rules.
   *
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

      // Code block toggle
      if (line.trim().indexOf("```") === 0) {
        if (!inCodeBlock) {
          // Close any open list
          if (inList) {
            html += "</" + listType + ">";
            inList = false;
          }
          inCodeBlock = true;
          codeBlockLang = line.trim().slice(3).trim();
          codeBlockContent = "";
        } else {
          // End code block
          var langTag = codeBlockLang
            ? '<span class="code-lang">' + escapeHtml(codeBlockLang) + "</span>"
            : "";
          html +=
            "<pre>" +
            langTag +
            "<code>" +
            escapeHtml(codeBlockContent.replace(/\n$/, "")) +
            "</code></pre>";
          inCodeBlock = false;
          codeBlockLang = "";
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent += line + "\n";
        continue;
      }

      // Horizontal rule
      if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
        if (inList) {
          html += "</" + listType + ">";
          inList = false;
        }
        html += "<hr>";
        continue;
      }

      // Headings
      var headingMatch = line.match(/^(#{1,4})\s+(.+)/);
      if (headingMatch) {
        if (inList) {
          html += "</" + listType + ">";
          inList = false;
        }
        var level = headingMatch[1].length;
        html +=
          "<h" + level + ">" + renderInline(headingMatch[2]) + "</h" + level + ">";
        continue;
      }

      // Blockquote
      if (line.trim().indexOf("> ") === 0) {
        if (inList) {
          html += "</" + listType + ">";
          inList = false;
        }
        html += "<blockquote>" + renderInline(line.trim().slice(2)) + "</blockquote>";
        continue;
      }

      // Unordered list
      var ulMatch = line.match(/^(\s*)[*\-+]\s+(.+)/);
      if (ulMatch) {
        if (!inList || listType !== "ul") {
          if (inList) html += "</" + listType + ">";
          html += "<ul>";
          inList = true;
          listType = "ul";
        }
        html += "<li>" + renderInline(ulMatch[2]) + "</li>";
        continue;
      }

      // Ordered list
      var olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
      if (olMatch) {
        if (!inList || listType !== "ol") {
          if (inList) html += "</" + listType + ">";
          html += "<ol>";
          inList = true;
          listType = "ol";
        }
        html += "<li>" + renderInline(olMatch[2]) + "</li>";
        continue;
      }

      // Close list if we hit a non-list line
      if (inList && line.trim() === "") {
        html += "</" + listType + ">";
        inList = false;
        continue;
      }

      if (inList && !ulMatch && !olMatch) {
        html += "</" + listType + ">";
        inList = false;
      }

      // Empty line
      if (line.trim() === "") {
        continue;
      }

      // Regular paragraph
      html += "<p>" + renderInline(line) + "</p>";
    }

    // Close any open blocks
    if (inCodeBlock) {
      var langTag2 = codeBlockLang
        ? '<span class="code-lang">' + escapeHtml(codeBlockLang) + "</span>"
        : "";
      html +=
        "<pre>" +
        langTag2 +
        "<code>" +
        escapeHtml(codeBlockContent.replace(/\n$/, "")) +
        "</code></pre>";
    }

    if (inList) {
      html += "</" + listType + ">";
    }

    return html;
  }

  /**
   * Render inline markdown: bold, italic, inline code, links.
   * Text is escaped before token conversion to prevent injection.
   */
  function renderInline(text) {
    // Escape HTML first — all raw text is sanitized here
    text = escapeHtml(text);

    // Inline code (must come before bold/italic to protect backtick content)
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold + italic (***text***)
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");

    // Bold (**text**)
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Italic (*text*)
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Bold with underscores (__text__)
    text = text.replace(/__(.+?)__/g, "<strong>$1</strong>");

    // Italic with underscores (_text_)
    text = text.replace(
      /\b_(.+?)_\b/g,
      "<em>$1</em>"
    );

    // Links [text](url)
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );

    return text;
  }

  function escapeHtml(text) {
    var map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, function (c) {
      return map[c];
    });
  }

  // ---------- Boot ----------

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
