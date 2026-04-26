import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// Système de dialogs unifié remplaçant window.alert / window.confirm.
// Usage :
//   const dialog = useDialog();
//   await dialog.alert({ title: 'OK', message: 'Action terminée.' });
//   const ok = await dialog.confirm({ title: 'Sûr ?', message: '...', danger: true });
//
// Un seul modal global est rendu au niveau du <DialogProvider> (placé dans App.jsx).
// L'API retourne des promesses : pas de callback, pas de state local nécessaire
// dans les composants appelants.

const DialogContext = createContext(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');
  return ctx;
}

export function DialogProvider({ children }) {
  // current : { kind: 'alert'|'confirm', title, message, confirmLabel, cancelLabel, danger, resolve }
  const [current, setCurrent] = useState(null);

  const close = useCallback((result) => {
    setCurrent(prev => {
      if (prev) prev.resolve(result);
      return null;
    });
  }, []);

  const api = React.useMemo(() => ({
    alert: ({ title = 'Information', message, confirmLabel = 'OK', kind = 'info' } = {}) =>
      new Promise(resolve => setCurrent({
        kind: 'alert', title, message, confirmLabel,
        tone: kind === 'error' ? 'danger' : kind === 'success' ? 'success' : 'info',
        resolve
      })),
    confirm: ({ title = 'Confirmation', message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false } = {}) =>
      new Promise(resolve => setCurrent({
        kind: 'confirm', title, message, confirmLabel, cancelLabel,
        tone: danger ? 'danger' : 'info',
        resolve
      }))
  }), []);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current && <DialogModal {...current} onClose={close} />}
    </DialogContext.Provider>
  );
}

function DialogModal({ kind, title, message, confirmLabel, cancelLabel, tone, onClose }) {
  const confirmBtnRef = useRef(null);

  // Focus le bouton de confirmation à l'ouverture (UX clavier propre)
  useEffect(() => { confirmBtnRef.current?.focus(); }, []);

  // Échap = annuler (ou OK pour les alertes)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose(kind === 'alert' ? true : false);
      else if (e.key === 'Enter') onClose(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kind, onClose]);

  const toneStyles = {
    danger:  { btn: 'bg-red-600 hover:bg-red-500',  border: 'border-red-500/40', icon: '⚠' },
    success: { btn: 'bg-green-600 hover:bg-green-500', border: 'border-green-500/40', icon: '✓' },
    info:    { btn: 'bg-blue-600 hover:bg-blue-500', border: 'border-blue-500/30', icon: 'ℹ' }
  };
  const t = toneStyles[tone] || toneStyles.info;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
         onClick={() => onClose(kind === 'alert' ? true : false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-slate-900 border ${t.border} rounded-xl p-6 max-w-md w-full shadow-2xl shadow-black/60 space-y-4`}
        role="dialog" aria-modal="true">
        <div className="flex items-start gap-3">
          {tone !== 'info' && (
            <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg
              ${tone === 'danger' ? 'bg-red-500/15 text-red-300' : 'bg-green-500/15 text-green-300'}`}>
              {t.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-50">{title}</h3>
            {message && (
              <div className="text-sm text-slate-300 mt-1.5 leading-relaxed whitespace-pre-line">
                {message}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          {kind === 'confirm' && (
            <button onClick={() => onClose(false)}
              className="px-4 py-2 text-sm rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
              {cancelLabel}
            </button>
          )}
          <button ref={confirmBtnRef} onClick={() => onClose(true)}
            className={`${t.btn} text-white rounded-md font-medium px-4 py-2 text-sm transition-colors`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
