'use strict';
// API minimale exposée à l'interface. Jamais ipcRenderer en entier.
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld(
  'pantheon',
  Object.freeze({
    getInfo: () => call('app:info'),
    getLibrary: () => call('library:get'),
    getProfile: () => call('profile:get'),
    getGame: (appid) => call('game:get', appid),
    getAchievementsOverview: () => call('achievements:overview'),
    getFeatured: () => call('store:featured'),
    searchStore: (term) => call('store:search', term),
    getStoreApp: (appid) => call('store:app', appid),
    getFriends: () => call('friends:get'),
    getBadges: () => call('badges:get'),
    setLanguage: (code) => call('language:set', code),
    getSettings: () => call('settings:get'),
    saveSettings: (values) => call('settings:set', values),
    setApiKey: (key) => call('apikey:set', key),
    clearApiKey: () => call('apikey:clear'),
    clearCache: () => call('cache:clear'),
    getStartup: () => call('startup:get'),
    setStartup: (enabled) => call('startup:set', enabled === true),
    pickSteamFolder: () => call('steam:pickFolder'),
    toggleFavorite: (appid) => call('favorites:toggle', appid),
    steam: Object.freeze({
      play: (appid) => call('steam:action', 'rungameid', appid),
      install: (appid) => call('steam:action', 'install', appid),
      uninstall: (appid) => call('steam:action', 'uninstall', appid),
      store: (appid) => call('steam:action', 'store', appid),
      chat: (steamId) => call('steam:action', 'friends/message', steamId),
      openSteam: () => call('steam:action', 'open/main'),
    }),
    openExternal: (url) => call('external:open', url),
  }),
);
