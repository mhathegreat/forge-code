'use strict';
const path = require('path');
const crypto = require('crypto');

// Load .env from the project root (one level above /backend)
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const APP_PASSWORD = process.env.APP_PASSWORD || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const MODEL = process.env.KIMI_MODEL || 'moonshotai/kimi-k2.6';
const PROJECTS_ROOT = process.env.PROJECTS_ROOT || '/mnt/data/kimi-projects';
const PORT = parseInt(process.env.BACKEND_PORT || '4000', 10);

// Stable session token derived from the password; survives restarts so the
// login cookie stays valid until the password changes.
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update('kimistudio::' + APP_PASSWORD).digest('hex');

if (!APP_PASSWORD) console.warn('[config] WARNING: APP_PASSWORD is empty — login will reject everything.');
if (!OPENROUTER_API_KEY) console.warn('[config] WARNING: OPENROUTER_API_KEY is empty — the agent cannot call the model.');

module.exports = { APP_PASSWORD, OPENROUTER_API_KEY, MODEL, PROJECTS_ROOT, PORT, SESSION_SECRET };
