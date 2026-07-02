'use strict';
const fs = require('fs');
const path = require('path');
const { APP_ROOT, DEFAULT_MODEL, OPENROUTER_API_KEY } = require('./config');

// App settings persisted to settings.json at the repo root (gitignored).
// Holds both preferences (default model / permission mode) and secrets the
// user saves through the UI (OpenRouter key, password hash). Anything saved
// here takes precedence over .env so users never have to edit files.
const FILE = path.join(APP_ROOT, 'settings.json');

const DEFAULTS = {
  defaultModel: DEFAULT_MODEL,
  // 'ask'       — approve file writes, deletes and commands (safest)
  // 'auto-edit' — file writes are automatic; approve deletes and commands
  // 'auto'      — everything runs without asking (yolo)
  defaultPermissionMode: 'ask',
};

// Full raw contents of settings.json (including secrets). Internal use only.
function raw() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; }
  catch { return {}; }
}

function writeRaw(obj) {
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
}

// Preferences with defaults applied (no secrets).
function get() {
  const r = raw();
  return {
    defaultModel: r.defaultModel || DEFAULTS.defaultModel,
    defaultPermissionMode: r.defaultPermissionMode || DEFAULTS.defaultPermissionMode,
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

// Update secret fields (openrouterApiKey, passwordHash). Empty string clears.
function setSecret(patch) {
  const r = raw();
  for (const k of ['openrouterApiKey', 'passwordHash']) {
    if (patch && patch[k] !== undefined) {
      if (patch[k]) r[k] = String(patch[k]);
      else delete r[k];
    }
  }
  writeRaw(r);
}

// Effective OpenRouter key: in-app saved key wins, .env is the fallback.
function getApiKey() {
  return raw().openrouterApiKey || OPENROUTER_API_KEY || '';
}

function maskKey(key) {
  if (!key) return null;
  return key.slice(0, 12) + '…' + key.slice(-4);
}

// Safe shape for the settings API/UI — never exposes the raw key.
function getPublic() {
  const r = raw();
  const effective = getApiKey();
  return {
    ...get(),
    hasKey: !!effective,
    keySource: r.openrouterApiKey ? 'app' : (OPENROUTER_API_KEY ? 'env' : null),
    keyPreview: maskKey(effective),
  };
}

module.exports = { get, set, setSecret, raw, getApiKey, getPublic, DEFAULTS };
