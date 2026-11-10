'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { statusKey, sortFriends, countOnline } = require('../src/shared/friends');
const { createCache } = require('../src/main/cache');
const { createSteamApi } = require('../src/main/steam-api');

const ID = '76561198012345678';
const F1 = '76561198000000001';
const F2 = '76561198000000002';
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function setup(responses) {
  const cache = createCache(fs.mkdtempSync(path.join(os.tmpdir(), 'pantheon-sf-')));
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    return responses.shift();
  };
  return { calls, api: createSteamApi({ getKey: () => 'ABCDEF0123456789ABCDEF0123456789', cache, fetchFn, sleep: async () => {}, minIntervalMs: 0 }) };
}

test('statut et tri des amis', () => {
  const f = (name, state, gameName = null, lastLogoff = null) => ({ name, state, gameName, lastLogoff });
  assert.equal(statusKey(f('a', 0, 'Jeu')), 'ingame');
  assert.deepEqual([1, 5, 6, 2, 3, 4, 0, 99].map((s) => statusKey(f('x', s))), ['online', 'online', 'online', 'busy', 'away', 'away', 'offline', 'offline']);
  const sorted = sortFriends([f('Zoe', 0, null, 100), f('Bob', 1), f('Ann', 0, null, 500), f('Cat', 3), f('Dan', 1, 'Batman')]);
  assert.deepEqual(sorted.map((x) => x.name), ['Dan', 'Bob', 'Cat', 'Ann', 'Zoe']);
  assert.equal(countOnline(sorted), 3);
});

test('liste d\'amis : privée (401) -> status private, jamais mise en cache', async () => {
  const { api } = setup([json({}, 401), json({ friendslist: { friends: [] } })]);
  assert.deepEqual(await api.getFriends(ID), { status: 'private', friends: [] });
  assert.equal((await api.getFriends(ID)).status, 'ok');
});

test('amis : profils nettoyés, avatar validé, ids invalides ignorés', async () => {
  const list = { friendslist: { friends: [{ steamid: F1 }, { steamid: 'abc' }, { steamid: F2 }] } };
  const players = { response: { players: [
    { steamid: F1, personaname: 'Alice', avatarmedium: 'https://avatars.steamstatic.com/a.jpg', personastate: 1, gameextrainfo: 'Batman', lastlogoff: 1700000000 },
    { steamid: F2, personaname: '', avatarmedium: 'https://evil.com/a.jpg', personastate: 42 },
    { steamid: 'nope', personaname: 'x' },
  ] } };
  const { api, calls } = setup([json(list), json(players)]);
  const r = await api.getFriends(ID);
  assert.equal(calls[1].searchParams.get('steamids'), `${F1},${F2}`);
  assert.deepEqual(r.friends[0], { steamId: F1, name: 'Alice', avatarUrl: 'https://avatars.steamstatic.com/a.jpg', state: 1, gameName: 'Batman', lastLogoff: 1700000000 });
  assert.deepEqual([r.friends[1].name, r.friends[1].avatarUrl, r.friends[1].state], [F2, null, 0]);
  assert.equal(r.friends.length, 2);
});

test('boutique : mises en avant et recherche (sans clé, domaine boutique)', async () => {
  const featured = { specials: { items: [
    { id: 440, name: 'TF2', discount_percent: 50, original_price: 2000, final_price: 1000, currency: 'EUR' },
    { id: 'x', name: 'invalide' },
    { id: 730, name: 'CS2', final_price: null },
  ] }, top_sellers: { items: [] }, autre: { items: [{ id: 1, name: 'ignoré' }] } };
  const { api, calls } = setup([json(featured)]);
  const cats = await api.getFeatured();
  assert.equal(calls[0].hostname, 'store.steampowered.com');
  assert.equal(calls[0].searchParams.has('key'), false);
  assert.deepEqual(cats.map((c) => c.id), ['specials']);
  assert.deepEqual(cats[0].items[0], { appid: 440, name: 'TF2', price: { currency: 'EUR', initial: 2000, final: 1000, discountPct: 50 } });
  assert.equal(cats[0].items[1].price, null);

  const search = { total: 2, items: [{ type: 'app', id: 440, name: 'TF2', price: { currency: 'EUR', initial: 2000, final: 1000 } }, { type: 'bundle', id: 5, name: 'Pack' }] };
  const r = await setup([json(search)]).api.searchStore('  team  ');
  assert.equal(r.length, 1);
  assert.equal(r[0].price.discountPct, 50);
  assert.deepEqual(await setup([]).api.searchStore('   '), []);
});
