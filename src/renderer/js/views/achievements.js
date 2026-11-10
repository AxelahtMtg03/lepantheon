import { h, icon } from '../dom.js';
import { t } from '../i18n.js';
import { rarityLabel } from '../components.js';
import { formatPct } from '../format.js';

const link = (appid, text) => h('a', { class: 'row-link', href: `#/game/${appid}` }, text);

function section(titleKey, subKey, ...children) {
  return h('section', { class: 'block' }, h('h2', null, t(titleKey)), subKey ? h('p', { class: 'hint' }, t(subKey)) : null, ...children);
}

function render(data) {
  let status = data.status;
  if (status === 'ok' && data.rows.length === 0 && data.blocked) status = data.blocked === 'rate' ? 'network' : data.blocked;
  if (status !== 'ok') {
    const key = ['private', 'no-key', 'no-steamid', 'network', 'invalid-key'].includes(status) ? status : 'error';
    return [h('div', { class: 'notice inline' }, h('p', null, t(`ach.status.${key}`)), h('a', { href: '#/settings' }, t('notice.settings')))];
  }
  const rows = data.rows;
  const total = rows.reduce((n, r) => n + r.unlocked, 0);
  const gods = rows.filter((r) => r.total > 0 && r.unlocked === r.total).sort((a, b) => b.total - a.total);
  const close = rows.filter((r) => r.unlocked < r.total).sort((a, b) => b.unlocked / b.total - a.unlocked / a.total).slice(0, 6);

  const tile = (label, value) => h('div', { class: 'tile' }, h('span', { class: 'eyebrow muted' }, label), h('span', { class: 'big-num' }, String(value)));
  const out = [h('div', { class: 'tiles' }, tile(t('ach.page.total'), total), tile(t('ach.page.games'), rows.length), tile(t('ach.page.gods'), gods.length))];

  if (data.scanning || data.pending > 0) out.push(h('p', { class: 'page-sub', role: 'status' }, t('ach.page.scanning', { done: data.known, total: data.played })));

  out.push(section('ach.page.godsTitle', 'ach.page.godsHint',
    gods.length
      ? h('div', { class: 'gods' }, gods.map((g) => h('a', { class: 'god', href: `#/game/${g.appid}` }, icon('trophy', 18), h('span', { class: 'god-name' }, g.name), h('span', { class: 'page-sub' }, `${g.total} / ${g.total}`))))
      : h('p', { class: 'page-sub' }, t('ach.page.godsNone'))));

  out.push(section('ach.page.closeTitle', null,
    close.length
      ? h('ul', { class: 'plain' }, close.map((g) => h('li', { class: 'close-row' },
        link(g.appid, g.name),
        h('span', { class: 'progress grow', role: 'img', 'aria-label': `${Math.round((g.unlocked / g.total) * 100)} %` }, h('span', { style: { width: `${(g.unlocked / g.total) * 100}%` } })),
        h('span', { class: 'page-sub' }, t('ach.page.left', { n: g.total - g.unlocked, done: g.unlocked, total: g.total })))))
      : h('p', { class: 'page-sub' }, t('ach.page.closeNone'))));

  out.push(section('ach.page.rarestTitle', null,
    data.rarest.length
      ? h('ul', { class: 'plain' }, data.rarest.map((a) => h('li', { class: 'rare-row' },
        h('div', null, h('span', { class: 'mini-name' }, a.name), h('span', { class: 'page-sub' }, ` — ${a.game}`)),
        h('span', { class: `r-${a.rarity || 'common'} ach-rarity` }, `${rarityLabel(a)} · ${formatPct(a.percent)}`))))
      : h('p', { class: 'page-sub' }, data.scanning || data.pending > 0 ? t('ach.page.rarestWait') : t('ach.page.rarestNone'))));
  return out;
}

export async function renderAchievements(root, api) {
  const head = h('header', { class: 'page-head' }, h('div', null, h('h1', { class: 'page-title' }, t('nav.achievements')), h('p', { class: 'page-sub' }, t('ach.page.sub'))));
  const body = h('div', { class: 'ach-page' });
  root.replaceChildren(head, body);
  let timer = null;
  async function load() {
    let data;
    try {
      data = await api.getAchievementsOverview();
    } catch {
      data = { status: 'error', rows: [], rarest: [] };
    }
    body.replaceChildren(...render(data));
    // Tant que l'analyse tourne, on rafraîchit doucement (les données arrivent au fil de l'eau).
    clearTimeout(timer);
    if (data.scanning || data.pending > 0) timer = setTimeout(load, 5000);
  }
  await load();
  return { dispose: () => clearTimeout(timer) };
}
