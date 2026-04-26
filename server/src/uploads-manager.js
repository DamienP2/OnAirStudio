const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const INDEX_FILE = path.join(UPLOADS_DIR, 'index.json');
const ALLOWED_MIMETYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
  // Vidéos pour le widget Vidéo (formats lisibles nativement par les browsers modernes)
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
];
// Taille max — 200 Mo pour permettre des vidéos courtes (jingle, idents, transitions).
const MAX_BYTES = 200 * 1024 * 1024;
const VIDEO_MIMETYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

function ensureDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readIndex() {
  ensureDir();
  if (!fs.existsSync(INDEX_FILE)) return {};
  return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
}

function writeIndex(idx) { fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2)); }

function extFromMime(m) {
  return {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogv', 'video/quicktime': '.mov'
  }[m];
}

function kindOf(mimetype) {
  return VIDEO_MIMETYPES.includes(mimetype) ? 'video' : 'image';
}

function listAssets() {
  return readIndex();
}

function saveAsset({ buffer, originalName, mimetype }) {
  if (!ALLOWED_MIMETYPES.includes(mimetype)) {
    const err = new Error(`mimetype '${mimetype}' not allowed`);
    err.code = 'BAD_MIMETYPE';
    throw err;
  }
  if (buffer.length > MAX_BYTES) {
    const err = new Error('file too large');
    err.code = 'TOO_LARGE';
    throw err;
  }
  ensureDir();
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext = extFromMime(mimetype);
  const filename = `${hash}${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) fs.writeFileSync(filepath, buffer);
  const assetId = hash.slice(0, 16);
  const idx = readIndex();
  idx[assetId] = {
    filename, path: `server/src/uploads/${filename}`,
    originalName, mimetype, sizeBytes: buffer.length,
    kind: kindOf(mimetype),
    uploadedAt: new Date().toISOString()
  };
  writeIndex(idx);
  return { assetId, url: `/uploads/${filename}`, ...idx[assetId] };
}

function deleteAsset(assetId) {
  const idx = readIndex();
  const asset = idx[assetId];
  if (!asset) return false;
  const filepath = path.join(UPLOADS_DIR, asset.filename);
  // Garde anti path traversal : refuse un filename qui résoudrait hors d'UPLOADS_DIR
  // (durcit contre une corruption éventuelle de l'index).
  if (!filepath.startsWith(UPLOADS_DIR + path.sep)) return false;
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  delete idx[assetId];
  writeIndex(idx);
  return true;
}

// Supprime tous les fichiers physiques + remet l'index à zéro. Utilisé par les
// endpoints de reset (Réglages → Réinitialisation).
function deleteAllAssets() {
  ensureDir();
  let count = 0;
  for (const entry of fs.readdirSync(UPLOADS_DIR)) {
    if (entry === 'index.json') continue;
    const p = path.join(UPLOADS_DIR, entry);
    try { fs.unlinkSync(p); count++; } catch { /* ignore */ }
  }
  writeIndex({});
  return count;
}

module.exports = {
  listAssets, saveAsset, deleteAsset, deleteAllAssets,
  UPLOADS_DIR, MAX_BYTES, ALLOWED_MIMETYPES, VIDEO_MIMETYPES,
  kindOf
};
