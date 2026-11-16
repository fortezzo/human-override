// Performance report for the production build.
//
//   npm run build && node tools/perf.mjs
//
// Measures the real, uncapped frame rate at each quality level at 1080p in
// the heaviest moment the current stage can produce (a full horde of
// ordinary robots, as every stage has measured it, and the same horde as
// ARGUS sends it), how evenly frames arrive at the screen's own rate
// (smoothness), plus start-up timings and the total download size. Numbers are from this machine's GPU; the report
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
// hall, with every door on the map open (the hall has a door to each of
// the other five areas, so all six are being drawn), the carbine firing
// without pause, robots being destroyed and their debris piling up.
await page.evaluate(() => {
  const ho = window.__HO;
  ho.play();
  ho.god(true);
  ho.holdRounds(true);
  ho.clearRobots();
  for (const door of ho.game.world.doors) ho.openDoor(door.plan.id);
  ho.scrap(5000);
  // Buy the carbine at its rack, then stand in the aisle facing the lobby.
  ho.place(1.6, 10.1, 180);
  ho.step(1 / 60, 140);
  ho.tap('interact');
  ho.step(1 / 60, 40);
  ho.place(-1, 17.5, 0, -2);
});

/** Where the horde is measured: the player's place and heading, and the corner of the block of robots and which way its rows run. */
const SCENES = {
  hall: { stand: [-1, 17.5, 0, -2], from: [-3.2, 8.6], across: [0.9, 0], back: [0, 1.7], heading: 180 },
  // The loading dock, the biggest room on the map: the player by the hall's shutter, the horde coming across the open floor from the bays.
  dock: { stand: [-13.4, 16.4, 90, -2], from: [-19.5, 13.6], across: [0, 1.0], back: [-1.7, 0], heading: -90 },
};

// It is measured twice. First with 24 ordinary robots, which is how every
// stage has measured it, so the numbers can be set side by side. Then as
// ARGUS sends it late in a run: two heavies, two bombers and four drones
// among the 24, and of the sixteen ordinary robots four in ten shielded
// against the gun being fired and half with a plate over the weak point
// (the two of its counters that put something on the robots; the other
// two send more bombers and drones, which are in the picture already).
function horde({ argus, scene }) {
  const ho = window.__HO;
  ho.clearRobots();
  ho.place(...scene.stand);
  let ordinary = 0;
  // 24 robots, tough enough to last the measurement, some of them runners.
  for (let i = 0; i < 24; i++) {
    const x = scene.from[0] + (i % 6) * scene.across[0] + Math.floor(i / 6) * scene.back[0];
    const z = scene.from[1] + (i % 6) * scene.across[1] + Math.floor(i / 6) * scene.back[1];
    const speed = i % 3 === 0 ? 3.0 : 1.6;
    const health = i % 4 === 0 ? 150 : 1500;
    const kind = !argus ? null : i === 7 || i === 16 ? 'heavy' : i === 2 || i === 21 ? 'bomber' : i === 5 || i === 10 || i === 13 || i === 18 ? 'drone' : null;
    if (!argus) ho.spawnRobot(x, z, scene.heading, false, speed, health);
    else if (kind) ho.spawnKind(x, z, scene.heading, { kind, health: 1500, ...(kind === 'bomber' ? { speed: 1.6 } : {}) });
    else {
      ho.spawnKind(x, z, scene.heading, { speed, health, ...(ordinary % 5 < 2 ? { shield: 'carbine' } : {}), ...(ordinary % 2 === 0 ? { guard: 400 } : {}) });
      ordinary++;
    }
  }
  ho.game.weapons.state.reserve = 9000;
  ho.press('fire', true);
}

