const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const config = require('./config');
const ntpClient = require('ntp-client');
const USBRelay = require('@balena/usbrelay');
const path = require('path');
const fs = require('fs');
const templatesManager = require('./templates-manager');
const factoryTemplates = require('./factory-templates-manager');
const icsCalendar = require('./ics-calendar');
const uploadsManager = require('./uploads-manager');
const calendarManager = require('./calendar');
const calendarStorage = require('./calendar/storage');
const calendarCrypto = require('./calendar/crypto-utils');
const ndiModule = require('./video/ndi');
const multer = require('multer');
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadsManager.MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (uploadsManager.ALLOWED_MIMETYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('mimetype non autorisé'));
  }
});
let LEDOnAir = false;

// Fonction pour logger les actions
function logAction(type, action, details = {}) {
  const timestamp = new Date().toLocaleTimeString('fr-FR');
  let typeColor = '\x1b[37m'; // Blanc par défaut
  
  // Couleurs différentes selon le type
  if (type === 'API') {
    typeColor = '\x1b[32m'; // Vert pour API
  } else if (type === 'OSC') {
    typeColor = '\x1b[36m'; // Cyan pour OSC
  }
  
  console.log(
    `\x1b[90m[${timestamp}]\x1b[0m ${typeColor}${type.padEnd(4)}\x1b[0m | \x1b[33m${action}\x1b[0m |`,
    Object.keys(details).length ? details : ''
  );
}

// Initialisation du relais USB
let relay = null;
try {
  relay = new USBRelay();
  console.log('Relais USB connecté avec succès');
} catch (err) {
  console.error('Erreur lors de la connexion au relais USB:', err);
}

// Fonction pour contrôler le relais ON AIR
// 1. Met à jour l'état DÉSIRÉ (LEDOnAir) — toujours, même si le relais est absent.
//    Comme ça le probe périodique peut restaurer l'état à la reconnexion.
// 2. Émet l'état désiré aux clients (badge ON AIR dans l'UI).
// 3. Applique physiquement sur le relais si présent et répond.
function updateOnAirLight(status) {
  if (status === 'on')       LEDOnAir = true;
  else if (status === 'off') LEDOnAir = false;

  io.emit('onAirStateUpdate', { isOnAir: LEDOnAir });

  if (!relay) return; // physiquement pas applicable maintenant, le probe s'en chargera

  try {
    relay.setState(1, LEDOnAir);
    if (typeof timerState !== 'undefined') timerState.usbRelayStatus = true;
  } catch (err) {
    console.error('Erreur lors du contrôle du relais:', err);
    if (typeof timerState !== 'undefined') timerState.usbRelayStatus = false;
  }
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
  }
});

// Trust proxy — permet à Express de lire les headers X-Forwarded-Proto/Host
// quand l'app tourne derrière un reverse proxy (nginx, Cloudflare, ngrok…).
// Sans ça, req.protocol reste 'http' et req.get('host') renvoie l'hôte interne,
// ce qui casse la construction de l'URI de redirection OAuth (Google exige HTTPS
// sur un domaine public + un match exact).
app.set('trust proxy', true);

// Configuration de CORS pour Express
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Middlewares - Important : avant les routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsManager.UPLOADS_DIR));

// Middleware de logging pour toutes les requêtes
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log('\x1b[35m%s\x1b[0m', `${req.method} ${req.url}`);
    console.log('\x1b[36m%s\x1b[0m', 'Body:', req.body);
  }
  next();
});

app.use(express.static(path.join(__dirname, '../../client/dist')));

let timerState = {
  isRunning: false,
  isPaused: false,
  elapsedTime: 0,
  remainingTime: 0,
  targetTime: 0,
  currentTime: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
  selectedDuration: '00:00:00', // Initialisation à zéro
  isNTPActive: true, // Indique si l'heure vient du NTP
  currentNtpServer: null, // Serveur NTP actuellement utilisé (parmi les configurés)
  usbRelayStatus: !!relay, // Statut du relais USB (true si init réussie)
  httpClientsCount: 0 // Nombre de clients HTTP connectés
};

// --- Template actif selon l'état du chrono ---
// Deux slots indépendants :
//   running : chrono en marche (isRunning === true, pausé ou non)
//   stopped : chrono à l'arrêt (isRunning === false)
// reconcileActiveTemplate() ne réémet `templateChanged` QUE quand le template
// du mode courant change — pas de spam sur chaque tick.
let lastEmittedTemplateId = undefined; // sentinelle : jamais émis
function reconcileActiveTemplate(force = false) {
  const mode = timerState.isRunning ? 'running' : 'stopped';
  const id = templatesManager.getActiveTemplateIdForMode(mode) || null;
  if (!force && id === lastEmittedTemplateId) return;
  lastEmittedTemplateId = id;
  const t = id ? templatesManager.getTemplate(id) : null;
  io.emit('templateChanged', t);
}
function emitTimerState() {
  io.emit('timerUpdate', timerState);
  reconcileActiveTemplate();
}

// Stockage des préférences d'affichage
let displayPreferences = {
  clockSize: 256,
  colors: { ...config.defaultColors }
};

// Gestion du mot de passe d'administration
let adminPassword = 'changeme'; // Fallback neutre — la vraie valeur est écrite par install.sh dans admin-password.json
const adminPasswordFile = path.join(__dirname, 'admin-password.json');

// Rate limiter en mémoire pour les endpoints d'auth — bloque le brute force
// sur LAN ou en cas d'exposition accidentelle. 10 tentatives / 15 min / IP.
// Reset auto au succès. Cleanup périodique pour éviter une croissance infinie.
const AUTH_RATE_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };
const authAttempts = new Map(); // ip → { count, resetAt }
function authRateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = authAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + AUTH_RATE_LIMIT.windowMs };
    authAttempts.set(ip, entry);
  }
  entry.count++;
  if (entry.count > AUTH_RATE_LIMIT.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.', retryAfter });
  }
  next();
}
// Cleanup léger toutes les 30 min (drop les entries expirées)
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of authAttempts) if (e.resetAt < now) authAttempts.delete(ip);
}, 30 * 60 * 1000).unref();

// Échappe les caractères HTML pour interpolation safe dans les templates inline.
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Fonction pour charger le mot de passe d'administration
function loadAdminPassword() {
  try {
    if (fs.existsSync(adminPasswordFile)) {
      const data = fs.readFileSync(adminPasswordFile, 'utf8');
      const parsed = JSON.parse(data);
      return parsed.password;
    }
  } catch (error) {
    console.error('Erreur lors du chargement du mot de passe admin:', error);
  }
  return null;
}

// Fonction pour sauvegarder le mot de passe d'administration
function saveAdminPassword(password) {
  try {
    fs.writeFileSync(adminPasswordFile, JSON.stringify({ password }, null, 2), 'utf8');
    adminPassword = password;
    console.log('Mot de passe d\'administration sauvegardé');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du mot de passe admin:', error);
  }
}

// Charger le mot de passe au démarrage
const savedPassword = loadAdminPassword();
if (savedPassword) {
  adminPassword = savedPassword;
}

// Middleware léger pour vérifier le mot de passe admin dans le body.
// Lit la clé `adminPassword` en priorité (champ dédié, évite les collisions
// avec d'autres champs `password` métier — par ex. Apple iCloud app-specific
// password). Fallback sur `password` pour rétrocompat avec les anciens clients.
function requireAdminPassword(req, res, next) {
  const provided = req.body && (req.body.adminPassword || req.body.password);
  if (!provided) {
    return res.status(401).json({ error: 'Mot de passe admin requis dans le body' });
  }
  if (provided !== adminPassword) {
    return res.status(403).json({ error: 'Mot de passe admin invalide' });
  }
  next();
}

// Helper pour exécuter une commande et récupérer stdout (promise)
function execShell(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const child = spawn(cmd, args, { ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(Object.assign(new Error(`exit ${code}: ${stderr}`), { code, stdout, stderr }));
    });
    child.on('error', reject);
  });
}

// Racine du repo git — utilisé par les commandes git du flow de mise à jour.
// En prod (install.sh) : /opt/onair-studio. En dev (clone perso) : la racine
// du checkout. Dans les deux cas __dirname = <root>/server/src, donc le résolu
// pointe sur la bonne racine sans avoir besoin de valeur en dur.
const APP_DIR = path.resolve(__dirname, '..', '..');

// Fonction pour démarrer le timer
function startTimer(duration) {
  timerState.isRunning = true;
  timerState.isPaused = false;
  if (duration) {
    const [hours, minutes, seconds] = duration.split(':').map(Number);
    timerState.targetTime = (hours * 3600) + (minutes * 60) + seconds;
    timerState.selectedDuration = duration;
    timerState.remainingTime = timerState.targetTime;
    timerState.elapsedTime = 0;
  }
  updateOnAirLight('on'); // Allumer le relais au démarrage
  io.emit('startTimer', timerState.selectedDuration);
  emitTimerState();
}

