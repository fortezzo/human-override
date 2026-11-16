// Takes the project's screenshots from the production build.
//
//   npm run build && npm run shots              -> media/stage-5
//   npm run shots -- media/some-other-folder
//
// Every shot is staged through the debug tools with time stepped by hand
// and the lamps held steady, so the same moments can be re-shot after any
// change and compared with the approved look in media/look-target (which
// this script never touches).

import fs from 'node:fs';
import path from 'node:path';
import { gpuName, launch } from './lib/browser.mjs';
import { parseSiteAddress } from './lib/site-address.mjs';
import { serve } from './lib/static-server.mjs';

const outDir = process.argv[2] ?? 'media/stage-5';
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
await page.evaluate(() => window.__HO.randomDrops(false));
// (And no first-minute hints: they would be in every picture and under every measurement. The checks that are about them switch them on.)
await page.evaluate(() => window.__HO.hints?.(false));
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
// (Nor has the frame-rate counter, which a visitor does not see unless they ask for it: debug mode, which this tool runs in, always shows it.)
const overlay = (show) =>
  run((show) => {
    for (const part of ['.hud-debug', '.hud-fps']) document.querySelector(part)?.style.setProperty('visibility', show ? 'visible' : 'hidden');
  }, show);

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
// (They have a shutter to batter down first.)
await step(60 * 13);
await run(() => {
  window.__HO.aimAtRobot('chest');
  window.__HO.step(1 / 60, 2);
});
// (The round's announcement is on screen for its first two seconds; it has
// pictures of its own further down. Let it go before this one is taken.)
await page.waitForTimeout(2600);
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
  for (const id of ['lobbyPower', 'hallPower', 'hallCore', 'lobbyDock', 'hallDock', 'hallLab', 'powerLab']) ho.openDoor(id);
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
await shoot('12-breaker-and-lab-door');
await run(() => window.__HO.view(-1, 1.75, 26.7, 180, 7, 72));
await step(40);
await shoot('13-core');

// ---- 7b. The two areas added after the first full playthrough: the loading dock and the robotics lab.
for (const [name, x, z, yaw, pitch, fov] of [
  ['38-loading-dock', -12.6, 16.5, 90, 0, 74],
  ['39-loading-dock-truck-bay', -18.6, 14.1, 90, 2, 70],
  ['40-loading-dock-from-the-south-bay', -31.5, 23.4, -50, 4, 74],
  ['41-loading-dock-from-the-lobby-passage', -12.4, 5.1, 125, -2, 74],
  ['42-robotics-lab', 20.6, 15.6, 170, 0, 74],
  ['43-robotics-lab-assembly-cell', 12.2, 21.8, -90, 4, 68],
  ['44-robotics-lab-from-the-hall', 10.6, 19.0, -90, 0, 74],
  ['45-robotics-lab-key-cage', 17.6, 28.0, -100, 2, 70],
  ['46-server-hall-west-walk', -10.2, 9.0, 180, 0, 72],
]) {
  await run(([x, z, yaw, pitch, fov]) => window.__HO.view(x, 1.7, z, yaw, pitch, fov), [x, z, yaw, pitch, fov]);
  await step(50);
  await shoot(name);
}

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

// ---- 12. The round announcement: the moment it lands, and held
// The announcement runs on real time and is timed to its sound; the debug
// tools can hold it at any moment, which is how it is photographed.
const announce = (seconds) => run((seconds) => window.__HO.announcement.freezeAt(seconds), seconds);
/** Take down any announcement or notice, so the next picture shows only what it is of. */
const quiet = () => run(() => window.__HO.announcement.clear());
await overlay(false);
await run(() => {
  const ho = window.__HO;
  ho.autopilot(false);
  ho.restart();
  ho.god(true);
  ho.photoMode(false);
  ho.releaseView();
  // Up to the moment round 1 begins.
  for (let i = 0; i < 600 && ho.run().round < 1; i++) ho.step(1 / 60, 1);
  ho.holdRounds(true);
});
await announce(0.07);
await shoot('18-round-announcement-arrives');
await announce(1.0);
await shoot('19-round-announcement');
await announce(1.95);
await shoot('20-round-announcement-flies-to-counter');
await announce(null);

// ---- 13. A round cleared, with the scrap it paid
await run(() => {
  const ho = window.__HO;
  ho.holdRounds(false);
  ho.autopilot(true);
});
for (let i = 0; i < 900; i++) {
  await step(20);
  const state = await run(() => window.__HO.run());
  if (state.round === 3 && state.phase === 'waiting') break;
}
await run(() => {
  const ho = window.__HO;
  ho.autopilot(false);
  ho.holdRounds(true);
  ho.place(0.4, 4.9, 2, -1);
  ho.step(1 / 60, 3);
});
await announce(1.4);
await shoot('21-round-cleared');
await announce(null);

// ---- 14. The mission, start to finish, in one run
// The run just played (three rounds by the autopilot) carries on into the
// mission, so the numbers on the ending card are a real run's. Each step is
// taken as a player takes it: standing there, pressing F.
/** Stand at one of the mission's places, facing it, from so far back, and let the lamps catch up. */
const standAt = (name, back = 0, pitch = 0) =>
  run(
    ([name, back, pitch]) => {
      const ho = window.__HO;
      const place = ho.mission().places[name];
      const dx = place.at[0] - place.stand[0];
      const dz = place.at[2] - place.stand[1];
      const length = Math.hypot(dx, dz) || 1;
      ho.place(place.stand[0] - (dx / length) * back, place.stand[1] - (dz / length) * back, (Math.atan2(-dx, -dz) * 180) / Math.PI, pitch);
      ho.step(1 / 60, 70);
    },
    [name, back, pitch],
  );
