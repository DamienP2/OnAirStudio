// Découverte NDI via mDNS (Bonjour) — 100 % JS, aucune lib native.
//
// NDI annonce ses sources sur le service `_ndi._tcp.local` (mDNS standard).
// On écoute en permanence : `up` quand une nouvelle source apparaît, `down`
// quand elle disparaît. Pas de polling, pas de finder à recréer, pas de
// segfault possible.
//
// Format renvoyé identique à grandiose.find() pour rester drop-in :
//   [ { name: "FI014222 (Test Patterns)", urlAddress: "192.168.1.89:5961" } ]

const { Bonjour } = require('bonjour-service');

const sources = new Map(); // name → { name, urlAddress, host, addresses }
let bonjour = null;
let browser = null;
let stoppedAt = 0;

function pickIPv4(addresses) {
  return addresses.find(a => /^\d+\.\d+\.\d+\.\d+$/.test(a)) || addresses[0] || null;
}

function start() {
  if (bonjour) return;
  bonjour = new Bonjour();
  browser = bonjour.find({ type: 'ndi' });
  browser.on('up', s => {
    const ipv4 = pickIPv4(s.addresses || []);
    if (!ipv4) return;
    sources.set(s.name, {
      name: s.name,
      urlAddress: `${ipv4}:${s.port}`,
      host: s.host,
      addresses: s.addresses
    });
  });
  browser.on('down', s => {
    sources.delete(s.name);
  });
}

function listSources() {
  if (!bonjour) start();
  return Array.from(sources.values()).map(s => ({ name: s.name, urlAddress: s.urlAddress }));
}

function findSource(name) {
  return sources.get(name) || null;
}

function stop() {
  if (browser) try { browser.stop(); } catch {}
  if (bonjour) try { bonjour.destroy(); } catch {}
  bonjour = null;
  browser = null;
  sources.clear();
  stoppedAt = Date.now();
}

module.exports = { start, listSources, findSource, stop };
