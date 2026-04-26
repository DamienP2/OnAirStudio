import React from 'react';
import { useTimerState } from '../store/TimerContext';

function interpolate(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
}

export default function DynamicTextObject({ props }) {
  const { remaining, elapsed, currentTime, studioName } = useTimerState();
  const text = interpolate(props.template || '', { remaining, elapsed, current: currentTime, studioName });
  const fontFamily = props.fontFamily || 'Inter, system-ui, sans-serif';
  // Si le texte interpole `{remaining}` ou `{elapsed}` etc., il contient des chiffres en mono-width.
  // Mais globalement on reste sur un coef sans mono → 172/charCount pour remplir ~95% de la largeur.
  const charCount = Math.max(text.length, 1);
  const cqwPerChar = Math.min(80, 172 / charCount);

  const outerStyle = {
    width: '100%',
    height: '100%',
    containerType: 'size',
    display: 'flex',
    alignItems: 'center',
    justifyContent: props.textAlign === 'left' ? 'flex-start' : props.textAlign === 'right' ? 'flex-end' : 'center',
    padding: '2% 3%',
    boxSizing: 'border-box',
    overflow: 'hidden',
    backgroundColor: props.backgroundColor || 'transparent',
    borderRadius: `${props.borderRadius ?? 0}px`
  };
  const innerStyle = {
    textAlign: props.textAlign || 'center',
    fontFamily,
    fontSize: `min(95cqh, ${Math.round(cqwPerChar)}cqw)`,
    color: props.color || '#FFFFFF',
    fontWeight: props.fontWeight || 'normal',
    textTransform: props.textTransform || 'none',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    whiteSpace: 'nowrap'
  };
  return (
    <div style={outerStyle}>
      <div style={innerStyle}>{text}</div>
    </div>
  );
}
