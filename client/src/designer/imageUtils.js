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

// Recalcule width/height pour matcher un nouveau ratio en gardant la dimension
// principale (la plus grande) constante. Utile quand on change d'image dans
// un widget existant — on ne veut pas qu'il "saute" en taille.
export function reshapeToRatio(currentWidth, currentHeight, ratio) {
  const main = Math.max(currentWidth || 0, currentHeight || 0) || 300;
  if (ratio >= 1) {
    return { width: main, height: Math.round(main / ratio) };
  }
  return { width: Math.round(main * ratio), height: main };
}
