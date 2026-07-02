'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Hammer, Loader2, KeyRound } from 'lucide-react';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('loading'); // 'loading' | 'login' | 'setup'
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.setupStatus()
      .then((s) => setMode(s.needsSetup ? 'setup' : 'login'))
      .catch(() => setMode('login'));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'setup') {
      if (password.length < 4) { setError('Password must be at least 4 characters'); return; }
      if (password !== confirm) { setError('Passwords do not match'); return; }
      setBusy(true);
      try {
        await api.setup({ password, openrouterApiKey: apiKey.trim() });
        onLogin();
      } catch (err) {
        setError(err.message || 'Setup failed');
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      await api.login(password);
      onLogin();
    } catch (err) {
      setError('Incorrect password');
      setBusy(false);
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-ink-950">
      <form
        onSubmit={submit}
        className="w-[380px] bg-ink-900 border border-ink-700 rounded-2xl p-7 shadow-2xl"
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center">
            <Hammer size={18} className="text-accent" />
          </div>
          <div>
            <div className="text-lg font-semibold">Forge Code</div>
            <div className="text-xs text-gray-500">AI coding studio</div>
          </div>
        </div>

        {mode === 'loading' && (
          <div className="flex items-center justify-center gap-2 text-gray-500 text-sm py-8">
            <Loader2 size={15} className="animate-spin" /> Loading…
          </div>
        )}

        {mode === 'login' && (
          <>
            <p className="text-xs text-gray-500 mt-3 mb-4">Enter your password to continue.</p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent transition"
            />
          </>
        )}

        {mode === 'setup' && (
          <>
            <p className="text-xs text-gray-400 mt-3 mb-4">
              <span className="text-accent font-medium">Welcome!</span> Set up Forge Code — no config files needed.
            </p>
            <label className="block text-[11px] text-gray-500 mb-1">Create a password</label>
            <input
              type="password" autoFocus value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 4 characters"
              className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent transition mb-3"
            />
            <label className="block text-[11px] text-gray-500 mb-1">Confirm password</label>
            <input
              type="password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Same password again"
              className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent transition mb-3"
            />
            <label className="block text-[11px] text-gray-500 mb-1 flex items-center gap-1">
              <KeyRound size={11} /> OpenRouter API key <span className="text-gray-600">(optional — add later in Settings)</span>
            </label>
            <input
              type="password" value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-…"
              className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-accent transition"
            />
            <p className="text-[10px] text-gray-600 mt-1.5">
              Get a free key at <span className="text-gray-400">openrouter.ai/keys</span> — free models work with a free account.
            </p>
          </>
        )}

        {error && <div className="text-red-400 text-xs mt-2">{error}</div>}

        {mode !== 'loading' && (
          <button
            type="submit"
            disabled={busy}
            className="w-full mt-4 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2.5 flex items-center justify-center gap-2 transition"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {mode === 'setup' ? (busy ? 'Setting up…' : 'Create & start building') : (busy ? 'Signing in…' : 'Sign in')}
          </button>
        )}
      </form>
    </div>
  );
}
