import React from 'react';
import { useTimerState } from '../store/TimerContext';

// LabelObject — gère texte statique ET texte dynamique avec variables.
// Variables supportées : {currentTime} {remaining} {elapsed} {studioName}
// Si la chaîne ne contient aucune variable, le rendu est purement statique
// (zéro coût d'abonnement contextuel — useTimerState reste branché mais
// inoffensif puisqu'aucune valeur n'est lue).
function injectVariables(template, ts) {
  if (!template) return '';
  if (!template.includes('{')) return template; // shortcut : aucun pattern
  return template
    .replace(/\{currentTime\}/g, ts.currentTime || '')
    .replace(/\{remaining\}/g,   ts.remaining   || '')
    .replace(/\{elapsed\}/g,     ts.elapsed     || '')
    .replace(/\{studioName\}/g,  ts.studioName  || '');
}

export default function LabelObject({ props }) {
  const ts = useTimerState();
  // Source du texte : `text` (nouveau / legacy label) OU `template` (legacy dynamic-text).
  const source = props.text != null ? props.text : (props.template || 'Label');
  const text = injectVariables(source, ts);

  const fontFamily = props.fontFamily || 'Inter, system-ui, sans-serif';
  const charCount = Math.max(text.length, 1);
  const cqwPerChar = Math.min(80, 172 / charCount);

  // Padding réglable (en %) dès qu'un fond est défini — pilotable depuis
  // l'inspector. Si pas de fond, on garde un padding minimal pour ne pas
  // gaspiller l'espace. Cap absolu à 30% (le slider de l'inspector applique
  // un cap encore plus restrictif basé sur la taille du widget).
  const hasBg = props.backgroundColor && props.backgroundColor !== 'transparent';
  const pctRaw = typeof props.padding === 'number' ? props.padding : 8;
  const pct = Math.max(0, Math.min(30, pctRaw));
  const padding = hasBg ? `${pct}% ${Math.round(pct * 1.25)}%` : '2% 3%';

  // Architecture en 3 couches :
  //   outer  → applique le padding + le fond
  //   middle → container queries (size) sur la zone DISPONIBLE après padding
  //   inner  → texte avec font-size en cqw/cqh sur middle (donc rétrécit
  //            automatiquement pour rester lisible quel que soit le padding)
  const outerStyle = {
    width: '100%', height: '100%',
    padding,
    boxSizing: 'border-box',
    overflow: 'hidden',
    backgroundColor: props.backgroundColor || 'transparent',
    borderRadius: `${props.borderRadius ?? 0}px`
  };
  const middleStyle = {
    width: '100%', height: '100%',
    containerType: 'size',
    display: 'flex',
    alignItems: 'center',
    justifyContent: props.textAlign === 'left' ? 'flex-start' : props.textAlign === 'right' ? 'flex-end' : 'center'
  };
  const innerStyle = {
    textAlign: props.textAlign || 'center',
    fontFamily,
    fontSize: `min(95cqh, ${Math.round(cqwPerChar)}cqw)`,
    color: props.color || '#FFFFFF',
    fontWeight: props.fontWeight || 'normal',
    textTransform: props.textTransform || 'none',
    lineHeight: 1,
    whiteSpace: 'nowrap'
  };
  return (
    <div style={outerStyle}>
      <div style={middleStyle}>
        <div style={innerStyle}>{text}</div>
      </div>
    </div>
  );
}
