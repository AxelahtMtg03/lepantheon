'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { LANGUAGES, resolveLanguage, normalizeCountry } = require('../src/shared/languages');

const dir = path.join(__dirname, '..', 'src', 'renderer', 'locales');
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

// Les fichiers de langue sont des modules ES : on les évalue sans dépendre du type de paquet.
async function load(code) {
  const src = fs.readFileSync(path.join(dir, `${code}.js`), 'utf8').replace('export default', 'module.exports =');
  const m = { exports: {} };
  new Function('module', src)(m);
  return m.exports;
}

test('chaque langue prise en charge a son fichier et exactement les mêmes clés', async () => {
  const base = await load('en');
  const baseKeys = Object.keys(base).sort();
  for (const code of Object.keys(LANGUAGES)) {
    const d = await load(code);
    assert.deepEqual(Object.keys(d).sort(), baseKeys, `clés différentes dans ${code}`);
  }
});

test('mêmes variables {…} et aucune traduction vide', async () => {
  const base = await load('en');
  for (const code of Object.keys(LANGUAGES)) {
    const d = await load(code);
    for (const [k, v] of Object.entries(d)) {
      assert.ok(typeof v === 'string' && v.trim() !== '', `${code}:${k} vide`);
      // les chaînes au pluriel « a|b » doivent garder les mêmes variables dans chaque forme
      const forms = v.split('|');
      for (const f of forms) assert.equal(placeholders(f), placeholders(base[k].split('|')[0]), `${code}:${k} variables différentes`);
    }
  }
});

test('le japonais et le chinois n\'utilisent pas de forme plurielle', async () => {
  for (const code of ['ja', 'zh']) {
    const d = await load(code);
    for (const [k, v] of Object.entries(d)) assert.ok(!v.includes('|'), `${code}:${k}`);
  }
});

test('la liste de langues de l\'interface correspond à celle du processus principal', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'js', 'i18n.js'), 'utf8');
  const codes = [...src.matchAll(/^\s{2}(\w{2}): \{ name:/gm)].map((m) => m[1]).sort();
  assert.deepEqual(codes, Object.keys(LANGUAGES).sort());
});

test('résolution de la langue et du pays', () => {
  assert.equal(resolveLanguage('fr-FR'), 'fr');
  assert.equal(resolveLanguage('zh_CN'), 'zh');
  assert.equal(resolveLanguage('JA'), 'ja');
  assert.equal(resolveLanguage('de-DE'), 'en');
  assert.equal(resolveLanguage(undefined), 'en');
  assert.equal(normalizeCountry('FR'), 'fr');
  assert.equal(normalizeCountry(''), 'us');
  assert.equal(normalizeCountry('xxx'), 'us');
  assert.equal(normalizeCountry(null), 'us');
});
