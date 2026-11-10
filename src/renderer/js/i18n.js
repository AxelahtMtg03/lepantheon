import fr from '../locales/fr.js';

const dict = fr;

// t('clé', { n: 2 }) ; les clés pluriel « singulier|pluriel » utilisent vars.n (pluriel si n > 1).
export function t(key, vars = {}) {
  let s = dict[key] ?? key;
  if (s.includes('|')) {
    const [one, many] = s.split('|');
    s = Number(vars.n) > 1 ? many : one;
  }
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}
