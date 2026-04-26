// NDI worker — sous-process isolé qui contient toute la lib native (grandiose + sharp).
// Si la lib crash (segfault dû à incompat ABI grandiose ↔ NDI SDK 6.x), seul ce
// process meurt — le serveur principal continue de tourner.
//
// Communication parent ↔ worker :
//   • Le parent envoie des commandes via stdin lignes JSON :
//       {"cmd":"discover"}                   → demande la liste des sources
//       {"cmd":"start","source":{name,url}}  → démarre la réception d'une source
//       {"cmd":"stop"}                       → arrête la réception
//   • Le worker écrit sur stdout :
//       - Lignes JSON commençant par "JSON\t" pour le contrôle (status, sources, errors)
//       - Frames binaires : [4 bytes length BE][JPEG bytes] préfixées par "FRM\n"
//   • stderr est utilisé pour le logging textuel (visible dans les logs serveur).

'use strict';

const grandiose = require('grandiose');
const sharp = require('sharp');

// Profils de qualité — sélectionnables depuis l'inspector.
//   eco       : NDI proxy (LOWEST), 854px, JPEG 50, 20 fps  → CPU/réseau minimum
//   standard  : NDI proxy (LOWEST), 1280px, JPEG 65, 25 fps → équilibre par défaut
//   high      : NDI HIGHEST, 1920px, JPEG 80, 30 fps        → qualité max
const QUALITY_PROFILES = {
  eco:      { bandwidth: 'LOWEST',  maxWidth: 854,  jpegQuality: 50, targetFps: 20 },
  standard: { bandwidth: 'LOWEST',  maxWidth: 1280, jpegQuality: 65, targetFps: 25 },
  high:     { bandwidth: 'HIGHEST', maxWidth: 1920, jpegQuality: 80, targetFps: 30 }
};
const FRAME_TIMEOUT_MS = 2000;

let receiverActive = false;
let currentSource = null;

function send(obj) {
  process.stdout.write(`JSON\t${JSON.stringify(obj)}\n`);
}

// Renvoie true si la frame a été écrite, false si stdout est saturé (skip).
// On utilise la valeur de retour de write() comme indicateur de backpressure.
// IMPORTANT : si on attend `drain`, on retient la dernière frame trop longtemps,
// donc on préfère skip et laisser la prochaine itération (avec une frame plus
// récente) écrire dès que la pipe se libère.
function sendFrame(jpegBuf) {
  const header = Buffer.alloc(8);
  header.write('FRM\n', 0, 4, 'ascii');
  header.writeUInt32BE(jpegBuf.length, 4);
  // 2 writes consécutifs pour préserver l'atomicité de la séquence header+payload
  // (les pipes Node garantissent l'ordre mais pas l'atomicité multi-writes
  //  sur des pipes non-binaires — ici stdout est en mode pipe binaire).
  const ok1 = process.stdout.write(header);
  const ok2 = process.stdout.write(jpegBuf);
  return ok1 && ok2;
}

async function discover() {
  try {
    const sources = await grandiose.find({ showLocalSources: true }, 1500);
    send({ type: 'sources', sources: (sources || []).map(s => ({ name: s.name, urlAddress: s.urlAddress })) });
    // Flush stdout puis exit immédiat avec _exit pour court-circuiter le destructeur
    // C++ du finder NDI (qui peut segfaulter avec certains SDK NDI 6.x).
    // Le résultat est déjà parti, on n'a plus rien à faire.
    process.stdout.write('', () => {
      // Bypass des finalizers Node — saut direct vers exit système
      process.kill(process.pid, 'SIGKILL');
    });
  } catch (e) {
    send({ type: 'error', op: 'discover', message: e.message });
  }
}

