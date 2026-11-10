'use strict';
// Données inventées pour le mode démo (PANTHEON_MOCK=1 ou --mock). Aucun appel réseau, aucun Steam.
const H = 3600;
const GB = 1024 ** 3;

function build() {
  const now = Math.floor(Date.now() / 1000);
  // [nom, état, % téléchargement, minutes jouées, dernière session (h), succès débloqués, total, taille Go, fond, forme]
  const rows = [
    ['Hollow Reach', 'installed', null, 744, 22, 18, 42, 18.4, '#1a2147', '#6f8dff'],
    ['Opus Lumen', 'installed', null, 2310, 70, 36, 36, 9.2, '#1c2a5a', '#8fb4ff'],
    ['Titan Foundry', 'downloading', 61, 0, null, 0, 30, 41.0, '#1f2a3d', '#5b7bd6'],
    ['Cendres d’Ys', 'installed', null, 1260, 160, 31, 48, 27.5, '#22253f', '#7a86d9'],
    ['Neon Archivist', 'not-installed', null, 95, 900, 4, 25, 6.1, '#182640', '#4d8dff'],
    ['Les Marées Basses', 'installed', null, 410, 300, 20, 22, 3.3, '#17304a', '#79a8e8'],
    ['Kitsune Run', 'installed', null, 880, 480, 24, 24, 1.9, '#2a2547', '#9a8fe0'],
    ['Orbital Gardeners', 'not-installed', null, 0, null, 0, 40, 12.8, '#16283a', '#5fa0d8'],
    ['Dernier Phare', 'installed', null, 150, 1100, 9, 30, 14.0, '#1b2036', '#6a7fc4'],
    ['Pixel Brigade', 'not-installed', null, 33, 2400, 2, 18, 0.8, '#222a4a', '#8099ff'],
    ['Vaisseau Mère', 'not-installed', null, 0, null, null, null, 22.6, '#141f33', '#4a74c9'],
    ['Saltmarsh Kings', 'installed', null, 560, 640, 27, 35, 8.4, '#1d2745', '#6f8dff'],
  ];
  return rows.map(([name, state, pct, min, ago, ach, total, gb, bg, shape], i) => ({
    appid: 9000001 + i,
    name,
    state,
    downloadPct: pct,
    installed: state === 'installed',
    playtimeMin: min,
    lastPlayed: ago == null ? null : now - ago * H,
    achievements: total == null ? null : { unlocked: ach, total },
    sizeBytes: Math.round(gb * GB),
    bg,
    shape,
    mock: true,
  }));
}

const profile = () => ({ name: 'Axel', status: 'online', steamId: null, avatarUrl: null });

module.exports = { build, profile };
