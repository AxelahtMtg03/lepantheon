'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdater, CHECK_DELAY_MS, CHECK_EVERY_MS } = require('../src/main/updater');

function setup({ supported = true, auto = true, checkImpl } = {}) {
  const au = new EventEmitter();
  au.calls = 0;
  au.installs = [];
  au.checkForUpdates = async () => {
    au.calls++;
    if (checkImpl) return checkImpl(au);
    au.emit('checking-for-update');
  };
  au.quitAndInstall = (...args) => au.installs.push(args);
  const sent = [];
  const timers = { fns: [], setTimeout: (fn, ms) => { timers.fns.push(['t', fn, ms]); return {}; }, setInterval: (fn, ms) => { timers.fns.push(['i', fn, ms]); return {}; } };
  const u = createUpdater({ autoUpdater: au, supported, isAuto: () => auto, send: (s) => sent.push(s), timers });
  return { au, u, sent, timers };
}

test('hors appli installée : état « dev », aucune vérification', async () => {
  const { au, u } = setup({ supported: false });
  assert.equal(u.getState().status, 'dev');
  await u.check();
  assert.equal(au.calls, 0);
  assert.deepEqual(u.install(), { ok: false });
  u.schedule();
});

test('cycle complet : vérification, nouvelle version, téléchargement, prête', async () => {
  const { au, u, sent } = setup();
  await u.check();
  assert.equal(u.getState().status, 'checking');
  au.emit('update-available', { version: '0.2.0' });
  assert.deepEqual([u.getState().status, u.getState().next], ['available', '0.2.0']);
  au.emit('download-progress', { percent: 41.6 });
  assert.deepEqual([u.getState().status, u.getState().percent], ['downloading', 42]);
  au.emit('download-progress', { percent: 250 });
  assert.equal(u.getState().percent, 100);
  au.emit('update-downloaded', { version: '0.2.0' });
  assert.equal(u.getState().status, 'ready');
  assert.deepEqual(sent.map((s) => s.status), ['checking', 'available', 'downloading', 'downloading', 'ready']);
});

test('pas de nouvelle version, et nouvelle vérification possible ensuite', async () => {
  const { au, u } = setup();
  await u.check();
  au.emit('update-not-available');
  assert.equal(u.getState().status, 'none');
  await u.check();
  assert.equal(au.calls, 2);
});

test('pas de vérification en double pendant un téléchargement ou une attente de redémarrage', async () => {
  const { au, u } = setup();
  await u.check();
  au.emit('update-available', { version: '0.2.0' });
  await u.check();
  au.emit('update-downloaded', { version: '0.2.0' });
  await u.check();
  assert.equal(au.calls, 1);
});

test('l\'installation n\'est possible que lorsque la mise à jour est prête', async () => {
  const { au, u } = setup();
  assert.deepEqual(u.install(), { ok: false });
  await u.check();
  au.emit('update-available', { version: '0.2.0' });
  assert.deepEqual(u.install(), { ok: false });
  assert.equal(au.installs.length, 0);
  au.emit('update-downloaded', { version: '0.2.0' });
  assert.deepEqual(u.install(), { ok: true });
  assert.deepEqual(au.installs, [[true, true]]);
});

test('erreurs : événement d\'erreur ou échec de la vérification, sans fuite de détails', async () => {
  const { au, u, sent } = setup();
  await u.check();
  au.emit('error', new Error('boom https://x?token=SECRET'));
  assert.equal(u.getState().status, 'error');
  assert.ok(!JSON.stringify(sent).includes('SECRET'));
  const failing = setup({ checkImpl: async () => { throw new Error('réseau'); } });
  await failing.u.check();
  assert.equal(failing.u.getState().status, 'error');
  await failing.u.check(); // une erreur n'empêche pas de réessayer
  assert.equal(failing.au.calls, 2);
});

test('numéro de version reçu : texte court seulement', async () => {
  const { au, u } = setup();
  await u.check();
  au.emit('update-available', { version: 'x'.repeat(500) });
  assert.equal(u.getState().next.length, 32);
  au.emit('update-available', undefined);
  assert.equal(u.getState().next, '');
});

test('planification : une fois, après 15 s puis toutes les 6 h, et seulement si activée', async () => {
  const { au, u, timers } = setup({ auto: true });
  u.schedule();
  u.schedule();
  assert.deepEqual(timers.fns.map(([k, , ms]) => [k, ms]), [['t', CHECK_DELAY_MS], ['i', CHECK_EVERY_MS]]);
  timers.fns[0][1]();
  await new Promise((r) => setImmediate(r));
  assert.equal(au.calls, 1);

  const off = setup({ auto: false });
  off.u.schedule();
  off.timers.fns[0][1]();
  await new Promise((r) => setImmediate(r));
  assert.equal(off.au.calls, 0);
});
