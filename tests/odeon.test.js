'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function load() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'js', 'odeon-logic.js'), 'utf8');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pantheon-odeon-')), 'logic.mjs');
  fs.writeFileSync(file, src);
  return import(pathToFileURL(file).href);
}

const G = (appid, name, extra = {}) => ({ appid, name, installed: false, playtimeMin: 0, lastPlayed: null, achievements: null, ...extra });
const games = [
  G(1, 'Hollow Reach', { installed: true, playtimeMin: 700, lastPlayed: 500, achievements: { unlocked: 18, total: 42 } }),
  G(2, 'Opus Lumen', { installed: true, playtimeMin: 90, lastPlayed: 900, achievements: { unlocked: 40, total: 50 } }),
  G(3, 'Étoile Fière', { playtimeMin: 0 }),
  G(4, 'Cendres', { installed: true, playtimeMin: 300, lastPlayed: 100, achievements: { unlocked: 20, total: 20 } }),
  G(5, 'Neuf', { installed: true }),
];

test('rangées calculées : bonnes règles, aucune rangée vide', async () => {
  const { buildRows } = await load();
  const rows = buildRows(games);
  const ids = rows.map((r) => r.id);
  assert.deepEqual(ids, ['continue', 'almost', 'unstarted', 'platinum', 'recent', 'all']);
  assert.deepEqual(rows[0].games.map((g) => g.appid), [2, 1, 4]); // récents d'abord
  assert.deepEqual(rows[1].games.map((g) => g.appid), [2]); // 80 % : ≥ 70 % et pas fini
  assert.deepEqual(rows[2].games.map((g) => g.appid), [5, 3]); // installés d'abord
  assert.deepEqual(rows[3].games.map((g) => g.appid), [4]);
  assert.deepEqual(buildRows([G(1, 'A', { installed: true, playtimeMin: 5 })]).map((r) => r.id), ['recent', 'all']);
  assert.deepEqual(buildRows([]), []);
});

test('une ligne : jamais plus que la limite, le total reste visible', async () => {
  const { buildRows, perRow } = await load();
  const many = Array.from({ length: 30 }, (_, i) => G(i + 1, `Jeu ${i}`));
  const all = buildRows(many, 9).find((r) => r.id === 'all');
  assert.equal(all.shown.length, 9);
  assert.equal(all.total, 30);
  assert.equal(perRow(1920), 9);
  assert.equal(perRow(1000), 5);
  assert.equal(perRow(300), 3);
});

test('étiquette du grand écran', async () => {
  const { heroKind, defaultHero } = await load();
  assert.equal(heroKind(games[0]), 'resume');
  assert.equal(heroKind(games[1]), 'almost');
  assert.equal(heroKind(games[2]), 'install');
  assert.equal(heroKind(games[3]), 'platinum');
  assert.equal(heroKind(games[4]), 'start');
  assert.equal(defaultHero(games).appid, 2);
  assert.equal(defaultHero([]), null);
});

test('recherche : accents, casse, jeux possédés vs non possédés', async () => {
  const { searchOwned, notOwned } = await load();
  assert.deepEqual(searchOwned(games, 'etoile').map((g) => g.appid), [3]);
  assert.deepEqual(searchOwned(games, 'ÉTOILE').map((g) => g.appid), [3]);
  assert.deepEqual(searchOwned(games, 'e').map((g) => g.appid)[0], 3); // « commence par » avant « contient »
  assert.deepEqual(searchOwned(games, '   '), []);
  const store = [{ appid: 1, name: 'Hollow Reach' }, { appid: 99, name: 'Autre' }];
  assert.deepEqual(notOwned(store, games).map((i) => i.appid), [99]);
});

test('antirebond : un seul appel, avec la dernière valeur ; annulable', async () => {
  const { createDebounce } = await load();
  let now = 0;
  const pending = new Map();
  let id = 0;
  const timers = { setTimeout: (f, d) => { pending.set(++id, [now + d, f]); return id; }, clearTimeout: (i) => pending.delete(i) };
  const adv = (ms) => { now += ms; for (const [k, [at, f]] of [...pending]) if (at <= now) { pending.delete(k); f(); } };
  const calls = [];
  const d = createDebounce((v) => calls.push(v), 250, timers);
  d('h'); adv(100); d('ho'); adv(100); d('hol');
  adv(249);
  assert.deepEqual(calls, []);
  adv(1);
  assert.deepEqual(calls, ['hol']);
  d('x'); d.cancel(); adv(1000);
  assert.deepEqual(calls, ['hol']);
});

test('écran de premier lancement : une seule fois, sans réglage il réapparaît', async () => {
  const { shouldShowFirstRun } = await load();
  assert.equal(shouldShowFirstRun({ firstRunDone: false }), true);
  assert.equal(shouldShowFirstRun(undefined), true);
  assert.equal(shouldShowFirstRun({ firstRunDone: true }), false);
});