for (const [argus, where] of [
  [false, 'hall'],
  [true, 'hall'],
  [true, 'dock'],
]) {
  console.log(
    where === 'dock'
      ? '\nThe horde as ARGUS sends it, in the loading dock (the biggest room on the map)'
      : argus
        ? '\nThe same horde as ARGUS sends it: specials among the 24, shielding and plates on the rest'
        : '\nA full horde of ordinary robots, in the server hall',
  );
  console.log('quality   fps    frame ms   draw calls   triangles   robots  particles  scrap');
  for (const level of ['low', 'medium', 'high', 'ultra']) {
    await page.evaluate((level) => window.__HO.setQuality(level), level);
    await page.evaluate(horde, { argus, scene: SCENES[where] });
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
}

// ---- Smoothness: how evenly frames arrive at the screen's own rate
// A high average can hide stutter, so this part runs the way a player sees
// the game (frame rate limited to the screen's) and looks at the slowest
// frames instead of the average. Same scene, in its heavier form: the
// horde as ARGUS sends it, in the server hall, every door open, the
// carbine firing. It is also run at 3840 x 2160,
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
    for (const door of ho.game.world.doors) ho.openDoor(door.plan.id);
    ho.scrap(5000);
    ho.place(1.6, 10.1, 180);
    ho.step(1 / 60, 140);
    ho.tap('interact');
    ho.step(1 / 60, 40);
    ho.place(-1, 17.5, 0, -2);
  });
  console.log(`\nSmoothness at ${width} x ${height}, frame rate limited to the screen's (5 seconds of the horde as ARGUS sends it)`);
  console.log('quality   frames   usual ms   99th ms   worst ms   frames over 25 ms');
  for (const level of ['low', 'medium', 'high', 'ultra']) {
    await limited.page.evaluate((level) => window.__HO.setQuality(level), level);
    await limited.page.evaluate(horde, { argus: true, scene: SCENES.hall });
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

// ---- First appearances: does the picture stall the first time a thing is drawn?
// Shaders are built while the game loads, including those of things that
// are not on screen yet (Game.warmShaders, and the spare robot). This is
// the check of it: in a fresh page, each kind of robot and each of ARGUS's
// counters is put in front of the camera for the first time, and the
// slowest frame in the second that follows is reported. A frame at this
// screen's own rate is the "usual" figure; 16.7 ms is one frame at 60 a
// second.
{
  const fresh = await launch({ width: 1920, height: 1080, capped: true });
  await fresh.page.goto(`${site.url}?debug=1`);
  await fresh.page.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
  await fresh.page.evaluate(() => {
    const ho = window.__HO;
    ho.play();
    ho.god(true);
    ho.holdRounds(true);
    ho.clearRobots();
    ho.setQuality('high');
    ho.place(0, 4.4, 0, 0);
  });
  // Let the change of level, and the start of the run, be over and done with.
  await fresh.page.waitForTimeout(5000);
  await fresh.page.evaluate(() => {
    window.__frames = [];
    window.__marks = [];
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      window.__frames.push([now, now - last]);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await fresh.page.waitForTimeout(1200);
  /** Turn to face a robot's chest (for the shots). */
  const face = `(robot) => {
    const ho = window.__HO;
    const game = ho.game;
    const aim = robot.chest(new game.camera.position.constructor());
    const eye = game.camera.position;
    const p = game.player.position;
    ho.place(p.x, p.z, (Math.atan2(-(aim.x - eye.x), -(aim.z - eye.z)) * 180) / Math.PI, (Math.atan2(aim.y - eye.y, Math.hypot(aim.x - eye.x, aim.z - eye.z)) * 180) / Math.PI);
  }`;
  const first = async (name, fn, wait = 1300) => {
    await fresh.page.evaluate(
      ({ name, source, face }) => {
        window.__marks.push([name, performance.now()]);
        (0, eval)(`(${source})`)((0, eval)(`(${face})`));
      },
      { name, source: fn.toString(), face },
    );
    await fresh.page.waitForTimeout(wait);
  };
  await first('an ordinary robot', () => window.__HO.spawnKind(-2.4, -1.6, 0, { hold: true }));
  await first('a robot carrying shielding', () => window.__HO.spawnKind(-0.8, -1.6, 0, { hold: true, shield: 'pistol', health: 5000 }));
  await first('a robot with a plate over its visor', () => window.__HO.spawnKind(0.8, -1.6, 0, { hold: true, guard: 40 }));
  await first('a shot that the shielding turns', (face) => {
    const ho = window.__HO;
    face(ho.game.robots.find((robot) => robot.alive && robot.armour.shield));
    ho.tap('fire');
  });
  await first('a drone', () => {
    const ho = window.__HO;
    ho.clearRobots();
    ho.place(0, 4.4, 0, 0);
    ho.spawnKind(0, -1.0, 0, { kind: 'drone', hold: true });
  });
  await first('a heavy', () => window.__HO.spawnKind(-2, -1.6, 0, { kind: 'heavy', hold: true }));
  await first('a bomber', () => window.__HO.spawnKind(2, -2.6, 0, { kind: 'bomber', hold: true }));
  await first(
    'the bomber going off',
    (face) => {
      const ho = window.__HO;
      window.__bomber = ho.game.robots.find((robot) => robot.alive && robot.kind === 'bomber');
      face(window.__bomber);
      // (The sidearm fires once for each pull of the trigger.)
      ho.tap('fire');
      window.__firing = setInterval(() => ho.tap('fire'), 300);
    },
    2600,
  );
  const wentOff = await fresh.page.evaluate(() => {
    clearInterval(window.__firing);
    return !window.__bomber.alive;
  });
  await first('a Custodian', () => {
    const ho = window.__HO;
    ho.clearRobots();
    ho.place(0, 4.4, 0, 0);
    ho.spawnRobot(-1.5, -1.6, 0, true, 1.2, 4000, 'custodian');
  });
  await first('the Proxy', () => window.__HO.spawnRobot(1.5, -1.6, 0, true, 1.2, 4000, 'proxy'));
  // ARGUS's analysis arriving across the top of the view, and then shrinking into its corner.
  await first('the ARGUS analysis arriving', () => {
    const ho = window.__HO;
    ho.clearRobots();
    ho.announcement.clear();
    ho.game.onAnalysis({
      round: 5,
      adaptations: [],
      withdrawn: [],
      lines: [
        { observed: '100% of hits on weak points.', adapting: 'Adapting: armoured weak points.' },
        { observed: '100% of damage from the carbine.', adapting: 'Adapting: carbine-resistant plating.' },
      ],
    });
  }, 2400);
  await first('the analysis shrinking into its corner', () => window.__HO.analysisBanner.hold('corner'));
  // Stage 4: the things the economy puts on screen for the first time.
  await first('a timed pickup lying on the floor', () => {
    const ho = window.__HO;
    ho.analysisBanner.hold(null);
    ho.announcement.clear();
    ho.clearRobots();
    ho.setShutter(false);
    ho.place(0, 4.4, 0, -6);
    ho.dropPickup('overload', 0, 1.5);
  });
  await first('a pickup taken: its notice, and its timer on the HUD', () => window.__HO.dropPickup('doubleScrap', 0, 4.4));
  await first('a boost on the HUD', () => window.__HO.setBoost('carapace', true));
  await first('a grenade thrown, and going off', () => window.__HO.tap('grenade'), 2800);
  await first('an EMP Blast taking three robots', () => {
    const ho = window.__HO;
    for (const x of [-2, 0, 2]) ho.spawnKind(x, -1.6, 0, { hold: true });
    ho.dropPickup('emp', 0, 4.4);
  });
  await first(
    'the Turncoat fired, and a robot turned',
    (face) => {
      const ho = window.__HO;
      ho.giveWeapon('turncoat');
      ho.spawnKind(0, -1.6, 0, { hold: true, health: 5000 });
      setTimeout(() => {
        face(ho.game.robots.find((robot) => robot.alive));
        ho.tap('fire');
      }, 700);
    },
    2300,
  );
  await first(
    'a shutter battered, and forced up',
    () => {
      const ho = window.__HO;
      ho.clearRobots();
      ho.place(0, 4.4, 0, 0);
      ho.setShutter(true, 'yard');
      // (ARGUS's Proxy forces a shutter with one blow.)
      ho.spawnRobot(0, -9.2, 180, false, 3.0, 4000, 'proxy');
    },
    5000,
  );
  const { frames, marks } = await fresh.page.evaluate(() => ({ frames: window.__frames, marks: window.__marks }));
  const ordered = frames.map((frame) => frame[1]).sort((a, b) => a - b);
  console.log(`\nFirst appearances at 1920 x 1080 on High, frame rate limited to the screen's (usual frame ${ordered[Math.floor(ordered.length / 2)].toFixed(1)} ms)`);
  console.log('first time on screen                     slowest frame in the next second   frames over 25 ms');
  for (const [name, at] of marks) {
    const after = frames.filter(([time]) => time >= at && time < at + 1000);
    const note = name === 'the bomber going off' && !wentOff ? '   (it did not go off)' : '';
    console.log(`${name.padEnd(40)} ${Math.max(...after.map((frame) => frame[1])).toFixed(1).padStart(9)} ms ${String(after.filter((frame) => frame[1] > 25).length).padStart(27)}${note}`);
  }
  await fresh.browser.close();
}

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
