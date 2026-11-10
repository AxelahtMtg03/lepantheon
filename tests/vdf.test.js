'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseVdf, VdfError, getCI, getPath, toInt } = require('../src/shared/vdf');
const { toId32, toId64 } = require('../src/shared/steamid');

const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');

test('libraryfolders : chemins Windows avec \ et plusieurs bibliothèques', () => {
  const doc = parseVdf(fx('libraryfolders.vdf'));
  const lf = getCI(doc, 'libraryfolders');
  assert.equal(lf['0'].path, 'C:\\Program Files (x86)\\Steam');
  assert.equal(lf['1'].path, 'D:\\Jeux\\SteamLibrary');
  assert.deepEqual(Object.keys(lf['0'].apps).sort(), ['228980', '440']);
});

test('appmanifest : valeurs et progression', () => {
  const st = getCI(parseVdf(fx('appmanifest_440.acf')), 'appstate');
  assert.equal(st.name, 'Team Fortress 2');
  assert.equal(toInt(st.StateFlags), 1026);
  assert.equal(toInt(st.SizeOnDisk), 28000000000);
  assert.equal(getPath(st, 'UserConfig', 'language'), 'french');
});

test('loginusers : guillemets échappés et MostRecent', () => {
  const users = getCI(parseVdf(fx('loginusers.vdf')), 'users');
  assert.equal(users['76561198000000001'].PersonaName, 'Ancien "Pseudo"');
  const recent = Object.entries(users).find(([, u]) => u.MostRecent === '1');
  assert.equal(recent[0], '76561198012345678');
});

test('échappements, commentaires, chaînes non quotées, BOM, CRLF', () => {
  const doc = parseVdf('\ufeff// commentaire\r\n"a" { "p" "C:\\\\x\\ty" bare value\r\n "n" "l1\\nl2" }');
  assert.equal(doc.a.p, 'C:\\x\ty');
  assert.equal(doc.a.bare, 'value');
  assert.equal(doc.a.n, 'l1\nl2');
});

test('entrées vides ou invalides', () => {
  assert.deepEqual({ ...parseVdf('') }, {});
  for (const bad of ['"a" {', '"a" { "b" }', '}', '{ }', '"a" "b" }', '"abc']) {
    assert.throws(() => parseVdf(bad), VdfError, bad);
  }
  assert.throws(() => parseVdf(null), VdfError);
  assert.throws(() => parseVdf('{'.repeat(100)), VdfError);
});

test('pas de pollution de prototype', () => {
  const doc = parseVdf('"__proto__" { "polluted" "1" } "constructor" "x" "ok" "1"');
  assert.equal({}.polluted, undefined);
  assert.equal(doc.ok, '1');
  assert.equal(Object.keys(doc).includes('__proto__'), false);
});

test('toInt et getCI tolèrent les valeurs inattendues', () => {
  assert.equal(toInt('42'), 42);
  assert.equal(toInt('abc', 7), 7);
  assert.equal(toInt(undefined), 0);
  assert.equal(toInt({}), 0);
  assert.equal(toInt('12345678901234567890', -1), -1);
  assert.equal(getCI({ AppState: 1 }, 'appstate'), 1);
  assert.equal(getCI(null, 'x'), undefined);
  assert.equal(getPath({ a: { b: 'c' } }, 'A', 'B'), 'c');
  assert.equal(getPath({ a: 'x' }, 'a', 'b'), undefined);
});

test('conversion SteamID64 <-> id32', () => {
  assert.equal(toId32('76561198012345678'), 52079950);
  assert.equal(toId64(52079950), '76561198012345678');
  assert.equal(toId64('52079950'), '76561198012345678');
  assert.equal(toId32('76561197960265729'), 1);
  for (const bad of ['', 'abc', '123', '76561197960265728', 76561198012345678, null, '76561198012345678x']) assert.equal(toId32(bad), null, String(bad));
  for (const bad of [0, -5, 1.5, 'x', '4294967296', null]) assert.equal(toId64(bad), null, String(bad));
});
