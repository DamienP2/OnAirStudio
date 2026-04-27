import React, { useState, useEffect } from 'react';
import { useT } from '../hooks/useT';

const STORAGE_KEY = 'onair.adminPassword';
// Event custom (même onglet) : `storage` du navigateur ne se déclenche que pour
// les autres onglets. Sans cet event, le Header ne sait pas que l'auth vient
// de changer dans l'onglet courant et le bouton déconnexion ne s'affiche pas
// jusqu'au prochain refresh.
export const AUTH_CHANGED_EVENT = 'onair.adminAuthChanged';

async function verify(pw) {
  const res = await fetch('/api/admin/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw })
  });
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.valid;
}

export function getStoredAdminPassword() {
  return sessionStorage.getItem(STORAGE_KEY) || '';
}

function setStoredAdminPassword(pw) {
  sessionStorage.setItem(STORAGE_KEY, pw);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearStoredAdminPassword() {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export default function AdminAuthGate({ children }) {
  const t = useT();
  const [authorized, setAuthorized] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredAdminPassword();
    if (!stored) { setLoading(false); return; }
    verify(stored).then(ok => {
      if (ok) setAuthorized(true);
      else clearStoredAdminPassword();
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6 text-slate-400 text-sm">{t('auth.checking')}</div>;
  if (authorized) return children;

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr('');
          const ok = await verify(pw);
          if (!ok) { setErr(t('auth.wrong')); return; }
          setStoredAdminPassword(pw);
          setAuthorized(true);
        }}
        className="bg-slate-900/70 border border-white/5 rounded-xl p-8 backdrop-blur-md shadow-2xl shadow-black/50 max-w-md w-full space-y-5"
      >
        <div className="flex justify-center mb-2">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-white/5 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="11" width="14" height="10" rx="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-50">{t('auth.required')}</h2>
          <p className="text-slate-400 text-sm mt-1">{t('auth.subtitle')}</p>
        </div>

        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={t('auth.placeholder')}
          className="w-full bg-slate-950 border border-white/10 focus:border-blue-500 rounded-md text-slate-50 text-sm px-3 py-2 outline-none transition-colors"
          autoFocus
        />
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-md font-medium px-4 py-2 text-sm transition-colors"
        >
          {t('auth.unlock')}
        </button>
      </form>
    </div>
  );
}
