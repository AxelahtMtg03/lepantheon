import { h } from './dom.js';

// Page de chargement : titre et grille de jaquettes grises qui scintillent. Affichée seulement si la page tarde (> 150 ms).
export function skeletonPage() {
  const card = () => h('div', { class: 'sk-card' }, h('div', { class: 'skel' }));
  return [
    h('div', { class: 'sk-head', 'aria-hidden': 'true' }, h('div', { class: 'sk-line sk-title' }, h('div', { class: 'skel' })), h('div', { class: 'sk-line sk-sub' }, h('div', { class: 'skel' }))),
    h('div', { class: 'grid', 'aria-hidden': 'true' }, Array.from({ length: 12 }, card)),
  ];
}
