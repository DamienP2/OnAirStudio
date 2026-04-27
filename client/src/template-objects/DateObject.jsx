import React from 'react';
import { format } from 'date-fns';
import { fr, enGB } from 'date-fns/locale';
import { useTimerState } from '../store/TimerContext';

// Locale dérivée de la langue de l'app (Réglages). Pas de prop dédiée.
function localeFor(lang) {
  return lang === 'en' ? enGB : fr;
}

export default function DateObject({ props }) {
  const { language, serverTimeMs } = useTimerState();
  // Pas de tick local : on rafraîchit à chaque timeUpdate du serveur (1Hz).
  // Évite l'usage de new Date() qui serait faux sur un kiosk avec horloge
  // système désynchro. serverTimeMs=0 (pas encore reçu) → fallback Date.now().
  const now = new Date(serverTimeMs || Date.now());
  const locale = localeFor(language);
  const text = format(now, props.format || 'EEEE d MMMM yyyy', { locale });
  const fontFamily = props.fontFamily || 'Inter, system-ui, sans-serif';

  const charCount = Math.max(text.length, 1);
  const cqwPerChar = Math.min(80, 172 / charCount);

  const outerStyle = {
    width: '100%',
    height: '100%',
    containerType: 'size',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2% 3%',
    boxSizing: 'border-box',
    overflow: 'hidden',
    backgroundColor: props.backgroundColor || 'transparent',
    borderRadius: `${props.borderRadius ?? 0}px`
  };
  const innerStyle = {
    fontFamily,
    fontSize: `min(95cqh, ${Math.round(cqwPerChar)}cqw)`,
    color: props.color || '#FFFFFF',
    lineHeight: 1,
    whiteSpace: 'nowrap'
  };
  return (
    <div style={outerStyle}>
      <div style={innerStyle}>{text}</div>
    </div>
  );
}
