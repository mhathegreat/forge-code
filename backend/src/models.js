'use strict';
const { OPENROUTER_API_KEY } = require('./config');

// Cached OpenRouter model catalog (id, name, context, pricing, free flag).
let cache = { ts: 0, data: null };
const TTL = 10 * 60 * 1000;

async function listModels(force = false) {
  if (!force && cache.data && Date.now() - cache.ts < TTL) return cache.data;
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: OPENROUTER_API_KEY ? { Authorization: 'Bearer ' + OPENROUTER_API_KEY } : {},
  });
  if (!res.ok) throw new Error('OpenRouter /models returned ' + res.status);
  const json = await res.json();
  const models = (json.data || [])
    .map((m) => {
      const promptPrice = Number((m.pricing && m.pricing.prompt) || 0);
      const completionPrice = Number((m.pricing && m.pricing.completion) || 0);
      return {
        id: m.id,
        name: m.name || m.id,
        context: m.context_length || 0,
        promptPrice,      // $ per token
        completionPrice,  // $ per token
        free: promptPrice === 0 && completionPrice === 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  cache = { ts: Date.now(), data: models };
  return models;
}

module.exports = { listModels };
