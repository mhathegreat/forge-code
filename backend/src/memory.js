'use strict';
const fsp = require('fs/promises');
const path = require('path');
const { getApiKey } = require('./settings');
const { projectDir } = require('./files');

// Session memory = a rolling summary of older conversation, per project.
// The full transcript stays in chat.json (the UI shows all of it); the model's
// context gets [summary of everything old] + [recent messages verbatim], so
// long sessions never silently fall out of the window.

function memPath(id) { return path.join(projectDir(id), 'memory.json'); }

async function readMemory(id) {
  try { return JSON.parse(await fsp.readFile(memPath(id), 'utf8')); }
  catch { return { summary: '', coveredMessages: 0, updatedAt: null }; }
}

async function writeMemory(id, mem) {
  await fsp.writeFile(memPath(id), JSON.stringify(mem, null, 2));
}

function estTokens(s) { return Math.ceil(String(s || '').length / 4); }
function historyTokens(h) { return h.reduce((n, m) => n + estTokens(m.content), 0); }

const KEEP_RECENT = 8;        // messages always kept verbatim
const TRIGGER_TOKENS = 9000;  // compact once the un-summarized tail exceeds this
const TRIGGER_MSGS = 16;

// Fold older chat into the rolling summary. Cheap no-op most of the time.
async function maybeCompact(projectId, model, chat) {
  const mem = await readMemory(projectId);
  const fresh = chat.slice(mem.coveredMessages || 0);
  if (fresh.length <= KEEP_RECENT) return null;
  const toSummarize = fresh.slice(0, fresh.length - KEEP_RECENT);
  if (historyTokens(toSummarize) < TRIGGER_TOKENS && toSummarize.length < TRIGGER_MSGS) return null;

  const convo = toSummarize
    .map((m) => `${String(m.role || '').toUpperCase()}: ${String(m.content || '').slice(0, 3000)}`)
    .join('\n\n');
  const prompt = `You maintain the long-term session memory for an autonomous coding agent working on one project.

EXISTING MEMORY (may be empty):
${mem.summary || '(none)'}

NEW CONVERSATION TO FOLD IN:
${convo}

Rewrite the memory as one dense, factual summary (max ~400 words) covering: what the user asked for, what was built or changed (files, stack, commands), key decisions and why, open issues/bugs, and the user's preferences. Keep only durable facts. Output ONLY the summary text.`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + getApiKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 700 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const summary = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    if (!summary) return null;
    const next = {
      summary: summary.trim(),
      coveredMessages: (mem.coveredMessages || 0) + toSummarize.length,
      updatedAt: new Date().toISOString(),
    };
    await writeMemory(projectId, next);
    return next;
  } catch {
    return null;
  }
}

module.exports = { readMemory, writeMemory, maybeCompact, KEEP_RECENT };
