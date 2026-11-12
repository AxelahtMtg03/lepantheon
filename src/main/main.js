'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, ipcMain, protocol, net, shell, session, dialog } = require('electron');
const { findSteamPath } = require('./steam-local');
const { buildSteamUrl, isAllowedExternalUrl, isAppId } = require('../shared/validation');
const store = require('./store');
const secrets = require('./secrets');
const { createCache } = require('./cache');
const { createSteamApi } = require('./steam-api');
const { createProvider } = require('./provider');
const { createAchievementService } = require('./achievements');
const { createUpdater } = require('./updater');
const { isSteamId64 } = require('../shared/validation');
const { ACCENTS, mergePrefs } = require('../shared/prefs');
const { LANGUAGES, resolveLanguage, normalizeCountry } = require('../shared/languages');

const MOCK = process.env.PANTHEON_MOCK === '1' || process.argv.includes('--mock');
const DEV = !app.isPackaged;
const RENDERER_DIR = path.join(__dirname, '..', 'renderer');
const ORIGIN = 'app://local/';
// Langue de l'interface : choix de l'utilisateur, sinon langue de Windows, sinon anglais.
function language() {
  return resolveLanguage((DEV && process.env.PANTHEON_LANG) || store.getSetting('language') || app.getLocale());
}
const country = () => normalizeCountry(app.getLocaleCountryCode());

// Anciennes versions (l'appli s'appelait « Le Pantheon ») : on garde leur dossier de données. La clé d'API chiffrée y est
// liée par Windows et par Chromium : la copier ailleurs la rendrait illisible. Les nouvelles installations utilisent « Pantheon ».
function useLegacyDataFolder() {
  // Aide de vérification (développement seulement) : dossier de données séparé, pour tester sans toucher à l'appli installée.
  if (!app.isPackaged && process.env.PANTHEON_USERDATA) {
    app.setPath('userData', process.env.PANTHEON_USERDATA);
    return;
  }
  const legacy = path.join(app.getPath('appData'), 'Le Pantheon');
  const hasData = ['apikey.bin', 'settings.json'].some((f) => require('node:fs').existsSync(path.join(legacy, f)));
  if (hasData) app.setPath('userData', legacy);
}
useLegacyDataFolder();

