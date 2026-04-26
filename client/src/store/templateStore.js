import { getStoredAdminPassword } from '../components/AdminAuthGate';

const base = '';

function authBody(extra = {}) {
  // Clé `adminPassword` (au lieu de `password`) pour éviter les collisions
  // avec d'autres champs métier que les endpoints peuvent recevoir
  // (ex: Apple iCloud app-specific password sur /api/calendar/apple/connect).
  return { adminPassword: getStoredAdminPassword(), ...extra };
}

async function parseJsonOrError(res) {
  if (res.ok) return res.json();
  try {
    const data = await res.json();
    throw new Error(data.error || `HTTP ${res.status}`);
  } catch {
    throw new Error(`HTTP ${res.status}`);
  }
}

export async function apiList() {
  const res = await fetch(base + '/api/templates/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody())
  });
  return parseJsonOrError(res);
}

export async function apiGet(id) {
  const res = await fetch(base + '/api/templates/' + id + '/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody())
  });
  return parseJsonOrError(res);
}

// `factorySlug` (optionnel) → clone le contenu du modèle factory correspondant.
// Le serveur lit factory-templates/<slug>.json et copie canvas + objects dans
// le nouveau template (avec un nouvel id et le `name` choisi par l'utilisateur).
export async function apiCreate({ name, canvas, factorySlug }) {
  const res = await fetch(base + '/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody({ name, canvas, factorySlug }))
  });
  return parseJsonOrError(res);
}

// Liste des modèles factory disponibles (public, pas d'auth requise).
export async function apiListFactoryTemplates() {
  const res = await fetch(base + '/api/templates/factory');
  return parseJsonOrError(res);
}

export async function apiUpdate(id, patch) {
  const res = await fetch(base + '/api/templates/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody(patch))
  });
  return parseJsonOrError(res);
}

export async function apiDelete(id) {
  const res = await fetch(base + '/api/templates/' + id, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody())
  });
  return parseJsonOrError(res);
}

// mode: 'running' | 'stopped' | undefined (undefined = active sur les deux modes — legacy)
// active: true → activer pour ce mode ; false → désactiver si c'est ce template qui est actif
export async function apiActivate(id, { mode, active = true } = {}) {
  const res = await fetch(base + '/api/templates/' + id + '/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody({ mode, active }))
  });
  return parseJsonOrError(res);
}

export async function apiUploadImage(file) {
  const fd = new FormData();
  fd.append('password', getStoredAdminPassword());
  fd.append('file', file);
  const res = await fetch(base + '/api/uploads', { method: 'POST', body: fd });
  return parseJsonOrError(res);
}

export async function apiListUploads() {
  const res = await fetch(base + '/api/uploads/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody())
  });
  return parseJsonOrError(res);
}

export async function apiDeleteUpload(assetId) {
  const res = await fetch(base + '/api/uploads/' + assetId, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody())
  });
  return parseJsonOrError(res);
}

// ---- Admin / Reset ----

export async function apiResetTemplates() {
  const res = await fetch(base + '/api/admin/reset/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody())
  });
  return parseJsonOrError(res);
}

export async function apiResetSettings() {
  const res = await fetch(base + '/api/admin/reset/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody())
  });
  return parseJsonOrError(res);
}

// Test direct d'un canal du relais (latch) — utile pour vérifier le câblage
// depuis Réglages sans passer par le bouton ON AIR.
export async function apiTestRelay(channel, state) {
  const res = await fetch(base + '/api/admin/relay/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...authBody(), channel, state })
  });
  return parseJsonOrError(res);
}

// Réinitialisation totale : settings + templates + uploads + logo personnalisé.
// Conserve uniquement le mot de passe admin.
export async function apiResetAll() {
  const res = await fetch(base + '/api/admin/reset/all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody())
  });
  return parseJsonOrError(res);
}

// ---- Admin / Branding ----

export async function apiChangeAdminPassword(newPassword) {
  const res = await fetch(base + '/api/admin/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody({ newPassword }))
  });
  return parseJsonOrError(res);
}

export async function apiUploadLogo(file) {
  const fd = new FormData();
  fd.append('password', getStoredAdminPassword());
  fd.append('file', file);
  const res = await fetch(base + '/api/branding/logo', { method: 'POST', body: fd });
  return parseJsonOrError(res);
}

export async function apiDeleteLogo() {
  const res = await fetch(base + '/api/branding/logo', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody())
  });
  return parseJsonOrError(res);
}


