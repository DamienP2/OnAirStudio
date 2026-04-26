import React from 'react';
import { format as formatDate } from 'date-fns';
import { fr, enGB } from 'date-fns/locale';
import { FONT_FAMILIES, DEFAULT_PROPS, SQUARE_RATIO_TYPES, VIDEO_RATIOS, ratioOf } from './defaultProps';
import { useTimerState } from '../store/TimerContext';
import { useTr, useLang } from '../hooks/useT';
import { socket } from '../socket';
import { apiListCalendarAccounts, apiCalendarEvents } from '../store/calendarStore';
import { apiNdiStatus, apiNdiSources, apiSdiStatus } from '../store/videoStore';
import OptionGroup from '../components/OptionGroup';
import ColorPicker from '../components/ColorPicker';

// Permet à ScrubNumberInput d'envelopper son drag dans une transaction undo
// (un seul snapshot pour toute la session de glisser, plutôt qu'un par pixel).
const TxContext = React.createContext({ beginTx: null, endTx: null });

// Presets de format date — affichage convivial avec preview de la date du jour.
const DATE_PRESETS = [
  { id: 'full',       fmt: 'EEEE d MMMM yyyy',  label: 'Complet (jour, date longue)' },
  { id: 'long',       fmt: 'd MMMM yyyy',       label: 'Long (date sans jour)' },
  { id: 'medium',     fmt: 'EEE d MMM yyyy',    label: 'Moyen (abréviations)' },
  { id: 'short',      fmt: 'dd/MM/yyyy',        label: 'Court (chiffres)' },
  { id: 'iso',        fmt: 'yyyy-MM-dd',        label: 'ISO (technique)' },
  { id: 'day-month',  fmt: 'EEEE d MMMM',       label: 'Jour + date sans année' },
  { id: 'day-num',    fmt: 'dd/MM',             label: 'Jour/Mois' },
  { id: 'month-year', fmt: 'MMMM yyyy',         label: 'Mois + année' }
];

// ---------------------------------------------------------------------------
// Primitive labels for humanisation — bilingual (fr / en).
// ---------------------------------------------------------------------------
const LABELS = {
  fr: {
    label: 'Texte', text: 'Texte', template: 'Modèle (utilise {remaining} etc)',
    format: 'Format date', locale: 'Langue', fontFamily: 'Police', fontWeight: 'Graisse',
    textAlign: 'Alignement', textTransform: 'Casse',
    showSeconds: 'Afficher les secondes', showHours: 'Afficher les heures',
    showMinutes: 'Afficher les minutes', showLabel: 'Afficher le libellé',
    variant: "Type d'horloge", timezone: 'Fuseau horaire',
    icsUrl: 'URL ICS (iCal)', titleKeyword: 'Filtre titre (optionnel)',
    showLocation: 'Afficher le lieu', showDescription: 'Afficher la description',
    accentColor: 'Couleur accent (en cours)', pastOpacity: 'Opacité événements passés',
    flashOnLast10s: 'Clignoter 10s finales', isNTPActive: 'Indicateur NTP',
    color: 'Couleur', dialColor: 'Couleur cadran', handColor: 'Couleur aiguilles',
    hourColor: 'Couleur heures', secondColor: 'Couleur secondes', centerColor: 'Couleur centre',
    activeColor: 'Couleur active', inactiveColor: 'Couleur inactive',
    fillColor: 'Couleur remplissage', strokeColor: 'Couleur bordure', bgColor: 'Couleur fond',
    backgroundColor: 'Couleur de fond', strokeWidth: 'Épaisseur bordure',
    borderRadius: 'Rayon bords', opacity: 'Opacité', direction: 'Orientation',
    thickness: 'Épaisseur', startAngle: 'Angle de départ', type: 'Forme', objectFit: 'Ajustement',
    assetId: 'Asset (interne)', filename: 'Fichier', fontSize: 'Taille police (legacy)',
    previewActive: 'Prévisualiser le mode actif', useThresholds: 'Activer seuils de couleur',
    warningColor: 'Couleur — avertissement', dangerColor: 'Couleur — danger',
    warningSeconds: 'Avertissement à (restant)', dangerSeconds: 'Danger à (restant)',
    warningThreshold: 'Seuil avertissement', dangerThreshold: 'Seuil danger'
  },
  en: {
    label: 'Text', text: 'Text', template: 'Template (use {remaining} etc.)',
    format: 'Date format', locale: 'Language', fontFamily: 'Font', fontWeight: 'Weight',
    textAlign: 'Alignment', textTransform: 'Case',
    showSeconds: 'Show seconds', showHours: 'Show hours',
    showMinutes: 'Show minutes', showLabel: 'Show label',
    variant: 'Clock type', timezone: 'Timezone',
    icsUrl: 'ICS URL (iCal)', titleKeyword: 'Title filter (optional)',
    showLocation: 'Show location', showDescription: 'Show description',
    accentColor: 'Accent color (running)', pastOpacity: 'Past events opacity',
    flashOnLast10s: 'Flash final 10s', isNTPActive: 'NTP indicator',
    color: 'Color', dialColor: 'Dial color', handColor: 'Hand color',
    hourColor: 'Hours color', secondColor: 'Seconds color', centerColor: 'Center color',
    activeColor: 'Active color', inactiveColor: 'Inactive color',
    fillColor: 'Fill color', strokeColor: 'Border color', bgColor: 'Background color',
    backgroundColor: 'Background color', strokeWidth: 'Border width',
    borderRadius: 'Border radius', opacity: 'Opacity', direction: 'Orientation',
    thickness: 'Thickness', startAngle: 'Start angle', type: 'Shape', objectFit: 'Fit',
    assetId: 'Asset (internal)', filename: 'File', fontSize: 'Font size (legacy)',
    previewActive: 'Preview active mode', useThresholds: 'Enable color thresholds',
    warningColor: 'Color — warning', dangerColor: 'Color — danger',
    warningSeconds: 'Warning at (remaining)', dangerSeconds: 'Danger at (remaining)',
    warningThreshold: 'Warning threshold', dangerThreshold: 'Danger threshold'
  }
};

function humanizeKey(k, lang = 'fr') {
  return (LABELS[lang] && LABELS[lang][k]) || LABELS.fr[k] || k;
}

// ---------------------------------------------------------------------------
// Group mapping
// ---------------------------------------------------------------------------

const GROUP_MAPPING = {
  text: 'content', template: 'content', format: 'content', label: 'content', showLabel: 'content', locale: 'content',
  variant: 'content', timezone: 'content',
  icsUrl: 'content', titleKeyword: 'content',
  accentColor: 'colors', pastOpacity: 'appearance',
  showLocation: 'behavior', showDescription: 'behavior',
  fontFamily: 'typography', fontWeight: 'typography', textAlign: 'typography', textTransform: 'typography',
  // Threshold colors go to "thresholds", not "colors"
  fillColor: 'thresholds',
  warningColor: 'thresholds', dangerColor: 'thresholds',
  warningThreshold: 'thresholds', dangerThreshold: 'thresholds',
  warningSeconds: 'thresholds', dangerSeconds: 'thresholds',
  useThresholds: 'thresholds',
  backgroundColor: 'appearance', borderRadius: 'appearance', opacity: 'appearance',
  strokeColor: 'appearance', strokeWidth: 'appearance',
  type: 'appearance', objectFit: 'appearance',
  direction: 'behavior',
  showSeconds: 'behavior', showHours: 'behavior', showMinutes: 'behavior',
  flashOnLast10s: 'behavior', isNTPActive: 'behavior', previewActive: 'behavior',
  thickness: 'advanced', startAngle: 'advanced'
};

function groupFor(key, allProps) {
  // Special rule: fillColor goes to "colors" (not "thresholds") if no useThresholds prop
  if (key === 'fillColor' && allProps.useThresholds === undefined) return 'colors';
  if (GROUP_MAPPING[key]) return GROUP_MAPPING[key];
  // Fallback: colors → colors, otherwise advanced
  if (/color/i.test(key)) return 'colors';
  return 'advanced';
}

const GROUPS_ORDER = [
  { id: 'content',    label: { fr: 'Contenu',         en: 'Content' },         defaultOpen: true },
  { id: 'typography', label: { fr: 'Typographie',     en: 'Typography' },      defaultOpen: true },
  { id: 'colors',     label: { fr: 'Couleurs',        en: 'Colors' },          defaultOpen: true },
  { id: 'appearance', label: { fr: 'Apparence',       en: 'Appearance' },      defaultOpen: true },
  { id: 'behavior',   label: { fr: 'Comportement',    en: 'Behavior' },        defaultOpen: true },
  { id: 'thresholds', label: { fr: 'Seuils de couleur', en: 'Color thresholds' }, defaultOpen: true },
  { id: 'advanced',   label: { fr: 'Avancé',          en: 'Advanced' },        defaultOpen: false }
];

// ---------------------------------------------------------------------------
// UI components
// ---------------------------------------------------------------------------

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, defaultOpen = true, badge, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="mb-4 border-b border-white/5 pb-3 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-1.5 bg-transparent text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-200 font-semibold"
      >
        <span className="flex items-center gap-2">
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.05 4.55a.75.75 0 011.06 0l5 5a.75.75 0 010 1.06l-5 5a.75.75 0 01-1.06-1.06L11.53 10 7.05 5.52a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
          {title}
          {badge && <span className="text-slate-500 font-normal normal-case tracking-normal">{badge}</span>}
        </span>
      </button>
      {open && <div className="pt-2">{children}</div>}
    </div>
  );
}

