import React, { useState, useEffect } from 'react';
import { useTimerState } from '../store/TimerContext';
import { useT, useTr } from '../hooks/useT';
import { getStoredAdminPassword, clearStoredAdminPassword, AUTH_CHANGED_EVENT } from './AdminAuthGate';

// Header est toujours monté tant qu'un panel est affiché → l'endroit idéal
// pour porter le check des MAJ. Hourly est suffisant pour un studio (les
// releases sont peu fréquentes, on ne veut pas spammer GitHub).
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export default function Header() {
  const t = useT();
  const tr = useTr();
  const { studioName, currentTime, remaining, remainingTime, elapsed, isRunning, isPaused, onair, isNTPActive } = useTimerState();

  // État admin — permet d'afficher un bouton « Se déconnecter » quand authentifié.
  const [hasAuth, setHasAuth] = useState(() => !!getStoredAdminPassword());
  useEffect(() => {
    // Re-vérifie au mount (utile si on vient de s'authentifier dans un autre composant)
    setHasAuth(!!getStoredAdminPassword());
    // 2 sources d'événements :
    //   - `storage` : changements depuis un AUTRE onglet (ne fire JAMAIS pour
    //     l'onglet courant — limitation web standard).
    //   - AUTH_CHANGED_EVENT : custom event fired par AdminAuthGate dans
    //     l'onglet courant après login/logout. Sans ça, le bouton déconnexion
    //     ne s'affiche qu'après refresh manuel.
    const handler = () => setHasAuth(!!getStoredAdminPassword());
    window.addEventListener('storage', handler);
    window.addEventListener(AUTH_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener(AUTH_CHANGED_EVENT, handler);
    };
  }, []);

  // Badge "NEW" : check périodique de la dispo d'une MAJ amont.
  // Reste silencieux tant qu'aucune MAJ n'est dispo (pas de spam).
  const [updateAvailable, setUpdateAvailable] = useState(false);
  useEffect(() => {
    if (!hasAuth) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/admin/update/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: getStoredAdminPassword() })
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUpdateAvailable(!!data.updatesAvailable);
      } catch { /* offline ou serveur restart — silent retry au prochain tick */ }
    };
    // Petit délai initial pour laisser le serveur démarrer après refresh
    const initial = setTimeout(check, 3000);
    const interval = setInterval(check, UPDATE_CHECK_INTERVAL_MS);
    return () => { cancelled = true; clearTimeout(initial); clearInterval(interval); };
  }, [hasAuth]);
  const handleLogout = () => {
    clearStoredAdminPassword();
    window.location.reload();
  };

  // Statut NTP : vert si actif, ambre sinon. Identique à l'indicateur des horloges analog/digital.
  const statusDotColor = isNTPActive ? 'bg-green-500' : 'bg-amber-500';
  const statusTooltip = `NTP : ${isNTPActive ? 'OK' : 'KO'}`;

  // Sémantique de l'état affiché (du plus prioritaire au moins) :
  //  1. isPaused → EN PAUSE (chrono lancé puis suspendu)
  //  2. isRunning OU onair → ON AIR (rouge pulsant — chrono qui tourne = antenne)
  //  3. Durée chargée mais pas démarrée → EN PAUSE (état "armé / prêt")
  //  4. Sinon → ARRÊTÉ
  const hasDurationLoaded = (remainingTime || 0) > 0 && !isRunning && !isPaused;
  const isOnAirLike = isRunning || onair;
  const isPausedLike = isPaused || hasDurationLoaded;
  const state = isPaused ? t('state.paused')
    : isOnAirLike ? t('state.onair')
    : hasDurationLoaded ? t('state.paused')
    : t('state.stopped');

  // Le badge état n'est PAS un bouton : on garde un look "chip" lumineux —
  // un point coloré + texte, sans fond plein ni bordure carrée.
  const chipDotColor = isPausedLike
    ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]'
    : isOnAirLike
      ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse'
      : 'bg-slate-500';
  const chipTextColor = isPausedLike
    ? 'text-amber-300'
    : isOnAirLike
      ? 'text-red-300'
      : 'text-slate-400';

  return (
    <header className="flex-shrink-0 z-40 h-14 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-6 flex items-center gap-4">
      {/* Left: brand + studio name */}
      <div className="flex items-center gap-3">
        <img src="/logo_hor.png" alt="OnAir Studio" className="h-5 w-auto object-contain" />
        <span className="text-[10px] font-mono text-slate-500 bg-slate-800/60 border border-white/5 px-1.5 py-0.5 rounded" title={t('header.version')}>
          v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}
        </span>
        {updateAvailable && (
          <span
            className="text-[9px] font-bold uppercase tracking-widest text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 rounded animate-pulse"
            title={tr({ fr: 'Une mise à jour est disponible — voir Réglages → Mises à jour', en: 'An update is available — see Settings → Updates' })}
          >
            NEW
          </span>
        )}
        <span className="text-slate-700 select-none">|</span>
        <span className="text-slate-400 text-sm">{studioName}</span>
      </div>

      {/* Right: clock, timers, state chip */}
      <div className="ml-auto flex items-center gap-6">
        {/* Current time + status dot (après l'heure) — text-lg comme reste/écoulé pour uniformité */}
        <div className="flex items-center gap-2" title={statusTooltip}>
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold hidden sm:block">H</span>
          <span className="font-mono text-lg font-bold text-slate-300 leading-none">{currentTime}</span>
          <span className={`w-2 h-2 rounded-full ${statusDotColor}`} />
        </div>

        {/* Remaining */}
        <div className="flex flex-col items-end sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{t('header.remaining')}</span>
          <span className="font-mono text-lg font-bold text-red-400 leading-none">{remaining}</span>
        </div>

        {/* Elapsed — taille alignée sur les autres readouts (text-lg) */}
        <div className="flex flex-col items-end sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{t('header.elapsed')}</span>
          <span className="font-mono text-lg font-bold text-blue-400 leading-none">{elapsed}</span>
        </div>

        {/* State chip — point coloré + texte (pas un bouton) */}
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${chipDotColor}`} />
          <span className={`text-[11px] font-bold uppercase tracking-wider ${chipTextColor}`}>{state}</span>
        </span>

        {/* Bouton Display — ouvre l'écran du studio dans un nouvel onglet */}
        <a
          href="/display"
          target="_blank"
          rel="noreferrer"
          title={tr({ fr: "Ouvrir l'écran du studio (nouvel onglet)", en: 'Open the studio display (new tab)' })}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/5 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-white/15 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span className="text-[10px] uppercase tracking-wider font-semibold">Display</span>
        </a>

        {/* Bouton admin logout — visible uniquement quand authentifié */}
        {hasAuth && (
          <button
            onClick={handleLogout}
            title={t('header.disconnect.title')}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/5 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-white/15 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="text-[10px] uppercase tracking-wider font-semibold">{t('header.disconnect')}</span>
          </button>
        )}
      </div>
    </header>
  );
}
