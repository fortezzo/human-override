// Dev helper: downloads Poly Haven thumbnails for a list of asset ids and
// tiles them into one labelled contact sheet so assets can be compared at a
// glance before anything is downloaded at full size.
//
//   node tools/dev/contact-sheet.mjs out.png id1 id2 id3 ...

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [out, ...ids] = process.argv.slice(2);
const CELL = 200;
const LABEL = 22;
const COLS = Math.min(8, ids.length);
const cacheDir = '.cache/polyhaven/thumbs';
fs.mkdirSync(cacheDir, { recursive: true });

async function thumb(id) {
  const file = path.join(cacheDir, `${id}.png`);
  if (!fs.existsSync(file)) {
    const res = await fetch(`https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=${CELL}&height=${CELL}`, {
      headers: { 'User-Agent': 'asset-fetch-script/1.0' },
    });
    if (!res.ok) return null;
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}

const composites = [];
for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  const file = await thumb(id);
  const left = (i % COLS) * CELL;
  const top = Math.floor(i / COLS) * (CELL + LABEL);
  if (file) {
    const buf = await sharp(file).resize(CELL, CELL, { fit: 'contain', background: '#2a2a2a' }).png().toBuffer();
    composites.push({ input: buf, left, top });
  }
  const svg = `<svg width="${CELL}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/><text x="4" y="15" font-family="Arial" font-size="12" fill="#fff">${id.slice(0, 30)}</text></svg>`;
  composites.push({ input: Buffer.from(svg), left, top: top + CELL });
}

const rows = Math.ceil(ids.length / COLS);
await sharp({ create: { width: COLS * CELL, height: rows * (CELL + LABEL), channels: 3, background: '#2a2a2a' } })
  .composite(composites)
  .png()
  .toFile(out);
console.log(`wrote ${out} (${ids.length} assets)`);
