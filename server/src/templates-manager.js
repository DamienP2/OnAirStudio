const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const INDEX_FILE = path.join(TEMPLATES_DIR, 'index.json');

function ensureDir() {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  }
}

function writeIndex(idx) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2));
}

// Catégorie par défaut si absente — voir notes plus haut.
function normalizeCategory(c) {
  return c === 'veille' ? 'veille' : 'horloge';
}

function readIndex() {
  if (!fs.existsSync(INDEX_FILE)) {
    return { activeRunningTemplateId: null, activeStoppedTemplateId: null, templates: [] };
  }
  const idx = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  // Migration douce : legacy `activeTemplateId` → running + stopped
  if (idx.activeTemplateId !== undefined) {
    if (idx.activeRunningTemplateId === undefined) idx.activeRunningTemplateId = idx.activeTemplateId;
    if (idx.activeStoppedTemplateId === undefined) idx.activeStoppedTemplateId = idx.activeTemplateId;
    delete idx.activeTemplateId;
    writeIndex(idx);
  }
  if (idx.activeRunningTemplateId === undefined) idx.activeRunningTemplateId = null;
  if (idx.activeStoppedTemplateId === undefined) idx.activeStoppedTemplateId = null;
  if (!Array.isArray(idx.templates)) idx.templates = [];
  // Migration : tout template dont la catégorie n'est pas définie devient
  // 'horloge' (mode broadcast principal — voir spec utilisateur).
  for (const t of idx.templates) {
    if (t.category !== 'horloge' && t.category !== 'veille') t.category = 'horloge';
  }
  return idx;
}

function slugify(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60) || `template-${Date.now()}`;
}

function uniqueId(baseSlug) {
  ensureDir();
  let id = baseSlug;
  let n = 1;
  while (fs.existsSync(path.join(TEMPLATES_DIR, `${id}.json`))) {
    id = `${baseSlug}-${++n}`;
  }
  return id;
}

function listTemplates() {
  ensureDir();
  const idx = readIndex();
  return {
    activeRunningTemplateId: idx.activeRunningTemplateId,
    activeStoppedTemplateId: idx.activeStoppedTemplateId,
    templates: idx.templates
  };
}

function getTemplate(id) {
  const file = path.join(TEMPLATES_DIR, `${id}.json`);
  // Garde anti path traversal : refuse les ids qui résolvent hors de TEMPLATES_DIR
  // (ex. id="../../etc/passwd"). Les routes appelantes sont déjà protégées par
  // requireAdminPassword mais on durcit ici par défense en profondeur.
  if (!file.startsWith(TEMPLATES_DIR + path.sep)) return null;
  if (!fs.existsSync(file)) return null;
  const t = JSON.parse(fs.readFileSync(file, 'utf8'));
  // Migration douce : si pas de catégorie dans le JSON, on retombe sur 'horloge'.
  t.category = normalizeCategory(t.category);
  return t;
}

function writeTemplateFile(template) {
  ensureDir();
  const file = path.join(TEMPLATES_DIR, `${template.id}.json`);
  fs.writeFileSync(file, JSON.stringify(template, null, 2));
}

function createTemplate({ name, canvas, objects, category }) {
  const id = uniqueId(slugify(name));
  const now = new Date().toISOString();
  const cat = normalizeCategory(category);
  const template = {
    id, name,
    category: cat,
    canvas: canvas || { width: 1920, height: 1080, backgroundColor: '#000000', backgroundImage: null },
    objects: Array.isArray(objects) ? objects : [],
    createdAt: now, updatedAt: now
  };
  writeTemplateFile(template);
  const idx = readIndex();
  idx.templates.push({ id, name, category: cat, updatedAt: now });
  // Auto-active sur le slot correspondant à la catégorie si aucun template
  // n'y est encore assigné. (Chaque catégorie alimente un slot.)
  if (cat === 'horloge' && !idx.activeRunningTemplateId) idx.activeRunningTemplateId = id;
  if (cat === 'veille' && !idx.activeStoppedTemplateId) idx.activeStoppedTemplateId = id;
  writeIndex(idx);
  return template;
}

