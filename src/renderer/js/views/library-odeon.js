import { h, icon } from '../dom.js';
import { t } from '../i18n.js';
import { artLayers } from '../art.js';
import { ring } from '../components.js';
import { formatPlaytime } from '../format.js';
import { buildRows, perRow, heroKind, defaultHero, createDebounce } from '../odeon-logic.js';
import { actionOf } from './library.js';

const pctOf = (g) => (g.achievements && g.achievements.total > 0 ? Math.round((g.achievements.unlocked / g.achievements.total) * 100) : null);

// Disposition Odéon : un grand écran pour le jeu sélectionné, puis des rangées qui défilent vers le bas.
export async function renderLibraryOdeon(root, api) {
  let data = await api.getLibrary();
  for (let n = 0; data.loading && data.games.length === 0 && n < 12; n++) {
    await new Promise((r) => setTimeout(r, 500));
    data = await api.getLibrary();
  }
  let games = data.games;
  root.classList.add('flush');

  if (games.length === 0) {
    const key = data.status === 'steam-not-found' ? 'empty.noSteam' : 'empty.none';
    root.replaceChildren(h('div', { class: 'od-page' }, h('h1', { class: 'page-title od-title' }, t('lib.title')), h('div', { class: 'notice' }, h('h2', null, t(`${key}Title`)), h('p', null, t(`${key}Text`)))));
    return { dispose: () => root.classList.remove('flush') };
  }

  let selected = defaultHero(games);
  const hero = h('section', { class: 'od-hero', 'aria-label': t('lib.title') });
  const rowsEl = h('div', { class: 'od-rows' });
  const noticeSlot = h('div', { class: 'od-notice' });

  // Une « couche » = un grand écran complet. Changer de jeu pose la nouvelle couche par-dessus l'ancienne
  // et la fait apparaître en fondu (~0,7 s) une fois son image chargée : pas de flash ni de saut.
  function buildLayer(g) {
    const { bg, layers } = artLayers(g, 'hero');
    const kind = heroKind(g);
    const act = actionOf(api, g);
    const installed = g.installed;
    const total = g.achievements ? g.achievements.total : 0;
    const left = total - (g.achievements ? g.achievements.unlocked : 0);
    const tagline = total > 0 && left > 0 ? t('hero.missing', { n: left }) : g.playtimeMin > 0 ? formatPlaytime(g.playtimeMin) : t('meta.never');
    return h('div', { class: 'od-layer', style: { background: bg } },
      h('div', { class: 'art' }, layers),
      h('div', { class: 'od-circle', 'aria-hidden': 'true' }),
      h('div', { class: 'od-shade' }),
      h('div', { class: 'od-hero-body' },
        h('span', { class: 'eyebrow' }, t(`hero.${kind}`)),
        h('h1', { class: 'od-hero-title' }, g.name),
        h('p', { class: 'od-hero-sub' }, tagline),
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary big', type: 'button', onclick: act.run }, icon(installed ? 'play' : 'downloads', 18), installed ? t('lib.play') : t('hero.installBtn')),
          h('a', { class: 'btn big on-art', href: `#/game/${g.appid}` }, t('lib.viewGame')),
        ),
      ),
      total > 0
        ? h('div', { class: 'od-hero-card' }, ring(g.achievements.unlocked, total),
            h('div', null, h('span', { class: 'big-num' }, `${g.achievements.unlocked} / ${total}`), h('span', { class: 'page-sub' }, g.playtimeMin > 0 ? formatPlaytime(g.playtimeMin) : t('meta.never'))))
        : null,
    );
  }

  const paintHero = (g) => hero.replaceChildren(buildLayer(g));

  let swapSeq = 0;
  function setHero(g, instant = false) {
    if (!g || (selected && g.appid === selected.appid && !instant)) return;
    selected = g;
    if (instant) {
      paintHero(g);
      return;
    }
    const mine = ++swapSeq;
    const layer = buildLayer(g);
    layer.classList.add('pre');
    const old = [...hero.children];
    hero.append(layer);
    let shown = false;
    const show = () => {
      if (shown || mine !== swapSeq) return;
      shown = true;
      layer.classList.remove('pre');
      layer.classList.add('in');
      setTimeout(() => {
        if (!layer.isConnected) return;
        old.forEach((o) => o.remove());
        layer.classList.remove('in');
      }, 760);
    };
    const img = layer.querySelector('img.art-img');
    if (img && !img.complete) {
      img.addEventListener('load', show, { once: true });
      img.addEventListener('error', show, { once: true });
      setTimeout(show, 600); // image lente : on change quand même
    } else show();
  }

  function buildTile(g) {
    const { bg, layers } = artLayers(g, 'cover');
    const act = actionOf(api, g);
    const pct = pctOf(g);
    const dwell = createDebounce(() => setHero(g), 140);
    const open = h('button', { class: 'cover-open', type: 'button', 'aria-label': t('card.openAria', { name: g.name }), onclick: () => { dwell.cancel(); setHero(g); hero.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
    const play = h('button', { class: 'playbtn od-play', type: 'button', 'aria-label': t(act.aria, { name: g.name }), onclick: act.run }, icon(act.icon, 16));
    const bar = pct !== null
      ? h('div', { class: 'od-prog' }, h('span', { class: 'progress', 'aria-hidden': 'true' }, h('span', { style: { width: `${pct}%` } })), h('span', null, t('meta.achievements', { u: g.achievements.unlocked, t: g.achievements.total })))
      : h('div', { class: 'od-prog' }, h('span', null, g.playtimeMin > 0 ? formatPlaytime(g.playtimeMin) : t('meta.never')));
    const cover = h('div', { class: 'cover', style: { background: bg } }, h('div', { class: 'art' }, layers), h('span', { class: 'tile-title' }, g.name), h('div', { class: 'veil', 'aria-hidden': 'true' }), open, play, bar);
    const el = h('article', { class: 'odc', style: { '--glow': g.installed ? 'var(--accent)' : '#6b7bbf' } }, cover);
    el.addEventListener('pointerenter', dwell);
    el.addEventListener('pointerleave', dwell.cancel);
    el.addEventListener('focusin', dwell);
    el.addEventListener('focusout', dwell.cancel);
    return el;
  }

  function paintRows() {
    const limit = perRow(window.innerWidth);
    rowsEl.replaceChildren(...buildRows(games, limit).map((row, ri) => {
      const strip = h('div', { class: 'od-strip', role: 'list' }, row.shown.map((g, i) => {
        const el = buildTile(g);
        el.setAttribute('role', 'listitem');
        el.classList.add('enter');
        el.style.setProperty('--i', String(Math.min(i, 9)));
        el.addEventListener('animationend', () => el.classList.remove('enter'), { once: true });
        return el;
      }));
      return h('section', { class: 'od-row', 'aria-label': t(`row.${row.id}`) },
        h('header', { class: 'od-row-head' }, h('h2', null, t(`row.${row.id}`)), h('a', { class: 'od-all', href: `#/all/${row.id}` }, t('row.seeAll', { n: row.total }))),
        strip);
    }));
  }

  const setNotice = (code) => {
    const key = code === 'rate' || code === 'bad-response' ? 'network' : code;
    noticeSlot.replaceChildren(...(key ? [h('div', { class: 'notice inline' }, h('p', null, t(`notice.${key}`)), h('a', { href: '#/settings' }, t('notice.settings')))] : []));
  };
  setNotice(data.notice);
  paintHero(selected);
  paintRows();
  root.replaceChildren(hero, noticeSlot, rowsEl);

  const signature = (list) => list.map((g) => `${g.appid}:${g.installed ? 1 : 0}:${g.state || ''}:${Math.round((g.downloadPct || 0) / 10)}:${g.playtimeMin}:${g.lastPlayed || 0}`).join('|');
  let sig = signature(games);
  async function refresh() {
    if (document.hidden) return;
    let next;
    try {
      next = await api.getLibrary();
    } catch {
      return;
    }
    setNotice(next.notice);
    const nextSig = signature(next.games);
    if (nextSig === sig) return;
    sig = nextSig;
    games = next.games;
    if (!games.some((g) => selected && g.appid === selected.appid)) selected = defaultHero(games);
    else selected = games.find((g) => g.appid === selected.appid);
    paintHero(selected);
    paintRows();
  }
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
  let lastCount = perRow(window.innerWidth);
  const onResize = createDebounce(() => {
    const n = perRow(window.innerWidth);
    if (n !== lastCount) {
      lastCount = n;
      paintRows();
    }
  }, 200);
  window.addEventListener('resize', onResize);
  return {
    dispose() {
      clearInterval(timer);
      if (fast) clearInterval(fast);
      window.removeEventListener('resize', onResize);
      root.classList.remove('flush');
    },
  };
}
