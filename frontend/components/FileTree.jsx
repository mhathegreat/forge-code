'use client';
import { useState } from 'react';
import {
  ChevronRight, ChevronDown, File as FileIcon, FileCode, FileJson,
  FileText, Folder, FolderOpen,
} from 'lucide-react';

function iconFor(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) return <FileCode size={14} className="text-yellow-400/80" />;
  if (ext === 'json') return <FileJson size={14} className="text-amber-400/80" />;
  if (['md', 'txt'].includes(ext)) return <FileText size={14} className="text-gray-400" />;
  if (['html', 'css', 'scss'].includes(ext)) return <FileCode size={14} className="text-sky-400/80" />;
  return <FileIcon size={14} className="text-gray-500" />;
}

function Node({ node, depth, activePath, onOpen }) {
  const [open, setOpen] = useState(depth < 1);
  const pad = { paddingLeft: 6 + depth * 12 };

  if (node.type === 'dir') {
    return (
      <div>
        <div
          style={pad}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 py-[3px] pr-2 text-[13px] text-gray-300 hover:bg-ink-800 rounded cursor-pointer select-none"
        >
          {open ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
          {open ? <FolderOpen size={14} className="text-accent/80" /> : <Folder size={14} className="text-accent/70" />}
          <span className="truncate">{node.name}</span>
        </div>
        {open && node.children && node.children.map((c) => (
          <Node key={c.path} node={c} depth={depth + 1} activePath={activePath} onOpen={onOpen} />
        ))}
      </div>
    );
  }

  const active = node.path === activePath;
  return (
    <div
      style={pad}
      onClick={() => onOpen(node.path)}
      className={
        'flex items-center gap-1.5 py-[3px] pr-2 text-[13px] rounded cursor-pointer select-none ' +
        (active ? 'bg-accent/20 text-white' : 'text-gray-400 hover:bg-ink-800')
      }
    >
      <span className="w-[13px]" />
      {iconFor(node.name)}
      <span className="truncate">{node.name}</span>
    </div>
  );
}

export default function FileTree({ tree, activePath, onOpen }) {
  if (!tree || tree.length === 0) {
    return <div className="text-xs text-gray-600 px-3 py-4">No files yet. Ask the AI to build something.</div>;
  }
  return (
    <div className="py-1">
      {tree.map((n) => (
        <Node key={n.path} node={n} depth={0} activePath={activePath} onOpen={onOpen} />
      ))}
    </div>
  );
}
