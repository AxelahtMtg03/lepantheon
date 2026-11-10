import { h, icon } from './dom.js';
import { t } from './i18n.js';
import { formatDate, formatPct } from './format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const R = 54;
const CIRC = 2 * Math.PI * R;

// Anneau de progression (ex. 18 / 42 -> 43 %).
export function ring(unlocked, total) {
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries({ width: 124, height: 124, viewBox: '0 0 124 124', role: 'img', 'aria-label': t('ach.ringLabel', { pct }) })) svg.setAttribute(k, v);
  const mk = (tag, attrs) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  const base = { cx: 62, cy: 62, r: R, fill: 'none', 'stroke-width': 10 };
  const label = mk('text', { x: 62, y: 70, 'text-anchor': 'middle', 'font-family': 'Space Grotesk, sans-serif', 'font-weight': 700, 'font-size': 28, fill: 'var(--text)' });
  label.textContent = `${pct} %`;
  svg.append(
    mk('circle', { ...base, stroke: 'var(--border)' }),
    mk('circle', { ...base, stroke: 'var(--accent)', 'stroke-linecap': 'round', 'stroke-dasharray': `${(CIRC * pct) / 100} ${CIRC}`, transform: 'rotate(-90 62 62)' }),
    label,
  );
  return svg;
}

export const rarityLabel = (a) => t(a.rarity ? `rarity.${a.rarity}` : 'rarity.unknown');

// Carte de succès : la rareté est toujours écrite en toutes lettres (jamais seulement en couleur).
export function achievementCard(a) {
  const iconBox = h('div', { class: `ach-icon${a.unlocked ? '' : ' locked'}` });
  if (a.iconUrl) {
    const img = h('img', { src: a.iconUrl, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => img.replaceWith(icon('trophy', 26)));
    iconBox.append(img);
  } else iconBox.append(icon('trophy', 26));
  const rcls = a.rarity ? `r-${a.rarity}` : 'r-common';
  return h('article', { class: `ach${a.unlocked ? ' done' : ''}` },
    iconBox,
    h('div', { class: 'ach-body' },
      h('div', { class: 'ach-top' }, h('h3', null, a.name), h('span', { class: `ach-rarity ${rcls}` }, rarityLabel(a))),
      h('span', { class: 'ach-desc' }, a.hidden ? t('ach.hidden') : a.description || '—'),
      h('span', { class: 'ach-status' }, a.unlocked ? (a.unlockTime ? t('ach.unlockedOn', { date: formatDate(a.unlockTime) }) : t('ach.unlocked')) : t('ach.locked')),
      h('span', { class: 'ach-players' }, t('ach.players', { pct: formatPct(a.percent) })),
    ),
  );
}
