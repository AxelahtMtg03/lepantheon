import { h, icon } from './dom.js';
import { t } from './i18n.js';
import { artLayers } from './art.js';
import { formatPrice } from './format.js';
import { searchOwned, notOwned, createDebounce, isPlatinum } from './odeon-logic.js';

let openOverlay = null;

// Recherche commune aux deux dispositions : « Dans ta bibliothèque » (local, instantané) puis « Pas encore à toi » (boutique Steam).
export async function openSearch(api) {
  if (openOverlay) {
    openOverlay.input.focus();
    return;
  }
  const origin = document.activeElement;
  let games = [];
  try {
    games = (await api.getLibrary()).games;
  } catch {
    // la recherche de la boutique reste utilisable
  }

  const input = h('input', { type: 'search', id: 'gs-input', placeholder: t('search.placeholder'), autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'gs-results' });
  const closeBtn = h('button', { class: 'btn small', type: 'button', onclick: close }, t('search.close'));
  const ownedBox = h('div', { class: 'gs-list' });
  const storeBox = h('div', { class: 'gs-list' });
  const ownedSec = h('section', { class: 'gs-sec hidden', 'aria-label': t('search.owned') }, h('h2', null, t('search.owned')), ownedBox);
  const storeSec = h('section', { class: 'gs-sec hidden', 'aria-label': t('search.notOwned') }, h('h2', null, t('search.notOwned')), storeBox);
  const none = h('p', { class: 'page-sub gs-none hidden', role: 'status' }, t('search.none'));
  const results = h('div', { id: 'gs-results', class: 'gs-results', role: 'listbox' }, ownedSec, storeSec, none);
  const panel = h('div', { class: 'gs-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('search.title') },
    h('div', { class: 'gs-top' }, h('label', { class: 'gs-field', for: 'gs-input' }, icon('search', 22), h('span', { class: 'sr-only' }, t('search.title')), input), closeBtn),
    results);
  const root = h('div', { class: 'gs-overlay' }, panel);
  let seq = 0;
  let ownedCount = 0;
  let storeState = 'idle'; // idle | loading | done | offline

  const thumb = (g) => {
    const { bg, layers } = artLayers(g, 'cover');
    return h('span', { class: 'gs-thumb', style: { background: bg } }, h('span', { class: 'art' }, layers));
  };

  function ownedItem(g) {
    const state = isPlatinum(g) ? t('search.platinum') : g.installed ? t('card.installed') : t('card.notInstalled');
    const prog = g.achievements && g.achievements.total > 0 ? ` · ${t('meta.achievements', { u: g.achievements.unlocked, t: g.achievements.total })}` : '';
    return h('button', { class: 'gs-item', type: 'button', role: 'option', onclick: () => { close(); location.hash = `#/game/${g.appid}`; } },
      thumb(g), h('span', { class: 'gs-name' }, g.name), h('span', { class: 'gs-sub' }, state + prog));
  }
  function storeItem(it) {
    const price = it.price ? formatPrice(it.price) : '';
    return h('div', { class: 'gs-item', role: 'option' },
      thumb(it), h('span', { class: 'gs-name' }, it.name), h('span', { class: 'gs-sub' }, price || ''),
      h('button', { class: 'btn small', type: 'button', onclick: () => api.steam.store(it.appid) }, t('search.viewSteam')));
  }

  function paint(owned, store) {
    ownedBox.replaceChildren(...owned.map(ownedItem));
    ownedSec.classList.toggle('hidden', owned.length === 0);
    storeBox.replaceChildren(...store.map(storeItem));
    const showStore = store.length > 0 || storeState === 'loading' || storeState === 'offline';
    storeSec.classList.toggle('hidden', !showStore);
    if (storeState === 'loading' && store.length === 0) storeBox.replaceChildren(h('div', { class: 'gs-skel skel', 'aria-hidden': 'true' }), h('span', { class: 'sr-only', role: 'status' }, t('search.loading')));
    if (storeState === 'offline') storeBox.replaceChildren(h('p', { class: 'page-sub', role: 'status' }, t('search.offline')));
    none.classList.toggle('hidden', !input.value.trim() || owned.length > 0 || store.length > 0 || storeState === 'loading' || storeState === 'offline');
    ownedCount = owned.length;
  }

  async function runStore(term) {
    const mine = ++seq;
    storeState = 'loading';
    paint(searchOwned(games, term), []);
    let items = [];
    try {
      const r = await api.searchStore(term);
      if (mine !== seq) return; // réponse périmée : une frappe plus récente est en cours
      if (r.status === 'ok') {
        storeState = 'done';
        items = notOwned(r.items, games).slice(0, 12);
      } else storeState = 'offline';
    } catch {
      if (mine !== seq) return;
      storeState = 'offline';
    }
    paint(searchOwned(games, term), items);
  }
  const debounced = createDebounce(runStore, 250);

  input.addEventListener('input', () => {
    const term = input.value.trim();
    if (!term) {
      debounced.cancel();
      seq += 1;
      storeState = 'idle';
      paint([], []);
      return;
    }
    paint(searchOwned(games, term), []); // local : instantané
    storeState = 'loading';
    storeSec.classList.remove('hidden');
    storeBox.replaceChildren(h('div', { class: 'gs-skel skel', 'aria-hidden': 'true' }));
    debounced(term);
  });

  const items = () => [...results.querySelectorAll('button.gs-item, .gs-item .btn')];
  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const list = items();
      if (!list.length) return;
      e.preventDefault();
      const i = list.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % list.length : (i <= 0 ? list.length - 1 : i - 1);
      list[next].focus();
      return;
    }
    if (e.key === 'Enter' && document.activeElement === input) {
      const first = results.querySelector('button.gs-item');
      if (first) first.click();
      return;
    }
    if (e.key === 'Tab') {
      // Le focus reste dans la fenêtre de recherche.
      const f = [input, closeBtn, ...items()];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
    }
  }
  root.addEventListener('keydown', onKey);
  root.addEventListener('pointerdown', (e) => {
    if (e.target === root) close();
  });

  function close() {
    debounced.cancel();
    seq += 1;
    root.remove();
    openOverlay = null;
    if (origin && origin.isConnected) origin.focus();
  }

  document.body.append(root);
  openOverlay = { input };
  input.focus();
}

// Ctrl + K et « / » ouvrent la recherche sur toutes les pages (sauf pendant la saisie dans un champ).
export function installSearchShortcut(api) {
  document.addEventListener('keydown', (e) => {
    const typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearch(api);
    } else if (e.key === '/' && !typing && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      openSearch(api);
    }
  });
}
