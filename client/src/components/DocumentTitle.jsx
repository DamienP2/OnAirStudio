import { useEffect } from 'react';
import { useTimerState } from '../store/TimerContext';

// Met à jour dynamiquement document.title en fonction du nom du studio et de la page.
// Format : "OnAir Studio - [studioName] - [pageLabel]"
// Si studioName absent ou égal à "OnAir Studio" (valeur par défaut), on simplifie.
export default function DocumentTitle({ page }) {
  const { studioName } = useTimerState();
  useEffect(() => {
    const hasStudio = studioName && studioName !== 'OnAir Studio';
    const parts = ['OnAir Studio'];
    if (hasStudio) parts.push(studioName);
    if (page) parts.push(page);
    document.title = parts.join(' - ');
  }, [studioName, page]);
  return null;
}
