// Unpacks every downloaded sound archive into assets-source/_work/audio/<pack>/
// so build-audio.mjs can cut individual sounds out of them.
//
//   node tools/assets/lib/extract-audio.mjs     (or imported by build-audio.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { unzipSync } from 'fflate';

const require = createRequire(import.meta.url);
const sevenZip = require('7zip-bin').path7za;
const SRC = 'assets-source/_downloads';
const OUT = 'assets-source/_work/audio';

function extract(file, dest) {
  const archive = file.endsWith('.zip') || file.endsWith('.7z');
  if (archive && fs.existsSync(dest)) return;
  fs.mkdirSync(dest, { recursive: true });
  if (file.endsWith('.zip')) {
    const entries = unzipSync(fs.readFileSync(file));
    for (const [name, data] of Object.entries(entries)) {
      if (name.endsWith('/')) continue;
      const target = path.join(dest, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
    }
  } else if (file.endsWith('.7z')) {
    execFileSync(sevenZip, ['x', file, `-o${dest}`, '-y'], { stdio: 'pipe' });
  } else {
    fs.copyFileSync(file, path.join(dest, path.basename(file)));
  }
}

export function extractAudioSources() {
 for (const group of ['opengameart', 'kenney']) {
  const root = path.join(SRC, group);
  for (const entry of fs.readdirSync(root)) {
    const full = path.join(root, entry);
    if (fs.statSync(full).isDirectory()) {
      for (const file of fs.readdirSync(full)) {
        if (file.startsWith('.')) continue;
        extract(path.join(full, file), path.join(OUT, entry));
      }
    } else {
      extract(full, path.join(OUT, entry.replace(/\.zip$/, '')));
    }
  }
}
 return OUT;
}

if (process.argv[1] && process.argv[1].endsWith('extract-audio.mjs')) console.log('extracted to', extractAudioSources());