async function startReceive(source, qualityName) {
  if (receiverActive) {
    send({ type: 'error', op: 'start', message: 'receiver déjà actif — stop d\'abord' });
    return;
  }
  const profile = QUALITY_PROFILES[qualityName] || QUALITY_PROFILES.standard;
  const minFrameInterval = 1000 / profile.targetFps;

  currentSource = source;
  receiverActive = true;
  send({ type: 'started', source: source.name, profile: qualityName });

  let receiver;
  try {
    receiver = await grandiose.receive({
      source: { name: source.name, urlAddress: source.urlAddress },
      // RGBX_RGBA : 4 bytes/pixel, directement consommable par sharp.
      // Le SDK NDI fait la conversion YUV→RGBX en SIMD si besoin.
      colorFormat: grandiose.COLOR_FORMAT_RGBX_RGBA,
      bandwidth: profile.bandwidth === 'HIGHEST' ? grandiose.BANDWIDTH_HIGHEST : grandiose.BANDWIDTH_LOWEST,
      allowVideoFields: false
    });
  } catch (e) {
    send({ type: 'error', op: 'receive-init', message: e.message });
    receiverActive = false;
    return;
  }

  // ── Frame skipper ────────────────────────────────────────────────────────
  // Découplage réception / encodage : la boucle reception garde uniquement la
  // *dernière* frame reçue (on jette les précédentes si l'encodage n'a pas suivi).
  // C'est ce qui élimine le lag : l'encoder n'accumule jamais de retard.
  let latestFrame = null;
  let framesReceived = 0;
  let framesEncoded = 0;
  let framesDropped = 0;

  // Tâche 1 — reçoit les frames en continu, garde uniquement la plus récente.
  (async () => {
    while (receiverActive) {
      let frame;
      try {
        frame = await receiver.video(FRAME_TIMEOUT_MS);
      } catch (e) {
        if (!receiverActive) break;
        if (/timeout/i.test(e.message)) continue;
        if (/non-video data/i.test(e.message)) continue;
        if (/no video data received/i.test(e.message)) continue;
        process.stderr.write(`[ndi-worker] video error: ${e.message}\n`);
        continue;
      }
      if (!frame || frame.type !== 'video') continue;
      if (latestFrame) framesDropped++;  // l'ancienne frame n'a pas été encodée
      latestFrame = frame;
      framesReceived++;
    }
  })();

  // Tâche 2 — encode + push, throttlée à TARGET_FPS pour ne pas saturer la pipe.
  let lastSentAt = 0;
  while (receiverActive) {
    if (!latestFrame) {
      await sleep(5);
      continue;
    }
    // Cap fps : si on a envoyé une frame il y a moins que l'intervalle cible, on attend
    const elapsed = Date.now() - lastSentAt;
    if (elapsed < minFrameInterval) {
      await sleep(minFrameInterval - elapsed);
      continue;
    }
    // Si la pipe stdout est saturée, on attend qu'elle drain — pendant ce temps
    // latestFrame continue d'être écrasée par les nouvelles frames reçues.
    // À la sortie de l'attente, on encode la frame la plus récente.
    if (process.stdout.writableNeedDrain) {
      await new Promise(resolve => process.stdout.once('drain', resolve));
    }
    const frame = latestFrame;
    latestFrame = null;
    // Validation : si le buffer ne fait pas la taille attendue pour du RGBX (4 channels),
    // on skip plutôt que crasher sharp. Couvre les cas où NDI renvoie un format
    // inattendu (UYVY, etc.) au lieu de RGBX.
    const expectedSize = frame.xres * frame.yres * 4;
    if (frame.data.length !== expectedSize) {
      const channels = Math.round(frame.lineStrideBytes / frame.xres);
      if (framesEncoded === 0 || (Date.now() - lastSentAt) > 1000) {
        process.stderr.write(
          `[ndi-worker] format inattendu : ${frame.xres}x${frame.yres}, ` +
          `got ${frame.data.length} bytes (channels=${channels}), expected ${expectedSize} (RGBX). Skip.\n`
        );
      }
      continue;
    }
    try {
      const jpeg = await sharp(frame.data, {
        raw: { width: frame.xres, height: frame.yres, channels: 4 }
      })
        .resize(profile.maxWidth, null, { withoutEnlargement: true })
        .jpeg({ quality: profile.jpegQuality })
        .toBuffer();
      sendFrame(jpeg);
      framesEncoded++;
      lastSentAt = Date.now();
    } catch (e) {
      process.stderr.write(`[ndi-worker] encode error: ${e.message}\n`);
    }
  }

  send({
    type: 'stopped',
    source: currentSource ? currentSource.name : null,
    framesReceived, framesEncoded, framesDropped
  });
  process.stdout.write('', () => {
    process.kill(process.pid, 'SIGKILL');
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Lecture des commandes depuis stdin (JSON par ligne) ─────────────────────

let stdinBuffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  stdinBuffer += chunk;
  let nl;
  while ((nl = stdinBuffer.indexOf('\n')) >= 0) {
    const line = stdinBuffer.slice(0, nl).trim();
    stdinBuffer = stdinBuffer.slice(nl + 1);
    if (!line) continue;
    let cmd;
    try { cmd = JSON.parse(line); }
    catch { continue; }
    handleCommand(cmd);
  }
});
process.stdin.on('end', () => {
  receiverActive = false;
  process.exit(0);
});

function handleCommand(cmd) {
  switch (cmd.cmd) {
    case 'discover': discover(); break;
    case 'start':    startReceive(cmd.source, cmd.quality); break;
    case 'stop':     receiverActive = false; break;
    case 'shutdown': receiverActive = false; setTimeout(() => process.exit(0), 200); break;
    default:
      send({ type: 'error', op: 'cmd', message: `commande inconnue: ${cmd.cmd}` });
  }
}

// Annonce le démarrage
send({ type: 'ready', version: grandiose.version() });
