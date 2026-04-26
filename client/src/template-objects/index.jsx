import React from 'react';
import AnalogClockObject from './AnalogClockObject';
import DigitalClockObject from './DigitalClockObject';
import LabelObject from './LabelObject';
import DateObject from './DateObject';
import ImageObject from './ImageObject';
import LogoObject from './LogoObject';
import OnAirBadgeObject from './OnAirBadgeObject';
import ShapeObject from './ShapeObject';
import ProgressBarObject from './ProgressBarObject';
import ProgressRingObject from './ProgressRingObject';
import PlanningObject from './PlanningObject';
import VideoObject from './VideoObject';
import { DEFAULT_PROPS } from '../designer/defaultProps';

// Fusionne les DEFAULT_PROPS du type avec les props stockées sur l'objet.
// Garantit qu'une prop ajoutée APRÈS la création d'un template aura une valeur
// par défaut même si elle n'a pas été explicitement sauvegardée sur l'objet.
function mergeProps(type, props = {}) {
  return { ...(DEFAULT_PROPS[type] || {}), ...props };
}

// Rend uniquement le composant interne d'un objet template (sans positionnement).
// Utile pour le designer qui gère lui-même le positionnement via Moveable.
//
// IMPORTANT — Variant des horloges :
//   variant='current'   → heure courante (affectée par props.timezone si défini)
//   variant='remaining' → durée restante du chrono (toujours app timezone, durée brute)
//   variant='elapsed'   → durée écoulée du chrono (toujours app timezone, durée brute)
// Une timezone custom ne s'applique JAMAIS aux durées remaining/elapsed.
export function TemplateObjectContent({ obj }) {
  const { type, width, height } = obj;
  const props = mergeProps(type, obj.props);

  switch (type) {
    // ── Horloges unifiées (nouveau) ──
    case 'analog-clock':  return <AnalogClockObject  width={width} height={height} props={props} />;
    case 'digital-clock': return <DigitalClockObject width={width} height={height} props={props} />;

    // ── Legacy : variant déduit du type historique ──
    case 'analog-clock-current':   return <AnalogClockObject variant="current"   width={width} height={height} props={props} />;
    case 'analog-clock-remaining': return <AnalogClockObject variant="remaining" width={width} height={height} props={props} />;
    case 'analog-clock-elapsed':   return <AnalogClockObject variant="elapsed"   width={width} height={height} props={props} />;
    case 'digital-clock-current':   return <DigitalClockObject variant="current"   width={width} height={height} props={props} />;
    case 'digital-clock-remaining': return <DigitalClockObject variant="remaining" width={width} height={height} props={props} />;
    case 'digital-clock-elapsed':   return <DigitalClockObject variant="elapsed"   width={width} height={height} props={props} />;

    // ── Texte unifié (text) + legacy (label, dynamic-text) ──
    // LabelObject gère déjà l'interpolation des variables via injectVars (cf. LabelObject.jsx).
    case 'text':
    case 'label':
    case 'dynamic-text':  return <LabelObject width={width} height={height} props={props} />;

    case 'date':          return <DateObject width={width} height={height} props={props} />;
    case 'logo':          return <LogoObject width={width} height={height} props={props} />;
    case 'image':         return <ImageObject width={width} height={height} props={props} />;
    case 'onair-badge':   return <OnAirBadgeObject width={width} height={height} props={props} />;
    case 'shape':         return <ShapeObject width={width} height={height} props={props} />;
    case 'progress-bar':  return <ProgressBarObject width={width} height={height} props={props} />;
    case 'progress-ring': return <ProgressRingObject width={width} height={height} props={props} />;
    case 'planning':      return <PlanningObject width={width} height={height} props={props} />;
    case 'video':         return <VideoObject width={width} height={height} props={props} />;
    default:
      return <div style={{ color: '#EF4444', background: '#7f1d1d', padding: 8 }}>
        [type non implémenté : {type}]
      </div>;
  }
}

// Composant "full" : positionne l'objet en absolu dans le canvas + rend son contenu.
// Utilisé par Display.jsx.
export default function TemplateObject({ obj }) {
  const { x, y, width, height, rotation = 0, zIndex = 1 } = obj;
  const style = {
    position: 'absolute',
    left: x, top: y, width, height,
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center',
    zIndex
  };
  return <div style={style}><TemplateObjectContent obj={obj} /></div>;
}
