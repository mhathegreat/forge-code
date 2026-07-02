'use client';
import { useEffect, useState } from 'react';
import { X, Brain, Save, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function MemoryModal({ projectId, onClose }) {
  const [agents, setAgents] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const f = await api.file(projectId, 'AGENTS.md');
        if (live) setAgents(f.content || '');
      } catch { if (live) setAgents(''); }
      try {
        const m = await api.memory(projectId);
        if (live) setSummary(m);
      } catch {}
      if (live) setLoading(false);
    })();
    return () => { live = false; };
  }, [projectId]);

  async function save() {
    setSaving(true);
    try {
      await api.saveFile(projectId, 'AGENTS.md', agents);
      setDirty(false);
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[680px] max-h-[80vh] bg-ink-900 border border-ink-700 rounded-xl shadow-2xl flex flex-col"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-700">
          <Brain size={15} className="text-accent" />
          <div className="text-sm font-semibold flex-1">Project memory</div>
          {dirty && (
            <button
              onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1 text-xs bg-accent hover:bg-accent-hover rounded disabled:opacity-60"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
            </button>
          )}
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">
              AGENTS.md — persistent memory (editable; the agent reads this every session)
            </div>
            {loading ? (
              <div className="text-gray-600 text-sm py-4 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Loading…</div>
            ) : (
              <textarea
                value={agents}
                onChange={(e) => { setAgents(e.target.value); setDirty(true); }}
                rows={14}
                spellCheck={false}
                className="w-full bg-ink-950 border border-ink-700 rounded-lg p-3 text-[12.5px] font-mono outline-none focus:border-accent resize-y"
              />
            )}
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">
              Session memory — auto-compacted summary of older conversation
            </div>
            <div className="bg-ink-950 border border-ink-800 rounded-lg p-3 text-[12.5px] text-gray-400 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {summary && summary.summary
                ? summary.summary
                : 'Nothing compacted yet. Once the conversation grows long, older messages are automatically summarized here so the agent never loses the thread.'}
            </div>
            {summary && summary.updatedAt && (
              <div className="text-[10px] text-gray-600 mt-1">
                Covers {summary.coveredMessages} messages · updated {new Date(summary.updatedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
