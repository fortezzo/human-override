// Converts the downloaded surface materials into three small WebP files each:
//
//   <id>_color.webp   base color (with alpha for decals)
//   <id>_normal.webp  OpenGL-style normal map
//   <id>_orm.webp     R = ambient occlusion, G = roughness, B = metalness
//
// Packing AO/roughness/metalness into one image is the layout three.js
// expects, and it cuts the number of texture downloads by a third.
// Normal maps are capped at 1024 px (they are the heaviest files and the
// extra resolution is not visible in a dark scene), and decals ship as a
// single color+alpha image.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { unzipSync } from 'fflate';
import { AMBIENTCG, DOWNLOAD_DIR, POLYHAVEN_TEXTURES } from './manifest.mjs';

const OUT_DIR = 'public/assets/textures';
fs.mkdirSync(OUT_DIR, { recursive: true });

const COLOR = { quality: 80, effort: 6 };
const NORMAL = { quality: 84, effort: 6, smartSubsample: true };
const NORMAL_MAX = 1024;
const ORM = { quality: 78, effort: 6 };

function report(id) {
  const sizes = ['color', 'normal', 'orm'].map((m) => {
    const f = path.join(OUT_DIR, `${id}_${m}.webp`);
    return fs.existsSync(f) ? `${m} ${(fs.statSync(f).size / 1024).toFixed(0)}K` : `${m} -`;
  });
  console.log(`  ${id}: ${sizes.join(', ')}`);
}

async function grey(buffer, size) {
  return sharp(buffer).resize(size, size).greyscale().raw().toBuffer();
}

console.log('Poly Haven surfaces');
for (const { id, out } of POLYHAVEN_TEXTURES) {
  const dir = path.join(DOWNLOAD_DIR, 'polyhaven', 'textures', id);
  await sharp(path.join(dir, 'Diffuse.jpg')).resize(out, out).webp(COLOR).toFile(path.join(OUT_DIR, `${id}_color.webp`));
  const n = Math.min(out, NORMAL_MAX);
  await sharp(path.join(dir, 'nor_gl.jpg')).resize(n, n).webp(NORMAL).toFile(path.join(OUT_DIR, `${id}_normal.webp`));
  // Poly Haven's "arm" map is already AO/roughness/metalness in R/G/B.
  await sharp(path.join(dir, 'arm.jpg')).resize(out, out).webp(ORM).toFile(path.join(OUT_DIR, `${id}_orm.webp`));
  report(id);
}

console.log('ambientCG surfaces');
for (const { id, res, out, decal } of AMBIENTCG) {
  const zip = unzipSync(fs.readFileSync(path.join(DOWNLOAD_DIR, 'ambientcg', `${id}.zip`)));
  const map = (name) => {
    const entry = zip[`${id}_${res}-JPG_${name}.jpg`];
    return entry ? Buffer.from(entry) : null;
  };

  const color = map('Color');
  const opacity = map('Opacity');
  if (decal && opacity) {
    const rgb = await sharp(color).resize(out, out).removeAlpha().raw().toBuffer();
    const alpha = await grey(opacity, out);
    const rgba = Buffer.alloc(out * out * 4);
    for (let i = 0; i < out * out; i++) {
      rgba[i * 4] = rgb[i * 3];
      rgba[i * 4 + 1] = rgb[i * 3 + 1];
      rgba[i * 4 + 2] = rgb[i * 3 + 2];
      rgba[i * 4 + 3] = alpha[i];
    }
    await sharp(rgba, { raw: { width: out, height: out, channels: 4 } })
      .webp({ ...COLOR, alphaQuality: 85 })
      .toFile(path.join(OUT_DIR, `${id}_color.webp`));
  } else {
    await sharp(color).resize(out, out).webp(COLOR).toFile(path.join(OUT_DIR, `${id}_color.webp`));
  }

  if (decal) {
    report(id);
    continue;
  }

  await sharp(map('NormalGL')).resize(out, out).webp(NORMAL).toFile(path.join(OUT_DIR, `${id}_normal.webp`));

  const ao = map('AmbientOcclusion');
  const rough = map('Roughness');
  const metal = map('Metalness');
  const aoRaw = ao ? await grey(ao, out) : null;
  const roughRaw = rough ? await grey(rough, out) : null;
  const metalRaw = metal ? await grey(metal, out) : null;
  const orm = Buffer.alloc(out * out * 3);
  for (let i = 0; i < out * out; i++) {
    orm[i * 3] = aoRaw ? aoRaw[i] : 255;
    orm[i * 3 + 1] = roughRaw ? roughRaw[i] : 200;
    orm[i * 3 + 2] = metalRaw ? metalRaw[i] : 0;
  }
  await sharp(orm, { raw: { width: out, height: out, channels: 3 } }).webp(ORM).toFile(path.join(OUT_DIR, `${id}_orm.webp`));
  report(id);
}

const total = fs.readdirSync(OUT_DIR).reduce((sum, f) => sum + fs.statSync(path.join(OUT_DIR, f)).size, 0);
console.log(`Textures total: ${(total / 1024 / 1024).toFixed(2)} MB`);
