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

// Textes de démonstration par langue (jeux, amis et noms propres restent identiques).
const TEXT = {
  fr: { names: ['Premier pas', 'Cartographe', 'Dernier écho', 'Voix du Val', 'Chasseur d’ombres', 'Maître forgeron', 'Sans une égratignure', 'Collectionneur', 'Au bout du monde', 'Légende vivante', 'Perfectionniste', 'Éclaireur'], desc: (i) => `Description du succès numéro ${i}.`, demo: 'Un jeu inventé pour la démonstration. Les vraies descriptions viennent de la boutique Steam.', shop: 'Un jeu inventé pour la démonstration de la boutique. Les achats se font toujours dans le vrai Steam.', genres: ['Action-aventure', 'Solo', 'Succès Steam'], shopGenres: ['Aventure', 'Indépendant'], dev: 'Studio Fictif', rel1: '12 mars 2024', rel2: '3 avr. 2025' },
  en: { names: ['First Steps', 'Cartographer', 'Last Echo', 'Voice of the Vale', 'Shadow Hunter', 'Master Smith', 'Not a Scratch', 'Collector', 'Edge of the World', 'Living Legend', 'Perfectionist', 'Scout'], desc: (i) => `Achievement description number ${i}.`, demo: 'A made-up game for demonstration. Real descriptions come from the Steam store.', shop: 'A made-up game to demonstrate the store. Purchases always happen in the real Steam.', genres: ['Action-adventure', 'Single-player', 'Steam Achievements'], shopGenres: ['Adventure', 'Indie'], dev: 'Fictional Studio', rel1: 'Mar 12, 2024', rel2: 'Apr 3, 2025' },
  es: { names: ['Primeros pasos', 'Cartógrafo', 'Último eco', 'Voz del Valle', 'Cazador de sombras', 'Maestro herrero', 'Sin un rasguño', 'Coleccionista', 'Al fin del mundo', 'Leyenda viva', 'Perfeccionista', 'Explorador'], desc: (i) => `Descripción del logro número ${i}.`, demo: 'Un juego inventado para la demostración. Las descripciones reales vienen de la tienda de Steam.', shop: 'Un juego inventado para demostrar la tienda. Las compras siempre se hacen en el Steam real.', genres: ['Acción y aventura', 'Un jugador', 'Logros de Steam'], shopGenres: ['Aventura', 'Indie'], dev: 'Estudio Ficticio', rel1: '12 mar 2024', rel2: '3 abr 2025' },
  ja: { names: ['はじめの一歩', '地図職人', '最後の残響', '谷の声', '影の狩人', '名匠の鍛冶', '無傷', 'コレクター', '世界の果てへ', '生ける伝説', '完璧主義者', '斥候'], desc: (i) => `実績 ${i} の説明文です。`, demo: 'デモ用に作った架空のゲームです。実際の説明は Steam ストアから取得されます。', shop: 'ストアを紹介するための架空のゲームです。購入は常に本物の Steam で行います。', genres: ['アクションアドベンチャー', 'シングルプレイヤー', 'Steam 実績'], shopGenres: ['アドベンチャー', 'インディー'], dev: '架空スタジオ', rel1: '2024年3月12日', rel2: '2025年4月3日' },
  zh: { names: ['迈出第一步', '制图师', '最后的回响', '山谷之声', '暗影猎手', '锻造大师', '毫发无伤', '收藏家', '世界尽头', '活着的传说', '完美主义者', '侦察兵'], desc: (i) => `第 ${i} 个成就的说明。`, demo: '这是用于演示的虚构游戏。真实的简介来自 Steam 商店。', shop: '这是用于演示商店的虚构游戏。购买始终在真正的 Steam 中完成。', genres: ['动作冒险', '单人', 'Steam 成就'], shopGenres: ['冒险', '独立'], dev: '虚构工作室', rel1: '2024年3月12日', rel2: '2025年4月3日' },
};
const textOf = (lang) => TEXT[lang] || TEXT.en;
const PCTS = [62, 41, 27.4, 18.2, 12.1, 8.4, 5.1, 3.2, 1.8, 0.9];

