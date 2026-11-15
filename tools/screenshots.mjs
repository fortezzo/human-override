// Takes the project's screenshots from the production build.
//
//   npm run build && npm run shots              -> media/stage-1
//   npm run shots -- media/some-other-folder
//
// Every shot is staged through the debug tools with time stepped by hand
// and the lamps held steady, so the same moments can be re-shot after any
// change and compared with the approved look in media/look-target (which
// this script never touches).

import fs from 'node:fs';
import path from 'node:path';
import { gpuName, launch } from './lib/browser.mjs';
import { serve } from './lib/static-server.mjs';

const outDir = process.argv[2] ?? 'media/stage-1';
if (!fs.existsSync('dist/index.html')) {
  console.error('No production build found. Run "npm run build" first.');
  process.exit(1);
}
if (path.normalize(outDir) === path.normalize('media/look-target')) {
  console.error('media/look-target holds the approved look and is not overwritten. Choose another folder.');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const site = await serve('dist', '/');
const { browser, page } = await launch({ width: 1920, height: 1080 });
const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
page.on('pageerror', (e) => problems.push(`exception: ${e.message}`));

// A clean slate: no best round remembered from an earlier run of this script.
await page.goto(`${site.url}?debug=1`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
console.log(`Rendering on: ${await gpuName(page)}`);

const run = (fn, arg) => page.evaluate(fn, arg);
const step = (frames) => run((frames) => window.__HO.step(1 / 60, frames), frames);
const shoot = async (name) => {
  // The HUD runs on real time: give it a moment to catch up with the
  // stepped game and to finish fading prompts and counters in.
  await page.waitForTimeout(1400);
  // JPEG keeps the film grain without the 3 MB-per-picture cost of PNG.
  await page.screenshot({ path: path.join(outDir, `${name}.jpg`), type: 'jpeg', quality: 92 });
  console.log(`  ${name}.jpg`);
};
/** Hide or show the debug overlay, which has no place in a portfolio picture. */
const overlay = (show) => run((show) => document.querySelector('.hud-debug')?.style.setProperty('visibility', show ? 'visible' : 'hidden'), show);

// ---- 1. Title screen, as a visitor first sees it
await run(() => {
  window.__HO.freeze(true);
  window.__HO.steadyLights(true);
});
await step(240);
await shoot('01-title');

// ---- 2. Round 1: the first robots come through the breach
await run(() => {
  const ho = window.__HO;
  ho.play();
  ho.god(true);
});
await overlay(false);
await step(60 * 9);
await run(() => {
  window.__HO.aimAtRobot('chest');
  window.__HO.step(1 / 60, 2);
});
await shoot('02-round-one');

// ---- 3. A purchase prompt: the shotgun on its rack
await run(() => {
  const ho = window.__HO;
  ho.holdRounds(true);
  ho.clearRobots();
  ho.scrap(900);
  ho.place(-3.9, -0.55, 22, 5);
});
await step(20);
await shoot('03-purchase-prompt');

// ---- 4. The shotgun at work
await run(() => {
  const ho = window.__HO;
  ho.place(-4.5, -0.9, 0);
  ho.step(1 / 60, 4);
  ho.tap('interact');
  ho.step(1 / 60, 40);
  ho.place(-0.6, 2.6, 0);
  ho.spawnRobot(0.3, -1.2, 0, false, 1.4, 260);
  ho.spawnRobot(-1.6, -3.4, 0, false, 1.4, 260);
  ho.step(1 / 60, 50);
  ho.aimAtRobot('chest');
  ho.step(1 / 60, 2);
  // The shotgun's flash is drawn for one frame only: photograph that frame.
  ho.press('fire', true);
  ho.step(1 / 60, 1);
  ho.press('fire', false);
});
await shoot('04-shotgun');

// ---- 5. A full horde mid-round
// A horde like this belongs to a later round, so move the run on to round 8
// first (30 robots, 24 of them on the map at once) and let the round
// banners clear, so that what the HUD says matches what is on screen.
await run(() => {
  const ho = window.__HO;
  ho.clearRobots();
  ho.holdRounds(false);
  for (let guard = 0; guard < 60 && ho.game.director.rounds.round < 8; guard++) {
    ho.skipRound();
    ho.step(1 / 60, 2);
    ho.clearRobots();
  }
  ho.holdRounds(true);
  ho.clearRobots();
  ho.place(0, 5.6, 0, -1);
  ho.step(1 / 60, 30);
});
await page.waitForTimeout(5000);
await run(() => {
  const ho = window.__HO;
  ho.clearRobots();
  ho.scrap(2000);
  ho.place(0, 5.6, 0, -1);
  for (let i = 0; i < 24; i++) ho.spawnRobot(-5.2 + (i % 8) * 1.5 + (i % 2) * 0.4, -6.4 + Math.floor(i / 8) * 2.4, 0, false, 1.3 + (i % 3) * 0.25, 400);
  ho.step(1 / 60, 95);
  ho.aimAtRobot('chest');
  ho.step(1 / 60, 2);
  ho.press('fire', true);
  ho.step(1 / 60, 1);
  ho.press('fire', false);
});
await shoot('05-horde');

// ---- 6. A door prompt, then the door opening on the server hall
await run(() => {
  const ho = window.__HO;
  ho.clearRobots();
  ho.place(0.3, 4.75, 177, 3);
});
await step(60);
await shoot('06-door-prompt');
await run(() => {
  const ho = window.__HO;
  ho.place(0, 5.4, 180);
  ho.step(1 / 60, 3);
  ho.tap('interact');
  ho.place(0.3, 4.75, 177, 3);
  ho.step(1 / 60, 52);
});
await shoot('07-door-opening');

// ---- 7. The rooms themselves (no HUD or weapon in frame)
await run(() => {
  const ho = window.__HO;
  ho.photoMode(true);
  for (const id of ['lobbyPower', 'hallPower', 'hallCore']) ho.openDoor(id);
  ho.step(1 / 60, 140);
  ho.view(-1, 1.7, 8.6, 180, 0, 72);
});
await step(40);
await shoot('08-server-hall');
await run(() => window.__HO.view(1.0, 1.7, 15.6, -90, 0, 70));
await step(40);
await shoot('09-server-racks');
await run(() => window.__HO.view(7.2, 1.75, 23.9, 62, 3, 70));
await step(40);
await shoot('10-server-hall-from-uplink');
await run(() => {
  const ho = window.__HO;
  ho.view(10.4, 1.7, 3.4, -98, 1, 72);
  ho.spawnRobot(26.5, 4.6, -90, false, 1.5);
});
await step(120);
await shoot('11-power-room');
await run(() => {
  const ho = window.__HO;
  ho.clearRobots();
  ho.view(17.5, 1.7, 6.2, 172, 2, 72);
});
await step(40);
await shoot('12-breaker-and-cage');
await run(() => window.__HO.view(-1, 1.75, 26.7, 180, 7, 72));
await step(40);
await shoot('13-core');

// ---- 8. A robot dropping from a ceiling vent
await run(() => {
  const ho = window.__HO;
  ho.view(2.4, 1.7, 24.2, -58, 10, 72);
  ho.game.world.playerArea = 'hall';
  ho.forceEntry('hallVent');
  ho.holdRounds(false);
  ho.skipRound();
});
for (let i = 0; i < 900; i++) {
  await step(1);
  if (await run(() => window.__HO.game.robots.some((r) => r.root.position.y > 1.0 && r.root.position.y < 2.4))) break;
}
await shoot('14-vent-drop');

// ---- 9. The last robots of a round, marked
await run(() => {
  const ho = window.__HO;
  ho.forceEntry(null);
  ho.holdRounds(true);
  ho.clearRobots();
  ho.photoMode(false);
  ho.releaseView();
  ho.restart();
  ho.god(true);
});
await overlay(false);
// Let round 1 arrive, then destroy all but two of its six robots.
for (let i = 0; i < 60 * 40; i += 30) {
  await step(30);
  if (await run(() => window.__HO.game.robots.length >= 6)) break;
}
await run(() => {
  const ho = window.__HO;
  const robots = ho.game.robots.slice(0, 4);
  for (const robot of robots) {
    ho.game.director.destroyed();
    robot.dispose();
    ho.game.robots.splice(ho.game.robots.indexOf(robot), 1);
  }
  ho.holdRounds(true);
  // Stand the last two where they can be seen: one in the open, one beyond the barricade.
  const [a, b] = ho.game.robots;
  a.root.position.set(-2.6, 0, -1.2);
  b.root.position.set(2.4, 0, -5.6);
  a.hurry = b.hurry = false;
  ho.place(0.6, 5.2, 4, -1);
  ho.step(1 / 60, 24);
});
await shoot('15-last-robots-marked');

// ---- 10. Game over
// A card full of zeros says nothing, so play a real run first: the
// autopilot fights through three rounds with god mode on, then is left to
// its fate without it.
await run(() => {
  const ho = window.__HO;
  ho.restart();
  ho.god(true);
  ho.autopilot(true);
});
for (let i = 0; i < 600; i++) {
  await step(30);
  if ((await run(() => window.__HO.run().round)) >= 4) break;
}
await run(() => {
  const ho = window.__HO;
  ho.autopilot(false);
  // The autopilot never misses, and a card reading "accuracy 100%" looks
  // like what it is. A person misses: put a magazine of the sidearm into
  // the wall before the end.
  ho.tap('weapon1');
  ho.step(1 / 60, 45);
  ho.place(ho.game.player.position.x, ho.game.player.position.z, 90, 55);
  for (let shot = 0; shot < 12; shot++) {
    ho.tap('fire');
    ho.step(1 / 60, 10);
  }
  ho.god(false);
});
for (let i = 0; i < 400; i++) {
  await step(30);
  if ((await run(() => window.__HO.run().state)) === 'over') break;
}
await step(90);
await shoot('16-game-over');

// ---- 11. Debug mode, for the README's "how this was tested" section
await run(() => {
  const ho = window.__HO;
  ho.restart();
  ho.god(true);
  ho.autopilot(true);
});
await overlay(true);
// Wait for a moment worth showing: round 2 under way, several robots in the room.
for (let i = 0; i < 400; i++) {
  await step(15);
  const busy = await run(() => {
    const state = window.__HO.run();
    return state.round >= 2 && state.robots.filter((robot) => robot.alive).length >= 4;
  });
  if (busy) break;
}
await step(25);
await shoot('17-debug-autopilot');

const errors = [...new Set(problems)].filter((p) => !/X3595|gradient instruction/.test(p));
if (errors.length) console.log('Console errors:\n' + errors.join('\n'));
await browser.close();
await site.close();
console.log(`Saved to ${outDir}`);
