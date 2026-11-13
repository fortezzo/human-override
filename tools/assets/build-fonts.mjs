// Copies the interface fonts (SIL Open Font License) into the game.
import fs from 'node:fs';
import path from 'node:path';
import { DOWNLOAD_DIR } from './manifest.mjs';

const from = path.join(DOWNLOAD_DIR, 'fonts');
const to = 'public/assets/fonts';
fs.mkdirSync(to, { recursive: true });
let total = 0;
for (const file of fs.readdirSync(from)) {
  fs.copyFileSync(path.join(from, file), path.join(to, file));
  total += fs.statSync(path.join(to, file)).size;
}
console.log(`Fonts: ${fs.readdirSync(to).length} files, ${(total / 1024).toFixed(0)} KB`);