function PercentSlider({ value, onChange }) {
  // value: 0-1, displayed as %
  const pct = Math.round((value ?? 0) * 100);
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min="0" max="100" step="1"
        value={pct}
        onChange={e => onChange(Number(e.target.value) / 100)}
        className="flex-1 accent-blue-500"
      />
      <span className="font-mono text-xs text-slate-300 bg-slate-900 px-2 py-1 rounded min-w-[42px] text-center">{pct}%</span>
    </div>
  );
}

function TextInput({ value, onChange, ...rest }) {
  return (
    <input
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      {...rest}
      className="w-full bg-slate-950 border border-white/10 focus:border-blue-500 rounded-md text-slate-50 text-sm px-2 py-1.5 outline-none transition-colors"
    />
  );
}

function NumberInput({ value, onChange, ...rest }) {
  return (
    <input
      type="number"
      value={value ?? 0}
      onChange={e => onChange(Number(e.target.value))}
      {...rest}
      className="w-full bg-slate-950 border border-white/10 focus:border-blue-500 rounded-md text-slate-50 text-sm px-2 py-1.5 outline-none transition-colors"
    />
  );
}

function ScrubNumberInput({ value, onChange, step = 1, min, max, unit = '' }) {
  const inputRef = React.useRef();
  const dragRef = React.useRef(null);
  const [isDragging, setIsDragging] = React.useState(false);
  // editing : string brute en cours de frappe. null = on affiche la valeur du parent.
  // On bufferise pour ne pas clamper pendant la frappe — sinon taper "9" sur un
  // champ avec min=10 serait immédiatement transformé en 10, puis "0" → "100",
  // puis "0" → "1000" (le user voulait 900). Le clamp s'applique uniquement
  // au blur ou à Enter.
  const [editing, setEditing] = React.useState(null);
  const { beginTx, endTx } = React.useContext(TxContext);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    // Si l'input a déjà le focus, on laisse la saisie clavier normale
    if (document.activeElement === inputRef.current) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startValue: Number(value) || 0,
      moved: false,
      txOpen: false
    };

    const onMove = (ev) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      if (!dragRef.current.moved && Math.abs(dx) > 2) {
        dragRef.current.moved = true;
        setIsDragging(true);
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        // Ouvre la transaction undo : un seul snapshot pour toute la durée du drag
        if (beginTx) { beginTx(); dragRef.current.txOpen = true; }
      }
      if (dragRef.current.moved) {
        let newVal = dragRef.current.startValue + dx * step;
        if (min !== undefined) newVal = Math.max(min, newVal);
        if (max !== undefined) newVal = Math.min(max, newVal);
        onChange(Math.round(newVal));
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const wasDrag = dragRef.current && dragRef.current.moved;
      const txOpen = dragRef.current && dragRef.current.txOpen;
      dragRef.current = null;
      setIsDragging(false);
      if (txOpen && endTx) endTx();
      if (!wasDrag) {
        // Clic sans drag → focus pour saisie clavier
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Commit : parse la string en cours, clamp aux bornes JS, propage au parent.
  // Si la string est vide ou invalide, on revient à la valeur précédente.
  const commitEdit = () => {
    if (editing === null) return;
    const trimmed = editing.trim();
    let num = trimmed === '' ? (value ?? 0) : Number(trimmed);
    if (!Number.isFinite(num)) num = value ?? 0;
    if (min !== undefined) num = Math.max(min, num);
    if (max !== undefined) num = Math.min(max, num);
    setEditing(null);
    if (num !== value) onChange(num);
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    setEditing(raw);
    // Live-propagation pendant la frappe SANS clamp aux bornes — comme ça
    // l'objet bouge en temps réel mais on n'empêche pas le user de tracer une
    // valeur intermédiaire (ex: "9" en route vers "900").
    if (raw === '') return;
    const num = Number(raw);
    if (Number.isFinite(num)) onChange(num);
  };

  return (
    <div className={`relative flex items-center bg-slate-950 border border-white/10 rounded-md transition-colors ${isDragging ? 'border-blue-500' : 'focus-within:border-blue-500'}`}>
      <input
        ref={inputRef}
        type="number"
        value={editing !== null ? editing : (value ?? 0)}
        onChange={handleChange}
        onBlur={commitEdit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur(); } }}
        step={step}
        // ⚠️ min/max ne sont volontairement PAS passés en attribut HTML : certains
        // navigateurs clampent ou rejettent les valeurs intermédiaires en cours
        // de frappe, ce qui empêchait l'utilisateur de saisir librement (ex:
        // taper "9" devenait "10" instantanément). Les bornes sont appliquées
        // côté JS uniquement au commit (blur / Enter).
        onMouseDown={handleMouseDown}
        onFocus={e => e.target.select()}
        className={`w-full px-2 py-1.5 bg-transparent text-white text-sm outline-none ${isDragging || document.activeElement !== inputRef.current ? 'cursor-ew-resize' : 'cursor-text'}`}
        style={{ paddingRight: unit ? 24 : 8 }}
      />
      {unit && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 pointer-events-none">{unit}</span>
      )}
    </div>
  );
}

// ColorInput délègue au ColorPicker partagé (popover avec palette + alpha).
// Format de la valeur : `#RRGGBBAA` (8 chars). Compatible avec les anciennes
// valeurs `#RRGGBB` qui sont parsées comme alpha=1.
function ColorInput({ value, onChange }) {
  return <ColorPicker value={value} onChange={onChange} />;
}

