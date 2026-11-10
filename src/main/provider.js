'use strict';
// Source de données : démo ou lecture locale de Steam (l'API Steam arrive à l'étape 4).
const mock = require('./mock-data');
const store = require('./store');
const local = require('./steam-local');

const readLocal = () => local.readSteam({ steamPath: store.getSetting('steamPath'), steamId: store.getSetting('steamId') });

function createProvider(isMock) {
  return {
    mock: isMock,
    async getLibrary() {
      const favorites = store.getFavorites();
      if (isMock) return { status: 'ok', games: mock.build(), favorites };
      const s = await readLocal();
      if (!s.found) return { status: 'steam-not-found', games: [], favorites };
      return { status: 'ok', games: s.games, favorites };
    },
    async getProfile() {
      if (isMock) return mock.profile();
      const s = await readLocal();
      return {
        name: (s.account && s.account.name) || 'Joueur',
        status: s.running ? 'online' : 'offline',
        steamId: s.account ? s.account.id64 : null,
        avatarUrl: null,
      };
    },
  };
}

module.exports = { createProvider };
