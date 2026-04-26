import React from 'react';
import { useTimerState } from '../store/TimerContext';

function timeToSeconds(t) {
  if (!t) return 0;
  const [h, m, s] = t.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

/**
 * Retourne la couleur de remplissage selon les SECONDES RESTANTES.
 *   remaining > warningSeconds       → fillColor    (défaut : vert)
 *   dangerSeconds < remaining ≤ warn → warningColor (défaut : ambre)
 *   remaining ≤ dangerSeconds        → dangerColor  (défaut : rouge)
 * Quand le timer ne tourne pas (total=0), on reste sur fillColor.
 */
function pickColor(leftSeconds, total, props) {
  if (!props.useThresholds) return props.fillColor || '#EF4444';
  if (total <= 0) return props.fillColor || '#22C55E';
  const warn   = props.warningSeconds ?? 30;
  const danger = props.dangerSeconds  ?? 10;
  if (leftSeconds <= danger) return props.dangerColor  || '#EF4444';
  if (leftSeconds <= warn)   return props.warningColor || '#F59E0B';
  return props.fillColor || '#22C55E';
}

export default function ProgressBarObject({ props }) {
  const { selectedDuration, remainingTime } = useTimerState();
  const total = timeToSeconds(selectedDuration);
  // remainingTime en secondes (numeric). Peut être négatif (overtime) — on clamp
  // à 0 pour le calcul du ratio (la barre reste à 100% en overtime).
  const leftRaw = Number(remainingTime) || 0;
  const left = Math.max(0, leftRaw);
  const ratio = total > 0 ? Math.max(0, Math.min(1, 1 - left / total)) : 0;
  const isVertical = props.direction === 'v';
  const fillColor = pickColor(leftRaw, total, props);

  const outerStyle = {
    width: '100%', height: '100%',
    background: props.bgColor || '#374151',
    borderRadius: `${props.borderRadius ?? 0}px`,
    overflow: 'hidden',
    position: 'relative'
  };
  // Transition 1s linear — matche le tick serveur (1Hz) : entre deux mises à jour
  // de `remaining`, la barre glisse en continu. Rendu visuel beaucoup plus fluide.
  const fillStyle = isVertical
    ? {
        width: '100%',
        height: `${ratio * 100}%`,
        background: fillColor,
        position: 'absolute',
        bottom: 0,
        transition: 'background-color 0.3s ease, height 1s linear'
      }
    : {
        width: `${ratio * 100}%`,
        height: '100%',
        background: fillColor,
        transition: 'background-color 0.3s ease, width 1s linear'
      };

  return <div style={outerStyle}><div style={fillStyle} /></div>;
}
