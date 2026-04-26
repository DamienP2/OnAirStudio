// ICS calendar proxy — récupère un flux iCal (Google Calendar "Adresse secrète
// au format iCal" ou URL publique), parse, extrait les événements du jour.
//
// Note format iCal : il ne contient PAS la notion de colorId Google — le filtrage
// se fait donc par mot-clé dans le titre, ou rien du tout si aucun mot-clé fourni.
//
// Sécurité : on restreint les URLs à calendar.google.com pour éviter SSRF.

const nodeIcal = require('node-ical');

// Cache court côté serveur : 4s — pour dédupliquer les pollings simultanés
// (plusieurs displays ouverts sur le même agenda) sans bloquer le rafraîchissement
// rapide (client poll toutes les 5s).
const CACHE_TTL_MS = 4 * 1000;
const FETCH_TIMEOUT_MS = 15 * 1000;

// Clé = URL brute (déjà validée). Valeur = { events, fetchedAt }
const cache = new Map();

function isAllowedUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (u.hostname !== 'calendar.google.com') return false;
    // Les URLs ICS Google ressemblent à /calendar/ical/<...>/basic.ics
    if (!/^\/calendar\/ical\//.test(u.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

function todayBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

// Retourne toutes les occurrences d'un événement (one-off ou récurrent)
// qui tombent dans [rangeStart, rangeEnd].
function expandOccurrences(ev, rangeStart, rangeEnd) {
  const occurrences = [];
  if (!ev.start || !ev.end) return occurrences;

  // Événement non récurrent
  if (!ev.rrule) {
    if (ev.end > rangeStart && ev.start < rangeEnd) {
      occurrences.push({ start: ev.start, end: ev.end });
    }
    return occurrences;
  }

  // Événement récurrent — rrule.between retourne les occurrences de début
  // On élargit un peu la fenêtre avant pour attraper les événements qui
  // commencent la veille et se terminent aujourd'hui.
  const duration = ev.end.getTime() - ev.start.getTime();
  const lookback = new Date(rangeStart.getTime() - 24 * 60 * 60 * 1000);
  let starts;
  try {
    starts = ev.rrule.between(lookback, rangeEnd, true);
  } catch {
    return occurrences;
  }
  for (const s of starts) {
    const e = new Date(s.getTime() + duration);
    if (e > rangeStart && s < rangeEnd) {
      occurrences.push({ start: s, end: e });
    }
  }
  // Exdates (exceptions de la règle de récurrence)
  if (ev.exdate) {
    const exdates = Object.values(ev.exdate).map(d => new Date(d).getTime());
    return occurrences.filter(o => !exdates.includes(o.start.getTime()));
  }
  return occurrences;
}

async function fetchIcs(url) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} en récupérant l'ICS`);
    const text = await res.text();
    return text;
  } finally {
    clearTimeout(to);
  }
}

// Renvoie les événements du jour pour l'URL ICS donnée, éventuellement filtrés
// par mot-clé dans le titre (insensible à la casse).
async function listEventsForToday(icsUrl, titleKeyword = null) {
  if (!isAllowedUrl(icsUrl)) {
    const err = new Error('URL ICS non autorisée — doit être https://calendar.google.com/calendar/ical/…');
    err.code = 'INVALID_URL';
    throw err;
  }

  const cacheKey = icsUrl;
  const cached = cache.get(cacheKey);
  let parsed;
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    parsed = cached.parsed;
  } else {
    const text = await fetchIcs(icsUrl);
    parsed = nodeIcal.parseICS(text);
    cache.set(cacheKey, { parsed, fetchedAt: Date.now() });
  }

  const { start, end } = todayBounds();
  const kw = titleKeyword ? String(titleKeyword).toLowerCase().trim() : null;
  const out = [];

  for (const key of Object.keys(parsed)) {
    const ev = parsed[key];
    if (!ev || ev.type !== 'VEVENT') continue;
    const summary = ev.summary || '';
    if (kw && !summary.toLowerCase().includes(kw)) continue;
    const occurrences = expandOccurrences(ev, start, end);
    for (const occ of occurrences) {
      const allDay = !!ev.datetype && ev.datetype === 'date'; // tout-journée
      out.push({
        id: `${ev.uid || key}@${occ.start.toISOString()}`,
        summary,
        description: ev.description || '',
        location: ev.location || '',
        start: occ.start.toISOString(),
        end: occ.end.toISOString(),
        allDay
      });
    }
  }

  out.sort((a, b) => new Date(a.start) - new Date(b.start));
  return { events: out, fetchedAt: cached?.fetchedAt || Date.now() };
}

function invalidateCache() { cache.clear(); }

module.exports = { listEventsForToday, invalidateCache, isAllowedUrl };
