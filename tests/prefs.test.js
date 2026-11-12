'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePrefs, mergePrefs, ACCENTS } = require('../src/shared/prefs');

test('premier lancement : Odéon par défaut, accent bleu, écran de choix pas encore fait', () => {
  const p = normalizePrefs(undefined);
  assert.equal(p.layout, 'odeon');
  assert.equal(p.accent, 'blue');
  assert.equal(p.firstRunDone, false);
  assert.equal(p.splash, true);
});

test('utilisateur d\'une version précédente : Agora conservé', () => {
  assert.equal(normalizePrefs(undefined, { existing: true }).layout, 'agora');
  assert.equal(normalizePrefs({ layout: 'odeon' }, { existing: true }).layout, 'odeon');
});

test('valeur invalide : Odéon par défaut, accent bleu', () => {
  for (const bad of ['salon', 42, null, {}, 'AGORA']) assert.equal(normalizePrefs({ layout: bad }, { existing: true }).layout, 'odeon');
  assert.equal(normalizePrefs({ accent: 'green' }).accent, 'blue');
  assert.equal(normalizePrefs({ splash: 'oui', fullscreen: 1 }).splash, true);
  assert.equal(normalizePrefs('texte').layout, 'odeon');
  assert.equal(normalizePrefs([1]).layout, 'odeon');
});

test('enregistrement puis relecture : valeurs valides conservées', () => {
  const saved = mergePrefs(normalizePrefs(undefined), { layout: 'agora', accent: 'violet', reducedMotion: true, firstRunDone: true });
  const again = normalizePrefs(JSON.parse(JSON.stringify(saved)), { existing: true });
  assert.deepEqual(again, saved);
  assert.equal(again.layout, 'agora');
});

test('mergePrefs ignore les clés et valeurs inconnues', () => {
  const base = normalizePrefs(undefined);
  const next = mergePrefs(base, { layout: 'x', accent: 'green', evil: true, __proto__: { layout: 'agora' }, splash: false });
  assert.equal(next.layout, 'odeon');
  assert.equal(next.accent, 'blue');
  assert.equal(next.splash, false);
  assert.equal('evil' in next, false);
});

test('aucun accent vert, jaune, orange ni rose', () => {
  for (const { accent } of Object.values(ACCENTS)) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16));
    assert.ok(!(g > r && g > b), `${accent} est vert`);
    assert.ok(!(r > 200 && g > 150 && b < 120), `${accent} est jaune/orange`);
  }
});
