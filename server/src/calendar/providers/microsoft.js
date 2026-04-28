// Provider Microsoft Calendar (Outlook / Microsoft 365)
// - OAuth 2.0 via Microsoft identity platform
// - Refresh automatique de l'access_token
// - listCalendars(), listEvents(range)
//
// Scopes : Calendars.Read, User.Read, offline_access
// Doc : https://learn.microsoft.com/en-us/graph/api/resources/calendar

const storage = require('../storage');
const { fetchWithTimeout } = require('../fetch-utils');

function authBase(tenant) {
  return `https://login.microsoftonline.com/${tenant || 'common'}/oauth2/v2.0`;
}

const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = [
  'offline_access',
  'User.Read',
  'Calendars.Read',
  'Calendars.Read.Shared',
  'openid', 'email', 'profile'
].join(' ');

function buildAuthUrl({ redirectUri, state }) {
  const creds = storage.getCredentials('microsoft');
  if (!creds || !creds.clientId) throw new Error('Microsoft : client_id non configuré dans Settings');
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: SCOPES,
    state,
    prompt: 'select_account'
  });
  return `${authBase(creds.tenant)}/authorize?${params.toString()}`;
}

async function exchangeCode({ code, redirectUri }) {
  const creds = storage.getCredentials('microsoft');
  if (!creds || !creds.clientId || !creds.clientSecret) throw new Error('Microsoft : credentials non configurés');
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: SCOPES
  });
  const res = await fetchWithTimeout(`${authBase(creds.tenant)}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error(`OAuth Microsoft : ${res.status} ${await res.text()}`);
  const tokens = await res.json();
  tokens.expires_at = Date.now() + (tokens.expires_in - 60) * 1000;

  const me = await fetchWithTimeout(`${GRAPH}/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  }).then(r => r.json()).catch(() => ({}));

  return {
    tokens,
    accountEmail: me.userPrincipalName || me.mail || null
  };
}

async function refreshAccessToken(tokens) {
  const creds = storage.getCredentials('microsoft');
  if (!creds || !creds.clientId || !creds.clientSecret) throw new Error('Microsoft : credentials non configurés');
  if (!tokens.refresh_token) throw new Error('Microsoft : refresh_token absent — reconnecter le compte');
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: tokens.refresh_token,
    grant_type: 'refresh_token',
    scope: SCOPES
  });
  const res = await fetchWithTimeout(`${authBase(creds.tenant)}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error(`Refresh Microsoft : ${res.status} ${await res.text()}`);
  const fresh = await res.json();
  return {
    ...tokens,
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token || tokens.refresh_token,
    expires_in: fresh.expires_in,
    expires_at: Date.now() + (fresh.expires_in - 60) * 1000
  };
}

async function getAccessToken(accountId) {
  const acc = storage.getAccountWithTokens(accountId);
  if (!acc || !acc.tokens) throw new Error('Compte introuvable ou non connecté');
  let { tokens } = acc;
  if (!tokens.expires_at || tokens.expires_at < Date.now() + 5_000) {
    tokens = await refreshAccessToken(tokens);
    storage.updateTokens(accountId, tokens);
  }
  return tokens.access_token;
}

async function listCalendars(accountId) {
  const token = await getAccessToken(accountId);
  const res = await fetchWithTimeout(`${GRAPH}/me/calendars`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Microsoft calendars : ${res.status} ${await res.text()}`);
  const json = await res.json();
  return (json.value || []).map(c => ({
    id: c.id,
    name: c.name,
    color: hexFromMsColor(c.hexColor || c.color),
    primary: !!c.isDefaultCalendar,
    source: 'microsoft'
  }));
}

function hexFromMsColor(c) {
  if (!c) return '#0078D4';
  if (typeof c === 'string' && c.startsWith('#')) return c;
  // Microsoft retourne parfois des "categoryColor preset" : auto, lightBlue, etc. On simplifie.
  const map = {
    lightBlue: '#3B82F6', lightGreen: '#22C55E', lightOrange: '#F97316',
    lightGray: '#6B7280', lightYellow: '#F59E0B', lightTeal: '#14B8A6',
    lightPink: '#EC4899', lightBrown: '#A16207', lightRed: '#EF4444',
    maxColor: '#0078D4'
  };
  return map[c] || '#0078D4';
}

async function listEvents(accountId, { calendarIds, timeMin, timeMax }) {
  const token = await getAccessToken(accountId);
  const calendars = await listCalendars(accountId);
  const calMap = new Map(calendars.map(c => [c.id, c]));
  const targets = (calendarIds && calendarIds.length) ? calendarIds : calendars.map(c => c.id);

  const all = [];
  for (const calId of targets) {
    const params = new URLSearchParams({
      startDateTime: timeMin.toISOString(),
      endDateTime: timeMax.toISOString(),
      $top: '250',
      $orderby: 'start/dateTime'
    });
    const url = `${GRAPH}/me/calendars/${encodeURIComponent(calId)}/calendarView?${params}`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } });
    if (!res.ok) {
      console.warn(`[microsoft] events ${calId}: ${res.status}`);
      continue;
    }
    const json = await res.json();
    const cal = calMap.get(calId) || { id: calId, name: calId, color: '#0078D4' };
    for (const ev of (json.value || [])) {
      if (ev.isCancelled) continue;
      all.push(normalizeEvent(ev, cal));
    }
  }
  return all;
}

function normalizeEvent(ev, cal) {
  const allDay = !!ev.isAllDay;
  // Graph renvoie {dateTime, timeZone} ; on normalise en ISO UTC avec Z
  const toIso = (x) => {
    if (!x) return null;
    const dt = x.dateTime;
    if (!dt) return null;
    // Si pas de Z et timezone='UTC' (Prefer), ajouter Z
    return dt.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dt) ? dt : dt + 'Z';
  };
  return {
    id: ev.id,
    calendarId: cal.id,
    calendarName: cal.name,
    calendarColor: cal.color,
    title: ev.subject || '(Sans titre)',
    description: stripHtml(ev.bodyPreview || (ev.body && ev.body.content) || ''),
    location: (ev.location && (ev.location.displayName || '')) || '',
    start: toIso(ev.start),
    end: toIso(ev.end),
    allDay,
    organizer: ev.organizer ? {
      email: ev.organizer.emailAddress?.address || '',
      name: ev.organizer.emailAddress?.name || ''
    } : null,
    attendees: (ev.attendees || []).map(a => ({
      email: a.emailAddress?.address || '',
      name: a.emailAddress?.name || '',
      status: a.status?.response || 'none'
    })),
    status: ev.showAs || 'busy',
    url: ev.webLink || null,
    source: 'microsoft'
  };
}

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = {
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getAccessToken,
  listCalendars,
  listEvents
};