/** Turn on a robot of a given kind and fire at it until it is destroyed. */
const destroy = (role) =>
  run((role) => {
    const ho = window.__HO;
    const game = ho.game;
    const head = new game.camera.position.constructor();
    for (let frames = 0; frames < 60 * 240; frames++) {
      const robot = game.robots.find((r) => r.role === role && r.alive);
      if (!robot) break;
      if (robot.grounded) {
        head.setFromMatrixPosition(robot.bones.get('Head').matrixWorld);
        const eye = game.camera.position;
        const dx = head.x - eye.x;
        const dz = head.z - eye.z;
        const p = game.player.position;
        ho.place(p.x, p.z, (Math.atan2(-dx, -dz) * 180) / Math.PI, (Math.atan2(head.y - eye.y, Math.hypot(dx, dz)) * 180) / Math.PI);
        ho.press('fire', true);
      }
      const weapon = game.weapons.state;
      if (weapon.reserve < 30) weapon.reserve = 120;
      if (weapon.ammo === 0 && !game.weapons.reloading) ho.tap('reload');
      ho.step(1 / 60, 1);
    }
    ho.press('fire', false);
    ho.step(1 / 60, 30);
  }, role);
/** Take away any robot standing within arm's reach, so none fills the picture. */
const clearNear = (metres) =>
  run((metres) => {
    const ho = window.__HO;
    const p = ho.game.player.position;
    const robots = ho.game.robots;
    for (let i = robots.length - 1; i >= 0; i--) {
      const robot = robots[i];
      if (robot.role || Math.hypot(robot.position.x - p.x, robot.position.z - p.z) > metres) continue;
      robot.dispose();
      robots.splice(i, 1);
    }
  }, metres);

await run(() => {
  const ho = window.__HO;
  ho.clearRobots();
  ho.scrap(6000);
  for (const id of ['lobbyHall', 'lobbyPower', 'hallPower']) ho.openDoor(id);
  ho.step(1 / 60, 140);
  // The carbine in hand for the rest: bought at its rack if it is not carried, then drawn.
  ho.place(1.6, 10.2, 180);
  ho.step(1 / 60, 6);
  if (!ho.run().slots.includes('carbine')) {
    ho.tap('interact');
    ho.step(1 / 60, 60);
  }
  if (ho.run().weapon !== 'carbine') {
    ho.tap(ho.run().slots.indexOf('carbine') === 0 ? 'weapon1' : 'weapon2');
    ho.step(1 / 60, 60);
  }
  // A person misses. The autopilot does not, and a card reading "accuracy
  // 100%" looks like what it is: put a magazine into the wall.
  ho.place(1.6, 10.2, 90, 50);
  ho.press('fire', true);
  ho.step(1 / 60, 150);
  ho.press('fire', false);
  ho.tap('reload');
  ho.step(1 / 60, 170);
});

// The breaker, with the power still out.
await standAt('breaker', 0.7, 2);
await quiet();
await shoot('22-mission-breaker');
// Thrown: the power is back and the cage is open.
await run(() => {
  const ho = window.__HO;
  ho.tap('interact');
  ho.step(1 / 60, 150);
});
await standAt('cage', 0.5);
await quiet();
await shoot('23-mission-key-cage');
await run(() => {
  const ho = window.__HO;
  ho.tap('interact');
  ho.step(1 / 60, 20);
});

// The uplink, half a minute in, with ARGUS's robots coming for it.
await run(() => {
  const ho = window.__HO;
  const place = ho.mission().places.uplink;
  ho.place(place.stand[0], place.stand[1], 180);
  ho.step(1 / 60, 10);
  ho.tap('interact');
  for (let i = 0; i < 60 * 29; i++) {
    ho.place(place.stand[0], place.stand[1], 180);
    ho.step(1 / 60, 1);
  }
  // Turn to face them, from beside the console, looking up the hall.
  ho.place(4.3, 23.5, 38, 0);
  ho.step(1 / 60, 2);
});
await clearNear(3.2);
await run(() => {
  const ho = window.__HO;
  ho.aimAtRobot('chest');
  ho.step(1 / 60, 2);
});
await quiet();
await shoot('24-mission-uplink');
await run(() => {
  const ho = window.__HO;
  const place = ho.mission().places.uplink;
  for (let i = 0; i < 60 * 32 && !ho.mission().keys.uplink; i++) {
    ho.place(place.stand[0], place.stand[1], 180);
    ho.step(1 / 60, 1);
  }
  ho.clearRobots();
});

