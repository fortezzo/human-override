// Dev helper: loads the game in the headless browser and saves screenshots
// from chosen camera positions.
//
//   node tools/dev/shot.mjs outDir "name=x,y,z,yawDeg,pitchDeg[,fov]" ...
//
// Options (environment variables):
//   HO_URL      game address            (default http://localhost:5173)
//   HO_QUERY    extra query string      (for example "quality=low")
//   HO_EVAL     JavaScript to run in the page before shooting
//   SHOT_W / SHOT_H   picture size      (default 1600 x 900)
//
// Needs the dev server running (npm run dev).

import fs from 'node:fs';
import path from 'node:path';
import { gpuName, launch } from '../lib/browser.mjs';

const [outDir, ...views] = process.argv.slice(2);
const base = process.env.HO_URL ?? 'http://localhost:5173';
const query = process.env.HO_QUERY ? `&${process.env.HO_QUERY}` : '';
const width = Number(process.env.SHOT_W ?? 1600);
const height = Number(process.env.SHOT_H ?? 900);
fs.mkdirSync(outDir, { recursive: true });

const { browser, page } = await launch({ width, height });
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`[exception] ${e.message}`));
page.on('response', (r) => r.status() >= 400 && problems.push(`[http ${r.status()}] ${r.url()}`));

const started = Date.now();
await page.goto(`${base}/?debug=1${query}`);
try {
  await page.waitForFunction(() => window.__HO?.ready, null, { timeout: 90000 });
} catch {
  console.log('Game did not become ready.');
  console.log(problems.join('\n'));
  await page.screenshot({ path: path.join(outDir, '_failed.png') });
  await browser.close();
  process.exit(1);
}
console.log(`ready in ${((Date.now() - started) / 1000).toFixed(1)}s on ${await gpuName(page)}`);

await page.evaluate(() => window.__HO.freeze(true));
if (process.env.HO_EVAL) await page.evaluate(process.env.HO_EVAL);

for (const view of views) {
  const [name, spec] = view.split('=');
  const [x, y, z, yaw, pitch, fov] = spec.split(',').map(Number);
  await page.evaluate(
    ([x, y, z, yaw, pitch, fov]) => {
      window.__HO.view(x, y, z, yaw, pitch, fov || undefined);
      window.__HO.step(1 / 60, 30);
    },
    [x, y, z, yaw, pitch, fov ?? 0],
  );
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  const stats = await page.evaluate(() => window.__HO.stats());
  console.log(`${name}: ${stats.calls} draw calls, ${stats.triangles} triangles, quality ${stats.quality}`);
}

if (problems.length) console.log('Console problems:\n' + [...new Set(problems)].slice(0, 25).join('\n'));
await browser.close();
