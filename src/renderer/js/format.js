import { t } from './i18n.js';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

// Minutes -> « 12,4 h de jeu ».
export function formatPlaytime(min) {
  return t('time.hours', { n: nf.format((Number(min) || 0) / 60) });
}

// Secondes epoch -> « hier », « il y a 3 jours »...
export function formatRelative(epochSec) {
  const diffSec = Math.round(Number(epochSec) - Date.now() / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year');
}

export function achievementPct(game) {
  const a = game.achievements;
  return a && a.total > 0 ? Math.round((a.unlocked / a.total) * 100) : null;
}

export const isComplete = (g) => g.achievements && g.achievements.total > 0 && g.achievements.unlocked === g.achievements.total;