// The Custodian, in the round it is due.
await run(() => {
  const ho = window.__HO;
  const due = ho.mission().rules.custodianFromRound;
  ho.holdRounds(false);
  ho.place(0, 4.6, 180);
  for (let guard = 0; guard < 80 && ho.run().round < due - 1; guard++) {
    ho.skipRound();
    ho.step(1 / 60, 2);
  }
  ho.skipRound();
  for (let i = 0; i < 60 * 14 && ho.run().round < due; i++) ho.step(1 / 60, 1);
  for (let i = 0; i < 60 * 8 && ho.mission().custodian !== 'active'; i++) ho.step(1 / 60, 1);
  ho.holdRounds(true);
  // Leave it two of the round's robots for company.
  const keep = ho.game.robots.filter((robot) => robot.role).concat(ho.game.robots.filter((robot) => !robot.role && robot.grounded).slice(0, 2));
  for (const robot of ho.game.robots) if (!keep.includes(robot)) robot.dispose();
  ho.game.robots.splice(0, ho.game.robots.length, ...keep);
  // Stand them in the lobby, coming on.
  const custodian = ho.game.robots.find((robot) => robot.role);
  custodian.root.position.set(-0.4, 0, -1.4);
  custodian.hurry = false;
  keep.filter((robot) => !robot.role).forEach((robot, i) => {
    robot.root.position.set(i ? 3.1 : -3.4, 0, i ? -3.6 : -4.4);
    robot.hurry = false;
  });
  ho.place(0.5, 5.0, 8, 2);
  ho.step(1 / 60, 70);
});
await quiet();
await shoot('25-mission-custodian');
await destroy('custodian');
await run(() => {
  const ho = window.__HO;
  ho.clearRobots();
  const key = ho.mission().droppedKey;
  ho.place(key.x + 0.9, key.z, 90, -30);
  ho.step(1 / 60, 8);
  ho.tap('interact');
  ho.step(1 / 60, 20);
});

// The core: unsealed with the three keys, the switch armed, the final stand.
await standAt('coreDoor');
await run(() => {
  const ho = window.__HO;
  ho.tap('interact');
  ho.step(1 / 60, 150);
});
await standAt('killSwitch');
await run(() => {
  const ho = window.__HO;
  const place = ho.mission().places.killSwitch;
  ho.tap('interact');
  // Hold the console, facing it, until the Proxy has walked in from the loading dock and is in the room.
  for (let i = 0; i < 60 * 45; i++) {
    ho.place(place.stand[0], place.stand[1], 180);
    ho.step(1 / 60, 1);
    const proxy = ho.game.robots.find((robot) => robot.role === 'proxy');
    if (proxy && proxy.position.z > 28.6 && i > 60 * 13) break;
  }
  // Seen from the far side of the room, clear of the console: fighting distance.
  const proxy = ho.game.robots.find((robot) => robot.role === 'proxy');
  if (proxy) {
    const x = -5.3;
    const z = 34.4;
    ho.place(x, z, (Math.atan2(-(proxy.position.x - x), -(proxy.position.z - z)) * 180) / Math.PI, 5);
  }
  ho.step(1 / 60, 2);
});
await clearNear(2.4);
await run(() => window.__HO.step(1 / 60, 2));
await quiet();
await shoot('26-mission-final-stand');

// Armed: the prompt to pull it, with the horde in the room.
await run(() => {
  const ho = window.__HO;
  const place = ho.mission().places.killSwitch;
  for (let i = 0; i < 60 * 90 && ho.mission().phase === 'arming'; i++) {
    ho.place(place.stand[0], place.stand[1], 180);
    ho.step(1 / 60, 1);
  }
});
await standAt('killSwitch', 0.5, -4);
await clearNear(1.7);
await run(() => window.__HO.step(1 / 60, 2));
await quiet();
await shoot('27-mission-kill-switch');

// Pulled: every robot in the room going down, and ARGUS's eye going out.
await run(() => {
  const ho = window.__HO;
  const place = ho.mission().places.killSwitch;
  for (let i = 0; i < 60 * 9; i++) {
    ho.place(place.stand[0], place.stand[1], 180);
    ho.step(1 / 60, 1);
  }
  ho.tap('interact');
  ho.photoMode(true);
  ho.view(-1, 2.3, 26.6, 180, -13, 78);
  // Two seconds on: the robots are down, ARGUS's eye is dark and its red light has left the room.
  ho.step(1 / 60, 125);
});
await shoot('28-mission-powered-down');
await run(() => {
  const ho = window.__HO;
  ho.photoMode(false);
  ho.releaseView();
  // Turned round to look at what is left of them.
  const place = ho.mission().places.killSwitch;
  ho.place(place.stand[0], place.stand[1] - 0.4, 0, -6);
  ho.step(1 / 60, 140);
});
await shoot('29-humanity-saved');

// The title screen once the mission has been finished: the fastest time under the button.
await run(() => {
  document.querySelector('.screen.saved button[data-action="quit"]').click();
  window.__HO.step(1 / 60, 240);
});
await shoot('30-title-with-records');

// ================================================================== ARGUS
// The special robots, ARGUS's counters where they can be seen, the
// analysis banner, and its profile of the player at the end of a run.
/** Turn on each robot in turn and fire at where it is weakest until none is left standing. */
const destroyAll = () =>
  run(() => {
    const ho = window.__HO;
    const game = ho.game;
    const aim = new game.camera.position.constructor();
    for (let frames = 0; frames < 60 * 40; frames++) {
      const robot = game.robots.find((r) => r.alive);
      if (!robot) break;
      robot.aimPoint(aim, true);
      const eye = game.camera.position;
      const dx = aim.x - eye.x;
      const dz = aim.z - eye.z;
      const p = game.player.position;
      ho.place(p.x, p.z, (Math.atan2(-dx, -dz) * 180) / Math.PI, (Math.atan2(aim.y - eye.y, Math.hypot(dx, dz)) * 180) / Math.PI);
      ho.press('fire', true);
      const weapon = game.weapons.state;
      if (weapon.reserve < 30) weapon.reserve = 150;
      if (weapon.ammo === 0 && !game.weapons.reloading) ho.tap('reload');
      ho.step(1 / 60, 1);
    }
    ho.press('fire', false);
    ho.step(1 / 60, 50);
  });

