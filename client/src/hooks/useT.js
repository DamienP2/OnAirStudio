import { useTimerState } from '../store/TimerContext';
import { t as translate } from '../i18n';

// Hook : retourne une fonction t(key, params) liée à la langue courante.
// La langue est lue depuis TimerContext.language (mis à jour par settingsUpdate).
export function useT() {
  const { language } = useTimerState();
  return (key, params) => translate(language || 'fr', key, params);
}

// Helper utile : retourne directement la langue courante
export function useLang() {
  const { language } = useTimerState();
  return language || 'fr';
}

// Hook : retourne un helper `tr({ fr, en })` qui pioche la valeur selon la
// langue courante. Pratique pour des chaînes UI ponctuelles non couvertes
// par i18n.js (modals locaux, tooltips, hints…). Fallback sur fr si en manque.
export function useTr() {
  const { language } = useTimerState();
  return (obj) => (obj && (obj[language || 'fr'] || obj.fr || '')) || '';
}
