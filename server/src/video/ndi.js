// Façade NDI — découverte 100 % JS via mDNS + streaming via worker natif isolé.
//
// Architecture :
//   • Discovery : `ndi-discover.js` (Bonjour-service, pure JS)
//     → aucun appel à grandiose.find(), donc aucun risque de SIGSEGV.
//     Le browser mDNS reste actif en permanence ; les sources sont mises à
//     jour automatiquement via les events `up`/`down`.
//
//   • Streaming : `ndi-worker.js` (sous-process avec grandiose + sharp)
//     → 1 worker par source streamée. Si le worker crashe (segfault possible
//       au cleanup du receiver NDI), le serveur principal survit et respawn
//       un nouveau worker tant qu'il y a des subscribers HTTP MJPEG.
//
//     Le worker reçoit la source en {name, urlAddress} via stdin (commande
//     `start`). Pas besoin pour lui de faire un find() interne.
//
// Communication parent ↔ worker stream :
//   • commandes via stdin (lignes JSON)
//   • réponses :
//      - lignes "JSON\t{...}\n" sur stdout pour les events de contrôle
//      - frames binaires "FRM\n[uint32 BE length][jpeg]" pour la vidéo

const { spawn } = require('child_process');
const path = require('path');
const discover = require('./ndi-discover');

let nativeAvailable = true;
let nativeLoadError = null;
try {
  require.resolve('grandiose');
  require.resolve('sharp');
} catch (e) {
  nativeAvailable = false;
  nativeLoadError = e.message;
}

const WORKER_PATH = path.join(__dirname, 'ndi-worker.js');

// Démarre le browser mDNS dès le chargement du module — comme ça la liste
// des sources est déjà à jour quand le 1er client demande.
try { discover.start(); } catch (e) { console.warn('[ndi] mDNS start failed:', e.message); }

// ── Pool de workers chauds ─────────────────────────────────────────────────
// On garde en permanence 1 worker idle (déjà spawné, grandiose+sharp chargés,
// 'ready' reçu) pour que la 1ère connexion n'attende pas le démarrage du process
// (~700-1000ms gagnés par rapport à un cold start).
let warmWorker = null;
let warmReady = false;
let warmReadyResolvers = [];

function spawnWarmWorker() {
  if (warmWorker || !nativeAvailable) return;
  warmWorker = spawnWorker();
  warmReady = false;
  let unhandled = '';
  const parser = makeStdoutParser(
    (msg) => {
      if (msg.type === 'ready') {
        warmReady = true;
        const resolvers = warmReadyResolvers;
        warmReadyResolvers = [];
        resolvers.forEach(r => r());
      }
    },
    () => { /* pas de frames avant 'start' */ }
  );
  warmWorker.stdout.on('data', parser);
  warmWorker.on('exit', () => {
    if (warmWorker) warmWorker = null;
    warmReady = false;
    // Si le warm crash avant utilisation, on en respawn un après 1s
    setTimeout(spawnWarmWorker, 1000);
  });
}

// Récupère le worker chaud (s'il est prêt) ou null. Spawn un nouveau warm en bg.
function takeWarmWorker() {
  if (!warmWorker || !warmReady) return null;
  const w = warmWorker;
  warmWorker = null;
  warmReady = false;
  // Détache le parser warm (le caller va attacher le sien)
  w.stdout.removeAllListeners('data');
  w.removeAllListeners('exit');
  // Spawn le prochain warm immédiatement, en background
  setTimeout(spawnWarmWorker, 50);
  return w;
}

// Pré-chauffe au chargement du module
if (nativeAvailable) setTimeout(spawnWarmWorker, 100);

// ── Helpers spawn / parsing stdout ─────────────────────────────────────────

function spawnWorker() {
  const child = spawn(process.execPath, [WORKER_PATH], {
    stdio: ['pipe', 'pipe', 'inherit']
  });
  child.on('error', (e) => console.error('[ndi] worker spawn error:', e.message));
  return child;
}

function makeStdoutParser(onJson, onFrame) {
  let buf = Buffer.alloc(0);
  let mode = 'header';
  let frameLen = 0;
  return function feed(chunk) {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      if (mode === 'header') {
        if (buf.length < 4) return;
        const head = buf.subarray(0, 4).toString('ascii');
        if (head === 'JSON') {
          const nl = buf.indexOf(0x0A);
          if (nl < 0) return;
          const line = buf.subarray(5, nl).toString('utf8');
          buf = buf.subarray(nl + 1);
          try { onJson(JSON.parse(line)); } catch {}
          continue;
        }
        if (head === 'FRM\n') {
          if (buf.length < 8) return;
          frameLen = buf.readUInt32BE(4);
          buf = buf.subarray(8);
          mode = 'frame';
          continue;
        }
        buf = buf.subarray(1); // resync
        continue;
      }
      if (mode === 'frame') {
        if (buf.length < frameLen) return;
        const frame = buf.subarray(0, frameLen);
        buf = buf.subarray(frameLen);
        mode = 'header';
        onFrame(frame);
      }
    }
  };
}

