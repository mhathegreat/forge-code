'use strict';
const pty = require('node-pty');
const { projectDir } = require('./files');

// Attach a PTY (bash) to a websocket connection. The PTY's cwd is the project
// directory so the user's terminal is scoped to the project they're working on.
function attachPty(ws, projectId) {
  const cwd = projectDir(projectId);
  let shell;
  try {
    shell = pty.spawn('/bin/bash', ['-l'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  } catch (e) {
    try { ws.send('\r\n[KimiStudio] Failed to start terminal: ' + e.message + '\r\n'); } catch {}
    return;
  }

  shell.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      try { ws.send(data); } catch {}
    }
  });

  shell.onExit(() => {
    if (ws.readyState === ws.OPEN) {
      try { ws.send('\r\n[process exited — reconnect to start a new shell]\r\n'); } catch {}
    }
  });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === 'data' && typeof msg.data === 'string') {
      shell.write(msg.data);
    } else if (msg.type === 'resize') {
      try { shell.resize(Math.max(2, msg.cols | 0), Math.max(1, msg.rows | 0)); } catch {}
    }
  });

  ws.on('close', () => { try { shell.kill(); } catch {} });
  ws.on('error', () => { try { shell.kill(); } catch {} });
}

module.exports = { attachPty };
