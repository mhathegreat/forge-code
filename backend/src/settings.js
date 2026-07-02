'use strict';
const fs = require('fs');
const path = require('path');
const { APP_ROOT, DEFAULT_MODEL } = require('./config');

// Global app settings, persisted to settings.json at the repo root (gitignored).
// Per-project overrides live in each project's meta.json.
const FILE = path.join(APP_ROOT, 'settings.json');

const DEFAULTS = {
  defaultModel: DEFAULT_MODEL,
  // 'ask'       — approve file writes, deletes and commands (safest)
  // 'auto-edit' — file writes are automatic; approve deletes and commands
  // 'auto'      — everything runs without asking (yolo)
  defaultPermissionMode: 'ask',
};

function get() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}

function set(patch) {
  const next = { ...get() };
  for (const k of Object.keys(DEFAULTS)) {
    if (patch && patch[k] !== undefined) next[k] = patch[k];
  }
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}

module.exports = { get, set, DEFAULTS };
