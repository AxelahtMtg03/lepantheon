import { h, icon } from '../dom.js';
import { t } from '../i18n.js';
import { artLayers } from '../art.js';
import { ring, achievementCard, rarityLabel } from '../components.js';
import { formatHoursShort, formatRelative, formatSize, formatPct, isComplete, compareNames } from '../format.js';

const TABS = ['overview', 'achievements', 'screenshots', 'news'];
const FILTERS = ['all', 'unlocked', 'locked', 'rare'];
const SORTS = ['rarity', 'date', 'name'];
const byPercent = (a, b) => (a.percent ?? 101) - (b.percent ?? 101);

const sorters = {
  rarity: byPercent,
  date: (a, b) => (b.unlockTime ?? -1) - (a.unlockTime ?? -1) || byPercent(a, b),
  name: (a, b) => compareNames(a.name, b.name),
};
const filters = {
  all: () => true,
  unlocked: (a) => a.unlocked,
  locked: (a) => !a.unlocked,
  rare: (a) => a.rarity === 'rare' || a.rarity === 'ultra',
};

function notFound() {
  return [h('a', { class: 'back-link dark', href: '#/library' }, `← ${t('game.back')}`), h('div', { class: 'notice' }, h('h2', null, t('game.notFound')), h('p', null, t('game.notFoundText')))];
}

function achievementsPanel(ach) {
  if (ach.status !== 'ok') {
    const key = ['private', 'none', 'no-key', 'no-steamid', 'network'].includes(ach.status) ? ach.status : 'error';
    const extra = key === 'no-key' || key === 'no-steamid' ? h('a', { href: '#/settings' }, t('notice.settings')) : null;
    return h('div', { class: 'notice inline' }, h('p', null, t(`ach.status.${key}`)), extra);
  }
  const list = ach.list;
  const state = { filter: 'all', sort: 'rarity' };
  const grid = h('div', { class: 'ach-grid' });
  const chips = FILTERS.map((f) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(f === 'all'), onclick: () => { state.filter = f; chips.forEach((b, i) => b.setAttribute('aria-pressed', String(FILTERS[i] === f))); draw(); } }, t(`ach.filter.${f}`)));
  const select = h('select', { id: 'ach-sort', onchange: (e) => { state.sort = e.target.value; draw(); } }, SORTS.map((s) => h('option', { value: s }, t(`ach.sort.${s}`))));
  const empty = h('p', { class: 'page-sub hidden' }, t('ach.none'));
  function draw() {
    const items = list.filter(filters[state.filter]).sort(sorters[state.sort]);
    grid.replaceChildren(...items.map(achievementCard));
    empty.classList.toggle('hidden', items.length > 0);
  }
  draw();

  const locked = list.filter((a) => !a.unlocked && a.percent !== null).sort((a, b) => b.percent - a.percent)[0];
  const rarest = list.filter((a) => a.unlocked && a.percent !== null).sort(byPercent)[0];
  const side = h('div', { class: 'ach-summary' },
    h('div', { class: 'ring-row' }, ring(ach.unlocked, ach.total), h('div', null, h('span', { class: 'big-num' }, `${ach.unlocked} / ${ach.total}`), h('span', { class: 'page-sub' }, t('ach.unlockedCount')))),
    h('hr'),
    h('div', { class: 'mini' }, h('span', { class: 'eyebrow muted' }, t('ach.easiest')), h('span', { class: 'mini-name' }, locked ? locked.name : '—'), h('span', { class: 'page-sub' }, locked ? t('ach.players', { pct: formatPct(locked.percent) }) : t('ach.allDone'))),
    h('div', { class: 'mini' }, h('span', { class: 'eyebrow muted' }, t('ach.rarestObtained')), h('span', { class: 'mini-name' }, rarest ? rarest.name : '—'),
      rarest ? h('span', { class: `r-${rarest.rarity || 'common'}`, style: { fontSize: '13px' } }, `${rarityLabel(rarest)} · ${t('ach.players', { pct: formatPct(rarest.percent) })}`) : null),
  );
  const main = h('div', { class: 'ach-main' },
    h('div', { class: 'toolbar' }, h('div', { class: 'chips' }, chips), h('label', { class: 'sort', for: 'ach-sort' }, t('lib.sortBy'), select)),
    grid, empty);
  return h('div', { class: 'ach-layout' }, side, main);
}