// Succès inventés mais stables pour un même jeu (mode démo).
function detail(appid, lang) {
  const g = build().find((x) => x.appid === Number(appid));
  if (!g) return null;
  const L = textOf(lang);
  const NAMES = L.names;
  const store = { description: L.demo, genres: L.genres, developers: [L.dev], releaseDate: L.rel1, headerImage: null, screenshots: [] };
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
      description: L.desc(i + 1),
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

function overview(lang) {
  const games = build();
  const rows = games.filter((g) => g.achievements).map((g) => ({ appid: g.appid, name: g.name, unlocked: g.achievements.unlocked, total: g.achievements.total, installed: g.installed }));
  const entries = rows.filter((r) => r.unlocked > 0).map((r) => ({ appid: r.appid, name: r.name, items: detail(r.appid, lang).achievements.list }));
  return { rows, rarest: rarestUnlocked(entries, 10), pending: 0, scanning: false, played: rows.length, known: rows.length };
}

// Boutique et amis fictifs (démo).
const SHOP = [
  ['Aether Drift', 2499, 40], ['Brume d’Or', 1999, 0], ['Clockwork Saints', 3499, 25], ['Dernières Cendres', 1499, 60],
  ['Echo Garden', 999, 0], ['Fer et Sel', 2999, 0], ['Glacier Run', 1299, 33], ['Halo Cartographers', 1999, 50],
  ['Ivoire', 4999, 0], ['Jardin Mécanique', 1799, 20], ['Kraken Sound', 2299, 0], ['Lanterne Noire', 3999, 15],
].map(([name, initial, d], i) => ({ appid: 9100001 + i, name, mock: true, price: { currency: 'EUR', initial, final: Math.round(initial * (100 - d) / 100), discountPct: d } }));

function featured() {
  const pick = (from, n) => SHOP.slice(from, from + n);
  return [
    { id: 'specials', items: SHOP.filter((g) => g.price.discountPct > 0).slice(0, 6) },
    { id: 'top_sellers', items: pick(0, 6) },
    { id: 'new_releases', items: pick(6, 6) },
    { id: 'coming_soon', items: pick(3, 4).map((g) => ({ ...g, price: null })) },
  ];
}

const search = (term) => SHOP.filter((g) => g.name.toLowerCase().includes(String(term).trim().toLowerCase())).slice(0, 24);

function storeApp(appid, lang) {
  const L = textOf(lang);
  const g = SHOP.find((x) => x.appid === Number(appid));
  if (!g) return null;
  return { game: { appid: g.appid, name: g.name, mock: true }, store: { name: g.name, description: L.shop, genres: L.shopGenres, developers: [L.dev], releaseDate: L.rel2, price: g.price, screenshots: [] } };
}

function friends() {
  const now = Math.floor(Date.now() / 1000);
  const mk = (i, name, state, gameName, ago) => ({ steamId: `7656119800000${String(1000 + i)}`, name, avatarUrl: null, state, gameName, lastLogoff: ago == null ? null : now - ago });
  return [
    mk(1, 'Nyx', 1, 'Hollow Reach', null), mk(2, 'Orion', 1, null, null), mk(3, 'Selene', 2, null, null), mk(4, 'Atlas', 3, null, null),
    mk(5, 'Pythie', 0, null, 3600 * 5), mk(6, 'Hermès', 0, null, 86400 * 2), mk(7, 'Gaïa', 0, null, 86400 * 9), mk(8, 'Chronos', 1, 'Opus Lumen', null),
  ];
}

const profile = () => ({ name: 'Axel', status: 'online', steamId: null, avatarUrl: null });

module.exports = { build, profile, detail, overview, featured, search, storeApp, friends };
