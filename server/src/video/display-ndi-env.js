// server/src/video/display-ndi-env.js
//
// Détection des prérequis pour la sortie NDI du /display :
//   • ffmpeg (binaire système)
//   • Display X11 actif (variable DISPLAY ou socket /tmp/.X11-unix/X0)
//
// Retourne { ok: bool, ffmpeg: bool, display: string|null, reason: string|null }.

const { execSync } = require('child_process');
const fs = require('fs');

function hasFfmpeg() {
  try {
    execSync('command -v ffmpeg', { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function detectDisplay() {
  // 1. Variable d'env DISPLAY (cas standard sous Ubuntu Desktop)
  if (process.env.DISPLAY) return process.env.DISPLAY;
  // 2. Socket X11 sur /tmp/.X11-unix/X0 → DISPLAY=:0 par convention
  try {
    if (fs.existsSync('/tmp/.X11-unix/X0')) return ':0';
  } catch { /* ignore */ }
  return null;
}

function check() {
  const ffmpeg = hasFfmpeg();
  const display = detectDisplay();
  if (!ffmpeg) {
    return { ok: false, ffmpeg, display, reason: 'ffmpeg introuvable — installer via "sudo apt install ffmpeg"' };
  }
  if (!display) {
    return { ok: false, ffmpeg, display, reason: 'aucun display X11 détecté (DISPLAY non défini)' };
  }
  return { ok: true, ffmpeg, display, reason: null };
}

module.exports = { check, hasFfmpeg, detectDisplay };
