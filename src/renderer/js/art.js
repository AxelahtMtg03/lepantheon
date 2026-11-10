import { h } from './dom.js';

const CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

// Couleurs de repli (tons bleus sobres) quand le jeu n'en fournit pas.
function tileColors(game) {
  if (game.bg && game.shape) return { bg: game.bg, shape: game.shape };
  let hash = 0;
  for (const ch of String(game.name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { bg: `hsl(${215 + (hash % 35)} 45% ${16 + (hash % 7)}%)`, shape: `hsl(${215 + (hash % 35)} 70% 65%)` };
}

// Image officielle avec repli : library_600x900 -> header -> tuile colorée.
function officialImage(appid, files) {
  let i = 0;
  const img = h('img', { class: 'art-img', alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => {
    i += 1;
    if (i < files.length) img.src = `${CDN}/${appid}/${files[i]}`;
    else img.remove();
  });
  // Une vraie jaquette contient déjà le titre : on masque alors la tuile. Le héros seul n'en a pas : on garde le titre.
  img.addEventListener('load', () => {
    const cover = img.closest('.cover');
    if (cover) cover.classList.add(files[i] === 'library_hero.jpg' ? 'has-hero-art' : 'has-art');
  });
  img.src = `${CDN}/${appid}/${files[0]}`;
  return img;
}

// Fond coloré (démo ou repli) + image officielle par-dessus pour les vrais jeux.
export function artLayers(game, kind) {
  const c = tileColors(game);
  const layers = [
    h('div', { class: 'tile-shape', style: { background: c.shape } }),
    h('div', { class: 'tile-ring', style: { borderColor: c.shape } }),
  ];
  if (!game.mock) {
    layers.push(officialImage(game.appid, kind === 'hero' ? ['library_hero.jpg', 'header.jpg'] : ['library_600x900.jpg', 'header.jpg', 'library_hero.jpg']));
  }
  return { bg: c.bg, layers };
}
