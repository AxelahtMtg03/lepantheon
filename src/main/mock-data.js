'use strict';
// Données inventées pour le mode démo (PANTHEON_MOCK=1 ou --mock). Aucun appel réseau, aucun Steam.
const { rarityOf } = require('../shared/rarity');
const { rarestUnlocked } = require('../shared/achievements');
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

const NAMES = ['Premier pas', 'Cartographe', 'Dernier écho', 'Voix du Val', 'Chasseur d’ombres', 'Maître forgeron', 'Sans une égratignure', 'Collectionneur', 'Au bout du monde', 'Légende vivante', 'Perfectionniste', 'Éclaireur'];
const PCTS = [62, 41, 27.4, 18.2, 12.1, 8.4, 5.1, 3.2, 1.8, 0.9];

// Succès inventés mais stables pour un même jeu (mode démo).
function detail(appid) {
  const g = build().find((x) => x.appid === Number(appid));
  if (!g) return null;
  const store = { description: 'Un jeu inventé pour la démonstration. Les vraies descriptions viennent de la boutique Steam.', genres: ['Action-aventure', 'Solo', 'Succès Steam'], developers: ['Studio Fictif'], releaseDate: '12 mars 2024', headerImage: null, screenshots: [] };
  if (!g.achievements) return { game: g, store, achievements: { status: 'none', unlocked: 0, total: 0, list: [] } };
  const { total, unlocked } = g.achievements;
  const now = Math.floor(Date.now() / 1000);
  const list = [];
  const stride = [7, 11, 13, 17, 19, 23].find((s) => total % s !== 0) || 1; // pas premier avec total : exactement `unlocked` succès
  for (let i = 0; i < total; i++) {
    const done = (i * stride) % total < unlocked;
    const percent = PCTS[(i * 3 + Number(appid)) % PCTS.length];
    list.push({
      id: `ACH_${i}`,
      name: i < NAMES.length ? NAMES[i] : `${NAMES[i % NAMES.length]} ${Math.floor(i / NAMES.length) + 1}`,
      description: `Description du succès numéro ${i + 1}.`,
      hidden: false,
      iconUrl: null,
      unlocked: done,
      unlockTime: done ? now - (i + 1) * 86400 * 3 : null,
      percent,
      rarity: rarityOf(percent),
    });
  }
  return { game: g, store, achievements: { status: 'ok', unlocked, total, list } };
}

function overview() {
  const games = build();
  const rows = games.filter((g) => g.achievements).map((g) => ({ appid: g.appid, name: g.name, unlocked: g.achievements.unlocked, total: g.achievements.total, installed: g.installed }));
  const entries = rows.filter((r) => r.unlocked > 0).map((r) => ({ appid: r.appid, name: r.name, items: detail(r.appid).achievements.list }));
  return { rows, rarest: rarestUnlocked(entries, 10), pending: 0, scanning: false, played: rows.length, known: rows.length };
}

const profile = () => ({ name: 'Axel', status: 'online', steamId: null, avatarUrl: null });

module.exports = { build, profile, detail, overview };
