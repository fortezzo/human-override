// Verifies the licensing rules the project promises:
//
//   1. every asset file shipped in public/assets traces back to an entry in
//      the asset manifest (and therefore to a line in CREDITS.md)
//   2. CREDITS.md names every one of those sources
//   3. no raw source downloads (Mixamo FBX files and the like) are tracked by git
//
//   npm run check:credits

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { AUDIO_SPEC } from './assets/audio-spec.mjs';
import { AMBIENTCG, FONTS, KENNEY, OPENGAMEART, POLYHAVEN_HDRIS, POLYHAVEN_MODELS, POLYHAVEN_TEXTURES, SKETCHFAB } from './assets/manifest.mjs';

const problems = [];
const credits = fs.readFileSync('CREDITS.md', 'utf8');
const needCredit = (text, what) => {
  if (!credits.includes(text)) problems.push(`CREDITS.md does not mention ${what} (${text})`);
};
const list = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []);

// ---- Props
const propIds = new Set(POLYHAVEN_MODELS.map((m) => m.id));
for (const file of list('public/assets/models/props')) {
  const id = file.replace(/\.glb$/, '');
  if (!propIds.has(id)) problems.push(`Prop model ${file} is not in the manifest`);
}
for (const id of propIds) needCredit(`polyhaven.com/a/${id}`, `prop ${id}`);

// ---- Character and weapons
const models = list('public/assets/models').filter((f) => f.endsWith('.glb'));
const shippedGuns = SKETCHFAB.filter((g) => g.shipped);
for (const file of models) {
  const id = file.replace(/\.glb$/, '');
  if (id === 'robot') needCredit('Mixamo', 'the robot character');
  else if (!shippedGuns.some((g) => g.key === id)) problems.push(`Model ${file} has no manifest entry marked as shipped`);
}
for (const gun of shippedGuns) needCredit(gun.page, `weapon ${gun.title}`);

// The project owner keeps the gun pages in assets-source/guns/links.txt.
// That folder is not in the repository, so this only runs where it exists.
const ownerLinks = 'assets-source/guns/links.txt';
if (fs.existsSync(ownerLinks)) {
  const links = fs.readFileSync(ownerLinks, 'utf8').match(/https?:\/\/\S+/g) ?? [];
  const pages = new Set(SKETCHFAB.map((g) => g.page));
  for (const link of links) {
    if (!pages.has(link)) problems.push(`links.txt has a page the manifest does not credit: ${link}`);
  }
  for (const gun of SKETCHFAB) {
    if (!links.includes(gun.page)) problems.push(`The manifest credits a page that is not in links.txt: ${gun.page}`);
  }
}

// ---- Surface textures, decals and sky
const textureIds = new Set([...POLYHAVEN_TEXTURES.map((t) => t.id), ...AMBIENTCG.map((t) => t.id)]);
for (const file of list('public/assets/textures')) {
  const id = file.replace(/_(color|normal|orm)\.webp$/, '');
  if (!textureIds.has(id)) problems.push(`Texture ${file} is not in the manifest`);
}
for (const t of POLYHAVEN_TEXTURES) needCredit(`polyhaven.com/a/${t.id}`, `texture ${t.id}`);
for (const t of AMBIENTCG) needCredit(`ambientcg.com/a/${t.id}`, `texture ${t.id}`);
for (const h of POLYHAVEN_HDRIS) needCredit(`polyhaven.com/a/${h.id}`, `sky ${h.id}`);

// ---- Sounds
const soundNames = new Set(AUDIO_SPEC.map((s) => `${s.name}.mp3`));
for (const file of list('public/assets/audio')) {
  if (!soundNames.has(file)) problems.push(`Sound ${file} is not in the audio spec`);
}
const packs = new Map([...OPENGAMEART.map((o) => [o.key, o.page]), ...KENNEY.map((k) => [k.slug, `kenney.nl/assets/${k.slug}`])]);
for (const pack of new Set(AUDIO_SPEC.flatMap((s) => s.layers.map((l) => l.pack)))) {
  if (!packs.has(pack)) problems.push(`Sound pack "${pack}" is used but not in the manifest`);
  else needCredit(packs.get(pack), `sound pack ${pack}`);
}

// ---- Fonts
for (const file of list('public/assets/fonts')) {
  if (!FONTS.some((f) => file.startsWith(f.family.replace(/ /g, '')))) problems.push(`Font ${file} is not in the manifest`);
}
for (const font of FONTS) needCredit(font.page, `font ${font.family}`);

// ---- Only CC0 / CC-BY licenses for sounds and models in the manifest
for (const entry of [...OPENGAMEART, ...SKETCHFAB]) {
  if (!/^(CC0|CC-BY \d\.\d)$/.test(entry.license)) problems.push(`${entry.title} has a license outside CC0 / CC-BY: ${entry.license}`);
}
const body = credits.replace('Nothing here is NonCommercial or NoDerivatives', '');
if (/NonCommercial|NoDerivs|NoDerivatives|CC-BY-NC|CC-BY-ND|CC-BY-SA/i.test(body)) {
  problems.push('CREDITS.md mentions a NonCommercial, NoDerivatives or ShareAlike license');
}

// ---- Nothing raw in git
let tracked = [];
try {
  tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
} catch {
  problems.push('Could not list git files (is this a git repository?)');
}
for (const file of tracked) {
  if (/^assets-source\//.test(file)) problems.push(`Raw source file is tracked by git: ${file}`);
  if (/\.(fbx|blend|obj|rar|7z|zip|tga|psd)$/i.test(file)) problems.push(`Raw asset format is tracked by git: ${file}`);
}

const shipped = list('public/assets/models/props').length + models.length + list('public/assets/textures').length + list('public/assets/audio').length + list('public/assets/fonts').length + 1;
if (problems.length) {
  console.log(`Credits check FAILED:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`Credits check passed: ${shipped} shipped asset files all trace to credited sources; ${tracked.length} files tracked by git, none of them raw downloads.`);
