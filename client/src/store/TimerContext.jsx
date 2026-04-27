import React, { createContext, useContext, useEffect, useState } from 'react';
import { socket } from '../socket';

const TimerContext = createContext(null);

function pad(n) { return String(n).padStart(2, '0'); }

// Format remaining/elapsed (HH:MM:SS), avec overtime (+MM:SS) pour les valeurs négatives.
function formatSeconds(total) {
  const raw = Math.floor(Number(total) || 0);
  if (raw < 0) {
    const s = Math.abs(raw);
    return `+${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  }
  return `${pad(Math.floor(raw / 3600))}:${pad(Math.floor((raw % 3600) / 60))}:${pad(raw % 60)}`;
}

// Format heure courante en respectant le fuseau horaire et la langue.
function formatCurrentTime(d, tz, lang) {
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      timeZone: tz || undefined
    }).format(d);
  } catch {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
}

function adaptTimerState(raw = {}) {
  const out = {};
  if ('isRunning' in raw) out.isRunning = !!raw.isRunning;
  if ('isPaused'  in raw) out.isPaused  = !!raw.isPaused;
  if ('isNTPActive' in raw) out.isNTPActive = !!raw.isNTPActive;
  if ('currentNtpServer' in raw) out.currentNtpServer = raw.currentNtpServer || null;
  if ('usbRelayStatus' in raw) out.usbRelayStatus = !!raw.usbRelayStatus;
  // currentTime : on PRÉFÈRE celui du serveur (heure NTP-corrigée formatée
  // dans le fuseau studio). Indispensable pour /display sur le PC kiosk
  // dont l'horloge système peut être désynchro — le client ne doit plus
  // jamais recalculer l'heure depuis son propre new Date().
  if ('currentTime' in raw && typeof raw.currentTime === 'string' && raw.currentTime) {
    out.currentTime = raw.currentTime;
  }
  // serverTimeMs : epoch NTP du serveur — utilisé par les clocks avec une
  // timezone custom pour reformater l'heure dans n'importe quel fuseau sans
  // dépendre de Date.now() du browser (qui peut être faux sur un kiosk PC).
  if ('serverTimeMs' in raw && typeof raw.serverTimeMs === 'number' && raw.serverTimeMs > 0) {
    out.serverTimeMs = raw.serverTimeMs;
  }
  if ('remainingTime' in raw) {
    out.remainingTime = raw.remainingTime;
    out.remaining = formatSeconds(raw.remainingTime);
  }
  if ('elapsedTime' in raw) {
    out.elapsedTime = raw.elapsedTime;
    out.elapsed = formatSeconds(raw.elapsedTime);
  }
  if ('selectedDuration' in raw) out.selectedDuration = raw.selectedDuration;
  return out;
}

export function TimerProvider({ children }) {
  const [state, setState] = useState({
    isRunning: false, isPaused: false,
    selectedDuration: '00:00:00',
    elapsed: '00:00:00', remaining: '00:00:00',
    elapsedTime: 0, remainingTime: 0,
    currentTime: formatCurrentTime(new Date(), 'Europe/Paris', 'fr'),
    // 0 = pas encore reçu du serveur ; les clocks tomberont sur Date.now()
    // jusqu'au 1er timeUpdate (max 1s d'attente).
    serverTimeMs: 0,
    isNTPActive: true,
    currentNtpServer: null,
    usbRelayStatus: false,
    onair: false,
    studioName: 'OnAir Studio',
    timezone: 'Europe/Paris',
    language: 'fr'
  });
  useEffect(() => {
    // L'heure courante est désormais fournie par le serveur (timeUpdate 1Hz)
    // qui utilise son offset NTP. Plus de tick local — sinon le PC kiosk
    // afficherait son heure système locale (potentiellement désynchro)
    // au lieu de l'heure NTP de l'app.

    const onTimer = (raw) => setState(s => ({ ...s, ...adaptTimerState(raw) }));
    const onInitialState = (raw) => setState(s => ({ ...s, ...adaptTimerState(raw) }));
    const onOnAir = (payload) => setState(s => ({ ...s, onair: !!(payload && payload.isOnAir) }));
    const onStudioName = (name) => { if (name) setState(s => ({ ...s, studioName: String(name) })); };
    const onSettings = (settings) => {
      if (!settings) return;
      const tz = settings.timezone || 'Europe/Paris';
      const lang = settings.language || 'fr';
      setState(s => ({
        ...s,
        timezone: tz,
        language: lang,
        // settingsUpdate transporte aussi studioName — on l'utilise comme
        // source de vérité (sinon on dépend uniquement de studioNameUpdate
        // qui peut être raté à la connexion initiale).
        studioName: settings.studioName || s.studioName
        // Pas de currentTime ici : on attend le prochain timeUpdate (1Hz)
        // qui apporte l'heure NTP fraîchement formatée dans le nouveau tz.
      }));
    };

    socket.on('timerUpdate', onTimer);
    socket.on('timeUpdate', onTimer);
    socket.on('initialState', onInitialState);
    socket.on('onAirStateUpdate', onOnAir);
    socket.on('studioNameUpdate', onStudioName);
    socket.on('settingsUpdate', onSettings);

    // Demande les settings au mount pour récupérer tz + lang
    socket.emit('requestSettings');

    return () => {
      socket.off('timerUpdate', onTimer);
      socket.off('timeUpdate', onTimer);
      socket.off('initialState', onInitialState);
      socket.off('onAirStateUpdate', onOnAir);
      socket.off('studioNameUpdate', onStudioName);
      socket.off('settingsUpdate', onSettings);
    };
  }, []);

  return <TimerContext.Provider value={state}>{children}</TimerContext.Provider>;
}

export function useTimerState() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimerState must be used inside <TimerProvider>');
  return ctx;
}
