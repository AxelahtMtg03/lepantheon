import { h } from '../dom.js';
import { t } from '../i18n.js';
import { renderLibrary } from './library.js';
import { storeCard } from './store.js';
import { notOwned } from '../odeon-logic.js';

// Page « Résultats » (touche Entrée dans la recherche) : tous les jeux possédés qui correspondent, en grille comme la bibliothèque,
// puis les jeux de la boutique que l'on n'a pas encore.
export async function renderSearchResults(root, api, query) {
  const view = await renderLibrary(root, api, { query, title: t('search.resultsFor', { q: query }) });
  const [lib, store] = await Promise.all([
    api.getLibrary().catch(() => ({ games: [] })),
    api.searchStore(query).catch(() => ({ status: 'error', items: [] })),
  ]);
  if (!root.isConnected) return view;
  const slot = h('section', { class: 'block' }, h('h2', null, t('search.notOwned')));
  if (store.status !== 'ok') slot.append(h('p', { class: 'page-sub' }, t('search.offline')));
  else {
    const items = notOwned(store.items, lib.games).slice(0, 18);
    if (!items.length) return view; // rien à ajouter : pas de section vide
    slot.append(h('div', { class: 'grid' }, items.map(storeCard)));
  }
  root.append(slot);
  return view;
}
