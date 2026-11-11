'use strict';
// Génère le site statique dans site/ : une page par langue (site/<code>/index.html) et la page d'accueil en anglais (site/index.html).
// Usage : node scripts/build-site.js   (aucune dépendance)
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
  const types = ['r4', 'r3', 'r2', 'r1'];
  const sw = c.swatches.map(([n, hex], i) => `<div class="sw" role="listitem"><div class="c${i + 1}"></div><p><b>${esc(n)}</b><span>${hex}</span></p></div>`).join('');
  const rar = c.rar.map(([n, r], i) => `<div><b class="${types[i]}">${esc(n)}</b><span>${esc(r)}</span></div>`).join('');
  const tech = c.tech.map(([t, p]) => `<div class="card"><h3>${esc(t)}</h3><p>${esc(p)}</p></div>`).join('');
  const facts = c.facts.map(([b, s]) => `<li><b>${esc(b)}</b><span>${esc(s)}</span></li>`).join('');
  const nav = ['projet', 'fonctions', 'design', 'technique', 'essayer'].map((id, i) => `<li><a href="#${id}">${esc(c.nav[i])}</a></li>`).join('');

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
        <a class="btn" href="#design">${esc(c.cta2)}</a>
      </div>
      <figure class="shot"><img src="${shot('bibliotheque')}" width="1800" height="1125" alt="${esc(c.heroAlt)}"></figure>
      <ul class="facts">${facts}</ul>
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

  <section id="design" class="band">
    <div class="wrap">
      <span class="eyebrow">${esc(c.designEyebrow)}</span>
      <h2>${esc(c.designH2)}</h2>
      <p class="sub">${esc(c.designSub)}</p>
      <div class="swatches" role="list" aria-label="${esc(c.swatchesAria)}">${sw}</div>
      <div class="design-grid">
        <div class="card"><h3>${esc(c.typeTitle)}</h3><div class="type-a">Aa 18 / 42</div><p class="type-b">${esc(c.typeText)}</p></div>
        <div class="card"><h3>${esc(c.rarTitle)}</h3><div class="rarities">${rar}</div></div>
        <div class="card"><h3>${esc(c.a11yTitle)}</h3><p>${esc(c.a11yText)}</p></div>
        <div class="card"><h3>${esc(c.growTitle)}</h3><p>${esc(c.growText)}</p></div>
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
        <div class="cta"><a class="btn primary" href="#essayer" aria-disabled="true">${esc(c.tryBtn)}</a></div>
        <p class="note">${esc(c.tryNote)}</p>
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    <p>${esc(c.footer1)}</p>
    <p>${esc(c.footer2)}</p>
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
