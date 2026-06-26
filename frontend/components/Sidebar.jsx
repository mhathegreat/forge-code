'use client';
import { useState } from 'react';
import FileTree from './FileTree';
import { Plus, Trash2, FolderGit2, X, Loader2 } from 'lucide-react';

function NewProjectModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stack, setStack] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await onCreate({ name: name.trim(), description: description.trim(), stack: stack.trim() });
    } catch (e2) {
      setErr(e2.message || 'Failed to create');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-[420px] bg-ink-900 border border-ink-700 rounded-xl p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">New Project</div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={16} />
          </button>
        </div>
        <label className="block text-xs text-gray-400 mb-1">Project name *</label>
        <input
          autoFocus value={name} onChange={(e) => setName(e.target.value)}
          placeholder="my-portfolio"
          className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent mb-3"
        />
        <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
        <textarea
          value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          placeholder="A personal portfolio site with a projects gallery"
          className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent mb-3 resize-none"
        />
        <label className="block text-xs text-gray-400 mb-1">Stack preference (optional)</label>
        <input
          value={stack} onChange={(e) => setStack(e.target.value)}
          placeholder="Next.js + Tailwind (leave blank to auto-detect)"
          className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent mb-1"
        />
        {err && <div className="text-red-400 text-xs mt-2">{err}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover rounded-lg flex items-center gap-2 disabled:opacity-60">
            {busy && <Loader2 size={14} className="animate-spin" />} Create
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Sidebar({
  projects, current, tree, activePath,
  onSelect, onCreate, onDelete, onOpenFile,
}) {
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="w-64 shrink-0 bg-ink-900 border-r border-ink-700 flex flex-col min-h-0">
      {/* Projects */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Projects</div>
        <button onClick={() => setShowNew(true)} title="New project" className="text-gray-400 hover:text-accent">
          <Plus size={16} />
        </button>
      </div>
      <div className="max-h-44 overflow-y-auto px-2">
        {projects.length === 0 && <div className="text-xs text-gray-600 px-2 py-2">No projects yet.</div>}
        {projects.map((p) => (
          <div
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={
              'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-[13px] ' +
              (current === p.id ? 'bg-accent/20 text-white' : 'text-gray-300 hover:bg-ink-800')
            }
          >
            <FolderGit2 size={14} className={current === p.id ? 'text-accent' : 'text-gray-500'} />
            <span className="truncate flex-1">{p.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm(`Delete project "${p.name}"? This removes its files.`)) onDelete(p.id); }}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400"
              title="Delete project"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-ink-700 mt-2" />

      {/* File tree */}
      <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
        {current ? 'Files' : ''}
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 min-h-0">
        {current ? (
          <FileTree tree={tree} activePath={activePath} onOpen={onOpenFile} />
        ) : (
          <div className="text-xs text-gray-600 px-3 py-4">Select or create a project to begin.</div>
        )}
      </div>

      {showNew && (
        <NewProjectModal
          onClose={() => setShowNew(false)}
          onCreate={async (body) => { await onCreate(body); setShowNew(false); }}
        />
      )}
    </div>
  );
}
