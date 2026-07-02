'use client';
import { useEffect, useState } from 'react';
import { X, Settings as SettingsIcon, KeyRound, Loader2, CheckCircle2, XCircle, Save, Lock } from 'lucide-react';
import { api, MODE_LABELS } from '@/lib/api';

export default function SettingsModal({ onClose, onPasswordChanged }) {
  const [info, setInfo] = useState(null);
  const [keyInput, setKeyInput] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwErr, setPwErr] = useState('');

  useEffect(() => {
    api.settings().then(setInfo).catch(() => {});
  }, []);

  function keyStatusLine() {
    if (!info) return '…';
    if (!info.hasKey) return 'No API key configured — the agent cannot run without one.';
    const src = info.keySource === 'env' ? 'from .env file' : 'saved in the app';
    return `Current key: ${info.keyPreview} (${src})`;
  }

  async function testKey() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.testKey(keyInput.trim() || undefined);
      setTestResult(r);
    } catch (e) {
      setTestResult({ valid: false, error: e.message });
    }
    setTesting(false);
  }

  async function saveKey() {
    if (!keyInput.trim()) return;
    setSaving(true);
    setSavedMsg('');
    try {
      const r = await api.saveSettings({ openrouterApiKey: keyInput.trim() });
      setInfo(r);
      setKeyInput('');
      setTestResult(null);
      setSavedMsg('API key saved.');
    } catch (e) {
      setSavedMsg('Save failed: ' + e.message);
    }
    setSaving(false);
  }

  async function saveMode(mode) {
    try {
      const r = await api.saveSettings({ defaultPermissionMode: mode });
      setInfo(r);
    } catch {}
  }

  async function changePassword() {
    setPwErr('');
    if (newPw.length < 4) { setPwErr('At least 4 characters'); return; }
    if (newPw !== newPw2) { setPwErr('Passwords do not match'); return; }
    setSaving(true);
    try {
      await api.saveSettings({ newPassword: newPw });
      // The session cookie is now invalid — send the user back to login.
      onPasswordChanged();
    } catch (e) {
      setPwErr(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] max-h-[80vh] bg-ink-900 border border-ink-700 rounded-xl shadow-2xl flex flex-col"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-700">
          <SettingsIcon size={15} className="text-accent" />
          <div className="text-sm font-semibold flex-1">Settings</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-5">
          {/* API key */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5 flex items-center gap-1.5">
              <KeyRound size={12} /> OpenRouter API key
            </div>
            <div className={'text-xs mb-2 ' + (info && !info.hasKey ? 'text-amber-400' : 'text-gray-400')}>
              {keyStatusLine()}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => { setKeyInput(e.target.value); setTestResult(null); }}
                placeholder="Paste a new key: sk-or-v1-…"
                className="flex-1 bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-accent"
              />
              <button
                onClick={testKey}
                disabled={testing}
                className="px-3 py-2 text-xs text-gray-300 bg-ink-800 hover:bg-ink-750 border border-ink-700 rounded-lg disabled:opacity-50"
                title="Validate the typed key (or the current one if empty) against OpenRouter"
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : 'Test'}
              </button>
              <button
                onClick={saveKey}
                disabled={saving || !keyInput.trim()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-50"
              >
                <Save size={13} /> Save
              </button>
            </div>
            {testResult && (
              <div className={'flex items-center gap-1.5 text-xs mt-2 ' + (testResult.valid ? 'text-green-400' : 'text-red-400')}>
                {testResult.valid ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                {testResult.valid
                  ? `Key is valid${testResult.freeTier ? ' (free tier)' : ''}${typeof testResult.usage === 'number' ? ` — $${testResult.usage.toFixed(2)} used` : ''}`
                  : (testResult.error || 'Invalid key')}
              </div>
            )}
            {savedMsg && <div className="text-xs text-green-400 mt-2">{savedMsg}</div>}
            <p className="text-[10px] text-gray-600 mt-2">
              Get a key at openrouter.ai/keys. Keys are stored locally in settings.json and never leave this machine except to call OpenRouter.
            </p>
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
