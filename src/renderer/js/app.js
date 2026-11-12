import { h, icon, logoMark } from './dom.js';
import { t, initI18n } from './i18n.js';
import { renderLibrary } from './views/library.js';
import { renderSettings } from './views/settings.js';
import { renderGame } from './views/game.js';
import { renderAchievements } from './views/achievements.js';
import { renderStore, renderStoreApp } from './views/store.js';
import { renderFriends } from './views/friends.js';
import { renderDownloads } from './views/downloads.js';
import { createSplash } from './splash.js';
import { buildSplash } from './splash-view.js';
import { skeletonPage } from './skeleton.js';

const api = window.pantheon;

// Applique disposition, accent et animations réduites (avant le premier affichage, puis à chaque changement des réglages).
export function applyPrefs(prefs) {
  if (!prefs) return;
  const root = document.documentElement;
  root.dataset.layout = prefs.layout;
  root.dataset.motion = prefs.reducedMotion ? 'reduced' : 'full';
  if (prefs.accentColors) {
    root.style.setProperty('--accent', prefs.accentColors.accent);
    root.style.setProperty('--on-accent', prefs.accentColors.on);
  }
}
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
let updateState = { status: 'idle' };

function navLink(item, current) {
  const a = h('a', { class: 'nav-link', href: `#/${item.id}` }, icon(item.icon), h('span', { class: 'label' }, t(`nav.${item.id}`)));
  if (item.id === current) a.setAttribute('aria-current', 'page');
  a.append(h('span', { class: `badge${badges[item.id] ? '' : ' hidden'}`, 'data-badge': item.id }, badges[item.id] ? String(badges[item.id]) : ''));
  return a;
}

// Met à jour une pastille du menu sans reconstruire la barre latérale (garde le focus clavier).
function setBadge(id, n) {
  badges[id] = n;
  const el = sidebar.querySelector(`[data-badge="${id}"]`);
  if (!el) return;
  el.textContent = n ? String(n) : '';
  el.classList.toggle('hidden', !n);
}

// Bandeau « mise à jour prête » : visible seulement quand le téléchargement est terminé.
function paintUpdateBanner() {
  const el = document.getElementById('updbanner');
  if (!el) return;
  const ready = updateState.status === 'ready';
  el.classList.toggle('hidden', !ready);
  if (ready) el.querySelector('span').textContent = t('upd.banner', { v: updateState.next });
}

function renderSidebar(current, info, profile) {
  const online = profile.status === 'online';
  const initial = (profile.name || t('profile.player')).trim().charAt(0).toUpperCase();
  const avatar = h('div', { class: 'avatar' }, profile.avatarUrl ? h('img', { src: profile.avatarUrl, alt: '' }) : initial);
  sidebar.replaceChildren(
    h('div', { class: 'brand' }, logoMark(), h('span', { class: 'brand-name' }, t('app.name'))),
    ...(info.mock ? [h('span', { class: 'demo-badge' }, t('app.demo'))] : []),
    h('nav', { 'aria-label': t('nav.label'), style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, NAV.map((n) => navLink(n, current))),
    h('div', { class: 'spacer' }),
    navLink({ id: 'settings', icon: 'settings' }, current),
    h('div', { class: 'updbanner hidden', id: 'updbanner', role: 'status' }, h('span'), h('button', { class: 'btn small primary', type: 'button', onclick: () => api.installUpdate() }, t('upd.bannerBtn'))),
    h('div', { class: 'profile' },
      h('div', { class: 'profile-row' }, avatar,
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
          h('span', { class: 'profile-name' }, profile.name || t('profile.player')),
          h('span', { class: 'profile-status' }, h('span', { class: `dot${online ? ' on' : ''}` }), t(online ? 'profile.online' : 'profile.offline')))),
      h('button', { class: 'btn small', type: 'button', onclick: () => api.steam.openSteam() }, t('profile.openSteam'))),
  );
  paintUpdateBanner();
}

function soon(titleKey) {
  return [h('header', { class: 'page-head' }, h('h1', { class: 'page-title' }, t(titleKey))), h('div', { class: 'notice' }, h('h2', null, t('soon.title')), h('p', null, t('soon.text')))];
}

