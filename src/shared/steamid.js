'use strict';
// SteamID64 <-> id32 (compte). id64 = id32 + 76561197960265728.
const BASE = 76561197960265728n;

// Retourne l'id32 (nombre) ou null si l'entrée n'est pas un SteamID64 valide.
function toId32(id64) {
  if (typeof id64 !== 'string' || !/^7656119\d{10}$/.test(id64)) return null;
  const v = BigInt(id64) - BASE;
  return v > 0n && v <= 0xffffffffn ? Number(v) : null;
}

// Retourne le SteamID64 (chaîne) ou null.
function toId64(id32) {
  const s = typeof id32 === 'number' ? String(id32) : id32;
  if (typeof s !== 'string' || !/^[1-9]\d{0,9}$/.test(s)) return null;
  const v = BigInt(s);
  return v <= 0xffffffffn ? String(v + BASE) : null;
}

module.exports = { toId32, toId64 };