// ---- 31. The lull after a round fought one way: ARGUS says what it saw.
await run(() => {
  const ho = window.__HO;
  const game = ho.game;
  ho.play();
  ho.restart();
  ho.god(true);
  ho.steadyLights(true);
  ho.scrap(6000);
  for (const id of ['lobbyHall', 'lobbyPower']) ho.openDoor(id);
  // On to round 3 with nothing on the map. (Not round 4, as it was: the round after that is a swarm, and ARGUS announces nothing before a swarm.)
  for (let i = 0; i < 6000 && game.stats.round < 3; i++) {
    ho.simulate(1 / 60, 10);
    if (game.stats.round < 3 && game.director.rounds.phase === 'active') {
      ho.clearRobots();
      ho.skipRound();
    }
  }
  ho.holdRounds(true);
  ho.clearRobots();
  // The carbine from its rack, and nothing else used all round.
  ho.place(1.6, 10.2, 180);
  ho.step(1 / 60, 6);
  ho.tap('interact');
  ho.step(1 / 60, 60);
  // Six robots coming up the middle of the server hall.
  ho.place(-1, 10.4, 180, 0);
  for (const [x, z] of [[-2.6, 16.4], [-0.4, 17.4], [1.2, 16.0], [-1.6, 19.6], [0.6, 20.4], [-3.4, 21.0]]) ho.spawnKind(x, z, 0, { speed: 1.4 });
  ho.step(1 / 60, 30);
});
await overlay(false);
await destroyAll();
await run(() => {
  const ho = window.__HO;
  ho.place(-1, 10.4, 180, -4);
  const next = `ROUND ${ho.game.stats.round + 1}`;
  ho.announcement.clear();
  ho.holdRounds(false);
  ho.skipRound();
  // (It waits for "ROUND N CLEARED" to leave the top of the view, on the
  // real clock, which this loop does not let pass: holding it at its first
  // stage brings it up at once and keeps it there to be photographed.)
  const up = () => {
    if (ho.analysisBanner.showing() === 'waiting') ho.analysisBanner.hold('moment');
    return ho.analysisBanner.showing() === 'moment' && document.querySelector('.moment-round').textContent === next;
  };
  for (let i = 0; i < 60 * 8 && !up(); i++) ho.step(1 / 60, 1);
  ho.analysisBanner.hold('moment');
  ho.step(1 / 60, 20);
});
// As it arrives: large, near the top centre. (Its lines come in one after another: let the last of them land.)
await shoot('31-argus-analysis');
// And about two seconds later: shrunk into ARGUS's corner, where it stays until the next round begins.
await run(() => window.__HO.analysisBanner.hold('corner'));
await shoot('31b-argus-analysis-in-its-corner');
await run(() => window.__HO.analysisBanner.hold(null));

// ---- 32. The next round arrives carrying what it said: shielding against that gun, plates over weak points.
await run(() => {
  const ho = window.__HO;
  const game = ho.game;
  for (let i = 0; i < 3000 && game.stats.round < 4; i++) ho.step(1 / 60, 4);
  ho.holdRounds(true);
  ho.clearRobots();
  ho.announcement.clear();
  // Seven of that round's robots, as the director would have made them, coming on up the hall.
  const plate = game.director.rounds.plan.health * 0.45;
  const made = [
    [-2.8, 15.2, { shield: 'carbine' }],
    [-0.6, 16.2, { guard: plate }],
    [1.1, 15.0, { shield: 'carbine', guard: plate }],
    [-1.8, 18.4, {}],
    [0.4, 19.0, { shield: 'carbine' }],
    [-3.6, 19.6, { guard: plate }],
    [2.2, 18.6, {}],
  ];
  for (const [x, z, traits] of made) ho.spawnKind(x, z, 0, { speed: 1.2, ...traits });
  ho.place(-1, 10.6, 180, 0);
  ho.step(1 / 60, 70);
  ho.argusSay('weakStreak');
});
await page.waitForTimeout(1600);
// A shot at the nearest shielded one, so that the word under the crosshair is on screen, and a remark from ARGUS.
await run(() => {
  const ho = window.__HO;
  const game = ho.game;
  const robot = game.robots.filter((r) => r.alive && r.armour.shield).sort((a, b) => a.position.z - b.position.z)[0];
  const aim = robot.chest(new game.camera.position.constructor());
  const eye = game.camera.position;
  const p = game.player.position;
  ho.place(p.x, p.z, (Math.atan2(-(aim.x - eye.x), -(aim.z - eye.z)) * 180) / Math.PI, (Math.atan2(aim.y - eye.y, Math.hypot(aim.x - eye.x, aim.z - eye.z)) * 180) / Math.PI);
  ho.step(1 / 60, 3);
  ho.tap('fire');
  ho.step(1 / 60, 2);
});
await page.waitForTimeout(260);
await page.screenshot({ path: path.join(outDir, '32-argus-counters.jpg'), type: 'jpeg', quality: 92 });
console.log('  32-argus-counters.jpg');