function overviewPanel(game, store) {
  const rows = [];
  if (store && store.developers.length) rows.push([t('game.developer'), store.developers.join(', ')]);
  if (store && store.releaseDate) rows.push([t('game.release'), store.releaseDate]);
  return h('div', { class: 'panel-text' },
    h('p', { class: 'lead' }, store && store.description ? store.description : t('game.noDescription')),
    rows.length ? h('dl', { class: 'facts' }, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])) : null);
}

function screenshotsPanel(store) {
  if (!store || store.screenshots.length === 0) return h('p', { class: 'page-sub' }, t('game.noScreens'));
  return h('div', { class: 'shots' }, store.screenshots.map((s) => h('img', { src: s.thumb, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })));
}

export async function renderGame(root, api, appid) {
  const data = await api.getGame(appid);
  if (!data) {
    root.replaceChildren(...notFound());
    return;
  }
  const { game, store, achievements: ach } = data;
  const { bg, layers } = artLayers(game, 'hero');
  const downloading = game.state === 'downloading';

  const genres = (store && store.genres.length ? store.genres : []).slice(0, 4);
  const play = downloading
    ? h('span', { class: 'btn', role: 'status' }, t('card.downloading', { pct: Math.round(game.downloadPct || 0) }))
    : game.installed
      ? h('button', { class: 'btn primary big', type: 'button', onclick: () => api.steam.play(game.appid) }, icon('play', 18), t('lib.play'))
      : h('button', { class: 'btn primary big', type: 'button', onclick: () => api.steam.install(game.appid) }, icon('downloads', 18), t('game.install'));
  const hero = h('section', { class: 'game-hero', style: { background: bg } },
    h('div', { class: 'art' }, layers),
    h('div', { class: 'hero-fade' }),
    h('a', { class: 'back-link', href: '#/library' }, `← ${t('game.back')}`),
    h('div', { class: 'hero-body' },
      h('div', { class: 'tags' }, genres.map((g) => h('span', { class: 'pill' }, g)), isComplete(game) ? h('span', { class: 'pill gold', 'aria-label': t('game.complete') }, icon('trophy', 14), '100 %') : null),
      h('h1', null, game.name),
      h('div', { class: 'actions' }, play,
        h('button', { class: 'btn on-art', type: 'button', onclick: () => api.steam.store(game.appid) }, t('game.store')),
        game.installed ? h('button', { class: 'btn on-art', type: 'button', onclick: () => api.steam.uninstall(game.appid) }, t('game.uninstall')) : null)),
  );

  const stats = [
    [t('game.playtime'), game.playtimeMin > 0 ? formatHoursShort(game.playtimeMin) : '—'],
    [t('game.lastSession'), game.lastPlayed ? formatRelative(game.lastPlayed) : '—'],
    [t('game.achievements'), ach.status === 'ok' ? `${ach.unlocked} / ${ach.total}` : '—'],
    [t('game.size'), formatSize(game.sizeBytes)],
  ];
  const strip = h('section', { class: 'stats', 'aria-label': t('game.stats') }, stats.map(([k, v]) => h('div', { class: 'stat' }, h('span', { class: 'eyebrow muted' }, k), h('span', { class: 'stat-val' }, v))));

  const panels = {
    overview: overviewPanel(game, store),
    achievements: achievementsPanel(ach),
    screenshots: screenshotsPanel(store),
    news: h('p', { class: 'page-sub' }, t('game.newsSoon')),
  };
  const body = h('div', { class: 'tab-body' });
  const tabBtns = TABS.map((id) => h('button', { class: 'tab', type: 'button', role: 'tab', id: `tab-${id}`, onclick: () => select(id) }, t(`game.tab.${id}`)));
  const tablist = h('div', { class: 'tabs', role: 'tablist', 'aria-label': t('game.sections') }, tabBtns);
  tablist.addEventListener('keydown', (e) => {
    const i = tabBtns.indexOf(document.activeElement);
    if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const next = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    select(TABS[next]);
    tabBtns[next].focus();
  });
  function select(id) {
    tabBtns.forEach((b, i) => {
      const on = TABS[i] === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    body.setAttribute('role', 'tabpanel');
    body.setAttribute('aria-labelledby', `tab-${id}`);
    body.replaceChildren(panels[id]);
  }
  select(ach.status === 'ok' ? 'achievements' : 'overview');

  root.classList.add('flush');
  root.replaceChildren(hero, strip, tablist, body);
  return { dispose: () => root.classList.remove('flush') };
}
