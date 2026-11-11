// Langues de l'interface : anglais, français, espagnol, japonais, chinois (simplifié).
// Les textes sont dans src/renderer/locales/<code>.js ; l'anglais sert de repli si une clé manque.
export const LANGUAGES = {
  en: { name: 'English', intl: 'en-US' },
  fr: { name: 'Français', intl: 'fr-FR' },
  es: { name: 'Español', intl: 'es-ES' },
  ja: { name: '日本語', intl: 'ja-JP' },
  zh: { name: '中文（简体）', intl: 'zh-CN' },
};

let lang = 'en';
let dict = {};
let fallback = {};

// À appeler une fois au démarrage, avant d'afficher quoi que ce soit.
export async function initI18n(code) {
  lang = Object.hasOwn(LANGUAGES, code) ? code : 'en';
  const [main, base] = await Promise.all([import(`../locales/${lang}.js`), lang === 'en' ? null : import('../locales/en.js')]);
  dict = main.default;
  fallback = base ? base.default : {};
  document.documentElement.lang = lang;
  document.title = t('app.name');
}

export const getLang = () => lang;
export const intlLocale = () => LANGUAGES[lang].intl;

// t('clé', { n: 2 }) ; une clé « singulier|pluriel » choisit selon vars.n (français : pluriel à partir de 2 ; les autres : sauf 1).
export function t(key, vars = {}) {
  let s = dict[key] ?? fallback[key] ?? key;
  if (s.includes('|')) {
    const [one, many] = s.split('|');
    const n = Number(vars.n);
    s = (lang === 'fr' ? n > 1 : n !== 1) ? many : one;
  }
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}
