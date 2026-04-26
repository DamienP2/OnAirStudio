import React from 'react';

// Composant unifié pour tous les choix mutuellement exclusifs (toggles à N options)
// dans l'app : préréglages de temps, sélection de templates, ratios, qualité,
// modes vidéo, layouts planning, etc.
//
// Style inspiré du panel Contrôle → Préréglages de temps :
//   • inactif : bg-slate-900/70, bordure subtile, texte slate-300
//   • actif   : bg-blue-600/15, bordure bleue, texte blanc, badge ✓ en haut à droite
//
// Usage :
//   <OptionGroup
//     value={current}
//     onChange={setValue}
//     options={[
//       { value: 'a', label: 'Option A' },
//       { value: 'b', label: 'Option B', icon: <SvgB/>, hint: 'Tooltip' }
//     ]}
//     cols={2}     // optionnel (défaut = nombre d'options, max 4)
//     size="md"    // 'sm' | 'md' (défaut)
//     stacked      // affiche icône au-dessus du label (défaut côte-à-côte)
//   />

const COLS_MAP = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6'
};

const SIZE = {
  sm: { pad: 'py-1.5 px-2', text: 'text-[11px]', gap: 'gap-1' },
  md: { pad: 'py-2.5 px-2', text: 'text-xs',     gap: 'gap-2' }
};

export default function OptionGroup({ value, onChange, options, cols, size = 'md', stacked = false, disabled = false }) {
  const cls = SIZE[size] || SIZE.md;
  const nCols = Math.min(cols || options.length, 6);
  const gridCols = COLS_MAP[nCols] || 'grid-cols-3';
  return (
    <div className={`grid ${gridCols} ${cls.gap}`}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => !disabled && !opt.disabled && onChange(opt.value)}
            disabled={disabled || opt.disabled}
            title={opt.hint}
            className={`relative ${cls.pad} ${cls.text} rounded-md border font-medium transition-all
              disabled:opacity-40 disabled:cursor-not-allowed
              ${active
                ? 'bg-blue-600/15 border-blue-500 text-white'
                : 'bg-slate-900/70 border-white/5 hover:border-blue-500/40 text-slate-300 hover:text-slate-50'}`}
          >
            {active && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center pointer-events-none">
                <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
            {opt.icon ? (
              stacked ? (
                <span className="flex flex-col items-center gap-1">
                  <span className="flex items-center justify-center">{opt.icon}</span>
                  <span>{opt.label}</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  {opt.icon}
                  <span>{opt.label}</span>
                </span>
              )
            ) : (
              opt.label
            )}
          </button>
        );
      })}
    </div>
  );
}