// Fonction pour arrêter le timer
function stopTimer() {
  timerState.isRunning = false;
  timerState.isPaused = false;
  timerState.elapsedTime = 0;
  timerState.remainingTime = 0;
  timerState.targetTime = 0;
  timerState.selectedDuration = '00:00:00';
  updateOnAirLight('off');
  
  // Nettoyer le timeout si présent
  if (autoStopTimeout) {
    clearTimeout(autoStopTimeout);
    autoStopTimeout = null;
  }
  
  io.emit('stopTimer');
  emitTimerState();
  io.emit('durationUpdate', '00:00:00');
}

// Fonction pour réinitialiser le timer
function resetTimer() {
  timerState.isRunning = false;
  timerState.isPaused = false;
  timerState.elapsedTime = 0;
  timerState.remainingTime = 0;
  timerState.targetTime = 0;
  timerState.selectedDuration = '00:00:00';
  updateOnAirLight('off'); // Éteindre le relais
  
  // Nettoyer le timeout si présent
  if (autoStopTimeout) {
    clearTimeout(autoStopTimeout);
    autoStopTimeout = null;
  }
  
  io.emit('resetTimer');
  emitTimerState();
  io.emit('durationUpdate', '00:00:00');
}

// Fonction pour définir la durée du timer
function setTimer(duration) {
  if (!duration) return false;
  
  // Nettoyer la durée des guillemets
  duration = duration.toString().replace(/['"]+/g, '');
  
  // Vérifier le format
  if (!/^\d{2}:\d{2}:\d{2}$/.test(duration)) {
    console.error('Format de durée invalide:', duration);
    return false;
  }
  
  const [hours, minutes, seconds] = duration.split(':').map(Number);
  const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
  
  // Mettre à jour tous les états du timer
  timerState.targetTime = totalSeconds;
  timerState.selectedDuration = duration;
  timerState.remainingTime = totalSeconds;
  timerState.elapsedTime = 0;
  timerState.isRunning = true; // Mettre en marche
  timerState.isPaused = true;  // Mais en pause
  
  // Émettre tous les événements nécessaires
  io.emit('durationSelected', duration);
  io.emit('durationUpdate', duration);
  io.emit('startTimer', duration); // Pour activer les boutons
  io.emit('pauseTimer'); // Pour mettre en pause immédiatement
  emitTimerState();
  
  
  return true;
}

// Fonction pour mettre en pause le timer
// Le relais reste ACTIF en pause — même comportement que chrono en marche.
// Il ne s'éteint qu'au stop/reset.
function pauseTimer() {
  timerState.isPaused = true;
  io.emit('pauseTimer');
  emitTimerState();
}

// Fonction pour reprendre le timer
// Le relais est déjà allumé (on ne l'a pas éteint en pause), mais on force l'état
// au cas où un probe ait échoué entre temps (défense en profondeur).
function resumeTimer() {
  timerState.isPaused = false;
  updateOnAirLight('on');
  io.emit('resumeTimer');
  emitTimerState();
}

// Routes pour Companion avec logs
app.post('/api/timer/start', (req, res) => {
  logAction('API', 'Timer Start');
  startTimer();
  res.setHeader('Content-Type', 'application/json');
  res.json({ status: 'success', state: timerState });
});

app.post('/api/timer/stop', (req, res) => {
  logAction('API', 'Timer Stop');
  stopTimer();
  res.setHeader('Content-Type', 'application/json');
  res.json({ status: 'success', state: timerState });
});

app.post('/api/timer/reset', (req, res) => {
  logAction('API', 'Timer Reset');
  resetTimer();
  res.setHeader('Content-Type', 'application/json');
  res.json({ status: 'success', state: timerState });
});

app.post('/api/timer/set', (req, res) => {
  const { duration } = req.body;
  logAction('API', 'Timer Set', { duration });
  if (setTimer(duration)) {
    res.setHeader('Content-Type', 'application/json');
    res.json({ status: 'success', state: timerState });
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.status(400).json({ status: 'error', message: 'Invalid duration format' });
  }
});

app.post('/api/timer/pause', (req, res) => {
  logAction('API', 'Timer Pause');
  pauseTimer();
  res.setHeader('Content-Type', 'application/json');
  res.json({ status: 'success', state: timerState });
});

app.post('/api/timer/resume', (req, res) => {
  logAction('API', 'Timer Resume');
  resumeTimer();
  res.setHeader('Content-Type', 'application/json');
  res.json({ status: 'success', state: timerState });
});

// Nouvelles routes API équivalentes aux commandes OSC
app.post('/api/timer/digit/increment', (req, res) => {
  const { position } = req.body;
  logAction('API', 'Digit Increment', { position });
  if (position >= 0 && position < 6) {
    const newTime = adjustDigit(position, 1);
    res.setHeader('Content-Type', 'application/json');
    res.json({ status: 'success', time: newTime });
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.status(400).json({ status: 'error', message: 'Invalid position (0-5)' });
  }
});

app.post('/api/timer/digit/decrement', (req, res) => {
  const { position } = req.body;
  logAction('API', 'Digit Decrement', { position });
  if (position >= 0 && position < 6) {
    const newTime = adjustDigit(position, -1);
    res.setHeader('Content-Type', 'application/json');
    res.json({ status: 'success', time: newTime });
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.status(400).json({ status: 'error', message: 'Invalid position (0-5)' });
  }
});

app.post('/api/onair/on', (req, res) => {
  logAction('API', 'OnAir Light On');
  updateOnAirLight('on');
  res.setHeader('Content-Type', 'application/json');
  res.json({ status: 'success', onair: true });
});

app.post('/api/onair/off', (req, res) => {
  logAction('API', 'OnAir Light Off');
  updateOnAirLight('off');
  res.setHeader('Content-Type', 'application/json');
  res.json({ status: 'success', onair: false });
});

// Fonction utilitaire pour formater le temps en chiffres individuels
function getTimeDigits(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return {
    hours: {
      tens: Math.floor(hours / 10),
      ones: hours % 10
    },
    minutes: {
      tens: Math.floor(minutes / 10),
      ones: minutes % 10
    },
    seconds: {
      tens: Math.floor(seconds / 10),
      ones: seconds % 10
    }
  };
}

// Routes pour récupérer l'état
app.get('/api/timer/state', (req, res) => {
  const timeDigits = getTimeDigits(timerState.remainingTime);
  
  const response = {
    isRunning: timerState.isRunning,
    isPaused: timerState.isPaused,
    elapsedTime: timerState.elapsedTime,
    remainingTime: timerState.remainingTime,
    targetTime: timerState.targetTime,
    selectedDuration: timerState.selectedDuration,
    currentTime: timerState.currentTime,
    digits: {
      ...timeDigits,
      // Format plat pour un accès plus facile
      flat: [
        timeDigits.hours.tens,   // position 0
        timeDigits.hours.ones,   // position 1
        timeDigits.minutes.tens, // position 2
        timeDigits.minutes.ones, // position 3
        timeDigits.seconds.tens, // position 4
        timeDigits.seconds.ones  // position 5
      ]
    }
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.json(response);
});

app.get('/api/timer/display', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    clockSize: displayPreferences.clockSize,
    colors: displayPreferences.colors
  });
});

