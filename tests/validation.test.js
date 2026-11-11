'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSteamUrl, isAllowedExternalUrl, isAppId, isSteamId64 } = require('../src/shared/validation');

test('buildSteamUrl accepte les actions autorisées', () => {
  assert.equal(buildSteamUrl('rungameid', 440), 'steam://rungameid/440');
  assert.equal(buildSteamUrl('install', '730'), 'steam://install/730');
  assert.equal(buildSteamUrl('uninstall', 440), 'steam://uninstall/440');
  assert.equal(buildSteamUrl('store', 440), 'steam://store/440');
  assert.equal(buildSteamUrl('open/main'), 'steam://open/main');
  assert.equal(buildSteamUrl('open/downloads'), 'steam://open/downloads');
  assert.equal(buildSteamUrl('friends/message', '76561198000000000'), 'steam://friends/message/76561198000000000');
});

test('buildSteamUrl refuse tout le reste', () => {
  for (const [a, id] of [
    ['rungameid', '440/../x'], ['rungameid', '440 -applaunch'], ['rungameid', -1], ['rungameid', 0],
    ['rungameid', '1e5'], ['rungameid', ''], ['rungameid', null], ['rungameid', 12345678901],
    ['run', 440], ['__proto__', 1], ['friends/message', '123'], ['friends/message', 76561198000000000],
    [undefined, 1], ['toString', 1],
  ]) assert.equal(buildSteamUrl(a, id), null, `${a} ${id}`);
});

test('isAllowedExternalUrl : https et domaines autorisés seulement', () => {
  assert.ok(isAllowedExternalUrl('https://store.steampowered.com/app/440'));
  assert.ok(isAllowedExternalUrl('https://steamcommunity.com/dev/apikey'));
  for (const u of [
    'http://store.steampowered.com/', 'https://evil.com/', 'https://store.steampowered.com.evil.com/',
    'https://user:pw@store.steampowered.com/', 'javascript:alert(1)', 'file:///c:/x', 'steam://open/main', 'nope', null, 42,
  ]) assert.equal(isAllowedExternalUrl(u), false, String(u));
});

test('identifiants', () => {
  assert.ok(isAppId(440) && isAppId('9000001'));
  assert.ok(!isAppId('abc') && !isAppId('0') && !isAppId(1.5));
  assert.ok(isSteamId64('76561198000000000') && !isSteamId64('1234'));
});
