'use strict';
// Préférences d'affichage : disposition (Agora ou Odéon), couleur d'accent, options. Validation stricte :
// toute valeur inconnue retombe sur la valeur par défaut.
const LAYOUTS = Object.freeze(['agora', 'odeon']);
// Couleur d'accent + couleur du texte posé dessus. Jamais de vert, jaune, orange ni rose.
const ACCENTS = Object.freeze({
  blue: { accent: '#4D8DFF', on: '#06122B' },
  white: { accent: '#E9ECF3', on: '#0B0D12' },
  violet: { accent: '#A78BFA', on: '#140A2E' },
  red: { accent: '#FF5A5F', on: '#2B0608' },
});
const DEFAULT_LAYOUT = 'odeon';
const BOOLEANS = Object.freeze({ splash: true, reducedMotion: false, fullscreen: false, firstRunDone: false });

// existing : réglages déjà présents sur le disque (utilisateur d'une version précédente) → Agora, l'interface qu'il connaît.
function normalizePrefs(raw, { existing = false } = {}) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {
    layout: LAYOUTS.includes(r.layout) ? r.layout : r.layout === undefined && existing ? 'agora' : DEFAULT_LAYOUT,
    accent: Object.hasOwn(ACCENTS, r.accent) ? r.accent : 'blue',
  };
  for (const [k, def] of Object.entries(BOOLEANS)) out[k] = typeof r[k] === 'boolean' ? r[k] : def;
  return out;
}

// Applique des changements partiels : seules les clés connues et valides sont retenues.
function mergePrefs(current, patch) {
  const p = patch && typeof patch === 'object' ? patch : {};
  const next = { ...current };
  if (LAYOUTS.includes(p.layout)) next.layout = p.layout;
  if (Object.hasOwn(ACCENTS, p.accent)) next.accent = p.accent;
  for (const k of Object.keys(BOOLEANS)) if (typeof p[k] === 'boolean') next[k] = p[k];
  return next;
}

module.exports = { LAYOUTS, ACCENTS, DEFAULT_LAYOUT, normalizePrefs, mergePrefs };
