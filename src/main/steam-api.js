'use strict';
// Client de l'API Web Steam, exécuté uniquement dans le processus principal.
// - clé personnelle de l'utilisateur, jamais journalisée ni mise en cache ni renvoyée à l'interface ;
// - liste blanche de domaines, https uniquement, aucune redirection suivie ;
// - appels espacés + plafond quotidien (< 100 000/jour) ; cache disque avec repli hors ligne.
const { isAllowedHost, isSteamId64, isAppId, isSteamImageUrl } = require('../shared/validation');

const API_HOST = 'api.steampowered.com';
const STORE_HOST = 'store.steampowered.com';
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

class SteamApiError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SteamApiError';
    this.code = code; // no-key | invalid-key | private | network | rate | bad-response
  }
}

const isInt = (v) => Number.isSafeInteger(v) && v >= 0;
const cleanStr = (s, max) => String(s).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
const imageOrNull = (u) => (isSteamImageUrl(u) ? u : null);
// Le texte est ensuite affiché avec textContent : on retire juste les balises pour la lisibilité.
const stripHtml = (s, max) => cleanStr(String(s).replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' '), max);

const FEATURED_IDS = ['specials', 'top_sellers', 'new_releases', 'coming_soon'];

// Prix en centimes + devise ISO ; valeurs invalides -> null.
function priceOf(currency, initial, final, discountPct) {
  const cents = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);
  return {
    currency: typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : null,
    initial: cents(initial),
    final: cents(final),
    discountPct: isInt(discountPct) && discountPct <= 100 ? discountPct : 0,
  };
}

// Entrée de la boutique (mises en avant ou recherche) ; l'image est reconstruite depuis l'appid.
function storeItem(i) {
  if (!i || !isAppId(i.id)) return null;
  const nested = i.price && typeof i.price === 'object' ? i.price : null;
  let price = null; // null = prix inconnu ou jeu gratuit / non sorti
  if (nested) price = priceOf(nested.currency, nested.initial, nested.final, nested.initial > nested.final ? Math.round((1 - nested.final / nested.initial) * 100) : 0);
  else if (i.final_price != null) price = priceOf(i.currency, i.original_price, i.final_price, i.discount_percent);
  return {
    appid: Number(i.id),
    name: typeof i.name === 'string' && i.name.trim() ? cleanStr(i.name, 200) : `App ${i.id}`,
    price,
  };
}

const PERSONA_STATES = [0, 1, 2, 3, 4, 5, 6];
function friendOf(p) {
  return {
    steamId: p.steamid,
    name: typeof p.personaname === 'string' && p.personaname.trim() ? cleanStr(p.personaname, 64) : p.steamid,
    avatarUrl: imageOrNull(p.avatarmedium),
    state: PERSONA_STATES.includes(p.personastate) ? p.personastate : 0, // 0 hors ligne, 1 en ligne, 2 occupé, 3 absent, 4 sieste...
    gameName: typeof p.gameextrainfo === 'string' && p.gameextrainfo.trim() ? cleanStr(p.gameextrainfo, 120) : null,
    lastLogoff: isInt(p.lastlogoff) && p.lastlogoff > 0 ? p.lastlogoff : null,
  };
}

