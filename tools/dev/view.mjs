// Dev helper: photographs a converted model from several angles and tiles the
// shots into one image.
//
//   node tools/dev/view.mjs out.png assets/models/robot.glb "az=0&el=5" "az=90" "az=180&anim=walk&t=1"
//
// Needs the dev server running (npm run dev).

import sharp from 'sharp';
import { launch } from '../lib/browser.mjs';

const [out, modelArg, ...views] = process.argv.slice(2);
// Accept "assets/x.glb" as well as "/assets/x.glb" (Git Bash rewrites leading slashes).
const model = modelArg.startsWith("/") ? modelArg : `/${modelArg}`;
const base = process.env.HO_URL ?? 'http://localhost:5173';
const W = Number(process.env.VIEW_W ?? 640);
const H = Number(process.env.VIEW_H ?? 640);
const { browser, page } = await launch({ width: W, height: H });
page.on('console', (m) => m.type() === 'error' && console.log('[page error]', m.text()));
page.on('pageerror', (e) => console.log('[page exception]', e.message));

const shots = [];
for (const view of views.length ? views : ['az=30&el=15']) {
  await page.goto(`${base}/tools/viewer/index.html?m=${encodeURIComponent(model)}&${view}`);
  await page.waitForFunction(() => window.__viewer?.ready, null, { timeout: 30000 });
  const info = await page.evaluate(() => window.__viewer);
  if (info.error) console.log('viewer error:', info.error);
  else if (shots.length === 0) console.log(JSON.stringify(info));
  shots.push(await page.screenshot());
}
await browser.close();

const cols = Math.min(shots.length, Number(process.env.VIEW_COLS ?? 4));
const rows = Math.ceil(shots.length / cols);
await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: '#000' } })
  .composite(shots.map((input, i) => ({ input, left: (i % cols) * W, top: Math.floor(i / cols) * H })))
  .png()
  .toFile(out);
console.log('wrote', out);
