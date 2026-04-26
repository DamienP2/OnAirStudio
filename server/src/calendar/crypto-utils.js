// Chiffrement AES-256-GCM pour les tokens OAuth et passwords CalDAV.
// La clé maître est stockée dans server/src/.encryption-key (chmod 600),
// générée automatiquement au premier démarrage si absente.
//
// Format du ciphertext (encodé base64) : [iv (12B) | tag (16B) | ciphertext]

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, '..', '.encryption-key');
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey = null;

function loadOrCreateKey() {
  if (cachedKey) return cachedKey;
  if (fs.existsSync(KEY_FILE)) {
    const raw = fs.readFileSync(KEY_FILE);
    if (raw.length === 32) { cachedKey = raw; return cachedKey; }
    // Format legacy possible (hex) → re-décode
    const hex = raw.toString('utf8').trim();
    if (/^[0-9a-f]{64}$/i.test(hex)) {
      cachedKey = Buffer.from(hex, 'hex');
      return cachedKey;
    }
    throw new Error('Clé de chiffrement invalide dans .encryption-key');
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });
  try { fs.chmodSync(KEY_FILE, 0o600); } catch {}
  cachedKey = key;
  return key;
}

function encrypt(plain) {
  if (plain == null) return null;
  const key = loadOrCreateKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(b64) {
  if (b64 == null || b64 === '') return null;
  const key = loadOrCreateKey();
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) throw new Error('Ciphertext trop court');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

// Signature HMAC pour le `state` OAuth (anti-CSRF + porteur de payload court).
// Format : base64url(payloadJson) + '.' + base64url(hmac)
function signState(payload) {
  const key = loadOrCreateKey();
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', key).update(json).digest('base64url');
  return `${json}.${mac}`;
}

function verifyState(state) {
  if (typeof state !== 'string' || !state.includes('.')) return null;
  // lastIndexOf : split sur le DERNIER point pour gérer un payload qui contiendrait
  // un point (ne devrait pas arriver avec base64url mais latent).
  const dotIdx = state.lastIndexOf('.');
  const json = state.slice(0, dotIdx);
  const mac = state.slice(dotIdx + 1);
  const key = loadOrCreateKey();
  const expected = crypto.createHmac('sha256', key).update(json).digest('base64url');
  if (mac !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(json, 'base64url').toString('utf8'));
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

module.exports = { encrypt, decrypt, signState, verifyState };
