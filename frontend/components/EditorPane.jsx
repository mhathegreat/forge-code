'use client';
import dynamic from 'next/dynamic';
import { X, Save, Circle } from 'lucide-react';
import { langForPath } from '@/lib/api';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Loading editor…</div>,
});

export default function EditorPane({ tabs, activePath, onActivate, onClose, onChange, onSave }) {
  const active = tabs.find((t) => t.path === activePath);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-ink-950">
      {/* Tab bar */}
      <div className="flex items-stretch bg-ink-900 border-b border-ink-700 overflow-x-auto">
        {tabs.length === 0 && (
          <div className="px-4 py-2 text-xs text-gray-600">No file open</div>
        )}
        {tabs.map((t) => (
          <div
            key={t.path}
            onClick={() => onActivate(t.path)}
            className={
              'group flex items-center gap-2 pl-3 pr-2 py-2 text-[12.5px] border-r border-ink-700 cursor-pointer whitespace-nowrap ' +
              (t.path === activePath ? 'bg-ink-950 text-white' : 'bg-ink-900 text-gray-400 hover:text-gray-200')
            }
          >
            <span>{t.path.split('/').pop()}</span>
            {t.dirty ? (
              <Circle size={8} className="fill-accent text-accent" />
            ) : (
              <span className="w-2" />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(t.path); }}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-200"
            >
              <X size={13} />
            </button>
          </div>
        ))}
        <div className="flex-1" />
        {active && active.dirty && (
          <button
            onClick={() => onSave(active.path)}
            className="px-3 my-1 mr-2 text-xs flex items-center gap-1.5 bg-accent/20 hover:bg-accent/30 text-accent rounded"
            title="Save (Ctrl+S)"
          >
            <Save size={13} /> Save
          </button>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        {active ? (
          <MonacoEditor
            height="100%"
            theme="vs-dark"
            path={active.path}
            language={langForPath(active.path)}
            value={active.content}
            onChange={(val) => onChange(active.path, val ?? '')}
            onMount={(editor, monaco) => {
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSave(active.path));
            }}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
              padding: { top: 10 },
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-700 text-sm">
            Select a file from the sidebar, or ask the AI to build something.
          </div>
        )}
      </div>
    </div>
  );
}
