'use client';
import { useEffect, useState } from 'react';
import { X, Settings as SettingsIcon, KeyRound, Loader2, CheckCircle2, XCircle, Save, Lock, Server } from 'lucide-react';
import { api, MODE_LABELS } from '@/lib/api';

export default function SettingsModal({ onClose, onPasswordChanged }) {
  const [info, setInfo] = useState(null);
  const [selId, setSelId] = useState(null); // provider being viewed/edited
  const [keyInput, setKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwErr, setPwErr] = useState('');

  useEffect(() => {
    api.settings().then((s) => {
      setInfo(s);
      setSelId(s.activeProvider);
      const sel = s.providers.find((p) => p.id === s.activeProvider);
      if (sel && sel.custom) { setBaseUrlInput(sel.baseUrl || ''); setNameInput(sel.name || ''); }
    }).catch(() => {});
  }, []);

  const sel = info && selId ? info.providers.find((p) => p.id === selId) : null;

  function pickProvider(id) {
    setSelId(id);
    setKeyInput(''); setTestResult(null); setSavedMsg('');
    const p = info.providers.find((x) => x.id === id);
    setBaseUrlInput((p && p.custom && p.baseUrl) || '');
    setNameInput((p && p.custom && p.name !== 'Custom (OpenAI-compatible)' && p.name) || '');
  }

  function keyStatusLine() {
    if (!sel) return '…';
    if (!sel.needsKey && !sel.hasKey) return sel.custom ? 'Key optional for custom endpoints.' : 'No API key needed — runs locally.';
    if (!sel.hasKey) return 'No API key saved for ' + sel.name + '.';
    const src = sel.keySource === 'env' ? 'from .env' : 'saved in the app';
    return `Current key: ${sel.keyPreview} (${src})`;
  }

  async function activate(id) {
    try {
      const r = await api.saveSettings({ activeProvider: id });
      setInfo(r);
    } catch {}
  }

  async function testKey() {
    setTesting(true); setTestResult(null);
    try {
      setTestResult(await api.testKey({ providerId: selId, key: keyInput.trim() || undefined }));
    } catch (e) {
      setTestResult({ valid: false, error: e.message });
    }
    setTesting(false);
  }

  async function saveProvider() {
    setSaving(true); setSavedMsg('');
    try {
      const body = {};
      if (keyInput.trim()) body.apiKey = keyInput.trim();
      if (sel && sel.custom) { body.baseUrl = baseUrlInput.trim(); body.name = nameInput.trim(); }
      const r = await api.saveProvider(selId, body);
      setInfo(r);
      setKeyInput(''); setTestResult(null);
      setSavedMsg('Saved.');
    } catch (e) {
      setSavedMsg('Save failed: ' + e.message);
    }
    setSaving(false);
  }

  async function saveMode(mode) {
    try { setInfo(await api.saveSettings({ defaultPermissionMode: mode })); } catch {}
  }

  async function changePassword() {
    setPwErr('');
    if (newPw.length < 4) { setPwErr('At least 4 characters'); return; }
    if (newPw !== newPw2) { setPwErr('Passwords do not match'); return; }
    setSaving(true);
    try {
      await api.saveSettings({ newPassword: newPw });
      onPasswordChanged(); // session cookie is now invalid
    } catch (e) {
      setPwErr(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-h-[85vh] bg-ink-900 border border-ink-700 rounded-xl shadow-2xl flex flex-col"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-700">
          <SettingsIcon size={15} className="text-accent" />
          <div className="text-sm font-semibold flex-1">Settings</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-5">
          {/* Provider */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5 flex items-center gap-1.5">
              <Server size={12} /> AI provider
            </div>
            {info && (
              <div className="flex items-center gap-2 mb-2">
                <select
                  value={selId || ''}
                  onChange={(e) => pickProvider(e.target.value)}
                  className="flex-1 bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none"
                >
                  {info.providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.configured ? ' ✓' : ''}{p.active ? '  (active)' : ''}
                    </option>
                  ))}
                </select>
                {sel && !sel.active && (
                  <button
                    onClick={() => activate(selId)}
                    className="px-3 py-2 text-xs bg-accent hover:bg-accent-hover rounded-lg whitespace-nowrap"
                  >
                    Use this provider
                  </button>
                )}
                {sel && sel.active && (
                  <span className="text-[11px] text-green-400 flex items-center gap-1 whitespace-nowrap"><CheckCircle2 size={12} /> active</span>
                )}
              </div>
            )}

            {sel && sel.custom && (
              <div className="space-y-2 mb-2">
                <input
                  value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Display name (e.g. My vLLM box)"
                  className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <input
                  value={baseUrlInput} onChange={(e) => setBaseUrlInput(e.target.value)}
                  placeholder="Base URL, e.g. http://192.168.1.50:8000/v1"
                  className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-accent"
                />
              </div>
            )}

            <div className={'text-xs mb-2 ' + (sel && sel.needsKey && !sel.hasKey ? 'text-amber-400' : 'text-gray-400')}>
              {keyStatusLine()}
            </div>

            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => { setKeyInput(e.target.value); setTestResult(null); }}
                placeholder={sel && !sel.needsKey ? 'API key (optional)' : 'Paste API key…'}
                className="flex-1 bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-accent"
              />
              <button
                onClick={testKey}
                disabled={testing}
                className="px-3 py-2 text-xs text-gray-300 bg-ink-800 hover:bg-ink-750 border border-ink-700 rounded-lg disabled:opacity-50"
                title="Validate the typed key (or the saved one if empty) against the provider"
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : 'Test'}
              </button>
              <button
                onClick={saveProvider}
                disabled={saving || (!keyInput.trim() && !(sel && sel.custom))}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-50"
              >
                <Save size={13} /> Save
              </button>
            </div>

            {testResult && (
              <div className={'flex items-center gap-1.5 text-xs mt-2 ' + (testResult.valid ? 'text-green-400' : 'text-red-400')}>
                {testResult.valid ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                {testResult.valid
                  ? `Works${testResult.freeTier ? ' (free tier)' : ''}${typeof testResult.usage === 'number' ? ` — $${testResult.usage.toFixed(2)} used` : ''}`
                  : (testResult.error || 'Invalid key')}
              </div>
            )}
            {savedMsg && <div className="text-xs text-green-400 mt-2">{savedMsg}</div>}
            {sel && sel.keyHint && (
              <p className="text-[10px] text-gray-600 mt-2">
                Get a key at <span className="text-gray-400">{sel.keyHint}</span>. Keys are stored locally and only sent to the provider itself.
              </p>
            )}
          </div>

          {/* Default permission mode */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">
              Default permission mode (new projects)
            </div>
            <select
              value={(info && info.defaultPermissionMode) || 'ask'}
              onChange={(e) => saveMode(e.target.value)}
              className="bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none"
            >
              {Object.entries(MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          {/* Change password */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5 flex items-center gap-1.5">
              <Lock size={12} /> Change password
            </div>
            <div className="flex gap-2">
              <input
                type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password"
                className="flex-1 bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <input
                type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)}
                placeholder="Confirm"
                className="flex-1 bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                onClick={changePassword}
                disabled={saving || !newPw}
                className="px-3 py-2 text-xs bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-50"
              >
                Change
              </button>
            </div>
            {pwErr && <div className="text-xs text-red-400 mt-1.5">{pwErr}</div>}
            <p className="text-[10px] text-gray-600 mt-1.5">Changing the password signs you out everywhere.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
