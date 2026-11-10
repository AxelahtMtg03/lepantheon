import { h, icon, logoMark } from './dom.js';
import { t } from './i18n.js';
import { renderLibrary } from './views/library.js';

const api = window.pantheon;
const NAV = [
  { id: 'library', icon: 'library' },
  { id: 'store', icon: 'store' },
  { id: 'friends', icon: 'friends' },
  { id: 'downloads', icon: 'downloads' },
  { id: 'achievements', icon: 'trophy' },
];
const sidebar = document.getElementById('sidebar');
const main = document.getElementById('main');
let badges = {};

function navLink(item, current) {
  const a = h('a', { class: 'nav-link', href: `#/${item.id}` }, icon(item.icon), h('span', { class: 'label' }, t(`nav.${item.id}`)));
  if (item.id === current) a.setAttribute('aria-current', 'page');
  if (badges[item.id]) a.append(h('span', { class: 'badge' }, String(badges[item.id])));
  return a;
}

function renderSidebar(current, info, profile) {
  const online = profile.status === 'online';
  const initial = (profile.name || '?').trim().charAt(0).toUpperCase();
  const avatar = h('div', { class: 'avatar' }, profile.avatarUrl ? h('img', { src: profile.avatarUrl, alt: '' }) : initial);
  sidebar.replaceChildren(
    h('div', { class: 'brand' }, logoMark(), h('span', { class: 'brand-name' }, t('app.name'))),
    ...(info.mock ? [h('span', { class: 'demo-badge' }, t('app.demo'))] : []),
    h('nav', { 'aria-label': t('nav.label'), style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, NAV.map((n) => navLink(n, current))),
    h('div', { class: 'spacer' }),
    navLink({ id: 'settings', icon: 'settings' }, current),
    h('div', { class: 'profile' },
      h('div', { class: 'profile-row' }, avatar,
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
          h('span', { class: 'profile-name' }, profile.name),
          h('span', { class: 'profile-status' }, h('span', { class: `dot${online ? ' on' : ''}` }), t(online ? 'profile.online' : 'profile.offline')))),
      h('button', { class: 'btn small', type: 'button', onclick: () => api.steam.openSteam() }, t('profile.openSteam'))),
  );
}

function soon(titleKey) {
  return [h('header', { class: 'page-head' }, h('h1', { class: 'page-title' }, t(titleKey))), h('div', { class: 'notice' }, h('h2', null, t('soon.title')), h('p', null, t('soon.text')))];
}

let view = null; // vue active (pour arrêter ses minuteurs)

async function route(info, profile) {
  view?.dispose?.();
  view = null;
  const [, section = 'library'] = location.hash.split('/');
  const current = NAV.some((n) => n.id === section) || section === 'settings' ? section : 'library';
  renderSidebar(current, info, profile);
  try {
    if (section === 'game') main.replaceChildren(...soon('nav.library')); // fiche : étape 5
    else if (current === 'library') view = await renderLibrary(main, api);
    else main.replaceChildren(...soon(`nav.${current}`));
  } catch (err) {
    console.error(err);
    main.replaceChildren(h('div', { class: 'notice' }, h('h2', null, t('error.title')), h('p', null, t('error.text'))));
  }
  main.scrollTop = 0;
}

async function start() {
  let info = { mock: false };
  let profile = { name: '?', status: 'offline' };
  try {
    [info, profile] = await Promise.all([api.getInfo(), api.getProfile()]);
  } catch (err) {
    console.error(err);
  }
  window.addEventListener('hashchange', () => route(info, profile));
  route(info, profile);
}

start();
