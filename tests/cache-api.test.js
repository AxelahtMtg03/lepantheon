'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCache } = require('../src/main/cache');
const { createSteamApi, SteamApiError } = require('../src/main/steam-api');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pantheon-test-'));
const ID = '76561198012345678';
const KEY = 'ABCDEF0123456789ABCDEF0123456789';

function clock(start = 1_700_000_000_000) {
  const c = { t: start, now: () => c.t };
  return c;
}
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function setup({ key = KEY, responses = [], limit } = {}) {
  const dir = tmp();
  const c = clock();
  const cache = createCache(dir, c.now);
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return r;
  };
  const api = createSteamApi({ getKey: () => key, cache, fetchFn, now: c.now, sleep: async () => {}, minIntervalMs: 0, dailyLimit: limit });
  return { api, cache, calls, c, dir };
}

test('cache : frais, périmé, secours, vider', () => {
  const dir = tmp();
  const c = clock();
  const cache = createCache(dir, c.now);
  assert.equal(cache.get('a', 1000), undefined);
  cache.write('a', { x: 1 });
  assert.deepEqual(cache.get('a', 1000), { x: 1 });
  c.t += 2000;
  assert.equal(cache.get('a', 1000), undefined);
  assert.deepEqual(cache.read('a').data, { x: 1 });
  assert.equal(cache.clear(), 1);
  assert.equal(cache.read('a'), null);
  fs.writeFileSync(path.join(dir, 'x.json'), 'pas du json');
  assert.equal(cache.read('x'), null);
});

test('getOwnedGames : normalise, met en cache, n\'envoie la clé qu\'à api.steampowered.com', async () => {
  const body = { response: { game_count: 3, games: [
    { appid: 440, name: 'TF2', playtime_forever: 120, rtime_last_played: 1700000000 },
    { appid: 'x', name: 'invalide' },
    { appid: 730, playtime_forever: -5 },
  ] } };
  const { api, calls } = setup({ responses: [json(body)] });
  const r = await api.getOwnedGames(ID);
  assert.deepEqual(r.games, [
    { appid: 440, name: 'TF2', playtimeMin: 120, lastPlayed: 1700000000 },
    { appid: 730, name: 'App 730', playtimeMin: 0, lastPlayed: null },
  ]);
  await api.getOwnedGames(ID); // servi par le cache
  assert.equal(calls.length, 1);
  assert.equal(calls[0].hostname, 'api.steampowered.com');
  assert.equal(calls[0].protocol, 'https:');
  assert.equal(calls[0].searchParams.get('steamid'), ID);
});

test('la clé n\'est jamais écrite dans le cache', async () => {
  const { api, dir } = setup({ responses: [json({ response: { game_count: 0 } })] });
  await api.getOwnedGames(ID);
  for (const f of fs.readdirSync(dir)) assert.ok(!fs.readFileSync(path.join(dir, f), 'utf8').includes(KEY));
});

test('profil aux détails de jeu privés', async () => {
  const { api } = setup({ responses: [json({ response: {} })] });
  assert.deepEqual(await api.getOwnedGames(ID), { hidden: true, games: [] });
});

test('erreurs : pas de clé, clé refusée, réponse invalide, id invalide', async () => {
  await assert.rejects(setup({ key: null }).api.getOwnedGames(ID), { code: 'no-key' });
  await assert.rejects(setup({ responses: [json({}, 403)] }).api.getOwnedGames(ID), { code: 'invalid-key' });
  await assert.rejects(setup({ responses: [json({}, 404)] }).api.getOwnedGames(ID), { code: 'bad-response' });
  await assert.rejects(setup({ responses: [json('texte')] }).api.getOwnedGames(ID), { code: 'bad-response' });
  await assert.rejects(setup().api.getOwnedGames('abc'), SteamApiError);
});

test('réseau coupé : repli sur la dernière copie, sinon erreur sans fuite de clé', async () => {
  const { api, c } = setup({ responses: [json({ response: { games: [{ appid: 1, name: 'A' }] } }), new Error(`échec https://x?key=${KEY}`)] });
  await api.getOwnedGames(ID);
  c.t += 60 * 60 * 1000; // cache périmé
  const r = await api.getOwnedGames(ID);
  assert.equal(r.games[0].appid, 1);

  const fail = setup({ responses: [new Error(`échec https://x?key=${KEY}`)] });
  await assert.rejects(fail.api.getOwnedGames(ID), (e) => e.code === 'network' && !e.message.includes(KEY));
});

test('plafond quotidien', async () => {
  const { api, c } = setup({ limit: 2, responses: [json({ response: { games: [] } }), json({ response: { games: [] } }), json({ response: { games: [] } })] });
  await api.request('/a', {});
  await api.request('/b', {});
  await assert.rejects(api.request('/c', {}), { code: 'rate' });
  c.t += 24 * 3600 * 1000; // jour suivant
  await api.request('/d', {});
});

test('avatar : seulement https sur un domaine Steam', async () => {
  const ok = { response: { players: [{ personaname: 'Axel', avatarfull: 'https://avatars.steamstatic.com/a.jpg' }] } };
  assert.equal((await setup({ responses: [json(ok)] }).api.getPlayerSummary(ID)).avatarUrl, 'https://avatars.steamstatic.com/a.jpg');
  const bad = { response: { players: [{ personaname: 'X', avatarfull: 'https://evil.com/a.jpg' }] } };
  assert.equal((await setup({ responses: [json(bad)] }).api.getPlayerSummary(ID)).avatarUrl, null);
});
