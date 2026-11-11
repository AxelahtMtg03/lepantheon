'use strict';
// Réglages locaux (favoris, etc.) dans le dossier de données de l'appli. Aucun secret ici.
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const { isAppId } = require('../shared/validation');

let cache = null;
const file = () => path.join(app.getPath('userData'), 'settings.json');

function load() {
  if (cache) return cache;
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(file(), 'utf8'));
  } catch {
    // fichier absent ou corrompu : on repart de zéro
  }
  const favorites = Array.isArray(raw.favorites) ? raw.favorites.filter(isAppId).map(Number) : [];
  cache = { favorites: [...new Set(favorites)] };
  for (const k of Object.keys(TEXT_SETTINGS)) if (typeof raw[k] === 'string') cache[k] = raw[k].slice(0, TEXT_SETTINGS[k]);
  return cache;
}

function save() {
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    const tmp = `${file()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
    fs.renameSync(tmp, file());
  } catch (err) {
    console.error('Enregistrement des réglages impossible :', err.code || err.message);
  }
}

// Réglages texte modifiables (chemin Steam, SteamID64) ; l'écran de réglages arrive à l'étape 7.
const TEXT_SETTINGS = { steamPath: 260, steamId: 17, language: 5, updates: 3 }; // updates : « on » ou « off »

function getSetting(key) {
  const v = Object.hasOwn(TEXT_SETTINGS, key) ? load()[key] : undefined;
  return typeof v === 'string' && v ? v : null;
}

function setSetting(key, value) {
  if (!Object.hasOwn(TEXT_SETTINGS, key)) throw new Error('Réglage inconnu');
  const s = load();
  s[key] = typeof value === 'string' ? value.trim().slice(0, TEXT_SETTINGS[key]) : '';
  save();
}

function getFavorites() {
  return [...load().favorites];
}

function toggleFavorite(appid) {
  const s = load();
  const id = Number(appid);
  s.favorites = s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id];
  save();
  return [...s.favorites];
}

module.exports = { getFavorites, toggleFavorite, getSetting, setSetting };