// ---- 32b. A resisted hit up close: the word, the flare on the plate, the sparks and the round glancing off.
await run(() => {
  const ho = window.__HO;
  const game = ho.game;
  ho.clearRobots();
  ho.step(1 / 60, 120);
  ho.place(-1, 12.4, 180, 0);
  ho.spawnKind(-0.7, 16.0, 0, { shield: 'carbine', hold: true, health: 5000 });
  ho.spawnKind(-2.6, 17.6, 0, { hold: true });
  ho.step(1 / 60, 50);
  const robot = game.robots[0];
  const aim = robot.chest(new game.camera.position.constructor());
  const eye = game.camera.position;
  const p = game.player.position;
  ho.place(p.x, p.z, (Math.atan2(-(aim.x - eye.x), -(aim.z - eye.z)) * 180) / Math.PI, (Math.atan2(aim.y - eye.y, Math.hypot(aim.x - eye.x, aim.z - eye.z)) * 180) / Math.PI);
  ho.step(1 / 60, 20);
  ho.announcement.clear();
  ho.tap('fire');
  ho.step(1 / 60, 3);
});
await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
await page.screenshot({ path: path.join(outDir, '32b-resisted-hit.jpg'), type: 'jpeg', quality: 92 });
console.log('  32b-resisted-hit.jpg');

// ---- 35 (taken first, while the floor is clean). The heavy up close: plated all over, its core burning in its chest.
await run(() => {
  const ho = window.__HO;
  ho.clearRobots();
  ho.announcement.clear();
  ho.place(0, 3.4, 0, 2);
  ho.spawnKind(0.3, 0.2, 0, { kind: 'heavy', hold: true });
  ho.spawnKind(-2.3, -1.6, 0, { hold: true });
  ho.spawnKind(2.6, -2.0, 0, { hold: true });
  ho.step(1 / 60, 60);
});
await shoot('35-heavy');
// The same heavy from nearer and to one side, with one of the horde beside it: the same make of machine, built heavier.
await run(() => {
  const ho = window.__HO;
  ho.clearRobots();
  ho.place(-1.0, 2.9, -22, 4);
  ho.spawnKind(0.3, 0.5, 0, { kind: 'heavy', hold: true });
  ho.spawnKind(-1.5, 0.2, 0, { hold: true });
  ho.step(1 / 60, 60);
});
await shoot('35b-heavy-beside-a-drudge');

// ---- 33. The special robots: drones, a bomber and a heavy in a round of the ordinary kind.
await run(() => {
  const ho = window.__HO;
  ho.clearRobots();
  ho.announcement.clear();
  ho.place(0, 4.4, 0, 0);
  // Coming from the breach across the lobby: a heavy in the middle, a bomber running ahead of it, two drones overhead.
  ho.spawnKind(0.3, -3.6, 180, { kind: 'heavy' });
  ho.spawnKind(-2.3, -1.4, 180, { kind: 'bomber' });
  ho.spawnKind(2.6, -1.0, 180, { kind: 'drone', speed: 0.6 });
  ho.spawnKind(-3.8, -3.4, 180, { kind: 'drone', speed: 0.6 });
  for (const [x, z] of [[2.4, -4.2], [-1.6, -5.4], [3.9, -2.8], [-4.6, -5.6], [1.2, -6.4]]) ho.spawnKind(x, z, 180, { speed: 1.3 });
  ho.step(1 / 60, 50);
});
await shoot('33-special-robots');

// ---- 34. A bomber shot while it is still among its own.
await run(() => {
  const ho = window.__HO;
  const game = ho.game;
  ho.clearRobots();
  ho.place(0, 4.4, 0, -2);
  const bomber = game.robots[ho.spawnKind(0.2, -2.6, 0, { kind: 'bomber', hold: true })];
  for (const [x, z] of [[-1.3, -2.4], [1.6, -2.9], [0.4, -4.1], [-1.0, -4.0], [2.6, -1.6], [-2.8, -1.9]]) ho.spawnKind(x, z, 0, { hold: true });
  ho.step(1 / 60, 40);
  const aim = bomber.chest(new game.camera.position.constructor());
  const eye = game.camera.position;
  const p = game.player.position;
  ho.place(p.x, p.z, (Math.atan2(-(aim.x - eye.x), -(aim.z - eye.z)) * 180) / Math.PI, (Math.atan2(aim.y - eye.y, Math.hypot(aim.x - eye.x, aim.z - eye.z)) * 180) / Math.PI);
  ho.press('fire', true);
  for (let i = 0; i < 60 * 6 && !bomber.removed; i++) ho.step(1 / 60, 1);
  ho.press('fire', false);
  // A few frames into the blast.
  ho.step(1 / 60, 5);
});
await shoot('34-bomber-blast');

