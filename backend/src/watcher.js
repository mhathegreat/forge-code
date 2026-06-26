'use strict';
const chokidar = require('chokidar');
const { projectDir } = require('./files');

// Watches project directories and broadcasts a debounced "fs_changed" to any
// subscribed websocket clients. Watchers are reference-counted: created on the
// first subscriber for a project, torn down when the last one leaves. This keeps
// the editor/file-tree live even when files are created via the terminal.
const watchers = new Map(); // projectId -> { watcher, subs:Set<fn>, timer }

function subscribe(projectId, fn) {
  let entry = watchers.get(projectId);
  if (!entry) {
    const watcher = chokidar.watch(projectDir(projectId), {
      ignored: /(^|[\/\\])(node_modules|\.git|\.next|dist|build|\.cache)([\/\\]|$)/,
      ignoreInitial: true,
      depth: 12,
      awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 50 },
    });
    entry = { watcher, subs: new Set(), timer: null };
    const fire = () => {
      if (entry.timer) return;
      entry.timer = setTimeout(() => {
        entry.timer = null;
        for (const s of entry.subs) { try { s(); } catch {} }
      }, 200);
    };
    watcher.on('add', fire).on('unlink', fire).on('addDir', fire).on('unlinkDir', fire).on('change', fire);
    watchers.set(projectId, entry);
  }
  entry.subs.add(fn);

  return function unsubscribe() {
    const e = watchers.get(projectId);
    if (!e) return;
    e.subs.delete(fn);
    if (e.subs.size === 0) {
      try { e.watcher.close(); } catch {}
      if (e.timer) clearTimeout(e.timer);
      watchers.delete(projectId);
    }
  };
}

module.exports = { subscribe };
