// Downloads every third-party source asset listed in manifest.mjs into
// assets-source/_downloads. Files already on disk are skipped, so this is
// safe to re-run. Nothing downloaded here is committed to git.
//
//   node tools/assets/fetch.mjs            everything
//   node tools/assets/fetch.mjs models     one group (textures|models|hdris|acg|kenney|oga|fonts)

import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  AMBIENTCG,
  DOWNLOAD_DIR,
  FONTS,
  KENNEY,
  OPENGAMEART,
  POLYHAVEN_HDRIS,
  POLYHAVEN_MODELS,
  POLYHAVEN_TEXTURES,
  USER_AGENT,
} from './manifest.mjs';

const BROWSER_UA = 'Mozilla/5.0 (asset fetch script)';
const only = process.argv[2];
let failures = 0;

async function fetchRetry(url, init = {}, tries = 4) {
  let lastError;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...(init.headers || {}) } });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw lastError;
}

/** Download `url` to `dest` unless it already exists. */
async function download(url, dest, headers = {}) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.part';
  try {
    const res = await fetchRetry(url, { headers });
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
    fs.renameSync(tmp, dest);
    console.log(`  + ${path.relative(DOWNLOAD_DIR, dest)} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
    return true;
  } catch (err) {
    failures++;
    console.error(`  ! FAILED ${url}\n    ${err.message}`);
    if (fs.existsSync(tmp)) fs.rmSync(tmp);
    return false;
  }
}

async function polyhavenFiles(id) {
  const cache = path.join(DOWNLOAD_DIR, 'polyhaven', '_api', `${id}.json`);
  if (!fs.existsSync(cache)) {
    const res = await fetchRetry(`https://api.polyhaven.com/files/${id}`);
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, await res.text());
  }
  return JSON.parse(fs.readFileSync(cache, 'utf8'));
}

async function polyhavenInfo(id) {
  const cache = path.join(DOWNLOAD_DIR, 'polyhaven', '_api', `${id}.info.json`);
  if (!fs.existsSync(cache)) {
    const res = await fetchRetry(`https://api.polyhaven.com/info/${id}`);
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, await res.text());
  }
  return JSON.parse(fs.readFileSync(cache, 'utf8'));
}

async function fetchTextures() {
  console.log('Poly Haven textures');
  for (const { id, res } of POLYHAVEN_TEXTURES) {
    const files = await polyhavenFiles(id);
    await polyhavenInfo(id);
    for (const map of ['Diffuse', 'nor_gl', 'arm']) {
      const entry = files[map]?.[res]?.jpg;
      if (!entry) {
        failures++;
        console.error(`  ! ${id} has no ${map} at ${res}`);
        continue;
      }
      await download(entry.url, path.join(DOWNLOAD_DIR, 'polyhaven', 'textures', id, `${map}.jpg`));
    }
  }
}

async function fetchModels() {
  console.log('Poly Haven models');
  for (const { id } of POLYHAVEN_MODELS) {
    const files = await polyhavenFiles(id);
    await polyhavenInfo(id);
    const gltf = files.gltf?.['1k']?.gltf;
    if (!gltf) {
      failures++;
      console.error(`  ! ${id} has no 1k glTF`);
      continue;
    }
    const dir = path.join(DOWNLOAD_DIR, 'polyhaven', 'models', id);
    await download(gltf.url, path.join(dir, `${id}.gltf`));
    for (const [rel, inc] of Object.entries(gltf.include || {})) {
      await download(inc.url, path.join(dir, rel));
    }
  }
}

async function fetchHdris() {
  console.log('Poly Haven HDRIs');
  for (const { id, res } of POLYHAVEN_HDRIS) {
    const files = await polyhavenFiles(id);
    await polyhavenInfo(id);
    await download(files.hdri[res].hdr.url, path.join(DOWNLOAD_DIR, 'polyhaven', 'hdris', `${id}.hdr`));
  }
}

async function fetchAmbientCg() {
  console.log('ambientCG');
  for (const { id, res } of AMBIENTCG) {
    await download(`https://ambientcg.com/get?file=${id}_${res}-JPG.zip`, path.join(DOWNLOAD_DIR, 'ambientcg', `${id}.zip`));
  }
}

