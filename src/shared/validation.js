'use strict';
// Validation centrale : liens steam://, URL externes, identifiants.

// Domaines autorisés pour les appels réseau et l'ouverture de liens.
const ALLOWED_HOSTS = Object.freeze([
  'api.steampowered.com',
  'store.steampowered.com',
  'steamcommunity.com',
  'cdn.cloudflare.steamstatic.com',
  'shared.cloudflare.steamstatic.com',
]);

// action -> type d'identifiant attendu
const STEAM_ACTIONS = Object.freeze({
  rungameid: 'appid',
  install: 'appid',
  uninstall: 'appid',
  store: 'appid',
  'friends/message': 'steamid',
  'open/main': 'none',
  'open/downloads': 'none',
});

const APPID_RE = /^[1-9]\d{0,9}$/;
const STEAMID64_RE = /^7656119\d{10}$/;

function isAppId(value) {
  return (typeof value === 'number' || typeof value === 'string') && APPID_RE.test(String(value));
}

function isSteamId64(value) {
  return typeof value === 'string' && STEAMID64_RE.test(value);
}

// Retourne l'URL steam:// ou null si l'action/l'identifiant est refusé.
function buildSteamUrl(action, id) {
  if (typeof action !== 'string' || !Object.hasOwn(STEAM_ACTIONS, action)) return null;
  const kind = STEAM_ACTIONS[action];
  if (kind === 'none') return `steam://${action}`;
  if (kind === 'appid') return isAppId(id) ? `steam://${action}/${String(id)}` : null;
  return isSteamId64(id) ? `steam://${action}/${id}` : null;
}

function isAllowedHost(hostname) {
  return ALLOWED_HOSTS.includes(String(hostname).toLowerCase());
}

// https uniquement, domaine autorisé, sans identifiants dans l'URL.
function isAllowedExternalUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  let u;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  return u.protocol === 'https:' && !u.username && !u.password && isAllowedHost(u.hostname);
}

// URL d'image Steam acceptée : https et CDN Steam uniquement (sinon on n'affiche rien).
function isSteamImageUrl(value) {
  if (typeof value !== 'string' || value.length > 1024) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && (u.hostname.endsWith('.steamstatic.com') || u.hostname.endsWith('.akamaihd.net'));
  } catch {
    return false;
  }
}

module.exports = {
  isSteamImageUrl,
  ALLOWED_HOSTS,
  STEAM_ACTIONS,
  isAppId,
  isSteamId64,
  buildSteamUrl,
  isAllowedHost,
  isAllowedExternalUrl,
};
