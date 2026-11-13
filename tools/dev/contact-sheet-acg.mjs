// Dev helper: same idea as contact-sheet.mjs but for ambientCG asset ids.
//   node tools/dev/contact-sheet-acg.mjs out.png Id1 Id2 ...
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [out, ...ids] = process.argv.slice(2);
const CELL = 180;
const LABEL = 22;
const COLS = Math.min(9, ids.length);
const cacheDir = '.cache/ambientcg/thumbs';
fs.mkdirSync(cacheDir, { recursive: true });

async function thumb(id) {
  const file = path.join(cacheDir, `${id}.png`);
  if (!fs.existsSync(file)) {
    const res = await fetch(`https://acg-media.struffelproductions.com/file/ambientCG-Web/media/thumbnail/256-PNG/${id}.png`, {
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
    const buf = await sharp(file).resize(CELL, CELL, { fit: 'contain', background: '#3a3a3a' }).flatten({ background: '#3a3a3a' }).png().toBuffer();
    composites.push({ input: buf, left, top });
  }
  const svg = `<svg width="${CELL}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/><text x="4" y="15" font-family="Arial" font-size="12" fill="#fff">${id}</text></svg>`;
  composites.push({ input: Buffer.from(svg), left, top: top + CELL });
}
const rows = Math.ceil(ids.length / COLS);
await sharp({ create: { width: COLS * CELL, height: rows * (CELL + LABEL), channels: 3, background: '#3a3a3a' } })
  .composite(composites)
  .png()
  .toFile(out);
console.log(`wrote ${out} (${ids.length} assets)`);
