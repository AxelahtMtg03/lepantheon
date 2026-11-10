'use strict';
// Clé d'API Steam : chiffrée avec safeStorage (DPAPI sous Windows), jamais écrite en clair,
// jamais renvoyée à l'interface, jamais journalisée.
const fs = require('node:fs');
const path = require('node:path');
const { app, safeStorage } = require('electron');

const KEY_RE = /^[0-9A-Fa-f]{32}$/;
const file = () => path.join(app.getPath('userData'), 'apikey.bin');
let memo = null; // clé déchiffrée, gardée en mémoire du processus principal uniquement

const isValidKeyFormat = (k) => typeof k === 'string' && KEY_RE.test(k.trim());
const encryptionAvailable = () => safeStorage.isAsyncEncryptionAvailable();

// À appeler une fois au démarrage (après app ready) : déchiffre la clé enregistrée.
async function init() {
  try {
    const { result } = await safeStorage.decryptStringAsync(fs.readFileSync(file()));
    if (isValidKeyFormat(result)) memo = result;
  } catch {
    // absente ou illisible (autre session Windows) : considérée comme non configurée
  }
}

async function setKey(raw) {
  if (!isValidKeyFormat(raw)) throw new Error('format');
  if (!(await encryptionAvailable())) throw new Error('encryption-unavailable');
  const key = raw.trim().toUpperCase();
  const encrypted = await safeStorage.encryptStringAsync(key);
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), encrypted);
  memo = key;
}

const getKey = () => memo;
const hasKey = () => memo !== null;

function clearKey() {
  memo = null;
  fs.rmSync(file(), { force: true });
}

module.exports = { init, setKey, getKey, clearKey, hasKey, isValidKeyFormat, encryptionAvailable };
