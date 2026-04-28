// Façade calendrier : gère le polling périodique des comptes connectés,
// maintient un cache en mémoire des events, expose des handlers utilisés
// par les routes Express et émet sur Socket.IO quand les events changent.
//
// Cache key : `${accountId}:${range}` (range = 'today' | 'week')
// Polling : toutes les POLL_INTERVAL_MS (~5 min). On rafraîchit à la demande
// si un client interroge un cache vide ou trop ancien.

const storage = require('./storage');
const google = require('./providers/google');
const microsoft = require('./providers/microsoft');
const caldav = require('./providers/caldav');

const POLL_INTERVAL_MS = 5 * 60_000;        // 5 min
const STALE_THRESHOLD_MS = 60_000;          // sert un cache de moins d'1 min sans refresh
const eventsCache = new Map();              // key → { events, fetchedAt }

let io = null;     // injecté depuis index.js
let pollTimer = null;

function setSocketServer(socketIo) { io = socketIo; }

function providerFor(name) {
  switch (name) {
    case 'google':    return google;
    case 'microsoft': return microsoft;
    case 'apple':     return caldav;
    default: throw new Error(`Provider inconnu : ${name}`);
  }
}

// ── Range helpers ──────────────────────────────────────────────────────────

function rangeBounds(range, tz) {
  const now = new Date();
  if (range === 'week') {
    // Du début du jour J au début du jour J+7
    const start = startOfDayInTz(now, tz);
    const end = new Date(start.getTime() + 7 * 86_400_000);
    return { timeMin: start, timeMax: end };
  }
  // 'today' par défaut : début du jour → fin du jour
  const start = startOfDayInTz(now, tz);
  const end = new Date(start.getTime() + 86_400_000);
  return { timeMin: start, timeMax: end };
}

function startOfDayInTz(d, tz) {
  // Approxime le début de jour dans la timezone de l'app — pour le cache,
  // une précision à la minute près suffit largement.
  if (!tz) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const parts = fmt.formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    // Construit une date "locale TZ" en remettant H:M:S à 0
    return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000Z`);
  } catch {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
}

// ── Refresh & cache ────────────────────────────────────────────────────────

async function refreshAccountEvents(accountId, range, tz) {
  const acc = storage.getAccount(accountId);
  if (!acc) throw new Error(`Compte ${accountId} introuvable`);
  const provider = providerFor(acc.provider);
  const { timeMin, timeMax } = rangeBounds(range, tz);
  const events = await provider.listEvents(accountId, { timeMin, timeMax });
  const key = `${accountId}:${range}`;
  eventsCache.set(key, { events, fetchedAt: Date.now() });
  storage.setAccountSync(accountId, { lastSyncAt: new Date().toISOString(), lastError: null });
  if (io) io.emit('calendarEventsUpdate', { accountId, range, events });
  return events;
}

async function getEvents(accountId, range, tz, { force = false } = {}) {
  const key = `${accountId}:${range}`;
  const cached = eventsCache.get(key);
  const isFresh = cached && (Date.now() - cached.fetchedAt) < STALE_THRESHOLD_MS;
  if (cached && isFresh && !force) return cached.events;
  try {
    return await refreshAccountEvents(accountId, range, tz);
  } catch (e) {
    storage.setAccountSync(accountId, { lastError: { message: e.message, at: new Date().toISOString() } });
    if (cached) return cached.events; // sert le stale plutôt que rien
    throw e;
  }
}

// ── Calendars (rafraîchit la liste de calendriers d'un compte) ─────────────

async function refreshAccountCalendars(accountId) {
  const acc = storage.getAccount(accountId);
  if (!acc) throw new Error(`Compte ${accountId} introuvable`);
  const provider = providerFor(acc.provider);
  const calendars = await provider.listCalendars(accountId);
  storage.setAccountSync(accountId, { calendars });
  return calendars;
}

// ── Polling automatique ────────────────────────────────────────────────────

function startPolling(getAppTz) {
  if (pollTimer) return;
  // Garde anti-chevauchement : offline, chaque fetch peut prendre jusqu'à
  // son timeout (10s). Avec N comptes × 2 ranges, un tick lent peut empiéter
  // sur le suivant si le réseau est mort. Skip le tick si le précédent court.
  let pollInFlight = false;
  const tick = async () => {
    if (pollInFlight) return;
    pollInFlight = true;
    try {
      const accounts = storage.listAccounts();
      for (const acc of accounts) {
        try {
          // On n'a pas la liste des `range` actifs côté client → on rafraîchit
          // les deux tant qu'il y a au moins une entrée déjà en cache.
          for (const range of ['today', 'week']) {
            const key = `${acc.id}:${range}`;
            if (eventsCache.has(key)) {
              await refreshAccountEvents(acc.id, range, getAppTz());
            }
          }
        } catch (e) {
          console.warn(`[calendar] polling ${acc.id}:`, e.message);
        }
      }
    } finally {
      pollInFlight = false;
    }
  };
  pollTimer = setInterval(tick, POLL_INTERVAL_MS);
  // Premier tick après 30s pour laisser l'app démarrer
  setTimeout(tick, 30_000);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

module.exports = {
  setSocketServer,
  startPolling,
  stopPolling,
  refreshAccountEvents,
  refreshAccountCalendars,
  getEvents,
  rangeBounds,
  providerFor,
  // Reset utils — branchés sur les endpoints /api/admin/reset/*
  deleteAllAccounts: storage.deleteAllAccounts,
  deleteAllCredentials: storage.deleteAllCredentials
};
