import React, { useState, useEffect } from 'react';
import AnalogClock from '../components/AnalogClock';
import { useTimerState } from '../store/TimerContext';

const DEFAULT_LABELS = {
  remaining: 'Temps restant',
  elapsed:   'Temps écoulé'
};

// Extrait la ville d'un IANA timezone (ex: "America/New_York" → "New York")
function tzCity(tz) {
  if (!tz) return '';
  const parts = tz.split('/');
  return parts[parts.length - 1].replace(/_/g, ' ');
}

// Calcule le label auto pour une horloge "actuelle" selon le fuseau choisi.
//   tz = tz de l'app (ou vide)  → "Heure locale"
//   tz custom différente        → "Heure <ville>"
function autoCurrentLabel(customTz, appTz) {
  const effective = customTz || appTz;
  if (!effective || effective === appTz) return 'Heure locale';
  return `Heure ${tzCity(effective)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

// Format heure dans un timezone donné (ou local si vide)
function formatTzTime(date, tz) {
  if (!tz) return null;
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: tz,
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(date);
  } catch {
    return null;
  }
}

// `variant` peut venir des props (nouveau type unifié) ou d'un argument legacy.
// Le wrapper utilise 100% + aspect-ratio 1 pour que la taille suive le DOM live
// pendant un resize Moveable. Le clock reste toujours carré.
export default function AnalogClockObject({ variant: variantProp, props }) {
  const variant = props.variant || variantProp || 'current';
  const { currentTime, remaining, elapsed, isNTPActive, timezone: appTz } = useTimerState();

  // Si une timezone custom est définie pour le variant 'current', on calcule
  // l'heure côté client (tick 1Hz) dans ce tz spécifique.
  const customTz = variant === 'current' && props.timezone ? props.timezone : null;
  const [tzNow, setTzNow] = useState(() => formatTzTime(new Date(), customTz));
  useEffect(() => {
    if (!customTz) { setTzNow(null); return; }
    setTzNow(formatTzTime(new Date(), customTz));
    const id = setInterval(() => setTzNow(formatTzTime(new Date(), customTz)), 1000);
    return () => clearInterval(id);
  }, [customTz]);

  const timeValue = variant === 'current'
    ? (tzNow || currentTime)
    : variant === 'remaining' ? remaining
    : elapsed;

  // Label : le user peut overrider via props.label.
  // Sinon : pour 'current' on calcule dynamiquement selon la tz, pour les autres
  // variants on prend le défaut "Temps restant"/"Temps écoulé".
  // L'ancien défaut "Horloge" est traité comme "non défini" pour permettre
  // l'auto-computation sur les templates existants.
  const userLabel = props.label;
  const isLegacyDefault = userLabel === 'Horloge' || userLabel === '';
  const computedDefault = variant === 'current'
    ? autoCurrentLabel(customTz, appTz)
    : DEFAULT_LABELS[variant];
  const label = (userLabel == null || isLegacyDefault) ? computedDefault : userLabel;
  const showNTPDot = variant === 'current'; // toujours visible pour current, peu importe la tz

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden'
    }}>
      <div style={{
        aspectRatio: '1 / 1',
        maxWidth: '100%', maxHeight: '100%',
        width: '100%', height: '100%',
        position: 'relative'
      }}>
        <AnalogClock
          currentTime={timeValue || '00:00:00'}
          color={props.color || props.handColor || props.dialColor || '#FFFFFF'}
          isNTPActive={isNTPActive}
          label={label}
          showNTPDot={showNTPDot}
          showLabel={props.showLabel !== false}
          showSeconds={props.showSeconds !== false}
          showMinutes={props.showMinutes !== false}
        />
      </div>
    </div>
  );
}
