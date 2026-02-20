/**
 * AI Provider abstraction using Vercel AI SDK.
 *
 * Supports switching between Anthropic (Claude) and OpenAI (GPT) at runtime.
 * Each provider stores its own API key independently.
 */

const { createAnthropic } = require("@ai-sdk/anthropic");
const { createOpenAI } = require("@ai-sdk/openai");

// Provider instances keyed by name
const providers = {};

// Current active provider
let activeProviderName = "anthropic";

// Default models per provider
const DEFAULT_MODELS = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
};

// Cost rates per 1M tokens
const COST_RATES = {
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
};

/**
 * Configure a provider with an API key.
 * @param {string} name - Provider name ("anthropic" or "openai")
 * @param {string} apiKey - API key for the provider
 */
function configureProvider(name, apiKey) {
  if (!apiKey) return;

  if (name === "anthropic") {
    providers.anthropic = createAnthropic({ apiKey });
  } else if (name === "openai") {
    providers.openai = createOpenAI({ apiKey });
  }
}

/**
 * Set the active provider.
 * @param {string} name - Provider name
 */
function setActiveProvider(name) {
  if (name === "anthropic" || name === "openai") {
    activeProviderName = name;
  }
}

/**
 * Get the active provider's model function for the given model ID.
 * @param {string} [modelId] - Specific model ID, or null for default
 * @returns {object} Vercel AI SDK model instance
 */
function getModel(modelId) {
  const provider = providers[activeProviderName];
  if (!provider) {
    throw new Error(
      `Provider "${activeProviderName}" not configured. Set an API key first.`
    );
  }
  const id = modelId || DEFAULT_MODELS[activeProviderName];
  return provider(id);
}

/**
 * Check if the active provider is configured.
 * @returns {boolean}
 */
function isConfigured() {
  return !!providers[activeProviderName];
}

/**
 * Get the active provider name.
 * @returns {string}
 */
function getActiveProviderName() {
  return activeProviderName;
}

/**
 * Estimate cost for token usage.
 * @param {string} modelId - Model identifier
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number} Estimated cost in USD
 */
function estimateCost(modelId, inputTokens, outputTokens) {
  // Try exact match first, then partial match
  let rate = COST_RATES[modelId];
  if (!rate) {
    const id = (modelId || "").toLowerCase();
    if (id.includes("opus")) rate = COST_RATES["claude-opus-4-6"];
    else if (id.includes("haiku")) rate = COST_RATES["claude-haiku-4-5-20251001"];
    else if (id.includes("sonnet")) rate = COST_RATES["claude-sonnet-4-6"];
    else if (id.includes("4o-mini")) rate = COST_RATES["gpt-4o-mini"];
    else if (id.includes("4o")) rate = COST_RATES["gpt-4o"];
    else if (id.includes("4.1-nano")) rate = COST_RATES["gpt-4.1-nano"];
    else if (id.includes("4.1-mini")) rate = COST_RATES["gpt-4.1-mini"];
    else if (id.includes("4.1")) rate = COST_RATES["gpt-4.1"];
    else rate = { input: 3, output: 15 }; // fallback to sonnet-like rates
  }
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}

module.exports = {
  configureProvider,
  setActiveProvider,
  getActiveProviderName,
  getModel,
  isConfigured,
  estimateCost,
  DEFAULT_MODELS,
};
