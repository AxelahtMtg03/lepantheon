'use strict';
// Génère build/icon.png (512 px) et build/icon.ico (PNG 16 à 256 px) : logo « oculus percé » (temple blanc dans un anneau bleu).
// Aucune dépendance : PNG écrit à la main avec zlib. Usage : node scripts/make-icon.js
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const BG = [0x0b, 0x0d, 0x12];
const ACCENT = [0x4d, 0x8d, 0xff];
const WHITE = [0xf4, 0xf6, 0xfb];
const SS = 4; // suréchantillonnage pour lisser les bords

// Logo « oculus percé » : anneau bleu autour d'un temple blanc dont le fronton est percé d'un trou rond.
// Coordonnées du logo sur une grille de 100 ; le temple est dessiné sur sa propre grille puis réduit.
const K = 0.74; // taille du temple par rapport à l'anneau
function logoColor(u, v) {
  const d = Math.hypot(u - 50, v - 50);
  if (Math.abs(d - 46) <= 2.3) return ACCENT;
  const x = (u - 50) / K + 50;
  const y = (v - 50) / K + 50;
  // fronton (triangle) avec oculus
  if (y >= 22 && y <= 40 && Math.abs(x - 50) <= ((y - 22) / 18) * 34) return Math.hypot(x - 50, y - 34) <= 3.4 ? BG : WHITE;
  if (x >= 16 && x <= 84 && y >= 42 && y <= 46) return WHITE; // entablement
  if (y >= 48 && y <= 68 && [22, 36, 50, 64, 78].some((c) => Math.abs(x - c) <= 3)) return WHITE; // colonnes
  if (x >= 14 && x <= 86 && y >= 70 && y <= 74) return WHITE; // marche haute
  if (x >= 10 && x <= 90 && y >= 76 && y <= 80) return WHITE; // marche basse
  return BG;
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const radius = size * 0.22; // coins arrondis
  const scale = 0.8; // part de l'icône occupée par le logo
  const roundedSquare = (x, y) => {
    const dx = Math.max(Math.abs(x - c) - (c - radius), 0);
    const dy = Math.max(Math.abs(y - c) - (c - radius), 0);
    return dx * dx + dy * dy <= radius * radius;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0, r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS;
          const fy = y + (sy + 0.5) / SS;
          if (!roundedSquare(fx, fy)) continue;
          const col = logoColor(((fx / size - 0.5) / scale) * 100 + 50, ((fy / size - 0.5) / scale) * 100 + 50);
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
fs.writeFileSync(path.join(out, 'icon.ico'), ico([16, 32, 48, 64, 128, 256]));
console.log('Icônes écrites dans build/');
