// Provider Google Calendar
// - OAuth 2.0 flow (installed app — redirect_uri configurable)
// - Refresh automatique de l'access_token
// - listCalendars(), listEvents(range)
//
// Scopes : calendar.readonly + userinfo.email
// Doc : https://developers.google.com/calendar/api/v3/reference

const storage = require('../storage');
const { fetchWithTimeout } = require('../fetch-utils');

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_API = 'https://www.googleapis.com/calendar/v3';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid'
].join(' ');

function buildAuthUrl({ redirectUri, state }) {
  const creds = storage.getCredentials('google');
  if (!creds || !creds.clientId) throw new Error('Google : client_id non configuré dans Settings');
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

async function exchangeCode({ code, redirectUri }) {
  const creds = storage.getCredentials('google');
  if (!creds || !creds.clientId || !creds.clientSecret) throw new Error('Google : credentials non configurés');
  const body = new URLSearchParams({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });
  const res = await fetchWithTimeout(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error(`OAuth Google : ${res.status} ${await res.text()}`);
  const tokens = await res.json();
  // tokens : { access_token, expires_in, refresh_token, scope, token_type, id_token }
  tokens.expires_at = Date.now() + (tokens.expires_in - 60) * 1000;

  // Récupérer l'email associé
  const userinfo = await fetchWithTimeout('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  }).then(r => r.json()).catch(() => ({}));

  return { tokens, accountEmail: userinfo.email || null };
}

async function refreshAccessToken(tokens) {
  const creds = storage.getCredentials('google');
  if (!creds || !creds.clientId || !creds.clientSecret) throw new Error('Google : credentials non configurés');
  if (!tokens.refresh_token) throw new Error('Google : refresh_token absent — reconnecter le compte');
  const body = new URLSearchParams({
    refresh_token: tokens.refresh_token,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'refresh_token'
  });
  const res = await fetchWithTimeout(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error(`Refresh Google : ${res.status} ${await res.text()}`);
  const fresh = await res.json();
  return {
    ...tokens,
    access_token: fresh.access_token,
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
  const res = await fetchWithTimeout(`${GOOGLE_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Google calendarList : ${res.status} ${await res.text()}`);
  const json = await res.json();
  return (json.items || []).map(c => ({
    id: c.id,
    name: c.summaryOverride || c.summary,
    color: c.backgroundColor || '#4285F4',
    primary: !!c.primary,
    source: 'google'
  }));
}

async function listEvents(accountId, { calendarIds, timeMin, timeMax }) {
  const token = await getAccessToken(accountId);
  const targets = (calendarIds && calendarIds.length) ? calendarIds : (await listCalendars(accountId)).map(c => c.id);
  const calendars = await listCalendars(accountId);
  const calMap = new Map(calendars.map(c => [c.id, c]));

  const all = [];
  for (const calId of targets) {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250'
    });
    const url = `${GOOGLE_API}/calendars/${encodeURIComponent(calId)}/events?${params}`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      // Skip silencieusement les calendriers en erreur (calendrier supprimé etc)
      console.warn(`[google] events ${calId}: ${res.status}`);
      continue;
    }
    const json = await res.json();
    const cal = calMap.get(calId) || { id: calId, name: calId, color: '#4285F4' };
    for (const ev of (json.items || [])) {
      if (ev.status === 'cancelled') continue;
      all.push(normalizeEvent(ev, cal));
    }
  }
  return all;
}

function normalizeEvent(ev, cal) {
  const allDay = !!(ev.start && ev.start.date);
  const start = ev.start.dateTime || ev.start.date;
  const end = ev.end ? (ev.end.dateTime || ev.end.date) : start;
  return {
    id: ev.id,
    calendarId: cal.id,
    calendarName: cal.name,
    calendarColor: cal.color,
    title: ev.summary || '(Sans titre)',
    description: ev.description || '',
    location: ev.location || '',
    start,
    end,
    allDay,
    organizer: ev.organizer ? { email: ev.organizer.email, name: ev.organizer.displayName || '' } : null,
    attendees: (ev.attendees || []).map(a => ({
      email: a.email,
      name: a.displayName || '',
      status: a.responseStatus || 'needsAction'
    })),
    status: ev.status || 'confirmed',
    url: ev.htmlLink || null,
    source: 'google'
  };
}

module.exports = {
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getAccessToken,
  listCalendars,
  listEvents
};
