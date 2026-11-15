// How far does a player get? Plays whole runs with the autopilot, without
// drawing them (so a ten-minute run takes a few seconds), and counts the
// round each one ended in.
//
//   npm run build && npm run balance             12 runs as the first-timer
//   npm run balance -- 20                        20 runs
//   npm run balance -- 12 expert                 as the expert, which never misses
//
// The first-timer is a rough model of someone new to this kind of game:
// slow to notice a robot, shaky, aims at the body, backs away late, runs
// when hurt. The spec asks that a first-time player usually goes down
// between rounds 5 and 8, and this is how that is checked. It is a model,
// not a person: it shows whether the numbers are in the right place, not
// how the game feels.

import fs from 'node:fs';
import { launch } from './lib/browser.mjs';
import { serve } from './lib/static-server.mjs';

const runs = Number(process.argv[2] ?? 12);
const pilot = process.argv[3] ?? 'firstTimer';
/** Give up on a run that is still going at this round (the expert can go on a long time). */
const ROUND_CAP = Number(process.argv[4] ?? 14);
/** A round that lasts this many game minutes has stalled: something cannot reach something. */
const STALL_MINUTES = 6;

if (!fs.existsSync('dist/index.html')) {
  console.error('No production build found. Run "npm run build" first.');
  process.exit(1);
}

const site = await serve('dist', '/');
const { browser, page } = await launch({ width: 640, height: 360 });
page.on('pageerror', (e) => console.log('exception:', e.message));
await page.goto(`${site.url}?debug=1`);
await page.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
await page.evaluate(() => {
  window.__HO.freeze(true);
  window.__HO.play();
});

console.log(`${runs} runs as the ${pilot === 'firstTimer' ? 'first-timer' : pilot}\n`);
console.log('run   ended in round   robots destroyed   accuracy   scrap earned   doors   carrying             time');
const results = [];
const started = Date.now();
for (let n = 0; n < runs; n++) {
  await page.evaluate((pilot) => {
    const ho = window.__HO;
    ho.autopilot(false);
    ho.restart();
    ho.god(false);
    ho.autopilot(true, pilot);
  }, pilot);
  let state;
  let round = 0;
  let roundBegan = 0;
  for (;;) {
    state = await page.evaluate(() => {
      const ho = window.__HO;
      for (let i = 0; i < 1200 && ho.stats().state === 'playing'; i++) ho.simulate(1 / 60, 1);
      const run = ho.run();
      const stats = ho.game.stats;
      return {
        over: run.state !== 'playing',
        round: run.round,
        kills: run.kills,
        accuracy: stats.shots ? stats.shotsHit / stats.shots : 0,
        earned: run.earned,
        doors: Object.values(run.doors).filter(Boolean).length,
        slots: run.slots.filter(Boolean).join(' + '),
        time: stats.time,
      };
    });
    if (state.round !== round) {
      round = state.round;
      roundBegan = state.time;
    }
    state.stalled = !state.over && state.time - roundBegan > STALL_MINUTES * 60;
    if (state.over || state.stalled || state.round >= ROUND_CAP) break;
  }
  results.push(state);
  const minutes = `${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`;
  console.log(
    `${String(n + 1).padStart(3)}   ${(state.over ? String(state.round) : state.stalled ? `${state.round} (STALLED)` : `${state.round}+ (stopped)`).padEnd(16)} ${String(state.kills).padStart(16)}   ${`${Math.round(state.accuracy * 100)}%`.padStart(8)}   ${String(state.earned).padStart(12)}   ${String(state.doors).padStart(5)}   ${state.slots.padEnd(20)} ${minutes}`,
  );
}

const rounds = results.map((r) => r.round).sort((a, b) => a - b);
const median = rounds.length % 2 ? rounds[(rounds.length - 1) / 2] : (rounds[rounds.length / 2 - 1] + rounds[rounds.length / 2]) / 2;
const inTarget = rounds.filter((r) => r >= 5 && r <= 8).length;
const tally = {};
for (const r of rounds) tally[r] = (tally[r] ?? 0) + 1;
console.log(`\nEnded in round:  ${Object.entries(tally).map(([round, count]) => `${round} (x${count})`).join('   ')}`);
console.log(`Median round ${median}; ${inTarget} of ${rounds.length} runs (${Math.round((inTarget / rounds.length) * 100)}%) ended in rounds 5 to 8; earliest ${rounds[0]}, latest ${rounds[rounds.length - 1]}.`);
console.log(`(${((Date.now() - started) / 1000).toFixed(0)} seconds to play them.)`);
const stalled = results.filter((r) => r.stalled).length;
if (stalled) console.log(`
${stalled} run(s) STALLED: a round went on for more than ${STALL_MINUTES} game minutes. That is a bug, not a result.`);

await browser.close();
await site.close();
process.exit(stalled ? 1 : 0);
