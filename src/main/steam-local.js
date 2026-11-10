'use strict';
// Lecture locale de Steam (lecture seule : aucun fichier n'est modifié, aucun mot de passe lu).
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { parseLibraryFolders, parseAppManifest, parseLoginUsers, parseLocalConfig } = require('../shared/steam-parse');
const { toId32 } = require('../shared/steamid');

const MAX_FILE = 20 * 1024 * 1024;
const FALLBACKS = ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam'];

const isDir = (p) => fs.stat(p).then((s) => s.isDirectory(), () => false);

async function readText(file) {
  try {
    const st = await fs.stat(file);
    if (!st.isFile() || st.size > MAX_FILE) return null;
    return await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

function regQuery(key, value) {
  return new Promise((resolve) => {
    execFile('reg', ['query', key, '/v', value], { windowsHide: true, timeout: 4000 }, (err, stdout) => resolve(err ? null : stdout));
  });
}

async function findSteamPath(override) {
  const candidates = [];
  if (typeof override === 'string' && override) candidates.push(override);
  const out = await regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath');
  const m = out && /SteamPath\s+REG_SZ\s+(.+)/i.exec(out);
  if (m) candidates.push(path.normalize(m[1].trim()));
  candidates.push(...FALLBACKS);
  for (const c of candidates) if (await isDir(path.join(c, 'steamapps'))) return c;
  return null;
}

async function isSteamRunning() {
  const out = await regQuery('HKCU\\Software\\Valve\\Steam\\ActiveProcess', 'ActiveUser');
  const m = out && /ActiveUser\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(out);
  return !!m && parseInt(m[1], 16) !== 0;
}

async function readInstalledGames(steamPath) {
  const libs = new Set([steamPath]);
  const lf = await readText(path.join(steamPath, 'steamapps', 'libraryfolders.vdf'));
  if (lf) {
    try {
      parseLibraryFolders(lf).forEach((p) => libs.add(path.normalize(p)));
    } catch {
      // fichier illisible : on garde au moins la bibliothèque principale
    }
  }
  const games = new Map();
  for (const lib of libs) {
    let files;
    try {
      files = await fs.readdir(path.join(lib, 'steamapps'));
    } catch {
      continue; // disque débranché, etc.
    }
    for (const f of files) {
      if (!/^appmanifest_\d+\.acf$/i.test(f)) continue;
      const text = await readText(path.join(lib, 'steamapps', f));
      if (!text) continue;
      try {
        const g = parseAppManifest(text);
        if (g && !games.has(g.appid)) games.set(g.appid, g);
      } catch {
        // manifeste corrompu : ignoré
      }
    }
  }
  return [...games.values()];
}

async function readAccount(steamPath, preferredId64) {
  const text = await readText(path.join(steamPath, 'config', 'loginusers.vdf'));
  let active = null;
  if (text) {
    try {
      const { users, active: a } = parseLoginUsers(text);
      active = (preferredId64 && users.find((u) => u.id64 === preferredId64)) || a;
    } catch {
      // ignoré
    }
  }
  return active;
}

async function readPlaytimes(steamPath, id64) {
  const id32 = toId32(id64);
  if (!id32) return new Map();
  const text = await readText(path.join(steamPath, 'userdata', String(id32), 'config', 'localconfig.vdf'));
  try {
    return text ? parseLocalConfig(text) : new Map();
  } catch {
    return new Map();
  }
}

// Instantané complet de l'état local. Ne lève jamais d'exception.
async function readSteam({ steamPath: override, steamId } = {}) {
  const steamPath = await findSteamPath(override);
  if (!steamPath) return { found: false, steamPath: null, games: [], account: null, running: false };
  const [installed, account, running] = await Promise.all([
    readInstalledGames(steamPath),
    readAccount(steamPath, steamId),
    isSteamRunning(),
  ]);
  const times = account ? await readPlaytimes(steamPath, account.id64) : new Map();
  const games = installed.map((g) => {
    const t = times.get(g.appid);
    return { ...g, playtimeMin: t ? t.playtimeMin : 0, lastPlayed: t ? t.lastPlayed : null };
  });
  return { found: true, steamPath, games, account, running };
}

module.exports = { readSteam, findSteamPath };
