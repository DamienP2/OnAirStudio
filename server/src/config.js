const fs = require('fs');
const path = require('path');

// Valeurs par défaut (ne changent jamais)
const defaultConfig = {
  // Serveurs NTP (par ordre de préférence — fallback automatique si l'un échoue)
  ntpServers: ['pool.ntp.org', 'time.cloudflare.com', 'time.google.com'],
  // Legacy : ntpServer (string) — conservé pour rétrocompat avec custom-settings.json
  ntpServer: 'pool.ntp.org',

  // Couleurs par défaut
  defaultColors: {
    current: '#FFFFFF',  // Blanc pour l'heure actuelle
    elapsed: '#3B82F6',  // Bleu pour le temps écoulé
    remaining: '#EF4444' // Rouge pour le temps restant
  },

  // Durées prédéfinies (en minutes)
  defaultDurations: [
    { label: '12 min', value: '00:12:00' },
    { label: '26 min', value: '00:26:00' },
    { label: '52 min', value: '00:52:00' },
    { label: '90 min', value: '01:30:00' }

  ],



  // Nom du studio par défaut
  defaultStudioName: 'OnAir Studio',

  // Fuseau horaire (IANA) — utilisé par le client pour formater les heures
  defaultTimezone: 'Europe/Paris',

  // Langue UI (fr ou en) — i18n partielle pour l'instant
  defaultLanguage: 'fr',

  // Type de relais : 'usb' (par défaut, supporté) ou 'ethernet' (en cours de dev)
  defaultRelayType: 'usb',
  // IP du relais Ethernet — utilisé uniquement si defaultRelayType = 'ethernet'
  defaultRelayIp: '',
  // Nombre de canaux disponibles sur la carte relais physique. Le canal 1 est
  // toujours réservé à ON AIR ; les autres sont libres pour le test ou des
  // usages futurs (témoin studio actif, lampe accueil, etc.).
  defaultRelayChannels: 2,

  // Palette de couleurs partagée — couleurs par défaut adaptées au broadcast.
  // L'utilisateur peut tout supprimer/renommer/réorganiser via SettingsPanel.
  // Format : { id: string, name: string, value: '#RRGGBBAA' }
  // Ordre : neutres (clair → foncé) puis couleurs primaires broadcast.
  defaultColorPalette: [
    { id: 'p-white',  name: 'Blanc',       value: '#FFFFFFFF' },
    { id: 'p-grey',   name: 'Gris moyen',  value: '#71717AFF' }, // zinc-500, neutre
    { id: 'p-black',  name: 'Noir',        value: '#000000FF' },
    { id: 'p-red',    name: 'Rouge ON AIR', value: '#E11D48FF' }, // rouge broadcast vibrant
    { id: 'p-blue',   name: 'Bleu studio', value: '#0EA5E9FF' }   // sky-500, lisible et tech
  ]
};

// Fonction pour charger les paramètres personnalisés
function loadCustomSettings() {
  const customSettingsPath = path.join(__dirname, 'custom-settings.json');
  
  try {
    if (fs.existsSync(customSettingsPath)) {
      const customData = fs.readFileSync(customSettingsPath, 'utf8');
      return JSON.parse(customData);
    }
  } catch (error) {
    console.error('Erreur lors du chargement des paramètres personnalisés:', error);
  }
  
  // Retourner les valeurs par défaut si aucun fichier personnalisé
  return {
    ntpServer: defaultConfig.ntpServer,
    ntpServers: [...defaultConfig.ntpServers],
    studioName: defaultConfig.defaultStudioName,
    timezone: defaultConfig.defaultTimezone,
    language: defaultConfig.defaultLanguage,
    relayType: defaultConfig.defaultRelayType,
    relayIp: defaultConfig.defaultRelayIp,
    relayChannels: defaultConfig.defaultRelayChannels,
    defaultDisplayMode: defaultConfig.defaultDisplayMode,
    colors: { ...defaultConfig.defaultColors },
    presetTimes: [...defaultConfig.defaultDurations],
    colorPalette: [...defaultConfig.defaultColorPalette]
  };
}

// Fonction pour sauvegarder les paramètres personnalisés
function saveCustomSettings(settings) {
  const customSettingsPath = path.join(__dirname, 'custom-settings.json');
  
  try {
    fs.writeFileSync(customSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log('Paramètres personnalisés sauvegardés avec succès');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des paramètres personnalisés:', error);
  }
}

// Charger les paramètres actuels (personnalisés ou par défaut)
const currentSettings = loadCustomSettings();

module.exports = {
  // Valeurs par défaut (pour le bouton reset)
  ...defaultConfig,
  
  // Valeurs actuelles (personnalisées ou par défaut)
  ntpServer: currentSettings.ntpServer,
  // ntpServers : si la liste n'existe pas dans custom-settings (legacy), on construit
  // à partir du ntpServer unique en fallback sur les défauts.
  ntpServers: Array.isArray(currentSettings.ntpServers) && currentSettings.ntpServers.length > 0
    ? currentSettings.ntpServers
    : (currentSettings.ntpServer
        ? [currentSettings.ntpServer, ...defaultConfig.ntpServers.filter(s => s !== currentSettings.ntpServer)].slice(0, 3)
        : [...defaultConfig.ntpServers]),
  defaultStudioName: currentSettings.studioName,
  timezone: currentSettings.timezone || defaultConfig.defaultTimezone,
  language: currentSettings.language || defaultConfig.defaultLanguage,
  relayType: currentSettings.relayType || defaultConfig.defaultRelayType,
  relayIp: currentSettings.relayIp || defaultConfig.defaultRelayIp,
  relayChannels: Number.isFinite(currentSettings.relayChannels) && currentSettings.relayChannels > 0
    ? currentSettings.relayChannels
    : defaultConfig.defaultRelayChannels,
  defaultDisplayMode: currentSettings.defaultDisplayMode,
  defaultColors: currentSettings.colors,
  defaultDurations: currentSettings.presetTimes,
  // Palette utilisateur. Une palette vide est traitée comme "non initialisée"
  // et reseedée avec les couleurs par défaut — utile pour les installations
  // antérieures à la feature palette qui ont un `colorPalette: []` dans leur
  // custom-settings.json. Pour avoir vraiment une palette vide il faudrait
  // mettre `colorPalette: null` (mais c'est un cas extrême sans réel intérêt).
  colorPalette: Array.isArray(currentSettings.colorPalette) && currentSettings.colorPalette.length > 0
    ? currentSettings.colorPalette
    : [...defaultConfig.defaultColorPalette],
  
  // Fonctions utilitaires
  loadCustomSettings,
  saveCustomSettings,
  getDefaultConfig: () => defaultConfig
}; 