function updateTemplate(id, patch) {
  const existing = getTemplate(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...patch,
    id,
    category: normalizeCategory(patch.category ?? existing.category),
    updatedAt: new Date().toISOString()
  };
  writeTemplateFile(updated);
  const idx = readIndex();
  const entry = idx.templates.find(t => t.id === id);
  if (entry) {
    entry.name = updated.name;
    entry.category = updated.category;
    entry.updatedAt = updated.updatedAt;
    // Si la catégorie a changé et que ce template était actif sur un slot
    // incompatible, on le retire pour éviter une incohérence (ex: template
    // "veille" actif sur slot running après changement).
    if (updated.category === 'veille' && idx.activeRunningTemplateId === id) {
      idx.activeRunningTemplateId = null;
    }
    if (updated.category === 'horloge' && idx.activeStoppedTemplateId === id) {
      idx.activeStoppedTemplateId = null;
    }
    writeIndex(idx);
  }
  return updated;
}

function deleteTemplate(id) {
  const idx = readIndex();
  if (idx.activeRunningTemplateId === id || idx.activeStoppedTemplateId === id) {
    const err = new Error('cannot delete template active in at least one mode');
    err.code = 'ACTIVE_TEMPLATE';
    throw err;
  }
  const file = path.join(TEMPLATES_DIR, `${id}.json`);
  if (!file.startsWith(TEMPLATES_DIR + path.sep)) return false;
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  idx.templates = idx.templates.filter(t => t.id !== id);
  writeIndex(idx);
  return true;
}

// mode: 'running' | 'stopped'
// active: true → activer ce template pour ce mode (remplace le précédent)
// active: false → désactiver si c'est ce template qui est actif
function setActiveForMode(id, mode, active = true) {
  if (mode !== 'running' && mode !== 'stopped') {
    const err = new Error(`invalid mode: ${mode}`);
    err.code = 'INVALID_MODE';
    throw err;
  }
  const t = getTemplate(id);
  if (!t) return null;
  // Validation catégorie : un template ne peut être activé que sur le slot
  // correspondant à sa catégorie. running ↔ horloge, stopped ↔ veille.
  if (active) {
    const cat = normalizeCategory(t.category);
    const expected = mode === 'running' ? 'horloge' : 'veille';
    if (cat !== expected) {
      const err = new Error(`template category "${cat}" cannot be activated on slot "${mode}"`);
      err.code = 'CATEGORY_MISMATCH';
      throw err;
    }
  }
  const key = mode === 'running' ? 'activeRunningTemplateId' : 'activeStoppedTemplateId';
  const idx = readIndex();
  if (active) {
    idx[key] = id;
  } else if (idx[key] === id) {
    idx[key] = null;
  }
  writeIndex(idx);
  return {
    id,
    mode,
    activeRunningTemplateId: idx.activeRunningTemplateId,
    activeStoppedTemplateId: idx.activeStoppedTemplateId
  };
}

function getActiveTemplateIdForMode(mode) {
  const idx = readIndex();
  return mode === 'running' ? idx.activeRunningTemplateId : idx.activeStoppedTemplateId;
}

function getActiveTemplateForMode(mode) {
  const id = getActiveTemplateIdForMode(mode);
  if (!id) return null;
  return getTemplate(id);
}

// Supprime TOUS les templates utilisateurs et réinitialise l'index.
// Ne touche pas aux fichiers factory dans server/src/factory-templates/.
function deleteAllTemplates() {
  ensureDir();
  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
  let deleted = 0;
  for (const file of files) {
    try { fs.unlinkSync(path.join(TEMPLATES_DIR, file)); deleted++; }
    catch (e) { console.warn(`[templates] delete ${file}:`, e.message); }
  }
  writeIndex({ activeRunningTemplateId: null, activeStoppedTemplateId: null, templates: [] });
  return deleted;
}

module.exports = {
  listTemplates, getTemplate, createTemplate, updateTemplate,
  deleteTemplate, deleteAllTemplates, setActiveForMode,
  getActiveTemplateIdForMode, getActiveTemplateForMode,
  TEMPLATES_DIR, INDEX_FILE
};
