// Charge les templates "factory" depuis server/src/factory-templates/*.json.
// Ces templates servent de modèles de base dans le modal "Nouveau template" :
// l'utilisateur peut les sélectionner comme point de départ, et l'app crée
// alors une copie indépendante dans sa liste de templates utilisateurs.
//
// Les fichiers sont rechargés à chaque appel (peu nombreux, pas de cache
// nécessaire — facilite l'ajout/édition pendant le dev sans redémarrage).

const fs = require('fs');
const path = require('path');

const FACTORY_DIR = path.join(__dirname, 'factory-templates');

// Identifiants stables qu'on expose au client (slug du nom de fichier).
// Le client renvoie ce slug quand il veut cloner un factory.
function listFactoryTemplates() {
  if (!fs.existsSync(FACTORY_DIR)) return [];
  const files = fs.readdirSync(FACTORY_DIR).filter(f => f.endsWith('.json'));
  const out = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(FACTORY_DIR, file), 'utf8');
      const tpl = JSON.parse(raw);
      const slug = file.replace(/\.json$/, '');
      out.push({
        slug,
        name: tpl.name || slug,
        description: tpl.description || '',
        category: tpl.category === 'veille' ? 'veille' : 'horloge',
        canvas: tpl.canvas || null,
        objectsCount: Array.isArray(tpl.objects) ? tpl.objects.length : 0
      });
    } catch (e) {
      console.warn(`[factory-templates] ${file} illisible:`, e.message);
    }
  }
  return out;
}

// Renvoie le contenu COMPLET d'un factory (canvas + objects) pour cloner.
function getFactoryTemplate(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9_-]+$/i.test(slug)) return null;
  const file = path.join(FACTORY_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const tpl = JSON.parse(raw);
    return {
      name: tpl.name || slug,
      category: tpl.category === 'veille' ? 'veille' : 'horloge',
      canvas: tpl.canvas || null,
      objects: Array.isArray(tpl.objects) ? tpl.objects : []
    };
  } catch (e) {
    console.warn(`[factory-templates] read ${slug}:`, e.message);
    return null;
  }
}

module.exports = { listFactoryTemplates, getFactoryTemplate };
