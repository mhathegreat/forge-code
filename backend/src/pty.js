'use strict';
// Prefer @lydell/node-pty (ships prebuilt binaries for every platform — no
// compiler toolchain needed on Windows); fall back to node-pty if present.
let pty;
try { pty = require('@lydell/node-pty'); }
catch { pty = require('node-pty'); }

const { SHELL, IS_WIN } = require('./config');
const { projectDir } = require('./files');

// Attach a PTY to a websocket connection. The PTY's cwd is the project
// directory so the terminal is scoped to the project being worked on.
function attachPty(ws, projectId) {
  const cwd = projectDir(projectId);
  const args = SHELL.kind === 'bash' ? (IS_WIN ? [] : ['-l']) : ['-NoLogo'];
  let shell;
  try {
    shell = pty.spawn(SHELL.shell, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  } catch (e) {
    try { ws.send('\r\n[Forge] Failed to start terminal: ' + e.message + '\r\n'); } catch {}
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
