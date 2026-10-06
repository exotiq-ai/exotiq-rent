// MP-18: derives the Drive Exotiq icon set from the design-system emblem WITHOUT redrawing it.
//
//   node scripts/brand-icons.mjs        (from the exotiq-rent repo root)
//
// Source: public/images/logos/drive-exotiq-emblem-white.svg, a byte-for-byte copy of the brand
// book's drive-exotiq-design-system/assets/emblem-white.svg (sha256 pinned in
// domain/booking/brandAssets.test.ts). If the brand review changes the mark: replace that copy,
// update the pinned sha, re-run this script, commit the outputs.
//
// Writes: app/favicon.ico (16/32/48 PNG payloads), app/apple-icon.png (180, opaque RGB),
// public/icon-192.png and public/icon-512.png (opaque RGB), app/icon.svg (the emblem's path data
// verbatim on a full-bleed ground). Every tile: the white emblem centred on #06070a.
// Needs no dependency: next/og (satori + resvg, bundled with next) rasterizes; node:zlib strips
// the alpha channel and writes the PNG/ICO containers (zlib.crc32 needs Node >= 22.2).
import { createRequire } from 'node:module';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const GROUND_HEX = '#06070a'; // tone.ground (components/browse/tokens.ts); asserted by brandAssets.test.ts
const EMBLEM = { w: 1200, h: 703, file: 'public/images/logos/drive-exotiq-emblem-white.svg' };
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** The emblem's share of the tile width. AC1: >= 0.70 at <= 48 px, >= 0.56 above; the margin absorbs anti-aliasing. */
export const fraction = (px) => (px <= 48 ? 0.76 : 0.62);

function chunks(png) {
  const out = [];
  for (let o = 8; o < png.length; ) {
    const len = png.readUInt32BE(o);
    out.push({ type: png.toString('latin1', o + 4, o + 8), data: png.subarray(o + 8, o + 8 + len) });
    o += 12 + len;
  }
  return out;
}

/** 8-bit RGB (colour type 2) or RGBA (6), non-interlaced, unfiltered into raw pixels. */
function decodePng(png) {
  const cs = chunks(png);
  const ih = cs.find((c) => c.type === 'IHDR').data;
  const w = ih.readUInt32BE(0), h = ih.readUInt32BE(4), depth = ih[8], ct = ih[9];
  if (depth !== 8 || ![2, 6].includes(ct) || ih[12] !== 0) throw new Error('unsupported png');
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp;
  const raw = inflateSync(Buffer.concat(cs.filter((c) => c.type === 'IDAT').map((c) => c.data)));
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = raw[y * (stride + 1) + 1 + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, ct, px };
}

const chunk = (type, data) => {
  const t = Buffer.from(type, 'latin1'), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0);
  return Buffer.concat([len, t, data, crc]);
};

/** RGBA -> RGB (colour type 2). Refuses any non-opaque pixel: the tiles are full-bleed by construction. */
export function flattenToRgb(png) {
  const d = decodePng(png);
  if (d.ct === 2) return png;
  const rgb = Buffer.alloc(d.w * d.h * 3);
  for (let i = 0; i < d.w * d.h; i++) {
    if (d.px[i * 4 + 3] !== 255) throw new Error(`non-opaque pixel at ${i % d.w},${Math.floor(i / d.w)}`);
    d.px.copy(rgb, i * 3, i * 4, i * 4 + 3);
  }
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(d.w, 0); ih.writeUInt32BE(d.h, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc(d.h * (d.w * 3 + 1));
  for (let y = 0; y < d.h; y++) rgb.copy(raw, y * (d.w * 3 + 1) + 1, y * d.w * 3, (y + 1) * d.w * 3);
  return Buffer.concat([SIG, chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** An ICO container holding PNG payloads: [{ size, png }]. */
export function buildIco(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let off = 6 + 16 * images.length;
  const dir = images.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e[0] = e[1] = size === 256 ? 0 : size;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(off, 12);
    off += png.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...images.map((i) => i.png)]);
}

async function renderTile(px, emblemSvg) {
  const { ImageResponse } = createRequire(import.meta.url)('next/og');
  const w = Math.round(px * fraction(px)), h = Math.round((w * EMBLEM.h) / EMBLEM.w);
  const src = `data:image/svg+xml;base64,${emblemSvg.toString('base64')}`;
  const el = {
    type: 'div',
    props: {
      style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: GROUND_HEX },
      children: { type: 'img', props: { src, width: w, height: h } },
    },
  };
  return Buffer.from(await new ImageResponse(el, { width: px, height: px }).arrayBuffer());
}

export async function main() {
  const emblemSvg = readFileSync(EMBLEM.file);
  const png = Object.fromEntries(await Promise.all([16, 32, 48, 180, 192, 512].map(async (px) => [px, await renderTile(px, emblemSvg)])));
  writeFileSync('app/favicon.ico', buildIco([16, 32, 48].map((size) => ({ size, png: png[size] }))));
  writeFileSync('app/apple-icon.png', flattenToRgb(png[180]));
  writeFileSync('public/icon-192.png', flattenToRgb(png[192]));
  writeFileSync('public/icon-512.png', flattenToRgb(png[512]));
  // The vector icon: the emblem's path data untouched, scaled and centred on the ground.
  const d = /\sd="([^"]+)"/.exec(emblemSvg.toString('utf8'))[1];
  const s = fraction(16), tx = (1200 - EMBLEM.w * s) / 2, ty = (1200 - EMBLEM.h * s) / 2;
  writeFileSync(
    'app/icon.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" width="1200" height="1200">\n<rect width="1200" height="1200" fill="${GROUND_HEX}"/>\n<g transform="translate(${+tx.toFixed(2)} ${+ty.toFixed(2)}) scale(${s})">\n<path d="${d}" fill="#ffffff"/>\n</g>\n</svg>\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
