// Persistance des credentials OAuth (par provider) et des comptes connectés
// (par compte). Tous les secrets sont chiffrés via crypto-utils.
//
// Fichiers JSON :
//   server/src/calendar-credentials.json    — credentials OAuth (client_id/secret par provider)
//   server/src/calendar-accounts.json       — liste des comptes connectés (tokens chiffrés)

const fs = require('fs');
const path = require('path');
const { encrypt, decrypt } = require('./crypto-utils');

const CREDS_FILE = path.join(__dirname, '..', 'calendar-credentials.json');
const ACCOUNTS_FILE = path.join(__dirname, '..', 'calendar-accounts.json');

// ── Credentials OAuth (Google, Microsoft) ──────────────────────────────────
// { google:    { clientId, clientSecret(enc) },
//   microsoft: { clientId, clientSecret(enc), tenant } }
//
// Apple n'a pas de credentials globaux : chaque compte CalDAV porte ses propres creds.

function readCredentials() {
  if (!fs.existsSync(CREDS_FILE)) return { google: null, microsoft: null };
  try {
    const raw = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
    return {
      google: raw.google || null,
      microsoft: raw.microsoft || null
    };
  } catch (e) {
    console.error('[calendar] credentials illisibles:', e.message);
    return { google: null, microsoft: null };
  }
}

function writeCredentials(creds) {
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2), 'utf8');
  try { fs.chmodSync(CREDS_FILE, 0o600); } catch {}
}

function getCredentials(provider) {
  const all = readCredentials();
  const c = all[provider];
  if (!c) return null;
  return {
    clientId: c.clientId,
    clientSecret: c.clientSecretEnc ? decrypt(c.clientSecretEnc) : null,
    tenant: c.tenant || null
  };
}

function setCredentials(provider, { clientId, clientSecret, tenant }) {
  const all = readCredentials();
  if (!clientId) {
    delete all[provider];
  } else {
    all[provider] = {
      clientId,
      clientSecretEnc: clientSecret ? encrypt(clientSecret) : null,
      tenant: tenant || null
    };
  }
  writeCredentials(all);
}

// `getCredentialsPublic` ne renvoie pas le secret en clair — pour le UI Settings.
function getCredentialsPublic() {
  const all = readCredentials();
  return {
    google:    all.google    ? { clientId: all.google.clientId,    hasSecret: !!all.google.clientSecretEnc } : null,
    microsoft: all.microsoft ? { clientId: all.microsoft.clientId, hasSecret: !!all.microsoft.clientSecretEnc, tenant: all.microsoft.tenant || 'common' } : null
  };
}

// ── Comptes connectés ──────────────────────────────────────────────────────
// Compte = un calendrier d'utilisateur qu'on peut interroger.
// {
//   id, provider: 'google'|'microsoft'|'apple',
//   label,                                 // libellé personnalisé par l'admin
//   accountEmail,                          // email/login récupéré au moment de la connexion
//   tokensEnc,                             // tokens chiffrés (provider-specific)
//   calendars: [{id, name, color, primary, source}]  // dernière liste vue
//   lastSyncAt,                            // ISO string
//   lastError                              // {message, at}
// }

function readAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
    if (!Array.isArray(raw)) return [];
    return raw;
  } catch (e) {
    console.error('[calendar] accounts illisibles:', e.message);
    return [];
  }
}

function writeAccounts(list) {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(list, null, 2), 'utf8');
  try { fs.chmodSync(ACCOUNTS_FILE, 0o600); } catch {}
}

function listAccounts() {
  return readAccounts().map(stripSecrets);
}

function getAccount(id) {
  return readAccounts().find(a => a.id === id) || null;
}

function getAccountWithTokens(id) {
  const a = getAccount(id);
  if (!a) return null;
  return { ...a, tokens: a.tokensEnc ? JSON.parse(decrypt(a.tokensEnc)) : null };
}

function saveAccount(account) {
  const list = readAccounts();
  const i = list.findIndex(a => a.id === account.id);
  if (i >= 0) list[i] = account;
  else list.push(account);
  writeAccounts(list);
}

function deleteAccount(id) {
  const list = readAccounts().filter(a => a.id !== id);
  writeAccounts(list);
}

// Supprime tous les comptes connectés (accounts.json) — utilisé par les
// endpoints reset (Réglages → Réinitialisation).
function deleteAllAccounts() {
  const before = readAccounts().length;
  if (fs.existsSync(ACCOUNTS_FILE)) fs.unlinkSync(ACCOUNTS_FILE);
  return before;
}

// Supprime les credentials OAuth (Google/Microsoft) — utilisé par
// "Tout réinitialiser" pour purger aussi la configuration provider.
function deleteAllCredentials() {
  if (fs.existsSync(CREDS_FILE)) fs.unlinkSync(CREDS_FILE);
}

// Met à jour les tokens d'un compte (après refresh OAuth).
function updateTokens(accountId, tokens) {
  const list = readAccounts();
  const i = list.findIndex(a => a.id === accountId);
  if (i < 0) return;
  list[i].tokensEnc = encrypt(JSON.stringify(tokens));
  writeAccounts(list);
}

function setAccountSync(accountId, { calendars, lastSyncAt, lastError }) {
  const list = readAccounts();
  const i = list.findIndex(a => a.id === accountId);
  if (i < 0) return;
  if (calendars !== undefined) list[i].calendars = calendars;
  if (lastSyncAt !== undefined) list[i].lastSyncAt = lastSyncAt;
  if (lastError !== undefined) list[i].lastError = lastError;
  writeAccounts(list);
}

function stripSecrets(a) {
  const { tokensEnc, ...rest } = a;
  return rest;
}

function newAccountId(provider) {
  return `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

module.exports = {
  // Credentials
  getCredentials, setCredentials, getCredentialsPublic, deleteAllCredentials,
  // Accounts
  listAccounts, getAccount, getAccountWithTokens,
  saveAccount, deleteAccount, deleteAllAccounts,
  updateTokens, setAccountSync,
  newAccountId
};
