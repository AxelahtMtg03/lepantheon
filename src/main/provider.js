'use strict';
// Source de données : démo (étape 1) ; lecture locale Steam et API arrivent aux étapes 3 et 4.
const mock = require('./mock-data');
const store = require('./store');

function createProvider(isMock) {
  return {
    mock: isMock,
    async getLibrary() {
      const games = isMock ? mock.build() : [];
      return { source: isMock ? 'mock' : 'none', games, favorites: store.getFavorites() };
    },
    async getProfile() {
      return isMock ? mock.profile() : { name: 'Joueur', status: 'offline', steamId: null, avatarUrl: null };
    },
  };
}

module.exports = { createProvider };
