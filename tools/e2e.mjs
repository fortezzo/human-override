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
//   - every door (the core's included, unsealed with the three keys),
//     opened with F and walked through on foot from both sides at every
//     quality level: the room beyond is never near black
//   - every room is closed off by its own walls, nothing stands across a
//     doorway, and a robot in the darkest places still stands out from
//     what is behind it
//   - no room's reflection photograph has a broken pixel, and one broken
//     pixel cannot black out a room if it ever does
//   - no robot is ever created in view: the places robots walk in from
//     cannot be seen from indoors, and with the player standing and staring
//     at each entry in turn the rounds use another one
//   - a robot from every entry point reaches the player in every area
//   - the round announcement: the number snaps in behind a scan line, is
//     held above the crosshair while the game carries on, and flies to the
//     corner counter; the plain version with flashing reduced; and the
//     "cleared" line with the scrap the round paid
//   - the mission, start to finish: power restored at the breaker, the
//     three override keys (the cage, the uplink held for a minute, the
//     Custodian destroyed), the core unsealed, the kill switch armed
//     through the final stand with ARGUS's Proxy destroyed, the switch
//     pulled, every robot powered down, HUMANITY SAVED, and three more
//     rounds played afterward
//   - whole rounds played by the autopilot, with purchases
//   - going down without god mode reaches the game-over screen
//   - restarting three times leaves nothing behind
//   - pause and resume; phones get a notice instead of a broken game
//   - the real buttons, pressed with real clicks: the mouse is captured
//     and released when it should be, and "Auto" quality means what it says
//   - every key on the controls list, really pressed
//   - with the browser slowed down to imitate a weak computer, the game
//     lowers its own quality and says so
//
// ARGUS's adaptations and the rest of the economy arrive in later stages
// and are added to this script with them.

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
  // ---------------------------------------------- the round announcement
  // It is part of the HUD and is timed against the round sting, so it runs
  // on real time, not on the stepped game clock. The debug tools can hold
  // it at any moment, which is how its stages are looked at here.
  const announcement = () => ev(() => window.__HO.announcement.status());
  const lettering = () =>
    ev(() => {
      const box = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
      };
      const style = (selector) => getComputedStyle(document.querySelector(selector));
      const row = style('.announce-row');
      const logo = style('.logo');
      return {
        word: document.querySelector('.announce-word').textContent,
        number: document.querySelector('.announce-number').textContent,
        numberColour: style('.announce-number').color,
        sub: document.querySelector('.announce-start .announce-sub').textContent,
        shown: Number(style('.announce-start').opacity),
        sameType: row.fontFamily === logo.fontFamily && row.fontWeight === logo.fontWeight && Math.abs(parseFloat(row.letterSpacing) / parseFloat(row.fontSize) - parseFloat(logo.letterSpacing) / parseFloat(logo.fontSize)) < 0.01,
        titleRed: style('.logo span').color,
        scan: Number(style('.announce-scan').opacity),
        lines: Number(style('.announce-lines').opacity),
        rowStyle: document.querySelector('.announce-row').style.cssText,
        row: box('.announce-row'),
        crosshair: box('.crosshair'),
        view: { width: window.innerWidth, height: window.innerHeight },
      };
    });
  let a = await announcement();
  check('a new round is announced the moment it begins, before the corner counter changes', a.showing === 'start' && a.seconds < 0.6 && a.counter === '', `${a.seconds.toFixed(2)} s into the announcement, the counter still blank`);
  await ev(() => window.__HO.announcement.freezeAt(0.1));
  await page.waitForTimeout(120);
  let look = await lettering();
  check(
    'it snaps in behind a scan line that crosses the whole view',
    look.shown === 1 && look.scan > 0.5 && look.lines > 0 && /skewX\(-/.test(look.rowStyle) && look.rowStyle.includes('rgba(255, 67, 38'),
    `a tenth of a second in: lettering fully shown, scan line at ${Math.round(look.scan * 100)}% strength`,
  );
  await ev(() => window.__HO.announcement.freezeAt(1.0));
  await page.waitForTimeout(120);
  look = await lettering();
  check(
    "it is the round number in the title's lettering, with the numeral in red",
    look.word === 'ROUND' && look.number === '1' && look.sameType && look.numberColour === look.titleRed && look.sub === '6 ROBOTS INBOUND',
    `"${look.word} ${look.number}", "${look.sub}"`,
  );
  const covered = (look.row.width * look.row.height) / (look.view.width * look.view.height);
  check(
    'it is lettering only, above the crosshair, and small enough to see past',
    look.row.bottom < look.crosshair.top - 20 && covered < 0.12 && look.scan === 0,
    `its foot is ${Math.round(look.crosshair.top - look.row.bottom)} px above the crosshair, and it covers ${(covered * 100).toFixed(1)}% of the view`,
  );
  const robotThen = (await run()).robots[0];
  await step(30);
  const runNow = await run();
  const robotMoved = Math.hypot(runNow.robots[0].x - robotThen.x, runNow.robots[0].z - robotThen.z);
  check('the game carries on underneath it', runNow.state === 'playing' && runNow.phase === 'active' && robotMoved > 0.3, `a robot moved ${robotMoved.toFixed(2)} m in half a second`);
  // Let it run on: the numeral flies to the corner counter, which takes the number and pulses.
  await ev(() => window.__HO.announcement.freezeAt(null));
  const pulsed = await page
    .waitForFunction(() => /scale\(1\.[0-9]*[1-9]/.test(document.querySelector('.hud-round-number').style.transform) && document.querySelector('.hud-round-number').textContent === '1', null, { timeout: 4000, polling: 'raf' })
    .then(() => true)
    .catch(() => false);
  a = await announcement();
  check('after about a second and a half it flies to the corner counter, which takes the number and pulses', pulsed && a.showing === 'none' && a.counter === '1' && a.seconds < 2.4, `gone ${a.seconds.toFixed(2)} s after it appeared; the counter reads "${a.counter}"`);
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
  // Its flash is a small burst drawn for one frame: on for the frame the
  // gun fires (however short its time is set), gone by the next.
  const burst = [(await stats()).flash];
  await step(1);
  burst.push((await stats()).flash);
  await step(39);
  r = await run();
  check("the shotgun's muzzle flash is drawn on the frame it fires and is gone by the next", burst[0] === true && burst[1] === false, `firing frame: ${burst[0] ? 'on' : 'off'}; next frame: ${burst[1] ? 'on' : 'off'}`);
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
  // Walking and sprinting reach the speeds set for them (4.3 and 6.4 metres
  // a second). Sprinting once changed the view and nothing else.
  const speedAfterHalfASecond = (sprint) =>
    ev((sprint) => {
      const ho = window.__HO;
      ho.place(0, 4.6, 0);
      ho.step(1 / 60, 5);
      ho.press('forward', true);
      if (sprint) ho.press('sprint', true);
      ho.step(1 / 60, 30);
      const v = ho.game.player.velocity;
      const speed = Math.hypot(v.x, v.z);
      ho.press('forward', false);
      ho.press('sprint', false);
      ho.step(1 / 60, 20);
      return speed;
    }, sprint);
  const walking = await speedAfterHalfASecond(false);
  const sprinting = await speedAfterHalfASecond(true);
  check('sprinting is faster than walking, and both reach the speeds set for them', Math.abs(walking - 4.3) < 0.1 && Math.abs(sprinting - 6.4) < 0.15, `${walking.toFixed(2)} and ${sprinting.toFixed(2)} metres a second`);

  // Sprinting is paid for with stamina: a full bar lasts about four
  // seconds, running it dry leaves the player winded (walking pace only)
  // until some of it has come back, and the thin bar by the vitals shows it.
  const stamina = await ev(() => {
    const ho = window.__HO;
    const p = ho.game.player;
    const speed = () => Math.hypot(p.velocity.x, p.velocity.z);
    const bar = () => Number(/scaleX\(([\d.]+)\)/.exec(document.querySelector('.hud-stamina-fill')?.style.transform ?? '')?.[1] ?? -1);
    const out = {};
    // Up and down the long axis of the lobby, turning before each wall.
    const run = (frames) => {
      for (let i = 0; i < frames; i++) {
        // (Turned by hand, not with place(): that starts the player afresh, stamina included.)
        if (p.position.x > 5.5) p.yaw = Math.PI / 2;
        if (p.position.x < -5.5) p.yaw = -Math.PI / 2;
        ho.step(1 / 60, 1);
      }
    };
    ho.place(-5, 5.6, -90);
    // Start rested, whatever the checks before this one did.
    Object.assign(p.stamina, { level: 1, idle: 99, winded: false });
    ho.step(1 / 60, 5);
    ho.press('forward', true);
    ho.press('sprint', true);
    run(60);
    out.sprintSpeed = speed();
    run(60);
    out.levelAfterTwoSeconds = p.stamina.level;
    run(200);
    out.windedSpeed = speed();
    out.winded = p.stamina.winded;
    out.sprintingWhileWinded = p.sprinting;
    ho.press('sprint', false);
    run(60);
    out.levelAfterRestStarts = p.stamina.level;
    ho.press('forward', false);
    ho.step(1 / 60, 60 * 7);
    out.levelAfterLongRest = p.stamina.level;
    out.windedAfterRest = p.stamina.winded;
    return out;
  });
  await page.waitForTimeout(250);
  const staminaBar = await ev(() => Number(/scaleX\(([\d.]+)\)/.exec(document.querySelector('.hud-stamina-fill')?.style.transform ?? '')?.[1] ?? -1));
  check(
    'sprinting drains stamina, a winded player can only walk, and the bar refills with rest',
    stamina.sprintSpeed > 6.2 && Math.abs(stamina.levelAfterTwoSeconds - 0.5) < 0.06 && stamina.winded && !stamina.sprintingWhileWinded && stamina.windedSpeed < 4.5 && stamina.levelAfterLongRest === 1 && !stamina.windedAfterRest && staminaBar > 0.98,
    `${stamina.sprintSpeed.toFixed(1)} m/s sprinting, ${Math.round(stamina.levelAfterTwoSeconds * 100)}% of the bar left after 2 s, ${stamina.windedSpeed.toFixed(1)} m/s once winded, ${Math.round(stamina.levelAfterLongRest * 100)}% after a rest (bar on screen ${Math.round(staminaBar * 100)}%)`,
  );

  // Robots are solid: the player cannot walk through one.
  const blocked = await ev(() => {
    const ho = window.__HO;
    ho.clearRobots();
    ho.place(0, 4.6, 0);
    ho.spawnRobot(0, 2.2, 180, true, 1.2, 5000);
    ho.step(1 / 60, 10);
    ho.press('forward', true);
    ho.step(1 / 60, 120);
    ho.press('forward', false);
    const p = ho.game.player.position;
    const robot = ho.game.robots[0].position;
    const result = { gap: Math.hypot(p.x - robot.x, p.z - robot.z), z: p.z };
    ho.clearRobots();
    return result;
  });
  check('robots are solid: the player cannot walk through one', blocked.z > 2.2 && blocked.gap > 0.55, `stopped ${blocked.gap.toFixed(2)} m from its centre`);

  // Blows cannot land in a flurry: after one lands there is a moment of
  // grace, so three robots at once do not mean down in under a second.
  const flurry = await ev(() => {
    const ho = window.__HO;
    const g = ho.game;
    ho.clearRobots();
    ho.god(false);
    ho.place(0, 3, 0);
    for (const [x, z] of [[0, 1.9], [1.0, 3.4], [-1.0, 3.4], [0, 4.1]]) ho.spawnRobot(x, z, 0, false, 1.5, 5000);
    const drops = [];
    let last = g.player.health;
    for (let frame = 0; frame < 60 * 6 && g.player.health > 0; frame++) {
      ho.step(1 / 60, 1);
      if (g.player.health < last) drops.push(frame / 60);
      last = g.player.health;
    }
    const gaps = drops.slice(1).map((t, i) => t - drops[i]);
    const result = { blows: drops.length, shortest: gaps.length ? Math.min(...gaps) : 99, down: g.player.health <= 0, seconds: drops.length ? drops[drops.length - 1] - drops[0] : 0 };
    ho.god(true);
    ho.clearRobots();
    return result;
  });
  // Going down ends the run; start a fresh one so the checks that follow have a player to work with.
  if (flurry.down) {
    await ev(() => {
      const ho = window.__HO;
      ho.restart();
      ho.god(true);
      ho.holdRounds(true);
      ho.clearRobots();
      for (const id of ['lobbyHall', 'hallPower', 'lobbyPower']) ho.openDoor(id);
      ho.step(1 / 60, 130);
    });
  }
  check('with four robots in reach it takes four blows, never closer together than the grace period, to go down', flurry.blows === 4 && flurry.shortest >= 0.44 && flurry.seconds >= 1.3, `${flurry.blows} blows over ${flurry.seconds.toFixed(1)} s, the closest two ${flurry.shortest.toFixed(2)} s apart`);

  // The sidearm has a rack of its own in the lobby: there is always
  // something cheap to buy, and an empty gun is never the end of a run.
  const refill = await ev(() => {
    const ho = window.__HO;
    const g = ho.game;
    ho.clearRobots();
    g.wallet.scrap = 100;
    const sidearm = g.weapons.loadout.slots.find((slot) => slot?.id === 'pistol');
    sidearm.state.ammo = 0;
    sidearm.state.reserve = 0;
    ho.place(4.5, -0.9, 0);
    ho.step(1 / 60, 4);
    const prompt = ho.run().prompt;
    ho.tap('interact');
    ho.step(1 / 60, 20);
    return { prompt, scrap: g.wallet.scrap, reserve: sidearm.state.reserve };
  });
  check('the sidearm rack in the lobby refills an empty sidearm for 100 scrap', refill.prompt?.text.includes('VK-9') && refill.prompt.cost === 100 && refill.prompt.usable && refill.scrap === 0 && refill.reserve === 96, `"${refill.prompt?.text}" ${refill.prompt?.cost}: reserve now ${refill.reserve}, scrap ${refill.scrap}`);

  // Nowhere the player can stand is out of every robot's reach. (The player
  // is narrower than a robot, so a gap can let one through and not the
  // other; a whole aisle between the server racks was once safe that way.)
  const safe = await ev(() => window.__HO.safeSpots());
  check('there is nowhere the player can stand that no robot can reach', safe.length === 0, safe.length ? safe.map((s) => `${(s.squares * 0.0225).toFixed(1)} square metres around (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`).join('; ') : 'checked every square the player can walk to');

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

  // ------------------------- the announcement: reduced flashing, and "cleared"
  // With "reduce screen shake and flashing" on, the scan line, the
  // interference and the glitch are left out: the lettering just fades in.
  const flipReduced = () =>
    ev(() => {
      const row = [...document.querySelectorAll('.setting.check')].find((r) => r.textContent.includes('Reduce screen shake'));
      row.querySelector('input').click();
      return row.querySelector('input').checked;
    });
  const reducedOn = await flipReduced();
  await ev(() => {
    const ho = window.__HO;
    ho.restart();
    ho.god(true);
    for (let i = 0; i < 600 && ho.run().round < 1; i++) ho.step(1 / 60, 1);
    ho.announcement.freezeAt(0.1);
  });
  await page.waitForTimeout(120);
  let calm = await lettering();
  check(
    'with flashing reduced it fades in plainly: no scan line, no interference, no glitch',
    reducedOn && calm.scan === 0 && calm.lines === 0 && calm.shown > 0.2 && calm.shown < 0.8 && !calm.rowStyle.includes('rgba(255, 67, 38') && /skewX\(0(\.0+)?deg\)/.test(calm.rowStyle),
    `a tenth of a second in: lettering ${Math.round(calm.shown * 100)}% faded in, scan line off`,
  );
  await ev(() => window.__HO.announcement.freezeAt(null));
  const calmLanded = await page
    .waitForFunction(() => document.querySelector('.hud-round-number').textContent === '1', null, { timeout: 4000, polling: 'raf' })
    .then(() => true)
    .catch(() => false);
  check('and the number still reaches the corner counter', calmLanded && !(await flipReduced()));

  // A cleared round: one line, with the scrap that round paid.
  await ev(() => window.__HO.autopilot(true));
  let cleared = await run();
  for (let guard = 0; guard < 60 * 90 && !(cleared.round === 1 && cleared.phase === 'waiting'); guard += 30) {
    await step(30);
    cleared = await run();
  }
  await ev(() => {
    const ho = window.__HO;
    ho.autopilot(false);
    ho.announcement.freezeAt(1.4);
  });
  await page.waitForTimeout(150);
  const clearedLine = await ev(() => ({
    status: window.__HO.announcement.status(),
    title: document.querySelector('.announce-clear-title').textContent,
    sub: document.querySelector('.announce-clear .announce-sub').textContent,
    shown: Number(getComputedStyle(document.querySelector('.announce-clear')).opacity),
    numberColour: getComputedStyle(document.querySelector('.announce-clear-title span')).color,
    red: getComputedStyle(document.querySelector('.logo span')).color,
    bottom: document.querySelector('.announce-clear').getBoundingClientRect().bottom,
    crosshairTop: document.querySelector('.crosshair').getBoundingClientRect().top,
  }));
  check(
    'a cleared round is announced in one line with the scrap it paid',
    cleared.round === 1 && clearedLine.status.showing === 'clear' && clearedLine.shown === 1 && clearedLine.title === 'ROUND 1 CLEARED' && clearedLine.sub === `+${cleared.earned.toLocaleString('en-US')} SCRAP THIS ROUND` && cleared.earned > 0 && clearedLine.numberColour === clearedLine.red && clearedLine.bottom < clearedLine.crosshairTop - 20,
    `"${clearedLine.title}", "${clearedLine.sub}"`,
  );
  await ev(() => window.__HO.announcement.freezeAt(null));
  const clearedGone = await page
    .waitForFunction(() => window.__HO.announcement.status().showing === 'none', null, { timeout: 5000, polling: 'raf' })
    .then(() => true)
    .catch(() => false);
  a = await announcement();
  check('and is gone again in under three seconds', clearedGone && a.seconds < 2.9, `${a.seconds.toFixed(2)} s on screen`);

  // ------------------------------------------- the autopilot plays rounds
  await ev(() => {
    const ho = window.__HO;
    ho.restart();
    ho.god(true);
    ho.spawnAudit(true);
    ho.autopilot(true);
  });
  let played = await run();
  let frames = 0;
  for (; frames < 60 * 60 * 6 && played.round < 4; frames += 120) {
    await step(120);
    played = await run();
  }
  check('the autopilot plays through three rounds by itself', played.round >= 4 && played.kills >= 6 + 8 + 10, `round ${played.round}, ${played.kills} destroyed in ${(frames / 3600).toFixed(1)} game minutes`);
  const autoAudit = await ev(() => window.__HO.spawnAudit());
  check(
    'in those rounds no robot was created in view either',
    autoAudit.created >= 6 + 8 + 10 && autoAudit.seen.length === 0 && autoAudit.lastResorts === 0,
    autoAudit.seen.length ? autoAudit.seen.slice(0, 3).map((seen) => `one appeared in view at the ${seen.entry} entry`).join(' | ') : `${autoAudit.created} created: ${Object.entries(autoAudit.byEntry).map(([entry, count]) => `${count} at ${entry}`).join(', ')}`,
  );
  check('it earns scrap and spends it', played.earned > 1000 && played.spent > 0 && played.slots[1] !== null, `earned ${played.earned}, spent ${played.spent}, carrying ${played.slots.join(' + ')}`);

  // When only a few robots are left, they are marked.
  await ev(() => {
    const ho = window.__HO;
    ho.autopilot(false);
    ho.holdRounds(true);
  });
  let marked = false;
  let markerDetail = 'the round never got down to its last three robots';
  for (let t = 0; t < 400 && !marked; t++) {
    const s = await run();
    if (s.remaining > 0 && s.remaining <= 3 && s.robots.some((q) => q.alive)) {
      await step(2);
      // Count again after the step: a robot may have fallen during it. The
      // HUD draws on the browser's own clock, so give it a moment to agree.
      const alive = (await run()).robots.filter((q) => q.alive).length;
      if (alive > 0) {
        const expected = Math.min(3, alive);
        marked = await page
          .waitForFunction((expected) => document.querySelectorAll('.robot-marker:not(.hidden)').length === expected, expected, { timeout: 2500 })
          .then(() => true, () => false);
        markerDetail = `${expected} robot(s) still standing, ${await page.locator('.robot-marker:not(.hidden)').count()} marker(s) on screen`;
        break;
      }
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
  check('the last few robots of a round are marked on the HUD', marked, markerDetail);

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

  // ------------------------------------ every door, on foot, at every level
  // Played the way a person plays: a new run, the door bought with F, then
  // walked through, with no teleport and no free door. (A teleport skips
  // what happens on the way: the area changing, the lamps being handed
  // over, the reflections being swapped. That is where the server hall
  // once went black, on Ultra only, and no earlier check walked there.)
  // Once inside, the picture is measured.
  /** Walk somewhere on foot and face a point. False if it took too long. */
  const walkTo = async (x, z, lookX, lookZ) => {
    await ev(([x, z, lookX, lookZ]) => window.__HO.walkTo(x, z, lookX, lookZ), [x, z, lookX, lookZ]);
    for (let i = 0; i < 80; i++) {
      const walking = await ev(() => {
        window.__HO.step(1 / 60, 30);
        return window.__HO.walking();
      });
      if (!walking) return true;
    }
    return false;
  };
  // Each leg: where to stand to use the door, a point beyond it to face,
  // where to stop inside the room beyond, and what to look at from there.
  const LOOPS = {
    'lobby, hall, power room, lobby': [
      { door: 'lobbyHall', stand: [0, 5.4], face: [0, 9], inside: [-1, 12.9], look: [-1, 22], room: 'hall' },
      { door: 'hallPower', stand: [8.0, 11.4], face: [10.5, 11.4], inside: [12.6, 10.4], look: [17, 4], room: 'power' },
      { door: 'lobbyPower', stand: [10.5, 3.6], face: [8, 3.6], inside: [6.2, 3.4], look: [-2, 0], room: 'lobby' },
    ],
    'lobby, power room, hall, lobby': [
      { door: 'lobbyPower', stand: [7.9, 3.6], face: [10.5, 3.6], inside: [12.2, 4.2], look: [18, 7], room: 'power' },
      { door: 'hallPower', stand: [10.6, 11.4], face: [8, 11.4], inside: [5.2, 11.6], look: [-3, 17], room: 'hall' },
      { door: 'lobbyHall', stand: [0, 9.3], face: [0, 6], inside: [0, 4.2], look: [0, -6], room: 'lobby' },
    ],
    // The core's door is not bought: with the three override keys in hand, F unseals it.
    'lobby, hall, the core, and out again': [
      { door: 'lobbyHall', stand: [0, 5.4], face: [0, 9], inside: [-1, 12.9], look: [-1, 22], room: 'hall' },
      { door: 'hallCore', keys: true, stand: [-1, 24.2], face: [-1, 27], inside: [-1, 28.4], look: [-1, 34], room: 'core' },
      { door: null, inside: [-1, 22.6], look: [-1, 12], room: 'hall' },
    ],
  };
  const dark = [];
  const walked = [];
  for (const level of ['low', 'medium', 'high', 'ultra']) {
    for (const [name, legs] of Object.entries(LOOPS)) {
      await ev((level) => {
        const ho = window.__HO;
        ho.autopilot(false);
        ho.restart();
        ho.setQuality(level);
        ho.god(true);
        ho.scrap(4000);
        ho.step(1 / 60, 20);
      }, level);
      for (const leg of legs) {
        const where = `${level}: ${name}, ${leg.door ? `the ${leg.door} door` : 'back out'} into the ${leg.room}`;
        // A leg with no door of its own walks back out through the one just opened.
        if (leg.door === null) {
          if (!(await walkTo(leg.inside[0], leg.inside[1], leg.look[0], leg.look[1]))) {
            dark.push(`${where}: could not walk through`);
            break;
          }
          await step(75);
          const back = await run();
          const view = await measurePicture();
          walked.push(view.mean);
          if (back.area !== leg.room) dark.push(`${where}: ended up in the ${back.area}`);
          else if (view.black > 70 || view.mean < 10) dark.push(`${where}: brightness ${view.mean.toFixed(1)} of 255, ${view.black.toFixed(0)}% near black`);
          continue;
        }
        if (leg.keys) await ev(() => window.__HO.missionJump('core'));
        if (!(await walkTo(leg.stand[0], leg.stand[1], leg.face[0], leg.face[1]))) {
          dark.push(`${where}: could not walk to the door`);
          break;
        }
        const atDoor = await ev(() => {
          const ho = window.__HO;
          const state = ho.run();
          const p = ho.game.player;
          return { scrap: state.scrap, at: `standing at (${p.position.x.toFixed(2)}, ${p.position.z.toFixed(2)}) facing ${((p.yaw * 180) / Math.PI).toFixed(0)} degrees, ${state.state}, health ${state.health}, prompt "${state.prompt?.text ?? 'none'}"` };
        });
        await tap('interact');
        await step(110); // the door takes 1.6 seconds to open
        const opened = await run();
        if (!opened.doors[leg.door] || (!leg.keys && opened.scrap >= atDoor.scrap) || (leg.keys && opened.scrap !== atDoor.scrap)) {
          dark.push(`${where}: F did not open it (${atDoor.at})`);
          break;
        }
        if (!(await walkTo(leg.inside[0], leg.inside[1], leg.look[0], leg.look[1]))) {
          dark.push(`${where}: could not walk through`);
          break;
        }
        // The first robots of round 1 are on their way by now. From here on
        // keep the rooms empty, so nothing stands in the walker's way.
        await ev(() => {
          window.__HO.holdRounds(true);
          window.__HO.clearRobots();
        });
        await step(75);
        const inside = await run();
        const picture = await measurePicture();
        walked.push(picture.mean);
        if (inside.area !== leg.room) dark.push(`${where}: ended up in the ${inside.area}`);
        else if (picture.black > 70 || picture.mean < 10) dark.push(`${where}: brightness ${picture.mean.toFixed(1)} of 255, ${picture.black.toFixed(0)}% near black`);
      }
    }
  }
  check(
    'every door, opened with F and walked through on foot, leads into a lit room at every quality level',
    dark.length === 0 && walked.length === 36,
    dark.length ? dark.join(' | ') : `36 crossings (all 4 doors, both directions, 4 levels); the darkest room measured ${Math.min(...walked).toFixed(1)} of 255`,
  );

  // Each room is drawn only while it can be seen, so each must be closed
  // off by walls of its own (and the doors, which are always drawn). Where
  // a room used the back of its neighbour's wall, the night sky showed
  // through whenever the neighbour was not being drawn.
  const gaps = await ev(() => window.__HO.enclosureGaps());
  const open = Object.entries(gaps).filter(([, count]) => count > 0);
  check(
    'every room is closed off by its own walls and the doors, with nothing to see through',
    open.length === 0,
    open.length ? open.map(([pair, count]) => `${pair}: ${count} lines of sight get through`).join(', ') : `${Object.keys(gaps).length} pairs of rooms, 2,420 lines of sight each`,
  );

  // Nothing may stand across a doorway. (A rail along the server hall's
  // walls once carried on across all four of its openings, and showed
  // through the open blast door as a dark bar at waist height.)
  const across = await ev(() => window.__HO.doorwayObstructions());
  const crossed = Object.entries(across).filter(([, count]) => count > 0);
  check(
    'nothing stands across any doorway or entrance',
    crossed.length === 0,
    crossed.length ? crossed.map(([way, count]) => `${way}: ${count} lines blocked`).join(', ') : `${Object.keys(across).join(', ')}: all clear`,
  );

  // Robots must be readable wherever they stand: being hit by something
  // that could not be seen is unfair. In the darkest places on the map a
  // robot's dark body used to melt into the dark behind it. Photograph each
  // of those places empty, then with robots standing in it (backs turned,
  // so the glowing visor is no help, and one hanging in the air under each
  // of two ceiling vents), and measure how much of each robot comes out
  // clearly different from what was behind it: at least 9 steps brighter
  // or 30 darker, out of 255. The same is measured with the robots' edge
  // light switched off, to show what the edge light is worth.
  const darkPlaces = [
    ['a dark aisle on the east side of the server hall', [1.0, 1.64, 15.6, -90, 0, 74], [[4.6, 15.7], [8.2, 15.4]]],
    ['a dark aisle on the west side of the server hall', [-4.4, 1.64, 11.4, 90, 0, 74], [[-7.4, 11.5], [-9.6, 11.3]]],
    ['under the server hall vent', [2.4, 1.7, 24.2, -58, 10, 72], [[5.4, 21.9, 2.6]]],
    ['under the power room vent', [16.8, 1.64, 7.4, 136, 10, 74], [[13.4, 10.9, 2.6]]],
    ['the far end of the power room', [15.9, 1.64, 10.4, 0, 0, 74], [[20.8, 1.0]]],
    ['the west side of the lobby', [1.5, 1.64, 0.5, 90, 0, 74], [[-5.6, -1.2]]],
    ['the core', [-1, 1.64, 27.5, 180, 4, 74], [[-4.5, 31], [3, 33]]],
  ];
  const brightnessOf = async () => {
    const { data, info } = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const out = new Float32Array(info.width * info.height);
    for (let i = 0; i < out.length; i++) out[i] = 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2];
    return { out, width: info.width, height: info.height };
  };
  const qualityBefore = (await stats()).quality;
  const standing = [];
  for (const level of ['low', 'high']) {
    await ev((level) => {
      const ho = window.__HO;
      ho.restart();
      ho.god(true);
      ho.holdRounds(true);
      ho.clearRobots();
      ho.setQuality(level);
      for (const id of ['lobbyHall', 'lobbyPower', 'hallPower', 'hallCore']) ho.openDoor(id);
      ho.step(1 / 60, 160);
      ho.photoMode(true);
      ho.steadyLights(true);
      ho.grain(false);
    }, level);
    for (const [where, view, robots] of darkPlaces) {
      await ev((view) => {
        const ho = window.__HO;
        ho.clearRobots();
        ho.view(view[0], view[1], view[2], view[3], view[4], view[5]);
        ho.step(1 / 60, 40);
      }, view);
      await page.waitForTimeout(200);
      const empty = await brightnessOf();
      const boxes = await ev(
        ([view, robots]) => {
          const ho = window.__HO;
          for (const [x, z] of robots) ho.spawnRobot(x, z, view[3] + 180, true, 1.5, 5000);
          ho.step(1 / 60, 30);
          robots.forEach(([, , y], i) => {
            if (!y) return;
            ho.game.robots[i].root.position.y = y;
            ho.game.robots[i].root.updateMatrixWorld(true);
          });
          ho.step(1 / 60, 1);
          return ho.robotBoxes();
        },
        [view, robots],
      );
      const pictures = {};
      for (const lit of [false, true]) {
        await ev((lit) => {
          const ho = window.__HO;
          ho.edgeLight(lit);
          ho.step(1 / 60, 2);
        }, lit);
        await page.waitForTimeout(200);
        pictures[lit] = await brightnessOf();
      }
      const scale = empty.width / 1280;
      boxes.forEach((box, i) => {
        const x0 = Math.max(0, Math.floor(box.x0 * scale));
        const x1 = Math.min(empty.width - 1, Math.ceil(box.x1 * scale));
        const y0 = Math.max(0, Math.floor(box.y0 * scale));
        const y1 = Math.min(empty.height - 1, Math.ceil(box.y1 * scale));
        // How much of the picture the robot covers: every pixel it changed
        // at all, and never less than a third of the box round it (so a
        // robot that cannot be seen does not pass for being small).
        let covers = 0;
        const stands = { false: 0, true: 0 };
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const k = y * empty.width + x;
            const without = pictures.false.out[k] - empty.out[k];
            const withLight = pictures.true.out[k] - empty.out[k];
            if (Math.abs(without) >= 4 || Math.abs(withLight) >= 4) covers++;
            if (without >= 9 || without <= -30) stands.false++;
            if (withLight >= 9 || withLight <= -30) stands.true++;
          }
        }
        const area = Math.max(covers, 0.35 * (x1 - x0 + 1) * (y1 - y0 + 1));
        standing.push({ where: `${where}${boxes.length > 1 ? `, robot ${i + 1}` : ''}, ${level} quality`, share: stands.true / area, without: stands.false / area, distance: box.distance });
      });
    }
  }
  await ev((quality) => {
    const ho = window.__HO;
    ho.clearRobots();
    ho.edgeLight(true);
    ho.grain(true);
    ho.photoMode(false);
    ho.steadyLights(false);
    ho.releaseView();
    ho.setQuality(quality);
    ho.step(1 / 60, 30);
  }, qualityBefore);
  const expected = darkPlaces.reduce((sum, [, , robots]) => sum + robots.length, 0) * 2;
  const faint = standing.filter((s) => s.share < 0.22);
  const weakest = standing.reduce((a, b) => (a.share <= b.share ? a : b), { share: 1, without: 1, where: 'nowhere', distance: 0 });
  const blind = standing.filter((s) => s.without < 0.22).length;
  check(
    'a robot in the darkest places stands out from what is behind it',
    standing.length === expected && faint.length === 0,
    faint.length
      ? faint.map((s) => `${s.where}: only ${Math.round(s.share * 100)}% of it stands out`).join(' | ')
      : `${standing.length} robots measured; the faintest (${weakest.where}, ${weakest.distance.toFixed(1)} m away) has ${Math.round(weakest.share * 100)}% of itself standing out; without the edge light ${blind} of them would fail`,
  );

  // Every way in has to be joined to every room on the map of the floor
  // the robots steer by. (A robot arriving in the check above does not
  // prove it: one with no route walks straight at the player, and if that
  // line happens to pass through the opening it gets in anyway. A cart
  // parked in the loading dock's mouth cut the dock off this way for two
  // stages, and every robot sent that way with the player in another room
  // stood against a wall until it was recalled.)
  const routes = await ev(() => window.__HO.entryRoutes());
  const cut = Object.entries(routes).filter(([, rooms]) => rooms.length > 0);
  check(
    'every way in is joined to every room on the map robots steer by',
    Object.keys(routes).length === 8 && cut.length === 0,
    cut.length ? cut.map(([entry, rooms]) => `${entry} cannot be reached from the ${rooms.join(', ')}`).join('; ') : `${Object.keys(routes).join(', ')}`,
  );

  // Robots must never be seen to appear. Those that walk in are created
  // outside, in the gap behind a shipping container: from nowhere inside
  // the building is there a line of sight to those gaps.
  const sightlines = await ev(() => window.__HO.spawnSightlines());
  const exposed = Object.entries(sightlines).filter(([, count]) => count > 0);
  check(
    'the places robots walk in from cannot be seen from anywhere indoors',
    Object.keys(sightlines).length === 3 && exposed.length === 0,
    exposed.length ? exposed.map(([entry, count]) => `${entry}: ${count} clear lines of sight`).join(', ') : `${Object.keys(sightlines).join(', ')}: looked for from every half metre of floor, every door open`,
  );

  // And wherever the player stands, however hard they stare at an entry,
  // no robot is created in the picture on screen: the rounds use another
  // entry, and the robots still come. Each line below is a fresh run with
  // the player held in one place for half a minute. (The count is kept by
  // the debug tools, separately from the rule that is meant to prevent it.)
  const stances = [
    ['at the start, looking out through the entrance', [], 0, 4.6, 0, 0],
    ['in the outer doorway, looking into the yard', [], 0, -12.9, 0, 0],
    ['in the yard, staring into the gap robots come from', [], 5.2, -14.2, 0, 0],
    ['in the far corner of the yard', [], -5.2, -19.0, -80, 0],
    ['in the lobby, staring at its vent', ['lobbyHall'], -4.6, 0.6, 122, 14],
    ['in the server hall, staring at its vent', ['lobbyHall'], 2.4, 24.2, -58, 10],
    ['in the server hall, looking out through the dock', ['lobbyHall'], -8.2, 16.5, 90, 0],
    ['in the dock yard, staring into the gap robots come from', ['lobbyHall'], -17.7, 14.6, 180, 0],
    ['in the power room, staring at its vent', ['lobbyPower'], 16.8, 7.4, 136, 10],
    ['in the power room, looking out through the breach', ['lobbyPower'], 20.5, 4.5, -90, 0],
    ['in the transformer yard, staring into the gap robots come from', ['lobbyPower'], 29.7, 2.6, 180, 0],
    ['in the core, with both its vents in view', ['lobbyHall', 'hallCore'], -1, 27.2, 180, 8],
  ];
  const sightings = [];
  let arrivals = 0;
  let starved = 0;
  let resorts = 0;
  for (const [where, doors, x, z, yaw, pitch] of stances) {
    const stood = await ev(
      ([doors, x, z, yaw, pitch]) => {
        const ho = window.__HO;
        ho.restart();
        ho.god(true);
        for (const id of doors) ho.openDoor(id);
        ho.step(1 / 60, 140);
        ho.spawnAudit(true);
        for (let i = 0; i < 30 * 60; i++) {
          ho.place(x, z, yaw, pitch);
          ho.step(1 / 60, 1);
        }
        return ho.spawnAudit();
      },
      [doors, x, z, yaw, pitch],
    );
    arrivals += stood.created;
    resorts += stood.lastResorts;
    if (stood.created < 6) starved++;
    for (const seen of stood.seen) sightings.push(`${where}: one appeared in view at the ${seen.entry} entry`);
  }
  check(
    'no robot is ever created in view, wherever the player stands and stares',
    sightings.length === 0 && starved === 0 && resorts === 0,
    sightings.length ? sightings.slice(0, 4).join(' | ') : starved ? `${starved} of the ${stances.length} positions kept the robots from coming at all` : `${arrivals} robots created over ${stances.length} awkward positions, none of them in view, and no round held up`,
  );
  // The same count over a lot of ordinary play: eight whole runs by the
  // autopilot to round 6, worked out without being drawn (so each takes a
  // few seconds), half of them with every door open so that every way in is
  // in use. Several hundred robots. (A vent half hidden behind a column
  // once counted as "not being looked at". That showed up about once in two
  // hundred robots: more than one played-through run will reliably catch.)
  const crowd = { created: 0, seen: [], lastResorts: 0, byEntry: {} };
  for (let i = 0; i < 8; i++) {
    const audit = await ev((open) => {
      const ho = window.__HO;
      ho.restart();
      ho.god(true);
      if (open) for (const id of ['lobbyHall', 'lobbyPower', 'hallPower']) ho.openDoor(id);
      ho.spawnAudit(true);
      ho.autopilot(true);
      for (let frame = 0; frame < 60 * 60 * 12 && ho.run().round < 6; frame += 300) ho.simulate(1 / 60, 300);
      ho.autopilot(false);
      return ho.spawnAudit();
    }, i % 2 === 1);
    crowd.created += audit.created;
    crowd.lastResorts += audit.lastResorts;
    for (const seen of audit.seen) crowd.seen.push(seen.entry);
    for (const [entry, count] of Object.entries(audit.byEntry)) crowd.byEntry[entry] = (crowd.byEntry[entry] ?? 0) + count;
  }
  check(
    'nor in eight whole runs of ordinary play, with every way in used',
    crowd.created > 300 && crowd.seen.length === 0 && crowd.lastResorts === 0 && Object.keys(crowd.byEntry).length >= 6,
    crowd.seen.length
      ? `${crowd.seen.length} of ${crowd.created} appeared in view, at: ${[...new Set(crowd.seen)].join(', ')}`
      : `${crowd.created} robots created, none in view: ${Object.entries(crowd.byEntry).map(([entry, count]) => `${count} at ${entry}`).join(', ')}`,
  );
  await ev(() => {
    const ho = window.__HO;
    ho.restart();
    ho.god(true);
    ho.holdRounds(true);
    ho.clearRobots();
  });

  // ============================================================ the mission
  // A whole mission, start to finish, driven with the debug tools: god mode
  // on and scrap for the asking, but every step taken the way a player
  // takes it: standing where they would stand and pressing F.
  const mission = () => ev(() => window.__HO.mission());
  /** Stand at one of the mission's places, facing it (from further back if asked). */
  const standAt = (name, back = 0) =>
    ev(
      ([name, back]) => {
        const ho = window.__HO;
        const place = ho.mission().places[name];
        const dx = place.at[0] - place.stand[0];
        const dz = place.at[2] - place.stand[1];
        const length = Math.hypot(dx, dz) || 1;
        ho.place(place.stand[0] - (dx / length) * back, place.stand[1] - (dz / length) * back, (Math.atan2(-dx, -dz) * 180) / Math.PI, 0);
        ho.step(1 / 60, 12);
      },
      [name, back],
    );
  /** Turn on a robot of a given kind and fire at it, striking it when it is in reach, until it is destroyed. */
  const destroy = (role) =>
    ev((role) => {
      const ho = window.__HO;
      const game = ho.game;
      const head = new game.camera.position.constructor();
      let frames = 0;
      for (; frames < 60 * 240; frames++) {
        const robot = game.robots.find((r) => r.role === role && r.alive);
        if (!robot) break;
        if (robot.grounded) {
          // Aim at its head from wherever the player is standing.
          head.setFromMatrixPosition(robot.bones.get('Head').matrixWorld);
          const eye = game.camera.position;
          const dx = head.x - eye.x;
          const dz = head.z - eye.z;
          const p = game.player.position;
          ho.place(p.x, p.z, (Math.atan2(-dx, -dz) * 180) / Math.PI, (Math.atan2(head.y - eye.y, Math.hypot(dx, dz)) * 180) / Math.PI);
          ho.press('fire', true);
          if (frames % 40 === 0 && Math.hypot(dx, dz) < 1.9) ho.tap('melee');
        }
        // The scripted run does not stop to shop: it is handed ammunition.
        const weapon = game.weapons.state;
        if (weapon.reserve < 30) weapon.reserve = 120;
        if (weapon.ammo === 0 && !game.weapons.reloading) ho.tap('reload');
        ho.step(1 / 60, 1);
      }
      ho.press('fire', false);
      ho.step(1 / 60, 30);
      return frames / 60;
    }, role);

  await ev(() => {
    const ho = window.__HO;
    ho.autopilot(false);
    ho.restart();
    ho.god(true);
    ho.holdRounds(true);
    ho.clearRobots();
    ho.scrap(6000);
    for (const id of ['lobbyHall', 'lobbyPower', 'hallPower']) ho.openDoor(id);
    ho.step(1 / 60, 140);
    // The carbine from its rack, for the two elites.
    ho.place(1.6, 10.2, 180);
    ho.step(1 / 60, 6);
    ho.tap('interact');
    ho.step(1 / 60, 40);
    ho.spawnAudit(true);
  });
  let m = await mission();
  r = await run();
  check('the mission begins with the power out, and the tracker says where to go', m.phase === 'power' && m.objective.target === 'breaker' && m.marker !== null && (await page.locator('.hud-objective-title').textContent()) === 'RESTORE POWER AT THE MAIN BREAKER' && r.weapon === 'carbine', `"${m.objective.title}", marker ${Math.round(m.marker?.distance ?? 0)} m away`);

  // ---- Before the power is on, nothing of the mission's can be used.
  const locked = [];
  for (const [place, back] of [['cage', 0], ['uplink', 0], ['coreDoor', 0], ['killSwitch', 0]]) {
    if (place === 'killSwitch') continue; // behind the sealed door
    await standAt(place, back);
    const prompt = (await run()).prompt;
    await tap('interact');
    await step(10);
    locked.push(`${place}: "${prompt?.text ?? 'no prompt'}"${prompt?.usable ? ' USABLE' : ''}`);
  }
  m = await mission();
  r = await run();
  check('without power the cage is locked, the uplink is dead and the core is sealed', m.phase === 'power' && !m.keys.cage && m.uplink === 'idle' && !r.doors.hallCore && locked.every((line) => !line.includes('USABLE') && !line.includes('no prompt')), locked.join(', '));

  // ---- 1. Restore power.
  await standAt('breaker');
  const breakerPrompt = (await run()).prompt;
  await tap('interact');
  await step(30);
  m = await mission();
  const powered = await ev(() => ({ lamps: window.__HO.game.lights.power, notice: document.querySelector('.announce-notice .announce-clear-title').textContent }));
  check('throwing the main breaker restores power', breakerPrompt?.text === 'Restore power' && m.phase === 'keys' && powered.lamps && powered.notice === 'POWER RESTORED' && m.objective.target === 'cage', `"${breakerPrompt?.text}", then "${m.objective.title}"`);

  // ---- 2a. The key in the cage.
  await step(90); // the gate slides aside
  await standAt('cage');
  const cagePrompt = (await run()).prompt;
  await tap('interact');
  await step(10);
  m = await mission();
  check('the cage gives up its key once the power is on', cagePrompt?.text === 'Take the override key' && m.keys.cage && (await page.locator('.hud-keys i.held').count()) === 1, `"${cagePrompt?.text}"; keys held: 1 of 3`);
  await tap('interact');
  await step(5);
  check('and only once', Object.values((await mission()).keys).filter(Boolean).length === 1);

  // ---- 2b. The uplink: hold the ground round it for a minute.
  await ev(() => window.__HO.holdRounds(false));
  await standAt('uplink');
  const uplinkPrompt = (await run()).prompt;
  await tap('interact');
  const held = await ev(() => {
    const ho = window.__HO;
    const place = ho.mission().places.uplink;
    const out = { wave: 0, awayHeld: 0, awayTitle: '' };
    const hold = (frames) => {
      for (let i = 0; i < frames; i++) {
        ho.place(place.stand[0], place.stand[1], 180);
        ho.step(1 / 60, 1);
        out.wave = Math.max(out.wave, ho.mission().extras);
      }
    };
    hold(60 * 20);
    // Walk away for ten seconds: the clock stops, and what was earned is kept.
    const before = ho.mission().uplinkHeld;
    for (let i = 0; i < 600; i++) {
      ho.place(-1, 11, 0);
      ho.step(1 / 60, 1);
    }
    out.awayHeld = ho.mission().uplinkHeld - before;
    out.awayTitle = ho.mission().objective.title;
    out.at20 = before;
    hold(60 * 39);
    out.at59 = ho.mission().uplinkHeld;
    out.keyAt59 = ho.mission().keys.uplink;
    hold(60 * 2);
    return out;
  });
  m = await mission();
  check(
    'the uplink hands over its key after the ground round it has been held for 60 seconds',
    uplinkPrompt?.text === 'Start the uplink' && Math.abs(held.at20 - 20) < 0.2 && !held.keyAt59 && Math.abs(held.at59 - 59) < 0.2 && m.keys.uplink && m.uplink === 'done',
    `20.0 s after 20 s, ${held.at59.toFixed(1)} s and no key after 59, the key at 60`,
  );
  check('its clock stops while the player is away, and the tracker says so', Math.abs(held.awayHeld) < 0.05 && held.awayTitle === 'GET BACK TO THE UPLINK', `${held.awayHeld.toFixed(2)} s gained in ten seconds away: "${held.awayTitle}"`);
  check('ARGUS sends more robots at the uplink than the round would', held.wave >= 4, `up to ${held.wave} extra robots on the map`);

  // ---- 2c. The Custodian arrives with a later round (the config says which) and carries the third key.
  m = await mission();
  const waitingFor = m.objective;
  const dueRound = m.rules.custodianFromRound;
  await ev((dueRound) => {
    const ho = window.__HO;
    ho.clearRobots();
    ho.place(0, 4.6, 0);
    for (let guard = 0; guard < 80 && ho.run().round < dueRound - 1; guard++) {
      ho.skipRound();
      ho.step(1 / 60, 2);
    }
    // The round before is under way: end it and let the Custodian's round begin by itself.
    ho.skipRound();
    for (let i = 0; i < 60 * 14 && ho.run().round < dueRound; i++) ho.step(1 / 60, 1);
    for (let i = 0; i < 60 * 8 && ho.mission().custodian !== 'active'; i++) ho.step(1 / 60, 1);
    // No need for the rest of that round to be in the way.
    ho.holdRounds(true);
    for (const robot of [...ho.game.robots]) if (!robot.role) robot.dispose();
    ho.game.robots.splice(0, ho.game.robots.length, ...ho.game.robots.filter((robot) => robot.role));
  }, dueRound);
  m = await mission();
  r = await run();
  check(
    `with two keys in hand the tracker explains that a Custodian carries the third, and it arrives with round ${dueRound}`,
    waitingFor.target === null && waitingFor.title.includes('CUSTODIAN') && waitingFor.detail.includes(`ROUND ${dueRound}`) && r.round === dueRound && m.custodian === 'active' && m.elites.length === 1 && m.elites[0].role === 'custodian' && m.objective.target === 'custodian' && m.marker !== null,
    `"${waitingFor.title}" (${waitingFor.detail}); then "${m.objective.title}"`,
  );
  const custodianFight = await destroy('custodian');
  m = await mission();
  r = await run();
  check('destroying the Custodian drops its key where it fell and pays a bounty', m.custodian === 'dropped' && m.droppedKey !== null && m.objective.target === 'custodianKey' && r.earned >= 500, `destroyed in ${custodianFight.toFixed(0)} s of fire; its key is lying at (${m.droppedKey?.x.toFixed(1)}, ${m.droppedKey?.z.toFixed(1)})`);
  await ev(() => {
    const ho = window.__HO;
    const key = ho.mission().droppedKey;
    ho.place(key.x + 0.9, key.z, 90, -30);
    ho.step(1 / 60, 8);
  });
  const dropPrompt = (await run()).prompt;
  await tap('interact');
  await step(10);
  m = await mission();
  check('picking it up makes three, and the tracker sends the player to the core', dropPrompt?.text === 'Pick up the override key' && m.keys.custodian && m.phase === 'core' && m.droppedKey === null && m.objective.target === 'coreDoor' && (await page.locator('.hud-keys i.held').count()) === 3, `"${m.objective.title}"`);

  // ---- 3. Unseal the core, arm the switch, survive the final stand.
  await standAt('coreDoor');
  const corePrompt = (await run()).prompt;
  await tap('interact');
  await step(120);
  r = await run();
  check('the three keys unseal the core', corePrompt?.text === 'Unseal the core' && corePrompt.usable && r.doors.hallCore && (await mission()).objective.target === 'killSwitch');
  await standAt('killSwitch');
  const armPrompt = (await run()).prompt;
  await tap('interact');
  await step(20);
  const early = (await run()).prompt;
  await tap('interact'); // too early: it is still arming
  const stand = await ev(() => {
    const ho = window.__HO;
    const out = { extras: 0, bossAt: -1, phases: new Set() };
    for (let i = 0; i < 60 * 14; i++) {
      ho.step(1 / 60, 1);
      const state = ho.mission();
      out.extras = Math.max(out.extras, state.extras);
      out.phases.add(state.phase);
      if (out.bossAt < 0 && state.boss) out.bossAt = state.armed;
    }
    return { extras: out.extras, bossAt: out.bossAt, phases: [...out.phases], suspended: ho.mission().suspended, round: ho.run().round };
  });
  m = await mission();
  check(
    'arming the kill switch starts the final stand: the rounds stand aside and ARGUS sends a horde and its Proxy',
    armPrompt?.text === 'Arm the kill switch' && early?.usable === false && stand.phases.join() === 'arming' && stand.suspended && stand.extras >= 6 && stand.bossAt > 9 && stand.bossAt < 13 && m.boss?.name === 'ARGUS PROXY' && (await page.locator('.hud-boss').isVisible()),
    `${stand.extras} robots on the map 14 s in; the Proxy arrived ${stand.bossAt.toFixed(1)} s in`,
  );
  const proxyFight = await destroy('proxy');
  m = await mission();
  check('the Proxy can be destroyed', m.bossSent && m.bossDestroyed && m.boss === null && !(await page.locator('.hud-boss').isVisible()), `in ${proxyFight.toFixed(0)} s of fire`);
  const armedAfter = await ev(() => {
    const ho = window.__HO;
    for (let i = 0; i < 60 * 90 && ho.mission().phase === 'arming'; i++) ho.step(1 / 60, 1);
    return ho.mission().armed;
  });
  m = await mission();
  check('the switch arms after 75 seconds', m.phase === 'armed' && Math.abs(armedAfter - 75) < 0.1 && m.objective.title === 'PULL THE KILL SWITCH', `armed at ${armedAfter.toFixed(1)} s`);

  // ---- 4. Pull it.
  await standAt('killSwitch');
  const pullPrompt = (await run()).prompt;
  const before4 = await run();
  await tap('interact');
  await step(60);
  const after4 = await run();
  m = await mission();
  check(
    'pulling the switch powers down every robot on the map',
    pullPrompt?.text === 'PULL THE KILL SWITCH' && m.phase === 'saved' && before4.robots.filter((q) => q.alive).length >= 6 && after4.robots.filter((q) => q.alive).length === 0 && after4.robots.length === before4.robots.length,
    `${before4.robots.filter((q) => q.alive).length} robots working before, none after; ${after4.robots.length} wrecks where they stood`,
  );
  await step(150);
  const ending = await ev(() => ({
    state: window.__HO.run().state,
    shown: !document.querySelector('.screen.saved').classList.contains('hidden'),
    title: document.querySelector('.screen.saved .over-title')?.textContent,
    stats: [...document.querySelectorAll('.screen.saved .over-stat')].map((row) => `${row.firstElementChild.textContent} ${row.lastElementChild.textContent}`),
    buttons: [...document.querySelectorAll('.screen.saved button')].map((b) => b.textContent),
    best: JSON.parse(localStorage.getItem('human-override.best.v1') ?? '{}'),
    time: window.__HO.mission().savedAt,
  }));
  check(
    'then the HUMANITY SAVED screen shows the run, with the choice to fight on or stop',
    ending.state === 'saved' && ending.shown && ending.title === 'HUMANITY SAVED' && ending.stats.length === 6 && ending.stats[0].startsWith('Mission time') && ending.buttons.join() === 'KEEP FIGHTING,END RUN',
    `${ending.stats.slice(0, 3).join(', ')}`,
  );
  check('the fastest mission time is remembered', Math.abs(ending.best.missionTime - ending.time) < 0.01 && ending.time > 60, `${ending.best.missionTime?.toFixed(0)} s`);
  const missionAudit = await ev(() => window.__HO.spawnAudit());
  check('through the whole mission no robot was created in view', missionAudit.created > 30 && missionAudit.seen.length === 0, `${missionAudit.created} created, ${missionAudit.seen.length} seen`);

  // ---- Afterwards: fight on, for three more rounds.
  const roundThen = after4.round;
  await ev(() => {
    const ho = window.__HO;
    ho.holdRounds(false);
    ho.play();
    ho.step(1 / 60, 10);
    ho.autopilot(true);
  });
  const resumed = await run();
  let endless = resumed;
  let endlessFrames = 0;
  for (; endlessFrames < 60 * 60 * 14 && endless.round < roundThen + 4; endlessFrames += 600) {
    await ev(() => window.__HO.simulate(1 / 60, 600));
    endless = await run();
  }
  await step(2);
  check(
    'KEEP FIGHTING clears the wrecks away and the rounds carry on: three more are played through',
    resumed.state === 'playing' && resumed.robots.length === 0 && endless.round >= roundThen + 4 && (await mission()).phase === 'saved',
    `from round ${roundThen} to round ${endless.round} in ${(endlessFrames / 3600).toFixed(1)} game minutes, ${endless.kills} destroyed in all`,
  );
  // Going down after the switch has been pulled is not ARGUS winning.
  await ev(() => {
    const ho = window.__HO;
    ho.autopilot(false);
    ho.god(false);
    for (let i = 0; i < 60 * 240 && ho.run().state === 'playing'; i++) ho.step(1 / 60, 1);
  });
  await step(3);
  const lateOver = await ev(() => ({ state: window.__HO.run().state, eyebrow: document.querySelector('.screen.over .eyebrow')?.textContent, rows: [...document.querySelectorAll('.screen.over .over-stat')].map((row) => `${row.firstElementChild.textContent} ${row.lastElementChild.textContent}`) }));
  check('going down after that still ends the run, with humanity saved on the card', lateOver.state === 'over' && lateOver.eyebrow.includes('HUMANITY SAVED') && lateOver.rows[0].startsWith('Mission time'), lateOver.eyebrow);
  await ev(() => {
    const ho = window.__HO;
    ho.restart();
    ho.god(true);
    ho.step(1 / 60, 5);
  });
  m = await mission();
  r = await run();
  check('a new run starts the mission afresh', m.phase === 'power' && Object.values(m.keys).every((key) => !key) && !r.doors.hallCore && m.custodian === 'waiting' && m.uplink === 'idle' && !m.suspended && (await ev(() => window.__HO.game.lights.power)) === false);

  // The reflections each room is lit by are made from a photograph of it.
  // One broken pixel in that photograph (a shader's "not a number") used to
  // spread through it and turn every surface in the room black.
  const broken = await ev(() => window.__HO.brokenReflections());
  const bad = Object.entries(broken).filter(([, count]) => count > 0);
  check("no room's reflection photograph contains a broken pixel, at any size", bad.length === 0, bad.length ? bad.map(([what, count]) => `${what}: ${count}`).join(', ') : `${Object.keys(broken).length} photographs checked`);

  // And if a shader ever does produce one again, it must not matter: put an
  // object that draws nothing but broken pixels in the server hall, bake
  // the reflections again, take it away, and the hall must still be lit.
  await ev(() => {
    const ho = window.__HO;
    ho.restart();
    ho.god(true);
    ho.holdRounds(true);
    ho.openDoor('lobbyHall');
    ho.photoMode(true);
    ho.steadyLights(true);
    ho.setQuality('high');
    ho.view(-1, 1.7, 9.5, 180, 0, 74);
    ho.step(1 / 60, 150);
  });
  const healthy = await measurePicture();
  await ev(() => {
    const ho = window.__HO;
    ho.poison(-1, 2.6, 13.5);
    ho.setQuality('ultra'); // a change of level bakes every room again
    ho.poison();
    ho.step(1 / 60, 60);
  });
  const poisoned = await measurePicture();
  check('one broken pixel in a room cannot black it out', poisoned.mean > healthy.mean * 0.8 && poisoned.black < 50, `brightness ${healthy.mean.toFixed(1)} before, ${poisoned.mean.toFixed(1)} after the reflections were baked with a broken object in the room`);
  await ev(() => {
    const ho = window.__HO;
    ho.setQuality('high');
    ho.photoMode(false);
    ho.steadyLights(false);
    ho.releaseView();
  });
} catch (error) {
  check('script ran to the end', false, String(error.message ?? error).split('\n')[0]);
}

