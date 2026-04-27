import React from 'react';
import { useTimerState } from '../store/TimerContext';

export default function OnAirBadgeObject({ props }) {
  const { onair, isRunning, isPaused } = useTimerState();

  // Le badge reflète l'état effectif `onair` du serveur (manuel || chrono actif) :
  //   - onair=true                                 → badge actif (rouge plein)
  //   - chrono en pause (isRunning && isPaused)    → badge clignote (rouge ⇄ gris)
  //                                                  pour signaler la pause
  //   - onair=false                                → badge inactif (gris)
  // previewActive (designer) force le rendu actif pour la prévisualisation.
  const forcedActive = props.previewActive === true;
  const isActive = forcedActive || onair;
  const isBlinking = !forcedActive && isRunning && isPaused;

  const activeColor = props.activeColor || '#EF4444';
  const inactiveColor = props.inactiveColor || '#374151';
  const bg = isActive ? activeColor : inactiveColor;

  const text = props.text || 'ON AIR';
  const charCount = Math.max(text.length, 1);
  const cqwPerChar = Math.min(60, 172 / charCount);
  const fontFamily = props.fontFamily || 'Inter, system-ui, sans-serif';

  const outerStyle = {
    width: '100%', height: '100%',
    containerType: 'size',
    background: bg,
    borderRadius: `${props.borderRadius ?? 12}px`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    padding: '2% 4%',
    boxSizing: 'border-box',
    transition: 'background-color 0.2s ease',
    // --onair-* sont lues par l'animation @keyframes onair-blink (index.css)
    '--onair-active': activeColor,
    '--onair-inactive': inactiveColor,
    ...(isBlinking ? { animation: 'onair-blink 1.4s ease-in-out infinite' } : null)
  };
  const innerStyle = {
    color: props.color || '#FFFFFF',
    fontSize: `min(70cqh, ${Math.round(cqwPerChar)}cqw)`,
    fontWeight: props.fontWeight || 'bold',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontFamily,
    lineHeight: 1,
    whiteSpace: 'nowrap'
  };

  return (
    <div style={outerStyle}>
      <div style={innerStyle}>{text}</div>
    </div>
  );
}
