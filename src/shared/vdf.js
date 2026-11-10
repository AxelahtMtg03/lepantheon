'use strict';
// Parseur VDF/ACF (format texte de Valve). Tolérant : commentaires //, chaînes non quotées,
// séquences d'échappement (\\ \" \n \t). Ne plante jamais sur une entrée étrange : lève VdfError.

const MAX_SIZE = 20 * 1024 * 1024;
const MAX_DEPTH = 64;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

class VdfError extends Error {
  constructor(message, pos) {
    super(pos == null ? message : `${message} (position ${pos})`);
    this.name = 'VdfError';
  }
}

const ESCAPES = { n: '\n', t: '\t', '\\': '\\', '"': '"' };

function tokenize(text) {
  const tokens = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '﻿') {
      i++;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i++;
    } else if (c === '{' || c === '}') {
      tokens.push({ type: c, pos: i });
      i++;
    } else if (c === '"') {
      const start = i++;
      let s = '';
      for (;;) {
        if (i >= n) throw new VdfError('Chaîne non terminée', start);
        const ch = text[i];
        if (ch === '"') {
          i++;
          break;
        }
        if (ch === '\\' && i + 1 < n) {
          const next = text[i + 1];
          s += Object.hasOwn(ESCAPES, next) ? ESCAPES[next] : `\\${next}`;
          i += 2;
        } else {
          s += ch;
          i++;
        }
      }
      tokens.push({ type: 'str', value: s, pos: start });
    } else {
      const start = i;
      while (i < n && !/[\s{}"]/.test(text[i])) i++;
      tokens.push({ type: 'str', value: text.slice(start, i), pos: start });
    }
  }
  return tokens;
}

function parseVdf(text) {
  if (typeof text !== 'string') throw new VdfError('Le contenu doit être du texte');
  if (text.length > MAX_SIZE) throw new VdfError('Fichier trop volumineux');
  const tokens = tokenize(text);
  let idx = 0;

  function parseBlock(depth, topLevel) {
    if (depth > MAX_DEPTH) throw new VdfError('Imbrication trop profonde');
    const obj = Object.create(null);
    for (;;) {
      const tok = tokens[idx];
      if (!tok) {
        if (topLevel) return obj;
        throw new VdfError('Accolade fermante manquante');
      }
      if (tok.type === '}') {
        if (topLevel) throw new VdfError('Accolade fermante inattendue', tok.pos);
        idx++;
        return obj;
      }
      if (tok.type === '{') throw new VdfError('Accolade ouvrante inattendue', tok.pos);
      const key = tok.value;
      idx++;
      const next = tokens[idx];
      if (!next) throw new VdfError(`Valeur manquante pour « ${key} »`, tok.pos);
      let value;
      if (next.type === '{') {
        idx++;
        value = parseBlock(depth + 1, false);
      } else if (next.type === 'str') {
        value = next.value;
        idx++;
      } else {
        throw new VdfError('Accolade fermante inattendue', next.pos);
      }
      if (!UNSAFE_KEYS.has(key)) obj[key] = value;
    }
  }

  return parseBlock(0, true);
}

// Les clés Steam changent parfois de casse (AppState / appstate) : accès insensible à la casse.
function getCI(obj, key) {
  if (!obj || typeof obj !== 'object') return undefined;
  const lower = String(key).toLowerCase();
  for (const k of Object.keys(obj)) if (k.toLowerCase() === lower) return obj[k];
  return undefined;
}

// Chemin de clés : getPath(doc, 'InstallConfigStore', 'Software', 'Valve').
function getPath(obj, ...keys) {
  let cur = obj;
  for (const k of keys) {
    cur = getCI(cur, k);
    if (cur === undefined) return undefined;
  }
  return cur;
}

// Nombre entier sûr, sinon défaut (une valeur inattendue ne casse jamais l'appli).
function toInt(value, fallback = 0) {
  if (typeof value !== 'string' || !/^-?\d{1,15}$/.test(value)) return fallback;
  return Number(value);
}

module.exports = { parseVdf, VdfError, getCI, getPath, toInt };