let view = null; // vue active (pour arrêter ses minuteurs)
let routeSeq = 0;

async function route(info, profile) {
  view?.dispose?.();
  view = null;
  main.classList.remove('flush');
  const seq = ++routeSeq;
  const [, section = 'library', ...rest] = location.hash.split('/');
  const current = NAV.some((n) => n.id === section) || section === 'settings' ? section : 'library';
  renderSidebar(current, info, profile);
  // Page de chargement : seulement si la page tarde (> 150 ms), jamais un délai artificiel.
  const skelTimer = setTimeout(() => {
    if (seq === routeSeq) main.replaceChildren(...skeletonPage());
  }, 150);
  try {
    let v;
    if (section === 'game') v = await renderGame(main, api, rest[0]);
    else if (current === 'store') v = rest[0] ? await renderStoreApp(main, api, rest[0]) : await renderStore(main, api);
    else if (current === 'friends') v = await renderFriends(main, api, (n) => setBadge('friends', n));
    else if (current === 'downloads') v = await renderDownloads(main, api);
    else if (current === 'achievements') v = await renderAchievements(main, api);
    else if (current === 'library') v = await renderLibrary(main, api);
    else if (current === 'settings') v = await renderSettings(main, api);
    else main.replaceChildren(...soon(`nav.${current}`));
    if (seq !== routeSeq) v?.dispose?.(); // l'utilisateur a déjà changé de page
    else view = v;
  } catch (err) {
    console.error(err);
    main.replaceChildren(h('div', { class: 'notice' }, h('h2', null, t('error.title')), h('p', null, t('error.text'))));
  }
  clearTimeout(skelTimer);
  if (seq === routeSeq) {
    main.classList.remove('page-in');
    void main.offsetWidth; // relance l'animation d'entrée
    main.classList.add('page-in');
  }
  main.scrollTop = 0;
}

async function start() {
  let info = { mock: false, language: 'en' };
  let profile = { name: null, status: 'offline' };
  try {
    info = await api.getInfo();
  } catch (err) {
    console.error(err);
  }
  await initI18n(info.language); // la langue doit être chargée avant le premier affichage
  applyPrefs(info.prefs);

  // Écran de démarrage : seulement si le vrai chargement dépasse 400 ms, fermé dès que tout est prêt (3 s max), une seule fois.
  let splashUi = null;
  const splash = createSplash({
    showDelay: 0, // affiché à chaque lancement, pour que l'animation du logo se voie
    minShow: 1700, // durée de l'animation du logo ; un clic la passe
    show() {
      splashUi = buildSplash('splash.steam');
      document.body.append(splashUi.root);
    },
    hide() {
      splashUi?.hide();
    },
  });
  if (info.prefs?.splash !== false) splash.start();
  const skip = () => splash.skip();
  document.addEventListener('pointerdown', skip, { once: true });
  document.addEventListener('keydown', skip, { once: true });

  try {
    profile = await api.getProfile();
  } catch (err) {
    console.error(err);
  }
  splashUi?.setStage('splash.library');
  window.addEventListener('hashchange', () => route(info, profile));
  await route(info, profile);
  splash.ready();

  // Pastilles : téléchargements (lecture locale, toutes les 8 s) et amis connectés (toutes les 5 min, réponses en cache).
  const refreshDownloads = async () => {
    if (document.hidden) return;
    try {
      setBadge('downloads', (await api.getBadges()).downloads);
    } catch {
      // pastille inchangée
    }
  };
  const refreshFriends = async () => {
    if (document.hidden) return;
    try {
      const f = await api.getFriends();
      if (f.status === 'ok') setBadge('friends', f.friends.filter((x) => x.gameName || x.state !== 0).length);
    } catch {
      // pastille inchangée
    }
  };
  try {
    updateState = await api.getUpdate();
    paintUpdateBanner();
    api.onUpdate((s) => {
      updateState = { ...updateState, ...s };
      paintUpdateBanner();
    });
  } catch {
    // pas de bandeau
  }
  refreshDownloads();
  refreshFriends();
  setInterval(refreshDownloads, 8000);
  setInterval(refreshFriends, 5 * 60 * 1000);
}

start();
