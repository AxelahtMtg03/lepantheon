'use strict';
// Statut d'un ami et tri de la liste. Pur, testé.
const RANK = { ingame: 0, online: 1, busy: 2, away: 3, offline: 4 };

function statusKey(f) {
  if (f.gameName) return 'ingame';
  if (f.state === 1 || f.state === 5 || f.state === 6) return 'online';
  if (f.state === 2) return 'busy';
  if (f.state === 3 || f.state === 4) return 'away';
  return 'offline';
}

// En jeu, en ligne, occupé, absent, hors ligne (le plus récemment vu d'abord), puis par pseudo.
function sortFriends(friends) {
  return [...friends].sort((a, b) => RANK[statusKey(a)] - RANK[statusKey(b)] || (b.lastLogoff || 0) - (a.lastLogoff || 0) || a.name.localeCompare(b.name, 'fr'));
}

const countOnline = (friends) => friends.filter((f) => statusKey(f) !== 'offline').length;

module.exports = { statusKey, sortFriends, countOnline };
