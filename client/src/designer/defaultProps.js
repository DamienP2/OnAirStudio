// Types qui DOIVENT rester carrés (1:1) — resize verrouillé en ratio,
// et dans l'inspector un seul champ "Taille" au lieu de W/H.
export const SQUARE_RATIO_TYPES = new Set([
  'analog-clock',
  // Legacy types (rétrocompat avec anciens templates)
  'analog-clock-current',
  'analog-clock-remaining',
  'analog-clock-elapsed'
]);

// Ratios disponibles pour le widget vidéo (et tout futur widget à ratio fixe).
// Valeur = largeur / hauteur. Le ratio actuel est lu sur l'objet via `obj.props.ratio`.
export const VIDEO_RATIOS = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1':  1
};

// Calcule la hauteur en fonction de la largeur et du ratio (ou inversement).
// Utilisé par l'Inspector pour resynchroniser W/H quand l'utilisateur change
// de ratio, et par Canvas/Moveable pour forcer le ratio pendant le resize.
//
// Pour image / logo : ratio dynamique = celui des dimensions courantes de
// l'objet (le ratio est ajusté au ratio natif de l'image quand on la pick).
export function ratioOf(obj) {
  if (obj.type === 'video') return VIDEO_RATIOS[obj.props?.ratio || '16:9'] || 16 / 9;
  if (SQUARE_RATIO_TYPES.has(obj.type)) return 1;
  if (obj.type === 'image' || obj.type === 'logo') {
    if (obj.width && obj.height) return obj.width / obj.height;
    return null;
  }
  return null;
}

// Types affichés dans la palette (drag-and-drop) — versions unifiées
export const OBJECT_TYPES = [
  { type: 'analog-clock',  label: 'Horloge analogique',         category: 'Horloges' },
  { type: 'digital-clock', label: 'Horloge digitale',           category: 'Horloges' },
  { type: 'text',          label: 'Texte',                       category: 'Texte' },
  { type: 'date',          label: 'Date',                        category: 'Texte' },
  { type: 'logo',          label: 'Logo studio',                 category: 'Image' },
  { type: 'image',         label: 'Image',                       category: 'Image' },
  { type: 'video',         label: 'Vidéo',                       category: 'Image' },
  { type: 'onair-badge',   label: 'Badge ON AIR',                category: 'Autres widgets' },
  { type: 'planning',      label: 'Planning',                    category: 'Autres widgets' },
  { type: 'shape',         label: 'Forme',                       category: 'Autres widgets' },
  { type: 'progress-bar',  label: 'Barre de progression',        category: 'Autres widgets' }
];

