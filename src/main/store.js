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

module.exports = { getFavorites, toggleFavorite };
