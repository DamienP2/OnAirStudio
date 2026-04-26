import { getStoredAdminPassword } from '../components/AdminAuthGate';

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

// ── NDI ────────────────────────────────────────────────────────────────────

export async function apiNdiStatus() {
  const res = await fetch('/api/video/ndi/status');
  return parseJsonOrError(res);
}

export async function apiNdiSources() {
  const res = await fetch('/api/video/ndi/sources');
  return parseJsonOrError(res);
}

export async function apiNdiStart(sourceName) {
  const res = await fetch('/api/video/ndi/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody({ sourceName }))
  });
  return parseJsonOrError(res);
}

// ── SDI / Decklink ────────────────────────────────────────────────────────

export async function apiSdiStatus() {
  const res = await fetch('/api/video/sdi/status');
  return parseJsonOrError(res);
}
