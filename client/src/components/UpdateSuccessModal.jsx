import React, { useState, useEffect } from 'react';
import { useTr } from '../hooks/useT';

const STORAGE_KEY = 'onair.pendingUpdate';

// UpdateSuccessModal — affiché au mount si une mise à jour vient d'être
// appliquée (cf. UpdatePanel qui pose un flag dans localStorage juste avant
// le reload). Compare la version d'avant à __APP_VERSION__ courant pour
// confirmer le succès. Auto-dismiss possible.
export default function UpdateSuccessModal() {
  const tr = useTr();
  const [info, setInfo] = useState(null); // { from, to, sameVersion }

  useEffect(() => {
    let stored;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { return; }
    if (!stored) return;

    let parsed;
    try { parsed = JSON.parse(stored); } catch { localStorage.removeItem(STORAGE_KEY); return; }

    const from = parsed?.from || 'dev';
    const to = (typeof __APP_VERSION__ !== 'undefined') ? __APP_VERSION__ : 'dev';
    const sameVersion = from === to;

    // Cleanup immédiat : on ne veut pas que le modal réapparaisse au prochain
    // refresh. Le flag est consommé une fois.
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }

    setInfo({ from, to, sameVersion });
  }, []);

  if (!info) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-xl shadow-2xl shadow-black/50 p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h4 className="font-bold text-lg text-slate-50">
            {info.sameVersion
              ? tr({ fr: 'Mise à jour appliquée', en: 'Update applied' })
              : tr({ fr: 'Mise à jour réussie', en: 'Update successful' })}
          </h4>
        </div>

        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          {info.sameVersion
            ? tr({
                fr: "Aucun changement de version détecté — la mise à jour n'incluait peut-être que des correctifs internes.",
                en: 'No version change detected — the update may have only included internal fixes.'
              })
            : tr({
                fr: "OnAir Studio a été mis à jour avec succès et la page a été rechargée.",
                en: 'OnAir Studio has been updated successfully and the page has been reloaded.'
              })}
        </p>

        {/* From → To */}
        <div className="bg-slate-950/60 border border-white/5 rounded-md p-3 mb-5 flex items-center gap-3">
          <div className="flex-1 text-xs">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">
              {tr({ fr: 'Avant', en: 'Before' })}
            </div>
            <div className="font-mono font-bold text-slate-300">v{info.from}</div>
          </div>
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
          <div className="flex-1 text-xs">
            <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold mb-1">
              {tr({ fr: 'Maintenant', en: 'Now' })}
            </div>
            <div className="font-mono font-bold text-emerald-300">v{info.to}</div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium px-5 py-2 text-sm transition-colors"
            onClick={() => setInfo(null)}
          >
            {tr({ fr: 'OK', en: 'OK' })}
          </button>
        </div>
      </div>
    </div>
  );
}
