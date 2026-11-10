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

function createSteamApi({
  getKey,
  cache,
  quotaCache = cache,
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
      return cached(`pach:${steamId}:${appid}`, 15 * MIN, async () => {
        const { status, json } = await request('/ISteamUserStats/GetPlayerAchievements/v1/', { steamid: steamId, appid, l: 'french' }, { passStatuses: [400, 403] });
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
      return cached(`schema:${appid}`, 24 * HOUR, async () => {
        const json = await request('/ISteamUserStats/GetSchemaForGame/v2/', { appid, l: 'french' });
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
      return cached(`store:${appid}`, 24 * HOUR, async () => {
        const json = await request('/api/appdetails', { appids: appid, l: 'french', cc: 'fr' }, { host: STORE_HOST, noKey: true });
        const entry = json && json[String(appid)];
        if (!entry || entry.success !== true || !entry.data || typeof entry.data !== 'object') return null;
        const d = entry.data;
        const strs = (arr, field, max) => (Array.isArray(arr) ? arr.map((x) => (field ? x && x[field] : x)).filter((x) => typeof x === 'string').map((x) => cleanStr(x, max)).filter(Boolean).slice(0, 8) : []);
        return {
          description: typeof d.short_description === 'string' ? stripHtml(d.short_description, 800) : '',
          genres: strs(d.genres, 'description', 40),
          developers: strs(d.developers, null, 80),
          releaseDate: d.release_date && typeof d.release_date.date === 'string' ? cleanStr(d.release_date.date, 40) : '',
          headerImage: imageOrNull(d.header_image),
          screenshots: Array.isArray(d.screenshots)
            ? d.screenshots.map((s) => ({ thumb: imageOrNull(s && s.path_thumbnail), full: imageOrNull(s && s.path_full) })).filter((s) => s.thumb && s.full).slice(0, 12)
            : [],
        };
      });
    },
    // Lectures du cache sans réseau (affichage immédiat, calculs globaux).
    peekPlayerAchievements: (steamId, appid) => peek(`pach:${steamId}:${appid}`),
    peekSchema: (appid) => peek(`schema:${appid}`),
    peekGlobalPercentages: (appid) => peek(`global:${appid}`),
  };
}

module.exports = { createSteamApi, SteamApiError };
