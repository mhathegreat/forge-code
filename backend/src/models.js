'use strict';
const { getProvider } = require('./settings');

// Model catalog for the ACTIVE provider, normalized to one shape:
// { id, name, context, promptPrice, completionPrice, free, pricingKnown }
// OpenRouter gives rich pricing; most others just list ids.
let cache = { key: '', ts: 0, data: null };
const TTL = 10 * 60 * 1000;

function normOpenRouter(json) {
  return (json.data || []).map((m) => {
    const promptPrice = Number((m.pricing && m.pricing.prompt) || 0);
    const completionPrice = Number((m.pricing && m.pricing.completion) || 0);
    return {
      id: m.id,
      name: m.name || m.id,
      context: m.context_length || 0,
      promptPrice, completionPrice,
      free: promptPrice === 0 && completionPrice === 0,
      pricingKnown: true,
    };
  });
}

function normGeneric(json) {
  return (json.data || []).map((m) => ({
    id: m.id,
    name: m.display_name || m.id,
    context: m.context_length || m.context_window || 0,
    promptPrice: 0, completionPrice: 0,
    free: false,
    pricingKnown: false,
  }));
}

async function listModels(force = false) {
  const p = getProvider();
  const cacheKey = p.id + '::' + p.baseUrl;
  if (!force && cache.data && cache.key === cacheKey && Date.now() - cache.ts < TTL) {
    return { provider: { id: p.id, name: p.name }, models: cache.data };
  }
  if (!p.baseUrl) throw new Error('Provider base URL is not set — configure it in Settings.');

  let url = p.baseUrl + '/models';
  let headers = {};
  if (p.id === 'anthropic') {
    // Anthropic's native models endpoint (their OpenAI-compat layer is for chat).
    url = 'https://api.anthropic.com/v1/models?limit=100';
    headers = { 'x-api-key': p.apiKey, 'anthropic-version': '2023-06-01' };
  } else if (p.apiKey) {
    headers = { Authorization: 'Bearer ' + p.apiKey };
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`${p.name} model list failed (HTTP ${res.status}) — check the API key in Settings, or type a model id manually.`);
  }
  const json = await res.json();
  const models = (p.id === 'openrouter' ? normOpenRouter(json) : normGeneric(json))
    .sort((a, b) => a.name.localeCompare(b.name));

  cache = { key: cacheKey, ts: Date.now(), data: models };
  return { provider: { id: p.id, name: p.name }, models };
}

module.exports = { listModels };
