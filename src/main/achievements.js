'use strict';
// Service des succès : détail d'un jeu, résumés pour toute la bibliothèque (scan en arrière-plan,
// espacé et mis en cache) et aperçu global. Ne fait jamais de boucle d'appels agressive.
const { mergeAchievements, summarize, rarestUnlocked } = require('../shared/achievements');

const RESCAN_MS = 15 * 60 * 1000;

function createAchievementService({ api, now = Date.now }) {
  const lastScan = new Map(); // appid -> horodatage du dernier passage
  const deepDone = new Set(); // jeux dont schéma + % global ont été chargés cette session
  let queue = [];
  let running = false;
  let steamIdInUse = null;
  let stopped = null; // 'private' | 'invalid-key' | 'no-key' | 'rate' : on arrête d'insister

  let wantDeep = false; // charger aussi schéma + % global (page Succès)

  async function loop() {
    if (running) return;
    running = true;
    try {
      while (queue.length && !stopped) {
        const appid = queue.shift();
        try {
          const p = await api.getPlayerAchievements(steamIdInUse, appid);
          if (p.status === 'private') {
            stopped = 'private'; // inutile d'insister jeu par jeu
            queue = [];
          }
          const s = summarize(p);
          if (wantDeep && s && s.unlocked > 0 && !deepDone.has(appid)) {
            await Promise.all([api.getSchema(appid), api.getGlobalPercentages(appid)]);
            deepDone.add(appid);
          }
        } catch (err) {
          if (['invalid-key', 'no-key', 'rate'].includes(err.code)) {
            stopped = err.code;
            queue = [];
          }
          // réseau coupé ou jeu sans stats : on passe au suivant
        }
      }
    } finally {
      running = false;
    }
  }

  function enqueue(steamId, appids, deep) {
    if (steamId !== steamIdInUse) {
      steamIdInUse = steamId;
      stopped = null;
      lastScan.clear();
      deepDone.clear();
    }
    const t = now();
    if (deep) wantDeep = true;
    for (const id of appids) {
      if (queue.includes(id)) continue;
      if (!deep && t - (lastScan.get(id) || 0) < RESCAN_MS) continue;
      if (deep && deepDone.has(id)) continue;
      lastScan.set(id, t);
      queue.push(id);
    }
    loop();
  }

  const peekSummary = (steamId, appid) => summarize(api.peekPlayerAchievements(steamId, appid));

  return {
    peekSummary,
    // Lance (sans attendre) la lecture des succès des jeux déjà joués.
    scan: (steamId, games) => enqueue(steamId, games.filter((g) => g.playtimeMin > 0).map((g) => g.appid), false),

    // Détail complet pour la fiche d'un jeu.
    async detail(steamId, appid) {
      const player = await api.getPlayerAchievements(steamId, appid);
      if (player.status !== 'ok') return { status: player.status, unlocked: 0, total: 0, list: [] };
      const [schema, globals] = await Promise.all([api.getSchema(appid).catch(() => []), api.getGlobalPercentages(appid).catch(() => ({}))]);
      const list = mergeAchievements(player.list, schema, globals);
      return { status: 'ok', unlocked: list.filter((a) => a.unlocked).length, total: list.length, list };
    },

    // Page Succès : totaux, jeux terminés, plus proches de 100 %, succès les plus rares obtenus.
    overview(steamId, games) {
      const rows = [];
      const withItems = [];
      let missing = 0;
      for (const g of games) {
        const player = api.peekPlayerAchievements(steamId, g.appid);
        const s = summarize(player);
        if (!s) continue;
        rows.push({ appid: g.appid, name: g.name, unlocked: s.unlocked, total: s.total, installed: g.installed });
        if (s.unlocked > 0) {
          const schema = api.peekSchema(g.appid);
          const globals = api.peekGlobalPercentages(g.appid);
          if (schema && globals) withItems.push({ appid: g.appid, name: g.name, items: mergeAchievements(player.list, schema, globals) });
          else missing++;
        }
      }
      if (missing > 0) enqueue(steamId, rows.filter((r) => r.unlocked > 0).map((r) => r.appid), true);
      const played = games.filter((g) => g.playtimeMin > 0).length;
      const known = new Set(rows.map((r) => r.appid));
      return {
        rows,
        rarest: rarestUnlocked(withItems, 10),
        pending: missing, // jeux dont le détail de rareté n'est pas encore chargé
        scanning: running || queue.length > 0,
        played,
        known: known.size,
        blocked: stopped,
      };
    },
  };
}

module.exports = { createAchievementService };
