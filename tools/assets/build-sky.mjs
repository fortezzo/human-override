// Converts the night-sky HDRI into a small ordinary image for the backdrop
// seen through the breach and windows: public/assets/env/night_sky.webp
//
// The room is lit by its own lights and reflection probe, so the sky only
// has to look right, not carry lighting data. That lets it ship as a
// ~100 KB WebP instead of a multi-megabyte HDR file.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { DOWNLOAD_DIR, POLYHAVEN_HDRIS } from './manifest.mjs';

const OUT = 'public/assets/env/night_sky.webp';
const OUT_WIDTH = 2048;

/** Reads a Radiance .hdr file into linear float RGB. */
function readHdr(file) {
  const data = fs.readFileSync(file);
  let offset = 0;
  const readLine = () => {
    const end = data.indexOf(0x0a, offset);
    const line = data.toString('latin1', offset, end);
    offset = end + 1;
    return line;
  };
  while (readLine() !== '') {
    // skip header lines up to the blank line
  }
  const size = readLine().match(/-Y (\d+) \+X (\d+)/);
  if (!size) throw new Error('Unsupported HDR orientation');
  const height = Number(size[1]);
  const width = Number(size[2]);
  const rgb = new Float32Array(width * height * 3);
  const scan = new Uint8Array(width * 4);

  for (let y = 0; y < height; y++) {
    if (data[offset] !== 2 || data[offset + 1] !== 2) throw new Error('Only run-length encoded HDR files are supported');
    offset += 4;
    for (let channel = 0; channel < 4; channel++) {
      let x = 0;
      while (x < width) {
        let count = data[offset++];
        if (count > 128) {
          count -= 128;
          const value = data[offset++];
          for (let i = 0; i < count; i++) scan[(x++) * 4 + channel] = value;
        } else {
          for (let i = 0; i < count; i++) scan[(x++) * 4 + channel] = data[offset++];
        }
      }
    }
    for (let x = 0; x < width; x++) {
      const e = scan[x * 4 + 3];
      const scale = e ? Math.pow(2, e - 136) : 0;
      const o = (y * width + x) * 3;
      rgb[o] = scan[x * 4] * scale;
      rgb[o + 1] = scan[x * 4 + 1] * scale;
      rgb[o + 2] = scan[x * 4 + 2] * scale;
    }
  }
  return { width, height, rgb };
}

const { id } = POLYHAVEN_HDRIS[0];
const { width, height, rgb } = readHdr(path.join(DOWNLOAD_DIR, 'polyhaven', 'hdris', `${id}.hdr`));

// Expose so the 98th-percentile brightness lands near the top of the range.
const luminances = [];
for (let i = 0; i < rgb.length; i += 3 * 7) luminances.push(0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2]);
luminances.sort((a, b) => a - b);
const exposure = 1.1 / Math.max(luminances[Math.floor(luminances.length * 0.98)], 1e-6);

const pixels = Buffer.alloc(width * height * 3);
for (let i = 0; i < rgb.length; i++) {
  const v = 1 - Math.exp(-rgb[i] * exposure); // soft roll-off for bright lights
  pixels[i] = Math.round(255 * Math.pow(v, 1 / 2.2));
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await sharp(pixels, { raw: { width, height, channels: 3 } })
  .resize(OUT_WIDTH, OUT_WIDTH / 2)
  .webp({ quality: 78, effort: 6 })
  .toFile(OUT);
console.log(`Sky: ${id} ${width}x${height} -> ${OUT} ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB (exposure x${exposure.toFixed(1)})`);