function createSteamApi({
  getKey,
  cache,
  quotaCache = cache,
  getLang = () => 'english', // langue des textes renvoyés par Steam
  getCountry = () => 'us', // pays de la boutique (devise et prix)
  fetchFn = fetch,
  now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  minIntervalMs = 250,
  dailyLimit = 90000,
  timeoutMs = 10000,
}) {
  let chain = Promise.resolve();
  let lastCall = 0;

  function bumpQuota() {
    const day = new Date(now()).toISOString().slice(0, 10);
    const q = quotaCache.read('quota');
    const count = q && q.data && q.data.day === day && isInt(q.data.count) ? q.data.count : 0;
    if (count >= dailyLimit) throw new SteamApiError('rate');
    quotaCache.write('quota', { day, count: count + 1 });
  }

  // Appels en file : un seul à la fois, espacés d'au moins minIntervalMs.
  // opts : { host, noKey, passStatuses: [codes dont on veut quand même le corps] }
  // Avec passStatuses, retourne { status, json } ; sinon retourne le JSON.
  function request(pathname, params = {}, opts = {}) {
    const run = chain.then(async () => {
      const host = opts.host || API_HOST;
      let key = null;
      if (!opts.noKey) {
        key = getKey();
        if (!key) throw new SteamApiError('no-key');
      }
      const wait = lastCall + minIntervalMs - now();
      if (wait > 0) await sleep(wait);
      lastCall = now();
      bumpQuota();
      const url = new URL(`https://${host}${pathname}`);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
      if (key) url.searchParams.set('key', key);
      if (url.protocol !== 'https:' || !isAllowedHost(url.hostname)) throw new SteamApiError('bad-response');
      let res;
      try {
        res = await fetchFn(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
      } catch {
        throw new SteamApiError('network'); // le message d'origine pourrait contenir l'URL (donc la clé)
      }
      const passed = opts.passStatuses && opts.passStatuses.includes(res.status);
      if (!passed) {
        if (res.status === 401 || res.status === 403) throw new SteamApiError('invalid-key');
        if (res.status === 429) throw new SteamApiError('rate');
        if (res.status >= 500) throw new SteamApiError('network');
        if (!res.ok) throw new SteamApiError('bad-response');
      }
      let json;
      try {
        json = await res.json();
      } catch {
        if (!passed) throw new SteamApiError('bad-response');
        json = null;
      }
      return opts.passStatuses ? { status: res.status, json } : json;
    });
    chain = run.catch(() => {});
    return run;
  }

  // Cache frais, sinon appel ; en cas de réseau coupé ou de quota, on retombe sur la dernière copie.
  // keep(data) = false : résultat renvoyé mais pas mémorisé (ex. « profil privé » : l'utilisateur peut le changer à tout moment).
  async function cached(cacheKey, ttlMs, fetcher, keep = () => true) {
    const fresh = cache.get(cacheKey, ttlMs);
    if (fresh !== undefined) return fresh;
    try {
      const data = await fetcher();
      if (keep(data)) cache.write(cacheKey, data);
      return data;
    } catch (err) {
      const stale = cache.read(cacheKey);
      if (stale && (err.code === 'network' || err.code === 'rate')) return stale.data;
      throw err;
    }
  }

  const peek = (cacheKey) => {
    const e = cache.read(cacheKey);
    return e ? e.data : null;
  };
  const needSteamId = (id) => {
    if (!isSteamId64(id)) throw new SteamApiError('bad-response');
  };
  const needAppId = (id) => {
    if (!isAppId(id)) throw new SteamApiError('bad-response');
  };

  return {
    request,
    // Jeux possédés. hidden = true si les « détails de jeu » du profil sont privés.
    async getOwnedGames(steamId) {
      needSteamId(steamId);
      return cached(`owned:${steamId}`, 10 * MIN, async () => {
        const json = await request('/IPlayerService/GetOwnedGames/v1/', { steamid: steamId, include_appinfo: 1, include_played_free_games: 1, format: 'json' });
        const r = json && json.response;
        if (!r || typeof r !== 'object') throw new SteamApiError('bad-response');
        if (!Array.isArray(r.games)) return { hidden: !isInt(r.game_count), games: [] };
        const games = [];
        for (const g of r.games) {
          if (!g || !isInt(g.appid) || g.appid <= 0) continue;
          games.push({
            appid: g.appid,
            name: typeof g.name === 'string' && g.name.trim() ? cleanStr(g.name, 200) : `App ${g.appid}`,
            playtimeMin: isInt(g.playtime_forever) ? g.playtime_forever : 0,
            lastPlayed: isInt(g.rtime_last_played) && g.rtime_last_played > 0 ? g.rtime_last_played : null,
          });
        }
        return { hidden: false, games };
      });
    },
    // Pseudo et avatar public du joueur.
    async getPlayerSummary(steamId) {
      needSteamId(steamId);
      return cached(`summary:${steamId}`, 30 * MIN, async () => {
        const json = await request('/ISteamUser/GetPlayerSummaries/v2/', { steamids: steamId, format: 'json' });
        const p = json && json.response && Array.isArray(json.response.players) ? json.response.players[0] : null;
        if (!p || typeof p !== 'object') return { name: null, avatarUrl: null };
        return { name: typeof p.personaname === 'string' ? cleanStr(p.personaname, 64) : null, avatarUrl: imageOrNull(p.avatarfull) };
      });
    },
    // Succès du joueur pour un jeu. status : ok | private | none.
    async getPlayerAchievements(steamId, appid) {
      needSteamId(steamId);
      needAppId(appid);
      return cached(`pach:${getLang()}:${steamId}:${appid}`, 15 * MIN, async () => {
        const { status, json } = await request('/ISteamUserStats/GetPlayerAchievements/v1/', { steamid: steamId, appid, l: getLang() }, { passStatuses: [400, 403] });
        const ps = json && json.playerstats;
        if (status === 403) return { status: 'private', list: [] };
        if (!ps || typeof ps !== 'object') {
          if (status === 400) return { status: 'none', list: [] };
          throw new SteamApiError('bad-response');
        }
        if (ps.success === false) return { status: /not public/i.test(String(ps.error)) ? 'private' : 'none', list: [] };
        if (!Array.isArray(ps.achievements) || ps.achievements.length === 0) return { status: 'none', list: [] };
        const list = [];
        for (const a of ps.achievements) {
          if (!a || typeof a.apiname !== 'string' || !a.apiname) continue;
          list.push({
            id: cleanStr(a.apiname, 128),
            name: typeof a.name === 'string' ? cleanStr(a.name, 200) : '',
            description: typeof a.description === 'string' ? cleanStr(a.description, 500) : '',
            unlocked: a.achieved === 1,
            unlockTime: isInt(a.unlocktime) && a.unlocktime > 0 ? a.unlocktime : null,
          });
        }
        return { status: list.length ? 'ok' : 'none', list };
      }, (d) => d.status !== 'private');
    },
    // Noms, descriptions et icônes officiels.
    async getSchema(appid) {
      needAppId(appid);
      return cached(`schema:${getLang()}:${appid}`, 24 * HOUR, async () => {
        const json = await request('/ISteamUserStats/GetSchemaForGame/v2/', { appid, l: getLang() });
        const raw = json && json.game && json.game.availableGameStats && json.game.availableGameStats.achievements;
        if (!Array.isArray(raw)) return [];
        return raw.filter((a) => a && typeof a.name === 'string').map((a) => ({
          id: cleanStr(a.name, 128),
          name: typeof a.displayName === 'string' ? cleanStr(a.displayName, 200) : '',
          description: typeof a.description === 'string' ? cleanStr(a.description, 500) : '',
          hidden: a.hidden === 1,
          icon: imageOrNull(a.icon),
          iconGray: imageOrNull(a.icongray),
        }));
      });
    },
    // % de joueurs ayant débloqué chaque succès : { apiname: pourcentage }.
    async getGlobalPercentages(appid) {
      needAppId(appid);
      return cached(`global:${appid}`, 24 * HOUR, async () => {
        const json = await request('/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/', { gameid: appid, format: 'json' });
        const raw = json && json.achievementpercentages && json.achievementpercentages.achievements;
        const out = {};
        if (Array.isArray(raw)) {
          for (const a of raw) {
            const p = Number(a && a.percent);
            if (a && typeof a.name === 'string' && Number.isFinite(p) && p >= 0 && p <= 100) out[cleanStr(a.name, 128)] = p;
          }
        }
        return out;
      });
    },
    // Fiche boutique (publique, sans clé). Retourne null si le jeu n'a pas de fiche.
    async getStoreDetails(appid) {
      needAppId(appid);
      return cached(`store3:${getLang()}:${getCountry()}:${appid}`, 24 * HOUR, async () => {
        const json = await request('/api/appdetails', { appids: appid, l: getLang(), cc: getCountry() }, { host: STORE_HOST, noKey: true });
        const entry = json && json[String(appid)];
        if (!entry || entry.success !== true || !entry.data || typeof entry.data !== 'object') return null;
        const d = entry.data;
        const strs = (arr, field, max) => (Array.isArray(arr) ? arr.map((x) => (field ? x && x[field] : x)).filter((x) => typeof x === 'string').map((x) => cleanStr(x, max)).filter(Boolean).slice(0, 8) : []);
        return {
          name: typeof d.name === 'string' ? cleanStr(d.name, 200) : '',
          description: typeof d.short_description === 'string' ? stripHtml(d.short_description, 800) : '',
          genres: strs(d.genres, 'description', 40),
          developers: strs(d.developers, null, 80),
          releaseDate: d.release_date && typeof d.release_date.date === 'string' ? cleanStr(d.release_date.date, 40) : '',
          price: d.is_free === true ? { free: true } : d.price_overview && typeof d.price_overview === 'object' ? { free: false, ...priceOf(d.price_overview.currency, d.price_overview.initial, d.price_overview.final, d.price_overview.discount_percent) } : null,
          headerImage: imageOrNull(d.header_image),
          screenshots: Array.isArray(d.screenshots)
            ? d.screenshots.map((s) => ({ thumb: imageOrNull(s && s.path_thumbnail), full: imageOrNull(s && s.path_full) })).filter((s) => s.thumb && s.full).slice(0, 12)
            : [],
        };
      });
    },
    // Mises en avant de la boutique (publiques, sans clé).
    async getFeatured() {
      return cached(`featured:${getLang()}:${getCountry()}`, 30 * MIN, async () => {
        const json = await request('/api/featuredcategories', { cc: getCountry(), l: getLang() }, { host: STORE_HOST, noKey: true });
        if (!json || typeof json !== 'object') throw new SteamApiError('bad-response');
        const out = [];
        for (const id of FEATURED_IDS) {
          const items = json[id] && Array.isArray(json[id].items) ? json[id].items : [];
          const list = items.map(storeItem).filter(Boolean).slice(0, 12);
          if (list.length) out.push({ id, items: list });
        }
        return out;
      });
    },
    // Recherche dans la boutique (publique, sans clé).
    async searchStore(term) {
      const q = typeof term === 'string' ? term.trim().slice(0, 100) : '';
      if (!q) return [];
      return cached(`search:${getLang()}:${getCountry()}:${q.toLowerCase()}`, 5 * MIN, async () => {
        const json = await request('/api/storesearch/', { term: q, l: getLang(), cc: getCountry() }, { host: STORE_HOST, noKey: true });
        const items = json && Array.isArray(json.items) ? json.items : [];
        return items.filter((i) => !i || !i.type || i.type === 'app').map(storeItem).filter(Boolean).slice(0, 24);
      });
    },
    // Amis : { status: 'ok' | 'private', friends: [...] } (profil de chaque ami : pseudo, avatar, statut, jeu en cours).
    async getFriends(steamId) {
      needSteamId(steamId);
      const list = await cached(`friends:${steamId}`, 5 * MIN, async () => {
        const { status, json } = await request('/ISteamUser/GetFriendList/v1/', { steamid: steamId, relationship: 'friend' }, { passStatuses: [401, 403] });
        if (status === 401 || status === 403) return { status: 'private', ids: [] };
        const raw = json && json.friendslist && Array.isArray(json.friendslist.friends) ? json.friendslist.friends : [];
        return { status: 'ok', ids: raw.map((f) => f && f.steamid).filter(isSteamId64).slice(0, 2000) };
      }, (d) => d.status !== 'private');
      if (list.status !== 'ok' || list.ids.length === 0) return { status: list.status, friends: [] };
      const friends = [];
      for (let i = 0; i < list.ids.length; i += 100) {
        const chunk = list.ids.slice(i, i + 100);
        const part = await cached(`players:${chunk.join(',')}`, 2 * MIN, async () => {
          const json = await request('/ISteamUser/GetPlayerSummaries/v2/', { steamids: chunk.join(','), format: 'json' });
          const players = json && json.response && Array.isArray(json.response.players) ? json.response.players : [];
          return players.filter((p) => p && isSteamId64(p.steamid)).map(friendOf);
        });
        friends.push(...part);
      }
      return { status: 'ok', friends };
    },
    peekFriends: (steamId) => peek(`friends:${steamId}`),
    // Lectures du cache sans réseau (affichage immédiat, calculs globaux).
    peekPlayerAchievements: (steamId, appid) => peek(`pach:${getLang()}:${steamId}:${appid}`),
    peekSchema: (appid) => peek(`schema:${getLang()}:${appid}`),
    lang: () => getLang(),
    peekGlobalPercentages: (appid) => peek(`global:${appid}`),
  };
}

module.exports = { createSteamApi, SteamApiError };
