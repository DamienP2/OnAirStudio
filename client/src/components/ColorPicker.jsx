import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { usePalette } from '../store/PaletteContext';

// Helpers : conversion hex8 (#RRGGBBAA) ↔ {r,g,b,a}.
// Accepte aussi les formes #RGB, #RRGGBB en entrée (l'alpha défaut = 1.0).
function parseHex(v) {
  if (!v) return { r: 0, g: 0, b: 0, a: 1 };
  let s = String(v).trim();
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  if (s.length === 6) s += 'FF';
  if (s.length !== 8) return { r: 0, g: 0, b: 0, a: 1 };
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  const a = parseInt(s.slice(6, 8), 16);
  if ([r, g, b, a].some(Number.isNaN)) return { r: 0, g: 0, b: 0, a: 1 };
  return { r, g, b, a: a / 255 };
}

function toHex2(n) { return Math.round(Math.max(0, Math.min(255, n))).toString(16).toUpperCase().padStart(2, '0'); }

export function formatHex8({ r, g, b, a = 1 }) {
  return '#' + toHex2(r) + toHex2(g) + toHex2(b) + toHex2(a * 255);
}

// Hex à 6 chars (#RRGGBB) — pour <input type="color"> qui n'accepte que ce format.
export function hex6Of(value) {
  const s = String(value || '#000000').trim();
  if (s.startsWith('#') && s.length >= 7) return ('#' + s.slice(1, 7)).toUpperCase();
  return '#000000';
}

// Style "damier" pour montrer la transparence sous une couleur RGBA.
const checker = {
  backgroundImage:
    'linear-gradient(45deg, #555 25%, transparent 25%),' +
    'linear-gradient(-45deg, #555 25%, transparent 25%),' +
    'linear-gradient(45deg, transparent 75%, #555 75%),' +
    'linear-gradient(-45deg, transparent 75%, #555 75%)',
  backgroundSize: '8px 8px',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0'
};

