// Construction du DOM sans innerHTML : toute donnée externe passe par textContent / setAttribute.
const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') {
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith('--')) el.style.setProperty(p, val);
        else el.style[p] = val;
      }
    } else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(typeof c === 'object' && c.nodeType ? c : String(c));
  }
}

const ICONS = {
  library: { d: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z' },
  store: { d: 'M6 7h12l1 13H5z M9 7a3 3 0 0 1 6 0' },
  friends: { d: 'M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1 M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M20 20v-1a4 4 0 0 0-3-3.9 M16 4.2a3.5 3.5 0 0 1 0 6.6' },
  downloads: { d: 'M12 4v11 M7 11l5 5 5-5 M5 20h14' },
  trophy: { d: 'M8 4h8v6a4 4 0 0 1-8 0z M8 6H4v2a4 4 0 0 0 4 4 M16 6h4v2a4 4 0 0 1-4 4 M12 14v4 M8 20h8' },
  settings: { d: 'M4 7h10 M18 7h2 M4 17h2 M10 17h10 M14 5v4 M6 15v4' },
  search: { d: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4' },
  play: { d: 'M7 4v16l13-8z', fill: true },
  pause: { d: 'M7 5h3.5v14H7z M13.5 5H17v14h-3.5z', fill: true },
  star: { d: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.8l-5.3 2.8 1.1-5.8L3.5 9.7l5.9-.8z' },
  starFill: { d: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.8l-5.3 2.8 1.1-5.8L3.5 9.7l5.9-.8z', fill: true },
};

export function icon(name, size = 20) {
  const def = ICONS[name];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  if (def.fill) svg.setAttribute('fill', 'currentColor');
  else {
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
  }
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', def.d);
  svg.append(p);
  return svg;
}

// Logo officiel (assets/logo.svg) : anneau bleu et temple blanc (fronton, entablement, 4 colonnes, soubassement).
export function logoMark(size = 30) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('aria-hidden', 'true');
  const mk = (tag, attrs) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  const w = 'var(--text)';
  svg.append(
    mk('circle', { cx: 60, cy: 60, r: 54, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 6 }),
    mk('polygon', { points: '28,48 92,48 60,28', fill: w }),
    mk('rect', { x: 28, y: 51, width: 64, height: 5, fill: w }),
    ...[32, 48, 64, 80].map((x) => mk('rect', { x, y: 59, width: 8, height: 26, fill: w })),
    mk('rect', { x: 28, y: 88, width: 64, height: 4, fill: w }),
  );
  return svg;
}
