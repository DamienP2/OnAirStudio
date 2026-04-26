import React, { useEffect, useRef, useState } from 'react';
import { apiListUploads, apiUploadImage, apiDeleteUpload } from '../store/templateStore';
import { useDialog } from '../components/Dialog';

// Limites et formats par type. La gallery filtre les assets selon `kind`,
// et l'upload valide localement avant l'appel serveur.
const KIND_CONFIG = {
  image: {
    label: 'image',
    maxBytes: 5 * 1024 * 1024,
    accept: 'image/png,image/jpeg,image/webp,image/svg+xml',
    formatsLabel: 'PNG, JPG, WebP, SVG',
    maxLabel: '5 Mo'
  },
  video: {
    label: 'vidéo',
    maxBytes: 200 * 1024 * 1024,
    accept: 'video/mp4,video/webm,video/ogg,video/quicktime',
    formatsLabel: 'MP4, WebM, MOV, OGV',
    maxLabel: '200 Mo'
  }
};

function formatBytes(n) {
  if (!n) return '';
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

/**
 * AssetGallery — modal de gestion + sélection d'images, aligné Broadcast Pro.
 * - Drop zone large avec drag-and-drop
 * - Grille d'images en cards avec preview / nom / taille / actions
 * - Sélection : clic sur la card pour mettre en surbrillance + bouton « Utiliser cette image »
 * - Suppression : icône poubelle dans chaque card avec confirmation
 *
 * Props :
 *   onPick({ assetId, filename })  → appelé quand l'utilisateur valide
 *   onClose()                      → fermeture du modal
 *   currentAssetId (optionnel)     → id actuellement choisi (pour pré-sélection)
 */
export default function AssetGallery({ onPick, onClose, currentAssetId, kind = 'image' }) {
  const cfg = KIND_CONFIG[kind] || KIND_CONFIG.image;
  const dialog = useDialog();
  const [assets, setAssets] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedId, setSelectedId] = useState(currentAssetId || null);
  const fileInputRef = useRef(null);

  const load = async () => {
    try { setAssets(await apiListUploads()); setErr(''); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const validateAndUpload = async (file) => {
    setErr('');
    if (!file) return;
    if (!cfg.accept.split(',').includes(file.type)) {
      setErr(`Format non supporté (${file.type || 'inconnu'}). ${cfg.formatsLabel} uniquement.`);
      return;
    }
    if (file.size > cfg.maxBytes) {
      setErr(`Fichier trop volumineux (${formatBytes(file.size)}). Limite : ${cfg.maxLabel}.`);
      return;
    }
    setBusy(true);
    try {
      const result = await apiUploadImage(file);
      await load();
      // Pré-sélectionne l'asset qu'on vient d'uploader
      if (result?.assetId) setSelectedId(result.assetId);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    validateAndUpload(files[0]);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    const ok = await dialog.confirm({
      title: `Supprimer cette ${cfg.label} ?`,
      message: 'Le fichier sera retiré de la bibliothèque.',
      confirmLabel: 'Supprimer',
      danger: true
    });
    if (!ok) return;
    try {
      await apiDeleteUpload(id);
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (e) { setErr(e.message); }
  };

  const handleConfirm = () => {
    if (!selectedId) return;
    const asset = assets[selectedId];
    if (asset) onPick({ assetId: selectedId, filename: asset.filename });
  };

  // Filtre selon le type d'asset demandé. Pour les anciens uploads (sans champ
  // `kind`), on infère depuis le mimetype.
  const assetEntries = Object.entries(assets).filter(([, a]) => {
    const k = a.kind || (String(a.mimetype || '').startsWith('video/') ? 'video' : 'image');
    return k === kind;
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#06090f] border border-white/10 rounded-xl w-full max-w-5xl max-h-[88vh] flex flex-col shadow-2xl shadow-black/60">

        {/* Header */}
        <header className="flex-shrink-0 px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-widest">
              Bibliothèque {kind === 'video' ? 'de vidéos' : 'd\'images'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {assetEntries.length} {cfg.label}{assetEntries.length > 1 ? 's' : ''} · max {cfg.maxLabel} · {cfg.formatsLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fermer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </header>

        {/* Drop zone */}
        <div className="flex-shrink-0 px-5 pt-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-5 flex items-center justify-center gap-3 transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-white/10 bg-slate-900/40 hover:border-white/20 hover:bg-slate-900/70'
            }`}
          >
            {busy ? (
              <>
                <svg className="w-5 h-5 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
                <span className="text-sm text-amber-300">Envoi en cours…</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span className="text-sm text-slate-300">
                  <span className="text-slate-100 font-medium">Glisse une {cfg.label} ici</span>
                  <span className="text-slate-500"> ou clique pour choisir un fichier</span>
                </span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={cfg.accept}
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
          </div>
          {err && (
            <p className="text-xs text-red-400 mt-2 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">{err}</p>
          )}
        </div>

        {/* Grille d'images */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {assetEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-800/60 border border-white/5 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <p className="text-sm text-slate-400 font-medium">Aucune {cfg.label} pour l'instant</p>
              <p className="text-xs text-slate-600 mt-1">Charge une première {cfg.label} avec la zone ci-dessus.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {assetEntries.map(([id, a]) => {
                const isSelected = selectedId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedId(id)}
                    onDoubleClick={() => onPick({ assetId: id, filename: a.filename })}
                    className={`group relative bg-slate-900/70 border rounded-lg overflow-hidden transition-all text-left ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/10'
                        : 'border-white/5 hover:border-white/15 hover:bg-slate-800/60'
                    }`}
                  >
                    {/* Preview */}
                    <div className="aspect-square bg-slate-950 flex items-center justify-center relative">
                      {kind === 'video' ? (
                        <video
                          src={`/uploads/${a.filename}`}
                          muted preload="metadata"
                          className="max-w-full max-h-full object-contain"
                          onMouseEnter={(e) => { try { e.target.play(); } catch {} }}
                          onMouseLeave={(e) => { try { e.target.pause(); e.target.currentTime = 0; } catch {} }}
                        />
                      ) : (
                        <img
                          src={`/uploads/${a.filename}`}
                          alt={a.originalName}
                          className="max-w-full max-h-full object-contain"
                        />
                      )}
                      {/* Bouton supprimer (visible au hover) */}
                      <button
                        onClick={(e) => handleDelete(e, id)}
                        title="Supprimer"
                        className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 backdrop-blur-sm text-slate-300 hover:text-red-300 hover:bg-red-900/60 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
                        </svg>
                      </button>
                      {/* Cocher si sélectionné */}
                      {isSelected && (
                        <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-md">
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      )}
                    </div>
                    {/* Métadonnées */}
                    <div className="px-2 py-1.5 border-t border-white/5">
                      <p className="text-[11px] text-slate-200 font-medium truncate" title={a.originalName}>{a.originalName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{formatBytes(a.sizeBytes)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex-shrink-0 px-5 py-3 border-t border-white/5 flex items-center justify-between gap-3 bg-slate-950/40">
          <p className="text-[11px] text-slate-500">
            {selectedId
              ? <>Sélectionné : <span className="font-mono text-slate-300">{assets[selectedId]?.originalName}</span></>
              : <span className="italic">Clique une {cfg.label} pour la sélectionner — double-clic pour valider directement</span>}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded text-sm transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedId}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Utiliser cette {cfg.label}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