function rgbaCss({ r, g, b, a }) {
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

// Swatch coloré avec damier sous-jacent (visible quand alpha < 1).
function ColorSwatch({ value, className = '', style = {} }) {
  const { r, g, b, a } = parseHex(value);
  return (
    <span className={`relative inline-block rounded ${className}`} style={style}>
      <span className="absolute inset-0 rounded" style={checker} />
      <span className="absolute inset-0 rounded" style={{ backgroundColor: rgbaCss({ r, g, b, a }) }} />
    </span>
  );
}

// Props :
//  • value / onChange : couleur courante (hex8) + setter
//  • disableAlpha : si true, masque le slider alpha (force a=1 au commit texte)
//  • compact : si true, le trigger est un simple swatch carré sans hex affiché
//    — utilisé dans la grille de palette de SettingsPanel.
//  • triggerClassName : classes appliquées au bouton du trigger (utile en mode
//    compact pour aligner sur la grille parente).
//  • hidePalette : masque la section "Palette" dans le popover — utilisé
//    précisément quand on édite la palette elle-même (sinon circulaire).
//  • onDelete : si fourni, affiche un bouton "Supprimer" en bas du popover.
//    Utilisé pour la palette : la suppression vit dans le menu contextuel
//    plutôt que sur un bouton séparé à côté du swatch.
export default function ColorPicker({ value, onChange, disableAlpha = false, compact = false, triggerClassName = '', hidePalette = false, onDelete = null }) {
  const { palette } = usePalette();
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [textBuffer, setTextBuffer] = useState(null);

  const rgba = parseHex(value);
  const hex8 = formatHex8(rgba);

  // Calcule la position du popover (fixed) à l'ouverture et au scroll/resize.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const update = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      const ph = 320; // hauteur estimée du popover
      const pw = 248;
      let top = r.bottom + 6;
      let left = r.left;
      if (top + ph > window.innerHeight) top = Math.max(8, r.top - ph - 6);
      if (left + pw > window.innerWidth) left = Math.max(8, window.innerWidth - pw - 8);
      setPos({ top, left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  // Fermeture : clic extérieur + Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (buttonRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const updateRGB = (hex6) => {
    const next = parseHex(hex6);
    next.a = rgba.a;
    onChange(formatHex8(next));
  };
  const updateAlpha = (alpha) => {
    onChange(formatHex8({ ...rgba, a: Math.max(0, Math.min(1, alpha)) }));
  };

  // Édition manuelle du champ hex — on bufferise pour permettre la frappe libre,
  // commit au blur ou Enter (si valide).
  const handleTextChange = (e) => setTextBuffer(e.target.value);
  const commitText = () => {
    if (textBuffer === null) return;
    const cleaned = textBuffer.trim();
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(cleaned);
    if (m) {
      const hex = '#' + m[1].toUpperCase();
      const parsed = parseHex(hex);
      // Si user a tapé seulement 6 chars, on conserve l'alpha courant
      if (m[1].length === 6 || m[1].length === 3) parsed.a = rgba.a;
      if (disableAlpha) parsed.a = 1;
      onChange(formatHex8(parsed));
    }
    setTextBuffer(null);
  };

  return (
    <>
      {compact ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(o => !o)}
          title={hex8}
          className={`relative aspect-square rounded-md border transition-all ${open ? 'border-blue-500 scale-105' : 'border-white/15 hover:border-white/40 hover:scale-105'} ${triggerClassName}`}
        >
          <span className="absolute inset-0 rounded-md" style={checker} />
          <span className="absolute inset-0 rounded-md" style={{ backgroundColor: rgbaCss(rgba) }} />
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-2 bg-slate-950 border border-white/10 hover:border-white/20 rounded-md px-1.5 py-1 transition-colors w-full ${open ? 'border-blue-500' : ''}`}
        >
          <ColorSwatch value={hex8} className="w-7 h-6 border border-white/20 flex-shrink-0" />
          <span className="text-slate-300 font-mono text-xs flex-1 text-left">{hex8}</span>
        </button>
      )}

      {open && (
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 248, zIndex: 1000 }}
          className="bg-slate-900 border border-white/10 rounded-lg shadow-2xl shadow-black/50 p-3 space-y-3"
        >
          {/* Palette — masquée quand on édite la palette elle-même
              (hidePalette=true), sinon ça serait circulaire. */}
          {!hidePalette && (
            <div>
              <p className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5">Palette</p>
              {palette.length === 0 ? (
                <p className="text-[10px] text-slate-600 italic px-1 py-2">
                  Vide. Ajoute des couleurs dans <span className="text-slate-400">Réglages → Palette</span>.
                </p>
              ) : (
                // flex-wrap + dimensions fixes (w-7 h-7) + flex-shrink-0 :
                // garantit des swatches carrés bien séparés, sans étirement ni
                // chevauchement quel que soit le nombre de couleurs.
                <div className="flex flex-wrap gap-1.5">
                  {palette.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onChange(c.value)}
                      title={c.name || c.value}
                      className="relative w-7 h-7 rounded border border-white/15 hover:border-white/40 hover:scale-110 transition-all flex-shrink-0"
                    >
                      <span className="absolute inset-0 rounded" style={checker} />
                      <span className="absolute inset-0 rounded" style={{ backgroundColor: rgbaCss(parseHex(c.value)) }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Roue native + hex — pas de label, redondant avec le champ "Couleur"
              du formulaire parent (Inspector / Settings) qui ouvre déjà ce popover. */}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={hex6Of(hex8)}
              onChange={e => updateRGB(e.target.value)}
              className="w-10 h-9 rounded cursor-pointer bg-transparent border border-white/15 flex-shrink-0"
              style={{ padding: 0 }}
            />
            <input
              type="text"
              value={textBuffer !== null ? textBuffer : hex8}
              onChange={handleTextChange}
              onBlur={commitText}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }}
              className="flex-1 bg-slate-950 border border-white/10 focus:border-blue-500 rounded px-2 py-1.5 text-slate-100 font-mono text-xs outline-none min-w-0"
              spellCheck={false}
              placeholder="#RRGGBBAA"
            />
          </div>

          {/* Slider alpha */}
          {!disableAlpha && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">Opacité</p>
                <span className="text-[10px] font-mono text-slate-300">{Math.round(rgba.a * 100)}%</span>
              </div>
              <div
                className="relative h-3 rounded overflow-hidden border border-white/10"
                style={checker}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(to right, rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, 0) 0%, rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, 1) 100%)`
                  }}
                />
                <input
                  type="range"
                  min="0" max="100" step="1"
                  value={Math.round(rgba.a * 100)}
                  onChange={e => updateAlpha(Number(e.target.value) / 100)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-slate-900 shadow-md pointer-events-none"
                  style={{ left: `calc(${rgba.a * 100}% - 6px)` }}
                />
              </div>
            </div>
          )}

          {/* Action destructive — bouton "Supprimer" rendu uniquement quand
              onDelete est fourni (typiquement : édition d'une couleur de
              palette). Séparé du reste par une fine rule pour signaler son
              statut spécial. */}
          {onDelete && (
            <div className="pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => { onDelete(); setOpen(false); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-300 text-xs font-medium rounded transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
                </svg>
                Supprimer cette couleur
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export { ColorSwatch };
