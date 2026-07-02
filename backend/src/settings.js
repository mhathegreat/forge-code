'use strict';
const fs = require('fs');
const path = require('path');
const { APP_ROOT, DEFAULT_MODEL, OPENROUTER_API_KEY } = require('./config');
const { PRESETS, presetById } = require('./providers');

// App settings persisted to settings.json at the repo root (gitignored).
// Holds preferences, the password hash, and per-provider API keys saved
// through the UI. Anything saved here takes precedence over .env, so users
// never have to edit files.
const FILE = path.join(APP_ROOT, 'settings.json');

const DEFAULTS = {
  defaultModel: DEFAULT_MODEL,
  // 'ask'       — approve file writes, deletes and commands (safest)
  // 'auto-edit' — file writes are automatic; approve deletes and commands
  // 'auto'      — everything runs without asking (yolo)
  defaultPermissionMode: 'ask',
  activeProvider: 'openrouter',
};

function writeRaw(obj) {
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
}

// Full raw contents (including secrets). Internal use only.
// Lazily migrates the legacy flat openrouterApiKey field into providers.*.
function raw() {
  let r;
  try { r = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; }
  catch { r = {}; }
  if (r.openrouterApiKey) {
    r.providers = r.providers || {};
    r.providers.openrouter = { ...(r.providers.openrouter || {}), apiKey: r.openrouterApiKey };
    delete r.openrouterApiKey;
    try { writeRaw(r); } catch {}
  }
  return r;
}

// Preferences with defaults applied (no secrets).
function get() {
  const r = raw();
  return {
    defaultModel: r.defaultModel || DEFAULTS.defaultModel,
    defaultPermissionMode: r.defaultPermissionMode || DEFAULTS.defaultPermissionMode,
    activeProvider: r.activeProvider || DEFAULTS.activeProvider,
  };
}

// Update preference fields only.
function set(patch) {
  const r = raw();
  for (const k of Object.keys(DEFAULTS)) {
    if (patch && patch[k] !== undefined) r[k] = patch[k];
  }
  writeRaw(r);
  return get();
}

// Update secret fields (passwordHash). Empty string clears.
function setSecret(patch) {
  const r = raw();
  for (const k of ['passwordHash']) {
    if (patch && patch[k] !== undefined) {
      if (patch[k]) r[k] = String(patch[k]);
      else delete r[k];
    }
  }
  writeRaw(r);
}

// Save a provider's config (apiKey; plus baseUrl/name for the custom slot).
function setProviderConfig(id, cfg = {}) {
  const preset = presetById(id);
  if (!preset) throw new Error('Unknown provider: ' + id);
  const r = raw();
  r.providers = r.providers || {};
  const cur = r.providers[id] || {};
  if (cfg.apiKey !== undefined) {
    const k = String(cfg.apiKey || '').trim();
    if (k) cur.apiKey = k; else delete cur.apiKey;
  }
  if (preset.custom) {
    if (cfg.baseUrl !== undefined) cur.baseUrl = String(cfg.baseUrl || '').trim();
    if (cfg.name !== undefined) cur.name = String(cfg.name || '').trim();
  }
  r.providers[id] = cur;
  writeRaw(r);
}

// Env-var fallback per provider: OPENROUTER_API_KEY, OPENAI_API_KEY, etc.
function envKeyFor(id) {
  if (id === 'openrouter' && OPENROUTER_API_KEY) return OPENROUTER_API_KEY;
  return process.env[String(id).toUpperCase() + '_API_KEY'] || '';
}

// Resolve a provider (active one by default) to a usable config.
function getProvider(id) {
  const r = raw();
  const pid = id || r.activeProvider || DEFAULTS.activeProvider;
  const preset = presetById(pid) || presetById('openrouter');
  const cfg = (r.providers || {})[preset.id] || {};
  return {
    id: preset.id,
    name: cfg.name || preset.name,
    baseUrl: String(cfg.baseUrl || preset.baseUrl || '').replace(/\/+$/, ''),
    apiKey: cfg.apiKey || envKeyFor(preset.id) || '',
    needsKey: !!preset.needsKey,
    custom: !!preset.custom,
    keyHint: preset.keyHint || null,
  };
}

// Back-compat helper: effective key of the ACTIVE provider.
function getApiKey() {
  return getProvider().apiKey;
}

function maskKey(key) {
  if (!key) return null;
  return key.length <= 10 ? '••••' : key.slice(0, 10) + '…' + key.slice(-4);
}

function keySource(id) {
  const r = raw();
  if (((r.providers || {})[id] || {}).apiKey) return 'app';
  if (envKeyFor(id)) return 'env';
  return null;
}

// Safe shape for the settings API/UI — never exposes raw keys.
function getPublic() {
  const g = get();
  const active = getProvider();
  return {
    ...g,
    provider: {
      id: active.id, name: active.name, baseUrl: active.baseUrl,
      needsKey: active.needsKey, custom: active.custom, keyHint: active.keyHint,
      hasKey: !!active.apiKey, keyPreview: maskKey(active.apiKey), keySource: keySource(active.id),
    },
    providers: PRESETS.map((p) => {
      const res = getProvider(p.id);
      return {
        id: p.id, name: res.name, baseUrl: res.baseUrl,
        needsKey: !!p.needsKey, custom: !!p.custom, keyHint: p.keyHint || null,
        hasKey: !!res.apiKey, keyPreview: maskKey(res.apiKey), keySource: keySource(p.id),
        configured: !!res.apiKey || !p.needsKey,
        active: p.id === active.id,
      };
    }),
  };
}

module.exports = {
  get, set, setSecret, setProviderConfig, raw,
  getProvider, getApiKey, getPublic, DEFAULTS,
};
