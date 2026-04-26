import React, { useState, useEffect, useRef } from 'react';
import { useT } from '../hooks/useT';

const API_BASE = '';  // même origine que le serveur

export default function UpdatePanel({ adminPassword, timerIsRunning, onShowToast }) {
  const t = useT();
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState(null);  // { updatesAvailable, count, commits }
  const [logs, setLogs] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const pollTimer = useRef(null);

  const post = async (path, body = {}) => {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword, ...body })
    });
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
    return res.json();
  };

  const checkUpdates = async (silent = false) => {
    setChecking(true);
    try {
      const data = await post('/api/admin/update/check');
      setStatus(data);
      if (!silent) {
        onShowToast?.(
          data.updatesAvailable
            ? t('settings.update.available', { count: data.count })
            : t('settings.update.up_to_date'),
          'info'
        );
      } else if (data.updatesAvailable) {
        onShowToast?.(t('settings.update.available', { count: data.count }), 'info');
      }
    } catch (err) {
      if (!silent) onShowToast?.(err.message, 'error');
    } finally {
      setChecking(false);
    }
  };

  // Auto-check au mount + toutes les heures
  useEffect(() => {
    if (!adminPassword) return;
    let cancelled = false;
    const tick = () => { if (!cancelled) checkUpdates(true); };
    // Premier check après un petit délai pour laisser le serveur démarrer
    const initial = setTimeout(tick, 2000);
    const interval = setInterval(tick, 60 * 60 * 1000); // toutes les heures
    return () => { cancelled = true; clearTimeout(initial); clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPassword]);

  const triggerUpdate = async () => {
    setShowConfirm(false);
    setUpdating(true);
    setLogs([]);
    try {
      await post('/api/admin/update');
      // Démarrer le polling des logs
      pollTimer.current = setInterval(async () => {
        try {
          const s = await post('/api/admin/update/status');
          setLogs(s.logs || []);
          if (s.active !== 'active' && s.active !== 'activating') {
            clearInterval(pollTimer.current);
            pollTimer.current = null;
            setUpdating(false);
            onShowToast?.('Mise à jour terminée', 'success');
          }
        } catch (err) {
          // Le serveur peut être momentanément down pendant le restart — on tolère
        }
      }, 2000);
    } catch (err) {
      setUpdating(false);
      onShowToast?.(err.message, 'error');
    }
  };

  useEffect(() => () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
  }, []);

  const hasUpdate = !!status?.updatesAvailable;
  const serverAccessible = status?.serverAccessible !== false;
  const localVersion = (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev');
  const localCommit = status?.currentCommit;
  const remoteUrl = status?.remoteUrl;

  return (
    <div className="space-y-2 text-xs">

      {/* Version actuelle */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/60 border border-white/5 rounded">
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{t('settings.update.version')}</span>
        <span className="font-mono font-bold text-slate-100 text-[11px]">
          v{localVersion}
          {localCommit && <span className="ml-1 text-slate-500 font-normal">({localCommit})</span>}
        </span>
      </div>

      {/* Accessibilité du serveur de MAJ + URL */}
      <div className="px-2.5 py-1.5 bg-slate-950/60 border border-white/5 rounded space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{t('settings.update.server')}</span>
          {!status && checking ? (
            <span className="flex items-center gap-1 text-slate-400">
              <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
              <span className="text-[10px]">{t('settings.update.checking')}</span>
            </span>
          ) : (
            <span className={`flex items-center gap-1 font-bold text-[11px] ${serverAccessible ? 'text-green-400' : 'text-red-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${serverAccessible ? 'bg-green-500' : 'bg-red-500'}`} />
              {serverAccessible ? t('settings.update.accessible') : t('settings.update.inaccessible')}
            </span>
          )}
        </div>
        {remoteUrl ? (
          <a href={remoteUrl.replace(/\.git$/, '')} target="_blank" rel="noreferrer"
             className="block text-[10px] text-blue-400/80 hover:text-blue-300 font-mono truncate"
             title={remoteUrl}>
            {remoteUrl.replace(/\.git$/, '')}
          </a>
        ) : (
          <p className="text-[10px] text-slate-600 italic">{t('settings.update.checking') || '…'}</p>
        )}
      </div>

      {/* État de mise à jour */}
      {status && (
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border ${
          !serverAccessible
            ? 'bg-slate-800/50 border-white/5 text-slate-500'
            : hasUpdate
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
              : 'bg-green-500/10 border-green-500/30 text-green-200'
        }`}>
          {!serverAccessible ? (
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ) : hasUpdate ? (
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          ) : (
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          )}
          <span className="font-medium text-[11px]">
            {!serverAccessible
              ? t('settings.update.unreachable')
              : hasUpdate
                ? t('settings.update.available', { count: status.count })
                : t('settings.update.up_to_date')}
          </span>
        </div>
      )}

      {hasUpdate && serverAccessible && (
        <button
          className="w-full bg-green-600 hover:bg-green-500 active:bg-green-700 text-white rounded font-medium px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          onClick={() => setShowConfirm(true)}
          disabled={updating || timerIsRunning}
          title={timerIsRunning ? t('settings.update.timer_running') : ''}
        >
          {updating ? (
            <>
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
              {t('settings.update.applying')}
            </>
          ) : (
            <>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {t('settings.update.apply')}
            </>
          )}
        </button>
      )}

      {timerIsRunning && hasUpdate && (
        <p className="text-[10px] text-amber-400">{t('settings.update.timer_running')}</p>
      )}

      {status && status.updatesAvailable && !updating && status.commits?.length > 0 && (
        <div className="bg-slate-950/60 border border-white/5 rounded p-2">
          <ul className="space-y-0.5 max-h-24 overflow-y-auto">
            {status.commits.slice(0, 10).map((c, i) => (
              <li key={i} className="text-[10px] text-slate-400 font-mono truncate">{c}</li>
            ))}
          </ul>
        </div>
      )}

      {updating && (
        <div className="bg-black border border-white/10 text-green-400 font-mono text-[10px] rounded p-2 max-h-32 overflow-auto">
          <div className="animate-pulse mb-1">● Mise à jour — ne ferme pas la page</div>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/5 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl shadow-black/50">
            <h4 className="font-bold text-lg text-slate-50 mb-2">{t('settings.update.confirm_title')}</h4>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">{t('settings.update.confirm_body')}</p>
            <div className="flex gap-3 justify-end">
              <button
                className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-md px-4 py-2 text-sm transition-colors"
                onClick={() => setShowConfirm(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className="bg-green-600 hover:bg-green-500 text-white rounded-md font-medium px-4 py-2 text-sm transition-colors"
                onClick={triggerUpdate}
              >
                {t('settings.update.confirm_yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