function ToggleInput({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex items-center h-5 w-10 rounded-full transition-colors flex-shrink-0 p-0 border-0 ${value ? 'bg-blue-600' : 'bg-slate-700'}`}
      role="switch"
      aria-checked={value}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

function FontFamilySelect({ value, onChange }) {
  return (
    <select
      value={value || 'Inter'}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2 py-1 bg-slate-950 border border-white/10 focus:border-blue-500 rounded-md text-white text-sm outline-none"
    >
      {FONT_FAMILIES.map(f => (
        <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
          {f.label}
        </option>
      ))}
    </select>
  );
}

// Variables disponibles pour le DynamicText (placeholders interpolés au runtime)
const DYNAMIC_TEXT_VARIABLES = [
  { key: 'remaining',  label: 'Restant' },
  { key: 'elapsed',    label: 'Écoulé' },
  { key: 'current',    label: 'Heure' },
  { key: 'studioName', label: 'Studio' }
];

function TemplateInput({ value, onChange }) {
  const inputRef = React.useRef();
  const selectionRef = React.useRef({ start: 0, end: 0 });

  const capture = () => {
    const el = inputRef.current;
    if (!el) return;
    selectionRef.current = {
      start: el.selectionStart ?? 0,
      end: el.selectionEnd ?? 0
    };
  };

  const insert = (varKey) => {
    const el = inputRef.current;
    if (!el) return;
    const { start, end } = selectionRef.current;
    const v = value ?? '';
    const token = `{${varKey}}`;
    const next = v.slice(0, start) + token + v.slice(end);
    onChange(next);
    // repositionner le curseur juste après le token inséré
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
      selectionRef.current = { start: pos, end: pos };
    });
  };

  return (
    <div>
      <input
        ref={inputRef}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        onKeyUp={capture}
        onClick={capture}
        onBlur={capture}
        spellCheck={false}
        className="w-full bg-slate-950 border border-white/10 focus:border-blue-500 rounded-md text-slate-50 text-sm px-2 py-1.5 outline-none transition-colors font-mono"
      />
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="text-[10px] text-slate-500 self-center mr-1">Insérer :</span>
        {DYNAMIC_TEXT_VARIABLES.map(v => (
          <button
            key={v.key}
            type="button"
            onMouseDown={e => e.preventDefault()} // garde le focus sur l'input
            onClick={() => insert(v.key)}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-[11px] rounded-md border border-white/10 transition-colors"
            title={`Insère {${v.key}} à la position du curseur`}
          >
            <span className="font-mono text-[10px] opacity-70">{`{${v.key}}`}</span>
            <span>{v.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart prop dispatcher
// ---------------------------------------------------------------------------

// Champ URL ICS avec aide contextuelle (copier l'adresse secrète ou publique depuis Google Calendar).
function IcsUrlInput({ value, onChange }) {
  return (
    <div>
      <input
        type="url"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
        className="w-full px-2 py-1.5 bg-slate-950 border border-white/10 rounded-md text-white text-xs font-mono outline-none focus:border-blue-500"
      />
      <p className="text-[10px] text-slate-500 mt-1 leading-tight">
        Dans Google Calendar → Paramètres de l'agenda → « Adresse secrète au format iCal »
        ou « URL publique au format iCal ».
      </p>
    </div>
  );
}

// Sélecteur de format date avec preview live de la date du jour pour chaque preset.
// Si la valeur courante ne correspond à aucun preset → mode "Personnalisé" (text input).
function DateFormatPicker({ value, onChange }) {
  const { language } = useTimerState();
  const locale = language === 'en' ? enGB : fr;
  const today = new Date();
  const safeFormat = (fmt) => {
    try { return formatDate(today, fmt, { locale }); } catch { return '—'; }
  };
  const matchesPreset = DATE_PRESETS.find(p => p.fmt === value);
  const isCustom = !matchesPreset && (value || '').length > 0;
  const [showCustom, setShowCustom] = React.useState(isCustom);

  return (
    <div className="space-y-1.5">
      <select
        value={isCustom ? '__custom__' : (matchesPreset ? matchesPreset.id : DATE_PRESETS[0].id)}
        onChange={(e) => {
          const id = e.target.value;
          if (id === '__custom__') { setShowCustom(true); return; }
          setShowCustom(false);
          const preset = DATE_PRESETS.find(p => p.id === id);
          if (preset) onChange(preset.fmt);
        }}
        className="w-full bg-slate-950 border border-white/10 focus:border-blue-500 rounded-md text-slate-50 text-sm px-2 py-1.5 outline-none"
      >
        {DATE_PRESETS.map(p => (
          <option key={p.id} value={p.id}>{p.label} — {safeFormat(p.fmt)}</option>
        ))}
        <option value="__custom__">Personnalisé…</option>
      </select>
      {showCustom && (
        <div>
          <input
            type="text"
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            placeholder="ex: dd MMM yyyy à HH:mm"
            className="w-full bg-slate-950 border border-white/10 focus:border-blue-500 rounded-md text-slate-50 text-xs font-mono px-2 py-1.5 outline-none"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Aperçu : <span className="font-mono text-slate-300">{safeFormat(value)}</span>
          </p>
        </div>
      )}
    </div>
  );
}

function PropRow({ k, v, obj, setProp }) {
  const lang = useLang();
  const tr = useTr();
  const hk = (key) => humanizeKey(key, lang);
  // 1. Skip internal / handled-separately props
  if (k === 'assetId' || k === 'filename') return null;
  // locale n'est plus exposé : il suit la langue de l'app (Réglages)
  if (k === 'locale') return null;

  // Format de date — picker avec presets et preview
  if (k === 'format' && obj.type === 'date') {
    return (
      <Field key={k} label={tr({ fr: 'Format', en: 'Format' })}>
        <DateFormatPicker value={v} onChange={x => setProp(k, x)} />
      </Field>
    );
  }

  // 2. Seuils en secondes restantes (ScrubNumberInput avec unité "s")
  if (k === 'warningSeconds' || k === 'dangerSeconds') {
    return (
      <Field key={k} label={hk(k)}>
        <ScrubNumberInput value={v} onChange={x => setProp(k, x)} min={0} max={3600} unit="s" />
      </Field>
    );
  }
  // 2b. Legacy thresholds en ratio 0-1 (via slider %) — pour rétrocompat
  if (k === 'warningThreshold' || k === 'dangerThreshold') {
    return (
      <Field key={k} label={hk(k)}>
        <PercentSlider value={v} onChange={x => setProp(k, x)} />
      </Field>
    );
  }

  // 2c. Texte (statique ou dynamique avec variables {currentTime} {remaining} etc.)
  //     Fusion label + dynamic-text : un seul champ qui supporte les deux.
  if (k === 'text' && (obj.type === 'text' || obj.type === 'label' || obj.type === 'dynamic-text')) {
    return (
      <Field key={k} label="Texte">
        <TemplateInput value={v} onChange={x => setProp(k, x)} />
      </Field>
    );
  }
  // Legacy : ancien dynamic-text avec prop `template` — même UI
  if (k === 'template' && obj.type === 'dynamic-text') {
    return (
      <Field key={k} label="Texte">
        <TemplateInput value={v} onChange={x => setProp(k, x)} />
      </Field>
    );
  }

  // 2c-bis. Variant des horloges (current / remaining / elapsed)
  if (k === 'variant' && (obj.type === 'analog-clock' || obj.type === 'digital-clock' ||
      obj.type === 'analog-clock-current' || obj.type === 'analog-clock-remaining' || obj.type === 'analog-clock-elapsed' ||
      obj.type === 'digital-clock-current' || obj.type === 'digital-clock-remaining' || obj.type === 'digital-clock-elapsed')) {
    // Couleurs par défaut historiques (avant fusion des types)
    const VARIANT_COLORS = { current: '#FFFFFF', remaining: '#EF4444', elapsed: '#3B82F6' };
    const KNOWN_DEFAULTS = Object.values(VARIANT_COLORS);
    const OPTIONS = [
      { val: 'current',   label: 'Actuelle',  icon: '🕐' },
      { val: 'remaining', label: 'Restant',   icon: '⏳' },
      { val: 'elapsed',   label: 'Écoulé',    icon: '⏱' }
    ];
    const handleVariantClick = (newVariant) => {
      setProp('variant', newVariant);
      // Si la couleur actuelle est l'un des défauts connus (i.e. user n'a pas
      // customisé), on bascule sur le défaut du nouveau variant.
      const currentColor = obj.props.color;
      if (currentColor == null || KNOWN_DEFAULTS.includes(currentColor)) {
        setProp('color', VARIANT_COLORS[newVariant]);
      }
    };
    return (
      <Field key={k} label="Type d'horloge">
        <OptionGroup
          size="sm"
          value={v}
          onChange={handleVariantClick}
          options={OPTIONS.map(o => ({ value: o.val, label: o.label }))}
        />
      </Field>
    );
  }

  // 2c-ter. Timezone custom (uniquement utile pour variant='current')
  if (k === 'timezone' && (obj.type === 'analog-clock' || obj.type === 'digital-clock' || obj.type === 'analog-clock-current' || obj.type === 'digital-clock-current')) {
    const isCurrent = (obj.props.variant || 'current') === 'current';
    if (!isCurrent) return null;
    const COMMON_TZ = ['Europe/Paris', 'Europe/London', 'Europe/Berlin', 'Europe/Madrid', 'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai', 'Australia/Sydney', 'UTC'];
    return (
      <Field key={k} label="Fuseau horaire">
        <div>
          <select
            value={v || ''}
            onChange={e => setProp(k, e.target.value)}
            className="w-full bg-slate-950 border border-white/10 focus:border-blue-500 rounded-md text-slate-50 text-sm px-2 py-1.5 outline-none"
          >
            {COMMON_TZ.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            Vide = fuseau de l'app. Restant et écoulé restent calculés sur le fuseau de l'app.
          </p>
        </div>
      </Field>
    );
  }

  // 2d. Planning V3 — body dédié rendu en amont. Toutes les props planning sont
  // gérées par <PlanningInspectorBody/> (cf. branche dédiée plus bas) ; on filtre
  // ici les clés legacy pour qu'elles ne soient pas régénérées en doublon.
  if (obj.type === 'planning') {
    const PLANNING_HANDLED = new Set([
      'accountId','range','calendarIds','titleContains','locations','statuses',
      'hasLocation','hasDescription','durationMinMinutes','durationMaxMinutes','organizers',
      'layout','showTitle','showTime','showLocation','showDescription','showCalendar','showOrganizer',
      'maxItems','colorByCalendar','accentColor','pastOpacity',
      'icsUrl','titleKeyword' // legacy — gérés via une carte rétro-compat dans le body dédié
    ]);
    if (PLANNING_HANDLED.has(k)) return null;
  }

  // 2e. Vidéo — toutes les props sont gérées par <VideoInspectorBody/>.
  if (obj.type === 'video') {
    const VIDEO_HANDLED = new Set([
      'mode','recordedSource','assetId','filename','youtubeUrl',
      'liveSource','ndiSourceName','sdiDeviceId','quality',
      'autoplay','loop','muted','controls','startTime',
      'objectFit','backgroundColor','borderRadius'
    ]);
    if (VIDEO_HANDLED.has(k)) return null;
  }

  // 3. Special cases by prop name
  if (k === 'fontFamily') {
    return (
      <Field key={k} label="Police">
        <FontFamilySelect value={v} onChange={x => setProp(k, x)} />
      </Field>
    );
  }

  if (k === 'textAlign') {
    return (
      <Field key={k} label="Alignement">
        <div className="grid grid-cols-3 gap-1">
          {['left', 'center', 'right'].map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setProp('textAlign', a)}
              className={`py-1.5 text-xs rounded ${v === a ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              {a === 'left' ? '◄' : a === 'center' ? '≡' : '►'}
            </button>
          ))}
        </div>
      </Field>
    );
  }

  // Padding du widget texte — visible uniquement si fond non transparent.
  // Le max du slider est calculé selon la taille courante du widget : un
  // petit cadre ne peut pas absorber 30 % de padding sans devenir illisible.
  // Formule : max% ≈ 30 % d'une dim - 60px. Garde toujours au moins 60 % du
  // widget pour le texte.
  if (k === 'padding' && (obj.type === 'text' || obj.type === 'label' || obj.type === 'dynamic-text')) {
    const bg = obj.props?.backgroundColor;
    const hasBg = bg && bg !== 'transparent';
    if (!hasBg) return null;
    const minDim = Math.min(obj.width || 200, obj.height || 100);
    const maxPad = Math.max(2, Math.min(30, Math.round((minDim - 60) * 0.3)));
    const current = typeof v === 'number' ? v : 8;
    return (
      <Field key={k} label="Marge intérieure" hint={`Espace entre le texte et le bord (max ${maxPad}% selon la taille).`}>
        <ScrubNumberInput
          value={Math.min(current, maxPad)}
          onChange={x => setProp('padding', Math.max(0, Math.min(maxPad, x)))}
          min={0} max={maxPad} unit="%"
        />
      </Field>
    );
  }

  if (k === 'textTransform') {
    const OPTIONS = [
      { val: 'none',       label: 'Aa', title: 'Normal (aucune transformation)' },
      { val: 'uppercase',  label: 'AA', title: 'MAJUSCULES' },
      { val: 'lowercase',  label: 'aa', title: 'minuscules' },
      { val: 'capitalize', label: 'Aa', title: 'Capitaliser' }
    ];
    return (
      <Field key={k} label="Casse">
        <div className="grid grid-cols-4 gap-1">
          {OPTIONS.map(opt => (
            <button
              key={opt.val}
              type="button"
              onClick={() => setProp('textTransform', opt.val)}
              title={opt.title}
              className={`py-1.5 text-xs rounded font-mono ${v === opt.val ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              style={{
                textTransform: opt.val === 'none' ? 'none' : opt.val,
                fontFamily: opt.val === 'capitalize' ? 'inherit' : 'monospace'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>
    );
  }

  if (k === 'fontWeight') {
    // Labels CSS standards (cohérents avec les noms d'OS et pickers de polices).
    // Valeurs CSS officielles : 100 → 900 par paliers de 100.
    const WEIGHTS = [
      { value: '100', label: 'Thin' },
      { value: '200', label: 'Extra Light' },
      { value: '300', label: 'Light' },
      { value: 'normal', label: 'Normal' },          // alias 400
      { value: '500', label: 'Medium' },
      { value: '600', label: 'Semi Bold' },
      { value: 'bold', label: 'Bold' },              // alias 700
      { value: '800', label: 'Extra Bold' },
      { value: '900', label: 'Black' }
    ];
    return (
      <Field key={k} label="Graisse">
        <select
          value={v}
          onChange={e => setProp(k, e.target.value)}
          className="w-full px-2 py-1.5 bg-slate-950 border border-white/10 focus:border-blue-500 rounded-md text-white text-sm outline-none transition-colors"
        >
          {WEIGHTS.map(w => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
      </Field>
    );
  }

  if (k === 'type' && obj.type === 'shape') {
    return (
      <Field key={k} label="Forme">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setProp('type', 'rect')}
            className={`py-1.5 text-xs rounded ${v === 'rect' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            ▭ Rectangle
          </button>
          <button
            type="button"
            onClick={() => setProp('type', 'circle')}
            className={`py-1.5 text-xs rounded ${v === 'circle' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            ● Cercle
          </button>
        </div>
      </Field>
    );
  }

  if (k === 'direction') {
    return (
      <Field key={k} label="Orientation">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setProp('direction', 'h')}
            className={`py-1.5 text-xs rounded ${v === 'h' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            ─ Horizontal
          </button>
          <button
            type="button"
            onClick={() => setProp('direction', 'v')}
            className={`py-1.5 text-xs rounded ${v === 'v' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            │ Vertical
          </button>
        </div>
      </Field>
    );
  }

  if (k === 'objectFit') {
    return (
      <Field key={k} label="Ajustement">
        <OptionGroup
          value={v || 'contain'}
          onChange={(x) => setProp('objectFit', x)}
          options={[
            { value: 'contain', label: 'Adapter' },
            { value: 'cover',   label: 'Remplir' }
          ]}
        />
      </Field>
    );
  }

  // 4. By value type
  if (typeof v === 'boolean') {
    return (
      <div key={k} className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-300">{hk(k)}</span>
        <ToggleInput value={v} onChange={x => setProp(k, x)} />
      </div>
    );
  }

  if (typeof v === 'number') {
    return (
      <Field key={k} label={hk(k)}>
        <ScrubNumberInput value={v} onChange={x => setProp(k, x)} />
      </Field>
    );
  }

  if (/color/i.test(k)) {
    return (
      <Field key={k} label={hk(k)}>
        <ColorInput value={v} onChange={x => setProp(k, x)} />
      </Field>
    );
  }

  // 5. Fallback: text input
  return (
    <Field key={k} label={hk(k)}>
      <TextInput value={v} onChange={x => setProp(k, x)} />
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Main Inspector
// ---------------------------------------------------------------------------

// ── Planning V3 — Inspector dédié ────────────────────────────────────────
// Charge la liste des comptes connectés (Settings → Calendriers), affiche
// les filtres dynamiques en lisant les events réellement reçus pour ce compte.

// ── AccountPicker — dropdown custom pour le widget Planning ────────────────
// Remplace le <select> natif par un popover groupé par provider, avec un
// petit logo SVG monochrome devant chaque compte.
function ProviderGlyph({ provider }) {
  // Silhouettes monochromes simples — héritent de currentColor (text-slate-400).
  if (provider === 'google') {
    // Logo "G" Google officiel, tracé monochrome (un seul path).
    return (
      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 48 48" fill="currentColor">
        <path d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" opacity=".4"/>
        <path d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" opacity=".55"/>
        <path d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" opacity=".7"/>
      </svg>
    );
  }
  if (provider === 'microsoft') {
    // 4 carrés
    return (
      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="3" width="8" height="8" />
        <rect x="13" y="3" width="8" height="8" />
        <rect x="3" y="13" width="8" height="8" />
        <rect x="13" y="13" width="8" height="8" />
      </svg>
    );
  }
  if (provider === 'apple') {
    // Pomme silhouette
    return (
      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
      </svg>
    );
  }
  return null;
}

const PROVIDER_ORDER = ['google', 'microsoft', 'apple'];
const PROVIDER_LABELS = {
  google:    { fr: 'Google',    en: 'Google' },
  microsoft: { fr: 'Microsoft', en: 'Microsoft' },
  apple:     { fr: 'Apple',     en: 'Apple' }
};

function AccountPicker({ accounts, value, onChange, placeholder }) {
  const tr = useTr();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const selected = accounts.find(a => a.id === value);

  // Groupe par provider, ordre stable Google → Microsoft → Apple, le reste à la fin.
  const grouped = PROVIDER_ORDER
    .map(prov => ({ prov, items: accounts.filter(a => a.provider === prov) }))
    .filter(g => g.items.length > 0);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 bg-slate-950 border ${open ? 'border-blue-500' : 'border-white/10'} hover:border-white/20 rounded-md text-slate-50 text-sm px-2 py-1.5 outline-none transition-colors`}
      >
        {selected ? (
          <>
            <span className="text-slate-400"><ProviderGlyph provider={selected.provider} /></span>
            <span className="truncate flex-1 text-left">{selected.label || selected.accountEmail}</span>
          </>
        ) : (
          <span className="truncate flex-1 text-left text-slate-500 italic">{placeholder}</span>
        )}
        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-md shadow-2xl shadow-black/50 z-50 max-h-72 overflow-y-auto py-1">
          {grouped.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-slate-500 italic">{tr({ fr: 'Aucun compte', en: 'No accounts' })}</p>
          ) : grouped.map(({ prov, items }) => (
            <div key={prov} className="mb-1 last:mb-0">
              <p className="px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold flex items-center gap-1.5">
                <span className="text-slate-500"><ProviderGlyph provider={prov} /></span>
                {tr(PROVIDER_LABELS[prov] || { fr: prov, en: prov })}
              </p>
              {items.map(acc => {
                const isActive = acc.id === value;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => { onChange(acc.id); setOpen(false); }}
                    className={`w-full block px-3 py-1.5 pl-8 text-left text-sm transition-colors bg-transparent border-0 ${
                      isActive
                        ? 'bg-blue-500/15 text-blue-100'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate block">{acc.label || acc.accountEmail}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanningInspectorBody({ object, setProp }) {
  const tr = useTr();
  const [accounts, setAccounts] = React.useState([]);
  const [events, setEvents] = React.useState([]);
  const [loadingEvents, setLoadingEvents] = React.useState(false);
  const props = object.props || {};
  const accountId = props.accountId || '';
  const range = props.range || 'today';

  // Liste des comptes (chargée une fois + sur event Socket.IO)
  React.useEffect(() => {
    let cancelled = false;
    const load = () => apiListCalendarAccounts()
      .then(list => { if (!cancelled) setAccounts(list); })
      .catch(() => {}); // pas authentifié → liste vide
    load();
    const handler = () => load();
    socket.on('calendarAccountsChanged', handler);
    return () => { cancelled = true; socket.off('calendarAccountsChanged', handler); };
  }, []);

  // Charge les events pour construire les filtres dynamiques
  React.useEffect(() => {
    let cancelled = false;
    if (!accountId) { setEvents([]); return; }
    setLoadingEvents(true);
    apiCalendarEvents({ accountId, range })
      .then(data => { if (!cancelled) setEvents(data.events || []); })
      .catch(() => { if (!cancelled) setEvents([]); })
      .finally(() => { if (!cancelled) setLoadingEvents(false); });
    return () => { cancelled = true; };
  }, [accountId, range]);

  // Live updates → rafraîchit les filtres
  React.useEffect(() => {
    if (!accountId) return;
    const onUpd = (payload) => {
      if (payload.accountId === accountId && payload.range === range) {
        setEvents(payload.events || []);
      }
    };
    socket.on('calendarEventsUpdate', onUpd);
    return () => socket.off('calendarEventsUpdate', onUpd);
  }, [accountId, range]);

  // Valeurs uniques pour les filtres dynamiques
  const account = accounts.find(a => a.id === accountId);
  const calendarsOnAccount = (account && account.calendars) || [];
  const uniqueLocations = Array.from(new Set(events.map(e => e.location).filter(Boolean))).sort();
  const uniqueOrganizers = Array.from(new Map(
    events.filter(e => e.organizer && e.organizer.email)
      .map(e => [e.organizer.email, e.organizer])
  ).values());
  const uniqueStatuses = Array.from(new Set(events.map(e => e.status).filter(Boolean))).sort();

  const toggleArrayValue = (key, value) => {
    const arr = Array.isArray(props[key]) ? props[key] : [];
    setProp(key, arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value]);
  };

  return (
    <>
      {/* ── Source ─────────────────────────────────── */}
      <Section title={tr({ fr: 'Source', en: 'Source' })} defaultOpen={true}>
        <Field label={tr({ fr: 'Compte', en: 'Account' })}>
          <AccountPicker
            accounts={accounts}
            value={accountId}
            onChange={(id) => setProp('accountId', id)}
            placeholder={tr({ fr: '— Choisissez un compte —', en: '— Pick an account —' })}
          />
          {accounts.length === 0 && (
            <p className="text-[10px] text-amber-300 mt-1">
              {tr({
                fr: <>Aucun compte connecté. Allez dans <strong>Calendriers</strong> pour en ajouter un.</>,
                en: <>No connected accounts. Go to <strong>Calendars</strong> to add one.</>
              })}
            </p>
          )}
        </Field>
        <Field label={tr({ fr: 'Plage', en: 'Range' })}>
          <OptionGroup
            value={range}
            onChange={(v) => setProp('range', v)}
            options={[
              { value: 'today', label: tr({ fr: "Aujourd'hui", en: 'Today' }) },
              { value: 'week',  label: tr({ fr: 'Semaine',     en: 'Week' }) }
            ]}
          />
        </Field>
      </Section>

      {/* ── Filtres dynamiques ─────────────────────── */}
      {accountId && (
        <Section title={tr({ fr: 'Filtres', en: 'Filters' })} defaultOpen={true} badge={loadingEvents ? '⟳' : `(${events.length} ev.)`}>
          {/* Calendriers de ce compte */}
          {calendarsOnAccount.length > 0 && (
            <Field label={tr({ fr: 'Calendriers', en: 'Calendars' })}>
              <div className="space-y-1 max-h-32 overflow-y-auto overflow-x-hidden bg-slate-950/40 border border-white/5 rounded p-1.5">
                {calendarsOnAccount.map(cal => {
                  const checked = !props.calendarIds || props.calendarIds.length === 0 || props.calendarIds.includes(cal.id);
                  return (
                    <label key={cal.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-900/60 rounded px-1.5 py-1">
                      <input type="checkbox" checked={checked}
                        onChange={() => {
                          // "Tous cochés" (state vide) → click décoche tous sauf celui-ci
                          if (!props.calendarIds || props.calendarIds.length === 0) {
                            const others = calendarsOnAccount.filter(c => c.id !== cal.id).map(c => c.id);
                            setProp('calendarIds', others);
                          } else {
                            toggleArrayValue('calendarIds', cal.id);
                          }
                        }}
                        className="accent-blue-500" />
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cal.color }} />
                      <span className="text-[11px] text-slate-200 truncate">{cal.name}</span>
                    </label>
                  );
                })}
              </div>
              <button type="button"
                onClick={() => setProp('calendarIds', [])}
                className="mt-1 text-[10px] text-blue-400 hover:underline">
                {tr({ fr: 'Tout cocher', en: 'Check all' })}
              </button>
            </Field>
          )}

          <Field label={tr({ fr: 'Mot-clé titre', en: 'Title keyword' })}>
            <TextInput value={props.titleContains || ''} onChange={v => setProp('titleContains', v)}
              placeholder={tr({ fr: 'ex: TOURNAGE', en: 'e.g. SHOOTING' })} />
          </Field>

          {uniqueLocations.length > 0 && (
            <Field label={tr({ fr: `Lieu (${uniqueLocations.length})`, en: `Location (${uniqueLocations.length})` })}>
              <div className="space-y-1 max-h-28 overflow-y-auto overflow-x-hidden bg-slate-950/40 border border-white/5 rounded p-1.5">
                {uniqueLocations.map(loc => (
                  <label key={loc} className="flex items-center gap-2 cursor-pointer hover:bg-slate-900/60 rounded px-1.5 py-1">
                    <input type="checkbox"
                      checked={!props.locations || props.locations.length === 0 || props.locations.includes(loc)}
                      onChange={() => {
                        if (!props.locations || props.locations.length === 0) {
                          const others = uniqueLocations.filter(l => l !== loc);
                          setProp('locations', others);
                        } else {
                          toggleArrayValue('locations', loc);
                        }
                      }}
                      className="accent-blue-500" />
                    <span className="text-[11px] text-slate-200 truncate">{loc}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          {uniqueStatuses.length > 0 && (
            <Field label={tr({ fr: 'Statut', en: 'Status' })}>
              <div className="flex flex-wrap gap-1.5">
                {uniqueStatuses.map(st => {
                  const active = !props.statuses || props.statuses.length === 0 || props.statuses.includes(st);
                  return (
                    <button key={st} type="button"
                      onClick={() => {
                        if (!props.statuses || props.statuses.length === 0) {
                          setProp('statuses', uniqueStatuses.filter(s => s !== st));
                        } else {
                          toggleArrayValue('statuses', st);
                        }
                      }}
                      className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                        active ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-slate-800/60 border-white/10 text-slate-500'
                      }`}>{st}</button>
                  );
                })}
              </div>
            </Field>
          )}

          {uniqueOrganizers.length > 0 && (
            <Field label={tr({ fr: 'Organisateur', en: 'Organizer' })}>
              <div className="space-y-1 max-h-24 overflow-y-auto overflow-x-hidden bg-slate-950/40 border border-white/5 rounded p-1.5">
                {uniqueOrganizers.map(org => (
                  <label key={org.email} className="flex items-center gap-2 cursor-pointer hover:bg-slate-900/60 rounded px-1.5 py-1">
                    <input type="checkbox"
                      checked={!props.organizers || props.organizers.length === 0 || props.organizers.includes(org.email)}
                      onChange={() => {
                        if (!props.organizers || props.organizers.length === 0) {
                          setProp('organizers', uniqueOrganizers.map(o => o.email).filter(e => e !== org.email));
                        } else {
                          toggleArrayValue('organizers', org.email);
                        }
                      }}
                      className="accent-blue-500" />
                    <span className="text-[11px] text-slate-200 truncate">{org.name || org.email}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label="Avec lieu ?">
              <select value={props.hasLocation || 'any'} onChange={e => setProp('hasLocation', e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-md text-slate-50 text-sm px-2 py-1.5 outline-none">
                <option value="any">Indifférent</option>
                <option value="yes">Oui seulement</option>
                <option value="no">Non seulement</option>
              </select>
            </Field>
            <Field label="Avec description ?">
              <select value={props.hasDescription || 'any'} onChange={e => setProp('hasDescription', e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-md text-slate-50 text-sm px-2 py-1.5 outline-none">
                <option value="any">Indifférent</option>
                <option value="yes">Oui seulement</option>
                <option value="no">Non seulement</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Durée min (min)">
              <ScrubNumberInput value={props.durationMinMinutes || 0}
                onChange={v => setProp('durationMinMinutes', Math.max(0, v))} min={0} max={1440} />
            </Field>
            <Field label="Durée max (min)">
              <ScrubNumberInput value={props.durationMaxMinutes || 0}
                onChange={v => setProp('durationMaxMinutes', Math.max(0, v))} min={0} max={1440}
                />
            </Field>
          </div>
          {(props.durationMinMinutes > 0 || props.durationMaxMinutes > 0) && (
            <p className="text-[10px] text-slate-500 mt-1">0 = pas de limite</p>
          )}
        </Section>
      )}

      {/* ── Affichage ─────────────────────────────── */}
      <Section title={tr({ fr: 'Affichage', en: 'Display' })} defaultOpen={false}>
        <Field label="Layout">
          <OptionGroup
            value={props.layout || 'list'}
            onChange={(v) => setProp('layout', v)}
            options={[
              { value: 'list',   label: 'Liste' },
              { value: 'agenda', label: 'Agenda' }
            ]}
          />
        </Field>

        <Field label="Nombre max d'événements">
          <ScrubNumberInput value={props.maxItems ?? 12}
            onChange={v => setProp('maxItems', Math.max(0, v))} min={0} max={100} />
        </Field>

        <div className="space-y-1.5 mt-2">
          {[
            ['showTitle', 'Titre'],
            ['showTime', 'Heure'],
            ['showLocation', 'Lieu'],
            ['showDescription', 'Description'],
            ['showCalendar', 'Calendrier source'],
            ['showOrganizer', 'Organisateur']
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between bg-slate-950/40 border border-white/5 rounded px-2 py-1.5">
              <span className="text-xs text-slate-300">{label}</span>
              <ToggleInput value={props[key] !== false} onChange={v => setProp(key, v)} />
            </label>
          ))}
        </div>
      </Section>

      {/* ── Couleurs ──────────────────────────────── */}
      <Section title={tr({ fr: 'Couleurs', en: 'Colors' })} defaultOpen={false}>
        <label className="flex items-center justify-between bg-slate-950/40 border border-white/5 rounded px-2 py-1.5 mb-2">
          <span className="text-xs text-slate-300">Couleur par calendrier</span>
          <ToggleInput value={props.colorByCalendar !== false} onChange={v => setProp('colorByCalendar', v)} />
        </label>
        {!props.colorByCalendar && (
          <Field label="Couleur d'accent (en cours)">
            <ColorInput value={props.accentColor || '#EF4444'} onChange={v => setProp('accentColor', v)} />
          </Field>
        )}
        <Field label="Opacité événements passés">
          <PercentSlider value={props.pastOpacity ?? 0.35} onChange={v => setProp('pastOpacity', v)} />
        </Field>
      </Section>

      {/* ── Rétro-compat ─────────────────────────── */}
      {(props.icsUrl || (!accountId && !props.icsUrl)) && (
        <Section title={tr({ fr: 'ICS (rétro-compat)', en: 'ICS (legacy)' })} defaultOpen={false}>
          <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
            Ancien chemin : URL ICS publique Google. Préfère un compte connecté pour les filtres dynamiques.
          </p>
          <Field label="URL ICS">
            <TextInput value={props.icsUrl || ''} onChange={v => setProp('icsUrl', v)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics" />
          </Field>
          <Field label="Filtre titre (legacy)">
            <TextInput value={props.titleKeyword || ''} onChange={v => setProp('titleKeyword', v)} />
          </Field>
        </Section>
      )}
    </>
  );
}

// ── Widget Vidéo — Inspector dédié ───────────────────────────────────────
// Source : Live (NDI / SDI) ou Vidéo enregistrée (Upload / YouTube).
// Le panneau s'adapte : seuls les champs pertinents pour le mode courant sont visibles.

function VideoInspectorBody({ object, setProp, onUpdate, onOpenAssetGallery }) {
  const props = object.props || {};
  const mode = props.mode || 'recorded';
  const recordedSource = props.recordedSource || 'upload';
  const liveSource = props.liveSource || 'ndi';

  // Change le ratio en recalculant W et H pour préserver la dimension principale
  // (la plus grande des deux). Évite que l'objet "saute" en taille.
  const setRatio = (newRatio) => {
    const r = VIDEO_RATIOS[newRatio] || 16 / 9;
    const main = Math.max(object.width || 640, object.height || 360);
    const w = r >= 1 ? main : Math.round(main * r);
    const h = r >= 1 ? Math.round(main / r) : main;
    onUpdate({ width: w, height: h, props: { ratio: newRatio } });
  };

  // État NDI (statut module + sources auto-détectées)
  const [ndiStatus, setNdiStatus] = React.useState(null);
  const [ndiSources, setNdiSources] = React.useState({ available: false, sources: [] });
  const [ndiBusy, setNdiBusy] = React.useState(false);
  const [sdiStatus, setSdiStatus] = React.useState(null);

  // Charge le statut quand on entre en mode live
  React.useEffect(() => {
    if (mode !== 'live') return;
    let cancelled = false;
    if (liveSource === 'ndi') {
      apiNdiStatus().then(s => { if (!cancelled) setNdiStatus(s); }).catch(() => {});
    }
    if (liveSource === 'sdi') {
      apiSdiStatus().then(s => { if (!cancelled) setSdiStatus(s); }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [mode, liveSource]);

  const refreshNdiSources = React.useCallback(() => {
    setNdiBusy(true);
    apiNdiSources()
      .then(r => setNdiSources(r))
      .catch(() => setNdiSources({ available: false, sources: [] }))
      .finally(() => setNdiBusy(false));
  }, []);

  // Auto-refresh à l'ouverture si NDI dispo
  React.useEffect(() => {
    if (mode === 'live' && liveSource === 'ndi' && ndiStatus?.available) {
      refreshNdiSources();
    }
  }, [mode, liveSource, ndiStatus?.available, refreshNdiSources]);

  return (
    <>
      {/* ── Source ─────────────────────────────────── */}
      <Section title="Source" defaultOpen={true}>
        <Field label="Type">
          <OptionGroup
            stacked
            value={mode}
            onChange={(v) => setProp('mode', v)}
            options={[
              {
                value: 'recorded', label: 'Vidéo enregistrée',
                icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              },
              {
                value: 'live', label: 'Flux live',
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M20.07 4.93a10 10 0 0 1 0 14.14M3.93 19.07a10 10 0 0 1 0-14.14"/></svg>
              }
            ]}
          />
        </Field>

        <Field label="Ratio">
          <OptionGroup
            value={props.ratio || '16:9'}
            onChange={setRatio}
            options={[
              { value: '16:9', label: '16:9', hint: 'Paysage' },
              { value: '9:16', label: '9:16', hint: 'Portrait' },
              { value: '1:1',  label: '1:1',  hint: 'Carré' }
            ]}
          />
        </Field>

        {/* ── Sous-source vidéo enregistrée ─────────── */}
        {mode === 'recorded' && (
          <>
            <Field label="Provenance">
              <OptionGroup
                value={recordedSource}
                onChange={(v) => setProp('recordedSource', v)}
                options={[
                  { value: 'upload',  label: 'Upload local' },
                  { value: 'youtube', label: 'YouTube' }
                ]}
              />
            </Field>

            {recordedSource === 'upload' && (
              <Field label="Fichier vidéo">
                <div className="bg-slate-950/40 border border-white/5 rounded-md p-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-14 h-14 rounded bg-slate-950 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {props.filename ? (
                        <video src={`/uploads/${props.filename}`} muted preload="metadata"
                          className="max-w-full max-h-full object-contain" />
                      ) : (
                        <svg className="w-5 h-5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-300 truncate" title={props.filename || ''}>
                        {props.filename || <span className="italic text-slate-500">Aucune vidéo</span>}
                      </p>
                      <button type="button"
                        onClick={() => onOpenAssetGallery && onOpenAssetGallery({ kind: 'video' })}
                        className="mt-1.5 w-full px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] rounded font-medium flex items-center justify-center gap-1.5">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        {props.filename ? 'Changer de vidéo' : 'Choisir ou uploader'}
                      </button>
                    </div>
                  </div>
                </div>
              </Field>
            )}

            {recordedSource === 'youtube' && (
              <Field label="URL YouTube" hint="Lien classique, court (youtu.be), ou live YouTube — tous supportés.">
                <TextInput value={props.youtubeUrl || ''} onChange={v => setProp('youtubeUrl', v)}
                  placeholder="https://www.youtube.com/watch?v=…" />
              </Field>
            )}
          </>
        )}

        {/* ── Sous-source live ──────────────────────── */}
        {mode === 'live' && (
          <>
            <Field label="Source live">
              <OptionGroup
                value={liveSource}
                onChange={(v) => setProp('liveSource', v)}
                options={[
                  { value: 'ndi', label: 'NDI' },
                  { value: 'sdi', label: 'SDI / Decklink' }
                ]}
              />
            </Field>

            {liveSource === 'ndi' && (
              <>
                {ndiStatus && !ndiStatus.available && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2 text-[10px] text-amber-200 leading-relaxed">
                    <span className="uppercase tracking-widest font-semibold text-amber-300">⚠ NDI indisponible</span>
                    <p className="mt-1">{ndiStatus.hint}</p>
                  </div>
                )}
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Source détectée</label>
                  <button type="button" onClick={refreshNdiSources} disabled={!ndiStatus?.available || ndiBusy}
                    className="px-1.5 py-0.5 text-[10px] bg-slate-800/60 hover:bg-slate-700 disabled:opacity-40 rounded">
                    {ndiBusy ? '…' : 'Rescan'}
                  </button>
                </div>
                <select value={props.ndiSourceName || ''} onChange={e => setProp('ndiSourceName', e.target.value)}
                  disabled={!ndiStatus?.available}
                  className="w-full bg-slate-950 border border-white/10 focus:border-blue-500 rounded-md text-slate-50 text-sm px-2 py-1.5 outline-none disabled:opacity-40">
                  <option value="">— Aucune sélectionnée —</option>
                  {ndiSources.sources.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
                {ndiStatus?.available && ndiSources.sources.length === 0 && (
                  <p className="text-[10px] text-slate-500 mt-1 italic">
                    Aucune source NDI détectée sur le réseau. Lance un émetteur NDI (NDI Test Patterns, OBS+plugin NDI, caméra…).
                  </p>
                )}
                <div className="mt-4 pt-3 border-t border-white/5">
                  <Field label="Qualité du flux" hint="Plus haute = meilleure image mais plus de CPU + bande passante.">
                    <OptionGroup
                      size="sm"
                      value={props.quality || 'standard'}
                      onChange={(v) => setProp('quality', v)}
                      options={[
                        { value: 'eco',      label: 'Économe',  hint: '480p · 20 fps' },
                        { value: 'standard', label: 'Standard', hint: '720p · 25 fps' },
                        { value: 'high',     label: 'Haute',    hint: '1080p · 30 fps' }
                      ]}
                    />
                  </Field>
                </div>
              </>
            )}

            {liveSource === 'sdi' && (
              <>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2 text-[10px] text-amber-200 leading-relaxed">
                  <span className="uppercase tracking-widest font-semibold text-amber-300">⏳ En cours de développement</span>
                  <p className="mt-1">{sdiStatus?.hint || 'Implémentation Decklink prévue dans une prochaine version.'}</p>
                </div>
                <Field label="Device (placeholder)">
                  <TextInput value={props.sdiDeviceId || ''} onChange={v => setProp('sdiDeviceId', v)}
                    placeholder="Decklink Mini Recorder 4K" disabled />
                </Field>
              </>
            )}
          </>
        )}
      </Section>

      {/* ── Lecture (uniquement vidéo enregistrée) ── */}
      {mode === 'recorded' && (
        <Section title="Lecture" defaultOpen={false}>
          <div className="space-y-1.5">
            {[
              ['autoplay', 'Lecture automatique'],
              ['loop',     'Lecture en boucle'],
              ['muted',    'Muet (requis pour autoplay sans interaction)'],
              ['controls', 'Afficher les contrôles']
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between bg-slate-950/40 border border-white/5 rounded px-2 py-1.5">
                <span className="text-xs text-slate-300">{label}</span>
                <ToggleInput value={props[key] !== false}
                  onChange={v => setProp(key, v)} />
              </label>
            ))}
          </div>
          <Field label="Démarrage à (s)" hint="Skip initial — utile pour sauter un fade-in dans la vidéo.">
            <ScrubNumberInput value={props.startTime || 0}
              onChange={v => setProp('startTime', Math.max(0, v))} min={0} max={3600} />
          </Field>
        </Section>
      )}

      {/* ── Apparence ─────────────────────────────── */}
      <Section title="Apparence" defaultOpen={false}>
        <Field label="Ajustement">
          <OptionGroup
            size="sm"
            value={props.objectFit || 'cover'}
            onChange={(v) => setProp('objectFit', v)}
            options={[
              { value: 'cover',   label: 'Remplir' },
              { value: 'contain', label: 'Adapter' },
              { value: 'fill',    label: 'Étirer' }
            ]}
          />
        </Field>
        <Field label="Couleur de fond">
          <ColorInput value={props.backgroundColor || '#000000'} onChange={v => setProp('backgroundColor', v)} />
        </Field>
        <Field label="Rayon des bords (px)">
          <ScrubNumberInput value={props.borderRadius || 0} onChange={v => setProp('borderRadius', Math.max(0, v))} min={0} max={200} />
        </Field>
      </Section>
    </>
  );
}

// AnchorPicker — grille 3×3 où l'utilisateur choisit le point d'ancrage utilisé
// pour les coordonnées X/Y. value = { ax: 0|0.5|1, ay: 0|0.5|1 }.
//   ax = 0 → X mesure le bord gauche de l'objet (default top-left)
//   ax = 0.5 → X mesure le centre
//   ax = 1 → X mesure le bord droit
// AnchorPicker — 9 cases CARRÉES de 24×24 px, espacées de 8 px.
// Le container s'auto-dimensionne (w-fit) → 24×3 + 8×2 = 88×88 px.
// mx-auto centre dans la colonne 50/50.
function AnchorPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-3 mx-auto w-fit select-none">
      {[0, 0.5, 1].flatMap(ay => [0, 0.5, 1].map(ax => {
        const active = value.ax === ax && value.ay === ay;
        return (
          <button
            key={`${ax}-${ay}`}
            type="button"
            onClick={() => onChange({ ax, ay })}
            className={`w-6 h-6 rounded transition-colors ${
              active
                ? 'bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.5)]'
                : 'bg-slate-800 hover:bg-slate-700'
            }`}
            title={`Ancrage ${['gauche','centre','droite'][ax * 2]} / ${['haut','milieu','bas'][ay * 2]}`}
          />
        );
      }))}
    </div>
  );
}

function InspectorInner({ object, onUpdate, onDelete, template, onUpdateCanvas, onUpdateTemplateName, onUpdateTemplateMeta, onOpenAssetGallery }) {
  const tr = useTr();
  if (!object) {
    if (!template) {
      return (
        <aside className="w-72 bg-[#06090f] border-l border-white/5 p-4 text-slate-500 text-sm h-full overflow-y-auto overflow-x-hidden flex-shrink-0">
          (aucun template chargé)
        </aside>
      );
    }
    const { width: cw, height: ch } = template.canvas;
    // Presets de canvas (mêmes que le modal Nouveau template). On détecte le
    // preset courant en comparant les dimensions ; sinon "custom".
    const CANVAS_PRESETS = {
      '16:9': { width: 1920, height: 1080 },
      '21:9': { width: 2560, height: 1080 },
      '4:3':  { width: 1440, height: 1080 },
      '1:1':  { width: 1080, height: 1080 },
      '9:16': { width: 1080, height: 1920 },
      '3:4':  { width: 1080, height: 1440 }
    };
    const currentPreset = Object.keys(CANVAS_PRESETS).find(k =>
      CANVAS_PRESETS[k].width === cw && CANVAS_PRESETS[k].height === ch
    ) || 'custom';

    return (
      <aside className="w-72 bg-[#06090f] border-l border-white/5 p-4 overflow-y-auto overflow-x-hidden h-full flex-shrink-0">
        <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">{tr({ fr: 'Informations', en: 'Information' })}</h4>
        <Field label={tr({ fr: 'Nom du template', en: 'Template name' })}>
          <TextInput value={template.name} onChange={v => onUpdateTemplateName(v)} />
        </Field>

        <Field label={tr({ fr: 'Catégorie', en: 'Category' })} hint={tr({ fr: "Détermine sur quel slot le template peut être activé : Mode actif (chrono actif) ou Mode veille (chrono à l'arrêt).", en: 'Determines which slot this template can be activated for: Active mode (timer running) or Idle mode (timer stopped).' })}>
          <OptionGroup
            cols={2}
            size="sm"
            value={template.category === 'veille' ? 'veille' : 'horloge'}
            onChange={(v) => onUpdateTemplateMeta && onUpdateTemplateMeta({ category: v })}
            options={[
              { value: 'horloge', label: tr({ fr: 'Mode actif', en: 'Active mode' }) },
              { value: 'veille',  label: tr({ fr: 'Mode veille',  en: 'Idle mode' }) }
            ]}
          />
        </Field>

        <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2 mt-6">{tr({ fr: 'Format du canvas', en: 'Canvas format' })}</h4>
        <OptionGroup
          cols={3}
          size="sm"
          value={currentPreset}
          onChange={(v) => {
            if (v === 'custom') return; // pas d'action — on laisse les dimensions courantes
            onUpdateCanvas(CANVAS_PRESETS[v]);
          }}
          options={[
            ...Object.keys(CANVAS_PRESETS).map(k => ({ value: k, label: k })),
            { value: 'custom', label: tr({ fr: 'Custom', en: 'Custom' }), disabled: currentPreset !== 'custom' }
          ]}
        />
        <p className="text-[10px] text-slate-500 mt-2 font-mono">{cw} × {ch} px</p>

        <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2 mt-6">{tr({ fr: 'Apparence', en: 'Appearance' })}</h4>
        <Field label={tr({ fr: 'Couleur de fond', en: 'Background color' })}>
          <ColorInput value={template.canvas.backgroundColor || '#000000'} onChange={v => onUpdateCanvas({ backgroundColor: v })} />
        </Field>

        <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2 mt-6">{tr({ fr: 'Grille', en: 'Grid' })}</h4>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-300">{tr({ fr: 'Afficher la grille', en: 'Show grid' })}</span>
          <ToggleInput
            value={template.canvas.gridEnabled !== false}
            onChange={v => onUpdateCanvas({ gridEnabled: v })}
          />
        </div>
        <Field label={tr({ fr: 'Pas de la grille', en: 'Grid step' })}>
          <ScrubNumberInput
            value={template.canvas.gridSize || 50}
            onChange={v => onUpdateCanvas({ gridSize: Math.max(5, v) })}
            min={5} max={500} unit="px"
          />
        </Field>
        <Field label={tr({ fr: 'Couleur de la grille', en: 'Grid color' })}>
          <ColorInput
            value={template.canvas.gridColor || '#FFFFFF'}
            onChange={v => onUpdateCanvas({ gridColor: v })}
          />
        </Field>
        <Field label={tr({ fr: 'Opacité de la grille', en: 'Grid opacity' })}>
          <PercentSlider
            value={template.canvas.gridOpacity !== undefined ? template.canvas.gridOpacity : 0.08}
            onChange={v => onUpdateCanvas({ gridOpacity: v })}
          />
        </Field>

        <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2 mt-6">{tr({ fr: 'Snap magnétique', en: 'Magnetic snap' })}</h4>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-300">{tr({ fr: 'Activer le snap', en: 'Enable snap' })}</span>
          <ToggleInput
            value={template.canvas.snapEnabled !== false}
            onChange={v => onUpdateCanvas({ snapEnabled: v })}
          />
        </div>
        <p className="text-[10px] text-slate-500 italic mb-2">
          {tr({ fr: 'Alignement automatique sur la grille, le centre et les repères pendant le drag.', en: 'Automatic alignment to grid, center and guides while dragging.' })}
        </p>

        <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2 mt-6">{tr({ fr: 'Repères', en: 'Guides' })}</h4>

        {/* Repères système — toggles. Couleur ambre/violette pour les distinguer
            des repères utilisateur (cyan). Non déplaçables, non supprimables. */}
        <div className="space-y-1.5 mb-3">
          <label className="flex items-center justify-between bg-slate-950/40 border border-white/5 rounded-md px-2.5 py-1.5">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500/60" />
              <span className="text-xs text-slate-300">{tr({ fr: 'Marges (25 px)', en: 'Margins (25 px)' })}</span>
            </span>
            <ToggleInput
              value={!!template.canvas.showMargins}
              onChange={v => onUpdateCanvas({ showMargins: v })}
            />
          </label>
          <label className="flex items-center justify-between bg-slate-950/40 border border-white/5 rounded-md px-2.5 py-1.5">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500/60" />
              <span className="text-xs text-slate-300">{tr({ fr: 'Milieux (¼ · ½ · ¾)', en: 'Midlines (¼ · ½ · ¾)' })}</span>
            </span>
            <ToggleInput
              value={!!template.canvas.showMidGuides}
              onChange={v => onUpdateCanvas({ showMidGuides: v })}
            />
          </label>
        </div>

        {/* Repères utilisateur — créés en glissant depuis les règles */}
        {(template.canvas.guides || []).length === 0 ? (
          <p className="text-[10px] text-slate-500 italic mb-2">
            {tr({ fr: 'Aucun repère personnalisé. Tirez depuis les règles pour en créer.', en: 'No custom guides. Drag from the rulers to create some.' })}
          </p>
        ) : (
          <p className="text-[10px] text-slate-500 italic mb-2">
            {tr({
              fr: `${(template.canvas.guides || []).length} repère(s) personnalisé(s). Double-clic pour supprimer.`,
              en: `${(template.canvas.guides || []).length} custom guide(s). Double-click to remove.`
            })}
          </p>
        )}
        {(template.canvas.guides || []).length > 0 && (
          <button
            type="button"
            onClick={() => onUpdateCanvas({ guides: [] })}
            className="w-full py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors mb-2"
          >
            {tr({ fr: 'Supprimer tous les repères personnalisés', en: 'Remove all custom guides' })}
          </button>
        )}

        <p className="text-[10px] text-slate-500 italic mt-4">
          {tr({ fr: 'Astuce : flèches du clavier pour déplacer un objet pixel par pixel (Shift = 10 px).', en: 'Tip: arrow keys move an object pixel by pixel (Shift = 10 px).' })}
        </p>
      </aside>
    );
  }

  const { type, x, y, width, height, rotation = 0, zIndex = 1, props = {} } = object;
  const setProp = (k, v) => onUpdate({ props: { [k]: v } });

  // Point d'ancrage utilisé pour les inputs X/Y. Mémorisé par objet via une
  // Map id → anchor — chaque widget garde son propre ancrage entre les
  // sélections successives. C'est une préférence d'édition, pas une donnée
  // du template (donc pas sauvegardée dans le JSON).
  const [anchorByObj, setAnchorByObj] = React.useState({});
  const anchor = anchorByObj[object.id] || { ax: 0, ay: 0 };
  const setAnchor = (a) => setAnchorByObj(prev => ({ ...prev, [object.id]: a }));
  const ax = anchor.ax, ay = anchor.ay;
  const displayX = Math.round(x + width  * ax);
  const displayY = Math.round(y + height * ay);

  return (
    <aside className="w-72 flex-shrink-0 h-full bg-[#06090f] border-l border-white/5 p-4 overflow-y-auto overflow-x-hidden">
      <h3 className="text-sm font-bold text-slate-50 mb-0.5">{type}</h3>
      <p className="text-[10px] text-slate-600 font-mono mb-4">{object.id}</p>

      <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">{tr({ fr: 'Position & taille', en: 'Position & size' })}</h4>
      {/* 2 colonnes 50/50 : X+Y à gauche, AnchorPicker (3×3) à droite.
          Le picker est centré dans sa colonne et prend toute la largeur via
          aspect-square. */}
      <div className="grid grid-cols-2 gap-3 mb-2 items-center">
        <div className="space-y-2">
          <Field label="X"><ScrubNumberInput value={displayX} onChange={v => onUpdate({ x: v - width  * ax })} unit="px" /></Field>
          <Field label="Y"><ScrubNumberInput value={displayY} onChange={v => onUpdate({ y: v - height * ay })} unit="px" /></Field>
        </div>
        <AnchorPicker value={anchor} onChange={setAnchor} />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {(() => {
          // Types à ratio fixe (carrés ou widget vidéo) : un seul champ "Taille"
          // qui pilote la dimension principale, l'autre est calculée selon le ratio.
          const fixedRatio = ratioOf(object);
          if (fixedRatio !== null) {
            // Ratio = W/H. Si > 1 (paysage / 1:1), la dimension principale est W.
            // Si < 1 (portrait), c'est H.
            const isPortrait = fixedRatio < 1;
            const mainValue = isPortrait ? height : width;
            return (
              <>
                <Field label={tr({ fr: 'Taille', en: 'Size' })}>
                  <ScrubNumberInput
                    value={mainValue}
                    onChange={v => {
                      v = Math.max(10, v);
                      const w = isPortrait ? Math.round(v * fixedRatio) : v;
                      const h = isPortrait ? v : Math.round(v / fixedRatio);
                      onUpdate({ width: w, height: h });
                    }}
                    unit="px" min={10}
                  />
                </Field>
                <Field label={tr({ fr: 'Rotation', en: 'Rotation' })}><ScrubNumberInput value={rotation} onChange={v => onUpdate({ rotation: v })} unit="°" /></Field>
              </>
            );
          }
          return (
            <>
              <Field label="W"><ScrubNumberInput value={width} onChange={v => onUpdate({ width: v })} unit="px" min={10} /></Field>
              <Field label="H"><ScrubNumberInput value={height} onChange={v => onUpdate({ height: v })} unit="px" min={10} /></Field>
              <Field label={tr({ fr: 'Rotation', en: 'Rotation' })}><ScrubNumberInput value={rotation} onChange={v => onUpdate({ rotation: v })} unit="°" /></Field>
            </>
          );
        })()}
      </div>

      {/* Ordre des calques — boutons quick-action + valeur Z lisible */}
      <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2 mt-3">{tr({ fr: 'Calque', en: 'Layer' })}</h4>
      <div className="flex items-center gap-1.5 mb-4 bg-slate-950/40 border border-white/5 rounded-md p-1">
        <button
          type="button"
          onClick={() => onUpdate({ zIndex: 0 })}
          title={tr({ fr: 'Mettre tout en arrière-plan', en: 'Send to back' })}
          className="flex-1 px-1.5 py-1 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded transition-colors"
        >
          <svg className="w-3.5 h-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="19 13 12 20 5 13"/><polyline points="19 6 12 13 5 6"/></svg>
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ zIndex: Math.max(0, (zIndex || 0) - 1) })}
          title={tr({ fr: "Reculer d'un plan", en: 'Send backward' })}
          className="flex-1 px-1.5 py-1 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded transition-colors"
        >
          <svg className="w-3.5 h-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <span className="px-2 text-[10px] font-mono text-slate-500 select-none min-w-[28px] text-center">{zIndex || 0}</span>
        <button
          type="button"
          onClick={() => onUpdate({ zIndex: Math.min(100, (zIndex || 0) + 1) })}
          title={tr({ fr: "Avancer d'un plan", en: 'Bring forward' })}
          className="flex-1 px-1.5 py-1 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded transition-colors"
        >
          <svg className="w-3.5 h-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ zIndex: 100 })}
          title={tr({ fr: 'Mettre tout en avant-plan', en: 'Bring to front' })}
          className="flex-1 px-1.5 py-1 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded transition-colors"
        >
          <svg className="w-3.5 h-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 11 12 4 19 11"/><polyline points="5 18 12 11 19 18"/></svg>
        </button>
      </div>

      {/* Image — preview + bouton ouvrir gallery (uniquement pour type 'image') */}
      {object.type === 'image' && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Image</div>
          <div className="bg-slate-950/40 border border-white/5 rounded-md p-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-14 h-14 rounded bg-slate-950 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {props.filename ? (
                  <img
                    src={`/uploads/${props.filename}`}
                    alt={props.filename}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <svg className="w-5 h-5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-300 truncate" title={props.filename || ''}>
                  {props.filename || <span className="italic text-slate-500">Aucune image sélectionnée</span>}
                </p>
                <button
                  type="button"
                  onClick={() => onOpenAssetGallery && onOpenAssetGallery()}
                  className="mt-1.5 w-full px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] rounded transition-colors font-medium flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  {props.filename ? "Changer d'image" : 'Choisir ou uploader'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Planning V3 — Inspector dédié (source + plage + filtres dynamiques + affichage) */}
      {object.type === 'planning' && (
        <PlanningInspectorBody object={object} setProp={setProp} />
      )}

      {/* Vidéo — Inspector dédié (live NDI/SDI ou enregistrée Upload/YouTube) */}
      {object.type === 'video' && (
        <VideoInspectorBody object={object} setProp={setProp} onUpdate={onUpdate} onOpenAssetGallery={onOpenAssetGallery} />
      )}

      {(() => {
        const defaults = DEFAULT_PROPS[object.type] || {};
        const merged = { ...defaults, ...props };
        const defaultKeys = Object.keys(defaults);
        const extraKeys = Object.keys(merged).filter(k => !defaultKeys.includes(k) && k !== 'assetId' && k !== 'filename');
        const orderedKeys = [...defaultKeys, ...extraKeys];

        // Bucket by group
        const buckets = {};
        orderedKeys.forEach(k => {
          if (k === 'assetId' || k === 'filename') return;
          const g = groupFor(k, merged);
          if (!buckets[g]) buckets[g] = [];
          buckets[g].push(k);
        });

        return GROUPS_ORDER.map(grp => {
          const keys = buckets[grp.id];
          if (!keys || keys.length === 0) return null;

          // Special case "thresholds": hide sub-props if useThresholds is false
          let visibleKeys = keys;
          if (grp.id === 'thresholds') {
            const useIsFalse = merged.useThresholds === false;
            if (useIsFalse) {
              visibleKeys = keys.filter(k => k === 'useThresholds' || k === 'fillColor');
            }
          }

          // Horloges digitales : showHours et flashOnLast10s ne sont pertinents
          // que pour certains variants. On les masque sinon.
          const isDigitalClock = object.type === 'digital-clock' ||
            object.type === 'digital-clock-current' ||
            object.type === 'digital-clock-remaining' ||
            object.type === 'digital-clock-elapsed';
          if (isDigitalClock) {
            const v = merged.variant || (object.type.endsWith('current') ? 'current'
              : object.type.endsWith('remaining') ? 'remaining'
              : object.type.endsWith('elapsed') ? 'elapsed' : 'current');
            visibleKeys = visibleKeys.filter(k => {
              // showHours pertinent uniquement pour les durées (remaining/elapsed)
              // — pour 'current' (heure du jour), masquer les heures n'a pas de sens.
              if (k === 'showHours' && v === 'current') return false;
              // flashOnLast10s pertinent uniquement pour le countdown (remaining)
              if (k === 'flashOnLast10s' && v !== 'remaining') return false;
              return true;
            });
          }

          return (
            <Section key={grp.id} title={tr(grp.label)} defaultOpen={grp.defaultOpen}>
              {visibleKeys.map(k => (
                <PropRow key={k} k={k} v={merged[k]} obj={object} setProp={setProp} />
              ))}
            </Section>
          );
        }).filter(Boolean);
      })()}

      <button
        className="mt-4 w-full py-2 bg-red-900/40 hover:bg-red-900/60 text-red-300 text-sm rounded-md transition-colors"
        onClick={onDelete}
      >
        {tr({ fr: 'Supprimer', en: 'Delete' })}
      </button>
    </aside>
  );
}

export default function Inspector({ onBeginTx, onEndTx, ...props }) {
  // Mémoïse pour éviter de re-render tous les ScrubNumberInput à chaque update
  // (sinon chaque dispatch recrée la valeur du context et invalide les consumers).
  const txValue = React.useMemo(() => ({ beginTx: onBeginTx, endTx: onEndTx }), [onBeginTx, onEndTx]);
  return (
    <TxContext.Provider value={txValue}>
      <InspectorInner {...props} />
    </TxContext.Provider>
  );
}
