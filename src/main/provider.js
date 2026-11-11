'use strict';
// Source de données : démo, ou lecture locale de Steam fusionnée avec l'API Web (jeux possédés).
const mock = require('./mock-data');
const store = require('./store');
const local = require('./steam-local');
const { sortFriends } = require('../shared/friends');

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
      const canAch = deps.hasKey();
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
      const games = [...byId.values()].map((g) => ({ ...g, achievements: canAch && steamId ? deps.achievements.peekSummary(steamId, g.appid) : null }));
      if (canAch && steamId && notice !== 'private') deps.achievements.scan(steamId, games); // en arrière-plan, espacé
      if (!s.found && games.length === 0) return { status: 'steam-not-found', games: [], favorites, notice };
      return { status: 'ok', games, favorites, notice };
    },
    async getProfile() {
      if (isMock) return mock.profile();
      const s = await readLocal();
      const steamId = steamIdOf(s);
      const profile = { name: (s.account && s.account.name) || null, status: s.running ? 'online' : 'offline', steamId, avatarUrl: null };
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
    // Fiche d'un jeu : infos boutique + succès. Ne lève pas d'exception : chaque partie a son statut.
    async getGame(appid) {
      if (isMock) return mock.detail(appid, deps.lang());
      const lib = await this.getLibrary();
      const game = lib.games.find((g) => g.appid === Number(appid));
      if (!game) return null;
      const s = await readLocal();
      const steamId = steamIdOf(s);
      const out = { game, store: null, achievements: { status: 'no-key', unlocked: 0, total: 0, list: [] } };
      if (!deps.hasKey()) return out;
      const [store, ach] = await Promise.allSettled([
        deps.api.getStoreDetails(game.appid),
        steamId ? deps.achievements.detail(steamId, game.appid) : Promise.resolve({ status: 'no-steamid', unlocked: 0, total: 0, list: [] }),
      ]);
      if (store.status === 'fulfilled') out.store = store.value;
      if (ach.status === 'fulfilled') out.achievements = ach.value;
      else out.achievements = { status: ach.reason && ach.reason.code === 'network' ? 'network' : 'error', unlocked: 0, total: 0, list: [] };
      if (out.achievements.status === 'ok') out.game = { ...game, achievements: { unlocked: out.achievements.unlocked, total: out.achievements.total } };
      return out;
    },
    async getAchievementsOverview() {
      if (isMock) return { status: 'ok', ...mock.overview(deps.lang()) };
      if (!deps.hasKey()) return { status: 'no-key', rows: [], rarest: [], pending: 0, scanning: false, played: 0, known: 0 };
      const lib = await this.getLibrary();
      const s = await readLocal();
      const steamId = steamIdOf(s);
      if (!steamId) return { status: 'no-steamid', rows: [], rarest: [], pending: 0, scanning: false, played: 0, known: 0 };
      return { status: 'ok', ...deps.achievements.overview(steamId, lib.games) };
    },
    // Boutique (lecture seule, sans clé).
    async getFeatured() {
      if (isMock) return { status: 'ok', categories: mock.featured() };
      try {
        return { status: 'ok', categories: await deps.api.getFeatured() };
      } catch (err) {
        return { status: err.code === 'network' ? 'network' : 'error', categories: [] };
      }
    },
    async searchStore(term) {
      if (isMock) return { status: 'ok', items: mock.search(term) };
      try {
        return { status: 'ok', items: await deps.api.searchStore(term) };
      } catch (err) {
        return { status: err.code === 'network' ? 'network' : 'error', items: [] };
      }
    },
    async getStoreApp(appid) {
      if (isMock) return mock.storeApp(appid, deps.lang());
      try {
        const store = await deps.api.getStoreDetails(Number(appid));
        return store ? { game: { appid: Number(appid), name: store.name || `App ${appid}` }, store } : null;
      } catch {
        return null;
      }
    },
    // Amis : liste triée (en jeu, en ligne, absent, hors ligne).
    async getFriends() {
      if (isMock) return { status: 'ok', friends: sortFriends(mock.friends()) };
      if (!deps.hasKey()) return { status: 'no-key', friends: [] };
      const steamId = steamIdOf(await readLocal());
      if (!steamId) return { status: 'no-steamid', friends: [] };
      try {
        const r = await deps.api.getFriends(steamId);
        return { status: r.status, friends: sortFriends(r.friends) };
      } catch (err) {
        return { status: err.code === 'network' ? 'network' : err.code === 'invalid-key' ? 'invalid-key' : 'error', friends: [] };
      }
    },
    // Pastille « Téléchargements » du menu (lecture locale uniquement, aucun appel réseau).
    async getBadges() {
      const games = isMock ? mock.build() : (await readLocal()).games;
      return { downloads: games.filter((g) => g.state === 'downloading').length };
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
