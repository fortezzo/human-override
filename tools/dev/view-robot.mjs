// Dev helper: photographs the robot in the studio viewer from several
// angles and poses and tiles the shots into one image.
//
//   node tools/dev/view-robot.mjs out.jpg "az=0" "az=90" "az=30&anim=walk&t=1.2" ...
//
// Options: VIEW_W / VIEW_H (tile size), VIEW_COLS. Needs "npm run dev" running.

import sharp from 'sharp';
import { launch } from '../lib/browser.mjs';

const [out, ...views] = process.argv.slice(2);
const base = process.env.HO_URL ?? 'http://localhost:5173';
const W = Number(process.env.VIEW_W ?? 560);
const H = Number(process.env.VIEW_H ?? 760);
const { browser, page } = await launch({ width: W, height: H });
page.on('console', (m) => m.type() === 'error' && console.log('[page error]', m.text().slice(0, 400)));
page.on('pageerror', (e) => console.log('[page exception]', e.message));

const shots = [];
for (const view of views.length ? views : ['az=25']) {
  await page.goto(`${base}/tools/dev/viewer/robot.html?${view}`);
  await page.waitForFunction(() => window.__viewer?.ready, null, { timeout: 60000 });
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
  .jpeg({ quality: 88 })
  .toFile(out);
console.log('wrote', out);
