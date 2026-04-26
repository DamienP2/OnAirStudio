import React from 'react';
import { OBJECT_TYPES, DEFAULT_PROPS, DEFAULT_SIZES } from './defaultProps';
import { useTimerState } from '../store/TimerContext';

function bboxOverlap(a, b) {
  return !(a.x + a.width < b.x ||
           b.x + b.width < a.x ||
           a.y + a.height < b.y ||
           b.y + b.height < a.y);
}

function findFreeSpot(existingObjs, canvas, newWidth, newHeight) {
  const STEP = 40;
  const MARGIN = 20;
  for (let y = MARGIN; y + newHeight <= canvas.height - MARGIN; y += STEP) {
    for (let x = MARGIN; x + newWidth <= canvas.width - MARGIN; x += STEP) {
      const candidate = { x, y, width: newWidth, height: newHeight };
      const collides = existingObjs.some(o => bboxOverlap(candidate, o));
      if (!collides) return { x, y };
    }
  }
  const offset = existingObjs.length * 20;
  return { x: MARGIN + offset, y: MARGIN + offset };
}

// Crée un objet aux coordonnées fournies (drop) ou à un emplacement libre (clic).
// `propsOverride` permet d'injecter des valeurs dynamiques (ex: timezone de l'app
// pour les horloges) au moment de la création.
function newObjectOfType(type, existingObjs = [], canvas = { width: 1920, height: 1080 }, dropPos = null, propsOverride = {}) {
  const size = DEFAULT_SIZES[type] || { width: 200, height: 200 };
  const pos = dropPos
    ? { x: Math.max(0, Math.min(dropPos.x, canvas.width - size.width)),
        y: Math.max(0, Math.min(dropPos.y, canvas.height - size.height)) }
    : findFreeSpot(existingObjs, canvas, size.width, size.height);
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    x: pos.x, y: pos.y,
    width: size.width, height: size.height,
    rotation: 0, zIndex: 1,
    props: { ...DEFAULT_PROPS[type], ...propsOverride }
  };
}

// Helper : pour les horloges (variant 'current'), pré-remplit la timezone avec
// celle de l'app pour que l'utilisateur démarre toujours sur "Heure locale".
function defaultsForType(type, appTz) {
  if ((type === 'analog-clock' || type === 'digital-clock') && appTz) {
    return { timezone: appTz };
  }
  return {};
}

// Exporté pour que Canvas puisse créer un objet à un drop position
export { newObjectOfType, defaultsForType };

const ICONS = {
  'analog-clock':           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  'digital-clock':          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="6" width="20" height="12" rx="2"/><text x="12" y="15" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none">12:00</text></svg>,
  'text':                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  'logo':                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>,
  'date':                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  'image':                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><polyline points="21 15 16 10 5 21"/></svg>,
  'video':                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  'onair-badge':            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M6.34 17.66a8 8 0 0 1 0-11.31"/><path d="M17.66 6.34a8 8 0 0 1 0 11.31"/><path d="M3.51 20.49a12 12 0 0 1 0-16.97"/><path d="M20.49 3.51a12 12 0 0 1 0 16.97"/></svg>,
  'shape':                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="8" height="8" rx="1"/><circle cx="17" cy="17" r="4"/></svg>,
  'progress-bar':           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="10" width="11" height="4" rx="1" fill="currentColor" stroke="none"/></svg>,
  'progress-ring':          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="9" opacity="0.3"/><path d="M12 3a9 9 0 0 1 9 9"/></svg>,
  'planning':               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="8" cy="14" r="1" fill="currentColor"/><line x1="11" y1="14" x2="17" y2="14"/><circle cx="8" cy="18" r="1" fill="currentColor"/><line x1="11" y1="18" x2="17" y2="18"/></svg>
};

export default function Palette({ onAdd, existingObjs = [], canvas = { width: 1920, height: 1080 } }) {
  const { timezone: appTz } = useTimerState();
  const categories = [...new Set(OBJECT_TYPES.map(t => t.category))];
  return (
    <aside className="w-60 bg-[#06090f] border-r border-white/5 flex-shrink-0 h-full overflow-y-auto">
      <div className="p-3 space-y-4">
        {categories.map(cat => (
          <div key={cat}>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">{cat}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {OBJECT_TYPES.filter(t => t.category === cat).map(t => (
                <button
                  key={t.type}
                  draggable
                  onDragStart={(e) => {
                    // Stocke le type dans le DataTransfer — Canvas le récupère sur drop.
                    e.dataTransfer.setData('application/x-onair-object-type', t.type);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="group flex flex-col items-center gap-1.5 p-3 bg-slate-800/70 hover:bg-slate-800 border border-white/5 hover:border-blue-500/50 rounded-md transition-all text-slate-400 hover:text-slate-50 cursor-grab active:cursor-grabbing"
                  onClick={() => onAdd(newObjectOfType(t.type, existingObjs, canvas, null, defaultsForType(t.type, appTz)))}
                  title={`${t.label} — glisse-dépose ou clique pour placer`}
                >
                  <div>{ICONS[t.type]}</div>
                  <span className="text-[10px] leading-tight text-center line-clamp-2">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
