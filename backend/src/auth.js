'use strict';
const crypto = require('crypto');
const settings = require('./settings');
const { APP_PASSWORD } = require('./config');

// Auth is dynamic: the password can come from the first-run setup screen
// (stored as a sha256 hash in settings.json) or from APP_PASSWORD in .env.
// The in-app value wins. The session cookie value is derived from the
// password hash, so changing the password invalidates all sessions.

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function getPasswordHash() {
  const r = settings.raw();
  if (r.passwordHash) return r.passwordHash;
  if (APP_PASSWORD) return sha(APP_PASSWORD);
  return null;
}

// True when no password is configured anywhere → show the setup screen.
function needsSetup() {
  return !getPasswordHash();
}

function verifyPassword(pw) {
  const h = getPasswordHash();
  return !!h && typeof pw === 'string' && pw.length > 0 && sha(pw) === h;
}

function setPassword(pw) {
  settings.setSecret({ passwordHash: sha(String(pw)) });
}

function getSessionSecret() {
  return sha('forge-code-session::' + (getPasswordHash() || 'unconfigured'));
}

module.exports = { needsSetup, verifyPassword, setPassword, getSessionSecret };