// ── Discovery (mDNS) ───────────────────────────────────────────────────────

async function listSources() {
  if (!nativeAvailable) return { available: false, sources: [] };
  const sources = discover.listSources();
  return { available: true, sources };
}

// ── Streaming (worker long-vivant par source) ──────────────────────────────

const activeReceivers = new Map(); // sourceName → entry

// Clé d'un receiver = `${sourceName}::${quality}` — comme ça plusieurs viewers
// d'une même source mais à qualités différentes auront chacun leur worker.
function makeKey(sourceName, quality) { return `${sourceName}::${quality || 'standard'}`; }

// Configuration du respawn
const MAX_CONSECUTIVE_CRASHES = 3;     // si dépassé, on abandonne
const CRASH_RESET_AFTER_MS = 30_000;   // après 30s sans crash, on remet le compteur à 0
const NO_VIEWER_GRACE_MS = 5_000;      // grâce avant de killer un worker sans subscriber

function getOrCreateReceiver(sourceName, urlAddress, quality) {
  const key = makeKey(sourceName, quality);
  let entry = activeReceivers.get(key);
  if (entry) return entry;
  entry = {
    sourceName, urlAddress, quality, key,
    child: null,
    subscribers: new Set(),
    lastJpeg: null,
    closing: false,
    respawnTimer: null,
    consecutiveCrashes: 0,
    lastSuccessAt: 0
  };
  activeReceivers.set(key, entry);
  spawnReceiverChild(entry);
  return entry;
}

function spawnReceiverChild(entry) {
  const { sourceName, urlAddress, quality, key } = entry;
  // Tente d'utiliser le worker chaud (spawn pré-fait + grandiose/sharp chargés)
  const fromWarm = takeWarmWorker();
  const child = fromWarm || spawnWorker();
  entry.child = child;
  let receivedStopped = false;

  const startCmd = JSON.stringify({
    cmd: 'start',
    source: { name: sourceName, urlAddress },
    quality: quality || 'standard'
  }) + '\n';

  const parser = makeStdoutParser(
    (msg) => {
      if (msg.type === 'ready') {
        // Worker froid — on attend 'ready' avant de lancer start
        child.stdin.write(startCmd);
      } else if (msg.type === 'error') {
        console.warn('[ndi]', sourceName, msg.op, ':', msg.message);
      } else if (msg.type === 'stopped') {
        receivedStopped = true;
      }
    },
    (jpeg) => {
      entry.lastJpeg = jpeg;
      // Une frame arrivée = signe que ça marche → reset du compteur de crashs
      entry.lastSuccessAt = Date.now();
      entry.consecutiveCrashes = 0;
      for (const res of entry.subscribers) {
        try { writeMjpegFrame(res, jpeg); }
        catch {}
      }
    }
  );
  child.stdout.on('data', parser);

  if (fromWarm) {
    // Worker déjà 'ready' (warm) → on envoie start immédiatement
    child.stdin.write(startCmd);
  }

  child.on('exit', (code, signal) => {
    if (entry.closing || receivedStopped) {
      activeReceivers.delete(key);
      for (const res of entry.subscribers) { try { res.end(); } catch {} }
      entry.subscribers.clear();
      return;
    }
    // Plus aucun viewer → on abandonne ce receiver (pas de respawn)
    if (entry.subscribers.size === 0) {
      activeReceivers.delete(key);
      return;
    }
    // Si dernier succès > seuil, on remet le compteur de crashs à 0 (problème transitoire)
    if (entry.lastSuccessAt && (Date.now() - entry.lastSuccessAt) > CRASH_RESET_AFTER_MS) {
      entry.consecutiveCrashes = 0;
    }
    entry.consecutiveCrashes++;
    if (entry.consecutiveCrashes >= MAX_CONSECUTIVE_CRASHES) {
      console.warn(`[ndi] worker ${key} a crashé ${entry.consecutiveCrashes} fois consécutives — abandon`);
      activeReceivers.delete(key);
      for (const res of entry.subscribers) { try { res.end(); } catch {} }
      entry.subscribers.clear();
      return;
    }
    console.warn(`[ndi] worker ${key} crashed (signal=${signal}, ${entry.consecutiveCrashes}/${MAX_CONSECUTIVE_CRASHES}) — respawn dans 500ms`);
    entry.respawnTimer = setTimeout(() => {
      if (activeReceivers.get(key) === entry && entry.subscribers.size > 0) {
        spawnReceiverChild(entry);
      } else {
        activeReceivers.delete(key);
      }
    }, 500);
  });
  child.on('error', (e) => console.warn(`[ndi] worker ${key} error:`, e.message));
}