// ---- The real interface: real clicks and real mouse capture, no shortcuts
// Everything above drove the game through its debug tools. This part
// presses the actual buttons on a fresh page, the way a visitor does: the
// browser has to capture the mouse when a button is clicked, and the game
// has to notice when it is let go.
try {
  await page.goto('about:blank');
  const real = await page.context().newPage();
  real.on('console', (m) => m.type() === 'error' && problems.push(`real clicks: ${m.text()}`));
  real.on('pageerror', (e) => problems.push(`real clicks exception: ${e.message}`));
  await real.goto(`${site.url}?debug=1`);
  await real.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
  const at = () => real.evaluate(() => ({ ...window.__HO.run(), quality: window.__HO.stats().quality, ammo: window.__HO.stats().ammo, locked: document.pointerLockElement !== null }));
  const until = (state) => real.waitForFunction((state) => window.__HO.stats().state === state, state, { timeout: 8000 }).catch(() => {});
  /** What the browser does when the player presses Esc: it takes the mouse back. */
  const letGoOfMouse = () => real.evaluate(() => document.exitPointerLock());

  await real.click('button[data-action="start"]');
  await until('playing');
  let s = await at();
  check('the Play button captures the mouse and starts a run', s.state === 'playing' && s.locked);

  await real.mouse.down();
  await real.waitForTimeout(60);
  await real.mouse.up();
  await real.waitForTimeout(300);
  const fired = s.ammo - (await at()).ammo;
  check('a real mouse click fires one round', fired === 1, `${fired} fired`);

  // Every key on the controls list, pressed for real. (The checks further
  // up press the game's buttons from the inside, which would not notice a
  // key wired to the wrong thing, or to nothing.)
  const doing = (fn, arg) => real.evaluate(fn, arg);
  const becomes = (fn, arg) => real.waitForFunction(fn, arg, { timeout: 6000 }).then(() => true, () => false);
  const key = async (code, hold = 70) => {
    await real.keyboard.down(code);
    await real.waitForTimeout(hold);
    await real.keyboard.up(code);
  };
  await doing(() => {
    const ho = window.__HO;
    ho.god(true);
    ho.holdRounds(true);
    ho.clearRobots();
  });
  const keys = {};

  await key('KeyR');
  keys['R reloads'] = (await becomes(() => window.__HO.game.weapons.reloading)) && (await becomes(() => window.__HO.stats().ammo === 12));

  await real.mouse.down({ button: 'right' });
  keys['right click aims'] = await becomes(() => window.__HO.stats().aim > 0.9);
  await real.mouse.up({ button: 'right' });
  await becomes(() => window.__HO.stats().aim < 0.1);

  const yaw = await doing(() => window.__HO.game.player.yaw);
  await real.mouse.move(640, 360);
  await real.mouse.move(700, 360, { steps: 4 });
  keys['the mouse turns the view'] = await becomes((yaw) => Math.abs(window.__HO.game.player.yaw - yaw) > 0.02, yaw);

  /** Hold some keys for a while from the same spot and report how far the player got. */
  const travel = async (codes, ms) => {
    await doing(() => window.__HO.place(0, 4.6, 0));
    await real.waitForTimeout(120);
    const from = await doing(() => [window.__HO.game.player.position.x, window.__HO.game.player.position.z]);
    for (const code of codes) await real.keyboard.down(code);
    await real.waitForTimeout(ms);
    const to = await doing(() => [window.__HO.game.player.position.x, window.__HO.game.player.position.z]);
    for (const code of codes) await real.keyboard.up(code);
    await real.waitForTimeout(250);
    return [to[0] - from[0], to[1] - from[1]];
  };
  const forward = await travel(['KeyW'], 600);
  const back = await travel(['KeyS'], 400);
  const left = await travel(['KeyA'], 400);
  const right = await travel(['KeyD'], 400);
  keys['W A S D move'] = forward[1] < -1 && back[1] > 0.6 && left[0] < -0.6 && right[0] > 0.6;
  const dash = await travel(['ShiftLeft', 'KeyW'], 600);
  keys['Shift sprints'] = dash[1] < forward[1] * 1.25;

  await doing(() => window.__HO.place(0, 4.6, 0));
  await real.keyboard.down('Space');
  keys['Space jumps'] = await becomes(() => window.__HO.game.player.position.y > 0.3);
  await real.keyboard.up('Space');
  await becomes(() => window.__HO.game.player.onGround);

  await doing(() => {
    const ho = window.__HO;
    ho.place(0, 2.7, 0);
    ho.spawnRobot(0, 1.2, 0, true, 1.2, 70);
    ho.step(1 / 60, 20);
    ho.aimAtRobot('chest');
  });
  await key('KeyV');
  keys['V strikes'] = await becomes(() => window.__HO.game.robots.every((robot) => !robot.alive));

  await doing(() => {
    const ho = window.__HO;
    ho.clearRobots();
    ho.scrap(750);
    ho.place(-4.5, -0.9, 0);
  });
  await becomes(() => window.__HO.run().prompt?.usable === true);
  const wallet = (await at()).scrap;
  await key('KeyF');
  keys['F buys'] = (await becomes(() => window.__HO.run().weapon === 'shotgun')) && wallet - (await at()).scrap === 750;

  await real.waitForTimeout(500);
  await key('Digit1');
  const first = await becomes(() => window.__HO.run().weapon === 'pistol');
  await real.waitForTimeout(500);
  await key('Digit2');
  const second = await becomes(() => window.__HO.run().weapon === 'shotgun');
  await real.waitForTimeout(500);
  await real.mouse.wheel(0, 120);
  keys['1, 2 and the wheel switch weapons'] = first && second && (await becomes(() => window.__HO.run().weapon === 'pistol'));

  const muted = () => doing(() => JSON.parse(localStorage.getItem('human-override.settings.v1') ?? '{}').muted === true);
  const wasMuted = await muted();
  await key('KeyM');
  await real.waitForTimeout(150);
  const nowMuted = await muted();
  await key('KeyM');
  await real.waitForTimeout(150);
  keys['M mutes and unmutes'] = nowMuted !== wasMuted && (await muted()) === wasMuted;

  const dead = Object.entries(keys).filter(([, works]) => !works).map(([name]) => name);
  check('every control on the list does its job when really pressed', dead.length === 0, dead.length ? `not working: ${dead.join('; ')}` : Object.keys(keys).join('; '));
  await doing(() => {
    const ho = window.__HO;
    ho.god(false);
    ho.clearRobots();
    ho.place(0, 4.6, 0);
    ho.holdRounds(false);
  });

  await letGoOfMouse();
  await until('paused');
  s = await at();
  check('letting go of the mouse (Esc) pauses and shows the menu', s.state === 'paused' && !s.locked && (await real.locator('.screen.pause').isVisible()));

  const automatic = await real.evaluate(() => window.__HO.game.automaticQuality());
  const other = automatic === 'low' ? 'medium' : 'low';
  await real.click(`button[data-quality="${other}"]`);
  await real.waitForTimeout(400);
  const chosen = (await at()).quality;
  await real.click('button[data-quality="auto"]');
  await real.waitForTimeout(400);
  s = await at();
  check('choosing a quality level, then Auto, goes back to the level picked for this computer', chosen === other && s.quality === automatic, `${other}, then Auto: ${s.quality}`);

  await real.waitForTimeout(700);
  await real.click('button[data-action="resume"]');
  await until('playing');
  s = await at();
  check('Resume takes the mouse back and carries on', s.state === 'playing' && s.locked);

  // Go down: one point of health, and time run forward until a robot lands a blow.
  await real.evaluate(() => {
    const ho = window.__HO;
    ho.game.player.health = 1;
    for (let i = 0; i < 240 && ho.stats().state !== 'over'; i++) ho.step(1 / 60, 30);
  });
  await until('over');
  s = await at();
  check('going down lets go of the mouse and shows the game-over card', s.state === 'over' && !s.locked && (await real.locator('.screen.over').isVisible()), (await real.locator('.over-title').textContent()).trim());

  await real.click('.screen.over button[data-action="restart"]');
  await until('playing');
  s = await at();
  check('Play Again starts a fresh run with the mouse captured', s.state === 'playing' && s.locked && s.round === 0 && s.health === 100 && s.scrap === 0 && s.robots.length === 0);

  // The ending, for real: the kill switch pulled with the real F key, the
  // mouse let go for the HUMANITY SAVED screen, and taken back by a real
  // click on KEEP FIGHTING. Then END RUN, back to the title, where the
  // fastest mission time is shown.
  await doing(() => {
    const ho = window.__HO;
    ho.god(true);
    ho.holdRounds(true);
    ho.missionJump('armed');
    const place = ho.mission().places.killSwitch;
    ho.place(place.stand[0], place.stand[1], 180);
  });
  const offered = await becomes(() => window.__HO.run().prompt?.text === 'PULL THE KILL SWITCH');
  await key('KeyF');
  await until('saved');
  s = await at();
  const endingShown = await real.locator('.screen.saved').isVisible();
  check('the real F key pulls the kill switch; the ending lets go of the mouse', offered && s.state === 'saved' && !s.locked && endingShown, (await real.locator('.screen.saved .over-title').textContent()).trim());
  await real.waitForTimeout(700);
  await real.click('.screen.saved button[data-action="resume"]');
  await until('playing');
  s = await at();
  check('KEEP FIGHTING takes the mouse back and the same run carries on', s.state === 'playing' && s.locked && (await doing(() => window.__HO.mission().phase)) === 'saved');
  // Round the loop once more, to END RUN this time.
  await doing(() => window.__HO.missionJump('armed'));
  await becomes(() => window.__HO.run().prompt?.text === 'PULL THE KILL SWITCH');
  await key('KeyF');
  await until('saved');
  await real.waitForTimeout(700);
  await real.click('.screen.saved button[data-action="quit"]');
  await until('title');
  s = await at();
  const record = (await real.locator('.title-note').textContent()).trim();
  // (The time shown is that of the mission played in full further up. The
  // two runs just made here skipped straight to the switch with the debug
  // tools, and a skipped mission sets no record.)
  const fastest = /Fastest mission: (\d+):(\d\d)/.exec(record);
  check(
    'END RUN goes to the title screen, which shows the fastest mission time (and a mission skipped with the debug tools sets no record)',
    s.state === 'title' && (await real.locator('.screen.title').isVisible()) && fastest !== null && Number(fastest[1]) * 60 + Number(fastest[2]) > 60,
    record,
  );
  await real.click('button[data-action="start"]');
  await until('playing');
  s = await at();
  check('and Play starts a clean run from there', s.state === 'playing' && s.locked && s.round === 0 && (await doing(() => window.__HO.mission().phase)) === 'power');

  // A weak computer, imitated: the browser's processor is slowed sixteen
  // times over, so frames take far too long. On Auto the game should notice
  // within a few seconds, drop a quality level and say so.
  await doing(() => {
    window.__HO.god(true);
    window.__HO.holdRounds(true);
  });
  const slow = await real.context().newCDPSession(real);
  await slow.send('Emulation.setCPUThrottlingRate', { rate: 16 });
  const lowered = await real
    .waitForFunction((automatic) => window.__HO.stats().quality !== automatic || window.__HO.game.renderer.resolutionScale < 1, automatic, { timeout: 30000 })
    .then(() => true, () => false);
  await slow.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await real.waitForTimeout(300);
  const after = await doing(() => ({ quality: window.__HO.stats().quality, scale: window.__HO.game.renderer.resolutionScale, notice: document.querySelector('.hud-toast')?.textContent ?? '', setting: JSON.parse(localStorage.getItem('human-override.settings.v1') ?? '{}').quality ?? 'auto' }));
  check(
    'on a computer too slow for the picture, Auto lowers the quality by itself and says so',
    lowered && after.setting === 'auto' && (after.scale < 1 || /Graphics lowered/.test(after.notice)),
    `${automatic} -> ${after.quality}${after.scale < 1 ? ` at ${Math.round(after.scale * 100)}% resolution` : ''}: "${after.notice}"`,
  );
  await doing(() => {
    window.__HO.god(false);
    window.__HO.holdRounds(false);
  });

  await letGoOfMouse();
  await until('paused');
  await real.waitForTimeout(300);
  await real.click('.screen.pause button[data-action="quit"]');
  await until('title');
  s = await at();
  const note = (await real.locator('.title-note').textContent()).trim();
  check('Title Screen leaves the run, and the title shows the best round so far', s.state === 'title' && (await real.locator('.screen.title').isVisible()) && /round \d+/.test(note), note);
  await real.close();
} catch (error) {
  check('the real buttons work with real clicks', false, String(error.message ?? error).split('\n')[0]);
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
