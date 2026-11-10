'use strict';
// Cache disque simple : un petit fichier JSON par clé. Ne contient jamais la clé d'API.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function createCache(dir, now = Date.now) {
  const file = (key) => path.join(dir, `${crypto.createHash('sha1').update(String(key)).digest('hex')}.json`);

  // Entrée brute { t, data } quel que soit son âge (sert de secours hors ligne).
  function read(key) {
    try {
      const e = JSON.parse(fs.readFileSync(file(key), 'utf8'));
      return e && typeof e.t === 'number' ? e : null;
    } catch {
      return null;
    }
  }

  // Donnée encore fraîche (âge <= ttlMs) ou undefined.
  function get(key, ttlMs) {
    const e = read(key);
    return e && now() - e.t <= ttlMs ? e.data : undefined;
  }

  function write(key, data) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const f = file(key);
      fs.writeFileSync(`${f}.tmp`, JSON.stringify({ t: now(), data }));
      fs.renameSync(`${f}.tmp`, f);
    } catch {
      // cache indisponible : on continue sans
    }
  }

  function clear() {
    let n = 0;
    try {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.json') || f.endsWith('.tmp')) {
          fs.rmSync(path.join(dir, f), { force: true });
          n++;
        }
      }
    } catch {
      // dossier absent : rien à vider
    }
    return n;
  }

  return { read, get, write, clear };
}

module.exports = { createCache };
