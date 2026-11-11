import { h } from './dom.js';
import { t } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// Logo animé : l'anneau se trace, le fronton descend, l'entablement s'élargit, les colonnes montent. Une seule fois, ~1,2 s.
function animatedLogo() {
  const svg = svgEl('svg', { width: 220, height: 220, viewBox: '0 0 120 120', 'aria-hidden': 'true' });
  const w = 'var(--text)';
  svg.append(
    svgEl('circle', { class: 'sp-ring', cx: 60, cy: 60, r: 54, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 6, transform: 'rotate(-90 60 60)' }),
    svgEl('circle', { class: 'sp-glow', cx: 60, cy: 60, r: 54, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.5 }),
    svgEl('polygon', { class: 'sp-ped', points: '28,48 92,48 60,28', fill: w }),
    svgEl('rect', { class: 'sp-ent', x: 28, y: 51, width: 64, height: 5, fill: w }),
    ...[32, 48, 64, 80].map((x, i) => svgEl('rect', { class: `sp-col sp-col${i}`, x, y: 59, width: 8, height: 26, fill: w })),
    svgEl('rect', { class: 'sp-base', x: 28, y: 88, width: 64, height: 4, fill: w }),
  );
  return svg;
}

// Construit l'écran de démarrage. Retourne { root, setStage, hide }.
export function buildSplash(stage) {
  const status = h('div', { class: 'sp-status', role: 'status', 'aria-live': 'polite' });
  const setStage = (key) => {
    status.textContent = t(key);
  };
  setStage(stage || 'splash.steam');
  const root = h('div', { class: 'splash', 'data-splash': '' },
    h('div', { class: 'sp-halo sp-halo1', 'aria-hidden': 'true' }),
    h('div', { class: 'sp-halo sp-halo2', 'aria-hidden': 'true' }),
    h('div', { class: 'sp-center' },
      animatedLogo(),
      h('div', { class: 'sp-titles' }, h('span', { class: 'sp-name' }, t('app.name')), h('span', { class: 'sp-tag' }, t('splash.tagline'))),
      h('div', { class: 'sp-load' },
        h('div', { class: 'sp-bar', 'aria-hidden': 'true' }, h('i')), // barre indéterminée : pas de fausse progression
        status,
        h('span', { class: 'sp-skip' }, t('splash.skip')),
      ),
    ),
  );
  return {
    root,
    setStage,
    hide() {
      root.classList.add('out');
      const remove = () => root.remove();
      root.addEventListener('transitionend', remove, { once: true });
      setTimeout(remove, 400); // au cas où l'animation est désactivée
    },
  };
}
