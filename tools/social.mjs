// Makes what a shared link needs, from the game itself:
//
//   public/social-preview.jpg    the picture LinkedIn, Slack and the rest show with the link (1200 x 630)
//   public/favicon.png           the browser tab's icon, for browsers that do not take the SVG one
//   public/apple-touch-icon.png  the icon a phone uses for a bookmark on its home screen
//
//   npm run build && npm run social
//
// The preview is not a made-up poster. It is the game's own start screen,
// photographed: a horde in the lobby under the title, with the buttons and
// the controls card (which mean nothing in a picture) left out.

import fs from 'node:fs';
import sharp from 'sharp';
import { launch } from './lib/browser.mjs';
import { serve } from './lib/static-server.mjs';

if (!fs.existsSync('dist/index.html')) {
  console.error('No production build found. Run "npm run build" first.');
  process.exit(1);
}

// ---- Icons, from the one drawing.
const icon = fs.readFileSync('public/favicon.svg');
await sharp(icon, { density: 300 }).resize(64, 64).png().toFile('public/favicon.png');
// (A phone rounds the corners itself, and wants no transparency: the drawing on a square of the page's own black.)
await sharp(icon, { density: 600 })
  .resize(148, 148)
  .extend({ top: 16, bottom: 16, left: 16, right: 16, background: '#050607' })
  .flatten({ background: '#050607' })
  .png()
  .toFile('public/apple-touch-icon.png');
console.log('public/favicon.png, public/apple-touch-icon.png');

// ---- The preview picture.
const site = await serve('dist', '/');
const { browser, page } = await launch({ width: 1200, height: 630 });
page.on('pageerror', (e) => console.log('exception:', e.message));
await page.goto(`${site.url}?debug=1`);
await page.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
await page.evaluate(() => {
  const ho = window.__HO;
  ho.randomDrops(false);
  ho.hints(false);
  ho.freeze(true);
  ho.steadyLights(true);
  // A round's worth of robots in the lobby, coming on from the entrance, and the camera low in front of them.
  ho.play();
  ho.step(1 / 60, 5);
  ho.god(true);
  ho.holdRounds(true);
  ho.clearRobots();
  ho.setShutter(false, 'yard');
  // (The camera first, and time for the lamps round it to come up; then the robots, caught a few strides in.)
  ho.place(0.4, 3.4, 0, 0);
  ho.game.hideWeapon = true;
  ho.view(0.7, 0.78, 3.6, 3, 8, 56);
  ho.step(1 / 60, 150);
  const places = [
    [0.3, -0.9, 0, 1.3],
    [-1.9, -1.9, 10, 1.2],
    [2.4, -2.3, -12, 1.3],
    [-3.9, -3.4, 22, 1.4],
    [4.4, -3.9, -26, 1.2],
    [1.0, -3.9, -4, 1.5],
    [-1.2, -5.2, 6, 1.3],
    [2.9, -6.0, -10, 1.4],
    [-0.3, -6.9, 0, 1.5],
    [-5.9, -1.4, 40, 1.1],
    [6.3, -1.8, -42, 1.2],
  ];
  for (const [x, z, heading, speed] of places) ho.spawnRobot(x, z, heading, false, speed, 4000);
  ho.step(1 / 60, 34);
  // The picture has the title on it and nothing of the game's own screen furniture.
  document.querySelector('.hud').style.display = 'none';
  const poster = document.createElement('div');
  poster.className = 'social-poster';
  poster.innerHTML = `
    <div class="eyebrow">SITE 04 · MANUAL OVERRIDE FACILITY</div>
    <div class="logo">HUMAN <span>OVERRIDE</span></div>
    <div class="tagline">Don't let the AI win.</div>
    <div class="social-foot">A SURVIVAL SHOOTER IN YOUR BROWSER  ·  THE AI STUDIES HOW YOU PLAY</div>`;
  const style = document.createElement('style');
  style.textContent = `
    .social-poster { position: fixed; inset: 0; z-index: 50; padding: 54px 62px; display: flex; flex-direction: column; justify-content: flex-end;
      background: linear-gradient(180deg, rgba(5,6,7,0.0) 30%, rgba(5,6,7,0.5) 62%, rgba(5,6,7,0.94) 100%), linear-gradient(90deg, rgba(5,6,7,0.55) 0%, rgba(5,6,7,0) 55%); }
    .social-poster .eyebrow { font-family: var(--mono); font-size: 17px; letter-spacing: 0.34em; color: var(--amber); margin-bottom: 14px; }
    .social-poster .logo { font-size: 116px; letter-spacing: 0.13em; text-shadow: 0 4px 30px rgba(0,0,0,0.85); }
    .social-poster .tagline { font-size: 25px; letter-spacing: 0.3em; margin-top: 14px; color: var(--ink); }
    .social-poster .social-foot { margin-top: 26px; padding-top: 14px; border-top: 1px solid rgba(233,230,222,0.3); font-family: var(--mono); font-size: 15px; letter-spacing: 0.22em; color: var(--ink-dim); }`;
  document.head.appendChild(style);
  document.body.appendChild(poster);
});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
const shot = await page.screenshot({ type: 'png' });
await sharp(shot).jpeg({ quality: 86, mozjpeg: true }).toFile('public/social-preview.jpg');
const size = fs.statSync('public/social-preview.jpg').size;
console.log(`public/social-preview.jpg  (1200 x 630, ${(size / 1024).toFixed(0)} KB)`);
await browser.close();
await site.close();