// ---- 36 and 37. A whole run by the skilled model, to its end: the screen it ends on, and ARGUS's profile of it.
await run(() => {
  const ho = window.__HO;
  ho.autopilot(false);
  ho.restart();
  ho.god(false);
  ho.steadyLights(false);
  ho.autopilot(true, 'skilled', true);
});
for (let i = 0; i < 400; i++) {
  const state = await run(() => {
    const ho = window.__HO;
    for (let k = 0; k < 900 && ho.game.state === 'playing'; k++) ho.simulate(1 / 60, 1);
    return ho.game.state;
  });
  if (state !== 'playing') break;
}
const ended = await run(() => {
  const ho = window.__HO;
  ho.autopilot(false);
  ho.step(1 / 60, 40);
  return ho.game.state;
});
await shoot(ended === 'saved' ? '36-run-ends-humanity-saved' : '36-run-ends-game-over');
await page.click(`.screen.${ended === 'saved' ? 'saved' : 'over'} [data-action="profile"]`);
// The card prints the page's own address, which here is this tool's local
// test server. In the picture it carries the game's public address if
// site-address.txt has one, and otherwise none.
{
  const address = fs.existsSync('site-address.txt') ? parseSiteAddress(fs.readFileSync('site-address.txt', 'utf8')) : '';
  await run((shown) => {
    const line = document.querySelector('.profile-url');
    if (line) line.textContent = shown;
  }, address.replace(/^https?:\/\//, ''));
}
await shoot('37-argus-profile');
await page.click('.screen.profile [data-action="profile-back"]');

// ---- Stage 4: the full economy. Stations, shutters, pickups, grenades, a swarm, the crate's special weapon, and the new screens.
{
  const facing = (from, to) => (Math.atan2(-(to[0] - from[0]), -(to[1] - from[1])) * 180) / Math.PI;
  const quiet = (power) =>
    run((power) => {
      const ho = window.__HO;
      ho.autopilot(false);
      // (By way of the start screen, so that the HUD is cleared as a real restart clears it: the debug restart leaves the last run's round on it.)
      ho.game.toTitle();
      ho.play();
      ho.restart();
      ho.step(1 / 60, 3);
      if (power) ho.missionJump('keys');
      ho.god(true);
      ho.holdRounds(true);
      ho.clearRobots();
      ho.steadyLights(true);
      for (const door of ho.game.world.doors) ho.openDoor(door.plan.id);
      ho.scrap(6000);
      ho.step(1 / 60, 150);
      ho.announcement.clear();
    }, power);
  /** Stand in front of a station, a little way back, looking at it. */
  const standAt = async (id, back = 0.75, side = 0, pitch = 5) => {
    const station = await run((id) => window.__HO.economy().stations.find((s) => s.id === id), id);
    const [sx, sz] = station.stand;
    const [lx, lz] = station.look;
    const length = Math.hypot(sx - lx, sz - lz) || 1;
    const ux = (sx - lx) / length;
    const uz = (sz - lz) / length;
    const from = [sx + ux * back - uz * side, sz + uz * back + ux * side];
    await run(([x, z, yaw, pitch]) => {
      const ho = window.__HO;
      ho.place(x, z, yaw, pitch);
      // (A jump across the map: the lamps round the new place take about a second to come up. Walking there, they are up long before.)
      ho.step(1 / 60, 120);
    }, [from[0], from[1], facing(from, [lx, lz]), pitch]);
  };

  // 47. Before the power is on: a Boost Station is dark, and says why.
  await quiet(false);
  await standAt('failsafe', 0.6, 0.3, 6);
  await shoot('47-boost-station-no-power');

  // 48 to 50. With the power on: the health boost beside the breaker, the reload boost in the hall, the fire-rate boost in the core.
  await quiet(true);
  await page.waitForTimeout(2800);
  await standAt('carapace', 0.6, -0.25, 6);
  await shoot('48-boost-station-carapace');
  await standAt('autoloader', 0.6, 0.25, 6);
  await shoot('49-boost-station-autoloader');
  await standAt('hairTrigger', 0.6, 0.25, 6);
  await shoot('50-boost-station-hair-trigger');

  // 51. The fail-safe, bought: its charge is gone from the station, and it is on the HUD.
  await standAt('failsafe', 0.6, 0.3, 6);
  await run(() => {
    const ho = window.__HO;
    ho.tap('interact');
    ho.step(1 / 60, 30);
  });
  await page.waitForTimeout(2600);
  await shoot('51-boost-station-failsafe-bought');

  // 52. The Overclock Bench, with the carbine in hand.
  await run(() => window.__HO.giveWeapon('carbine'));
  await step(40);
  await standAt('bench', 0.7, 0.3, 2);
  await shoot('52-overclock-bench');
  // 53. And at work.
  await run(() => {
    const ho = window.__HO;
    ho.tap('interact');
    ho.step(1 / 60, 22);
  });
  await shoot('53-overclock-bench-at-work');

  // 54. The Prototype Crate, holding out what it chose: the weapon found nowhere else.
  await standAt('crate', 0.7, 0.4, -6);
  await run(() => {
    const ho = window.__HO;
    ho.step(1 / 60, 60);
    ho.crateDice([0]);
    ho.tap('interact');
    ho.step(1 / 60, Math.round(ho.economy().rules.crate.cycleSeconds * 60) + 40);
  });
  await shoot('54-prototype-crate');

  // 55. The Turncoat in hand, and a robot it has just turned.
  await run(() => {
    const ho = window.__HO;
    ho.tap('interact');
    ho.step(1 / 60, 50);
    ho.place(0.4, 3.2, 0, 0);
    ho.spawnKind(-0.6, -1.6, 180, {});
    ho.spawnKind(1.4, -3.2, 180, {});
    ho.spawnKind(-2.2, -4.0, 180, {});
    ho.step(1 / 60, 30);
    ho.aimAtRobot('chest');
    ho.step(1 / 60, 2);
    ho.tap('fire');
    ho.step(1 / 60, 2);
  });
  // (Sooner than the others: the word under the crosshair is on real time.)
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '55-turncoat-beam.jpg'), type: 'jpeg', quality: 92 });
  console.log('  55-turncoat-beam.jpg');
  await step(26);
  await page.waitForTimeout(1200);
  await shoot('56-turned-robot');

  // 57. Timed pickups on the floor, and the HUD with the boosts and the timers of two that have been taken.
  await quiet(true);
  await run(() => {
    const ho = window.__HO;
    for (const id of ['carapace', 'autoloader', 'failsafe']) ho.setBoost(id, true);
    ho.place(0, 4.6, 0, -5);
    ho.step(1 / 60, 10);
    ho.dropPickup('overload', 0, 4.6);
    ho.dropPickup('doubleScrap', 0, 4.6);
    ho.step(1 / 60, 20);
    ['resupply', 'emp', 'lockdown', 'overload', 'doubleScrap'].forEach((id, i) => ho.dropPickup(id, -3.2 + i * 1.6, 0.4 - Math.abs(i - 2) * 0.5));
    ho.step(1 / 60, 40);
    ho.announcement.clear();
  });
  await shoot('57-pickups-and-timers');

  // 58. A shutter being battered from outside, and 59, the prompt to repair one that has been forced.
  await run(() => {
    const ho = window.__HO;
    ho.restart();
    ho.step(1 / 60, 3);
    ho.god(true);
    ho.holdRounds(true);
    ho.clearRobots();
    ho.steadyLights(true);
    ho.scrap(400);
    ho.place(0.5, -1.2, 4, 3);
    for (const x of [-1.1, 0, 1.1]) ho.spawnRobot(x, -9.4, 180, false, 3.0, 300);
    // Until the blow before the one that forces it.
    for (let frames = 0; frames < 60 * 30 && ho.economy().shutters.find((s) => s.id === 'yard').strength > 1; frames++) ho.step(1 / 60, 1);
    ho.step(1 / 60, 3);
    ho.announcement.clear();
  });
  await shoot('58-shutter-under-attack');
  await run(() => {
    const ho = window.__HO;
    ho.clearRobots();
    ho.setShutter(false, 'yard');
    ho.place(0.3, -4.9, 0, 6);
    ho.step(1 / 60, 30);
  });
  await shoot('59-shutter-repair-prompt');

  // 60. A grenade going off in a pack.
  await run(() => {
    const ho = window.__HO;
    ho.place(0, 5.2, 0, -3);
    for (const [x, z] of [[0, -3.2], [1.0, -3.9], [-1.0, -3.9], [0.2, -4.8], [-1.6, -2.8]]) ho.spawnKind(x, z, 180, { hold: true });
    ho.step(1 / 60, 20);
    ho.tap('grenade');
    // To the frame after it goes off.
    for (let frames = 0; frames < 60 * 4; frames++) {
      ho.step(1 / 60, 1);
      if (frames > 5 && ho.economy().grenadesInAir === 0) break;
    }
    ho.step(1 / 60, 3);
  });
  await shoot('60-grenade');

  // 61. A swarm round: its announcement, and the drones.
  await run(() => {
    const ho = window.__HO;
    ho.restart();
    ho.step(1 / 60, 3);
    ho.god(true);
    ho.steadyLights(true);
    ho.setShutter(false);
    ho.openDoor('lobbyHall');
    ho.place(0, 4.6, 0, 4);
    for (let frames = 0; frames < 60 * 600 && ho.run().round < 5; frames++) {
      ho.step(1 / 60, 1);
      if (ho.run().phase === 'active' && ho.run().round < 5) ho.skipRound();
      if (ho.run().phase === 'waiting' && frames % 30 === 0) ho.skipRound();
    }
    ho.announcement.freezeAt(1.1);
    // The round's own drones cross a room in under two seconds, which is a blur or a face full of rotor.
    // So the picture is of a pack of them held nearly still, as the first of the real ones come in behind.
    for (const [x, z] of [[-0.6, -0.4], [1.3, 0.6], [-2.2, -1.2], [2.6, -1.6], [0.4, -2.6], [-3.4, -2.8], [1.8, -3.8], [-1.2, -4.4], [3.6, -3.2]]) ho.spawnKind(x, z, 180, { kind: 'drone', speed: 0.5 });
    ho.step(1 / 60, 40);
  });
  await shoot('61-swarm-round');
  await run(() => {
    const ho = window.__HO;
    ho.announcement.freezeAt(null);
    ho.announcement.clear();
  });

  // 62 and 63. The screens: how to play, and settings from the start screen.
  await run(() => {
    const ho = window.__HO;
    ho.game.toTitle();
    // (So that the start screen's own scene is what is drawn behind its menus.)
    ho.step(1 / 60, 90);
  });
  await page.waitForTimeout(400);
  await page.click('.screen.title [data-action="howto"]');
  await shoot('62-how-to-play');
  await page.click('.screen.howto [data-action="back"]');
  await page.click('.screen.title [data-action="settings"]');
  await shoot('63-settings');
  await page.click('.screen.settings [data-action="back"]');
}