// Defaults par type. Le `variant` détermine quelle valeur de timer afficher
// pour les horloges (current = heure courante, remaining = restant, elapsed = écoulé).
export const DEFAULT_PROPS = {
  // ── Horloges unifiées ──
  // label: '' → le composant calcule un label dynamique selon variant + tz custom
  //   ('Heure', 'Heure locale', 'Heure Europe/London' selon le cas).
  'analog-clock': {
    variant: 'current', // current | remaining | elapsed
    showLabel: true,
    label: '',
    color: '#FFFFFF',
    timezone: '',
    showSeconds: true,  // 60 points secondes
    showMinutes: true   // 12 points marqueurs 5min
  },
  'digital-clock': {
    variant: 'current',
    showLabel: true,
    label: '',
    fontFamily: 'JetBrains Mono',
    color: '#FFFFFF',
    backgroundColor: 'transparent', borderRadius: 0,
    timezone: '',
    showHours: true, showMinutes: true, showSeconds: true,
    flashOnLast10s: false
  },

  // ── Legacy types (anciens templates) — gardés pour rétrocompat ──
  'analog-clock-current':   { variant: 'current',   label: 'Horloge',       color: '#FFFFFF', timezone: '' },
  'analog-clock-remaining': { variant: 'remaining', label: 'Temps restant', color: '#EF4444' },
  'analog-clock-elapsed':   { variant: 'elapsed',   label: 'Temps écoulé',  color: '#3B82F6' },
  'digital-clock-current':  { variant: 'current',   showLabel: true, label: 'Horloge',       fontFamily: 'JetBrains Mono', color: '#FFFFFF', backgroundColor: 'transparent', borderRadius: 0, showSeconds: true, showHours: true, flashOnLast10s: false, timezone: '' },
  'digital-clock-remaining':{ variant: 'remaining', showLabel: true, label: 'Temps restant', fontFamily: 'JetBrains Mono', color: '#EF4444', backgroundColor: 'transparent', borderRadius: 0, showSeconds: true, showHours: true, flashOnLast10s: true },
  'digital-clock-elapsed':  { variant: 'elapsed',   showLabel: true, label: 'Temps écoulé',  fontFamily: 'JetBrains Mono', color: '#3B82F6', backgroundColor: 'transparent', borderRadius: 0, showSeconds: true, showHours: true, flashOnLast10s: false },

  // ── Texte unifié (fusion label + dynamic-text) ──
  // text peut contenir des variables {currentTime} {remaining} {elapsed} {studioName} etc.
  // Si aucune variable → comportement label statique.
  // padding (en %) n'apparaît dans l'inspector que si un fond est défini.
  'text': {
    text: 'Texte',
    fontFamily: 'Inter', color: '#FFFFFF',
    backgroundColor: 'transparent', borderRadius: 0,
    padding: 8,
    textAlign: 'center', fontWeight: 'normal', textTransform: 'none'
  },
  // Legacy : label et dynamic-text routent vers le même composant
  'label':        { text: 'Label',                 fontFamily: 'Inter', color: '#FFFFFF', backgroundColor: 'transparent', borderRadius: 0, padding: 8, textAlign: 'center', fontWeight: 'normal', textTransform: 'none' },
  'dynamic-text': { text: 'Reste {remaining}',     fontFamily: 'Inter', color: '#FFFFFF', backgroundColor: 'transparent', borderRadius: 0, padding: 8, textAlign: 'center', fontWeight: 'normal', textTransform: 'none' },

  // ── Date ──
  'date':                   { format:'EEEE d MMMM yyyy', fontFamily: 'Inter', color:'#FFFFFF', backgroundColor:'transparent', borderRadius:0 },

  // ── Logo (branding studio) ──
  // Le widget conserve le ratio natif du logo (chargement auto à l'ajout). objectFit
  // forcé à 'contain' dans LogoObject.jsx — pas exposé dans l'inspector.
  'logo':                   { backgroundColor: 'transparent', borderRadius: 0 },

  // ── Image (asset uploadé) ──
  // Idem : ratio natif respecté, pas de choix d'ajustement.
  'image':                  { assetId:null, filename:null, backgroundColor:'transparent', borderRadius:0 },

  // ── Vidéo — flux live (NDI / SDI) ou enregistrée (Upload / YouTube) ──
  // Le toggle `mode` détermine la source. Voir VideoObject.jsx pour le rendu.
  // Le widget garde un ratio fixe (16:9 / 9:16 / 1:1) — cf. VIDEO_RATIOS.
  'video': {
    mode: 'recorded',          // 'recorded' | 'live'
    ratio: '16:9',             // '16:9' | '9:16' | '1:1'
    // Source enregistrée
    recordedSource: 'upload',  // 'upload' | 'youtube'
    assetId: null, filename: null,
    youtubeUrl: '',
    // Source live (NDI / SDI)
    liveSource: 'ndi',         // 'ndi' | 'sdi'
    ndiSourceName: '',
    sdiDeviceId: '',
    quality: 'standard',       // 'eco' | 'standard' | 'high'
    // Lecture (vidéo enregistrée)
    autoplay: true,
    loop: true,
    muted: true,               // requis pour l'autoplay sans interaction utilisateur
    controls: false,
    startTime: 0,              // seek initial (s)
    // Apparence
    objectFit: 'cover',        // 'cover' | 'contain' | 'fill'
    backgroundColor: '#000000',
    borderRadius: 0
  },

  // ── Reste ──
  'onair-badge':            { text:'ON AIR', fontFamily: 'Inter', color:'#FFFFFF', activeColor:'#EF4444', inactiveColor:'#374151', borderRadius:8, previewActive: false },
  // Planning V3 — multi-provider (Google / Microsoft / Apple) avec filtres dynamiques.
  // Ancien comportement (icsUrl + titleKeyword) géré en rétro-compat dans le composant.
  'planning':               {
                              accountId: '',                  // id du compte connecté (Settings → Calendriers)
                              range: 'today',                 // 'today' | 'week'
                              // Filtres (tous optionnels — vides = tout passe)
                              calendarIds: [],                // [] = tous
                              titleContains: '',              // texte (pas regex)
                              locations: [],                  // [] = tous (multi-select valeurs uniques)
                              statuses: [],                   // ['confirmed','tentative','cancelled','busy','free'] — vide = tous
                              hasLocation: 'any',             // 'any' | 'yes' | 'no'
                              hasDescription: 'any',
                              durationMinMinutes: 0,
                              durationMaxMinutes: 0,          // 0 = pas de plafond
                              organizers: [],                 // [] = tous (emails)
                              // Affichage
                              layout: 'list',                 // 'list' (vertical) | 'agenda' (timeline horaire)
                              showTitle: true,
                              showTime: true,
                              showLocation: true,
                              showDescription: false,
                              showCalendar: true,
                              showOrganizer: false,
                              maxItems: 12,
                              // Style
                              fontFamily: 'Inter',
                              color: '#FFFFFF',
                              backgroundColor: 'rgba(15, 23, 42, 0.6)',
                              borderRadius: 12,
                              colorByCalendar: true,          // utilise la couleur source du calendrier
                              accentColor: '#EF4444',         // bordure event en cours (si !colorByCalendar)
                              pastOpacity: 0.35,
                              // Ancien chemin ICS (rétro-compat) — sera migré au chargement
                              icsUrl: '', titleKeyword: ''
                            },
  'shape':                  { type:'rect', fillColor:'#FFFFFF', strokeColor:'#000000', strokeWidth:0, borderRadius:0, opacity:1 },
  'progress-bar':           { direction:'h', bgColor:'#374151', borderRadius:0,
                              useThresholds: true,
                              fillColor:'#22C55E', warningColor:'#F59E0B', dangerColor:'#EF4444',
                              warningSeconds: 30, dangerSeconds: 10 },
  'progress-ring':          { bgColor:'#374151', thickness:20, startAngle:-90,
                              useThresholds: true,
                              fillColor:'#22C55E', warningColor:'#F59E0B', dangerColor:'#EF4444',
                              warningSeconds: 30, dangerSeconds: 10 }
};

