'use strict';
// Génère build/icon.png (512 px) et build/icon.ico (PNG de 16 à 256 px) d'après assets/icon.svg :
// carré sombre arrondi avec bordure, anneau bleu et temple blanc (fronton, entablement, 4 colonnes, soubassement).
// Aucune dépendance : le dessin est recalculé ici à partir des mêmes coordonnées que le SVG, et le PNG est écrit avec zlib.
// Usage : node scripts/make-icon.js
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const BG = [0x0b, 0x0d, 0x12];
const BORDER = [0x2a, 0x32, 0x43];
const ACCENT = [0x4d, 0x8d, 0xff];
const TEMPLE = [0xe9, 0xec, 0xf3];
const SS = 4; // suréchantillonnage pour lisser les bords

// Logo sur la grille 120 x 120 de assets/logo.svg ; null = fond.
function logoColor(x, y) {
  if (Math.abs(Math.hypot(x - 60, y - 60) - 54) <= 3) return ACCENT; // anneau (rayon 54, trait 6)
  if (y >= 28 && y <= 48 && Math.abs(x - 60) <= ((y - 28) / 20) * 32) return TEMPLE; // fronton
  if (x >= 28 && x <= 92 && y >= 51 && y <= 56) return TEMPLE; // entablement
  if (y >= 59 && y <= 85 && [32, 48, 64, 80].some((c) => x >= c && x <= c + 8)) return TEMPLE; // colonnes
  if (x >= 28 && x <= 92 && y >= 88 && y <= 92) return TEMPLE; // soubassement
  return null;
}

// Carré arrondi de l'icône (grille 512) : distance signée au bord (négative à l'intérieur).
function roundedSquareDistance(x, y) {
  const qx = Math.abs(x - 256) - (248 - 112);
  const qy = Math.abs(y - 256) - (248 - 112);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 112;
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0, r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = ((x + (sx + 0.5) / SS) / size) * 512;
          const fy = ((y + (sy + 0.5) / SS) / size) * 512;
          const d = roundedSquareDistance(fx, fy);
          if (d > 2) continue; // hors de l'icône : transparent
          const col = d >= -2 ? BORDER : logoColor((fx - 106) / 2.5, (fy - 106) / 2.5) || BG;
          a++; r += col[0]; g += col[1]; b += col[2];
        }
      }
      const i = (y * size + x) * 4;
      if (a) { px[i] = r / a; px[i + 1] = g / a; px[i + 2] = b / a; }
      px[i + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return px;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const raw = render(size);
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0;
    raw.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ICO : en-tête + une entrée par taille, images PNG intégrées (accepté par Windows Vista et suivants).
function ico(sizes) {
  const images = sizes.map((s) => png(s));
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  sizes.forEach((s, i) => {
    const e = 6 + 16 * i;
    head[e] = s >= 256 ? 0 : s;
    head[e + 1] = s >= 256 ? 0 : s;
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(images[i].length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += images[i].length;
  });
  return Buffer.concat([head, ...images]);
}

const out = path.join(__dirname, '..', 'build');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon.png'), png(512));
fs.writeFileSync(path.join(out, 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256]));
console.log('Icônes écrites dans build/');