let provider;
let steamApi;
let cache;
let updater;

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
  // La disposition et l'accent partent avec les infos de départ : aucun flash de la mauvaise interface.
  // Aide de vérification (ignorée dans l'appli installée) : PANTHEON_PREFS='{"layout":"odeon","firstRunDone":true}'.
  const devPrefs = (() => { try { return DEV && process.env.PANTHEON_PREFS ? JSON.parse(process.env.PANTHEON_PREFS) : null; } catch { return null; } })();
  const prefsView = (p) => { const q = devPrefs ? mergePrefs(p, devPrefs) : p; return { ...q, accentColors: ACCENTS[q.accent] }; };
  handle('app:info', () => ({ version: app.getVersion(), mock: MOCK, platform: process.platform, language: language(), prefs: prefsView(store.getPrefs()) }));
  handle('prefs:set', (patch) => prefsView(store.setPrefs(patch)));
  handle('language:set', (code) => {
    if (typeof code !== 'string' || !Object.hasOwn(LANGUAGES, code)) return { ok: false, error: 'bad-language' };
    store.setSetting('language', code);
    return { ok: true };
  });
  handle('library:get', () => provider.getLibrary());
  handle('profile:get', () => provider.getProfile());
  handle('game:get', (appid) => {
    if (!isAppId(appid)) throw new Error('Identifiant invalide');
    return provider.getGame(appid);
  });
  handle('achievements:overview', () => provider.getAchievementsOverview());
  handle('store:featured', () => provider.getFeatured());
  handle('store:search', (term) => provider.searchStore(typeof term === 'string' ? term.slice(0, 100) : ''));
  handle('store:app', (appid) => {
    if (!isAppId(appid)) throw new Error('Identifiant invalide');
    return provider.getStoreApp(appid);
  });
  handle('friends:get', () => provider.getFriends());
  handle('badges:get', () => provider.getBadges());
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
    const steamPath = typeof v.steamPath === 'string' ? v.steamPath.trim() : '';
    if (steamPath && (steamPath.includes('\0') || !path.isAbsolute(steamPath))) return { ok: false, error: 'bad-path' };
    store.setSetting('steamPath', steamPath);
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
  // Démarrage avec Windows (sans effet en développement : on n'enregistre pas electron.exe).
  handle('startup:get', () => ({ supported: !DEV && process.platform === 'win32', enabled: !DEV && app.getLoginItemSettings().openAtLogin }));
  handle('startup:set', (enabled) => {
    if (DEV || process.platform !== 'win32') return { ok: false, error: 'unsupported' };
    app.setLoginItemSettings({ openAtLogin: enabled === true });
    return { ok: true };
  });
  // Sélecteur de dossier natif : l'interface ne voit jamais le disque, elle reçoit seulement le chemin choisi.
  handle('steam:pickFolder', async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const r = await dialog.showOpenDialog(win, { title: LANGUAGES[language()].folderTitle, properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, error: 'canceled' };
    const found = await findSteamPath(r.filePaths[0]);
    // findSteamPath retombe sur le dossier détecté si le choix est invalide : on exige que ce soit bien le dossier choisi.
    if (!found || path.resolve(found).toLowerCase() !== path.resolve(r.filePaths[0]).toLowerCase()) return { ok: false, error: 'not-steam' };
    return { ok: true, path: found };
  });
  // Mises à jour : état, vérification manuelle, installation d'une mise à jour déjà téléchargée, activation de la vérification automatique.
  const updateAuto = () => store.getSetting('updates') !== 'off';
  handle('update:get', () => ({ ...updater.getState(), current: app.getVersion(), auto: updateAuto() }));
  handle('update:check', () => updater.check());
  handle('update:install', () => updater.install());
  handle('update:setAuto', (on) => {
    store.setSetting('updates', on === true ? 'on' : 'off');
    if (on === true) updater.schedule();
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
    title: 'Pantheon',
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
  const size = DEV && /^(\d{3,4})x(\d{3,4})$/.exec(process.env.PANTHEON_SIZE || '');
  if (size) win.setContentSize(Number(size[1]), Number(size[2]));
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
        if (process.env.PANTHEON_CLEAN) await win.webContents.insertCSS('.demo-badge{display:none!important}');
        if (process.env.PANTHEON_EVAL) {
          await win.webContents.executeJavaScript(process.env.PANTHEON_EVAL); // aide de vérification (développement seulement)
          await new Promise((r) => setTimeout(r, 900));
        }
        if (process.env.PANTHEON_SCROLL) await win.webContents.executeJavaScript('document.getElementById("main").scrollTo(0, 99999)');
        await new Promise((r) => setTimeout(r, 300));
        const img = await win.webContents.capturePage();
        require('node:fs').writeFileSync(shot, /\.jpe?g$/i.test(shot) ? img.toJPEG(90) : img.toPNG());
        app.quit();
      }, Number(process.env.PANTHEON_DELAY) || 1500);
    });
  }
}

app.whenReady().then(async () => {
  await secrets.init();
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  const userData = app.getPath('userData');
  cache = createCache(path.join(userData, 'cache'));
  steamApi = createSteamApi({ getKey: secrets.getKey, cache, quotaCache: createCache(path.join(userData, 'state')), getLang: () => LANGUAGES[language()].steam, getCountry: country });
  provider = createProvider(MOCK, { api: steamApi, hasKey: secrets.hasKey, lang: language, achievements: createAchievementService({ api: steamApi }) });
  // Les mises à jour ne fonctionnent que dans l'application installée (pas en développement ni en mode démo).
  const canUpdate = app.isPackaged && !MOCK && process.platform === 'win32';
  updater = createUpdater({
    autoUpdater: canUpdate ? require('electron-updater').autoUpdater : null,
    supported: canUpdate,
    isAuto: () => store.getSetting('updates') !== 'off',
    send: (state) => BrowserWindow.getAllWindows().forEach((w) => !w.isDestroyed() && w.webContents.send('update:state', state)),
    log: (msg) => console.error(msg),
  });
  registerAppProtocol();
  registerIpc();
  updater.schedule();
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
