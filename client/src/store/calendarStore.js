import { getStoredAdminPassword } from '../components/AdminAuthGate';

// Le mot de passe admin est envoyé sous la clé `adminPassword` pour ne pas
// entrer en collision avec d'autres champs `password` métier (ex: Apple
// CalDAV app-specific password) qui sont passés via `extra`.
function authBody(extra = {}) { return { adminPassword: getStoredAdminPassword(), ...extra }; }

async function parseJsonOrError(res) {
  if (res.ok) return res.json();
  try {
    const data = await res.json();
    throw new Error(data.error || `HTTP ${res.status}`);
  } catch {
    throw new Error(`HTTP ${res.status}`);
  }
}

// ── Credentials OAuth (Google, Microsoft) ─────────────────────────────────

export async function apiGetCalendarCredentials() {
  const res = await fetch('/api/calendar/credentials/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody())
  });
  return parseJsonOrError(res);
}

export async function apiSetCalendarCredentials(provider, { clientId, clientSecret, tenant }) {
  const res = await fetch('/api/calendar/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody({ provider, clientId, clientSecret, tenant }))
  });
  return parseJsonOrError(res);
}

// ── Comptes connectés ─────────────────────────────────────────────────────

export async function apiListCalendarAccounts() {
  const res = await fetch('/api/calendar/accounts/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody())
  });
  return parseJsonOrError(res);
}

export async function apiDeleteCalendarAccount(id) {
  const res = await fetch('/api/calendar/accounts/' + id, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody())
  });
  return parseJsonOrError(res);
}

export async function apiRefreshCalendarAccount(id) {
  const res = await fetch('/api/calendar/accounts/' + id + '/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody())
  });
  return parseJsonOrError(res);
}

export async function apiRenameCalendarAccount(id, label) {
  const res = await fetch('/api/calendar/accounts/' + id + '/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody({ label }))
  });
  return parseJsonOrError(res);
}

// ── Flow OAuth Google / Microsoft ─────────────────────────────────────────
// Le redirect_uri est calculé côté client avec window.location.origin et envoyé
// au serveur — comme ça l'URL affichée dans le UI Calendriers (à coller dans
// la console OAuth) est strictement la même que celle envoyée au provider.

function buildRedirectUri(provider) {
  return `${window.location.origin}/api/calendar/${provider}/callback`;
}

export async function apiAuthorizeGoogle() {
  const res = await fetch('/api/calendar/google/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody({ redirectUri: buildRedirectUri('google') }))
  });
  return parseJsonOrError(res); // { url }
}

export async function apiAuthorizeMicrosoft() {
  const res = await fetch('/api/calendar/microsoft/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody({ redirectUri: buildRedirectUri('microsoft') }))
  });
  return parseJsonOrError(res); // { url }
}

// ── Apple CalDAV — connexion directe avec login + app-specific password ───

export async function apiConnectApple({ username, password, label, serverUrl }) {
  const res = await fetch('/api/calendar/apple/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody({ username, password, label, serverUrl }))
  });
  return parseJsonOrError(res);
}

// ── Events (lecture publique : utilisé par PlanningObject) ────────────────

export async function apiCalendarEvents({ accountId, range = 'today' }) {
  const params = new URLSearchParams({ accountId, range });
  const res = await fetch('/api/calendar/v2/events?' + params.toString());
  return parseJsonOrError(res);
}
