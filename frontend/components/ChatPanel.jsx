'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Send, FilePlus, FileSearch, Pencil, Terminal as TerminalIcon, FolderPlus,
  Trash2, Search, Loader2, CheckCircle2, XCircle, Sparkles, User, Brain,
  ShieldAlert, Cpu,
} from 'lucide-react';
import { shortModel, MODE_LABELS } from '@/lib/api';

function toolMeta(name, args = {}) {
  switch (name) {
    case 'write_file': return { icon: <FilePlus size={13} />, label: 'Writing', detail: args.path };
    case 'read_file': return { icon: <FileSearch size={13} />, label: 'Reading', detail: args.path };
    case 'create_folder': return { icon: <FolderPlus size={13} />, label: 'New folder', detail: args.path };
    case 'run_command': return { icon: <TerminalIcon size={13} />, label: 'Running', detail: args.command };
    case 'list_files': return { icon: <FileSearch size={13} />, label: 'Listing', detail: args.path || '.' };
    case 'delete_file': return { icon: <Trash2 size={13} />, label: 'Deleting', detail: args.path };
    case 'search_files': return { icon: <Search size={13} />, label: 'Searching', detail: args.query };
    default: return { icon: <Pencil size={13} />, label: name, detail: '' };
  }
}

// Very light renderer: splits ``` fenced code blocks from prose.
function renderContent(text) {
  if (!text) return null;
  const parts = text.split(/```/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const nl = part.indexOf('\n');
      const code = nl >= 0 ? part.slice(nl + 1) : part;
      return <pre key={i}><code>{code}</code></pre>;
    }
    return <span key={i} className="whitespace-pre-wrap">{part}</span>;
  });
}

function ToolCard({ tool }) {
  const m = toolMeta(tool.name, tool.args);
  return (
    <div className="flex items-center gap-2 my-1 px-2.5 py-1.5 bg-ink-850 border border-ink-700 rounded-lg text-[12px]">
      <span className="text-accent">{m.icon}</span>
      <span className="text-gray-300 font-medium">{m.label}</span>
      {m.detail && <span className="text-gray-500 font-mono truncate flex-1">{String(m.detail).slice(0, 80)}</span>}
      {tool.denied
        ? <XCircle size={13} className="text-red-400/90" />
        : tool.done
          ? <CheckCircle2 size={13} className="text-green-500/80" />
          : <Loader2 size={13} className="text-gray-500 animate-spin" />}
    </div>
  );
}

function Message({ m }) {
  const isUser = m.role === 'user';
  return (
    <div className="px-3 py-3 border-b border-ink-800/60">
      <div className="flex items-center gap-2 mb-1.5">
        {isUser ? <User size={13} className="text-gray-500" /> : <Sparkles size={13} className="text-accent" />}
        <span className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
          {isUser ? 'You' : 'Forge'}
        </span>
      </div>
      {!isUser && m.tools && m.tools.length > 0 && (
        <div className="mb-2">{m.tools.map((t, i) => <ToolCard key={t.id || i} tool={t} />)}</div>
      )}
      <div className={'prose-chat text-[13.5px] leading-relaxed ' + (isUser ? 'text-gray-200' : 'text-gray-100')}>
        {renderContent(m.content)}
        {m.streaming && !m.content && <span className="text-gray-500 text-xs">thinking…</span>}
        {m.streaming && m.content && <span className="cursor-blink" />}
      </div>
    </div>
  );
}

function approvalDetail(a) {
  if (!a) return { title: '', detail: '' };
  const p = a.preview || {};
  switch (a.name) {
    case 'run_command':
      return { title: 'Run command', detail: p.command || (a.args && a.args.command) || '' };
    case 'write_file':
      return {
        title: (p.exists ? 'Overwrite file' : 'Create file'),
        detail: (p.path || (a.args && a.args.path) || '') + (p.bytes ? `  (${p.bytes} bytes)` : ''),
        snippet: p.snippet,
      };
    case 'delete_file':
      return { title: 'Delete', detail: p.path || (a.args && a.args.path) || '' };
    case 'create_folder':
      return { title: 'Create folder', detail: p.path || (a.args && a.args.path) || '' };
    default:
      return { title: a.name, detail: JSON.stringify(a.args || {}).slice(0, 120) };
  }
}

function ApprovalCard({ approval, onRespond }) {
  const d = approvalDetail(approval);
  return (
    <div className="border-t border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5">
      <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
        <ShieldAlert size={14} /> Permission required — {d.title}
      </div>
      <div className="font-mono text-[12px] mt-1 text-gray-300 break-all">{d.detail}</div>
      {d.snippet && (
        <pre className="mt-1.5 max-h-28 overflow-auto bg-ink-950 border border-ink-700 rounded p-2 text-[11px] text-gray-400">
          {d.snippet}
        </pre>
      )}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onRespond('allow')}
          className="px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-white rounded-md"
        >
          Allow
        </button>
        <button
          onClick={() => onRespond('allow_always')}
          className="px-3 py-1.5 text-xs text-gray-300 bg-ink-800 hover:bg-ink-750 border border-ink-700 rounded-md"
          title="Allow this tool without asking for the rest of this session"
        >
          Always allow
        </button>
        <button
          onClick={() => onRespond('deny')}
          className="px-3 py-1.5 text-xs text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-md"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

export default function ChatPanel({
  messages, busy, status, onSend, projectSelected,
  model, mode, onOpenModelPicker, onModeChange, onOpenMemory,
  pendingApproval, onApproval,
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, status, pendingApproval]);

  function submit() {
    const text = input.trim();
    if (!text || busy || !projectSelected) return;
    onSend(text);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
  }

  return (
    <div className="w-[380px] shrink-0 bg-ink-900 border-l border-ink-700 flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-ink-700 flex items-center gap-2">
        <Sparkles size={15} className="text-accent shrink-0" />
        <span className="text-sm font-semibold shrink-0">Agent</span>
        <button
          onClick={onOpenModelPicker}
          disabled={!projectSelected}
          title={model || 'Choose model'}
          className="flex items-center gap-1 min-w-0 ml-1 px-2 py-1 text-[11px] font-mono bg-ink-800 hover:bg-ink-750 border border-ink-700 rounded-md text-gray-300 disabled:opacity-40"
        >
          <Cpu size={11} className="text-accent shrink-0" />
          <span className="truncate">{model ? shortModel(model) : '…'}</span>
        </button>
        <select
          value={mode || 'ask'}
          disabled={!projectSelected}
          onChange={(e) => onModeChange(e.target.value)}
          title="Permission mode"
          className="text-[11px] bg-ink-800 border border-ink-700 rounded-md px-1.5 py-1 text-gray-300 outline-none disabled:opacity-40"
        >
          {Object.entries(MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button
          onClick={onOpenMemory}
          disabled={!projectSelected}
          title="Project memory (AGENTS.md + session summary)"
          className="text-gray-400 hover:text-accent disabled:opacity-40 shrink-0"
        >
          <Brain size={15} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {(!messages || messages.length === 0) && (
          <div className="text-center text-gray-600 text-sm px-6 py-10">
            {projectSelected ? (
              <>
                <Sparkles size={22} className="mx-auto mb-3 text-accent/60" />
                Describe what you want to build.<br />
                <span className="text-xs text-gray-700">e.g. “build me a portfolio website with a projects gallery”</span>
              </>
            ) : (
              'Select or create a project to start chatting.'
            )}
          </div>
        )}
        {messages && messages.map((m, i) => <Message key={i} m={m} />)}
        {busy && status && (
          <div className="px-3 py-2 text-[11px] text-gray-500 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" /> {status}
          </div>
        )}
      </div>

      {pendingApproval && <ApprovalCard approval={pendingApproval} onRespond={onApproval} />}

      <div className="border-t border-ink-700 p-2.5">
        <div className="flex items-end gap-2 bg-ink-800 border border-ink-700 rounded-xl px-3 py-2 focus-within:border-accent transition">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            disabled={!projectSelected}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder={projectSelected ? 'Ask Forge to build something…  (Enter to send)' : 'Select a project first'}
            className="flex-1 bg-transparent text-sm outline-none resize-none max-h-40 disabled:opacity-50"
          />
          <button
            onClick={submit}
            disabled={busy || !input.trim() || !projectSelected}
            className="text-accent disabled:text-gray-700 hover:text-accent-hover shrink-0 pb-0.5"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
