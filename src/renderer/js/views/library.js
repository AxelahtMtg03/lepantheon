import { h, icon } from '../dom.js';
import { t } from '../i18n.js';
import { artLayers } from '../art.js';
import { formatPlaytime, formatRelative, achievementPct, isComplete, compareNames } from '../format.js';

const FILTERS = ['all', 'installed', 'downloading', 'favorites', 'almost'];
const SORTS = ['recent', 'name', 'playtime', 'achievements'];

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cmpDesc = (a, b) => (b ?? -1) - (a ?? -1);

const filterFns = {
  all: () => true,
  installed: (g) => g.installed,
  downloading: (g) => g.state === 'downloading',
  favorites: (g, favs) => favs.has(g.appid),
  unstarted: (g) => !(g.playtimeMin > 0),
  platinum: (g) => isComplete(g),
  almost: (g) => {
    const p = achievementPct(g);
    return p !== null && p >= 75 && p < 100;
  },
};
const sortFns = {
  recent: (a, b) => cmpDesc(a.lastPlayed, b.lastPlayed),
  name: (a, b) => compareNames(a.name, b.name),
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

export function actionOf(api, g) {
  if (g.state === 'downloading') return { icon: 'pause', aria: 'card.downloadAria', run: () => api.steam.openDownloads() };
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
  const veil = h('div', { class: 'veil', 'aria-hidden': 'true' });
  const cover = h('div', { class: 'cover', style: { background: bg } }, h('div', { class: 'art' }, layers), tileTitle, veil, open, tag, bar, fav, play);
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
    play.setAttribute('aria-label', t(act.aria, { name: g.name }));
    play.replaceChildren(icon(act.icon, 18));
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

// Aperçus « Tout voir » d'Odéon : un filtre et un tri de départ par rangée.
const PRESETS = {
  continue: { filter: 'installed', sort: 'recent' },
  almost: { filter: 'almost', sort: 'achievements' },
  unstarted: { filter: 'unstarted', sort: 'name' },
  platinum: { filter: 'platinum', sort: 'name' },
  recent: { filter: 'all', sort: 'recent' },
  all: { filter: 'all', sort: 'name' },
};

export async function renderLibrary(root, api, opts = {}) {
  let data = await api.getLibrary();
  // Rien en local et réseau en cours : on patiente un peu (la page de chargement reste visible), sans bloquer l'appli.
  for (let n = 0; data.loading && data.games.length === 0 && n < 12; n++) {
    await new Promise((r) => setTimeout(r, 500));
    data = await api.getLibrary();
  }
  let games = data.games;
  const favs = new Set(data.favorites);
  const preset = PRESETS[opts.preset];
  const state = { filter: preset ? preset.filter : 'all', sort: preset ? preset.sort : 'recent', query: opts.query || '' };
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

  const sub = h('p', { class: 'page-sub' }, countsText(games));
  const title = h('div', null, h('h1', { class: 'page-title' }, opts.title || t(preset ? 'row.' + opts.preset : 'lib.title')), sub);
  const input = h('input', { type: 'search', id: 'lib-search', value: state.query, placeholder: t('lib.search'), autocomplete: 'off', oninput: (e) => { state.query = e.target.value; renderGrid(); } });
  const search = h('label', { class: 'search', for: 'lib-search' }, icon('search', 18), h('span', { class: 'sr-only' }, t('lib.searchLabel')), input);
  const head = h('header', { class: 'page-head' }, title, search);

  if (games.length === 0) {
    const key = data.status === 'steam-not-found' ? 'empty.noSteam' : 'empty.none';
    root.replaceChildren(head, h('div', { class: 'notice' }, h('h2', null, t(`${key}Title`)), h('p', null, t(`${key}Text`))));
    return { dispose() {} };
  }

  const chipBtns = FILTERS.map((f) =>
    h('button', { class: 'chip', type: 'button', 'aria-pressed': String(f === state.filter), onclick: () => { state.filter = f; chipBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(FILTERS[i] === f))); renderGrid(); } }, t(`filter.${f}`)),
  );
  const select = h('select', { id: 'lib-sort', onchange: (e) => { state.sort = e.target.value; renderGrid(); } }, SORTS.map((s) => h('option', { value: s, selected: s === state.sort }, t(`sort.${s}`))));
  const toolbar = h('div', { class: 'toolbar' }, h('div', { class: 'chips' }, chipBtns), h('label', { class: 'sort', for: 'lib-sort' }, t('lib.sortBy'), select));

  const noticeSlot = h('div');
  const grid = h('section', { class: 'grid', 'aria-label': t('lib.games') });
  const empty = h('p', { class: 'page-sub hidden' }, t('empty.filter'));

  // Apparition en cascade à la première affichage seulement (retirée dès la fin, pour ne pas rejouer au tri/filtre).
  games.forEach((g, i) => {
    const c = buildCard(g, ctx);
    c.el.classList.add('enter');
    c.el.style.setProperty('--i', String(Math.min(i, 14)));
    c.el.addEventListener('animationend', () => c.el.classList.remove('enter'), { once: true });
    cards.set(g.appid, c);
  });

  function renderGrid() {
    const q = norm(state.query.trim());
    const visible = games
      .filter((g) => filterFns[state.filter](g, favs) && (!q || norm(g.name).includes(q)))
      .sort(sortFns[state.sort]);
    const els = visible.map((g) => cards.get(g.appid).el);
    // On ne touche au DOM que si l'ordre ou le contenu change (garde le focus clavier).
    if (els.length !== grid.children.length || els.some((e, i) => e !== grid.children[i])) grid.replaceChildren(...els);
    empty.classList.toggle('hidden', visible.length > 0);
    // Pendant une recherche, le bandeau « Continuer à jouer » ne doit pas rester à l'écran.
    banner?.classList.toggle('hidden', q !== '');
  }

  const bannerKey = () => {
    const last = games.filter((g) => g.installed && g.lastPlayed).sort(sortFns.recent)[0];
    return last ? `${last.appid}|${last.playtimeMin}|${last.lastPlayed}` : '';
  };
  const setNotice = (code) => {
    const key = code === 'rate' || code === 'bad-response' ? 'network' : code;
    noticeSlot.replaceChildren(
      ...(key ? [h('div', { class: 'notice inline' }, h('p', null, t(`notice.${key}`)), h('a', { href: '#/settings' }, t('notice.settings')))] : []),
    );
  };
  setNotice(data.notice);
  let banner = buildContinue(api, games);
  let shownKey = bannerKey();
  root.replaceChildren(...[head, noticeSlot, banner, toolbar, grid, empty].filter(Boolean));
  renderGrid();

  // Mise à jour douce (installations/téléchargements) : seules les cartes modifiées sont retouchées.
  async function refresh() {
    if (document.hidden) return;
    let next;
    try {
      next = await api.getLibrary();
    } catch {
      return;
    }
    games = next.games;
    favs.clear();
    next.favorites.forEach((id) => favs.add(id));
    const seen = new Set(games.map((g) => g.appid));
    for (const g of games) {
      if (cards.has(g.appid)) cards.get(g.appid).update(g);
      else cards.set(g.appid, buildCard(g, ctx));
    }
    for (const id of [...cards.keys()]) if (!seen.has(id)) cards.delete(id);
    sub.textContent = countsText(games);
    setNotice(next.notice);
    const key = bannerKey();
    if (key !== shownKey) {
      const fresh = buildContinue(api, games);
      if (banner && fresh) banner.replaceWith(fresh);
      else if (fresh) toolbar.before(fresh);
      else banner?.remove();
      banner = fresh;
      shownKey = key;
    }
    renderGrid();
  }
  // Réseau encore en cours au démarrage : on redemande vite (1,5 s) jusqu'à l'arrivée des données, puis toutes les 8 s.
  let fast = null;
  if (data.loading) {
    fast = setInterval(async () => {
      let next;
      try {
        next = await api.getLibrary();
      } catch {
        return;
      }
      if (!next.loading) {
        clearInterval(fast);
        fast = null;
        await refresh();
      }
    }, 1500);
  }
  const timer = setInterval(refresh, 8000);
  return { dispose: () => { clearInterval(timer); if (fast) clearInterval(fast); } };
}
