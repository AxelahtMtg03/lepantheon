import { h } from '../dom.js';
import { t } from '../i18n.js';
import { artLayers } from '../art.js';
import { formatSize } from '../format.js';

function row(g) {
  const { bg, layers } = artLayers(g, 'cover');
  const pct = Math.min(100, Math.max(0, Math.round(g.downloadPct || 0)));
  const sizes = g.bytesToDownload > 0 ? t('dl.sizes', { done: formatSize(g.bytesDownloaded), total: formatSize(g.bytesToDownload) }) : '';
  return h('article', { class: 'dl-row' },
    h('a', { class: 'dl-cover', href: `#/game/${g.appid}`, 'aria-label': t('card.openAria', { name: g.name }), style: { background: bg } }, layers),
    h('div', { class: 'dl-info' },
      h('a', { class: 'row-link', href: `#/game/${g.appid}`, style: { flexBasis: 'auto' } }, g.name),
      h('span', { class: 'page-sub' }, g.installed ? t('dl.update') : t('dl.install'), sizes ? ` · ${sizes}` : ''),
      h('div', { class: 'dl-bar-row' }, h('span', { class: 'progress grow', role: 'img', 'aria-label': `${pct} %` }, h('span', { style: { width: `${pct}%` } })), h('span', { class: 'dl-pct' }, `${pct} %`))),
  );
}

export async function renderDownloads(root, api) {
  const sub = h('p', { class: 'page-sub' });
  const list = h('div', { class: 'dl-list' });
  root.replaceChildren(h('header', { class: 'page-head' }, h('div', null, h('h1', { class: 'page-title' }, t('nav.downloads')), sub), h('button', { class: 'btn', type: 'button', onclick: () => api.steam.openSteam() }, t('profile.openSteam'))), list);

  async function load() {
    let data;
    try {
      data = await api.getLibrary();
    } catch {
      return;
    }
    const items = data.games.filter((g) => g.state === 'downloading');
    sub.textContent = items.length ? t('dl.count', { n: items.length }) : '';
    list.replaceChildren(...(items.length ? items.map(row) : [h('div', { class: 'notice' }, h('h2', null, t('dl.noneTitle')), h('p', null, t('dl.noneText')))]));
  }
  await load();
  const timer = setInterval(() => !document.hidden && load(), 5000);
  return { dispose: () => clearInterval(timer) };
}
