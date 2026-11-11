'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// splash.js est un module ES sans dépendance : on le charge via un fichier .mjs temporaire.
async function load() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'js', 'splash.js'), 'utf8');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pantheon-splash-')), 'splash.mjs');
  fs.writeFileSync(file, src);
  return (await import(pathToFileURL(file).href)).createSplash;
}

// Horloge simulée : advance(ms) déclenche les minuteurs échus dans l'ordre.
function clock() {
  let now = 0;
  let id = 0;
  const pending = new Map();
  return {
    setTimeout: (fn, ms) => { pending.set(++id, { at: now + ms, fn }); return id; },
    clearTimeout: (i) => pending.delete(i),
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...pending.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        pending.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = end;
    },
  };
}

async function setup() {
  const createSplash = await load();
  const timers = clock();
  const log = [];
  const splash = createSplash({ show: () => log.push('show'), hide: (r) => log.push(`hide:${r}`), timers });
  return { splash, timers, log };
}

test('prêt en moins de 400 ms : aucun splash du tout', async () => {
  const { splash, timers, log } = await setup();
  splash.start();
  timers.advance(399);
  splash.ready();
  timers.advance(5000);
  assert.deepEqual(log, []);
  assert.equal(splash.state().shown, false);
});

test('démarrage plus long : le splash apparaît à 400 ms puis disparaît dès que tout est prêt', async () => {
  const { splash, timers, log } = await setup();
  splash.start();
  timers.advance(399);
  assert.deepEqual(log, []);
  timers.advance(1);
  assert.deepEqual(log, ['show']);
  timers.advance(600); // 1 s en tout
  splash.ready();
  assert.deepEqual(log, ['show', 'hide:ready']); // aucun délai ajouté
});

test('plafond de 3 s : on affiche l\'appli même si rien n\'est prêt', async () => {
  const { splash, timers, log } = await setup();
  splash.start();
  timers.advance(2999);
  assert.deepEqual(log, ['show']);
  timers.advance(1);
  assert.deepEqual(log, ['show', 'hide:timeout']);
  splash.ready(); // une fin tardive ne rouvre rien et ne ferme pas deux fois
  assert.deepEqual(log, ['show', 'hide:timeout']);
});

test('un clic ou une touche ferme le splash immédiatement, une seule fois', async () => {
  const { splash, timers, log } = await setup();
  splash.start();
  timers.advance(800);
  splash.skip();
  splash.skip();
  splash.ready();
  assert.deepEqual(log, ['show', 'hide:skip']);
  timers.advance(10000);
  assert.deepEqual(log, ['show', 'hide:skip']);
});

test('ignorer avant l\'apparition : rien ne s\'affiche ensuite', async () => {
  const { splash, timers, log } = await setup();
  splash.start();
  timers.advance(100);
  splash.skip();
  timers.advance(5000);
  assert.deepEqual(log, []);
});

test('start() répété sans effet (le splash ne revient jamais quand on revient sur la fenêtre)', async () => {
  const { splash, timers, log } = await setup();
  splash.start();
  splash.start();
  timers.advance(500);
  splash.ready();
  splash.start();
  timers.advance(5000);
  assert.deepEqual(log, ['show', 'hide:ready']);
});
