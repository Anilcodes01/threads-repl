'use client';
import { useState } from 'react';
export default function Login() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to sign in.');
      window.location.replace('/');
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <main className="login-screen"><form className="login-card" onSubmit={submit}><div className="login-brand">@</div><span className="eyebrow">YOUR PRIVATE WORKSPACE</span><h1>Welcome back.</h1><p>Sign in to manage your Threads conversations.</p><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" required value={email} disabled={busy} onChange={e => setEmail(e.target.value)} /><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={e => setPassword(e.target.value)} />{error && <div className="error" role="alert">{error}</div>}<button className="primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in →'}</button><small>You’ll stay signed in for 30 days on this browser.</small></form></main>;
}
