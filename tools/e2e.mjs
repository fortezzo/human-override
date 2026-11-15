// End-to-end check of the production build in a real (headless) browser.
//
//   npm run build && npm run e2e
//
// It serves dist/ from a sub-folder address, loads the game, and drives it
// through the debug tools the way a player would. Time is stepped by hand,
// so every result is exact and repeatable. It checks:
//
//   - the game loads with no console errors, at every quality level
//   - the picture: equally bright at every quality level, shadows not
//     solid black, the brightness setting works
//   - scrap: what a hit, a kill, a weak-point kill and a melee kill pay
//   - every kind of purchase, and that each charges the right amount
//   - the player cannot leave the map
//   - a change of quality level mid-game leaves no shader to be built late
//   - a robot from every entry point reaches the player in every area
//   - whole rounds played by the autopilot, with purchases
//   - going down without god mode reaches the game-over screen
//   - restarting three times leaves nothing behind
//   - pause and resume; phones get a notice instead of a broken game
//
// The mission, ARGUS and the rest of the economy arrive in later stages and
// are added to this script with them.

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

const ev = (fn, arg) => page.evaluate(fn, arg);
const step = (frames) => ev((frames) => window.__HO.step(1 / 60, frames), frames);
const stats = () => ev(() => window.__HO.stats());
const run = () => ev(() => window.__HO.run());
const tap = (action) => ev((action) => window.__HO.tap(action), action);
const place = (x, z, yaw) => ev(([x, z, yaw]) => window.__HO.place(x, z, yaw), [x, z, yaw]);

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
  ev(
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

/** A clean, quiet lobby with one robot standing in front of the player, for exact scrap sums. */
async function oneRobot(health) {
  await ev((health) => {
    const ho = window.__HO;
    ho.holdRounds(true);
    ho.clearRobots();
    ho.place(0, 4.6, 0);
    ho.spawnRobot(0, 1.2, 0, true, 1.2, health);
    ho.step(1 / 60, 20);
  }, health);
}

/** Aim at the robot and fire single shots until it is destroyed. Returns how many it took. */
async function shootUntilDestroyed(part) {
  let shots = 0;
  for (; shots < 30; shots++) {
    const alive = await ev((part) => {
      const ho = window.__HO;
      if (!ho.game.robots.some((r) => r.alive)) return false;
      ho.aimAtRobot(part);
      ho.step(1 / 60, 2);
      ho.tap('fire');
      ho.step(1 / 60, 16);
      return true;
    }, part);
    if (!alive) break;
  }
  await step(40);
  return shots;
}

try {
  // ---------------------------------------------------------------- loading
  const started = Date.now();
  await page.goto(`${site.url}?debug=1`);
  await page.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
  const loadSeconds = (Date.now() - started) / 1000;
  console.log(`GPU: ${await gpuName(page)}`);
  check('loads from a sub-folder address', true, `${loadSeconds.toFixed(1)} s to title screen`);
  check('title screen is showing', (await stats()).state === 'title' && (await page.locator('.screen.title').isVisible()));

  for (const level of ['low', 'medium', 'high', 'ultra']) {
    await ev((level) => window.__HO.setQuality(level), level);
    await page.waitForTimeout(2000);
    const s = await stats();
    check(`renders at ${level} quality`, s.quality === level && s.fps > 5, `${s.fps} fps, ${s.calls} draw calls, ${s.triangles} triangles`);
  }
  await ev(() => window.__HO.setQuality('high'));

  // ------------------------------------------------------------- the picture
  await ev(() => {
    const ho = window.__HO;
    ho.freeze(true);
    ho.play();
    ho.holdRounds(true);
    ho.photoMode(true);
    ho.steadyLights(true);
    ho.view(0, 1.7, 4.6, 0, 0, 74);
    // A new run fades in from black; let that finish before measuring.
    ho.step(1 / 60, 180);
  });
  const pictures = {};
  for (const level of ['low', 'medium', 'high', 'ultra']) {
    await ev((level) => {
      window.__HO.setQuality(level);
      window.__HO.step(1 / 60, 30);
    }, level);
    pictures[level] = await measurePicture();
  }
  const means = Object.values(pictures).map((p) => p.mean);
  const summary = Object.entries(pictures).map(([level, p]) => `${level} ${p.mean.toFixed(1)}`).join(', ');
  check('the room is equally bright at every quality level', Math.max(...means) - Math.min(...means) < 2.5, `average brightness out of 255: ${summary}`);
  const blackest = Math.max(...Object.values(pictures).map((p) => p.black));
  check('shadows keep their detail', blackest < 12, `at most ${blackest.toFixed(1)}% of the picture is near black`);

  await ev(() => window.__HO.setQuality('high'));
  await step(20);
  const normal = await measurePicture();
  const moved = await setSlider('Brightness', 1.5);
  await step(2);
  const brighter = await measurePicture();
  await setSlider('Brightness', 1);
  await step(2);
  const restored = await measurePicture();
  check(
    'the brightness setting brightens the picture',
    moved && brighter.mean > normal.mean + 8 && Math.abs(restored.mean - normal.mean) < 1.5,
    `${normal.mean.toFixed(1)} -> ${brighter.mean.toFixed(1)} at 150% -> ${restored.mean.toFixed(1)} back at 100%`,
  );
  await ev(() => {
    const ho = window.__HO;
    ho.photoMode(false);
    ho.steadyLights(false);
    ho.releaseView();
  });

  // ------------------------------------------------------- a run starts
  await ev(() => window.__HO.restart());
  let r = await run();
  check('a new run starts with the sidearm, no scrap and every door shut', r.slots[0] === 'pistol' && r.slots[1] === null && r.scrap === 0 && Object.values(r.doors).every((open) => !open) && r.area === 'lobby');
  await step(5 * 60);
  r = await run();
  check('round 1 starts within five seconds of pressing Play', r.round === 1 && r.phase === 'active' && r.robots.length > 0, `${r.robots.length} robot(s) on the map after 5 s`);
  check('the HUD shows the round and scrap', (await page.locator('.hud-round-number').textContent()) === '1' && (await page.locator('.hud-scrap-count').isVisible()));
  const z0 = r.robots[0].z;
  await step(120);
  r = await run();
  check('robots advance on the player', r.robots[0].z > z0 + 1.5, `the first moved ${(r.robots[0].z - z0).toFixed(1)} m in 2 s`);

  // ---------------------------------------------------------------- scrap
  await ev(() => {
    const ho = window.__HO;
    ho.god(true);
    ho.holdRounds(true);
    ho.clearRobots();
  });
  // Round 1 robots have 70 health; the sidearm does 28 to the body.
  const health = 70;
  let before = (await run()).scrap;
  await oneRobot(health);
  const bodyShots = await shootUntilDestroyed('chest');
  r = await run();
  check('body shots pay 10 a hit and 60 for the kill', r.scrap - before === (bodyShots - 1) * 10 + 60 && bodyShots === 3, `${bodyShots} shots paid ${r.scrap - before}`);

  before = r.scrap;
  await oneRobot(health);
  const headShots = await shootUntilDestroyed('head');
  r = await run();
  check('a weak-point kill pays 100, and the head takes fewer shots', r.scrap - before === (headShots - 1) * 10 + 100 && headShots < bodyShots, `${headShots} shots paid ${r.scrap - before}`);

  before = r.scrap;
  await oneRobot(health);
  await ev(() => {
    const ho = window.__HO;
    ho.place(0, 2.7, 0);
    ho.step(1 / 60, 4);
    ho.aimAtRobot('chest');
    ho.tap('melee');
    ho.step(1 / 60, 60);
  });
  r = await run();
  check('a melee kill pays 130', r.scrap - before === 130 && r.robots.filter((q) => q.alive).length === 0, `paid ${r.scrap - before}`);
  check('destroyed robots break into scrap', (await stats()).gibs >= 8, `${(await stats()).gibs} pieces on the floor`);

  // ------------------------------------------------------------ purchases
  // Start from an empty wallet.
  await ev(() => {
    const ho = window.__HO;
    ho.clearRobots();
    ho.game.wallet.scrap = 0;
  });
  const rack = async () => {
    await place(-4.5, -0.9, 0);
    await step(4);
  };
  await rack();
  r = await run();
  const shotgunPrice = r.prompt?.cost;
  check('the shotgun rack shows a prompt with its price', r.prompt?.text.includes('DB-12') && shotgunPrice === 750 && r.prompt.usable === false, `"${r.prompt?.text}" ${shotgunPrice}`);
  check('the prompt is on screen', (await page.locator('.hud-prompt.show').count()) === 1 && (await page.locator('.hud-prompt-cost').textContent()).includes('750'));
  await tap('interact');
  r = await run();
  check('a purchase the player cannot afford is refused and costs nothing', r.scrap === 0 && r.slots[1] === null);

  await ev(() => window.__HO.scrap(5000));
  await rack();
  await tap('interact');
  await step(40);
  r = await run();
  check('buying a wall weapon charges its price and puts it in hand', r.scrap === 5000 - 750 && r.weapon === 'shotgun' && r.slots.join() === 'pistol,shotgun' && r.ammo === 6 && r.reserve === 30, `scrap ${r.scrap}, holding ${r.weapon}`);

  // Fire it, then buy ammunition at the same rack.
  await ev(() => {
    const ho = window.__HO;
    ho.place(0, 4.6, 0);
    ho.spawnRobot(0, 2.6, 0, true, 1.2, 4000);
    ho.step(1 / 60, 20);
    ho.aimAtRobot('chest');
    ho.step(1 / 60, 2);
  });
  before = (await run()).scrap;
  await tap('fire');
  await step(40);
  r = await run();
  check('one shotgun shell pays one hit, however many pellets land', r.scrap - before === 10 && r.ammo === 5, `paid ${r.scrap - before}`);
  await ev(() => window.__HO.clearRobots());
  await rack();
  r = await run();
  check('the rack now offers ammunition at its own price', r.prompt?.text.includes('Ammunition') && r.prompt.cost === 375);
  before = r.scrap;
  await tap('interact');
  await step(3);
  r = await run();
  check('buying ammunition charges its price and fills the weapon', before - r.scrap === 375 && r.ammo === 6 && r.reserve === 48, `scrap ${before} -> ${r.scrap}, ${r.ammo} / ${r.reserve}`);
  before = r.scrap;
  await tap('interact');
  r = await run();
  check('a full weapon cannot be sold more ammunition', r.scrap === before && r.prompt?.cost === null);

  // Doors.
  await place(0, 5.4, 180);
  await step(4);
  r = await run();
  check('the blast door shows a prompt with its price', r.prompt?.text.includes('Server Hall') && r.prompt.cost === 750);
  before = r.scrap;
  await tap('interact');
  await step(130);
  r = await run();
  check('opening a door charges its price', before - r.scrap === 750 && r.doors.lobbyHall === true, `scrap ${before} -> ${r.scrap}`);
  await place(-1, 10.2, 180);
  await step(8);
  r = await run();
  check('the player can walk through into the server hall', r.area === 'hall');

  // Two-weapon limit: a third weapon replaces the one in hand.
  await place(1.6, 10.1, 180);
  await step(4);
  r = await run();
  check('the carbine rack is in the server hall', r.prompt?.text.includes('KR-7') && r.prompt.cost === 1500, `"${r.prompt?.text}"`);
  before = r.scrap;
  await tap('interact');
  await step(40);
  r = await run();
  check('a third weapon replaces the one in hand', before - r.scrap === 1500 && r.slots.join() === 'pistol,carbine' && r.weapon === 'carbine', `carrying ${r.slots.join(' + ')}`);

  // The other two doors, and the one that cannot be bought.
  await place(8.0, 11.4, -90);
  await step(4);
  before = (await run()).scrap;
  await tap('interact');
  await step(130);
  r = await run();
  check('the service door to the power room charges its price', before - r.scrap === 1250 && r.doors.hallPower === true, `scrap ${before} -> ${r.scrap}`);
  // By now the wallet is nearly empty: the next door must refuse, then open once topped up.
  await place(10.6, 3.6, 90);
  await step(8);
  before = (await run()).scrap;
  await tap('interact');
  await step(10);
  r = await run();
  check('a door the player cannot afford stays shut', before < 1000 && r.scrap === before && r.doors.lobbyPower === false && r.area === 'power', `${before} scrap, the door costs 1000`);
  await ev(() => window.__HO.scrap(2000));
  await step(2);
  before = (await run()).scrap;
  await tap('interact');
  await step(130);
  r = await run();
  check('the power room door opens from the far side too', before - r.scrap === 1000 && r.doors.lobbyPower === true, `scrap ${before} -> ${r.scrap}`);
  await place(-1, 23.7, 180);
  await step(8);
  r = await run();
  before = r.scrap;
  const sealed = r.prompt;
  await tap('interact');
  await step(10);
  r = await run();
  check('the core is sealed and cannot be bought', sealed?.cost === null && sealed.usable === false && r.scrap === before && r.doors.hallCore === false, `"${sealed?.text}"`);
  check('scrap spent adds up', r.spent === 750 + 375 + 750 + 1500 + 1250 + 1000, `spent ${r.spent}`);

  // ----------------------------------------------------- weapons in hand
  await ev(() => {
    const ho = window.__HO;
    ho.place(0, 4.6, 0);
    ho.spawnRobot(0, 0.6, 0, true, 1.2, 100000);
    ho.step(1 / 60, 20);
    ho.aimAtRobot('chest');
    ho.press('fire', true);
    ho.step(1 / 60, 1);
  });
  const flashOn = (await stats()).flash;
  await step(30);
  await ev(() => window.__HO.press('fire', false));
  r = await run();
  check('the carbine fires automatically while the trigger is held', r.ammo <= 30 - 5, `${30 - r.ammo} rounds in half a second`);
  await step(4);
  check('the muzzle flash lasts only an instant', flashOn && !(await stats()).flash, 'gone within 4 frames');
  await ev(() => window.__HO.press('aim', true));
  await step(40);
  const raised = await stats();
  await ev(() => window.__HO.press('aim', false));
  await step(40);
  const lowered = await stats();
  check('aiming the carbine brings up the sight and its reticle', raised.aim > 0.95 && raised.reticle > 0.95 && lowered.reticle === 0, `reticle ${raised.reticle.toFixed(2)} raised, ${lowered.reticle.toFixed(2)} lowered`);
  await tap('reload');
  await step(150);
  r = await run();
  check('reload refills the magazine from the spares', r.ammo === 30 && r.reserve < 150, `${r.ammo} / ${r.reserve}`);
  await tap('weapon1');
  await step(40);
  r = await run();
  check('1 and 2 switch weapons', r.weapon === 'pistol');
  await tap('weapon2');
  await step(40);
  await ev(() => window.__HO.clearRobots());

  // ------------------------------------------------------ the edge of the map
  // The player may step out into the yard the robots arrive across, but not
  // past the barriers around it.
  const sprintFrom = (x, z, yaw, frames) =>
    ev(
      ([x, z, yaw, frames]) => {
        const ho = window.__HO;
        ho.place(x, z, yaw);
        ho.press('forward', true);
        ho.press('sprint', true);
        ho.step(1 / 60, frames);
        ho.press('forward', false);
        ho.press('sprint', false);
        ho.step(1 / 60, 2);
        const p = ho.game.player.position;
        return [p.x, p.z];
      },
      [x, z, yaw, frames],
    );
  const outside = await sprintFrom(-0.6, -6, 0, 150);
  check('the player can step out into the yard', outside[1] < -13.5, `reached z ${outside[1].toFixed(1)}`);
  const pushes = [];
  for (const [x, z, yaw] of [[4.5, -18.5, -90], [-4.5, -18.5, 90], [0, -18.5, 0], [5.2, -19, -45], [-5.2, -19, 45], [5.4, -13.2, -90], [-5.4, -13.2, 90], [5.3, -13.4, 180], [-5.3, -13.4, 180]]) {
    pushes.push(await sprintFrom(x, z, yaw, 240));
  }
  const farthest = pushes.reduce((worst, [x, z]) => Math.max(worst, Math.abs(x) - 6, -20 - z, z > -12.6 && Math.abs(x) > 2.7 ? 1 : -9), -9);
  check('the barriers around the yard cannot be passed', farthest < 0, `sprinting at them from nine places, the closest the player came to the edge was ${(-farthest).toFixed(2)} m inside it`);
  await ev(() => window.__HO.place(0, 3, 0));

  // ------------------------------------------- changing quality in mid-game
  // How many lights cast shadows is built into every shader, so a change of
  // quality level rebuilds them all. That has to happen at the change, for
  // everything at once: a shader built late freezes the picture for up to a
  // second the first time it is needed (the next robot through the door,
  // the next gun raised). The game changes level by itself on slow
  // computers, so this is the case that matters most.
  const programIds = () => ev(() => window.__HO.game.renderer.three.info.programs.map((p) => p.id));
  const builtLate = {};
  for (const level of ['low', 'ultra', 'high']) {
    await ev((level) => {
      const ho = window.__HO;
      ho.clearRobots();
      ho.setQuality(level);
      ho.step(1 / 60, 30);
    }, level);
    const before = await programIds();
    // The next robot to appear, its destruction and the scrap it leaves,
    // then each weapon swapped in, fired and aimed.
    await oneRobot(40);
    await shootUntilDestroyed('chest');
    for (const slot of ['weapon1', 'weapon2']) {
      await tap(slot);
      await step(40);
      await ev(() => {
        const ho = window.__HO;
        ho.tap('fire');
        ho.step(1 / 60, 10);
        ho.press('aim', true);
        ho.step(1 / 60, 30);
        ho.press('aim', false);
        ho.step(1 / 60, 20);
      });
    }
    const after = await programIds();
    builtLate[level] = after.filter((id) => !before.includes(id)).length;
  }
  check(
    'a change of quality level rebuilds every shader at once, leaving none to stall the game later',
    Object.values(builtLate).every((count) => count === 0),
    Object.entries(builtLate)
      .map(([level, count]) => `to ${level}: ${count} built late`)
      .join(', '),
  );
  await ev(() => window.__HO.clearRobots());

  // ------------------------------------------------- every way in, every area
  await ev(() => {
    const ho = window.__HO;
    ho.openDoor('hallCore');
    ho.god(false);
    ho.step(1 / 60, 130);
  });
  const SPOTS = { yard: [0, 2, 0], lobbyVent: [-3, 3, 90], dock: [-1, 16.5, 90], hallVent: [4.5, 23.5, 0], eastBreach: [14, 6, -90], powerVent: [16, 8, 90], coreVentWest: [-1, 30, 90], coreVentEast: [-1, 34, -90] };
  for (const [entry, [x, z, yaw]] of Object.entries(SPOTS)) {
    await ev(
      ([entry, x, z, yaw]) => {
        const ho = window.__HO;
        ho.game.player.health = 100;
        ho.clearRobots();
        ho.place(x, z, yaw);
        ho.forceEntry(entry);
        ho.holdRounds(false);
        ho.skipRound();
      },
      [entry, x, z, yaw],
    );
    let seconds = -1;
    let state = await run();
    for (let t = 0; t < 80 && seconds < 0; t++) {
      await step(30);
      state = await run();
      if (state.health < 100) seconds = (t + 1) * 0.5;
    }
    const from = [...new Set(state.robots.map((q) => q.entry))].join(',');
    check(`a robot from "${entry}" reaches the player in the ${state.area}`, seconds > 0 && from === entry, seconds > 0 ? `after ${seconds.toFixed(1)} s` : 'never arrived');
  }
  await ev(() => window.__HO.forceEntry(null));

  // ------------------------------------------------------------- game over
  // Left alone without god mode, the player goes down.
  let over = false;
  for (let t = 0; t < 240 && !over; t++) {
    await step(30);
    over = (await run()).state === 'over';
  }
  r = await run();
  const overVisible = await page.locator('.screen.over').isVisible();
  const overText = overVisible ? await page.locator('.over-title').textContent() : '';
  check('without god mode the player goes down and the game-over screen shows the round', over && overVisible && overText.includes(`ROUND ${r.round}`), overText.trim());

  // ------------------------------------------------- restart, three times
  let clean = true;
  let detail = '';
  for (let i = 0; i < 3; i++) {
    // Leave some scrap behind from the run before, to be sure it does not carry over.
    await ev(() => window.__HO.scrap(1234));
    await step(2);
    await page.waitForTimeout(120);
    await ev(() => window.__HO.restart());
    await step(2);
    let s = await run();
    await page.waitForTimeout(120);
    const shownScrap = await page.locator('.hud-scrap-count').textContent();
    const fresh =
      s.state === 'playing' && s.round === 0 && s.robots.length === 0 && s.scrap === 0 && shownScrap === '0' && s.slots.join() === 'pistol,' && Object.values(s.doors).every((open) => !open) && s.health === 100 && s.area === 'lobby';
    // One press of the trigger fires exactly one round: no doubled-up input.
    await tap('fire');
    await step(20);
    s = await run();
    const oneShot = s.ammo === 11;
    // Round 1 starts once, with only round 1's robots: no timers left running from before.
    await step(8 * 60);
    s = await run();
    const oneRound = s.round === 1 && s.robots.length <= 6;
    if (!(fresh && oneShot && oneRound)) {
      clean = false;
      detail += ` restart ${i + 1}: fresh=${fresh} oneShot=${oneShot} round=${s.round} robots=${s.robots.length};`;
    }
    // Go down again for the next restart.
    await ev(() => {
      window.__HO.god(false);
      window.__HO.game.player.health = 1;
    });
    for (let t = 0; t < 240 && (await run()).state !== 'over'; t++) await step(30);
  }
  check('restarting three times leaves no leftover robots, timers or doubled-up input', clean && (await run()).state === 'over', detail.trim());
  check('the best round is remembered', (await ev(() => JSON.parse(localStorage.getItem('human-override.best.v1') ?? '{}').round)) >= 1);

  // ------------------------------------------- the autopilot plays rounds
  await ev(() => {
    const ho = window.__HO;
    ho.restart();
    ho.god(true);
    ho.autopilot(true);
  });
  let played = await run();
  let frames = 0;
  for (; frames < 60 * 60 * 6 && played.round < 4; frames += 120) {
    await step(120);
    played = await run();
  }
  check('the autopilot plays through three rounds by itself', played.round >= 4 && played.kills >= 6 + 8 + 11, `round ${played.round}, ${played.kills} destroyed in ${(frames / 3600).toFixed(1)} game minutes`);
  check('it earns scrap and spends it', played.earned > 1000 && played.spent > 0 && played.slots[1] !== null, `earned ${played.earned}, spent ${played.spent}, carrying ${played.slots.join(' + ')}`);

  // When only a few robots are left, they are marked.
  await ev(() => {
    const ho = window.__HO;
    ho.autopilot(false);
    ho.holdRounds(true);
  });
  let marked = false;
  for (let t = 0; t < 400 && !marked; t++) {
    const s = await run();
    if (s.remaining > 0 && s.remaining <= 3 && s.robots.some((q) => q.alive)) {
      await step(2);
      await page.waitForTimeout(60);
      marked = (await page.locator('.robot-marker:not(.hidden)').count()) === Math.min(3, s.robots.filter((q) => q.alive).length);
      break;
    }
    await ev(() => {
      const ho = window.__HO;
      ho.holdRounds(false);
      ho.autopilot(true);
      ho.step(1 / 60, 30);
      ho.autopilot(false);
      ho.holdRounds(true);
    });
  }
  check('the last few robots of a round are marked on the HUD', marked);

  // ------------------------------------------------------ pause and resume
  await ev(() => {
    const ho = window.__HO;
    ho.holdRounds(false);
    ho.game.setState('paused');
  });
  await step(5);
  const pausedVisible = await page.locator('.screen.pause').isVisible();
  const p0 = (await run()).robots.map((q) => q.z.toFixed(3)).join();
  await step(60);
  const p1 = (await run()).robots.map((q) => q.z.toFixed(3)).join();
  check('pause shows the menu and freezes the world', pausedVisible && p0 === p1);
  await ev(() => window.__HO.play());
  await step(5);
  check('resume returns to the same run', (await stats()).state === 'playing' && !(await page.locator('.screen.pause').isVisible()) && (await run()).round >= played.round);
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
