'use strict';
// Source de données : démo, ou lecture locale de Steam fusionnée avec l'API Web (jeux possédés).
const mock = require('./mock-data');
const store = require('./store');
const local = require('./steam-local');

// deps : { api, hasKey } (absents en mode démo)
function createProvider(isMock, deps = {}) {
  const readLocal = () => local.readSteam({ steamPath: store.getSetting('steamPath'), steamId: store.getSetting('steamId') });
  const steamIdOf = (s) => store.getSetting('steamId') || (s.account && s.account.id64) || null;

  return {
    mock: isMock,
    async getLibrary() {
      const favorites = store.getFavorites();
      if (isMock) return { status: 'ok', games: mock.build(), favorites, notice: null };
      const s = await readLocal();
      const steamId = steamIdOf(s);
      let owned = null;
      let notice = null;
      if (!deps.hasKey()) notice = 'no-key';
      else if (!steamId) notice = 'no-steamid';
      else {
        try {
          owned = await deps.api.getOwnedGames(steamId);
          if (owned.hidden) notice = 'private';
        } catch (err) {
          notice = err.code || 'network';
        }
      }
      const byId = new Map(s.games.map((g) => [g.appid, { ...g }]));
      for (const o of owned ? owned.games : []) {
        const g = byId.get(o.appid);
        if (g) {
          g.playtimeMin = Math.max(g.playtimeMin, o.playtimeMin);
          g.lastPlayed = Math.max(g.lastPlayed || 0, o.lastPlayed || 0) || null;
        } else {
          byId.set(o.appid, { appid: o.appid, name: o.name, installed: false, state: 'not-installed', downloadPct: null, sizeBytes: 0, playtimeMin: o.playtimeMin, lastPlayed: o.lastPlayed });
        }
      }
      const games = [...byId.values()].map((g) => ({ achievements: null, ...g }));
      if (!s.found && games.length === 0) return { status: 'steam-not-found', games: [], favorites, notice };
      return { status: 'ok', games, favorites, notice };
    },
    async getProfile() {
      if (isMock) return mock.profile();
      const s = await readLocal();
      const steamId = steamIdOf(s);
      const profile = { name: (s.account && s.account.name) || 'Joueur', status: s.running ? 'online' : 'offline', steamId, avatarUrl: null };
      if (steamId && deps.hasKey()) {
        try {
          const p = await deps.api.getPlayerSummary(steamId);
          if (p.name) profile.name = p.name;
          profile.avatarUrl = p.avatarUrl;
        } catch {
          // sans avatar : l'initiale du pseudo est affichée
        }
      }
      return profile;
    },
    async getSettingsInfo() {
      const s = isMock ? { found: false, steamPath: null, account: null } : await readLocal();
      return {
        steamPath: store.getSetting('steamPath') || '',
        detectedSteamPath: s.steamPath || '',
        steamId: store.getSetting('steamId') || '',
        detectedSteamId: (s.account && s.account.id64) || '',
      };
    },
  };
}

module.exports = { createProvider };