// Écrit une frame MJPEG vers un res HTTP. Si le socket est en backpressure
// (browser lent à consommer), on skip la frame pour ce subscriber spécifique
// au lieu de bufferiser. Sinon le browser voit du retard accumulé : il
// affiche les anciennes frames pendant que les nouvelles attendent dans
// son buffer de réception.
function writeMjpegFrame(res, jpeg) {
  if (res.writableNeedDrain || res.destroyed) return false;
  // Si le socket Node a déjà beaucoup de bytes en attente, on jette aussi.
  // 256 KB ≈ 2-4 frames JPEG → au-delà, on accumule du retard perceptible.
  if (res.writableLength > 256 * 1024) return false;
  res.write(`--ndiframe\r\n`);
  res.write(`Content-Type: image/jpeg\r\n`);
  res.write(`Content-Length: ${jpeg.length}\r\n\r\n`);
  res.write(jpeg);
  res.write(`\r\n`);
  return true;
}

async function streamMjpeg(sourceName, res, quality = 'standard') {
  if (!nativeAvailable) {
    if (!res.headersSent) res.status(503).json({ error: 'NDI non disponible (modules natifs absents)' });
    return;
  }
  const found = discover.findSource(sourceName);
  if (!found) {
    if (!res.headersSent) res.status(404).json({ error: `Source NDI introuvable : ${sourceName}` });
    return;
  }
  const entry = getOrCreateReceiver(sourceName, found.urlAddress, quality);
  const key = entry.key;

  res.status(200);
  res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=ndiframe');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Connection', 'close');
  res.flushHeaders && res.flushHeaders();

  if (entry.lastJpeg) writeMjpegFrame(res, entry.lastJpeg);
  entry.subscribers.add(res);

  const cleanup = () => {
    entry.subscribers.delete(res);
    if (entry.subscribers.size === 0) {
      // Petite grâce pour absorber un reload/navigation rapide, puis on libère
      // les ressources NDI (le receiver côté SDK + le sous-process).
      setTimeout(() => {
        if (entry.subscribers.size === 0 && activeReceivers.get(key) === entry) {
          entry.closing = true;
          try { entry.child.stdin.write(JSON.stringify({ cmd: 'shutdown' }) + '\n'); }
          catch {}
        }
      }, NO_VIEWER_GRACE_MS);
    }
  };
  res.on('close', cleanup);
  res.on('error', cleanup);
}

// ── API publique ───────────────────────────────────────────────────────────

function isAvailable() { return nativeAvailable; }

function getStatus() {
  return {
    available: nativeAvailable,
    error: nativeLoadError,
    hint: !nativeAvailable
      ? 'NDI non disponible. Installer NDI Tools (https://ndi.video/tools/) puis « cd server && npm install grandiose sharp ».'
      : null
  };
}

async function startReceiver(sourceName, quality = 'standard') {
  if (!nativeAvailable) throw new Error(getStatus().hint);
  const found = discover.findSource(sourceName);
  if (!found) throw new Error(`Source NDI introuvable : ${sourceName}`);
  getOrCreateReceiver(sourceName, found.urlAddress, quality);
  return { ok: true };
}

function stopReceiver(sourceName, quality) {
  // Si quality non spécifiée, on stoppe tous les workers de cette source
  const targets = quality
    ? [activeReceivers.get(makeKey(sourceName, quality))].filter(Boolean)
    : Array.from(activeReceivers.values()).filter(e => e.sourceName === sourceName);
  for (const entry of targets) {
    entry.closing = true;
    try { entry.child.stdin.write(JSON.stringify({ cmd: 'shutdown' }) + '\n'); }
    catch {}
  }
}

function shutdown() {
  for (const entry of activeReceivers.values()) {
    try { entry.child.kill('SIGTERM'); } catch {}
  }
  activeReceivers.clear();
  try { discover.stop(); } catch {}
}

module.exports = {
  isAvailable,
  getStatus,
  listSources,
  startReceiver,
  stopReceiver,
  streamMjpeg,
  shutdown
};
