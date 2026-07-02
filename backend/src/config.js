'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// App root = repo root (two levels up from backend/src)
const APP_ROOT = path.resolve(__dirname, '..', '..');
require('dotenv').config({ path: path.join(APP_ROOT, '.env') });

const IS_WIN = process.platform === 'win32';

const APP_PASSWORD = process.env.APP_PASSWORD || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || process.env.KIMI_MODEL || 'moonshotai/kimi-k2.6';

// Projects live next to the app by default. A stale unix-style path from an
// old server .env is ignored on Windows.
let PROJECTS_ROOT = process.env.PROJECTS_ROOT || path.join(APP_ROOT, 'projects');
if (IS_WIN && /^\//.test(PROJECTS_ROOT)) PROJECTS_ROOT = path.join(APP_ROOT, 'projects');
try { fs.mkdirSync(PROJECTS_ROOT, { recursive: true }); } catch {}

const PORT = parseInt(process.env.BACKEND_PORT || '4000', 10);

// Shell used for the agent's run_command AND the PTY terminal.
// On Windows prefer Git Bash (LLMs speak POSIX), falling back to PowerShell.
function detectShell() {
  if (!IS_WIN) return { shell: '/bin/bash', kind: 'bash' };
  const candidates = [
    process.env.FORGE_SHELL,
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        return { shell: c, kind: c.toLowerCase().includes('bash') ? 'bash' : 'powershell' };
      }
    } catch {}
  }
  return { shell: 'powershell.exe', kind: 'powershell' };
}
const SHELL = detectShell();

// Stable session token derived from the password; survives restarts so the
// login cookie stays valid until the password changes.
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update('kimistudio::' + APP_PASSWORD).digest('hex');

if (!APP_PASSWORD) console.warn('[config] WARNING: APP_PASSWORD is empty — login will reject everything.');
if (!OPENROUTER_API_KEY) console.warn('[config] WARNING: OPENROUTER_API_KEY is empty — the agent cannot call models.');

module.exports = {
  APP_ROOT, APP_PASSWORD, OPENROUTER_API_KEY, DEFAULT_MODEL,
  PROJECTS_ROOT, PORT, SESSION_SECRET, IS_WIN, SHELL,
};
