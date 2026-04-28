// Provider CalDAV (Apple iCloud principalement, mais compatible avec tout serveur CalDAV).
// - Auth : Basic Auth (Apple ID + app-specific password)
// - Discovery : PROPFIND sur principal-URL puis calendar-home-set
// - listEvents : REPORT calendar-query avec time-range
//
// On parse le XML manuellement (sans dep) — assez petit et structuré.
// Les VEVENT sont parsés via node-ical (déjà installé).
//
// iCloud entrypoints :
//   https://caldav.icloud.com/  (PROPFIND avec creds → 401 si OK demandera principal)
// Discovery moderne : POST principal-URL avec <propfind><prop><current-user-principal/>

const ical = require('node-ical');
const storage = require('../storage');
const { encrypt, decrypt } = require('../crypto-utils');
const { fetchWithTimeout } = require('../fetch-utils');

const ICLOUD_BASE = 'https://caldav.icloud.com';

// ── Auth helpers ────────────────────────────────────────────────────────────

function authHeader(username, password) {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

async function dav(url, { method, headers = {}, body, username, password, depth = '0' }) {
  const res = await fetchWithTimeout(url, {
    method,
    headers: {
      Authorization: authHeader(username, password),
      'Content-Type': 'application/xml; charset=utf-8',
      Depth: depth,
      Accept: 'application/xml',
      ...headers
    },
    body,
    redirect: 'follow'
  });
  return res;
}

// ── XML helpers minimalistes ────────────────────────────────────────────────
// On extrait les chemins href + propriétés simples par regex.
// Les serveurs iCloud ont un schéma stable et bien formaté.

function findAll(xml, tag) {
  // Capture le contenu de <tag>...</tag> (avec ou sans namespace prefix)
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function findFirst(xml, tag) {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`);
  const m = re.exec(xml);
  return m ? m[1] : null;
}

function attrOf(xml, tag, attr) {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const m = re.exec(xml);
  return m ? m[1] : null;
}

// ── Discovery ───────────────────────────────────────────────────────────────

async function discoverPrincipal(serverUrl, username, password) {
  const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal/>
  </d:prop>
</d:propfind>`;
  const res = await dav(serverUrl, {
    method: 'PROPFIND',
    body: propfindBody,
    username, password,
    depth: '0'
  });
  if (res.status >= 400) throw new Error(`PROPFIND principal : ${res.status}`);
  const xml = await res.text();

  // Le premier <href> du XML est celui du <response> = URL de la requête
  // (souvent "/"). Le vrai principal est l'href DANS le bloc
  // <current-user-principal>. Sans ce filtrage on récupère "/" et la
  // discovery échoue après.
  const principalBlock = findFirst(xml, 'current-user-principal');
  let href = principalBlock ? findFirst(principalBlock, 'href') : null;

  // Fallback : si le bloc n'est pas trouvé, chercher tous les hrefs et
  // prendre le premier qui pointe vers /principal/ (heuristique iCloud).
  if (!href) {
    const all = findAll(xml, 'href').map(h => h.trim());
    href = all.find(h => /\/principal\/?$/i.test(h)) || null;
  }

  if (!href) {
    console.error('[caldav] current-user-principal introuvable. XML reçu :', xml.slice(0, 800));
    throw new Error('current-user-principal introuvable');
  }
  return new URL(href.trim(), serverUrl).toString();
}

async function discoverCalendarHome(principalUrl, username, password) {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop>
</d:propfind>`;
  const res = await dav(principalUrl, {
    method: 'PROPFIND',
    body, username, password, depth: '0'
  });
  if (res.status >= 400) throw new Error(`PROPFIND calendar-home : ${res.status}`);
  const xml = await res.text();

  // 1er essai : extraire le bloc <calendar-home-set>...</calendar-home-set>
  // puis l'href interne. C'est la structure WebDAV standard.
  let homeBlock = findFirst(xml, 'calendar-home-set');
  let href = homeBlock ? findFirst(homeBlock, 'href') : null;

  // 2e essai : iCloud renvoie parfois un format où calendar-home-set est une
  // balise auto-fermée (<calendar-home-set/>) suivi d'un href dans le même
  // <prop>. On cherche alors le premier href du XML qui pointe vers /calendars/.
  if (!href) {
    const allHrefs = findAll(xml, 'href');
    href = allHrefs.find(h => /\/calendars\/?$/i.test(h.trim())) || null;
  }

  // 3e essai (fallback iCloud) : si on a un principal URL valide chez iCloud,
  // l'URL home suit le même hôte avec /<userId>/calendars/. On le déduit du
  // path du principalUrl (qui contient déjà le userId).
  if (!href && /icloud\.com/i.test(principalUrl)) {
    try {
      const u = new URL(principalUrl);
      // principalUrl ressemble à https://p123-caldav.icloud.com/12345678/principal/
      const m = u.pathname.match(/^\/(\d+)\//);
      if (m) {
        href = `${u.origin}/${m[1]}/calendars/`;
        console.warn('[caldav] calendar-home-set non trouvé dans le XML, fallback iCloud :', href);
      }
    } catch { /* ignore */ }
  }

  if (!href) {
    // Log du XML pour diagnostic (premières 800 chars seulement)
    console.error('[caldav] calendar-home-set introuvable. XML reçu :', xml.slice(0, 800));
    throw new Error('calendar-home-set introuvable');
  }

  return new URL(href.trim(), principalUrl).toString();
}

async function discoverCalendars(homeUrl, username, password) {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:ic="http://apple.com/ns/ical/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <c:supported-calendar-component-set/>
    <ic:calendar-color/>
    <cs:getctag/>
  </d:prop>
</d:propfind>`;
  const res = await dav(homeUrl, {
    method: 'PROPFIND', body, username, password, depth: '1'
  });
  if (res.status >= 400) throw new Error(`PROPFIND calendars : ${res.status}`);
  const xml = await res.text();
  // Chaque <d:response> contient un href + ses props
  const responses = findAll(xml, 'response');
  const calendars = [];
  for (const r of responses) {
    const href = findFirst(r, 'href');
    if (!href) continue;
    const calUrl = new URL(href.trim(), homeUrl).toString();
    const resourceType = findFirst(r, 'resourcetype') || '';
    if (!/calendar/i.test(resourceType)) continue;
    const supported = findFirst(r, 'supported-calendar-component-set') || '';
    if (!/VEVENT/i.test(supported)) continue;
    const name = findFirst(r, 'displayname') || calUrl.replace(/\/$/, '').split('/').pop();
    const color = findFirst(r, 'calendar-color') || '#0078D4';
    calendars.push({
      id: calUrl,
      name: decodeXml(name).trim(),
      color: color.length === 9 && color.startsWith('#') ? color.slice(0, 7) : color, // strip alpha si présent
      primary: false,
      source: 'apple'
    });
  }
  return calendars;
}

function decodeXml(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

// ── Connexion (test + storage) ──────────────────────────────────────────────

async function connect({ serverUrl, username, password }) {
  const base = serverUrl || ICLOUD_BASE;
  const principal = await discoverPrincipal(base, username, password);
  const home = await discoverCalendarHome(principal, username, password);
  const calendars = await discoverCalendars(home, username, password);
  return {
    accountEmail: username,
    homeUrl: home,
    calendars
  };
}

// ── Events ──────────────────────────────────────────────────────────────────

async function listCalendars(accountId) {
  const acc = storage.getAccountWithTokens(accountId);
  if (!acc || !acc.tokens) throw new Error('Compte CalDAV introuvable');
  const { username, password } = acc.tokens;
  const home = acc.tokens.homeUrl;
  return discoverCalendars(home, username, password);
}

function isoToCalDav(date) {
  // Format CalDAV : YYYYMMDDTHHMMSSZ (UTC)
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

async function fetchCalendarEvents(calendarUrl, username, password, timeMin, timeMax) {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${isoToCalDav(timeMin)}" end="${isoToCalDav(timeMax)}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
  const res = await dav(calendarUrl, {
    method: 'REPORT',
    body, username, password, depth: '1'
  });
  if (res.status >= 400) throw new Error(`REPORT events : ${res.status}`);
  const xml = await res.text();
  const responses = findAll(xml, 'response');
  const events = [];
  for (const r of responses) {
    const calData = findFirst(r, 'calendar-data');
    if (!calData) continue;
    const ics = decodeXml(calData).trim();
    try {
      const parsed = ical.sync.parseICS(ics);
      for (const k of Object.keys(parsed)) {
        const item = parsed[k];
        if (item && item.type === 'VEVENT') events.push(item);
      }
    } catch (e) {
      console.warn('[caldav] parse error:', e.message);
    }
  }
  return events;
}

async function listEvents(accountId, { calendarIds, timeMin, timeMax }) {
  const acc = storage.getAccountWithTokens(accountId);
  if (!acc || !acc.tokens) throw new Error('Compte CalDAV introuvable');
  const { username, password } = acc.tokens;
  const allCalendars = acc.calendars && acc.calendars.length ? acc.calendars : await listCalendars(accountId);
  const calMap = new Map(allCalendars.map(c => [c.id, c]));
  const targets = (calendarIds && calendarIds.length) ? calendarIds : allCalendars.map(c => c.id);

  const all = [];
  for (const calId of targets) {
    const cal = calMap.get(calId);
    if (!cal) continue;
    let raw;
    try {
      raw = await fetchCalendarEvents(calId, username, password, timeMin, timeMax);
    } catch (e) {
      console.warn(`[caldav] events ${cal.name}:`, e.message);
      continue;
    }
    // Expansion des récurrences dans la fenêtre
    for (const ev of raw) {
      if (ev.rrule) {
        const occurrences = ev.rrule.between(timeMin, timeMax, true);
        for (const occ of occurrences) {
          const dur = (ev.end?.getTime() || ev.start.getTime()) - ev.start.getTime();
          const occEnd = new Date(occ.getTime() + dur);
          all.push(normalizeEvent({ ...ev, start: occ, end: occEnd }, cal));
        }
      } else {
        const start = ev.start;
        if (!start) continue;
        const startTime = start.getTime();
        const endTime = (ev.end || ev.start).getTime();
        if (endTime < timeMin.getTime() || startTime > timeMax.getTime()) continue;
        all.push(normalizeEvent(ev, cal));
      }
    }
  }
  return all;
}

function normalizeEvent(ev, cal) {
  const allDay = ev.datetype === 'date' || (ev.start && ev.start.dateOnly);
  return {
    id: `${cal.id}#${ev.uid || Math.random()}#${ev.start ? new Date(ev.start).toISOString() : ''}`,
    calendarId: cal.id,
    calendarName: cal.name,
    calendarColor: cal.color,
    title: ev.summary || '(Sans titre)',
    description: ev.description || '',
    location: ev.location || '',
    start: ev.start ? new Date(ev.start).toISOString() : null,
    end:   ev.end   ? new Date(ev.end).toISOString()   : null,
    allDay,
    organizer: ev.organizer ? { email: cleanMailto(ev.organizer.val || ev.organizer), name: ev.organizer.params?.CN || '' } : null,
    attendees: parseAttendees(ev.attendee),
    status: (ev.status || 'CONFIRMED').toLowerCase(),
    url: ev.url || null,
    source: 'apple'
  };
}

function parseAttendees(att) {
  if (!att) return [];
  const arr = Array.isArray(att) ? att : [att];
  return arr.map(a => ({
    email: cleanMailto(a.val || a),
    name: (a.params && a.params.CN) || '',
    status: ((a.params && a.params.PARTSTAT) || 'NEEDS-ACTION').toLowerCase()
  }));
}

function cleanMailto(s) {
  return String(s || '').replace(/^mailto:/i, '');
}

// ── Tokens (creds CalDAV stockés chiffrés via le mécanisme tokens) ──────────

function buildTokens({ serverUrl, username, password, homeUrl }) {
  return { serverUrl: serverUrl || ICLOUD_BASE, username, password, homeUrl };
}

module.exports = {
  connect,
  buildTokens,
  listCalendars,
  listEvents
};
