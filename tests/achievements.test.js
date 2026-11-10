'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeAchievements, summarize, rarestUnlocked } = require('../src/shared/achievements');
const { createCache } = require('../src/main/cache');
const { createSteamApi } = require('../src/main/steam-api');

const ID = '76561198012345678';
const KEY = 'ABCDEF0123456789ABCDEF0123456789';
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function setup(responses) {
  const cache = createCache(fs.mkdtempSync(path.join(os.tmpdir(), 'pantheon-ach-')));
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    return responses.shift();
  };
  return { calls, api: createSteamApi({ getKey: () => KEY, cache, fetchFn, sleep: async () => {}, minIntervalMs: 0 }) };
}

test('mergeAchievements : fusion, rareté, icônes, succès cachés', () => {
  const player = [
    { id: 'A', name: 'a', description: '', unlocked: true, unlockTime: 100 },
    { id: 'B', name: 'b', description: '', unlocked: false, unlockTime: null },
    { id: 'C', name: '', description: '', unlocked: false, unlockTime: null },
  ];
  const schema = [
    { id: 'A', name: 'Alpha', description: 'Faire A', hidden: false, icon: 'https://x/a.jpg', iconGray: 'https://x/ag.jpg' },
    { id: 'B', name: 'Beta', description: '', hidden: true, icon: 'https://x/b.jpg', iconGray: 'https://x/bg.jpg' },
  ];
  const [a, b, c] = mergeAchievements(player, schema, { A: 2.5, B: 40 });
  assert.deepEqual([a.name, a.iconUrl, a.rarity, a.percent], ['Alpha', 'https://x/a.jpg', 'ultra', 2.5]);
  assert.deepEqual([b.iconUrl, b.hidden, b.rarity], ['https://x/bg.jpg', true, 'common']);
  assert.deepEqual([c.name, c.percent, c.rarity, c.iconUrl], ['C', null, null, null]);
  assert.deepEqual(mergeAchievements(null, null, null), []);
});

test('summarize et rarestUnlocked', () => {
  assert.equal(summarize({ status: 'none', list: [] }), null);
  assert.equal(summarize(null), null);
  assert.deepEqual(summarize({ status: 'ok', list: [{ unlocked: true }, { unlocked: false }, { unlocked: true }] }), { unlocked: 2, total: 3 });
  const items = (arr) => arr.map(([id, unlocked, percent]) => ({ id, unlocked, percent }));
  const top = rarestUnlocked([
    { appid: 1, name: 'G1', items: items([['x', true, 5], ['y', false, 0.1], ['z', true, null]]) },
    { appid: 2, name: 'G2', items: items([['w', true, 1.2]]) },
  ], 2);
  assert.deepEqual(top.map((t) => [t.id, t.game]), [['w', 'G2'], ['x', 'G1']]);
});

test('getPlayerAchievements : succès, profil privé (403), jeu sans stats (400)', async () => {
  const ok = { playerstats: { success: true, achievements: [{ apiname: 'A', achieved: 1, unlocktime: 1700000000, name: 'Alpha', description: 'd' }, { apiname: 'B', achieved: 0, unlocktime: 0 }, { nope: 1 }] } };
  const r = await setup([json(ok)]).api.getPlayerAchievements(ID, 440);
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.list.map((a) => [a.id, a.unlocked, a.unlockTime]), [['A', true, 1700000000], ['B', false, null]]);
  assert.equal((await setup([json({ playerstats: { error: 'Profile is not public', success: false } }, 403)]).api.getPlayerAchievements(ID, 440)).status, 'private');
  assert.equal((await setup([json({ playerstats: { error: 'Requested app has no stats', success: false } }, 400)]).api.getPlayerAchievements(ID, 440)).status, 'none');
  assert.equal((await setup([json({ playerstats: { success: true, gameName: 'X' } })]).api.getPlayerAchievements(ID, 440)).status, 'none');
});

test('schéma, % globaux : validation des valeurs et des images', async () => {
  const schema = { game: { availableGameStats: { achievements: [
    { name: 'A', displayName: 'Alpha', description: 'd', hidden: 1, icon: 'https://cdn.cloudflare.steamstatic.com/a.jpg', icongray: 'https://evil.com/g.jpg' },
    { displayName: 'sans id' },
  ] } } };
  const s = await setup([json(schema)]).api.getSchema(440);
  assert.deepEqual(s, [{ id: 'A', name: 'Alpha', description: 'd', hidden: true, icon: 'https://cdn.cloudflare.steamstatic.com/a.jpg', iconGray: null }]);
  const g = await setup([json({ achievementpercentages: { achievements: [{ name: 'A', percent: '12.5' }, { name: 'B', percent: 150 }, { name: 'C', percent: 'x' }] } })]).api.getGlobalPercentages(440);
  assert.deepEqual(g, { A: 12.5 });
});

test('fiche boutique : sans clé, domaine boutique, texte nettoyé', async () => {
  const body = { 440: { success: true, data: { short_description: '<b>Super</b> jeu &amp; fun', genres: [{ description: 'Action' }, { id: 1 }], developers: ['Valve'], release_date: { date: '10 oct. 2007' }, header_image: 'https://cdn.cloudflare.steamstatic.com/h.jpg', screenshots: [{ path_thumbnail: 'https://cdn.cloudflare.steamstatic.com/t.jpg', path_full: 'https://evil.com/f.jpg' }] } } };
  const { api, calls } = setup([json(body)]);
  const d = await api.getStoreDetails(440);
  assert.equal(calls[0].hostname, 'store.steampowered.com');
  assert.equal(calls[0].searchParams.has('key'), false);
  assert.equal(d.description, 'Super jeu & fun');
  assert.deepEqual(d.genres, ['Action']);
  assert.equal(d.screenshots.length, 0);
  assert.equal((await setup([json({ 440: { success: false } })]).api.getStoreDetails(440)), null);
});
