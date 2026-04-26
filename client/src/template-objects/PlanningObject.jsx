import React, { useEffect, useState, useRef, useMemo } from 'react';
import { socket } from '../socket';
import { apiCalendarEvents } from '../store/calendarStore';

// Planning V3 — affiche les événements d'un compte calendrier connecté.
//
// Statuts (calculés localement, tick toutes les 10s) :
//   past    — terminé (opacité réduite)
//   current — en cours (mise en avant)
//   upcoming — à venir
//
// Données :
//   - 1ère charge : GET /api/calendar/v2/events?accountId=…&range=…
//   - mises à jour : event Socket.IO `calendarEventsUpdate` (broadcast serveur)
//
// Rétro-compat : si l'objet a `icsUrl` mais pas `accountId`, fallback sur l'ancien endpoint
// /api/calendar/events (ICS public Google) — pour ne pas casser les anciens templates.

const TICK_MS = 10_000;

function pad(n) { return String(n).padStart(2, '0'); }
function formatHM(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusFor(ev, now) {
  if (!ev.start || !ev.end) return 'upcoming';
  const s = new Date(ev.start).getTime();
  const e = new Date(ev.end).getTime();
  if (now < s) return 'upcoming';
  if (now >= s && now < e) return 'current';
  return 'past';
}

function durationMinutes(ev) {
  if (!ev.start || !ev.end) return 0;
  return Math.max(0, (new Date(ev.end) - new Date(ev.start)) / 60_000);
}

function applyFilters(events, p) {
  return events.filter(ev => {
    if (p.calendarIds && p.calendarIds.length && !p.calendarIds.includes(ev.calendarId)) return false;
    if (p.titleContains && !(ev.title || '').toLowerCase().includes(p.titleContains.toLowerCase())) return false;
    if (p.locations && p.locations.length && !p.locations.includes(ev.location || '')) return false;
    if (p.statuses && p.statuses.length && !p.statuses.includes(ev.status)) return false;
    if (p.hasLocation === 'yes' && !ev.location) return false;
    if (p.hasLocation === 'no'  &&  ev.location) return false;
    if (p.hasDescription === 'yes' && !ev.description) return false;
    if (p.hasDescription === 'no'  &&  ev.description) return false;
    if (p.organizers && p.organizers.length) {
      const oe = ev.organizer && ev.organizer.email;
      if (!oe || !p.organizers.includes(oe)) return false;
    }
    const dur = durationMinutes(ev);
    if (p.durationMinMinutes > 0 && dur < p.durationMinMinutes) return false;
    if (p.durationMaxMinutes > 0 && dur > p.durationMaxMinutes) return false;
    return true;
  });
}

export default function PlanningObject({ props }) {
  const {
    accountId,
    range = 'today',
    layout = 'list',
    showTitle = true, showTime = true, showLocation = true,
    showDescription = false, showCalendar = true, showOrganizer = false,
    maxItems = 12,
    fontFamily = 'Inter, sans-serif',
    color = '#FFFFFF',
    backgroundColor = 'rgba(15, 23, 42, 0.6)',
    borderRadius = 12,
    colorByCalendar = true,
    accentColor = '#EF4444',
    pastOpacity = 0.35,
    // legacy
    icsUrl,
    titleKeyword
  } = props;

  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [, setTick] = useState(0);
  const legacyMode = !accountId && !!icsUrl;

  // Charge initial
  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (accountId) {
      apiCalendarEvents({ accountId, range }).then(d => {
        if (!cancelled) setEvents(d.events || []);
      }).catch(e => { if (!cancelled) setError(e.message); });
      return () => { cancelled = true; };
    }
    if (icsUrl) {
      // Legacy ICS Google
      const params = new URLSearchParams({ icsUrl });
      if (titleKeyword) params.set('titleKeyword', titleKeyword);
      fetch(`/api/calendar/events?${params}`)
        .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error)))
        .then(d => { if (!cancelled) setEvents((d.events || []).map(legacyToV3)); })
        .catch(e => { if (!cancelled) setError(typeof e === 'string' ? e : (e?.message || 'Erreur')); });
      const id = setInterval(() => {
        fetch(`/api/calendar/events?${params}`)
          .then(r => r.json())
          .then(d => { if (!cancelled) setEvents((d.events || []).map(legacyToV3)); })
          .catch(() => {});
      }, 5 * 60_000);
      return () => { cancelled = true; clearInterval(id); };
    }
    setEvents([]);
    return () => { cancelled = true; };
  }, [accountId, range, icsUrl, titleKeyword]);

  // Live updates via Socket.IO (V3 only)
  useEffect(() => {
    if (!accountId) return;
    const onUpd = (payload) => {
      if (payload.accountId === accountId && payload.range === range) {
        setEvents(payload.events || []);
      }
    };
    socket.on('calendarEventsUpdate', onUpd);
    return () => socket.off('calendarEventsUpdate', onUpd);
  }, [accountId, range]);

  // Tick pour recalcul de statut (passé/en cours/futur) sans refetch
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const filtered = useMemo(() => applyFilters(events, props), [events, props]);
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(a.start || 0) - new Date(b.start || 0)),
    [filtered]
  );
  const visible = sorted.slice(0, maxItems > 0 ? maxItems : sorted.length);

  const outerStyle = {
    width: '100%', height: '100%',
    containerType: 'size',
    background: backgroundColor,
    borderRadius: `${borderRadius}px`,
    fontFamily,
    color,
    padding: '3cqh 3cqw',
    boxSizing: 'border-box',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column', gap: '1.5cqh'
  };

  if (!accountId && !icsUrl) {
    return (
      <div style={outerStyle}>
        <p style={{ fontSize: '3.5cqh', opacity: 0.7 }}>
          Planning non configuré.<br/>
          <span style={{ fontSize: '2.5cqh', opacity: 0.6 }}>
            Connecte un compte calendrier dans <strong>Calendriers</strong>, puis sélectionne-le dans l'inspector.
          </span>
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div style={outerStyle}>
        <p style={{ fontSize: '3.5cqh', color: '#EF4444' }}>Erreur Planning : {error}</p>
      </div>
    );
  }
  if (visible.length === 0) {
    const empty = range === 'week' ? 'Aucun événement cette semaine.' : 'Aucun événement aujourd\'hui.';
    return (
      <div style={outerStyle}><p style={{ fontSize: '3.5cqh', opacity: 0.5 }}>{empty}</p></div>
    );
  }

  // Rendu : par défaut layout 'list'. Le layout 'agenda' est plus simple : même cards mais on ajoute la date.
  return (
    <div style={outerStyle}>
      <ul style={{
        listStyle: 'none', padding: 0, margin: 0,
        display: 'flex', flexDirection: 'column', gap: '1.5cqh',
        overflowY: 'auto', flex: 1
      }}>
        {visible.map(ev => {
          const status = statusFor(ev, now);
          const isCurrent = status === 'current';
          const isPast = status === 'past';
          const calColor = colorByCalendar && ev.calendarColor ? ev.calendarColor : accentColor;
          return (
            <li key={ev.id} style={{
              display: 'flex',
              gap: '2cqw',
              padding: '1.5cqh 1.5cqw',
              borderLeft: `4px solid ${isCurrent ? calColor : (colorByCalendar ? `${calColor}80` : 'rgba(255,255,255,0.15)')}`,
              background: isCurrent ? hexToRgba(calColor, 0.12) : 'rgba(255,255,255,0.03)',
              borderRadius: '2px',
              opacity: isPast ? pastOpacity : 1,
              transition: 'opacity 0.3s ease, background 0.3s ease'
            }}>
              {showTime && (
                <div style={{ fontSize: '3cqh', fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: '11cqw', lineHeight: 1.1 }}>
                  {ev.allDay ? 'Jour' : formatHM(ev.start)}
                  {!ev.allDay && ev.end && (
                    <div style={{ fontSize: '2cqh', fontWeight: 400, opacity: 0.6 }}>
                      → {formatHM(ev.end)}
                    </div>
                  )}
                  {layout === 'agenda' && ev.start && (
                    <div style={{ fontSize: '1.7cqh', fontWeight: 400, opacity: 0.5 }}>
                      {new Date(ev.start).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}
                    </div>
                  )}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.6cqh' }}>
                {showTitle && (
                  <div style={{
                    fontSize: '3cqh', fontWeight: isCurrent ? 700 : 500, lineHeight: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>{ev.title}</div>
                )}
                {showLocation && ev.location && (
                  <div style={{ fontSize: '2.2cqh', opacity: 0.7, lineHeight: 1.3 }}>📍 {ev.location}</div>
                )}
                {showDescription && ev.description && (
                  <div style={{
                    fontSize: '2.2cqh', opacity: 0.7, lineHeight: 1.3,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                  }}>{ev.description}</div>
                )}
                {(showCalendar && ev.calendarName) || (showOrganizer && ev.organizer) ? (
                  <div style={{ fontSize: '1.9cqh', opacity: 0.55, display: 'flex', gap: '1.5cqw', flexWrap: 'wrap' }}>
                    {showCalendar && ev.calendarName && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5cqw' }}>
                        <span style={{ width: '0.8cqh', height: '0.8cqh', borderRadius: '50%', background: ev.calendarColor || calColor }} />
                        {ev.calendarName}
                      </span>
                    )}
                    {showOrganizer && ev.organizer && (ev.organizer.name || ev.organizer.email) && (
                      <span>· {ev.organizer.name || ev.organizer.email}</span>
                    )}
                  </div>
                ) : null}
                {isCurrent && (
                  <div style={{ fontSize: '1.9cqh', color: calColor, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    ● En cours
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {legacyMode && (
        <div style={{ fontSize: '1.6cqh', opacity: 0.4, fontStyle: 'italic' }}>
          Mode rétro-compat ICS — connecte un compte dans Calendriers pour profiter des filtres dynamiques.
        </div>
      )}
    </div>
  );
}

// Convertit le format de l'ancien endpoint ICS vers le format V3 normalisé.
function legacyToV3(ev) {
  return {
    id: ev.id || `${ev.start}-${ev.summary}`,
    calendarId: 'legacy',
    calendarName: 'Agenda',
    calendarColor: '#4285F4',
    title: ev.summary || '(Sans titre)',
    description: ev.description || '',
    location: ev.location || '',
    start: ev.start, end: ev.end, allDay: !!ev.allDay,
    organizer: null, attendees: [],
    status: 'confirmed', url: null, source: 'legacy'
  };
}

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return `rgba(239,68,68,${alpha})`;
  const h = hex.slice(1);
  const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
