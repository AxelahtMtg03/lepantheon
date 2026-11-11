import { t, intlLocale } from './i18n.js';

// Les formateurs dépendent de la langue : on les crée une fois par langue.
const memo = new Map();
function intl(kind, options) {
  const key = `${kind}|${intlLocale()}|${JSON.stringify(options)}`;
  if (!memo.has(key)) {
    const Ctor = { number: Intl.NumberFormat, relative: Intl.RelativeTimeFormat, date: Intl.DateTimeFormat }[kind];
    memo.set(key, new Ctor(intlLocale(), options));
  }
  return memo.get(key);
}
const num = (n) => intl('number', { maximumFractionDigits: 1 }).format(n);

// Minutes -> « 12,4 h de jeu ».
export function formatPlaytime(min) {
  return t('time.hours', { n: num((Number(min) || 0) / 60) });
}

// Secondes epoch -> « hier », « il y a 3 jours »...
export function formatRelative(epochSec) {
  const rtf = intl('relative', { numeric: 'auto' });
  const diffSec = Math.round(Number(epochSec) - Date.now() / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year');
}

export const formatDate = (epochSec) => intl('date', { dateStyle: 'long' }).format(new Date(Number(epochSec) * 1000));
export const formatHoursShort = (min) => t('time.hoursShort', { n: num((Number(min) || 0) / 60) });
export const formatPct = (p) => (typeof p === 'number' ? t('fmt.pct', { n: num(p) }) : '—');
export function formatSize(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b <= 0) return '—';
  if (b >= 1024 ** 3) return `${num(b / 1024 ** 3)} ${t('unit.gb')}`;
  return `${num(b / 1024 ** 2)} ${t('unit.mb')}`;
}

// Prix (centimes + devise ISO) -> « 19,99 € » ; « Gratuit » ; chaîne vide si inconnu.
export function formatPrice(p) {
  if (!p) return '';
  if (p.free || p.final === 0) return t('store.free');
  if (p.final === null || p.final === undefined || !p.currency) return '';
  try {
    return intl('number', { style: 'currency', currency: p.currency }).format(p.final / 100);
  } catch {
    return '';
  }
}
export function formatInitialPrice(p) {
  return p && p.discountPct > 0 && p.initial && p.currency ? formatPrice({ currency: p.currency, final: p.initial }) : '';
}

// Tri alphabétique selon la langue de l'interface.
export const compareNames = (a, b) => String(a).localeCompare(String(b), intlLocale());

export function achievementPct(game) {
  const a = game.achievements;
  return a && a.total > 0 ? Math.round((a.unlocked / a.total) * 100) : null;
}

export const isComplete = (g) => g.achievements && g.achievements.total > 0 && g.achievements.unlocked === g.achievements.total;
