// Performance report for the production build.
//
//   npm run build && node tools/perf.mjs
//
// Measures the real, uncapped frame rate at each quality level at 1080p in
// the heaviest moment the current stage can produce, how evenly frames
// arrive at the screen's own rate (smoothness), plus start-up timings and
// the total download size. Numbers are from this machine's GPU; the report
// prints its name so they can be put in context.

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

// The heaviest moment the game can produce: a full horde (the most robots
// ever allowed on the map at once) closing on the player in the server
// hall, with every door open so three areas are in view, the carbine
// firing without pause, robots being destroyed and their debris piling up.
await page.evaluate(() => {
  const ho = window.__HO;
  ho.play();
  ho.god(true);
  ho.holdRounds(true);
  ho.clearRobots();
  for (const id of ['lobbyHall', 'lobbyPower', 'hallPower', 'hallCore']) ho.openDoor(id);
  ho.scrap(5000);
  // Buy the carbine at its rack, then stand in the aisle facing the lobby.
  ho.place(1.6, 10.1, 180);
  ho.step(1 / 60, 140);
  ho.tap('interact');
  ho.step(1 / 60, 40);
  ho.place(-1, 17.5, 0, -2);
});
const stress = () =>
  page.evaluate(() => {
    const ho = window.__HO;
    ho.clearRobots();
    // 24 robots, tough enough to last the measurement, some of them runners.
    for (let i = 0; i < 24; i++) ho.spawnRobot(-3.2 + (i % 6) * 0.9, 8.6 + Math.floor(i / 6) * 1.7, 180, false, i % 3 === 0 ? 3.0 : 1.6, i % 4 === 0 ? 150 : 1500);
    ho.game.weapons.state.reserve = 9000;
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

// ---- Smoothness: how evenly frames arrive at the screen's own rate
// A high average can hide stutter, so this part runs the way a player sees
// the game (frame rate limited to the screen's) and looks at the slowest
// frames instead of the average. Same scene: the full horde in the server
// hall, every door open, the carbine firing. It is also run at 3840 x 2160,
// which loads the graphics card about as a slower card is loaded at 1080p.
// The page used so far is emptied first, so it does not compete for the
// graphics card with what is measured from here on.
await page.goto('about:blank');
const paced = async (width, height) => {
  const limited = await launch({ width, height, capped: true });
  await limited.page.goto(`${site.url}?debug=1`);
  await limited.page.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
  await limited.page.evaluate(() => {
    const ho = window.__HO;
    ho.play();
    ho.god(true);
    ho.holdRounds(true);
    ho.clearRobots();
    for (const id of ['lobbyHall', 'lobbyPower', 'hallPower', 'hallCore']) ho.openDoor(id);
    ho.scrap(5000);
    ho.place(1.6, 10.1, 180);
    ho.step(1 / 60, 140);
    ho.tap('interact');
    ho.step(1 / 60, 40);
    ho.place(-1, 17.5, 0, -2);
  });
  console.log(`\nSmoothness at ${width} x ${height}, frame rate limited to the screen's (5 seconds of the full horde)`);
  console.log('quality   frames   usual ms   99th ms   worst ms   frames over 25 ms');
  for (const level of ['low', 'medium', 'high', 'ultra']) {
    await limited.page.evaluate((level) => window.__HO.setQuality(level), level);
    await limited.page.evaluate(() => {
      const ho = window.__HO;
      ho.clearRobots();
      for (let i = 0; i < 24; i++) ho.spawnRobot(-3.2 + (i % 6) * 0.9, 8.6 + Math.floor(i / 6) * 1.7, 180, false, i % 3 === 0 ? 3.0 : 1.6, i % 4 === 0 ? 150 : 1500);
      ho.game.weapons.state.reserve = 9000;
      ho.press('fire', true);
    });
    // Long enough for the change of level itself to be over and done with.
    await limited.page.waitForTimeout(3500);
    const r = await limited.page.evaluate(
      () =>
        new Promise((resolve) => {
          const times = [];
          let last = performance.now();
          const start = last;
          const tick = () => {
            const now = performance.now();
            times.push(now - last);
            last = now;
            if (now - start < 5000) requestAnimationFrame(tick);
            else {
              const sorted = [...times].sort((a, b) => a - b);
              resolve({ frames: times.length, usual: sorted[Math.floor(sorted.length / 2)], p99: sorted[Math.floor(sorted.length * 0.99)], worst: sorted[sorted.length - 1], late: times.filter((t) => t > 25).length });
            }
          };
          requestAnimationFrame(tick);
        }),
    );
    await limited.page.evaluate(() => window.__HO.press('fire', false));
    console.log(`${level.padEnd(8)} ${String(r.frames).padStart(7)} ${r.usual.toFixed(1).padStart(10)} ${r.p99.toFixed(1).padStart(9)} ${r.worst.toFixed(1).padStart(10)} ${String(r.late).padStart(19)}`);
  }
  await limited.browser.close();
};
await paced(1920, 1080);
await paced(3840, 2160);

// ---- Time to the title screen on slower connections (fresh visit, no cache)
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
