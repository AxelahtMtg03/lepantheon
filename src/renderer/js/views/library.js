import { h, icon } from '../dom.js';
import { t } from '../i18n.js';
import { artLayers } from '../art.js';
import { formatPlaytime, formatRelative, achievementPct, isComplete } from '../format.js';

const FILTERS = ['all', 'installed', 'downloading', 'favorites', 'almost'];
const SORTS = ['recent', 'name', 'playtime', 'achievements'];

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cmpDesc = (a, b) => (b ?? -1) - (a ?? -1);

const filterFns = {
  all: () => true,
  installed: (g) => g.installed,
  downloading: (g) => g.state === 'downloading',
  favorites: (g, favs) => favs.has(g.appid),
  almost: (g) => {
    const p = achievementPct(g);
    return p !== null && p >= 75 && p < 100;
  },
};
const sortFns = {
  recent: (a, b) => cmpDesc(a.lastPlayed, b.lastPlayed),
  name: (a, b) => a.name.localeCompare(b.name, 'fr'),
  playtime: (a, b) => cmpDesc(a.playtimeMin, b.playtimeMin),
  achievements: (a, b) => cmpDesc(achievementPct(a), achievementPct(b)),
};

function metaText(g) {
  if (g.playtimeMin <= 0 && !g.achievements) return t('meta.never');
  const parts = [];
  parts.push(g.playtimeMin > 0 ? formatPlaytime(g.playtimeMin) : t('meta.never'));
  if (g.achievements && g.achievements.total > 0) {
    parts.push(isComplete(g) ? t('meta.complete') : t('meta.achievements', { u: g.achievements.unlocked, t: g.achievements.total }));
  }
  return parts.join(' · ');
}

function tagText(g) {
  if (g.state === 'downloading') return t('card.downloading', { pct: Math.round(g.downloadPct || 0) });
  return g.installed ? t('card.installed') : t('card.notInstalled');
}

function actionOf(api, g) {
  if (g.state === 'downloading') return null;
  return g.installed
    ? { icon: 'play', aria: 'card.playAria', run: () => api.steam.play(g.appid) }
    : { icon: 'downloads', aria: 'card.installAria', run: () => api.steam.install(g.appid) };
}

// Une carte est créée une seule fois ; update() ne touche que ce qui change.
function buildCard(game, ctx) {
  let g = game;
  const { bg, layers } = artLayers(g, 'cover');
  const tag = h('span', { class: 'tag' });
  const barFill = h('span');
  const bar = h('div', { class: 'dl-bar' }, barFill);
  const nameEl = h('span', { class: 'card-name' });
  const metaEl = h('span', { class: 'card-meta' });
  const tileTitle = h('span', { class: 'tile-title' });
  const open = h('button', { class: 'cover-open', type: 'button', onclick: () => { location.hash = `#/game/${g.appid}`; } });
  const fav = h('button', { class: 'fav', type: 'button', onclick: () => ctx.toggleFav(g.appid) });
  const play = h('button', { class: 'playbtn', type: 'button', onclick: () => actionOf(ctx.api, g)?.run() });
  const cover = h('div', { class: 'cover', style: { background: bg } }, layers, tileTitle, open, tag, bar, fav, play);
  const el = h('article', { class: 'card' }, cover, nameEl, metaEl);

  function update(next) {
    g = next;
    const isFav = ctx.favs.has(g.appid);
    tileTitle.textContent = g.name;
    nameEl.textContent = g.name;
    metaEl.textContent = metaText(g);
    tag.textContent = tagText(g);
    barFill.style.width = `${Math.min(100, Math.max(0, g.downloadPct || 0))}%`;
    bar.classList.toggle('hidden', g.state !== 'downloading');
    open.setAttribute('aria-label', t('card.openAria', { name: g.name }));
    fav.setAttribute('aria-pressed', String(isFav));
    fav.setAttribute('aria-label', t(isFav ? 'card.favRemove' : 'card.favAdd', { name: g.name }));
    fav.replaceChildren(icon(isFav ? 'starFill' : 'star', 20));
    const act = actionOf(ctx.api, g);
    play.classList.toggle('hidden', !act);
    if (act) {
      play.setAttribute('aria-label', t(act.aria, { name: g.name }));
      play.replaceChildren(icon(act.icon, 18));
    }
  }
  update(g);
  return { el, update };
}

