import { h, icon } from '../dom.js';
import { t } from '../i18n.js';
import { formatRelative } from '../format.js';

const ONLINE = ['ingame', 'online', 'busy', 'away'];

// Même logique que src/shared/friends.js (le renderer n'importe pas de module CommonJS).
function statusKey(f) {
  if (f.gameName) return 'ingame';
  if (f.state === 1 || f.state === 5 || f.state === 6) return 'online';
  if (f.state === 2) return 'busy';
  if (f.state === 3 || f.state === 4) return 'away';
  return 'offline';
}

function statusText(f, key) {
  if (key === 'ingame') return t('friends.playing', { game: f.gameName });
  if (key === 'offline') return f.lastLogoff ? t('friends.seen', { when: formatRelative(f.lastLogoff) }) : t('friends.offline');
  return t(`friends.${key}`);
}

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function friendCard(api, f) {
  const key = statusKey(f);
  const avatar = h('div', { class: 'avatar big' }, f.avatarUrl ? h('img', { src: f.avatarUrl, alt: '', referrerpolicy: 'no-referrer' }) : (f.name || '?').charAt(0).toUpperCase());
  const dot = h('span', { class: `dot${key === 'offline' ? '' : ' on'}` });
  return h('article', { class: 'friend' },
    avatar,
    h('div', { class: 'friend-info' }, h('span', { class: 'friend-name' }, f.name), h('span', { class: `friend-status${key === 'ingame' ? ' ingame' : ''}` }, dot, statusText(f, key))),
    h('button', { class: 'btn small', type: 'button', 'aria-label': t('friends.chatAria', { name: f.name }), onclick: () => api.steam.chat(f.steamId) }, t('friends.chat')),
  );
}

export async function renderFriends(root, api, onCount) {
  const sub = h('p', { class: 'page-sub' });
  const list = h('div', { class: 'friends' });
  const input = h('input', { type: 'search', id: 'friend-search', placeholder: t('friends.search'), autocomplete: 'off', oninput: draw });
  const search = h('label', { class: 'search', for: 'friend-search' }, icon('search', 18), h('span', { class: 'sr-only' }, t('friends.searchLabel')), input);
  root.replaceChildren(h('header', { class: 'page-head' }, h('div', null, h('h1', { class: 'page-title' }, t('nav.friends')), sub), search), list);
  let friends = [];

  function draw() {
    const q = norm(input.value.trim());
    const shown = friends.filter((f) => !q || norm(f.name).includes(q));
    const on = shown.filter((f) => ONLINE.includes(statusKey(f)));
    const off = shown.filter((f) => statusKey(f) === 'offline');
    const group = (key, items) => (items.length ? h('section', { class: 'block' }, h('h2', null, `${t(key)} · ${items.length}`), h('div', { class: 'friend-grid' }, items.map((f) => friendCard(api, f)))) : null);
    list.replaceChildren(...[group('friends.groupOnline', on), group('friends.groupOffline', off)].filter(Boolean));
    if (shown.length === 0 && friends.length > 0) list.replaceChildren(h('p', { class: 'page-sub' }, t('friends.noMatch')));
  }

  async function load() {
    let data;
    try {
      data = await api.getFriends();
    } catch {
      data = { status: 'error', friends: [] };
    }
    if (data.status !== 'ok') {
      sub.textContent = '';
      const key = ['private', 'no-key', 'no-steamid', 'network', 'invalid-key'].includes(data.status) ? data.status : 'error';
      const link = key === 'private' ? null : h('a', { href: '#/settings' }, t('notice.settings'));
      list.replaceChildren(h('div', { class: 'notice inline' }, h('p', null, t(`friends.status.${key}`)), link));
      return;
    }
    friends = data.friends;
    const online = friends.filter((f) => statusKey(f) !== 'offline').length;
    onCount?.(online);
    sub.textContent = friends.length ? t('friends.count', { n: friends.length, online }) : t('friends.none');
    draw();
  }

  await load();
  const timer = setInterval(() => !document.hidden && load(), 60000); // mise à jour douce (les réponses sont mises en cache)
  return { dispose: () => clearInterval(timer) };
}