export const DEFAULT_SIZES = {
  'analog-clock':           { width: 400, height: 400 },
  'digital-clock':          { width: 600, height: 200 },
  'analog-clock-current':   { width: 400, height: 400 },
  'analog-clock-remaining': { width: 400, height: 400 },
  'analog-clock-elapsed':   { width: 400, height: 400 },
  'digital-clock-current':  { width: 600, height: 200 },
  'digital-clock-remaining':{ width: 600, height: 200 },
  'digital-clock-elapsed':  { width: 600, height: 200 },
  'text':                   { width: 400, height: 100 },
  'label':                  { width: 400, height: 100 },
  'dynamic-text':           { width: 500, height: 120 },
  'date':                   { width: 500, height: 80 },
  'logo':                   { width: 200, height: 100 },
  'image':                  { width: 300, height: 200 },
  'video':                  { width: 640, height: 360 },
  'onair-badge':            { width: 260, height: 90 },
  'planning':               { width: 420, height: 620 },
  'shape':                  { width: 200, height: 200 },
  'progress-bar':           { width: 600, height: 40 },
  'progress-ring':          { width: 200, height: 200 }
};

export const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter (sans-serif)' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'system-ui', label: 'System default' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: 'Georgia, serif', label: 'Georgia (serif)' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Courier New, monospace', label: 'Courier New' }
];
