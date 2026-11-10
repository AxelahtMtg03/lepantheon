'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, ipcMain, protocol, net, shell, session } = require('electron');
const { buildSteamUrl, isAllowedExternalUrl, isAppId } = require('../shared/validation');
const store = require('./store');
const secrets = require('./secrets');
const { createCache } = require('./cache');
const { createSteamApi } = require('./steam-api');
const { createProvider } = require('./provider');
const { isSteamId64 } = require('../shared/validation');

const MOCK = process.env.PANTHEON_MOCK === '1' || process.argv.includes('--mock');
const DEV = !app.isPackaged;
const RENDERER_DIR = path.join(__dirname, '..', 'renderer');
const ORIGIN = 'app://local/';
let provider;
let steamApi;
let cache;

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

// Le renderer est servi par un protocole interne : aucun accès au reste du disque.
function registerAppProtocol() {
  protocol.handle('app', (request) => {
    let rel;
    try {
      rel = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(RENDERER_DIR, rel));
    if (!file.startsWith(RENDERER_DIR + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

// N'accepte que les appels venant de notre propre page.
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!event.senderFrame || !event.senderFrame.url.startsWith(ORIGIN)) throw new Error('Appel refusé');
    return fn(...args);
  });
}

function registerIpc() {
  handle('app:info', () => ({ version: app.getVersion(), mock: MOCK, platform: process.platform }));
  handle('library:get', () => provider.getLibrary());
  handle('profile:get', () => provider.getProfile());
  handle('favorites:toggle', (appid) => {
    if (!isAppId(appid)) throw new Error('Identifiant invalide');
    return store.toggleFavorite(appid);
  });
  // Actions Steam : liste blanche + identifiant numérique validé. En démo, rien n'est lancé.
  handle('steam:action', async (action, id) => {
    const url = buildSteamUrl(action, id);
    if (!url) return { ok: false, error: 'invalid' };
    if (MOCK && action !== 'open/main') return { ok: true, mock: true };
    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch {
      return { ok: false, error: 'open-failed' };
    }
  });
  handle('settings:get', async () => ({ ...(await provider.getSettingsInfo()), hasApiKey: secrets.hasKey(), encryptionAvailable: await secrets.encryptionAvailable() }));
  handle('settings:set', (values) => {
    const v = values && typeof values === 'object' ? values : {};
    const steamId = typeof v.steamId === 'string' ? v.steamId.trim() : '';
    if (steamId && !isSteamId64(steamId)) return { ok: false, error: 'bad-steamid' };
    store.setSetting('steamId', steamId);
    store.setSetting('steamPath', typeof v.steamPath === 'string' ? v.steamPath : '');
    return { ok: true };
  });
  // La clé est vérifiée par un vrai appel ; elle n'est jamais renvoyée à l'interface.
  handle('apikey:set', async (raw) => {
    if (!secrets.isValidKeyFormat(raw)) return { ok: false, error: 'format' };
    try {
      await secrets.setKey(raw);
    } catch {
      return { ok: false, error: 'encryption-unavailable' };
    }
    const s = await provider.getSettingsInfo();
    const steamId = s.steamId || s.detectedSteamId;
    if (!steamId) return { ok: true, verified: false };
    try {
      await steamApi.getOwnedGames(steamId);
      return { ok: true, verified: true };
    } catch (err) {
      if (err.code === 'invalid-key') {
        secrets.clearKey();
        return { ok: false, error: 'invalid-key' };
      }
      return { ok: true, verified: false, warning: err.code };
    }
  });
  handle('apikey:clear', () => {
    secrets.clearKey();
    return { ok: true };
  });
  handle('cache:clear', () => ({ ok: true, removed: cache.clear() }));
  handle('external:open', async (url) => {
    if (!isAllowedExternalUrl(url)) return { ok: false, error: 'blocked' };
    await shell.openExternal(url);
    return { ok: true };
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#0B0D12',
    title: 'Le Pantheon',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0B0D12', symbolColor: '#E9ECF3', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: DEV,
      spellcheck: false,
    },
  });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('will-attach-webview', (e) => e.preventDefault());
  win.once('ready-to-show', () => win.show());
  win.loadURL(`${ORIGIN}index.html${DEV && /^#\/[a-z/0-9]*$/.test(process.env.PANTHEON_HASH || '') ? process.env.PANTHEON_HASH : ''}`);

  // Aide de vérification : PANTHEON_SCREENSHOT=chemin.png enregistre la fenêtre puis quitte.
  const shot = DEV && process.env.PANTHEON_SCREENSHOT;
  if (shot) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const img = await win.webContents.capturePage();
        require('node:fs').writeFileSync(shot, img.toPNG());
        app.quit();
      }, 1500);
    });
  }
}

app.whenReady().then(async () => {
  await secrets.init();
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  const userData = app.getPath('userData');
  cache = createCache(path.join(userData, 'cache'));
  steamApi = createSteamApi({ getKey: secrets.getKey, cache, quotaCache: createCache(path.join(userData, 'state')) });
  provider = createProvider(MOCK, { api: steamApi, hasKey: secrets.hasKey });
  registerAppProtocol();
  registerIpc();
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
app.on('window-all-closed', () => app.quit());
