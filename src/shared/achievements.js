'use strict';
// Fusion des trois sources (succès du joueur, schéma officiel, % global) et calculs dérivés. Pur, testé.
const { rarityOf } = require('./rarity');

function mergeAchievements(player, schema, globals) {
  const byId = new Map((Array.isArray(schema) ? schema : []).map((s) => [s.id, s]));
  const pct = globals && typeof globals === 'object' ? globals : {};
  return (Array.isArray(player) ? player : []).map((a) => {
    const s = byId.get(a.id) || {};
    const percent = Object.hasOwn(pct, a.id) && Number.isFinite(pct[a.id]) ? pct[a.id] : null;
    const description = s.description || a.description || '';
    return {
      id: a.id,
      name: s.name || a.name || a.id,
      description,
      hidden: !!s.hidden && !a.unlocked && !description,
      iconUrl: (a.unlocked ? s.icon : s.iconGray || s.icon) || null,
      unlocked: !!a.unlocked,
      unlockTime: a.unlockTime || null,
      percent,
      rarity: rarityOf(percent),
    };
  });
}

// { unlocked, total } ou null si le jeu n'a pas de succès.
function summarize(player) {
  if (!player || player.status !== 'ok' || !Array.isArray(player.list) || player.list.length === 0) return null;
  return { unlocked: player.list.filter((a) => a.unlocked).length, total: player.list.length };
}

// entries : [{ appid, name, items }] -> les n succès débloqués les plus rares (tous jeux confondus).
function rarestUnlocked(entries, n = 10) {
  const all = [];
  for (const e of entries) {
    for (const it of e.items) if (it.unlocked && it.percent !== null) all.push({ appid: e.appid, game: e.name, ...it });
  }
  return all.sort((a, b) => a.percent - b.percent).slice(0, n);
}

module.exports = { mergeAchievements, summarize, rarestUnlocked };
