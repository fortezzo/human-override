// End-to-end check of the production build in a real (headless) browser.
//
//   npm run build && npm run e2e
//
// It serves dist/ from a sub-folder address, loads the game, and drives it
// through the debug API the way a player would: start, shoot, kill a robot,
// get hit, go down, pause and resume, and switch every quality level. It
// also measures the picture itself: that the room is equally bright at
// every quality level, that the shadows are not solid black, and that the
// brightness setting works. Any console error or failed expectation fails
// the run.
//
// Stage 0 covers what exists so far; later stages add rounds, purchases and
// the mission to this script.

import fs from 'node:fs';
import sharp from 'sharp';
import { gpuName, launch } from './lib/browser.mjs';
import { serve } from './lib/static-server.mjs';

if (!fs.existsSync('dist/index.html')) {
  console.error('No production build found. Run "npm run build" first.');
  process.exit(1);
}

const results = [];
const problems = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const site = await serve('dist', '/games/human-override/');
const { browser, page } = await launch({ width: 1280, height: 720 });
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
page.on('pageerror', (e) => problems.push(`exception: ${e.message}`));
page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()} ${r.url()}`));

const step = (dt, frames) => page.evaluate(([dt, frames]) => window.__HO.step(dt, frames), [dt, frames]);
const stats = () => page.evaluate(() => window.__HO.stats());

/** Photographs the page and measures it: average brightness (0-255) and the share of it that is near black. */
async function measurePicture() {
  const { data } = await sharp(await page.screenshot()).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let black = 0;
  for (const value of data) {
    sum += value;
    if (value < 8) black++;
  }
  return { mean: sum / data.length, black: (black / data.length) * 100 };
}

/** Moves a slider on the settings panel, the way dragging it would. */
const setSlider = (label, value) =>
  page.evaluate(
    ([label, value]) => {
      const row = [...document.querySelectorAll('.setting')].find((r) => r.textContent.trim().startsWith(label));
      const input = row?.querySelector('input[type=range]');
      if (!input) return false;
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },
    [label, value],
  );

try {
  // ---- Loading
  const started = Date.now();
  await page.goto(`${site.url}?debug=1`);
  await page.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
  const loadSeconds = (Date.now() - started) / 1000;
  console.log(`GPU: ${await gpuName(page)}`);
  check('loads from a sub-folder address', true, `${loadSeconds.toFixed(1)} s to title screen`);
  check('title screen is showing', (await stats()).state === 'title' && (await page.locator('.screen.title').isVisible()));

  // ---- Real frame rate at each quality level (uncapped in this browser)
  for (const level of ['low', 'medium', 'high', 'ultra']) {
    await page.evaluate((level) => window.__HO.setQuality(level), level);
    await page.waitForTimeout(2500);
    const s = await stats();
    check(`renders at ${level} quality`, s.quality === level && s.fps > 5, `${s.fps} fps, ${s.calls} draw calls, ${s.triangles} triangles`);
  }
  await page.evaluate(() => window.__HO.setQuality('high'));

  // ---- Play: from here on, time is stepped by hand so results are exact
  await page.evaluate(() => {
    window.__HO.freeze(true);
    window.__HO.play();
  });
  await step(1 / 60, 30);
  check('enters play and shows the HUD', (await stats()).state === 'playing' && (await page.locator('.hud').isVisible()));

  // ---- The picture: the same view of the room at every quality level,
  // with the lamps held steady so only the quality level differs.
  await page.evaluate(() => {
    const ho = window.__HO;
    ho.photoMode(true);
    ho.steadyLights(true);
    ho.view(0, 1.7, 4.6, 0, 0, 74);
  });
  const pictures = {};
  for (const level of ['low', 'medium', 'high', 'ultra']) {
    await page.evaluate((level) => {
      window.__HO.setQuality(level);
      window.__HO.clearRobots();
      window.__HO.step(1 / 60, 30);
    }, level);
    pictures[level] = await measurePicture();
  }
  const means = Object.values(pictures).map((p) => p.mean);
  const spread = Math.max(...means) - Math.min(...means);
  const summary = Object.entries(pictures).map(([level, p]) => `${level} ${p.mean.toFixed(1)}`).join(', ');
  check('the room is equally bright at every quality level', spread < 2.5, `average brightness out of 255: ${summary}`);
  const blackest = Math.max(...Object.values(pictures).map((p) => p.black));
  check('shadows keep their detail', blackest < 12, `at most ${blackest.toFixed(1)}% of the picture is near black`);

  // The brightness slider on the settings panel.
  await page.evaluate(() => window.__HO.setQuality('high'));
  await step(1 / 60, 20);
  const normal = await measurePicture();
  const moved = await setSlider('Brightness', 1.5);
  await step(1 / 60, 2);
  const brighter = await measurePicture();
  await setSlider('Brightness', 1);
  await step(1 / 60, 2);
  const restored = await measurePicture();
  check(
    'the brightness setting brightens the picture',
    moved && brighter.mean > normal.mean + 8 && Math.abs(restored.mean - normal.mean) < 1.5,
    `${normal.mean.toFixed(1)} -> ${brighter.mean.toFixed(1)} at 150% -> ${restored.mean.toFixed(1)} back at 100%`,
  );
  await page.evaluate(() => {
    const ho = window.__HO;
    ho.photoMode(false);
    ho.steadyLights(false);
    ho.releaseView();
    ho.clearRobots();
    ho.spawnRobot(0, -14.8, 0, false);
  });
  await step(1 / 60, 5);

  // The robot walks in from the breach on its own.
  const before = await page.evaluate(() => window.__HO.game.robots[0].position.z);
  await step(1 / 60, 180);
  const after = await page.evaluate(() => window.__HO.game.robots[0].position.z);
  check('robot advances toward the player', after > before + 2, `moved ${(after - before).toFixed(1)} m in 3 s`);

  // Shoot it down, aiming at the chest.
  let shots = 0;
  await page.evaluate(() => window.__HO.press('fire', true));
  for (let i = 0; i < 400 && (await page.evaluate(() => window.__HO.game.robots.some((r) => r.alive))); i++) {
    await page.evaluate(() => {
      window.__HO.aimAtRobot('chest');
      window.__HO.step(1 / 60, 1);
    });
  }
  await page.evaluate(() => window.__HO.press('fire', false));
  shots = 30 - (await stats()).ammo;
  check('rifle fires and destroys the robot', !(await page.evaluate(() => window.__HO.game.robots.some((r) => r.alive))), `${shots} rounds used`);
  await step(1 / 60, 60);
  const debris = await stats();
  check('destroyed robot breaks into scrap', debris.gibs >= 8 && debris.robots === 0, `${debris.gibs} pieces`);

  // The muzzle flash is over almost as soon as it starts.
  await page.evaluate(() => window.__HO.press('fire', true));
  await step(1 / 60, 1);
  await page.evaluate(() => window.__HO.press('fire', false));
  const flashOn = (await stats()).flash;
  await step(1 / 60, 3);
  check('the muzzle flash lasts only an instant', flashOn && !(await stats()).flash, 'gone within 4 frames');

  // Raising the rifle brings the sight's reticle up; lowering it puts it out.
  await page.evaluate(() => window.__HO.press('aim', true));
  await step(1 / 60, 40);
  const raised = await stats();
  await page.evaluate(() => window.__HO.press('aim', false));
  await step(1 / 60, 40);
  const lowered = await stats();
  check('aiming brings up the sight and its reticle', raised.aim > 0.95 && raised.reticle > 0.95 && lowered.reticle === 0, `reticle ${raised.reticle.toFixed(2)} raised, ${lowered.reticle.toFixed(2)} lowered`);

  // Reload.
  await page.evaluate(() => window.__HO.press('reload', true));
  await step(1 / 60, 2);
  await page.evaluate(() => window.__HO.press('reload', false));
  await step(1 / 60, 150);
  check('reload refills the magazine', (await stats()).ammo === 30);

  // The next robot arrives, reaches the player and hurts them.
  let hurt = false;
  for (let i = 0; i < 2400 && !hurt; i += 20) {
    await step(1 / 60, 20);
    hurt = (await stats()).health < 100;
  }
  check('a new robot arrives and its attack lands', hurt, `health ${(await stats()).health}`);

  // Left alone, the player goes down and the test resets.
  let down = false;
  for (let i = 0; i < 1800 && !down; i += 20) {
    await step(1 / 60, 20);
    down = (await stats()).health === 0;
  }
  check('the player can be taken down', down);
  await page.waitForTimeout(1400);
  await step(1 / 60, 30);
  const reset = await stats();
  check('going down resets the test', reset.health === 100 && reset.robots === 0);

  // Health regenerates after a pause in the damage.
  await page.evaluate(() => {
    window.__HO.game.player.damage(60, 0, 0);
    window.__HO.clearRobots();
    window.__HO.god(true);
  });
  await step(1 / 60, 60);
  const wounded = (await stats()).health;
  await step(1 / 60, 420);
  check('health regenerates', wounded < 50 && (await stats()).health === 100, `${wounded} -> ${(await stats()).health}`);

  // Pause and resume.
  await page.evaluate(() => window.__HO.game.setState('paused'));
  await step(1 / 60, 5);
  const pausedVisible = await page.locator('.screen.pause').isVisible();
  const z0 = await page.evaluate(() => window.__HO.game.robots[0]?.position.z ?? 0);
  await step(1 / 60, 60);
  const z1 = await page.evaluate(() => window.__HO.game.robots[0]?.position.z ?? 0);
  check('pause shows the menu and freezes the world', pausedVisible && z0 === z1);
  await page.evaluate(() => window.__HO.play());
  await step(1 / 60, 5);
  check('resume returns to play', (await stats()).state === 'playing' && !(await page.locator('.screen.pause').isVisible()));
} catch (error) {
  check('script ran to the end', false, String(error.message ?? error).split('\n')[0]);
}

// ---- Phones and tablets: the scene with a friendly note, not a broken game
try {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const phonePage = await phone.newPage();
  phonePage.on('console', (m) => m.type() === 'error' && problems.push(`phone: ${m.text()}`));
  phonePage.on('pageerror', (e) => problems.push(`phone exception: ${e.message}`));
  await phonePage.goto(`${site.url}?debug=1`);
  await phonePage.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
  const note = await phonePage.locator('.screen.touch').isVisible();
  const startButton = await phonePage.locator('.screen.title').isVisible();
  check('touch devices get the "use a computer" screen', note && !startButton);
  await phone.close();
} catch (error) {
  check('touch devices get the "use a computer" screen', false, String(error.message ?? error).split('\n')[0]);
}

// Shader translation warnings from the graphics driver are not errors.
const errors = [...new Set(problems)].filter((p) => !/X3595|gradient instruction/.test(p));
check('no console errors or failed requests', errors.length === 0, errors.slice(0, 4).join(' | '));

await browser.close();
await site.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
