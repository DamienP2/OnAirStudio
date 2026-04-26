// Helpers pour lire les dimensions natives d'une image et calculer une taille
// "raisonnable" sur le canvas en respectant le ratio natif.

const MAX_DIMENSION_DEFAULT = 600;

// Renvoie une promesse qui résout avec { width, height } natives de l'image.
// En cas d'erreur (image inaccessible), résout avec un fallback.
export function loadImageNaturalSize(src, fallback = { width: 300, height: 200 }) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || fallback.width, height: img.naturalHeight || fallback.height });
    img.onerror = () => resolve(fallback);
    img.src = src;
  });
}

// Ajuste les dimensions pour ne pas dépasser MAX dans aucune direction tout en
// préservant le ratio natif. Retourne { width, height } arrondis.
export function fitDimensions(natural, max = MAX_DIMENSION_DEFAULT) {
  let { width, height } = natural;
  if (!width || !height) return natural;
  if (width > max || height > max) {
    const scale = max / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  return { width, height };
}

// Recalcule height en préservant la WIDTH courante selon le nouveau ratio.
// Choix : la largeur est l'axe que l'utilisateur règle le plus souvent dans
// une mise en page broadcast (rangées horizontales, colonnes alignées) — la
// préserver évite que le template "saute" quand on remplace une image.
// `currentHeight` est gardé dans la signature pour compatibilité API mais ignoré.
export function reshapeToRatio(currentWidth, _currentHeight, ratio) {
  const w = currentWidth || 300;
  if (!ratio || !isFinite(ratio) || ratio <= 0) return { width: w, height: w };
  return { width: w, height: Math.round(w / ratio) };
}
