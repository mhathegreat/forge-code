'use strict';
const crypto = require('crypto');

// Read-only tools never need approval.
const SAFE = new Set(['read_file', 'list_files', 'search_files']);

// What each permission mode requires approval for.
const MODE_RULES = {
  ask: new Set(['write_file', 'create_folder', 'delete_file', 'run_command']),
  'auto-edit': new Set(['delete_file', 'run_command']),
  auto: new Set(),
};

// One broker per agent websocket connection. The agent loop blocks on
// request() until the UI answers (or the socket dies → deny).
class ApprovalBroker {
  constructor(send) {
    this.send = send;
    this.pending = new Map(); // id -> { resolve, name }
    this.always = new Set();  // tool names allowed for the rest of the session
  }

  needsApproval(mode, tool) {
    if (SAFE.has(tool)) return false;
    if (this.always.has(tool)) return false;
    const rules = MODE_RULES[mode] || MODE_RULES.ask;
    return rules.has(tool);
  }

  request({ name, args, preview }) {
    const id = 'ap_' + crypto.randomBytes(6).toString('hex');
    return new Promise((resolve) => {
      this.pending.set(id, { resolve, name });
      this.send({ type: 'approval_request', id, name, args, preview });
    });
  }

  respond(id, decision) {
    const p = this.pending.get(id);
    if (!p) return false;
    this.pending.delete(id);
    if (decision === 'allow_always') {
      this.always.add(p.name);
      decision = 'allow';
    }
    p.resolve(decision === 'allow' ? 'allow' : 'deny');
    this.send({ type: 'approval_resolved', id, decision });
    return true;
  }

  denyAll() {
    for (const [, p] of this.pending) p.resolve('deny');
    this.pending.clear();
  }
}

module.exports = { ApprovalBroker, MODE_RULES };
