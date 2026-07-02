'use strict';

// Preset catalog of AI providers. Everything speaks the OpenAI-compatible
// chat-completions protocol, so a provider is just { baseUrl, apiKey }.
// 'custom' lets users point Forge Code at any OpenAI-compatible endpoint.
const PRESETS = [
  { id: 'openrouter', name: 'OpenRouter',    baseUrl: 'https://openrouter.ai/api/v1',                              keyHint: 'openrouter.ai/keys',              needsKey: true },
  { id: 'openai',     name: 'OpenAI',        baseUrl: 'https://api.openai.com/v1',                                 keyHint: 'platform.openai.com/api-keys',    needsKey: true },
  { id: 'anthropic',  name: 'Anthropic',     baseUrl: 'https://api.anthropic.com/v1',                              keyHint: 'console.anthropic.com',           needsKey: true },
  { id: 'gemini',     name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',   keyHint: 'aistudio.google.com/apikey',      needsKey: true },
  { id: 'groq',       name: 'Groq',          baseUrl: 'https://api.groq.com/openai/v1',                            keyHint: 'console.groq.com/keys',           needsKey: true },
  { id: 'mistral',    name: 'Mistral',       baseUrl: 'https://api.mistral.ai/v1',                                 keyHint: 'console.mistral.ai',              needsKey: true },
  { id: 'deepseek',   name: 'DeepSeek',      baseUrl: 'https://api.deepseek.com/v1',                               keyHint: 'platform.deepseek.com',           needsKey: true },
  { id: 'xai',        name: 'xAI (Grok)',    baseUrl: 'https://api.x.ai/v1',                                       keyHint: 'console.x.ai',                    needsKey: true },
  { id: 'together',   name: 'Together AI',   baseUrl: 'https://api.together.xyz/v1',                               keyHint: 'api.together.ai/settings/keys',   needsKey: true },
  { id: 'moonshot',   name: 'Moonshot (Kimi)', baseUrl: 'https://api.moonshot.ai/v1',                              keyHint: 'platform.moonshot.ai',            needsKey: true },
  { id: 'ollama',     name: 'Ollama (local)',   baseUrl: 'http://localhost:11434/v1',                              keyHint: null,                              needsKey: false },
  { id: 'lmstudio',   name: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1',                              keyHint: null,                              needsKey: false },
  { id: 'custom',     name: 'Custom (OpenAI-compatible)', baseUrl: '',                                             keyHint: null,                              needsKey: false, custom: true },
];

function presetById(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

module.exports = { PRESETS, presetById };
