'use strict';
// Client de l'API Web Steam, exécuté uniquement dans le processus principal.
// - clé personnelle de l'utilisateur, jamais journalisée ni mise en cache ni renvoyée à l'interface ;
// - liste blanche de domaines, https uniquement, aucune redirection suivie ;
// - appels espacés + plafond quotidien (< 100 000/jour) ; cache disque avec repli hors ligne.
const { isAllowedHost, isSteamId64 } = require('../shared/validation');

const BASE = 'https://api.steampowered.com';
const MIN = 60 * 1000;

class SteamApiError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SteamApiError';
    this.code = code; // no-key | invalid-key | private | network | rate | bad-response
  }
}

const isInt = (v) => Number.isSafeInteger(v) && v >= 0;
const cleanStr = (s, max) => String(s).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
const isAvatarHost = (h) => h.endsWith('.steamstatic.com') || h.endsWith('.akamaihd.net');

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
  function request(pathname, params) {
    const run = chain.then(async () => {
      const key = getKey();
      if (!key) throw new SteamApiError('no-key');
      const wait = lastCall + minIntervalMs - now();
      if (wait > 0) await sleep(wait);
      lastCall = now();
      bumpQuota();
      const url = new URL(BASE + pathname);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
      url.searchParams.set('key', key);
      if (url.protocol !== 'https:' || !isAllowedHost(url.hostname)) throw new SteamApiError('bad-response');
      let res;
      try {
        res = await fetchFn(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
      } catch {
        throw new SteamApiError('network'); // le message d'origine pourrait contenir l'URL (donc la clé)
      }
      if (res.status === 401 || res.status === 403) throw new SteamApiError('invalid-key');
      if (res.status === 429) throw new SteamApiError('rate');
      if (res.status >= 500) throw new SteamApiError('network');
      if (!res.ok) throw new SteamApiError('bad-response');
      try {
        return await res.json();
      } catch {
        throw new SteamApiError('bad-response');
      }
    });
    chain = run.catch(() => {});
    return run;
  }

  // Cache frais, sinon appel ; en cas de réseau coupé ou de quota, on retombe sur la dernière copie.
  async function cached(cacheKey, ttlMs, fetcher) {
    const fresh = cache.get(cacheKey, ttlMs);
    if (fresh !== undefined) return fresh;
    try {
      const data = await fetcher();
      cache.write(cacheKey, data);
      return data;
    } catch (err) {
      const stale = cache.read(cacheKey);
      if (stale && (err.code === 'network' || err.code === 'rate')) return stale.data;
      throw err;
    }
  }

  const needSteamId = (id) => {
    if (!isSteamId64(id)) throw new SteamApiError('bad-response');
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
        let avatarUrl = null;
        try {
          const u = new URL(p.avatarfull);
          if (u.protocol === 'https:' && isAvatarHost(u.hostname)) avatarUrl = u.href;
        } catch {
          // pas d'avatar valide
        }
        return { name: typeof p.personaname === 'string' ? cleanStr(p.personaname, 64) : null, avatarUrl };
      });
    },
  };
}

module.exports = { createSteamApi, SteamApiError };
