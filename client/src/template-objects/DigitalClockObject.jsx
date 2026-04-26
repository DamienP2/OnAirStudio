import React, { useState, useEffect } from 'react';
import { useTimerState } from '../store/TimerContext';

const DEFAULT_LABELS = {
  remaining: 'Temps restant',
  elapsed:   'Temps écoulé'
};

function tzCity(tz) {
  if (!tz) return '';
  const parts = tz.split('/');
  return parts[parts.length - 1].replace(/_/g, ' ');
}

function autoCurrentLabel(customTz, appTz) {
  const effective = customTz || appTz;
  if (!effective || effective === appTz) return 'Heure locale';
  return `Heure ${tzCity(effective)}`;
}

// Filtre les segments HH:MM:SS du texte selon les toggles.
// Découpe en parties puis ne garde que celles autorisées par les toggles.
function formatTime(raw, { showHours, showMinutes, showSeconds }) {
  if (!raw) return '';
  const parts = raw.split(':'); // ['HH', 'MM', 'SS'] (ou moins si déjà filtré)
  const hh = parts[0], mm = parts[1], ss = parts[2];
  const out = [];
  if (hh != null && showHours   !== false) out.push(hh);
  if (mm != null && showMinutes !== false) out.push(mm);
  if (ss != null && showSeconds !== false) out.push(ss);
  return out.join(':');
}

function formatTzTime(date, tz) {
  if (!tz) return null;
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(date);
  } catch { return null; }
}

export default function DigitalClockObject({ variant: variantProp, props }) {
  const variant = props.variant || variantProp || 'current';
  const { currentTime, remaining, elapsed, isRunning, isNTPActive, timezone: appTz } = useTimerState();

  // Timezone custom — uniquement pour variant='current'
  const customTz = variant === 'current' && props.timezone ? props.timezone : null;
  const [tzNow, setTzNow] = useState(() => formatTzTime(new Date(), customTz));
  useEffect(() => {
    if (!customTz) { setTzNow(null); return; }
    setTzNow(formatTzTime(new Date(), customTz));
    const id = setInterval(() => setTzNow(formatTzTime(new Date(), customTz)), 1000);
    return () => clearInterval(id);
  }, [customTz]);

  const raw = variant === 'current'
    ? (tzNow || currentTime)
    : variant === 'remaining' ? remaining
    : elapsed;

  const displayed = formatTime(raw, {
    showHours:   props.showHours   !== false,
    showMinutes: props.showMinutes !== false,
    showSeconds: props.showSeconds !== false
  });

  const showLabel = props.showLabel !== false;
  // Label dynamique : auto-compute pour 'current' selon la tz, sinon défaut variant.
  // Ancien défaut "Horloge" traité comme "non défini" pour rétrocompat.
  const userLabel = props.label;
  const isLegacyDefault = userLabel === 'Horloge' || userLabel === '';
  const computedDefault = variant === 'current'
    ? autoCurrentLabel(props.timezone || null, appTz)
    : DEFAULT_LABELS[variant];
  const label = (userLabel == null || isLegacyDefault) ? computedDefault : userLabel;
  const showNTPDot = variant === 'current' && showLabel;

  // Choisit la largeur max par caractère du texte affiché pour éviter l'overflow.
  // fontSize * charCount * 0.6 ≈ 0.95 * width  →  fontSize ≈ 158/charCount cqw
  const charCount = Math.max(displayed.length, 1);
  const cqwPerChar = Math.min(60, 158 / charCount);
  // Si le label est affiché on réserve ~15% de la hauteur pour lui.
  const heightBudget = showLabel ? '80cqh' : '95cqh';
  const fontSizeCss = `min(${heightBudget}, ${Math.round(cqwPerChar)}cqw)`;

  const flash = variant === 'remaining' && props.flashOnLast10s && remaining
                && /^00:00:0[0-9]$/.test(remaining) && isRunning;

  const outerStyle = {
    width: '100%',
    height: '100%',
    containerType: 'size',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: props.backgroundColor || 'transparent',
    borderRadius: `${props.borderRadius ?? 0}px`
  };
  const labelStyle = {
    fontFamily: props.fontFamily || 'Inter, sans-serif',
    fontSize: '3.7cqw',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#9CA3AF',
    fontWeight: 500,
    lineHeight: 1,
    marginBottom: '4cqh'
  };
  const numberStyle = {
    fontFamily: props.fontFamily || 'JetBrains Mono, ui-monospace, monospace',
    fontSize: fontSizeCss,
    color: flash ? '#EF4444' : (props.color || '#FFFFFF'),
    fontWeight: props.fontWeight || 'bold',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    whiteSpace: 'nowrap'
  };

  return (
    <div style={outerStyle}>
      {showLabel && (
        <div style={labelStyle}>
          {label}
          {showNTPDot && (
            <span
              style={{
                marginLeft: '0.6em',
                display: 'inline-block',
                width: '0.5em',
                height: '0.5em',
                borderRadius: '50%',
                backgroundColor: isNTPActive ? '#22C55E' : '#EAB308',
                verticalAlign: 'middle'
              }}
            />
          )}
        </div>
      )}
      <div style={numberStyle}>{displayed}</div>
    </div>
  );
}