// Route pour récupérer uniquement le temps restant en brut
app.get('/api/timer/remaining', (req, res) => {
  const remaining = timerState.remainingTime;
  let formattedTime;

  if (remaining < 0) {
    // Pour le temps négatif, on utilise la valeur absolue
    const absRemaining = Math.abs(remaining);
    const hours = Math.floor(absRemaining / 3600);
    const minutes = Math.floor((absRemaining % 3600) / 60);
    const seconds = absRemaining % 60;
    
    // On remplace le premier 0 par un +
    formattedTime = `+${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    
    formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  res.setHeader('Content-Type', 'text/plain');
  res.send(formattedTime);
});

// Route pour récupérer uniquement l'état du timer en brut
app.get('/api/timer/status', (req, res) => {
  let status = 'stop';
  
  if (timerState.isRunning) {
    status = timerState.isPaused ? 'pause' : 'running';
  }
  
  res.setHeader('Content-Type', 'text/plain');
  res.send(status);
});

// Route pour récupérer l'état du relais ON AIR
app.get('/api/onair/status', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(LEDOnAir ? 'on' : 'off');
});

// Route pour récupérer le nom du studio
app.get('/api/studio/name', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({ studioName: config.defaultStudioName });
});

// Fonction pour formater le temps en HH:MM:SS
function formatTime(seconds) {
  if (typeof seconds !== 'number' || seconds < 0) {
    return '00:00:00';
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs]
    .map(v => String(v).padStart(2, '0'))
    .join(':');
}

// Tente une requête NTP unique sur un serveur donné, avec timeout 4s.
function tryOneNtp(server, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let done = false;
    const settle = (date) => { if (!done) { done = true; resolve(date); } };
    const timer = setTimeout(() => settle(null), timeoutMs);
    ntpClient.getNetworkTime(server, 123, (err, date) => {
      clearTimeout(timer);
      if (err) settle(null);
      else settle(date);
    });
  });
}

// Essaie chaque serveur NTP (ordre de préférence) jusqu'à en trouver un qui répond.
// Met à jour timerState.isNTPActive et timerState.currentNtpServer.
async function getNTPTime() {
  const servers = (config.ntpServers && config.ntpServers.length > 0)
    ? config.ntpServers
    : [config.ntpServer || 'pool.ntp.org'];
  for (const server of servers) {
    if (!server) continue;
    const date = await tryOneNtp(server);
    if (date) {
      if (timerState.currentNtpServer !== server) {
        console.log(`[NTP] Synchronisé via ${server}`);
      }
      timerState.isNTPActive = true;
      timerState.currentNtpServer = server;
      return date;
    } else {
      console.warn(`[NTP] ${server} injoignable, fallback…`);
    }
  }
  // Aucun serveur n'a répondu
  timerState.isNTPActive = false;
  timerState.currentNtpServer = null;
  return null;
}

let autoStopTimeout = null; // Pour stocker le timeout d'arrêt automatique
let lastNTPTime = new Date(); // Stocker la dernière heure NTP
let ntpOffset = 0; // Offset entre l'heure système et l'heure NTP

// Synchronisation NTP toutes les 10 secondes (statut temps réel)
setInterval(async () => {
  const currentDate = await getNTPTime();
  if (currentDate) {
    lastNTPTime = currentDate;
    const systemTime = new Date();
    ntpOffset = currentDate.getTime() - systemTime.getTime();
  }
}, 10000);

// Mise à jour de l'heure courante et des compteurs toutes les secondes
setInterval(async () => {
  // Utiliser l'heure NTP corrigée pour l'affichage en temps réel
  const correctedTime = new Date(Date.now() + ntpOffset);
  // Formate dans le fuseau horaire et la langue configurés (Settings).
  // Au moindre changement (updateSettings), le tick suivant utilise les nouvelles valeurs.
  const localeTag = (config.language === 'en') ? 'en-GB' : 'fr-FR';
  const timeZone = config.timezone || 'Europe/Paris';
  try {
    timerState.currentTime = correctedTime.toLocaleTimeString(localeTag, { hour12: false, timeZone });
  } catch {
    // Fallback si le timezone est invalide
    timerState.currentTime = correctedTime.toLocaleTimeString(localeTag, { hour12: false });
  }
  
  if (timerState.isRunning && !timerState.isPaused) {
    timerState.elapsedTime += 1;
    timerState.remainingTime = timerState.targetTime - timerState.elapsedTime;

    // Vérifier si le temps est négatif
    if (timerState.remainingTime < 0) {
      // Si c'est la première fois qu'on passe en négatif
      if (!autoStopTimeout) {
        // Programmer l'arrêt automatique 1h après la fin du timer.
        // Filet de sécurité si l'opérateur oublie d'arrêter manuellement.
        autoStopTimeout = setTimeout(() => {
          stopTimer();
          autoStopTimeout = null;
        }, 3600 * 1000);
      }
    } else {
      // Si on revient en positif (cas improbable mais par sécurité)
      if (autoStopTimeout) {
        clearTimeout(autoStopTimeout);
        autoStopTimeout = null;
      }
    }
  }
  
  io.emit('timeUpdate', timerState);
}, 1000);

io.on('connection', (socket) => {
  // Incrémenter le compteur de clients
  timerState.httpClientsCount++;
  emitTimerState();
  
  // Envoyer l'état actuel du relais ON AIR au nouveau client
  socket.emit('onAirStateUpdate', { isOnAir: LEDOnAir });
  socket.emit('initialState', timerState);
  socket.emit('displayPreferences', displayPreferences);
  socket.emit('colorUpdate', displayPreferences.colors);
  socket.emit('presetTimesUpdate', config.defaultDurations);
  socket.emit('studioNameUpdate', config.defaultStudioName);

  // Gestion de la déconnexion
  socket.on('disconnect', () => {
    // Décrémenter le compteur de clients
    timerState.httpClientsCount = Math.max(0, timerState.httpClientsCount - 1);
    emitTimerState();
  });

  // Gestion de la demande de durées prédéfinies
  socket.on('requestPresetTimes', () => {
    socket.emit('presetTimesUpdate', config.defaultDurations);
  });

  socket.on('durationSelected', (duration) => {
    timerState.selectedDuration = duration;
    io.emit('durationUpdate', duration);
  });

  // Gestion de la sélection de durée avec setTimer
  socket.on('setTimer', (duration) => {
    setTimer(duration);
  });

  socket.on('startTimer', (duration) => {
    timerState.isRunning = true;
    timerState.isPaused = false;
    timerState.targetTime = duration;
    timerState.elapsedTime = 0;
    timerState.remainingTime = duration;
    updateOnAirLight('on'); // Allumer le relais
    emitTimerState();
  });

  socket.on('stopTimer', () => {
    timerState.isRunning = false;
    timerState.isPaused = false;
    timerState.elapsedTime = 0;
    timerState.remainingTime = 0;
    timerState.targetTime = 0;
    timerState.selectedDuration = '00:00:00';
    updateOnAirLight('off');
    // Annule le filet de sécurité d'auto-stop 1h s'il était armé,
    // sinon il déclencherait un stopTimer() superflu plus tard.
    if (autoStopTimeout) { clearTimeout(autoStopTimeout); autoStopTimeout = null; }
    emitTimerState();
    io.emit('durationUpdate', '00:00:00');
  });

  socket.on('pauseTimer', () => {
    timerState.isPaused = true;
    // Le relais reste actif en pause — même comportement qu'en marche
    emitTimerState();
  });

  socket.on('resumeTimer', () => {
    timerState.isPaused = false;
    updateOnAirLight('on'); // Force l'état (défense en profondeur)
    emitTimerState();
  });

  socket.on('updateRemainingTime', (newTargetTime) => {
    // Modifier le temps restant sans remettre à zéro le temps écoulé
    timerState.targetTime = timerState.elapsedTime + newTargetTime;
    timerState.remainingTime = newTargetTime;
    timerState.selectedDuration = formatTime(newTargetTime);
    emitTimerState();
    io.emit('durationUpdate', timerState.selectedDuration);
  });

  socket.on('resetTimer', () => {
    timerState.isRunning = false;
    timerState.isPaused = false;
    timerState.elapsedTime = 0;
    timerState.remainingTime = 0;
    updateOnAirLight('off'); // Éteindre le relais
    if (autoStopTimeout) { clearTimeout(autoStopTimeout); autoStopTimeout = null; }
    emitTimerState();
  });

  // Toggle manuel du relais ON AIR depuis l'UI (bouton rouge dans Control)
  socket.on('setOnAir', (desiredState) => {
    const on = !!desiredState;
    updateOnAirLight(on ? 'on' : 'off');
  });

  // Gérer les changements de couleur
  socket.on('updateColor', ({ clock, color }) => {
    displayPreferences.colors[clock] = color;
    io.emit('colorUpdate', displayPreferences.colors);
  });

  // Gérer les changements de taille d'horloge
  socket.on('clockSizeChange', (size) => {
    displayPreferences.clockSize = size;
    io.emit('clockSizeUpdate', size);
  });

  // Gestion des paramètres
  socket.on('requestSettings', () => {
    const settings = {
      ntpServer: config.ntpServer,
      ntpServers: [...(config.ntpServers || [])],
      studioName: config.defaultStudioName,
      timezone: config.timezone,
      language: config.language,
      relayType: config.relayType || 'usb',
      relayIp: config.relayIp || '',
      relayChannels: config.relayChannels || 2,
      defaultDisplayMode: config.defaultDisplayMode,
      colors: { ...config.defaultColors },
      presetTimes: [...config.defaultDurations],
      colorPalette: [...(config.colorPalette || [])]
    };
    socket.emit('settingsUpdate', settings);
  });

  // Gestion des valeurs par défaut
  socket.on('requestDefaultSettings', () => {
    const defaultConfig = config.getDefaultConfig();
    const defaultSettings = {
      ntpServer: defaultConfig.ntpServer,
      studioName: defaultConfig.defaultStudioName,
      defaultDisplayMode: defaultConfig.defaultDisplayMode,
      colors: { ...defaultConfig.defaultColors },
      presetTimes: [...defaultConfig.defaultDurations]
    };
    socket.emit('defaultSettingsUpdate', defaultSettings);
  });

  socket.on('updateSettings', (newSettings) => {
    // Sauvegarder les paramètres personnalisés
    config.saveCustomSettings(newSettings);
    
    // Recharger la configuration depuis le fichier
    const updatedConfig = config.loadCustomSettings();
    
    // Mettre à jour la configuration en mémoire
    config.ntpServer = updatedConfig.ntpServer;
    if (Array.isArray(updatedConfig.ntpServers)) config.ntpServers = updatedConfig.ntpServers;
    config.defaultStudioName = updatedConfig.studioName;
    config.timezone = updatedConfig.timezone || config.timezone;
    config.language = updatedConfig.language || config.language;
    config.relayType = updatedConfig.relayType || config.relayType;
    config.relayIp = updatedConfig.relayIp ?? config.relayIp;
    if (Number.isFinite(updatedConfig.relayChannels) && updatedConfig.relayChannels > 0) {
      config.relayChannels = updatedConfig.relayChannels;
    }
    config.defaultDisplayMode = updatedConfig.defaultDisplayMode;
    config.defaultColors = { ...updatedConfig.colors };
    config.defaultDurations = [...updatedConfig.presetTimes];
    config.colorPalette = Array.isArray(updatedConfig.colorPalette) ? [...updatedConfig.colorPalette] : [];

    // Mettre à jour les préférences d'affichage
    displayPreferences.colors = { ...updatedConfig.colors };

    // Émettre les mises à jour à tous les clients
    io.emit('studioNameUpdate', updatedConfig.studioName);
    io.emit('colorUpdate', updatedConfig.colors);
    io.emit('presetTimesUpdate', updatedConfig.presetTimes);

    // Broadcast complet — permet aux autres clients (TimerContext) de mettre à jour
    // immédiatement leur fuseau horaire et leur langue sans avoir à re-fetcher.
    io.emit('settingsUpdate', {
      ntpServer: config.ntpServer,
      ntpServers: [...(config.ntpServers || [])],
      studioName: config.defaultStudioName,
      timezone: config.timezone,
      language: config.language,
      relayType: config.relayType,
      relayIp: config.relayIp,
      relayChannels: config.relayChannels,
      defaultDisplayMode: config.defaultDisplayMode,
      colors: { ...config.defaultColors },
      presetTimes: [...config.defaultDurations],
      colorPalette: [...(config.colorPalette || [])]
    });

    console.log('Paramètres mis à jour et sauvegardés:', updatedConfig);
  });

  // Gestion du mot de passe d'administration — exige le mot de passe COURANT
  // dans `currentPassword` pour éviter qu'un client LAN non authentifié ne
  // puisse changer le mot de passe admin sans le connaître.
  socket.on('setAdminPassword', (payload, callback) => {
    const currentPassword = payload && payload.currentPassword;
    const newPassword = payload && payload.newPassword;
    const respond = (obj) => { if (typeof callback === 'function') callback(obj); };
    if (typeof currentPassword !== 'string' || currentPassword !== adminPassword) {
      return respond({ ok: false, error: 'Mot de passe actuel invalide' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 4) {
      return respond({ ok: false, error: 'Nouveau mot de passe trop court (min 4 caractères)' });
    }
    saveAdminPassword(newPassword);
    console.log('Nouveau mot de passe d\'administration défini');
    respond({ ok: true });
  });

  // Gestion de la vérification du mot de passe
  socket.on('checkAdminPassword', (password, callback) => {
    const isValid = password === adminPassword;
    callback({ isValid });
  });
});

// Fonction pour modifier un chiffre spécifique du timer
function adjustDigit(position, increment) {
  // Convertir la durée actuelle en tableau de chiffres
  const timeStr = timerState.selectedDuration || "00:00:00";
  const digits = timeStr.replace(/:/g, '').split('').map(Number);
  
  // Appliquer les limites selon la position
  if (position === 0) { // Dizaines d'heures (0-2)
    const newValue = (digits[position] + increment + 3) % 3;
    digits[position] = newValue;
  } else if (position === 1) { // Unités d'heures
    digits[position] = (digits[position] + increment + 10) % 10;
  } else if (position === 2) { // Dizaines de minutes
    const newValue = (digits[position] + increment + 6) % 6; // Max 5
    digits[position] = newValue;
  } else if (position === 3) { // Unités de minutes
    digits[position] = (digits[position] + increment + 10) % 10;
  } else if (position === 4) { // Dizaines de secondes
    const newValue = (digits[position] + increment + 6) % 6; // Max 5
    digits[position] = newValue;
  } else if (position === 5) { // Unités de secondes
    digits[position] = (digits[position] + increment + 10) % 10;
  }
  
  // Reconstruire la chaîne de temps
  const newTime = `${digits[0]}${digits[1]}:${digits[2]}${digits[3]}:${digits[4]}${digits[5]}`;
  
  // Mettre à jour le timer avec la nouvelle durée
  setTimer(newTime);
  
  return newTime;
}

// ===== Endpoints admin — mise à jour =====

// Vérifier les commits disponibles + retourner version courante et accessibilité serveur
// Toujours 200 — on encode l'erreur dans la payload pour que le client affiche un état
// (« serveur inaccessible ») plutôt que de tomber en 500.
app.post('/api/admin/update/check', requireAdminPassword, async (req, res) => {
  const out = {
    currentVersion: null,
    currentCommit: null,
    remoteUrl: null,
    serverAccessible: false,
    updatesAvailable: false,
    count: 0,
    commits: [],
    error: null
  };

  // Version actuelle depuis le package.json racine
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      out.currentVersion = pkg.version || null;
    }
  } catch { /* ignore */ }

  // SHA actuel (toujours disponible si on est dans un git repo)
  try {
    const sha = await execShell('git', ['-C', APP_DIR, 'rev-parse', '--short', 'HEAD']);
    out.currentCommit = sha.stdout.trim() || null;
  } catch { /* ignore */ }

  // URL du remote git (serveur de MAJ)
  try {
    const remote = await execShell('git', ['-C', APP_DIR, 'remote', 'get-url', 'origin']);
    out.remoteUrl = remote.stdout.trim() || null;
  } catch { /* ignore */ }

  // Tentative de fetch — si ça réussit, le serveur de MAJ est accessible
  try {
    await execShell('git', ['-C', APP_DIR, 'fetch'], { timeout: 10000 });
    out.serverAccessible = true;
    const { stdout } = await execShell('git', ['-C', APP_DIR, 'log', 'HEAD..origin/main', '--oneline']);
    const commits = stdout.trim().split('\n').filter(Boolean);
    out.updatesAvailable = commits.length > 0;
    out.count = commits.length;
    out.commits = commits;
  } catch (err) {
    out.error = err.message || String(err);
  }

  res.json(out);
  logAction('API', 'admin/update/check', { server: out.serverAccessible, count: out.count });
});

// Déclencher la mise à jour (via onair-update.service)
//
// Subtil : la règle sudoers (/etc/sudoers.d/onair-update) autorise EXACTEMENT
// "/bin/systemctl start onair-update.service" sans aucun flag — toute autre
// forme (ex. --no-block) déclenche un prompt de mot de passe et fait échouer
// la commande non-interactive.
//
// On ne peut pas non plus AWAIT le `systemctl start` : Type=oneshot bloque
// jusqu'à la fin de update.sh, qui stoppe le serveur Node en cours de route
// → la réponse HTTP ne partirait jamais (browser : "Failed to fetch").
//
// Solution : spawn détaché avec `unref()` — la commande sudo continue à
// vivre indépendamment du processus parent. On répond immédiatement au client
// avant même que sudo n'ait fini de communiquer avec systemd.
app.post('/api/admin/update', requireAdminPassword, (req, res) => {
  if (timerState.isRunning) {
    return res.status(409).json({
      error: 'Impossible de mettre à jour quand le timer est en marche. Stoppe-le d\'abord.'
    });
  }
  try {
    const { spawn } = require('child_process');
    const child = spawn('sudo', ['-n', '/bin/systemctl', 'start', 'onair-update.service'], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    res.json({ started: true, startedAt: new Date().toISOString() });
    logAction('API', 'admin/update started');
  } catch (err) {
    res.status(500).json({ error: `Impossible de démarrer l'update : ${err.message}` });
  }
});

