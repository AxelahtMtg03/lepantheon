import { h } from '../dom.js';
import { t } from '../i18n.js';

// Réglages (version minimale à l'étape 4 ; l'écran complet est prévu à l'étape 7).
export async function renderSettings(root, api) {
  const info = await api.getSettings();
  const msg = h('p', { class: 'form-msg', role: 'status', 'aria-live': 'polite' });
  const say = (key, ok = true) => {
    msg.textContent = t(key);
    msg.dataset.ok = String(ok);
  };

  const keyInput = h('input', { class: 'text', id: 'f-key', type: 'password', autocomplete: 'off', spellcheck: 'false', maxlength: '40', placeholder: info.hasApiKey ? t('set.key.saved') : '' });
  const keyState = h('p', { class: 'page-sub' }, t(info.hasApiKey ? 'set.key.stateOn' : 'set.key.stateOff'));

  const saveKey = async () => {
    const value = keyInput.value;
    keyInput.value = ''; // la clé ne reste jamais affichée
    if (!value.trim()) return;
    const r = await api.setApiKey(value);
    if (r.ok) {
      keyState.textContent = t('set.key.stateOn');
      keyInput.placeholder = t('set.key.saved');
      say(r.verified ? 'set.key.okVerified' : 'set.key.okUnverified');
    } else say(`set.key.err.${r.error}`, false);
  };
  const removeKey = async () => {
    await api.clearApiKey();
    keyState.textContent = t('set.key.stateOff');
    keyInput.placeholder = '';
    say('set.key.removed');
  };

  const pathInput = h('input', { class: 'text', id: 'f-path', type: 'text', value: info.steamPath, placeholder: info.detectedSteamPath || 'C:\\Program Files (x86)\\Steam', spellcheck: 'false' });
  const idInput = h('input', { class: 'text', id: 'f-id', type: 'text', value: info.steamId, placeholder: info.detectedSteamId || '7656119…', inputmode: 'numeric', maxlength: '17', spellcheck: 'false' });
  const saveAccount = async () => {
    const r = await api.saveSettings({ steamPath: pathInput.value, steamId: idInput.value });
    say(r.ok ? 'set.saved' : `set.err.${r.error}`, r.ok);
  };

  const field = (id, label, input, hint) => h('div', { class: 'field' }, h('label', { for: id }, label), input, hint ? h('p', { class: 'hint' }, hint) : null);
  const steps = h('ol', { class: 'steps' }, ['1', '2', '3', '4'].map((n) => h('li', null, t(`set.key.step${n}`))));

  root.replaceChildren(
    h('header', { class: 'page-head' }, h('h1', { class: 'page-title' }, t('nav.settings'))),
    h('section', { class: 'panel', 'aria-labelledby': 'h-key' },
      h('h2', { id: 'h-key' }, t('set.key.title')),
      h('p', { class: 'hint' }, t('set.key.intro')),
      steps,
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => api.openExternal('https://steamcommunity.com/dev/apikey') }, t('set.key.open'))),
      keyState,
      !info.encryptionAvailable ? h('p', { class: 'form-msg', 'data-ok': 'false' }, t('set.key.err.encryption-unavailable')) : null,
      field('f-key', t('set.key.label'), keyInput, t('set.key.warn')),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', type: 'button', onclick: saveKey }, t('set.key.save')),
        h('button', { class: 'btn', type: 'button', onclick: removeKey }, t('set.key.remove'))),
    ),
    h('section', { class: 'panel', 'aria-labelledby': 'h-acc' },
      h('h2', { id: 'h-acc' }, t('set.acc.title')),
      field('f-path', t('set.acc.path'), pathInput, t('set.acc.pathHint')),
      field('f-id', t('set.acc.id'), idInput, t('set.acc.idHint')),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', onclick: saveAccount }, t('set.save'))),
    ),
    h('section', { class: 'panel', 'aria-labelledby': 'h-cache' },
      h('h2', { id: 'h-cache' }, t('set.cache.title')),
      h('p', { class: 'hint' }, t('set.cache.text')),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: async () => { await api.clearCache(); say('set.cache.done'); } }, t('set.cache.clear'))),
    ),
    msg,
  );
}
