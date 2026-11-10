'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { rarityOf, progressPct } = require('../src/shared/rarity');
const { isSteamImageUrl } = require('../src/shared/validation');

test('rareté : seuils exacts', () => {
  assert.equal(rarityOf(100), 'common');
  assert.equal(rarityOf(25), 'common');
  assert.equal(rarityOf(24.99), 'uncommon');
  assert.equal(rarityOf(10), 'uncommon');
  assert.equal(rarityOf(9.99), 'rare');
  assert.equal(rarityOf(3), 'rare');
  assert.equal(rarityOf(2.99), 'ultra');
  assert.equal(rarityOf(0), 'ultra');
  assert.equal(rarityOf('3.2'), 'rare'); // l'API renvoie parfois du texte
});

test('rareté : valeurs invalides -> null', () => {
  for (const v of [null, undefined, '', 'abc', NaN, -1, 101, {}, Infinity]) assert.equal(rarityOf(v), null, String(v));
});

test('progression', () => {
  assert.equal(progressPct(18, 42), 43);
  assert.equal(progressPct(42, 42), 100);
  assert.equal(progressPct(0, 10), 0);
  assert.equal(progressPct(5, 0), null);
  assert.equal(progressPct(50, 10), 100);
  assert.equal(progressPct('1', 2), null);
});

test('images Steam : https et CDN Steam seulement', () => {
  assert.ok(isSteamImageUrl('https://cdn.cloudflare.steamstatic.com/steam/apps/440/header.jpg'));
  assert.ok(isSteamImageUrl('https://steamcdn-a.akamaihd.net/x.jpg'));
  for (const u of ['http://cdn.cloudflare.steamstatic.com/a.jpg', 'https://evil.com/a.jpg', 'https://steamstatic.com.evil.com/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AA', null, 5]) {
    assert.equal(isSteamImageUrl(u), false, String(u));
  }
});
