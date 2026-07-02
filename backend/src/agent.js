'use strict';
const fsp = require('fs/promises');
const path = require('path');
const { OPENROUTER_API_KEY } = require('./config');
const { toolDefs, execTool } = require('./tools');
const { buildSystemPrompt } = require('./systemPrompt');
const { listTree, projectDir, existsSync } = require('./files');
const { readMemory } = require('./memory');

const MAX_ITERS = 30;

function truncate(s, n) {
  s = String(s == null ? '' : s);
  return s.length > n ? s.slice(0, n) + '\n... [truncated]' : s;
}

// Human-reviewable preview attached to approval requests.
function buildPreview(projectId, name, args = {}) {
  try {
    if (name === 'write_file') {
      const exists = existsSync(projectId, args.path);
      return {
        kind: 'write',
        path: args.path,
        exists,
        bytes: Buffer.byteLength(args.content || '', 'utf8'),
        snippet: String(args.content || '').slice(0, 700),
      };
    }
    if (name === 'run_command') return { kind: 'command', command: args.command };
    if (name === 'delete_file') return { kind: 'delete', path: args.path };
    if (name === 'create_folder') return { kind: 'folder', path: args.path };
  } catch {}
  return {};
}

// Stream one chat completion. Emits {type:'token'} for text deltas.
// Returns { text, toolCalls, finishReason }.
async function streamCompletion(messages, emit, model) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + OPENROUTER_API_KEY,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3001',
      'X-Title': 'Forge Code',
    },
    body: JSON.stringify({
      model,
      messages,
      tools: toolDefs,
      tool_choice: 'auto',
      temperature: 0.3,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '');
    throw new Error('OpenRouter ' + res.status + ': ' + body.slice(0, 500));
  }

  let text = '';
  const toolMap = {}; // index -> {id,type,function:{name,arguments}}
  let finishReason = null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line || !line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      let json;
      try { json = JSON.parse(data); } catch { continue; }
      const choice = json.choices && json.choices[0];
      if (!choice) continue;
      const delta = choice.delta || {};
      if (delta.content) {
        text += delta.content;
        emit({ type: 'token', text: delta.content });
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tcd of delta.tool_calls) {
          const idx = tcd.index == null ? 0 : tcd.index;
          if (!toolMap[idx]) toolMap[idx] = { id: tcd.id || 'call_' + idx, type: 'function', function: { name: '', arguments: '' } };
          const slot = toolMap[idx];
          if (tcd.id) slot.id = tcd.id;
          if (tcd.function && tcd.function.name) slot.function.name += tcd.function.name;
          if (tcd.function && tcd.function.arguments) slot.function.arguments += tcd.function.arguments;
        }
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }

  const toolCalls = Object.keys(toolMap)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => toolMap[k])
    .filter((tc) => tc.function && tc.function.name);

  return { text, toolCalls, finishReason };
}

// Run the full agentic loop for one user message.
// history: full persisted chat [{role:'user'|'assistant', content}]
// approvals: ApprovalBroker or null; permissionMode: 'ask'|'auto-edit'|'auto'
async function runAgent({
  projectId, userMessage, history = [], meta = {},
  emit = () => {}, model, permissionMode = 'ask', approvals = null,
}) {
  const tree = await listTree(projectId);
  let agents = '';
  try { agents = await fsp.readFile(path.join(projectDir(projectId), 'AGENTS.md'), 'utf8'); } catch {}
  const mem = await readMemory(projectId);

  const messages = [{
    role: 'system',
    content: buildSystemPrompt({ projectId, meta, agents, tree, memorySummary: mem.summary }),
  }];

  // Recent messages verbatim; everything older is covered by the memory summary.
  const recent = history.slice(mem.coveredMessages || 0).slice(-12);
  for (const h of recent) {
    if (h && (h.role === 'user' || h.role === 'assistant') && h.content) {
      messages.push({ role: h.role, content: String(h.content).slice(0, 8000) });
    }
  }
  messages.push({ role: 'user', content: userMessage });

  let finalText = '';

  for (let iter = 0; iter < MAX_ITERS; iter++) {
    emit({ type: 'status', text: iter === 0 ? 'thinking' : 'continuing' });

    let result;
    try {
      result = await streamCompletion(messages, emit, model);
    } catch (e) {
      emit({ type: 'error', text: 'Model error: ' + e.message });
      throw e;
    }

    const { text, toolCalls } = result;
    finalText = text || finalText;

    const assistantMsg = { role: 'assistant', content: text || '' };
    if (toolCalls.length) assistantMsg.tool_calls = toolCalls;
    messages.push(assistantMsg);

    if (!toolCalls.length) {
      emit({ type: 'assistant_done', content: finalText });
      return finalText;
    }

    // Execute each tool call sequentially, gated by the permission mode.
    for (const tc of toolCalls) {
      let args = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch { args = {}; }
      const name = tc.function.name;
      emit({ type: 'tool_call', id: tc.id, name, args });

      let out;
      if (approvals && approvals.needsApproval(permissionMode, name)) {
        const decision = await approvals.request({ name, args, preview: buildPreview(projectId, name, args) });
        if (decision !== 'allow') {
          out = 'USER DENIED this action. Do not retry it verbatim — explain what you wanted, then adapt or ask the user how to proceed.';
          emit({ type: 'tool_result', id: tc.id, name, result: out, denied: true });
          messages.push({ role: 'tool', tool_call_id: tc.id, content: out });
          continue;
        }
      }

      try {
        out = await execTool(projectId, name, args, emit);
      } catch (e) {
        out = 'ERROR: ' + e.message;
      }

      emit({ type: 'tool_result', id: tc.id, name, result: truncate(out, 4000) });
      messages.push({ role: 'tool', tool_call_id: tc.id, content: truncate(out, 12000) });
    }

    // Filesystem likely changed — tell the client to refresh tree/editor.
    emit({ type: 'fs_changed' });
  }

  emit({ type: 'notice', text: 'Reached the maximum number of tool iterations (' + MAX_ITERS + ').' });
  emit({ type: 'assistant_done', content: finalText });
  return finalText;
}

module.exports = { runAgent };
