'use strict';
// Rareté d'un succès d'après le % de joueurs qui l'ont débloqué.
// Commun >= 25 %, Peu commun 10-25 %, Rare 3-10 %, Ultra rare < 3 %.
function rarityOf(percent) {
  const p = typeof percent === 'string' && percent.trim() !== '' ? Number(percent) : percent;
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 100) return null;
  if (p >= 25) return 'common';
  if (p >= 10) return 'uncommon';
  if (p >= 3) return 'rare';
  return 'ultra';
}

// Progression en % entier ; null si le jeu n'a pas de succès.
function progressPct(unlocked, total) {
  if (!Number.isInteger(unlocked) || !Number.isInteger(total) || total <= 0) return null;
  return Math.round((Math.min(unlocked, total) / total) * 100);
}

module.exports = { rarityOf, progressPct };
