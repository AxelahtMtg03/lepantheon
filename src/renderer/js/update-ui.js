import { h, logoMark } from './dom.js';
import { t } from './i18n.js';

// « Redémarrer et mettre à jour » : l'installation est silencieuse et dure environ une minute, pendant laquelle l'appli est fermée.
// On prévient clairement avant de fermer, pour que personne ne rouvre Pantheon trop tôt (l'ancienne version se relancerait).
let started = false;
export function startInstall(api) {
  if (started) return;
  started = true;
  document.body.append(h('div', { class: 'gs-overlay fr upd-wait', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'upd-title' },
    h('div', { class: 'fr-panel' },
      logoMark(56),
      h('h1', { id: 'upd-title', class: 'page-title' }, t('upd.installing')),
      h('p', { class: 'page-sub', role: 'status' }, t('upd.installingHint')),
      h('div', { class: 'sp-bar upd-bar', 'aria-hidden': 'true' }, h('i')))));
  setTimeout(() => api.installUpdate(), 1200);
}
