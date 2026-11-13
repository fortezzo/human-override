// Performance report for the production build.
//
//   npm run build && node tools/perf.mjs
//
// Measures the real, uncapped frame rate at each quality level at 1080p in
// the heaviest moment the current stage can produce, plus start-up timings
// and the total download size. Numbers are from this machine's GPU; the
// report prints its name so they can be put in context.

import fs from 'node:fs';
import path from 'node:path';
import { gpuName, launch } from './lib/browser.mjs';
import { serve } from './lib/static-server.mjs';

function folderSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? folderSize(full) : fs.statSync(full).size;
  }
  return total;
}

const site = await serve('dist', '/');
const { browser, page } = await launch({ width: 1920, height: 1080 });
page.on('pageerror', (e) => console.log('exception:', e.message));

const started = Date.now();
await page.goto(`${site.url}?debug=1`);
await page.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
console.log(`GPU: ${await gpuName(page)}`);
console.log(`Resolution: 1920 x 1080`);
console.log(`Start-up: ${((Date.now() - started) / 1000).toFixed(1)} s to title screen (local files, no network delay)`);
const timings = await page.evaluate(() => window.__HO.game.loadTimings);
for (const [name, ms] of Object.entries(timings)) console.log(`  ${name}: ${ms} ms`);

// Heaviest moment available in this stage: a fire-fight with robots in the
// room, debris from a destroyed one, and a burst of sparks and smoke.
await page.evaluate(() => {
  const ho = window.__HO;
  ho.play();
  ho.god(true);
  ho.clearRobots();
  ho.place(0, 4.6, 0, -4);
});
const stress = () =>
  page.evaluate(() => {
    const ho = window.__HO;
    ho.clearRobots();
    for (let i = 0; i < 6; i++) ho.spawnRobot(-2.5 + i, -2 - (i % 2) * 1.5, 0, false);
    ho.press('fire', true);
  });

console.log('\nquality   fps    frame ms   draw calls   triangles   robots  particles  scrap');
for (const level of ['low', 'medium', 'high', 'ultra']) {
  await page.evaluate((level) => window.__HO.setQuality(level), level);
  await stress();
  await page.waitForTimeout(1500);
  // Average over two seconds of real frames.
  const result = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        let peakCalls = 0;
        let peakTriangles = 0;
        let peakParticles = 0;
        let peakGibs = 0;
        const start = performance.now();
        const tick = () => {
          frames++;
          const s = window.__HO.stats();
          peakCalls = Math.max(peakCalls, s.calls);
          peakTriangles = Math.max(peakTriangles, s.triangles);
          peakParticles = Math.max(peakParticles, s.particles);
          peakGibs = Math.max(peakGibs, s.gibs);
          const elapsed = performance.now() - start;
          if (elapsed < 2000) requestAnimationFrame(tick);
          else resolve({ fps: (frames * 1000) / elapsed, peakCalls, peakTriangles, peakParticles, peakGibs, robots: s.robots });
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.evaluate(() => window.__HO.press('fire', false));
  console.log(
    `${level.padEnd(8)} ${result.fps.toFixed(0).padStart(5)} ${(1000 / result.fps).toFixed(2).padStart(9)} ${String(result.peakCalls).padStart(11)} ${String(result.peakTriangles).padStart(12)} ${String(result.robots).padStart(7)} ${String(result.peakParticles).padStart(9)} ${String(result.peakGibs).padStart(7)}`,
  );
}

// ---- Time to the title screen on slower connections (fresh visit, no cache)
// Stop the stress test first so it does not compete for the graphics card.
await page.evaluate(() => {
  window.__HO.clearRobots();
  window.__HO.freeze(true);
});
console.log('\nTime to title screen on a simulated connection:');
for (const mbps of [100, 50, 25]) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const visitor = await context.newPage();
  const cdp = await context.newCDPSession(visitor);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 30, downloadThroughput: (mbps * 1e6) / 8, uploadThroughput: 1e6 });
  const t0 = Date.now();
  await visitor.goto(`${site.url}?debug=1`);
  await visitor.waitForFunction(() => window.__HO?.ready, null, { timeout: 180000 });
  console.log(`  ${String(mbps).padStart(3)} Mbps: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await context.close();
}

const total = folderSize('dist');
console.log(`\nTotal download (dist/): ${(total / 1024 / 1024).toFixed(1)} MB`);
for (const part of ['assets/models', 'assets/textures', 'assets/audio', 'assets/fonts', 'assets/env']) {
  console.log(`  ${part}: ${(folderSize(path.join('dist', part)) / 1024 / 1024).toFixed(2)} MB`);
}
const code = fs.readdirSync('dist/assets').filter((f) => /\.(js|css)$/.test(f)).reduce((n, f) => n + fs.statSync(path.join('dist/assets', f)).size, 0);
console.log(`  code (js + css): ${(code / 1024 / 1024).toFixed(2)} MB`);

await browser.close();
await site.close();
