'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, wsBase } from '@/lib/api';
import Login from '@/components/Login';
import Sidebar from '@/components/Sidebar';
import EditorPane from '@/components/EditorPane';
import ChatPanel from '@/components/ChatPanel';
import TerminalPane from '@/components/TerminalPane';
import PreviewPane from '@/components/PreviewPane';
import ModelPicker from '@/components/ModelPicker';
import MemoryModal from '@/components/MemoryModal';
import { Terminal as TerminalIcon, Eye, Code2, LogOut, Loader2, Hammer } from 'lucide-react';

export default function Home() {
  const [authed, setAuthed] = useState(null); // null = loading
  const [projects, setProjects] = useState([]);
  const [current, setCurrent] = useState(null);
  const [meta, setMeta] = useState(null);
  const [tree, setTree] = useState([]);
  const [globalSettings, setGlobalSettings] = useState(null);

  const [tabs, setTabs] = useState([]); // {path, content, dirty}
  const [activePath, setActivePath] = useState(null);

  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [pendingApproval, setPendingApproval] = useState(null);

  const [showTerminal, setShowTerminal] = useState(true);
  const [centerView, setCenterView] = useState('editor'); // 'editor' | 'preview'
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [modelsList, setModelsList] = useState(null);
  const [modelsLoading, setModelsLoading] = useState(false);

  const wsRef = useRef(null);
  const currentRef = useRef(null);
  const tabsRef = useRef([]);
  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);

  // Effective per-project settings (project override → global default).
  const effModel = (meta && meta.model) || (globalSettings && globalSettings.defaultModel) || '';
  const effMode = (meta && meta.permissionMode) || (globalSettings && globalSettings.defaultPermissionMode) || 'ask';

  // ---------- auth ----------
  useEffect(() => {
    api.me().then((r) => setAuthed(!!r.authed)).catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed) {
      refreshProjects();
      api.settings().then(setGlobalSettings).catch(() => {});
    }
  }, [authed]);

  // ---------- agent websocket ----------
  useEffect(() => {
    if (!authed) return;
    let closed = false;
    function connect() {
      const ws = new WebSocket(`${wsBase()}/ws/agent`);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        handleAgentEvent(m);
      };
      ws.onopen = () => { if (currentRef.current) ws.send(JSON.stringify({ type: 'watch', projectId: currentRef.current })); };
      ws.onclose = () => { if (!closed) setTimeout(connect, 1500); };
      ws.onerror = () => { try { ws.close(); } catch {} };
    }
    connect();
    return () => { closed = true; try { wsRef.current && wsRef.current.close(); } catch {} };
  }, [authed]);

  const patchLast = useCallback((fn) => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const copy = prev.slice();
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });
  }, []);

  const handleAgentEvent = useCallback((m) => {
    switch (m.type) {
      case 'run_start': setBusy(true); break;
      case 'status': setStatus(m.text); break;
      case 'token':
        patchLast((a) => ({ ...a, content: (a.content || '') + m.text }));
        break;
      case 'tool_call':
        patchLast((a) => ({ ...a, tools: [...(a.tools || []), { id: m.id, name: m.name, args: m.args, done: false }] }));
        break;
      case 'tool_result':
        patchLast((a) => ({
          ...a,
          tools: (a.tools || []).map((t) => (t.id === m.id ? { ...t, done: true, denied: !!m.denied } : t)),
        }));
        break;
      case 'approval_request':
        setPendingApproval({ id: m.id, name: m.name, args: m.args, preview: m.preview });
        break;
      case 'approval_resolved':
        setPendingApproval((p) => (p && p.id === m.id ? null : p));
        break;
      case 'fs_changed':
        refreshTree();
        refreshOpenFiles();
        break;
      case 'notice':
        patchLast((a) => ({ ...a, content: (a.content || '') + '\n\n_' + m.text + '_' }));
        break;
      case 'assistant_done':
        patchLast((a) => ({ ...a, content: m.content || a.content }));
        break;
      case 'error':
        patchLast((a) => ({ ...a, content: (a.content || '') + '\n\n⚠️ ' + m.text }));
        break;
      case 'run_end':
        setBusy(false);
        setStatus('');
        setPendingApproval(null);
        patchLast((a) => ({ ...a, streaming: false }));
        refreshTree();
        break;
      default: break;
    }
  }, [patchLast]);

  // ---------- data loaders ----------
  async function refreshProjects() {
    try { setProjects(await api.projects()); } catch {}
  }
  const refreshTree = useCallback(async () => {
    const id = currentRef.current;
    if (!id) return;
    try { setTree(await api.tree(id)); } catch {}
  }, []);
  const refreshOpenFiles = useCallback(async () => {
    const id = currentRef.current;
    if (!id) return;
    const open = tabsRef.current;
    for (const t of open) {
      if (t.dirty) continue;
      try {
        const r = await api.file(id, t.path);
        setTabs((prev) => prev.map((x) => (x.path === t.path && !x.dirty ? { ...x, content: r.content } : x)));
      } catch { /* file may have been deleted */ }
    }
  }, []);

  // ---------- project selection ----------
  async function selectProject(id) {
    if (id === current) return;
    setCurrent(id);
    currentRef.current = id;
    setTabs([]); setActivePath(null); setTree([]); setMeta(null); setMessages([]);
    setPendingApproval(null);
    setCenterView('editor');
    try { setMeta(await api.meta(id)); } catch {}
    try { setTree(await api.tree(id)); } catch {}
    try {
      const chat = await api.chat(id);
      setMessages(chat.map((m) => ({ role: m.role, content: m.content, tools: (m.tools || []).map((t) => ({ ...t, done: true })) })));
    } catch {}
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'watch', projectId: id }));
    }
  }

  async function createProject(body) {
    const p = await api.createProject(body);
    await refreshProjects();
    await selectProject(p.id);
  }

  async function deleteProject(id) {
    try {
      await api.deleteProject(id);
      if (id === current) { setCurrent(null); currentRef.current = null; setTabs([]); setTree([]); setMessages([]); setMeta(null); }
      await refreshProjects();
    } catch (e) { alert('Delete failed: ' + e.message); }
  }

  // ---------- model + mode ----------
  async function openModelPicker() {
    setShowModelPicker(true);
    if (!modelsList && !modelsLoading) {
      setModelsLoading(true);
      try { setModelsList(await api.models()); } catch { setModelsList([]); }
      setModelsLoading(false);
    }
  }
  async function chooseModel(id) {
    setShowModelPicker(false);
    if (!current) return;
    setMeta((m) => ({ ...(m || {}), model: id }));
    try { await api.patchMeta(current, { model: id }); } catch (e) { alert('Could not save model: ' + e.message); }
  }
  async function changeMode(mode) {
    if (!current) return;
    setMeta((m) => ({ ...(m || {}), permissionMode: mode }));
    try { await api.patchMeta(current, { permissionMode: mode }); } catch {}
  }

  // ---------- approvals ----------
  function respondApproval(decision) {
    if (!pendingApproval) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'approval_response', id: pendingApproval.id, decision }));
    }
    setPendingApproval(null);
  }

  // ---------- files ----------
  async function openFile(path) {
    const existing = tabs.find((t) => t.path === path);
    if (existing) { setActivePath(path); setCenterView('editor'); return; }
    try {
      const r = await api.file(current, path);
      setTabs((prev) => [...prev, { path, content: r.content, dirty: false }]);
      setActivePath(path);
      setCenterView('editor');
    } catch (e) { alert('Could not open file: ' + e.message); }
  }
  function closeTab(path) {
    setTabs((prev) => {
      const next = prev.filter((t) => t.path !== path);
      if (path === activePath) setActivePath(next.length ? next[next.length - 1].path : null);
      return next;
    });
  }
  function changeFile(path, content) {
    setTabs((prev) => prev.map((t) => (t.path === path ? { ...t, content, dirty: true } : t)));
  }
  async function saveFile(path) {
    const t = tabs.find((x) => x.path === path);
    if (!t) return;
    try {
      await api.saveFile(current, path, t.content);
      setTabs((prev) => prev.map((x) => (x.path === path ? { ...x, dirty: false } : x)));
    } catch (e) { alert('Save failed: ' + e.message); }
  }

  // ---------- chat ----------
  function sendMessage(text) {
    if (!current) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', tools: [], streaming: true },
    ]);
    setBusy(true);
    setStatus('thinking');
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat', projectId: current, message: text }));
    } else {
      handleAgentEvent({ type: 'error', text: 'Not connected to backend. Retrying…' });
      handleAgentEvent({ type: 'run_end' });
    }
  }

  async function logout() {
    try { await api.logout(); } catch {}
    setAuthed(false);
    setProjects([]); setCurrent(null); setMessages([]); setTabs([]);
  }

  // ---------- render ----------
  if (authed === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-ink-950 text-gray-500">
        <Loader2 className="animate-spin mr-2" size={18} /> Loading…
      </div>
    );
  }
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="h-screen flex flex-col bg-ink-950 text-gray-200">
      {/* Toolbar */}
      <div className="h-11 shrink-0 bg-ink-900 border-b border-ink-700 flex items-center px-3 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent/20 border border-accent/40 flex items-center justify-center">
            <Hammer size={13} className="text-accent" />
          </div>
          <span className="font-semibold text-sm">Forge Code</span>
        </div>
        <div className="text-gray-600">/</div>
        <div className="text-sm text-gray-300 truncate">
          {meta ? meta.name : <span className="text-gray-600">no project</span>}
          {meta && meta.stack && <span className="text-gray-600 text-xs ml-2">{meta.stack}</span>}
        </div>
        <div className="flex-1" />
        {current && (
          <>
            <button
              onClick={() => setCenterView(centerView === 'preview' ? 'editor' : 'preview')}
              className={'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs ' + (centerView === 'preview' ? 'bg-accent/20 text-accent' : 'text-gray-400 hover:bg-ink-800')}
            >
              {centerView === 'preview' ? <Code2 size={14} /> : <Eye size={14} />}
              {centerView === 'preview' ? 'Editor' : 'Preview'}
            </button>
            <button
              onClick={() => setShowTerminal((s) => !s)}
              className={'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs ' + (showTerminal ? 'bg-accent/20 text-accent' : 'text-gray-400 hover:bg-ink-800')}
            >
              <TerminalIcon size={14} /> Terminal
            </button>
          </>
        )}
        <button onClick={logout} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-gray-400 hover:bg-ink-800" title="Log out">
          <LogOut size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        <Sidebar
          projects={projects}
          current={current}
          tree={tree}
          activePath={activePath}
          onSelect={selectProject}
          onCreate={createProject}
          onDelete={deleteProject}
          onOpenFile={openFile}
        />

        {/* Center column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {current ? (
            <>
              <div className="flex-1 min-h-0 flex flex-col">
                {centerView === 'preview' ? (
                  <PreviewPane projectId={current} />
                ) : (
                  <EditorPane
                    tabs={tabs}
                    activePath={activePath}
                    onActivate={setActivePath}
                    onClose={closeTab}
                    onChange={changeFile}
                    onSave={saveFile}
                  />
                )}
              </div>
              {showTerminal && (
                <div className="h-60 shrink-0 border-t border-ink-700 flex flex-col">
                  <div className="h-7 bg-ink-900 border-b border-ink-700 flex items-center px-3 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                    Terminal — {current}
                  </div>
                  <div className="flex-1 min-h-0">
                    <TerminalPane key={current} projectId={current} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600">
              <div className="text-center">
                <Hammer size={26} className="mx-auto mb-3 text-accent/50" />
                <div className="text-sm">Create or select a project to start building.</div>
              </div>
            </div>
          )}
        </div>

        <ChatPanel
          messages={messages}
          busy={busy}
          status={status}
          onSend={sendMessage}
          projectSelected={!!current}
          model={effModel}
          mode={effMode}
          onOpenModelPicker={openModelPicker}
          onModeChange={changeMode}
          onOpenMemory={() => setShowMemory(true)}
          pendingApproval={pendingApproval}
          onApproval={respondApproval}
        />
      </div>

      {showModelPicker && (
        <ModelPicker
          models={modelsList}
          loading={modelsLoading}
          current={effModel}
          onSelect={chooseModel}
          onClose={() => setShowModelPicker(false)}
        />
      )}
      {showMemory && current && (
        <MemoryModal projectId={current} onClose={() => setShowMemory(false)} />
      )}
    </div>
  );
}