// ---- Stage 5: polish. The first-minute hints, the fail-safe as a moment, jumping, and the two corners that were plain.
{
  /** Let the game run at about real speed for a while (the HUD's own animations and the hints keep real time). */
  const live = async (seconds) => {
    for (let t = 0; t < seconds; t += 0.1) {
      await run(() => window.__HO.step(1 / 60, 6));
      await page.waitForTimeout(60);
    }
  };
  const fresh = (hints) =>
    run((hints) => {
      const ho = window.__HO;
      ho.autopilot(false);
      ho.hints(hints);
      ho.game.toTitle();
      ho.play();
      ho.god(true);
      ho.holdRounds(true);
      ho.clearRobots();
      ho.steadyLights(true);
      ho.announcement.clear();
      // (The strip listing every control comes up at the start of a run for a player who has the hints off. These pictures are of other things.)
      document.querySelector('.hud-hint').style.visibility = hints ? 'visible' : 'hidden';
    }, hints);

  // 65. A first-time player's first hint, and (66) the same hint done.
  await fresh(true);
  await overlay(false);
  await live(1.8);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '65-first-hint.jpg'), type: 'jpeg', quality: 92 });
  console.log('  65-first-hint.jpg');
  await run(() => window.__HO.press('forward', true));
  await live(0.9);
  await run(() => window.__HO.press('forward', false));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, '66-first-hint-done.jpg'), type: 'jpeg', quality: 92 });
  console.log('  66-first-hint-done.jpg');

  // 67 and 68. The fail-safe: down, and back up.
  await fresh(false);
  await run(() => {
    const ho = window.__HO;
    for (const door of ho.game.world.doors) ho.openDoor(door.plan.id);
    ho.missionJump('keys');
    ho.setBoost('failsafe', true);
    ho.place(0.3, 1.2, 0, 0);
    ho.step(1 / 60, 150);
    ho.announcement.clear();
    for (const [x, z] of [[-1.2, -0.6], [1.3, -0.8], [0.1, -1.2], [-2.6, -1.9], [2.8, -2.2], [0.6, -3.4]]) ho.spawnKind(x, z, 180, {});
    ho.god(false);
    ho.game.player.health = 15;
  });
  for (let i = 0; i < 900; i++) {
    const down = await run(() => {
      window.__HO.step(1 / 60, 1);
      return window.__HO.game.player.health <= 0;
    });
    if (down) break;
  }
  await live(0.7);
  await page.screenshot({ path: path.join(outDir, '67-failsafe-down.jpg'), type: 'jpeg', quality: 92 });
  console.log('  67-failsafe-down.jpg');
  await live(0.75);
  await page.screenshot({ path: path.join(outDir, '68-failsafe-engaged.jpg'), type: 'jpeg', quality: 92 });
  console.log('  68-failsafe-engaged.jpg');
  await run(() => {
    const ho = window.__HO;
    ho.god(true);
    ho.clearRobots();
  });

  // 69. Over the fence: inside the lab's assembly cell, with the robots coming round to its gateways.
  await fresh(false);
  await run(() => {
    const ho = window.__HO;
    for (const door of ho.game.world.doors) ho.openDoor(door.plan.id);
    ho.missionJump('keys');
    ho.giveWeapon('shotgun');
    ho.place(17.0, 20.25, 104, -3);
    ho.step(1 / 60, 150);
    ho.announcement.clear();
    // Some coming in by the west gateway, the rest held up at the fence.
    for (const [x, z] of [[12.3, 21.7], [11.4, 22.2], [10.6, 21.5], [9.9, 22.0]]) ho.spawnKind(x, z, 90, {});
    for (const [x, z] of [[14.6, 18.3], [16.6, 18.2], [12.4, 19.6]]) ho.spawnKind(x, z, 0, { speed: 0.4 });
    ho.step(1 / 60, 62);
  });
  await shoot('69-inside-the-fence');

  // 70. Up on the drums in the lobby corner (the corner a player once hid in), looking down at what has come for them.
  await run(() => {
    const ho = window.__HO;
    ho.clearRobots();
    ho.place(-7.94, -5.92, -128, -24, 0.87);
    ho.step(1 / 60, 150);
    for (const [x, z] of [[-5.2, -4.4], [-6.0, -2.9], [-4.1, -5.8], [-3.6, -3.2]]) ho.spawnKind(x, z, -120, {});
    ho.step(1 / 60, 80);
  });
  await shoot('70-on-the-drums');
  await run(() => window.__HO.clearRobots());

  // 71 and 72. The truck in the loading dock, close up and from its side.
  await run(() => {
    const ho = window.__HO;
    ho.place(-22.6, 15.9, 62, 2);
    ho.step(1 / 60, 150);
  });
  await shoot('71-truck-front');
  await run(() => {
    const ho = window.__HO;
    ho.place(-21.8, 10.4, 131, 0);
    ho.step(1 / 60, 150);
  });
  await shoot('72-truck-side');

  // 73. The server hall's west wall, from between two rows of racks.
  await run(() => {
    const ho = window.__HO;
    ho.place(-7.2, 11.4, 90, 6);
    ho.step(1 / 60, 150);
  });
  await shoot('73-server-hall-west-wall');
}

// 64. A phone: the title scene and a friendly note.
{
  const phone = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const phonePage = await phone.newPage();
  await phonePage.goto(`${site.url}?debug=1`);
  await phonePage.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
  await phonePage.evaluate(() => {
    window.__HO.freeze(true);
    window.__HO.steadyLights(true);
    window.__HO.step(1 / 60, 120);
  });
  await phonePage.waitForTimeout(800);
  await phonePage.screenshot({ path: path.join(outDir, '64-phone-message.jpg'), type: 'jpeg', quality: 92 });
  console.log('  64-phone-message.jpg');
  await phone.close();
}

const errors = [...new Set(problems)].filter((p) => !/X3595|gradient instruction/.test(p));
if (errors.length) console.log('Console errors:\n' + errors.join('\n'));
await browser.close();
await site.close();
console.log(`Saved to ${outDir}`);