function countsText(games) {
  const installed = games.filter((g) => g.installed).length;
  const dl = games.filter((g) => g.state === 'downloading').length;
  const parts = [t('lib.count.games', { n: games.length }), t('lib.count.installed', { n: installed })];
  if (dl > 0) parts.push(t('lib.count.downloading', { n: dl }));
  return parts.join(' · ');
}

function buildContinue(api, games) {
  const last = games.filter((g) => g.installed && g.lastPlayed).sort(sortFns.recent)[0];
  if (!last) return null;
  const { bg, layers } = artLayers(last, 'hero');
  const meta = h('div', { class: 'continue-meta' }, h('span', null, formatPlaytime(last.playtimeMin)));
  if (last.achievements && last.achievements.total > 0) {
    const pct = achievementPct(last);
    meta.append(
      h('span', { 'aria-hidden': 'true' }, '·'),
      h('span', null, t('meta.achievements', { u: last.achievements.unlocked, t: last.achievements.total })),
      h('span', { class: 'progress', style: { width: '110px' }, role: 'img', 'aria-label': `${pct} %` }, h('span', { style: { width: `${pct}%` } })),
    );
  }
  return h(
    'section',
    { class: 'continue', 'aria-label': t('lib.continue'), style: { background: bg } },
    h('div', { class: 'art' }, layers),
    h('div', { class: 'shade' }),
    h('div', { class: 'continue-body' },
      h('span', { class: 'eyebrow' }, `${t('lib.continue')} · ${formatRelative(last.lastPlayed)}`),
      h('h2', null, last.name),
      meta,
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => api.steam.play(last.appid) }, icon('play', 16), t('lib.play')),
        h('a', { class: 'btn', href: `#/game/${last.appid}` }, t('lib.viewGame')),
      ),
    ),
  );
}

export async function renderLibrary(root, api) {
  const data = await api.getLibrary();
  const games = data.games;
  const favs = new Set(data.favorites);
  const state = { filter: 'all', sort: 'recent', query: '' };
  const cards = new Map();
  const ctx = {
    api,
    favs,
    async toggleFav(appid) {
      const list = await api.toggleFavorite(appid);
      favs.clear();
      list.forEach((id) => favs.add(id));
      games.forEach((g) => cards.get(g.appid).update(g));
      renderGrid();
    },
  };

  const title = h('div', null, h('h1', { class: 'page-title' }, t('lib.title')), h('p', { class: 'page-sub' }, countsText(games)));
  const input = h('input', { type: 'search', id: 'lib-search', placeholder: t('lib.search'), autocomplete: 'off', oninput: (e) => { state.query = e.target.value; renderGrid(); } });
  const search = h('label', { class: 'search', for: 'lib-search' }, icon('search', 18), h('span', { class: 'sr-only' }, t('lib.searchLabel')), input);
  const head = h('header', { class: 'page-head' }, title, search);

  if (games.length === 0) {
    root.replaceChildren(head, h('div', { class: 'notice' }, h('h2', null, t('empty.noneTitle')), h('p', null, t('empty.noneText'))));
    return;
  }

  const chipBtns = FILTERS.map((f) =>
    h('button', { class: 'chip', type: 'button', 'aria-pressed': String(f === state.filter), onclick: () => { state.filter = f; chipBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(FILTERS[i] === f))); renderGrid(); } }, t(`filter.${f}`)),
  );
  const select = h('select', { id: 'lib-sort', onchange: (e) => { state.sort = e.target.value; renderGrid(); } }, SORTS.map((s) => h('option', { value: s }, t(`sort.${s}`))));
  const toolbar = h('div', { class: 'toolbar' }, h('div', { class: 'chips' }, chipBtns), h('label', { class: 'sort', for: 'lib-sort' }, t('lib.sortBy'), select));

  const grid = h('section', { class: 'grid', 'aria-label': t('lib.games') });
  const empty = h('p', { class: 'page-sub hidden' }, t('empty.filter'));

  for (const g of games) cards.set(g.appid, buildCard(g, ctx));

  function renderGrid() {
    const q = norm(state.query.trim());
    const visible = games
      .filter((g) => filterFns[state.filter](g, favs) && (!q || norm(g.name).includes(q)))
      .sort(sortFns[state.sort]);
    grid.replaceChildren(...visible.map((g) => cards.get(g.appid).el));
    empty.classList.toggle('hidden', visible.length > 0);
  }

  root.replaceChildren(head, buildContinue(api, games), toolbar, grid, empty);
  renderGrid();
}