async function fetchKenney() {
  console.log('Kenney');
  for (const { slug } of KENNEY) {
    const dest = path.join(DOWNLOAD_DIR, 'kenney', `${slug}.zip`);
    if (fs.existsSync(dest)) continue;
    // Kenney's download button asks this endpoint for a short-lived link.
    const hexId = Buffer.from(`assets/${slug}`).toString('hex');
    try {
      const res = await fetchRetry(`https://kenney.nl/download-link/${hexId}`, {
        headers: { 'User-Agent': BROWSER_UA, Referer: `https://kenney.nl/assets/${slug}` },
      });
      const { url } = await res.json();
      await download(url, dest, { 'User-Agent': BROWSER_UA, Referer: `https://kenney.nl/assets/${slug}` });
    } catch (err) {
      failures++;
      console.error(`  ! Kenney ${slug}: ${err.message}\n    Download by hand: https://kenney.nl/assets/${slug}`);
    }
  }
}

async function fetchOpenGameArt() {
  console.log('OpenGameArt');
  for (const entry of OPENGAMEART) {
    const dir = path.join(DOWNLOAD_DIR, 'opengameart', entry.key);
    const marker = path.join(dir, '.done');
    if (fs.existsSync(marker)) continue;
    try {
      const html = await (await fetchRetry(entry.page, { headers: { 'User-Agent': BROWSER_UA } })).text();
      // Safety net: refuse anything whose page no longer shows the license we recorded.
      const licenses = [...html.matchAll(/class='license-name'>([^<]+)</g)].map((m) => m[1]);
      if (!licenses.includes(entry.license)) {
        failures++;
        console.error(`  ! ${entry.key}: page lists [${licenses}] but manifest says ${entry.license}. Skipped.`);
        continue;
      }
      const links = [...new Set([...html.matchAll(/href="(https:\/\/opengameart\.org\/sites\/default\/files\/[^"]+)"/g)].map((m) => m[1]))];
      let ok = true;
      for (const link of links) {
        const name = decodeURIComponent(link.split('/').pop());
        if (/\.(png|jpg|jpeg|gif)$/i.test(name)) continue;
        if (entry.files !== 'all' && !entry.files.includes(name)) continue;
        const dest = path.join(dir, name);
        if (!fs.existsSync(dest)) ok = (await download(link, dest, { 'User-Agent': BROWSER_UA })) && ok;
      }
      if (ok) fs.writeFileSync(marker, new Date().toISOString());
    } catch (err) {
      failures++;
      console.error(`  ! ${entry.key}: ${err.message}\n    Download by hand: ${entry.page}`);
    }
  }
}

async function fetchFonts() {
  console.log('Fonts');
  for (const font of FONTS) {
    const family = font.family.replace(/ /g, '+');
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family}:wght@${font.weights.join(';')}&display=swap`;
    try {
      // A browser user agent makes Google Fonts answer with WOFF2 files.
      const css = await (
        await fetchRetry(cssUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' },
        })
      ).text();
      // Keep only the basic Latin subset of each weight.
      const blocks = css.split('/* ').filter((b) => b.startsWith('latin */'));
      for (const block of blocks) {
        const weight = (block.match(/font-weight:\s*(\d+)/) || [])[1];
        const url = (block.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
        if (!url || !weight) continue;
        const name = `${font.family.replace(/ /g, '')}-${weight}.woff2`;
        await download(url, path.join(DOWNLOAD_DIR, 'fonts', name));
      }
    } catch (err) {
      failures++;
      console.error(`  ! font ${font.family}: ${err.message}\n    Download by hand: ${font.page}`);
    }
  }
}

const groups = {
  textures: fetchTextures,
  models: fetchModels,
  hdris: fetchHdris,
  acg: fetchAmbientCg,
  kenney: fetchKenney,
  oga: fetchOpenGameArt,
  fonts: fetchFonts,
};

for (const [name, run] of Object.entries(groups)) {
  if (only && only !== name) continue;
  await run();
}

console.log(failures ? `\nFinished with ${failures} failure(s).` : '\nAll source assets are present.');
process.exit(failures ? 1 : 0);
