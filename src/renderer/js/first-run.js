import { h, logoMark } from './dom.js';
import { t } from './i18n.js';

// Aperçus simplifiés des deux interfaces (dessinés en CSS, sans image).
function previewAgora() {
  return h('div', { class: 'pv pv-agora', 'aria-hidden': 'true' },
    h('div', { class: 'pv-side' }, ...Array.from({ length: 5 }, () => h('i'))),
    h('div', { class: 'pv-main' }, h('i', { class: 'pv-banner' }), h('div', { class: 'pv-grid' }, ...Array.from({ length: 8 }, () => h('i')))));
}
function previewOdeon() {
  return h('div', { class: 'pv pv-odeon', 'aria-hidden': 'true' },
    h('div', { class: 'pv-top' }, h('i'), h('i', { class: 'pv-pill' }), h('i')),
    h('i', { class: 'pv-hero' }),
    h('div', { class: 'pv-rows' }, ...Array.from({ length: 2 }, () => h('div', { class: 'pv-strip' }, ...Array.from({ length: 6 }, () => h('i'))))));
}

export function layoutChoices(current, onPick, name = 'layout') {
  const defs = [['agora', previewAgora], ['odeon', previewOdeon]];
  const cards = defs.map(([id, preview]) => {
    const el = h('button', { class: 'lay-card', type: 'button', role: 'radio', 'aria-checked': String(id === current), 'data-layout': id, onclick: () => pick(id) },
      preview(), h('span', { class: 'lay-name' }, t(`layout.${id}`)), h('span', { class: 'lay-desc' }, t(`layout.${id}Desc`)));
    return el;
  });
  const group = h('div', { class: 'lay-group', role: 'radiogroup', 'aria-label': t('layout.title') }, cards);
  function pick(id) {
    cards.forEach((c) => {
      const on = c.dataset.layout === id;
      c.setAttribute('aria-checked', String(on));
      c.tabIndex = on ? 0 : -1;
    });
    onPick(id);
  }
  cards.forEach((c) => (c.tabIndex = c.getAttribute('aria-checked') === 'true' ? 0 : -1));
  group.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = cards.find((c) => c.getAttribute('aria-checked') !== 'true');
    pick(next.dataset.layout);
    next.focus();
  });
  return group;
}

// Écran « Choisis ton interface », une seule fois. Ne bloque jamais : Échap garde la présélection.
export function showFirstRun(api, prefs, done) {
  let choice = prefs.layout;
  const group = layoutChoices(choice, (id) => { choice = id; });
  let closed = false;
  const finish = async () => {
    if (closed) return;
    closed = true;
    root.remove();
    document.removeEventListener('keydown', onKey, true);
    try {
      done(await api.setPrefs({ layout: choice, firstRunDone: true }));
    } catch (err) {
      console.error(err);
    }
  };
  const btn = h('button', { class: 'btn primary big', type: 'button', onclick: finish }, t('first.continue'));
  const root = h('div', { class: 'gs-overlay fr', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fr-title' },
    h('div', { class: 'fr-panel' },
      logoMark(44),
      h('h1', { id: 'fr-title', class: 'page-title' }, t('first.title')),
      group,
      h('p', { class: 'page-sub' }, t('first.hint')),
      btn));
  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish();
    }
  }
  document.addEventListener('keydown', onKey, true);
  document.body.append(root);
  group.querySelector('[aria-checked="true"]').focus();
}
