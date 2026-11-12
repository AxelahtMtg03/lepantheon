// Règles pures d'Odéon et de la recherche (aucune dépendance au DOM : testé à part).
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const pctOf = (g) => (g.achievements && g.achievements.total > 0 ? (g.achievements.unlocked / g.achievements.total) * 100 : null);
export const isPlatinum = (g) => g.achievements && g.achievements.total > 0 && g.achievements.unlocked >= g.achievements.total;
const byRecent = (a, b) => (b.lastPlayed ?? -1) - (a.lastPlayed ?? -1);

// Rangées calculées automatiquement. Une rangée vide n'existe pas. « shown » = ce qui tient sur une ligne.
export function buildRows(games, limit = 9) {
  const defs = [
    ['continue', games.filter((g) => g.installed && g.lastPlayed).sort(byRecent)],
    ['almost', games.filter((g) => { const p = pctOf(g); return p !== null && p >= 70 && p < 100; }).sort((a, b) => pctOf(b) - pctOf(a))],
    ['unstarted', games.filter((g) => !(g.playtimeMin > 0)).sort((a, b) => Number(b.installed) - Number(a.installed))],
    ['platinum', games.filter(isPlatinum)],
    ['recent', [...games].sort((a, b) => b.appid - a.appid)],
    ['all', [...games].sort((a, b) => (a.name || '').localeCompare(b.name || ''))],
  ];
  return defs.filter(([, list]) => list.length > 0).map(([id, list]) => ({ id, total: list.length, games: list, shown: list.slice(0, limit) }));
}

// Nombre de jaquettes par ligne selon la largeur de la fenêtre (9 sur grand écran).
export function perRow(width) {
  return Math.max(3, Math.min(9, Math.floor((width - 80) / 168)));
}

// Étiquette du grand écran selon l'état du jeu.
export function heroKind(g) {
  if (isPlatinum(g)) return 'platinum';
  const p = pctOf(g);
  if (p !== null && p >= 70) return 'almost';
  if (!g.installed) return 'install';
  if (!(g.playtimeMin > 0)) return 'start';
  return 'resume';
}

export function defaultHero(games) {
  return games.filter((g) => g.installed && g.lastPlayed).sort(byRecent)[0] || games[0] || null;
}

// Recherche locale : instantanée, insensible à la casse et aux accents.
export function searchOwned(games, query, max = 30) {
  const q = norm(query);
  if (!q) return [];
  const starts = [];
  const rest = [];
  for (const g of games) {
    const n = norm(g.name);
    if (n.startsWith(q)) starts.push(g);
    else if (n.includes(q)) rest.push(g);
  }
  return [...starts, ...rest].slice(0, max);
}

// Les jeux du magasin que l'utilisateur possède déjà n'apparaissent pas dans « Pas encore à toi ».
export function notOwned(items, games) {
  const owned = new Set(games.map((g) => g.appid));
  return items.filter((i) => !owned.has(i.appid));
}

// Antirebond : seul le dernier appel compte ; cancel() annule l'appel en attente.
export function createDebounce(fn, ms, timers = { setTimeout: (f, d) => setTimeout(f, d), clearTimeout: (i) => clearTimeout(i) }) {
  let id = null;
  const call = (...args) => {
    timers.clearTimeout(id);
    id = timers.setTimeout(() => { id = null; fn(...args); }, ms);
  };
  call.cancel = () => { timers.clearTimeout(id); id = null; };
  return call;
}

// L'écran « Choisis ton interface » : seulement tant que firstRunDone n'est pas vrai.
export const shouldShowFirstRun = (prefs) => !prefs || prefs.firstRunDone !== true;
