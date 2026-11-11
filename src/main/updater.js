'use strict';
// Mises à jour automatiques (electron-updater + GitHub Releases). L'autoUpdater est injecté : le module se teste sans Electron.
// États : idle | dev | checking | none | available | downloading | ready | error
const CHECK_DELAY_MS = 15 * 1000; // première vérification peu après le démarrage
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

function createUpdater({ autoUpdater, supported, isAuto, send, log = () => {}, timers = { setTimeout, setInterval } }) {
  let state = { status: supported ? 'idle' : 'dev', next: null, percent: 0 };
  let scheduled = false;

  const set = (patch) => {
    state = { ...state, ...patch };
    send({ ...state });
  };

  if (supported && autoUpdater) {
    autoUpdater.autoDownload = true; // télécharge en arrière-plan
    autoUpdater.autoInstallOnAppQuit = true; // sinon, installe à la fermeture de l'appli
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.logger = null;
    autoUpdater.on('checking-for-update', () => set({ status: 'checking', percent: 0 }));
    autoUpdater.on('update-available', (info) => set({ status: 'available', next: String((info && info.version) || '').slice(0, 32) }));
    autoUpdater.on('update-not-available', () => set({ status: 'none', next: null }));
    autoUpdater.on('download-progress', (p) => set({ status: 'downloading', percent: Math.min(100, Math.max(0, Math.round(Number(p && p.percent) || 0))) }));
    autoUpdater.on('update-downloaded', (info) => set({ status: 'ready', percent: 100, next: String((info && info.version) || state.next || '').slice(0, 32) }));
    autoUpdater.on('error', (err) => {
      log(`Mise à jour impossible : ${(err && (err.code || err.message)) || 'erreur'}`);
      set({ status: 'error' });
    });
  }

  async function check() {
    if (!supported || !autoUpdater) return state;
    if (['checking', 'available', 'downloading', 'ready'].includes(state.status)) return state; // déjà en cours
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      if (state.status !== 'error') set({ status: 'error' });
    }
    return state;
  }

  // Seule une mise à jour déjà téléchargée peut être installée.
  function install() {
    if (state.status !== 'ready') return { ok: false };
    autoUpdater.quitAndInstall(true, true); // installation silencieuse, puis relance de l'appli
    return { ok: true };
  }

  // Vérifie peu après le démarrage puis toutes les 6 h, si l'utilisateur ne l'a pas désactivé. Appel répété sans effet.
  function schedule() {
    if (!supported || scheduled) return;
    scheduled = true;
    const tick = () => {
      if (isAuto()) check();
    };
    const first = timers.setTimeout(tick, CHECK_DELAY_MS);
    const every = timers.setInterval(tick, CHECK_EVERY_MS);
    if (first && first.unref) first.unref();
    if (every && every.unref) every.unref();
  }

  return { check, install, schedule, getState: () => ({ ...state }) };
}

module.exports = { createUpdater, CHECK_DELAY_MS, CHECK_EVERY_MS };