app.post('/api/admin/verify', authRateLimit, (req, res) => {
  const provided = req.body && req.body.password;
  if (!provided) return res.status(400).json({ valid: false, error: 'password requis' });
  res.json({ valid: provided === adminPassword });
});

// Changement du mot de passe admin (admin, body: { password (current), newPassword })
// `requireAdminPassword` valide d'abord le mot de passe actuel via la clé `password`,
// ensuite on remplace par `newPassword` (min 4 chars).
app.post('/api/admin/change-password', authRateLimit, requireAdminPassword, (req, res) => {
  try {
    const newPassword = req.body && req.body.newPassword;
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'newPassword requis' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 4 caractères' });
    }
    saveAdminPassword(newPassword);
    res.json({ ok: true });
    logAction('API', 'admin/change-password', { length: newPassword.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Reset / Réinitialisation (admin) ----

// Supprime toutes les données utilisateurs : templates + uploads + comptes
// calendriers connectés. Les modèles factory et les credentials OAuth (config
// globale) ne sont pas touchés. Sert au bouton "Données" du panneau Réglages.
app.post('/api/admin/reset/templates', requireAdminPassword, (req, res) => {
  try {
    const deletedTemplates = templatesManager.deleteAllTemplates();
    const deletedUploads = uploadsManager.deleteAllAssets();
    const deletedAccounts = calendarManager.deleteAllAccounts();
    io.emit('templatesListChanged', templatesManager.listTemplates());
    io.emit('calendarAccountsChanged');
    res.json({ ok: true, deletedTemplates, deletedUploads, deletedAccounts });
    logAction('API', 'admin/reset/templates', { deletedTemplates, deletedUploads, deletedAccounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remet les réglages globaux à leurs valeurs par défaut. Supprime
// custom-settings.json — au prochain démarrage, les valeurs par défaut de
// config.js sont utilisées. Pour appliquer immédiatement on doit aussi
// remettre TOUS les champs en mémoire (sinon ils gardent leur dernière
// valeur custom et le reset n'est pas vraiment effectif au reload suivant).
app.post('/api/admin/reset/settings', requireAdminPassword, (req, res) => {
  try {
    const customSettingsPath = path.join(__dirname, 'custom-settings.json');
    if (fs.existsSync(customSettingsPath)) fs.unlinkSync(customSettingsPath);

    // Récupère les vraies valeurs par défaut de config.js (pas celles
    // potentiellement écrasées par les settings personnalisés).
    const dc = config.getDefaultConfig();

    // Réinitialise la config en mémoire avec les défauts d'usine
    config.defaultStudioName = dc.defaultStudioName;
    config.timezone = dc.defaultTimezone;
    config.language = dc.defaultLanguage;
    config.relayType = dc.defaultRelayType;
    config.relayIp = dc.defaultRelayIp;
    config.ntpServer = dc.ntpServer;
    config.ntpServers = [...dc.ntpServers];
    config.defaultColors = { ...dc.defaultColors };
    config.defaultDurations = [...dc.defaultDurations];
    config.defaultDisplayMode = dc.defaultDisplayMode;
    config.colorPalette = [...dc.defaultColorPalette];

    // Notifie tous les clients
    io.emit('studioNameUpdate', dc.defaultStudioName);
    io.emit('settingsUpdate', {
      studioName: dc.defaultStudioName,
      timezone: dc.defaultTimezone,
      language: dc.defaultLanguage,
      relayType: dc.defaultRelayType,
      relayIp: dc.defaultRelayIp,
      ntpServers: [...dc.ntpServers],
      ntpServer: dc.ntpServer,
      presetTimes: [...dc.defaultDurations],
      colors: { ...dc.defaultColors },
      colorPalette: [...dc.defaultColorPalette],
      defaultDisplayMode: dc.defaultDisplayMode
    });
    res.json({ ok: true });
    logAction('API', 'admin/reset/settings', {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Réinitialisation totale — combine settings + données + branding logo.
// Conserve uniquement le mot de passe admin (pour ne pas locker l'accès).
app.post('/api/admin/reset/all', requireAdminPassword, (req, res) => {
  try {
    // 1. Données : templates + uploads + comptes calendriers + credentials OAuth
    const deletedTemplates = templatesManager.deleteAllTemplates();
    const deletedUploads = uploadsManager.deleteAllAssets();
    const deletedAccounts = calendarManager.deleteAllAccounts();
    calendarManager.deleteAllCredentials();

    // 2. Réglages : supprime le custom-settings.json + remet TOUS les champs
    // en mémoire aux valeurs par défaut d'usine.
    const customSettingsPath = path.join(__dirname, 'custom-settings.json');
    if (fs.existsSync(customSettingsPath)) fs.unlinkSync(customSettingsPath);
    const dc = config.getDefaultConfig();
    config.defaultStudioName = dc.defaultStudioName;
    config.timezone = dc.defaultTimezone;
    config.language = dc.defaultLanguage;
    config.relayType = dc.defaultRelayType;
    config.relayIp = dc.defaultRelayIp;
    config.ntpServer = dc.ntpServer;
    config.ntpServers = [...dc.ntpServers];
    config.defaultColors = { ...dc.defaultColors };
    config.defaultDurations = [...dc.defaultDurations];
    config.defaultDisplayMode = dc.defaultDisplayMode;
    config.colorPalette = [...dc.defaultColorPalette];

    // 3. Branding : supprime le logo personnalisé (toutes extensions)
    const brandingDirPath = path.join(__dirname, 'branding');
    let deletedBranding = 0;
    if (fs.existsSync(brandingDirPath)) {
      for (const entry of fs.readdirSync(brandingDirPath)) {
        try { fs.unlinkSync(path.join(brandingDirPath, entry)); deletedBranding++; } catch { /* ignore */ }
      }
    }

    // 4. Notifie tous les clients
    io.emit('templatesListChanged', templatesManager.listTemplates());
    io.emit('calendarAccountsChanged');
    io.emit('calendarCredentialsChanged');
    io.emit('studioNameUpdate', dc.defaultStudioName);
    io.emit('settingsUpdate', {
      studioName: dc.defaultStudioName,
      timezone: dc.defaultTimezone,
      language: dc.defaultLanguage,
      relayType: dc.defaultRelayType,
      relayIp: dc.defaultRelayIp,
      ntpServers: [...dc.ntpServers],
      ntpServer: dc.ntpServer,
      presetTimes: [...dc.defaultDurations],
      colors: { ...dc.defaultColors },
      colorPalette: [...dc.defaultColorPalette],
      defaultDisplayMode: dc.defaultDisplayMode
    });

    res.json({ ok: true, deletedTemplates, deletedUploads, deletedAccounts, deletedBranding });
    logAction('API', 'admin/reset/all', { deletedTemplates, deletedUploads, deletedAccounts, deletedBranding });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Test direct du relais (par canal) ----
// Permet à l'admin de tester chaque canal indépendamment depuis Réglages →
// Relais. Le canal 1 reste réservé à ON AIR (l'app le réécrira au prochain
// changement d'état) ; les autres canaux sont libres.
app.post('/api/admin/relay/test', requireAdminPassword, (req, res) => {
  try {
    const channel = Number(req.body?.channel);
    const state = !!req.body?.state;
    if (!Number.isFinite(channel) || channel < 1) {
      return res.status(400).json({ error: 'channel invalide' });
    }
    if (!relay) {
      return res.status(503).json({ error: 'Relais USB non détecté' });
    }
    relay.setState(channel, state);
    res.json({ ok: true, channel, state });
    logAction('API', 'admin/relay/test', { channel, state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Branding (logo personnalisé) ----
const brandingDir = path.join(__dirname, 'branding');
function ensureBrandingDir() {
  if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });
}
function findLogoFile() {
  ensureBrandingDir();
  const exts = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
  for (const ext of exts) {
    const p = path.join(brandingDir, `logo.${ext}`);
    if (fs.existsSync(p)) return { path: p, ext };
  }
  return null;
}

// Recalcule la hauteur de tous les objets `logo` dans tous les templates pour
// matcher le ratio du logo actuellement affiché. Appelé après upload OU delete
// du logo studio. Si pas de logo perso → fallback sur le logo bundle de l'app
// (client/dist/logo.png ou client/public/logo.png).
async function reshapeLogosForCurrentBranding() {
  let imgPath;
  const found = findLogoFile();
  if (found) {
    imgPath = found.path;
  } else {
    const fallbacks = [
      path.join(__dirname, '..', '..', 'client', 'dist', 'logo.png'),
      path.join(__dirname, '..', '..', 'client', 'public', 'logo.png')
    ];
    imgPath = fallbacks.find(p => fs.existsSync(p));
  }
  if (!imgPath) return;

  let width, height;
  try {
    // sharp lit PNG/JPG/WebP. SVG : sharp lit aussi mais peut nécessiter une
    // taille cible — on lit metadata qui renvoie la viewBox naturelle si dispo.
    const sharp = require('sharp');
    const meta = await sharp(imgPath).metadata();
    width = meta.width;
    height = meta.height;
  } catch (e) {
    console.warn('[branding] lecture dimensions logo échouée:', e.message);
    return;
  }
  if (!width || !height) return;

  const ratio = width / height;
  const n = templatesManager.reshapeAllLogosToRatio(ratio);
  if (n > 0) {
    io.emit('templatesListChanged');
    console.log(`[branding] ${n} template(s) avec objets logo reshapés (ratio ${ratio.toFixed(3)})`);
  }
}

// GET public — sert le logo si présent, 404 sinon
app.get('/api/branding/logo', (req, res) => {
  const found = findLogoFile();
  if (!found) return res.status(404).json({ error: 'aucun logo' });
  res.sendFile(found.path);
});

// POST admin — upload via multer (multipart) AVANT requireAdminPassword (pour parser req.body)
app.post('/api/branding/logo', uploadMiddleware.single('file'), requireAdminPassword, (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'aucun fichier reçu (champ "file")' });
    const allowed = { 'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg' };
    const ext = allowed[req.file.mimetype];
    if (!ext) return res.status(400).json({ error: 'mimetype non autorisé' });
    ensureBrandingDir();
    // Supprime tous les anciens logos pour éviter les conflits d'extension
    for (const e of ['png','jpg','jpeg','webp','svg']) {
      const p = path.join(brandingDir, `logo.${e}`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    const filepath = path.join(brandingDir, `logo.${ext}`);
    fs.writeFileSync(filepath, req.file.buffer);
    const version = Date.now();
    res.json({ ok: true, ext, sizeBytes: req.file.size, version });
    logAction('API', 'branding/logo upload', { ext, size: req.file.size });
    // Notifie tous les clients connectés (display, design, control) pour
    // qu'ils invalident leur cache d'image et rechargent /api/branding/logo.
    io.emit('brandingChanged', { hasLogo: true, version });
    // Réajuste les cadres logo de tous les templates au nouveau ratio (async,
    // pas bloquant pour la réponse HTTP).
    reshapeLogosForCurrentBranding().catch(e =>
      console.warn('[branding] reshape post-upload échoué:', e.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE admin — supprime le logo personnalisé
app.delete('/api/branding/logo', requireAdminPassword, (req, res) => {
  try {
    const found = findLogoFile();
    if (!found) return res.json({ ok: true, removed: false });
    fs.unlinkSync(found.path);
    const version = Date.now();
    res.json({ ok: true, removed: true, version });
    logAction('API', 'branding/logo delete', {});
    io.emit('brandingChanged', { hasLogo: false, version });
    // Réajuste les cadres logo au ratio du logo de fallback (logo bundle de l'app).
    reshapeLogosForCurrentBranding().catch(e =>
      console.warn('[branding] reshape post-delete échoué:', e.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lire l'état/logs du service d'update
app.post('/api/admin/update/status', requireAdminPassword, async (req, res) => {
  try {
    const [activeRes, logRes] = await Promise.all([
      execShell('systemctl', ['is-active', 'onair-update.service']).catch((e) => ({ stdout: e.stdout || 'unknown' })),
      execShell('journalctl', ['-u', 'onair-update.service', '-n', '50', '--no-pager', '-o', 'cat']).catch((e) => ({ stdout: e.stdout || '' }))
    ]);
    res.json({
      active: activeRes.stdout.trim(),
      logs: logRes.stdout.trim().split('\n').slice(-50)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Endpoints templates =====

// Création (admin)
app.post('/api/templates', requireAdminPassword, (req, res) => {
  try {
    const { name, canvas, factorySlug, category } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name requis' });
    // Si un factorySlug est fourni, on clone son contenu (canvas + objects +
    // category) mais on garde le `name` choisi par l'utilisateur. Sinon création
    // vierge — la catégorie vient du body (default 'horloge').
    let cloneCanvas = canvas;
    let cloneObjects = undefined;
    let cloneCategory = category;
    if (factorySlug) {
      const factory = factoryTemplates.getFactoryTemplate(factorySlug);
      if (!factory) return res.status(404).json({ error: `factory '${factorySlug}' introuvable` });
      cloneCanvas = canvas || factory.canvas;
      cloneObjects = (factory.objects || []).map(o => ({
        ...o,
        // Réassigne un nouvel id pour éviter les collisions si l'utilisateur clone plusieurs fois
        id: `${o.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        props: { ...o.props }
      }));
      cloneCategory = category || factory.category;
    }
    const t = templatesManager.createTemplate({ name, canvas: cloneCanvas, objects: cloneObjects, category: cloneCategory });
    io.emit('templatesListChanged', templatesManager.listTemplates());
    res.json(t);
    logAction('API', 'templates/create', { id: t.id, name, category: t.category, factorySlug: factorySlug || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Liste des templates "factory" disponibles dans le modal Nouveau (public,
// lecture seule). L'utilisateur peut sélectionner l'un d'eux comme point
// de départ — l'app crée alors une copie indépendante.
app.get('/api/templates/factory', (req, res) => {
  res.json(factoryTemplates.listFactoryTemplates());
});

// Liste (publique) — nécessaire au ControlPanel pour afficher et basculer entre
// les templates (action de contrôle, au même niveau que start/stop du timer).
// Seuls les noms et IDs transitent, pas les objets internes.
app.post('/api/templates/list', (req, res) => {
  try { res.json(templatesManager.listTemplates()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Template actif (public, GET) — renvoie un template actif :
//   ?mode=running : template assigné au slot running
//   ?mode=stopped : template assigné au slot stopped
//   sans paramètre : template du mode chrono courant (comportement du display)
app.get('/api/templates/active', (req, res) => {
  try {
    let mode = req.query.mode;
    if (mode !== 'running' && mode !== 'stopped') {
      mode = timerState.isRunning ? 'running' : 'stopped';
    }
    const t = templatesManager.getActiveTemplateForMode(mode);
    if (!t) return res.status(404).json({ error: 'aucun template actif pour le mode ' + mode });
    res.json(t);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lecture par id (admin, POST pour auth body)
app.post('/api/templates/:id/get', requireAdminPassword, (req, res) => {
  try {
    const t = templatesManager.getTemplate(req.params.id);
    if (!t) return res.status(404).json({ error: 'template introuvable' });
    res.json(t);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mise à jour (admin)
app.put('/api/templates/:id', requireAdminPassword, (req, res) => {
  try {
    const patch = { ...req.body };
    delete patch.password;
    const t = templatesManager.updateTemplate(req.params.id, patch);
    if (!t) return res.status(404).json({ error: 'template introuvable' });
    io.emit('templatesListChanged', templatesManager.listTemplates());
    // Si le template mis à jour est l'actif du mode courant, pousse la nouvelle version.
    const currentMode = timerState.isRunning ? 'running' : 'stopped';
    const currentActiveId = templatesManager.getActiveTemplateIdForMode(currentMode);
    if (currentActiveId === req.params.id) {
      lastEmittedTemplateId = req.params.id;
      io.emit('templateChanged', t);
    }
    res.json(t);
    logAction('API', 'templates/update', { id: t.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Suppression (admin)
app.delete('/api/templates/:id', requireAdminPassword, (req, res) => {
  try {
    const ok = templatesManager.deleteTemplate(req.params.id);
    if (!ok) return res.status(404).json({ error: 'template introuvable' });
    io.emit('templatesListChanged', templatesManager.listTemplates());
    res.json({ deleted: true });
    logAction('API', 'templates/delete', { id: req.params.id });
  } catch (err) {
    if (err.code === 'ACTIVE_TEMPLATE') return res.status(409).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Activation (publique) — activer/désactiver un template pour un mode chrono donné.
// Body: { mode: 'running'|'stopped', active: true|false }
// Si `mode` est absent, active le template pour les deux modes (rétrocompat).
// Action de contrôle, au même niveau que start/stop timer (pas d'auth admin).
app.post('/api/templates/:id/activate', (req, res) => {
  try {
    const { mode, active } = req.body;
    const isActive = active !== false; // défaut true
    let result;
    if (mode) {
      result = templatesManager.setActiveForMode(req.params.id, mode, isActive);
    } else {
      // Legacy : active sur les deux modes
      templatesManager.setActiveForMode(req.params.id, 'running', true);
      result = templatesManager.setActiveForMode(req.params.id, 'stopped', true);
    }
    if (!result) return res.status(404).json({ error: 'template introuvable' });
    reconcileActiveTemplate(true); // force l'émission : l'admin attend un feedback immédiat
    io.emit('templatesListChanged', templatesManager.listTemplates());
    res.json({
      activated: isActive,
      mode: mode || 'both',
      activeRunningTemplateId: result.activeRunningTemplateId,
      activeStoppedTemplateId: result.activeStoppedTemplateId
    });
    logAction('API', 'templates/activate', { id: req.params.id, mode: mode || 'both', active: isActive });
  } catch (err) {
    if (err.code === 'INVALID_MODE') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ===== Endpoints Calendar (ICS proxy) =====
// Le client envoie l'URL ICS + un mot-clé optionnel de filtrage titre.
// Le serveur valide que l'URL pointe bien vers calendar.google.com (anti-SSRF),
// télécharge l'ICS, parse, renvoie les événements du jour. Cache 5 min.

app.get('/api/calendar/events', async (req, res) => {
  try {
    const icsUrl = req.query.icsUrl;
    const titleKeyword = req.query.titleKeyword || null;
    if (!icsUrl) return res.status(400).json({ error: 'icsUrl requis' });
    const result = await icsCalendar.listEventsForToday(icsUrl, titleKeyword);
    res.json(result);
  } catch (err) {
    if (err.code === 'INVALID_URL') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ===== Endpoints Calendar V3 — multi-provider (Google / Microsoft / Apple CalDAV) =====
//
// Les credentials OAuth (client_id/secret) sont saisis dans Settings par l'admin
// — mode (b) du design : pas de credentials globaux, chaque studio configure les siens.
// Les comptes connectés et leurs tokens sont stockés chiffrés (AES-256-GCM).

const googleProv = require('./calendar/providers/google');
const microsoftProv = require('./calendar/providers/microsoft');
const caldavProv = require('./calendar/providers/caldav');

calendarManager.setSocketServer(io);
calendarManager.startPolling(() => config.timezone);

// Le redirect_uri est fourni par le client (window.location.origin + path).
// Cause : en dev, Vite (5173) proxifie /api vers Node (3333) et req.get('host')
// renvoie alors '127.0.0.1:3333' (changeOrigin), ce qui ne correspond pas à
// l'URL affichée à l'utilisateur (qui doit être collée dans la console OAuth).
// En envoyant l'URL depuis le client, on garantit la cohérence UI ↔ provider.
function resolveOAuthRedirectUri(req, provider) {
  const provided = req.body && req.body.redirectUri;
  if (provided) {
    try {
      const u = new URL(provided);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('protocol');
      const expected = `/api/calendar/${provider}/callback`;
      if (u.pathname !== expected) throw new Error(`path attendu ${expected}`);
      return u.toString().replace(/\/$/, '');
    } catch (e) {
      throw new Error('redirectUri invalide : ' + e.message);
    }
  }
  // Fallback (anciens clients) — utilise les headers du request
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host');
  return `${proto}://${host}/api/calendar/${provider}/callback`;
}

// ── Credentials OAuth (admin-only) ─────────────────────────────────────────

app.post('/api/calendar/credentials/get', requireAdminPassword, (req, res) => {
  res.json(calendarStorage.getCredentialsPublic());
});

app.post('/api/calendar/credentials', requireAdminPassword, (req, res) => {
  try {
    const { provider, clientId, clientSecret, tenant } = req.body;
    if (!['google', 'microsoft'].includes(provider)) {
      return res.status(400).json({ error: 'provider doit être google|microsoft' });
    }
    calendarStorage.setCredentials(provider, { clientId, clientSecret, tenant });
    io.emit('calendarCredentialsChanged');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Comptes connectés (admin-only) ─────────────────────────────────────────

app.post('/api/calendar/accounts/list', requireAdminPassword, (req, res) => {
  res.json(calendarStorage.listAccounts());
});

app.delete('/api/calendar/accounts/:id', requireAdminPassword, (req, res) => {
  calendarStorage.deleteAccount(req.params.id);
  io.emit('calendarAccountsChanged');
  res.json({ ok: true });
});

app.post('/api/calendar/accounts/:id/refresh', requireAdminPassword, async (req, res) => {
  try {
    const calendars = await calendarManager.refreshAccountCalendars(req.params.id);
    io.emit('calendarAccountsChanged');
    res.json({ ok: true, calendars });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/calendar/accounts/:id/rename', requireAdminPassword, (req, res) => {
  const { label } = req.body;
  const acc = calendarStorage.getAccount(req.params.id);
  if (!acc) return res.status(404).json({ error: 'compte introuvable' });
  acc.label = label || acc.accountEmail || acc.id;
  calendarStorage.saveAccount(acc);
  io.emit('calendarAccountsChanged');
  res.json({ ok: true });
});

// ── OAuth flows Google / Microsoft ─────────────────────────────────────────
// Phase 1 (admin) : génère l'URL d'autorisation. Le state est signé HMAC et
// porte le provider + une expiration (10 min) — pas besoin de stocker côté serveur.
//
// Phase 2 (callback) : Google/MS redirigent ici avec ?code&state.
// On vérifie le state, échange le code, sauvegarde le compte chiffré, puis
// renvoie une page HTML qui ferme la fenêtre et notifie le parent.

app.post('/api/calendar/google/authorize', requireAdminPassword, (req, res) => {
  try {
    const redirectUri = resolveOAuthRedirectUri(req, 'google');
    console.log('[OAuth Google] redirect_uri envoyé à Google :', redirectUri);
    const state = calendarCrypto.signState({
      provider: 'google',
      redirectUri,
      exp: Math.floor(Date.now() / 1000) + 600
    });
    const url = googleProv.buildAuthUrl({ redirectUri, state });
    res.json({ url, redirectUri });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/calendar/microsoft/authorize', requireAdminPassword, (req, res) => {
  try {
    const redirectUri = resolveOAuthRedirectUri(req, 'microsoft');
    console.log('[OAuth Microsoft] redirect_uri envoyé :', redirectUri);
    const state = calendarCrypto.signState({
      provider: 'microsoft',
      redirectUri,
      exp: Math.floor(Date.now() / 1000) + 600
    });
    const url = microsoftProv.buildAuthUrl({ redirectUri, state });
    res.json({ url, redirectUri });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

async function handleOAuthCallback(req, res, provider, exchanger) {
  try {
    const { code, state, error, error_description } = req.query;
    if (error) throw new Error(`${error}: ${error_description || ''}`);
    if (!code || !state) throw new Error('code ou state manquant');
    const payload = calendarCrypto.verifyState(state);
    if (!payload || payload.provider !== provider) throw new Error('state invalide ou expiré');
    const { tokens, accountEmail } = await exchanger({ code, redirectUri: payload.redirectUri });

    const id = calendarStorage.newAccountId(provider);
    const account = {
      id, provider,
      label: accountEmail || `Compte ${provider}`,
      accountEmail: accountEmail || null,
      tokensEnc: null,
      calendars: [],
      lastSyncAt: null,
      lastError: null
    };
    calendarStorage.saveAccount(account);
    calendarStorage.updateTokens(id, tokens);
    // Récupère immédiatement la liste des calendriers
    try {
      const calendars = await calendarManager.refreshAccountCalendars(id);
      calendarStorage.setAccountSync(id, { calendars });
    } catch (e) {
      console.warn(`[calendar] post-connect ${provider}:`, e.message);
    }
    io.emit('calendarAccountsChanged');
    res.send(callbackHtml({ ok: true, provider, accountEmail }));
  } catch (e) {
    res.status(400).send(callbackHtml({ ok: false, provider, error: e.message }));
  }
}

app.get('/api/calendar/google/callback', (req, res) =>
  handleOAuthCallback(req, res, 'google', googleProv.exchangeCode));

app.get('/api/calendar/microsoft/callback', (req, res) =>
  handleOAuthCallback(req, res, 'microsoft', microsoftProv.exchangeCode));

function callbackHtml({ ok, provider, accountEmail, error }) {
  const status = ok ? 'success' : 'error';
  // Whitelist provider à un set connu — défense supplémentaire contre toute
  // valeur exotique qui aurait échappé à la validation upstream.
  const safeProvider = (provider === 'google' || provider === 'microsoft') ? provider : 'unknown';
  const messageHtml = ok
    ? `Compte ${escHtml(safeProvider)} connecté${accountEmail ? ` (${escHtml(accountEmail)})` : ''}.`
    : `Erreur : ${escHtml(error)}`;
  return `<!doctype html>
<meta charset="utf-8">
<title>OnAir Studio — ${ok ? 'Connecté' : 'Erreur'}</title>
<style>
  body { background:#06090f; color:#cbd5e1; font-family:Inter,system-ui,sans-serif; margin:0;
    display:grid; place-items:center; height:100vh; }
  .card { background:#0f172a; border:1px solid rgba(255,255,255,0.08); border-radius:12px;
    padding:24px 32px; max-width:420px; text-align:center; }
  .ok    { color:#22c55e; }
  .err   { color:#ef4444; }
  small  { color:#64748b; }
</style>
<div class="card">
  <h2 class="${ok ? 'ok' : 'err'}">${ok ? '✓' : '✕'} ${ok ? 'Connecté' : 'Erreur'}</h2>
  <p>${messageHtml}</p>
  <small>Cette fenêtre se ferme automatiquement…</small>
</div>
<script>
  try { window.opener && window.opener.postMessage({ type:'oauth-${status}', provider:'${safeProvider}' }, '*'); } catch(e){}
  setTimeout(() => window.close(), 1200);
</script>`;
}

// ── CalDAV (Apple) — connect via login + app-specific password ─────────────

app.post('/api/calendar/apple/connect', requireAdminPassword, async (req, res) => {
  try {
    const { username, password, label, serverUrl } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username + password requis' });
    const { accountEmail, homeUrl, calendars } = await caldavProv.connect({
      serverUrl, username, password
    });
    const id = calendarStorage.newAccountId('apple');
    const account = {
      id, provider: 'apple',
      label: label || accountEmail,
      accountEmail,
      tokensEnc: null,
      calendars,
      lastSyncAt: null,
      lastError: null
    };
    calendarStorage.saveAccount(account);
    calendarStorage.updateTokens(id, caldavProv.buildTokens({ serverUrl, username, password, homeUrl }));
    io.emit('calendarAccountsChanged');
    res.json({ ok: true, id, accountEmail, calendars });
  } catch (e) {
    // Log côté serveur pour diagnostiquer les échecs CalDAV (auth iCloud, XML
    // inattendu, etc.) — le client ne voit que e.message synthétique.
    console.error('[calendar/apple/connect] échec :', e.message);
    // Diagnostic plus parlant pour l'utilisateur selon le type d'erreur.
    let userMsg = e.message;
    if (/401/.test(e.message) || /PROPFIND principal/.test(e.message)) {
      userMsg = "Authentification iCloud refusée. Vérifiez l'Apple ID et le mot de passe pour application (format xxxx-xxxx-xxxx-xxxx).";
    } else if (/principal introuvable/i.test(e.message) || /calendar-home/i.test(e.message)) {
      userMsg = 'Réponse iCloud inattendue. Vérifiez que le compte autorise CalDAV (vérification 2FA active + mot de passe pour application valide).';
    } else if (/fetch/i.test(e.message) || /ENOTFOUND|ETIMEDOUT|ECONN/i.test(e.message)) {
      userMsg = 'Serveur iCloud injoignable. Vérifiez la connexion réseau.';
    }
    res.status(400).json({ error: userMsg });
  }
});

// ── Events (lecture publique côté display, mais on demande un accountId valide) ─

app.get('/api/calendar/v2/events', async (req, res) => {
  try {
    const { accountId, range = 'today' } = req.query;
    if (!accountId) return res.status(400).json({ error: 'accountId requis' });
    if (!['today', 'week'].includes(range)) return res.status(400).json({ error: 'range invalide' });
    const tz = config.timezone;
    const events = await calendarManager.getEvents(accountId, range, tz);
    res.json({ accountId, range, events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== Endpoints Vidéo (NDI / SDI) =====
//
// NDI : nécessite l'install de NDI Tools + la dep npm `grandiose`.
// Tant que ce n'est pas fait, /status renvoie available:false avec un hint.
//
// SDI / Decklink : pas encore implémenté — endpoint stub renvoie en cours de dev.

app.get('/api/video/ndi/status', (req, res) => {
  res.json(ndiModule.getStatus());
});

app.get('/api/video/ndi/sources', async (req, res) => {
  try {
    const result = await ndiModule.listSources();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message, available: false, sources: [] });
  }
});

app.post('/api/video/ndi/start', requireAdminPassword, async (req, res) => {
  try {
    const { sourceName } = req.body;
    if (!sourceName) return res.status(400).json({ error: 'sourceName requis' });
    const result = await ndiModule.startReceiver(sourceName);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/video/ndi/stop', requireAdminPassword, (req, res) => {
  const { sourceName } = req.body;
  if (sourceName) ndiModule.stopReceiver(sourceName);
  res.json({ ok: true });
});

// Flux MJPEG d'une source NDI — consommable directement par <img src="...">
// Pas d'auth (le display public doit pouvoir s'y connecter).
app.get('/api/video/ndi/stream', async (req, res) => {
  const sourceName = req.query.sourceName;
  const quality = req.query.quality || 'standard';
  if (!sourceName) return res.status(400).json({ error: 'sourceName requis' });
  await ndiModule.streamMjpeg(sourceName, res, quality);
});

app.get('/api/video/sdi/status', (req, res) => {
  res.json({
    available: false,
    error: null,
    hint: 'Decklink / SDI : implémentation prévue dans une prochaine version. Branche une carte Blackmagic et reviens plus tard.'
  });
});

// ===== Endpoints uploads =====

// IMPORTANT : uploadMiddleware AVANT requireAdminPassword — multer parse le multipart/form-data
// et peuple req.body avec les champs texte (dont `password`). Si on mettait requireAdminPassword
// en premier, req.body serait vide (le body-parser JSON ne gère pas multipart).
app.post('/api/uploads', uploadMiddleware.single('file'), requireAdminPassword, (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'aucun fichier reçu (champ "file")' });
    const asset = uploadsManager.saveAsset({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype
    });
    io.emit('uploadsChanged', uploadsManager.listAssets());
    res.json(asset);
    logAction('API', 'uploads/new', { assetId: asset.assetId, size: req.file.size });
  } catch (err) {
    if (err.code === 'BAD_MIMETYPE') return res.status(400).json({ error: err.message });
    if (err.code === 'TOO_LARGE')    return res.status(413).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Liste (POST avec auth body, cohérent avec /api/templates/list)
app.post('/api/uploads/list', requireAdminPassword, (req, res) => {
  try { res.json(uploadsManager.listAssets()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/uploads/:assetId', requireAdminPassword, (req, res) => {
  try {
    const ok = uploadsManager.deleteAsset(req.params.assetId);
    if (!ok) return res.status(404).json({ error: 'asset introuvable' });
    io.emit('uploadsChanged', uploadsManager.listAssets());
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Route catch-all pour le client React (déplacée juste avant le listen)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        next(); // Passer au prochain middleware pour les routes API
    } else {
        res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
    }
});

// Bootstrap des templates factory au premier démarrage UNIQUEMENT.
// Si l'utilisateur a déjà au moins un template (custom ou cloné), on ne touche
// à rien — il a fait son tri, ses choix sont respectés. La modale "Nouveau
// template" reste disponible pour cloner un factory à la demande.
function bootstrapFactoryTemplates() {
  const idx = templatesManager.listTemplates();
  if (idx.templates.length > 0) return;

  const factories = factoryTemplates.listFactoryTemplates();
  if (factories.length === 0) {
    console.log('[templates] Aucun factory template trouvé, bootstrap ignoré');
    return;
  }
  for (const f of factories) {
    const full = factoryTemplates.getFactoryTemplate(f.slug);
    if (!full) continue;
    templatesManager.createTemplate({
      name: full.name,
      canvas: full.canvas,
      objects: full.objects,
      category: full.category
    });
  }
  console.log(`[templates] Bootstrap factory : ${factories.length} template(s) clonés`);
}
bootstrapFactoryTemplates();

// ── Sonde périodique du relais USB — détection hot-plug (branchement / débranchement)
// Toutes les 5 s :
//   - si on a un handle `relay`, on ré-applique LEDOnAir (write idempotent). Si ça jette,
//     on marque déconnecté.
//   - si pas de handle, on tente `new USBRelay()` pour détecter une reconnexion, et on
//     restaure l'état LED attendu.
// Le statut est diffusé via `emitTimerState()` uniquement si il change (pas de spam).
const USB_PROBE_INTERVAL_MS = 5000;
setInterval(() => {
  const wasConnected = !!relay;
  if (relay) {
    try {
      relay.setState(1, LEDOnAir);
      if (!timerState.usbRelayStatus) {
        timerState.usbRelayStatus = true;
        emitTimerState();
      }
    } catch (err) {
      console.warn('[USB] Relais non-réactif — marqué déconnecté :', err.message);
      relay = null;
      if (timerState.usbRelayStatus) {
        timerState.usbRelayStatus = false;
        emitTimerState();
      }
    }
  } else {
    try {
      relay = new USBRelay();
      console.log('[USB] Relais (re)connecté détecté');
      try { relay.setState(1, LEDOnAir); } catch { /* restore LED best-effort */ }
      if (!timerState.usbRelayStatus) {
        timerState.usbRelayStatus = true;
        emitTimerState();
      }
    } catch {
      // toujours déconnecté — rien à émettre
      if (wasConnected === false && timerState.usbRelayStatus) {
        timerState.usbRelayStatus = false;
        emitTimerState();
      }
    }
  }
}, USB_PROBE_INTERVAL_MS);

const PORT = process.env.PORT || 3333;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
}); 