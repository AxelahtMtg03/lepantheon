'use strict';
// Génère le site statique dans site/ : une page par langue (site/<code>/index.html) et la page d'accueil en anglais (site/index.html).
// Usage : node scripts/build-site.js   (aucune dépendance)
const DOWNLOAD_URL = (() => { const v = require('../package.json').version; return `https://github.com/AxelahtMtg03/lepantheon/releases/download/v${v}/Pantheon-Setup-${v}.exe`; })();
const fs = require('node:fs');
const path = require('node:path');
const content = require('./site-content');

const SITE = path.join(__dirname, '..', 'site');
const CODES = Object.keys(content); // en, fr, es, ja, zh
const SHOTS = ['bibliotheque', 'fiche', 'succes', 'boutique', 'amis'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function render(code, prefix, isRoot) {
  const c = content[code];
  const shot = (name) => `${prefix}assets/shots/${code}/${name}.jpg`;
  const langLinks = CODES.map((k) => `<li><a href="${prefix}${k}/" hreflang="${content[k].htmlLang}" lang="${content[k].htmlLang}"${k === code ? ' aria-current="true"' : ''}>${esc(content[k].name)}</a></li>`).join('');

  const feature = (f, i) => {
    const flip = i % 2 === 1;
    const text = `<div class="text"><span class="eyebrow">${esc(f.eyebrow)}</span><h3>${esc(f.h3)}</h3><p>${esc(f.p)}</p>${f.bullets.length ? `<ul>${f.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>`;
    const fig = `<figure class="shot"><img loading="lazy" src="${shot(SHOTS[i])}" width="1800" height="1125" alt="${esc(f.alt)}"></figure>`;
    return `<div class="feature${flip ? ' flip' : ''}">${text}${fig}</div>`;
  };
  const steps = c.steps.map(([t, p]) => `<li><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`).join('');
  const keySteps = c.keySteps.map((t) => `<li>${esc(t)}</li>`).join('');
  const tech = c.tech.map(([t, p]) => `<div class="card"><h3>${esc(t)}</h3><p>${esc(p)}</p></div>`).join('');
  const nav = ['projet', 'fonctions', 'demarrer', 'technique', 'essayer'].map((id, i) => `<li><a href="#${id}">${esc(c.nav[i])}</a></li>`).join('');

  return `<!doctype html>
<html lang="${c.htmlLang}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; font-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)}</title>
<meta name="description" content="${esc(c.description)}">
<meta name="theme-color" content="#0B0D12">
<meta property="og:title" content="${esc(c.title)}">
<meta property="og:description" content="${esc(c.description)}">
<meta property="og:type" content="website">
<link rel="icon" type="image/png" href="${prefix}assets/logo.png">
<link rel="stylesheet" href="${prefix}style.css">
</head>
<body>
<a class="skip" href="#contenu">${esc(c.skip)}</a>

<header class="nav">
  <div class="wrap">
    <a class="brand" href="${prefix || './'}${isRoot ? '' : code + '/'}"><img src="${prefix}assets/logo.png" alt="" width="32" height="32">Pantheon</a>
    <nav aria-label="${esc(c.navLabel)}"><ul>${nav}</ul></nav>
    <details class="langmenu">
      <summary aria-label="${esc(c.langLabel)}">${esc(c.name)}</summary>
      <ul>${langLinks}</ul>
    </details>
  </div>
</header>

<main id="contenu">
  <div class="hero">
    <div class="wrap">
      <span class="pill"><i aria-hidden="true"></i>${esc(c.pill)}</span>
      <h1>${esc(c.h1a)} <span>${esc(c.h1b)}</span></h1>
      <p class="lead">${esc(c.lead)}</p>
      <div class="cta">
        <a class="btn primary" href="#fonctions">${esc(c.cta1)}</a>
        <a class="btn" href="#essayer">${esc(c.nav[4])}</a>
      </div>
      <figure class="shot"><img src="${shot('bibliotheque')}" width="1800" height="1125" alt="${esc(c.heroAlt)}"></figure>
    </div>
  </div>

  <section id="projet">
    <div class="wrap brief">
      <div>
        <span class="eyebrow">${esc(c.projEyebrow)}</span>
        <h2>${esc(c.projH2)}</h2>
        <p class="sub">${esc(c.projSub)}</p>
      </div>
      <div>
        <p>${esc(c.projP1)}</p>
        <p>${esc(c.projP2)}</p>
        <p class="quote mt">${esc(c.quote)}<small>${esc(c.quoteSmall)}</small></p>
      </div>
    </div>
  </section>

  <section id="fonctions" class="flush-top">
    <div class="wrap">
      <span class="eyebrow">${esc(c.featEyebrow)}</span>
      <h2>${esc(c.featH2)}</h2>
      ${c.features.map(feature).join('\n      ')}
      <p class="note mt">${esc(c.demoNote)}</p>
    </div>
  </section>

  <section id="demarrer" class="band">
    <div class="wrap">
      <span class="eyebrow">${esc(c.startEyebrow)}</span>
      <h2>${esc(c.startH2)}</h2>
      <p class="sub">${esc(c.startSub)}</p>
      <ol class="steps4">${steps}</ol>
      <div class="keybox">
        <h3>${esc(c.keyH3)}</h3>
        <ol class="keysteps">${keySteps}</ol>
        <div class="cta left"><a class="btn primary" href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener noreferrer">${esc(c.keyOpen)}</a></div>
        <p class="keynote">${esc(c.keyPrivacy)}</p>
        <p class="keynote">${esc(c.keyNote)}</p>
      </div>
    </div>
  </section>

  <section id="technique">
    <div class="wrap">
      <span class="eyebrow">${esc(c.techEyebrow)}</span>
      <h2>${esc(c.techH2)}</h2>
      <p class="sub">${esc(c.techSub)}</p>
      <div class="tech">${tech}</div>
      <div class="tags" aria-label="${esc(c.techAria)}"><span>Electron</span><span>JavaScript</span><span>HTML / CSS</span><span>Steam Web API</span><span>safeStorage</span><span>NSIS</span></div>
    </div>
  </section>

  <section id="essayer" class="flush-top">
    <div class="wrap">
      <div class="try">
        <span class="eyebrow">${esc(c.tryEyebrow)}</span>
        <h2>${esc(c.tryH2)}</h2>
        <p class="sub">${esc(c.trySub)}</p>
        <div class="cta"><a class="btn primary" href="${DOWNLOAD_URL}" rel="noopener noreferrer">${esc(c.tryBtn)}</a></div>
        <p class="note">${esc(c.tryNote)}</p>
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    <div>
      <p>${esc(c.footer1)}</p>
      <p>${esc(c.footer2)}</p>
    </div>
    <ul class="social" aria-label="${esc(c.linksLabel)}">
      <li><a href="https://github.com/AxelahtMtg03" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>GitHub</a></li>
      <li><a href="https://www.instagram.com/axel.aht.mtg/" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>Instagram</a></li>
    </ul>
  </div>
</footer>
</body>
</html>
`;
}

function write(rel, html) {
  const file = path.join(SITE, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

// Accueil (anglais) + une page par langue.
write('index.html', render('en', '', true));
for (const code of CODES) write(`${code}/index.html`, render(code, '../', false));

// Redirection selon la langue du navigateur, pour l'accueil uniquement (Vercel). Le sélecteur renvoie vers /<code>/, sans redirection.
const redirects = CODES.filter((k) => k !== 'en').map((k) => ({
  source: '/',
  has: [{ type: 'header', key: 'accept-language', value: `^${k}.*` }],
  destination: `/${k}/`,
  permanent: false,
}));
fs.writeFileSync(path.join(SITE, 'vercel.json'), `${JSON.stringify({ cleanUrls: true, trailingSlash: true, redirects }, null, 2)}\n`);

console.log(`Site généré : ${CODES.length + 1} pages + vercel.json`);
