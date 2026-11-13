// Takes the project's reference screenshots from the production build.
//
//   npm run build && npm run shots              -> media/look-target
//   npm run shots -- media/some-other-folder
//
// Every shot is staged through the debug API with time stepped by hand, so
// the same moments can be re-shot after any change and compared with the
// approved look.

import fs from 'node:fs';
import path from 'node:path';
import { gpuName, launch } from './lib/browser.mjs';
import { serve } from './lib/static-server.mjs';

const outDir = process.argv[2] ?? 'media/look-target';
if (!fs.existsSync('dist/index.html')) {
  console.error('No production build found. Run "npm run build" first.');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const site = await serve('dist', '/');
const { browser, page } = await launch({ width: 1920, height: 1080 });
const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
page.on('pageerror', (e) => problems.push(`exception: ${e.message}`));

await page.goto(`${site.url}?debug=1`);
await page.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
console.log(`Rendering on: ${await gpuName(page)}`);

const run = (fn, arg) => page.evaluate(fn, arg);
const step = (frames) => run((frames) => window.__HO.step(1 / 60, frames), frames);
const shoot = async (name) => {
  // One real animation frame lets the HUD catch up with the stepped game.
  await run(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  // JPEG keeps the film grain without the 3 MB-per-picture cost of PNG.
  await page.screenshot({ path: path.join(outDir, `${name}.jpg`), type: 'jpeg', quality: 92 });
  console.log(`  ${name}.jpg`);
};

// ---- 1. Title screen, as a visitor first sees it
// The lamps are held steady for the whole run (in the game one of them
// stutters), so that pictures taken on different days can be compared.
await run(() => {
  window.__HO.freeze(true);
  window.__HO.steadyLights(true);
});
await step(240);
await shoot('01-title');

// ---- 2. First contact: a robot comes through the breach
await run(() => {
  const ho = window.__HO;
  ho.play();
  ho.god(true);
  ho.clearRobots();
  ho.place(0, 4.6, 0, 0);
  ho.spawnRobot(0.25, -7.4, 0, false);
});
await step(100);
await shoot('02-first-contact');

// ---- 3. The robot up close (no HUD or weapon in frame)
await run(() => {
  const ho = window.__HO;
  ho.photoMode(true);
  ho.clearRobots();
  ho.spawnRobot(0.35, -3.6, 0, true);
  ho.view(1.2, 1.5, -1.7, 24, -2.5, 40);
});
await step(50);
await shoot('03-robot-close');

// ---- 4. The room itself
await run(() => {
  const ho = window.__HO;
  ho.clearRobots();
  ho.view(0.2, 1.64, -1.4, 180, 1, 70);
});
await step(30);
await shoot('04-server-hall-door');
await run(() => window.__HO.view(2.9, 1.6, -1.9, -62, 2, 60));
await step(30);
await shoot('05-security-desk');
await run(() => window.__HO.view(5.6, 1.7, 4.9, 52, -3, 74));
await step(30);
await shoot('06-lobby-from-corner');
await run(() => window.__HO.view(0.4, 1.64, -5.3, 4, 0, 70));
await run(() => window.__HO.spawnRobot(-0.3, -13.5, 0, false));
await step(140);
await shoot('07-out-through-the-breach');

// ---- 5. Firefight from the player's eyes
await run(() => {
  const ho = window.__HO;
  ho.photoMode(false);
  ho.releaseView();
  ho.clearRobots();
  ho.place(-0.7, 2.6, 0, 0);
  ho.spawnRobot(0.3, -2.6, 0, false);
});
await step(70);
await run(() => {
  const ho = window.__HO;
  ho.aimAtRobot('chest');
  ho.press('fire', true);
  ho.step(1 / 60, 8);
  ho.aimAtRobot('chest');
  ho.step(1 / 60, 5);
});
await shoot('08-firefight');

// Keep firing until it is destroyed, then catch the moment it comes apart.
for (let i = 0; i < 200 && (await run(() => window.__HO.game.robots.some((r) => r.alive))); i++) {
  await run(() => {
    window.__HO.aimAtRobot('chest');
    window.__HO.step(1 / 60, 1);
  });
}
await run(() => window.__HO.press('fire', false));
await step(34);
await shoot('09-destroyed');
await step(50);
await shoot('10-scrap');

// ---- 6. Aiming down the sights
await run(() => {
  const ho = window.__HO;
  ho.clearRobots();
  ho.place(0, 3.6, 0, 0);
  ho.spawnRobot(0.1, -3.4, 0, false);
  ho.press('aim', true);
});
await step(60);
await run(() => {
  window.__HO.aimAtRobot('head');
  window.__HO.step(1 / 60, 2);
});
await shoot('11-aiming');
await run(() => window.__HO.press('aim', false));

// ---- 7. Pause menu
await run(() => window.__HO.game.setState('paused'));
await step(3);
await shoot('12-pause-menu');
await run(() => window.__HO.play());

// ---- 8. The same view at the lowest and highest quality
await run(() => {
  const ho = window.__HO;
  ho.clearRobots();
  ho.place(0, 4.6, 0, 0);
  ho.spawnRobot(0.25, -6.6, 0, false);
});
for (const level of ['low', 'ultra']) {
  await run((level) => window.__HO.setQuality(level), level);
  await step(30);
  await shoot(`13-quality-${level}`);
}

const errors = [...new Set(problems)].filter((p) => !/X3595|gradient instruction/.test(p));
if (errors.length) console.log('Console errors:\n' + errors.join('\n'));
await browser.close();
await site.close();
console.log(`Saved to ${outDir}`);
