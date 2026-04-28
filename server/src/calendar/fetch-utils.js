// Wrapper sur fetch avec un timeout dur (AbortController).
//
// Indispensable pour les appels aux APIs cloud (Google, Microsoft, CalDAV) :
// le fetch natif de Node n'a aucun timeout par défaut → un studio offline
// voit ses requêtes vers Google/Microsoft hanger indéfiniment, et le polling
// 5 min empile des promesses jamais résolues qui finissent par saturer
// l'event loop ou les connexions HTTP keep-alive.
//
// Toujours utiliser ce helper pour tout fetch sortant vers Internet.

const DEFAULT_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error(`fetch timeout (${timeoutMs}ms) → ${url}`);
      e.code = 'FETCH_TIMEOUT';
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchWithTimeout };
