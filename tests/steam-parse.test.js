'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseLibraryFolders, parseAppManifest, parseLoginUsers, parseLocalConfig } = require('../src/shared/steam-parse');

const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
const acf = (o) => `"AppState"\n{\n${Object.entries(o).map(([k, v]) => `"${k}" "${v}"`).join('\n')}\n}`;

test('libraryfolders : tous les disques', () => {
  assert.deepEqual(parseLibraryFolders(fx('libraryfolders.vdf')), ['C:\\Program Files (x86)\\Steam', 'D:\\Jeux\\SteamLibrary']);
  assert.deepEqual(parseLibraryFolders('"libraryfolders" { "0" "E:\\\\Old" }'), ['E:\\Old']);
  assert.deepEqual(parseLibraryFolders('"autre" { }'), []);
});

test('appmanifest : téléchargement en cours (StateFlags 1026)', () => {
  const g = parseAppManifest(fx('appmanifest_440.acf'));
  assert.equal(g.appid, 440);
  assert.equal(g.installed, false);
  assert.equal(g.state, 'downloading');
  assert.equal(g.downloadPct, 25);
  assert.equal(g.bytesDownloaded, 250000);
  assert.equal(g.bytesToDownload, 1000000);
});

test('appmanifest : jeu installé et mise à jour en cours', () => {
  const ok = parseAppManifest(acf({ appid: 730, name: 'Counter-Strike 2', StateFlags: 4, SizeOnDisk: 5000 }));
  assert.deepEqual(ok, { appid: 730, name: 'Counter-Strike 2', installed: true, state: 'installed', downloadPct: null, sizeBytes: 5000, bytesDownloaded: 0, bytesToDownload: 0 });
  const upd = parseAppManifest(acf({ appid: 730, name: 'X', StateFlags: 1028, BytesToDownload: 200, BytesDownloaded: 50 }));
  assert.equal(upd.installed, true);
  assert.equal(upd.state, 'downloading');
  assert.equal(upd.downloadPct, 25);
  // mise à jour simplement « requise » mais pas démarrée : reste installé
  assert.equal(parseAppManifest(acf({ appid: 730, name: 'X', StateFlags: 6 })).state, 'installed');
});

test('appmanifest : outils ignorés, valeurs bizarres sans plantage', () => {
  assert.equal(parseAppManifest(acf({ appid: 228980, name: 'Steamworks Common Redistributables', StateFlags: 4 })), null);
  assert.equal(parseAppManifest(acf({ appid: 1493710, name: 'Proton Experimental', StateFlags: 4 })), null);
  assert.equal(parseAppManifest(acf({ appid: 1628350, name: 'Steam Linux Runtime 3.0 (sniper)', StateFlags: 4 })), null);
  assert.equal(parseAppManifest(acf({ appid: 'abc', name: 'X' })), null);
  assert.equal(parseAppManifest(acf({ appid: -3, name: 'X' })), null);
  assert.equal(parseAppManifest('"Autre" { }'), null);
  const odd = parseAppManifest(acf({ appid: 5, name: '<img src=x onerror=1>', StateFlags: 'zz', BytesToDownload: 'x' }));
  assert.equal(odd.name, '<img src=x onerror=1>'); // texte brut : l'interface utilise textContent
  assert.equal(odd.downloadPct, 0);
  assert.equal(parseAppManifest(acf({ appid: 5 })).name, 'App 5');
});

test('loginusers : compte actif', () => {
  const r = parseLoginUsers(fx('loginusers.vdf'));
  assert.equal(r.users.length, 2);
  assert.deepEqual(r.active, { id64: '76561198012345678', name: 'Axel', mostRecent: true });
  assert.equal(parseLoginUsers('"users" { "pasunid" { "PersonaName" "x" } }').active, null);
});

test('localconfig : temps de jeu et dernière session', () => {
  const m = parseLocalConfig(fx('localconfig.vdf'));
  assert.deepEqual(m.get(440), { playtimeMin: 744, lastPlayed: 1700000000 });
  assert.equal(m.get(730).playtimeMin, 120);
  assert.equal(m.size, 2);
  assert.equal(parseLocalConfig('"x" { }').size, 0);
});
