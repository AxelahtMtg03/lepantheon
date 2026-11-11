'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const content = require('../scripts/site-content');

const site = path.join(__dirname, '..', 'site');
const EXTERNAL_HOSTS = ['github.com', 'www.instagram.com', 'steamcommunity.com'];

test('le site a les mêmes sections dans les cinq langues', () => {
  const codes = Object.keys(content);
  assert.deepEqual([...codes].sort(), ['en', 'es', 'fr', 'ja', 'zh']);
  for (const code of codes) {
    // même forme : mêmes champs, mêmes nombres de cartes, d'étapes, de puces…
    assert.deepEqual(Object.keys(content[code]).sort(), Object.keys(content.en).sort(), `champs différents : ${code}`);
    assert.equal(content[code].features.length, content.en.features.length, code);
    content[code].features.forEach((f, i) => assert.equal(f.bullets.length, content.en.features[i].bullets.length, `${code} fonction ${i}`));
    assert.equal(content[code].tech.length, content.en.tech.length, code);
    assert.equal(content[code].steps.length, 4, code);
    assert.equal(content[code].keySteps.length, 5, code);
    assert.equal(content[code].nav.length, 5, code);
  }
});

test('les pages générées existent, sans style en ligne ni script, avec images et polices locales', () => {
  const pages = ['index.html', ...Object.keys(content).map((c) => `${c}/index.html`)];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(site, p), 'utf8');
    assert.ok(!/\sstyle=/.test(html), `${p} : style en ligne (interdit par la CSP)`);
    assert.ok(!/<script/i.test(html), `${p} : script`);
    // Seuls des liens <a> vers quelques sites sont externes (nouvel onglet) ; aucune ressource n'est chargée à distance.
    assert.ok(!/(?:src|srcset|action)="https?:/.test(html), `${p} : ressource externe`);
    assert.ok(!/<link[^>]*href="https?:/.test(html), `${p} : feuille de style externe`);
    for (const m of html.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)) {
      assert.match(m[0], /rel="noopener noreferrer"/, `${p} : lien externe sans noopener`);
      assert.ok(EXTERNAL_HOSTS.includes(new URL(m[1]).hostname), `${p} : lien externe inattendu ${m[1]}`);
    }
    for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if (/^(mailto:|https:)/.test(m[1])) continue;
      const target = path.join(site, path.dirname(p), m[1]);
      assert.ok(fs.existsSync(target) || fs.existsSync(path.join(target, 'index.html')), `${p} : lien cassé ${m[1]}`);
    }
  }
});

test('vercel.json : une redirection par langue autre que l\'anglais, accueil uniquement', () => {
  const v = JSON.parse(fs.readFileSync(path.join(site, 'vercel.json'), 'utf8'));
  assert.equal(v.redirects.length, 4);
  for (const r of v.redirects) assert.equal(r.source, '/');
});
