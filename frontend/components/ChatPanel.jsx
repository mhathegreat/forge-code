'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Send, FilePlus, FileSearch, Pencil, Terminal as TerminalIcon, FolderPlus,
  Trash2, Search, Loader2, CheckCircle2, Sparkles, User,
} from 'lucide-react';

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
      {tool.done ? <CheckCircle2 size={13} className="text-green-500/80" /> : <Loader2 size={13} className="text-gray-500 animate-spin" />}
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
          {isUser ? 'You' : 'Kimi'}
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

export default function ChatPanel({ messages, busy, status, onSend, projectSelected }) {
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, status]);

  function submit() {
    const text = input.trim();
    if (!text || busy || !projectSelected) return;
    onSend(text);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
  }

  return (
    <div className="w-[380px] shrink-0 bg-ink-900 border-l border-ink-700 flex flex-col min-h-0">
      <div className="px-3 py-2.5 border-b border-ink-700 flex items-center gap-2">
        <Sparkles size={15} className="text-accent" />
        <span className="text-sm font-semibold">AI Agent</span>
        <span className="text-[11px] text-gray-500 ml-auto font-mono">kimi-k2.6</span>
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
            placeholder={projectSelected ? 'Ask Kimi to build something…  (Enter to send)' : 'Select a project first'}
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
