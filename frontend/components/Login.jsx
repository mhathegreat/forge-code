'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Hammer, Loader2 } from 'lucide-react';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
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
        className="w-[340px] bg-ink-900 border border-ink-700 rounded-2xl p-7 shadow-2xl"
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
        <p className="text-xs text-gray-500 mt-3 mb-4">
          Enter your password (set as <span className="font-mono">APP_PASSWORD</span> in .env).
        </p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent transition"
        />
        {error && <div className="text-red-400 text-xs mt-2">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="w-full mt-4 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2.5 flex items-center justify-center gap-2 transition"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
