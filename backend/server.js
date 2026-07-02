'use strict';
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { WebSocketServer } = require('ws');
const cookieLib = require('cookie');
const { URL } = require('url');

const { PORT } = require('./src/config');
const settings = require('./src/settings');
const auth = require('./src/auth');
const projects = require('./src/projects');
const { readFileText, writeFileText, listTree, resolveInProject } = require('./src/files');
const { runAgent } = require('./src/agent');
const { attachPty } = require('./src/pty');
const { subscribe } = require('./src/watcher');
const { listModels } = require('./src/models');
const { ApprovalBroker } = require('./src/approvals');
const { readMemory, maybeCompact } = require('./src/memory');

const COOKIE_NAME = 'forge_session';
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true })); // reflect origin, allow cookies

// ---------- auth ----------
function isAuthed(req) {
  return req.cookies && req.cookies[COOKIE_NAME] === auth.getSessionSecret();
}
function authedFromCookieHeader(header) {
  if (!header) return false;
  try { return cookieLib.parse(header)[COOKIE_NAME] === auth.getSessionSecret(); } catch { return false; }
}
function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'unauthorized' });
}
function setSessionCookie(res) {
  res.cookie(COOKIE_NAME, auth.getSessionSecret(), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

// First-run: does the app still need a password/key? (no auth — it's the
// signal the login page uses to decide which form to show; includes the
// provider catalog so the setup screen can offer a provider choice)
app.get('/api/setup-status', (req, res) => {
  const p = settings.getProvider();
  res.json({
    needsSetup: auth.needsSetup(),
    hasKey: !!p.apiKey || !p.needsKey,
    providers: settings.getPublic().providers.map(({ id, name, needsKey, custom, keyHint }) => ({ id, name, needsKey, custom, keyHint })),
  });
});

// First-run setup: create the password and optionally pick a provider +
// save its API key, all from the browser. Only works while unconfigured.
app.post('/api/setup', (req, res) => {
  if (!auth.needsSetup()) return res.status(403).json({ error: 'already configured' });
  const { password, provider, apiKey, baseUrl, name, openrouterApiKey } = req.body || {};
  if (!password || String(password).length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  auth.setPassword(String(password));
  try {
    const pid = provider || 'openrouter';
    if (provider) settings.set({ activeProvider: pid });
    const key = (apiKey || openrouterApiKey || '').trim(); // legacy field accepted
    if (key || baseUrl || name) {
      settings.setProviderConfig(pid, { apiKey: key || undefined, baseUrl, name });
    }
  } catch (e) { /* provider config is optional at setup */ }
  setSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!auth.verifyPassword(password)) {
    return res.status(401).json({ error: 'invalid password' });
  }
  setSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => res.json({ authed: isAuthed(req) }));
app.get('/api/health', (req, res) => res.json({ ok: true, app: 'forge-code' }));

// ---------- settings + models ----------
app.get('/api/settings', requireAuth, (req, res) => res.json(settings.getPublic()));

app.put('/api/settings', requireAuth, (req, res) => {
  try {
    const body = req.body || {};
    let passwordChanged = false;

    settings.set(body); // preference fields incl. activeProvider (whitelisted inside)

    if (body.newPassword !== undefined && body.newPassword !== '') {
      if (String(body.newPassword).length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
      }
      auth.setPassword(String(body.newPassword));
      passwordChanged = true; // old session cookies are now invalid
    }
    res.json({ ...settings.getPublic(), passwordChanged });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Save a provider's config (API key; base URL + name for the custom slot).
app.put('/api/providers/:id', requireAuth, (req, res) => {
  try {
    const { apiKey, baseUrl, name } = req.body || {};
    settings.setProviderConfig(req.params.id, { apiKey, baseUrl, name });
    res.json(settings.getPublic());
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Validate a key against a provider (the typed key, or the stored one).
app.post('/api/settings/test-key', requireAuth, async (req, res) => {
  const body = req.body || {};
  const p = settings.getProvider(body.providerId || undefined);
  const key = (body.key && String(body.key).trim()) || p.apiKey;
  if (p.needsKey && !key) return res.json({ valid: false, error: 'No key to test' });
  try {
    if (p.id === 'openrouter') {
      const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: 'Bearer ' + key } });
      if (!r.ok) return res.json({ valid: false, error: 'OpenRouter rejected the key (HTTP ' + r.status + ')' });
      const d = (await r.json()).data || {};
      return res.json({
        valid: true,
        label: d.label || null,
        usage: typeof d.usage === 'number' ? d.usage : null,
        freeTier: !!d.is_free_tier,
      });
    }
    // Generic check: can we list models with this key?
    let url = p.baseUrl + '/models';
    let headers = key ? { Authorization: 'Bearer ' + key } : {};
    if (p.id === 'anthropic') {
      url = 'https://api.anthropic.com/v1/models?limit=1';
      headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    }
    if (!p.baseUrl && p.id !== 'anthropic') return res.json({ valid: false, error: 'Base URL not set' });
    const r = await fetch(url, { headers });
    if (!r.ok) return res.json({ valid: false, error: `${p.name} rejected the request (HTTP ${r.status})` });
    res.json({ valid: true, label: p.name, usage: null, freeTier: false });
  } catch (e) {
    res.json({ valid: false, error: e.message });
  }
});

app.get('/api/models', requireAuth, async (req, res) => {
  try { res.json(await listModels()); }
  catch (e) { res.status(502).json({ error: e.message }); }
});

// ---------- projects ----------
app.get('/api/projects', requireAuth, async (req, res) => {
  try { res.json(await projects.listProjects()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/projects', requireAuth, async (req, res) => {
  try { res.json(await projects.createProject(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try { await projects.deleteProject(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/projects/:id/meta', requireAuth, async (req, res) => {
  try { res.json(await projects.getMeta(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

app.patch('/api/projects/:id/meta', requireAuth, async (req, res) => {
  try { res.json(await projects.patchMeta(req.params.id, req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/projects/:id/memory', requireAuth, async (req, res) => {
  try { res.json(await readMemory(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects/:id/tree', requireAuth, async (req, res) => {
  try { res.json(await listTree(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects/:id/file', requireAuth, async (req, res) => {
  try { res.json({ path: req.query.path, content: await readFileText(req.params.id, req.query.path) }); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

app.put('/api/projects/:id/file', requireAuth, async (req, res) => {
  try {
    const { path: p, content } = req.body || {};
    await writeFileText(req.params.id, p, content);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/projects/:id/chat', requireAuth, async (req, res) => {
  try { res.json(await projects.readChat(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- live preview (static project files) ----------
app.get('/preview/:id/*', requireAuth, (req, res) => {
  try {
    const rel = req.params[0] || 'index.html';
    const target = resolveInProject(req.params.id, rel);
    res.sendFile(target, (err) => { if (err && !res.headersSent) res.status(404).send('Not found'); });
  } catch (e) { res.status(400).send(e.message); }
});
app.get('/preview/:id', requireAuth, (req, res) => res.redirect(`/preview/${req.params.id}/index.html`));

// ---------- http + websocket server ----------
const server = http.createServer(app);
const wssAgent = new WebSocketServer({ noServer: true });
const wssPty = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  let pathname = '/';
  try { pathname = new URL(req.url, 'http://x').pathname; } catch {}
  if (!authedFromCookieHeader(req.headers.cookie)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  if (pathname === '/ws/agent') {
    wssAgent.handleUpgrade(req, socket, head, (ws) => wssAgent.emit('connection', ws, req));
  } else if (pathname === '/ws/pty') {
    wssPty.handleUpgrade(req, socket, head, (ws) => wssPty.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

// --- agent channel ---
wssAgent.on('connection', (ws, req) => {
  let busy = false;
  let unsub = null;

  const send = (obj) => { if (ws.readyState === ws.OPEN) { try { ws.send(JSON.stringify(obj)); } catch {} } };
  const broker = new ApprovalBroker(send);

  // Allow the client to subscribe to live FS changes for a project.
  function watch(projectId) {
    if (unsub) { unsub(); unsub = null; }
    if (projectId) unsub = subscribe(projectId, () => send({ type: 'fs_changed' }));
  }

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'watch') { watch(msg.projectId); return; }

    // Approval responses must be processed even while a run is in flight.
    if (msg.type === 'approval_response') {
      broker.respond(msg.id, msg.decision);
      return;
    }

    if (msg.type === 'chat') {
      if (busy) { send({ type: 'error', text: 'A task is already running.' }); return; }
      const { projectId, message } = msg;
      if (!projectId || !message) { send({ type: 'error', text: 'projectId and message required' }); return; }
      busy = true;

      try {
        const meta = await projects.getMeta(projectId);
        const globals = settings.get();
        const model = meta.model || globals.defaultModel;
        const permissionMode = meta.permissionMode || globals.defaultPermissionMode || 'ask';

        send({ type: 'run_start', model, permissionMode });

        const history = (await projects.readChat(projectId))
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role, content: m.content }));

        const toolLog = [];
        const emit = (ev) => {
          if (ev.type === 'tool_call') toolLog.push({ name: ev.name, args: ev.args });
          send(ev);
        };

        const finalText = await runAgent({
          projectId, userMessage: message, history, meta,
          emit, model, permissionMode, approvals: broker,
        });

        const chat = await projects.appendChat(
          projectId,
          { role: 'user', content: message, ts: Date.now() },
          { role: 'assistant', content: finalText, tools: toolLog, ts: Date.now() }
        );
        send({ type: 'run_end' });

        // Fire-and-forget: fold older conversation into the rolling summary.
        maybeCompact(projectId, model, chat).catch(() => {});
      } catch (e) {
        send({ type: 'error', text: e.message });
        send({ type: 'run_end' });
      } finally {
        busy = false;
      }
    }
  });

  ws.on('close', () => { if (unsub) unsub(); broker.denyAll(); });
  ws.on('error', () => { if (unsub) unsub(); broker.denyAll(); });
  send({ type: 'ready' });
});

// --- pty channel ---
wssPty.on('connection', (ws, req) => {
  let projectId = null;
  try { projectId = new URL(req.url, 'http://x').searchParams.get('project'); } catch {}
  if (!projectId) { ws.send('\r\n[Forge Code] No project specified.\r\n'); ws.close(); return; }
  attachPty(ws, projectId);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Forge Code] backend listening on http://localhost:${PORT}`);
  if (auth.needsSetup()) {
    console.log('[Forge Code] First run: open the app in your browser to create a password and add your OpenRouter key.');
  }
});
