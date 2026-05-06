// Google Calendar integration — OAuth 2.0 + Events API
//
// Fichier de config : google-calendar-config.json (à côté de admin-password.json)
//   {
//     "clientId": "...",
//     "clientSecret": "...",
//     "refreshToken": "...",   // présent uniquement si l'utilisateur a connecté son compte
//     "accountEmail": "..."    // email du compte connecté (affichage)
//   }
//
// Flow OAuth (Web application type) :
//   1. admin saisit clientId + clientSecret → POST /api/calendar/config
//   2. admin clique "Connecter" → POST /api/calendar/oauth/start → URL Google
//   3. admin ouvre l'URL dans un nouvel onglet, autorise
//   4. Google redirige vers /api/calendar/oauth/callback?code=...
//   5. serveur échange le code → stocke refreshToken + accountEmail
//   6. serveur renvoie une page HTML "Connecté — fermer cet onglet"
//
// L'admin doit avoir déclaré l'URI de redirection exacte dans la Google Cloud Console
// (Authorized redirect URIs). Le server l'affiche à l'admin pour copier-coller.

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CONFIG_FILE = path.join(__dirname, 'google-calendar-config.json');

// Scopes minimaux : lecture seule des calendars + events
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
];

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { clientId: null, clientSecret: null, refreshToken: null, accountEmail: null };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { clientId: null, clientSecret: null, refreshToken: null, accountEmail: null };
  }
}

function writeConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function setCredentials({ clientId, clientSecret }) {
  const cfg = readConfig();
  cfg.clientId = clientId || null;
  cfg.clientSecret = clientSecret || null;
  // Reset de la connexion si les creds changent
  cfg.refreshToken = null;
  cfg.accountEmail = null;
  writeConfig(cfg);
}

function disconnect() {
  const cfg = readConfig();
  cfg.refreshToken = null;
  cfg.accountEmail = null;
  writeConfig(cfg);
}

function buildOAuth2Client(redirectUri) {
  const cfg = readConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    const err = new Error('Google OAuth non configuré (clientId/clientSecret manquants)');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  const client = new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, redirectUri);
  if (cfg.refreshToken) {
    client.setCredentials({ refresh_token: cfg.refreshToken });
  }
  return client;
}

function getAuthUrl(redirectUri) {
  const client = buildOAuth2Client(redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',    // obligatoire pour obtenir un refresh_token
    prompt: 'consent',         // force le refresh_token même si déjà autorisé
    scope: SCOPES
  });
}

async function exchangeCodeForTokens(code, redirectUri) {
  const client = buildOAuth2Client(redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    const err = new Error('Google n\'a pas renvoyé de refresh_token — révoque l\'accès dans Google Account puis réessaie avec prompt=consent.');
    err.code = 'NO_REFRESH_TOKEN';
    throw err;
  }
  // Récupérer l'email du compte connecté
  client.setCredentials(tokens);
  let accountEmail = null;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    accountEmail = data.email || null;
  } catch (e) {
    // non bloquant
    console.error('[gcal] Impossible de récupérer l\'email :', e.message);
  }
  const cfg = readConfig();
  cfg.refreshToken = tokens.refresh_token;
  cfg.accountEmail = accountEmail;
  writeConfig(cfg);
  return { accountEmail };
}

function getStatus() {
  const cfg = readConfig();
  return {
    configured: !!(cfg.clientId && cfg.clientSecret),
    connected: !!cfg.refreshToken,
    accountEmail: cfg.accountEmail || null,
    clientId: cfg.clientId || null // utile pour le pré-remplissage du formulaire
  };
}

async function listCalendars(redirectUri) {
  const client = buildOAuth2Client(redirectUri);
  if (!readConfig().refreshToken) {
    const err = new Error('Non connecté à Google');
    err.code = 'NOT_CONNECTED';
    throw err;
  }
  const calendar = google.calendar({ version: 'v3', auth: client });
  const { data } = await calendar.calendarList.list({ maxResults: 100 });
  return (data.items || []).map(c => ({
    id: c.id,
    summary: c.summary,
    description: c.description,
    backgroundColor: c.backgroundColor,
    foregroundColor: c.foregroundColor,
    primary: !!c.primary,
    accessRole: c.accessRole
  }));
}

// Couleurs standards Google Calendar (colorId 1-11) — pour lookup côté client
const GOOGLE_EVENT_COLORS = {
  '1':  { name: 'Lavande',  background: '#7986CB' },
  '2':  { name: 'Sauge',    background: '#33B679' },
  '3':  { name: 'Raisin',   background: '#8E24AA' },
  '4':  { name: 'Flamant',  background: '#E67C73' },
  '5':  { name: 'Banane',   background: '#F6BF26' },
  '6':  { name: 'Mandarine',background: '#F4511E' },
  '7':  { name: 'Paon',     background: '#039BE5' },
  '8':  { name: 'Graphite', background: '#616161' },
  '9':  { name: 'Myrtille', background: '#3F51B5' },
  '10': { name: 'Basilic',  background: '#0B8043' },
  '11': { name: 'Tomate',   background: '#D50000' }
};

// Bornes "aujourd'hui" dans la timezone du serveur
function todayBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

// Cache simple par (calendarId, colorId) avec TTL ~5 min
const eventsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function listEventsForToday(calendarId, colorId, redirectUri) {
  const cacheKey = `${calendarId}::${colorId || 'all'}`;
  const cached = eventsCache.get(cacheKey);
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return { events: cached.events, cached: true, fetchedAt: cached.fetchedAt };
  }

  const cfg = readConfig();
  if (!cfg.refreshToken) {
    const err = new Error('Non connecté à Google');
    err.code = 'NOT_CONNECTED';
    throw err;
  }
  const client = buildOAuth2Client(redirectUri);
  const calendar = google.calendar({ version: 'v3', auth: client });
  const { start, end } = todayBounds();
  const { data } = await calendar.events.list({
    calendarId,
    timeMin: start,
    timeMax: end,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50
  });
  let items = data.items || [];
  if (colorId) {
    items = items.filter(ev => String(ev.colorId) === String(colorId));
  }
  const events = items.map(ev => ({
    id: ev.id,
    summary: ev.summary || '(sans titre)',
    description: ev.description || '',
    location: ev.location || '',
    start: ev.start?.dateTime || ev.start?.date || null,
    end: ev.end?.dateTime || ev.end?.date || null,
    allDay: !ev.start?.dateTime, // si pas de dateTime → événement journée entière
    colorId: ev.colorId || null
  }));
  eventsCache.set(cacheKey, { events, fetchedAt: Date.now() });
  return { events, cached: false, fetchedAt: Date.now() };
}

function invalidateCache() { eventsCache.clear(); }

module.exports = {
  setCredentials, disconnect, getStatus,
  getAuthUrl, exchangeCodeForTokens,
  listCalendars, listEventsForToday,
  invalidateCache,
  GOOGLE_EVENT_COLORS,
  SCOPES
};
