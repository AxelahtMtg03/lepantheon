import { h, icon } from '../dom.js';
import { t } from '../i18n.js';
import { artLayers } from '../art.js';
import { formatPrice, formatInitialPrice } from '../format.js';

const CATS = ['specials', 'top_sellers', 'new_releases', 'coming_soon'];

function priceLine(price) {
  const now = formatPrice(price);
  const old = formatInitialPrice(price);
  return h('span', { class: 'card-meta price' }, old ? h('s', { class: 'price-old' }, old) : null, old ? ' ' : null, now || t('store.soon'));
}

function storeCard(item) {
  const { bg, layers } = artLayers(item, 'cover');
  const disc = item.price && item.price.discountPct > 0 ? h('span', { class: 'tag disc' }, `-${item.price.discountPct} %`) : null;
  const cover = h('a', { class: 'cover', href: `#/store/${item.appid}`, 'aria-label': t('store.openAria', { name: item.name }), style: { background: bg, display: 'block' } }, layers, h('span', { class: 'tile-title' }, item.name), disc);
  return h('article', { class: 'card' }, cover, h('span', { class: 'card-name' }, item.name), priceLine(item.price));
}

const grid = (items) => h('div', { class: 'grid' }, items.map(storeCard));

export async function renderStore(root, api) {
  const results = h('div', { class: 'store-results' });
  let seq = 0; // ignore les réponses périmées si l'utilisateur tape vite
  let timer = null;

  const input = h('input', { type: 'search', id: 'store-search', placeholder: t('store.search'), autocomplete: 'off', oninput: () => { clearTimeout(timer); timer = setTimeout(run, 350); } });
  const search = h('label', { class: 'search', for: 'store-search' }, icon('search', 18), h('span', { class: 'sr-only' }, t('store.searchLabel')), input);
  const head = h('header', { class: 'page-head' }, h('div', null, h('h1', { class: 'page-title' }, t('nav.store')), h('p', { class: 'page-sub' }, t('store.sub'))), search);

  async function run() {
    const mine = ++seq;
    const term = input.value.trim();
    let data;
    try {
      data = term ? await api.searchStore(term) : await api.getFeatured();
    } catch {
      data = { status: 'error' };
    }
    if (mine !== seq) return;
    if (data.status !== 'ok') {
      results.replaceChildren(h('div', { class: 'notice' }, h('h2', null, t('store.errorTitle')), h('p', null, t(data.status === 'network' ? 'store.network' : 'store.error'))));
      return;
    }
    if (term) {
      results.replaceChildren(data.items.length ? h('section', { class: 'block' }, h('h2', null, t('store.results', { n: data.items.length })), grid(data.items)) : h('p', { class: 'page-sub' }, t('store.noResult')));
      return;
    }
    results.replaceChildren(...CATS.map((id) => data.categories.find((c) => c.id === id)).filter(Boolean).map((c) => h('section', { class: 'block' }, h('h2', null, t(`store.cat.${c.id}`)), grid(c.items))));
  }
  root.replaceChildren(head, h('p', { class: 'hint' }, t('store.hint')), results);
  await run();
  return { dispose: () => clearTimeout(timer) };
}

export async function renderStoreApp(root, api, appid) {
  const data = await api.getStoreApp(appid);
  if (!data) {
    root.replaceChildren(h('a', { class: 'back-link dark', href: '#/store' }, `← ${t('nav.store')}`), h('div', { class: 'notice' }, h('h2', null, t('store.notFound')), h('p', null, t('store.notFoundText'))));
    return;
  }
  const { game, store } = data;
  const { bg, layers } = artLayers(game, 'hero');
  const price = formatPrice(store.price);
  const old = formatInitialPrice(store.price);
  const facts = [];
  if (store.developers && store.developers.length) facts.push([t('game.developer'), store.developers.join(', ')]);
  if (store.releaseDate) facts.push([t('game.release'), store.releaseDate]);

  const hero = h('section', { class: 'game-hero', style: { background: bg } },
    h('div', { class: 'art' }, layers),
    h('div', { class: 'hero-fade' }),
    h('a', { class: 'back-link', href: '#/store' }, `← ${t('nav.store')}`),
    h('div', { class: 'hero-body' },
      h('div', { class: 'tags' }, (store.genres || []).slice(0, 4).map((g) => h('span', { class: 'pill' }, g))),
      h('h1', null, store.name || game.name),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary big', type: 'button', onclick: () => api.steam.store(game.appid) }, t('store.viewInSteam')),
        price ? h('span', { class: 'price-big' }, old ? h('s', { class: 'price-old' }, old) : null, old ? ' ' : null, price, store.price && store.price.discountPct > 0 ? h('span', { class: 'pill gold' }, `-${store.price.discountPct} %`) : null) : h('span', { class: 'price-big' }, t('store.soon')))),
  );
  const body = h('div', { class: 'tab-body' },
    h('div', { class: 'panel-text' },
      h('p', { class: 'lead' }, store.description || t('game.noDescription')),
      facts.length ? h('dl', { class: 'facts' }, facts.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])) : null,
      h('p', { class: 'hint' }, t('store.hint'))),
    store.screenshots && store.screenshots.length ? h('div', { class: 'shots', style: { marginTop: '28px' } }, store.screenshots.map((s) => h('img', { src: s.thumb, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }))) : null);
  root.classList.add('flush');
  root.replaceChildren(hero, body);
  return { dispose: () => root.classList.remove('flush') };
}
