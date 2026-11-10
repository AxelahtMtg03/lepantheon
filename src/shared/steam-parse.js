'use strict';
// Interprétation (pure, sans accès disque) des fichiers locaux de Steam. Toute valeur est validée.
const { parseVdf, getCI, getPath, toInt } = require('./vdf');
const { isSteamId64 } = require('./validation');

// StateFlags : 4 = installé ; 2 = mise à jour requise ; 256 = démarrée ; 1024 = en cours.
const FLAG_INSTALLED = 4;
const FLAG_ACTIVE = 256 | 1024;

const TOOL_APPIDS = new Set([228980]); // Steamworks Common Redistributables
const TOOL_NAME_RE = /^(Proton(\s|$)|Steam Linux Runtime|Steamworks Common Redistributables|Steam Controller Configs)/i;

const clean = (s, max = 200) => String(s).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
const isObj = (v) => v && typeof v === 'object';

function parseLibraryFolders(text) {
  const lf = getCI(parseVdf(text), 'libraryfolders');
  const paths = [];
  if (!isObj(lf)) return paths;
  for (const [key, val] of Object.entries(lf)) {
    if (!/^\d+$/.test(key)) continue;
    const p = isObj(val) ? getCI(val, 'path') : val; // ancien format : "1" "D:\\chemin"
    if (typeof p === 'string' && p.trim()) paths.push(clean(p, 500));
  }
  return paths;
}

// Retourne un jeu normalisé, ou null (manifeste invalide, outil Steam).
function parseAppManifest(text) {
  const st = getCI(parseVdf(text), 'appstate');
  if (!isObj(st)) return null;
  const appid = toInt(getCI(st, 'appid'));
  if (appid <= 0 || appid > 0xffffffff || TOOL_APPIDS.has(appid)) return null;
  const rawName = getCI(st, 'name');
  const name = typeof rawName === 'string' && clean(rawName) ? clean(rawName) : `App ${appid}`;
  if (TOOL_NAME_RE.test(name)) return null;

  const flags = toInt(getCI(st, 'StateFlags'));
  const toDownload = Math.max(0, toInt(getCI(st, 'BytesToDownload')));
  const downloaded = Math.max(0, toInt(getCI(st, 'BytesDownloaded')));
  const installed = (flags & FLAG_INSTALLED) !== 0;
  const active = (flags & FLAG_ACTIVE) !== 0;
  const busy = !installed || active;
  const pct = busy && toDownload > 0 ? Math.min(100, Math.round((downloaded / toDownload) * 100)) : busy ? 0 : null;
  return {
    appid,
    name,
    installed,
    state: busy ? 'downloading' : 'installed',
    downloadPct: pct,
    sizeBytes: Math.max(0, toInt(getCI(st, 'SizeOnDisk'))),
  };
}

// Compte actif (MostRecent) en premier choix, sinon le premier compte valide.
function parseLoginUsers(text) {
  const users = getCI(parseVdf(text), 'users');
  const list = [];
  if (isObj(users)) {
    for (const [id64, u] of Object.entries(users)) {
      if (!isSteamId64(id64) || !isObj(u)) continue;
      const persona = getCI(u, 'PersonaName');
      list.push({ id64, name: typeof persona === 'string' ? clean(persona, 64) : '', mostRecent: getCI(u, 'MostRecent') === '1' });
    }
  }
  const active = list.find((u) => u.mostRecent) || list[0] || null;
  return { users: list, active };
}

// localconfig.vdf -> Map(appid -> { playtimeMin, lastPlayed (secondes) })
function parseLocalConfig(text) {
  const apps = getPath(parseVdf(text), 'UserLocalConfigStore', 'Software', 'Valve', 'Steam', 'apps');
  const map = new Map();
  if (!isObj(apps)) return map;
  for (const [key, val] of Object.entries(apps)) {
    if (!/^[1-9]\d{0,9}$/.test(key) || !isObj(val)) continue;
    const playtime = getCI(val, 'Playtime') ?? getCI(val, 'playtime_forever');
    const last = toInt(getCI(val, 'LastPlayed'));
    map.set(Number(key), { playtimeMin: Math.max(0, toInt(playtime)), lastPlayed: last > 0 ? last : null });
  }
  return map;
}

module.exports = { parseLibraryFolders, parseAppManifest, parseLoginUsers, parseLocalConfig };
