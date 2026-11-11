'use strict';
// Langues prises en charge (interface et données Steam). L'interface utilise les mêmes codes (src/renderer/locales).
const LANGUAGES = Object.freeze({
  en: { name: 'English', steam: 'english', folderTitle: 'Steam folder' },
  fr: { name: 'Français', steam: 'french', folderTitle: 'Dossier de Steam' },
  es: { name: 'Español', steam: 'spanish', folderTitle: 'Carpeta de Steam' },
  ja: { name: '日本語', steam: 'japanese', folderTitle: 'Steam フォルダー' },
  zh: { name: '中文（简体）', steam: 'schinese', folderTitle: 'Steam 文件夹' },
});

// « fr-FR », « zh_CN », « ES » -> code pris en charge ; anglais par défaut.
function resolveLanguage(code) {
  const base = typeof code === 'string' ? code.toLowerCase().split(/[-_]/)[0] : '';
  return Object.hasOwn(LANGUAGES, base) ? base : 'en';
}

// Code pays (boutique : devise et prix) ; « us » si inconnu.
function normalizeCountry(code) {
  return typeof code === 'string' && /^[A-Za-z]{2}$/.test(code) ? code.toLowerCase() : 'us';
}

module.exports = { LANGUAGES, resolveLanguage, normalizeCountry };
