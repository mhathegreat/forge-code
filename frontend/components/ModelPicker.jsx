'use client';
import { useMemo, useState } from 'react';
import { X, Search, Check, Loader2, Zap } from 'lucide-react';

function fmtPrice(m) {
  if (m.free) return null;
  const p = (m.promptPrice * 1e6).toFixed(2);
  const c = (m.completionPrice * 1e6).toFixed(2);
  return `$${p} in · $${c} out /M`;
}
function fmtCtx(n) {
  if (!n) return '';
  return n >= 1000 ? Math.round(n / 1000) + 'k ctx' : n + ' ctx';
}

export default function ModelPicker({ models, loading, current, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = models || [];
    if (freeOnly) list = list.filter((m) => m.free);
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((m) => m.id.toLowerCase().includes(s) || m.name.toLowerCase().includes(s));
    return list.slice(0, 120);
  }, [models, q, freeOnly]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-h-[70vh] bg-ink-900 border border-ink-700 rounded-xl shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-700">
          <div className="text-sm font-semibold">Choose model</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        <div className="px-4 py-2.5 flex items-center gap-3 border-b border-ink-800">
          <div className="flex-1 flex items-center gap-2 bg-ink-800 border border-ink-700 rounded-lg px-2.5 py-1.5 focus-within:border-accent">
            <Search size={14} className="text-gray-500" />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search all OpenRouter models…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
            <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} className="accent-[#7c5cff]" />
            <Zap size={12} className="text-green-400" /> Free only
          </label>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm py-10">
              <Loader2 size={15} className="animate-spin" /> Loading models…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center text-gray-600 text-sm py-10">No models match.</div>
          )}
          {!loading && filtered.map((m) => {
            const active = m.id === current;
            return (
              <div
                key={m.id}
                onClick={() => onSelect(m.id)}
                className={
                  'flex items-center gap-3 px-4 py-2 cursor-pointer border-b border-ink-800/50 ' +
                  (active ? 'bg-accent/15' : 'hover:bg-ink-800')
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-gray-200 truncate">{m.name}</div>
                  <div className="text-[11px] text-gray-500 font-mono truncate">{m.id}</div>
                </div>
                <div className="text-right shrink-0">
                  {m.free ? (
                    <span className="text-[10px] font-bold text-green-400 bg-green-400/10 border border-green-400/30 rounded px-1.5 py-0.5">FREE</span>
                  ) : (
                    <div className="text-[10px] text-gray-500">{fmtPrice(m)}</div>
                  )}
                  <div className="text-[10px] text-gray-600">{fmtCtx(m.context)}</div>
                </div>
                {active && <Check size={15} className="text-accent shrink-0" />}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t border-ink-700 text-[11px] text-gray-600">
          Applies to this project. Free models can be rate-limited by their upstream provider.
        </div>
      </div>
    </div>
  );
}
