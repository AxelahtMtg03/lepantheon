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

const df = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });
export const formatDate = (epochSec) => df.format(new Date(Number(epochSec) * 1000));
export const formatHoursShort = (min) => `${nf.format((Number(min) || 0) / 60)} h`;
export const formatPct = (p) => (typeof p === 'number' ? `${nf.format(p)} %` : '—');
export function formatSize(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b <= 0) return '—';
  if (b >= 1024 ** 3) return `${nf.format(b / 1024 ** 3)} Go`;
  return `${nf.format(b / 1024 ** 2)} Mo`;
}

// Prix (centimes + devise ISO) -> « 19,99 € » ; « Gratuit » ; chaîne vide si inconnu.
export function formatPrice(p) {
  if (!p) return '';
  if (p.free || p.final === 0) return t('store.free');
  if (p.final === null || p.final === undefined || !p.currency) return '';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: p.currency }).format(p.final / 100);
  } catch {
    return '';
  }
}
export function formatInitialPrice(p) {
  return p && p.discountPct > 0 && p.initial && p.currency ? formatPrice({ currency: p.currency, final: p.initial }) : '';
}

export function achievementPct(game) {
  const a = game.achievements;
  return a && a.total > 0 ? Math.round((a.unlocked / a.total) * 100) : null;
}

export const isComplete = (g) => g.achievements && g.achievements.total > 0 && g.achievements.unlocked === g.achievements.total;
