import { h } from '../dom.js';
import { t } from '../i18n.js';
import { renderLibrary } from './library.js';
import { storeCard } from './store.js';
import { notOwned } from '../odeon-logic.js';

// Page « Résultats » (touche Entrée dans la recherche) : tous les jeux possédés qui correspondent, en grille comme la bibliothèque,
// puis les jeux de la boutique que l'on n'a pas encore. La page s'affiche tout de suite ; la boutique (réseau) arrive ensuite,
// sans jamais bloquer ni laisser un écran de chargement.
export async function renderSearchResults(root, api, query) {
  const view = await renderLibrary(root, api, { query, title: t('search.resultsFor', { q: query }) });
  let alive = true;
  const slot = h('section', { class: 'block hidden' }, h('h2', null, t('search.notOwned')), h('div', { class: 'gs-skel skel', 'aria-hidden': 'true' }));
  root.append(slot);

  (async () => {
    let store;
    let games = [];
    try {
      [store, games] = await Promise.all([
        api.searchStore(query).catch(() => ({ status: 'error', items: [] })),
        api.getLibrary().then((l) => l.games).catch(() => []),
      ]);
    } catch {
      store = { status: 'error', items: [] };
    }
    if (!alive) return;
    if (store.status !== 'ok') {
      slot.replaceChildren(h('h2', null, t('search.notOwned')), h('p', { class: 'page-sub' }, t('search.offline')));
      slot.classList.remove('hidden');
      return;
    }
    const items = notOwned(store.items, games).slice(0, 18);
    if (!items.length) {
      slot.remove(); // rien à ajouter : pas de section vide
      return;
    }
    slot.replaceChildren(h('h2', null, t('search.notOwned')), h('div', { class: 'grid' }, items.map(storeCard)));
    slot.classList.remove('hidden');
  })();

  return { dispose() { alive = false; view?.dispose?.(); } };
}
