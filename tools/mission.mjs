// How does the mission go for a player who is trying to finish it? Plays
// whole runs with the autopilot following the objective tracker, with no
// god mode and no free scrap, without drawing them (so a fifteen-minute
// mission takes a few seconds), and reports how long each step took, what
// round it was, and how each run ended.
//
//   npm run build && npm run mission             12 runs as the skilled player
//   npm run mission -- 20                        20 runs
//   npm run mission -- 12 regular                as the regular player
//   npm run mission -- 12 firstTimer             as the first-timer
//   npm run mission -- 12 expert                 as the expert, which never misses
//
// The regular player is the model the mission is paced for: a real person
// a few attempts in, with nearly a beginner's hands and sensible habits
// (the spec: a focused player finishes in 15 to 20 minutes, with a final
// stand that is hard but winnable). The skilled player is a good deal
// stronger than that, and the first-timer is a rough model of someone new
// to this kind of game. They are models, not people: they show whether the
// numbers are in the right place, not how the game feels.
//
// (HO_DIST=some-folder plays a copy of the build kept in that folder, so
// that a long batch can go on measuring one version while another is built.)
//
// (While tuning, set HO_URL to the address of a running dev server and the
// production build is not needed: HO_URL=http://localhost:5173/ npm run mission)

import fs from 'node:fs';
import { launch } from './lib/browser.mjs';
import { serve } from './lib/static-server.mjs';

const runs = Number(process.argv[2] ?? 12);
const pilot = process.argv[3] ?? 'skilled';
/** Give up on a run that is still going after this many game minutes. */
const MINUTE_CAP = Number(process.argv[4] ?? 45);

const external = process.env.HO_URL;
const dist = process.env.HO_DIST ?? 'dist';
if (!external && !fs.existsSync(`${dist}/index.html`)) {
  console.error('No production build found. Run "npm run build" first.');
  process.exit(1);
}
const site = external ? null : await serve(dist, '/');
const { browser, page } = await launch({ width: 640, height: 360 });
page.on('pageerror', (e) => console.log('exception:', e.message));
await page.goto(`${external ?? site.url}?debug=1`);
await page.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
await page.evaluate(() => {
  window.__HO.freeze(true);
  window.__HO.play();
});

/** The mission's steps, in the order they are usually reached. */
const STEPS = [
  ['power', 'power restored'],
  ['cageKey', 'key from the cage'],
  ['uplinkStarted', 'uplink started'],
  ['uplinkKey', 'key from the uplink'],
  ['custodian', 'the Custodian arrives'],
  ['custodianKey', "the Custodian's key"],
  ['core', 'core unsealed'],
  ['stand', 'switch armed: the final stand begins'],
  ['proxy', 'the Proxy arrives'],
  ['proxyDestroyed', 'the Proxy destroyed'],
  ['armed', 'switch ready'],
  ['saved', 'switch pulled'],
];

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? NaN : sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
};

const names = { firstTimer: 'first-timer', regular: 'regular player', skilled: 'skilled player', expert: 'expert' };
console.log(`${runs} missions as the ${names[pilot] ?? pilot}, no god mode\n`);
console.log('run   outcome                                     time   round   keys   accuracy   destroyed   carrying');
const results = [];
const started = Date.now();
for (let n = 0; n < runs; n++) {
  await page.evaluate((pilot) => {
    const ho = window.__HO;
    ho.autopilot(false);
    ho.restart();
    ho.god(false);
    ho.autopilot(true, pilot, true);
    window.__marks = {};
  }, pilot);
  let state;
  for (;;) {
    state = await page.evaluate(() => {
      const ho = window.__HO;
      const game = ho.game;
      const marks = window.__marks;
      for (let i = 0; i < 1200 && game.state === 'playing'; i++) {
        ho.simulate(1 / 60, 1);
        const s = game.mission.state;
        const mark = (name) => {
          if (!(name in marks)) marks[name] = { time: game.stats.time, round: game.stats.round };
        };
        if (s.phase !== 'power') mark('power');
        if (s.keys.cage) mark('cageKey');
        if (s.uplink !== 'idle') mark('uplinkStarted');
        if (s.keys.uplink) mark('uplinkKey');
        if (s.custodian !== 'waiting') mark('custodian');
        if (s.keys.custodian) mark('custodianKey');
        if (s.coreOpen) mark('core');
        if (s.phase === 'arming' || s.phase === 'armed' || s.phase === 'saved') mark('stand');
        if (s.bossSent) mark('proxy');
        if (s.bossDestroyed) mark('proxyDestroyed');
        if (s.phase === 'armed' || s.phase === 'saved') mark('armed');
        if (s.phase === 'saved') mark('saved');
      }
      const run = ho.run();
      const stats = game.stats;
      const s = game.mission.state;
      return {
        state: game.state,
        phase: s.phase,
        doing: game.mission.objective.title,
        keys: Object.values(s.keys).filter(Boolean).length,
        round: stats.round,
        kills: stats.kills,
        accuracy: stats.shots ? stats.shotsHit / stats.shots : 0,
        slots: run.slots.filter(Boolean).join(' + '),
        time: stats.time,
        marks: { ...marks },
      };
    });
    if (state.state !== 'playing' || state.time > MINUTE_CAP * 60) break;
  }
  state.saved = 'saved' in state.marks;
  state.timedOut = !state.saved && state.state === 'playing';
  results.push(state);
  const outcome = state.saved ? 'HUMANITY SAVED' : state.timedOut ? `still going: ${state.doing.toLowerCase()}` : `down: ${state.doing.toLowerCase()}`;
  console.log(
    `${String(n + 1).padStart(3)}   ${outcome.slice(0, 42).padEnd(42)} ${clock(state.saved ? state.marks.saved.time : state.time).padStart(5)}   ${String(state.saved ? state.marks.saved.round : state.round).padStart(5)}   ${`${state.keys}/3`.padStart(4)}   ${`${Math.round(state.accuracy * 100)}%`.padStart(8)}   ${String(state.kills).padStart(9)}   ${state.slots}`,
  );
}

// ---- How far they got, and when.
console.log('\nstep                                    reached   median time   median round   earliest   latest');
for (const [key, label] of STEPS) {
  const reached = results.filter((r) => key in r.marks);
  if (!reached.length) {
    console.log(`${label.padEnd(38)} ${`0/${runs}`.padStart(8)}`);
    continue;
  }
  const times = reached.map((r) => r.marks[key].time);
  const rounds = reached.map((r) => r.marks[key].round);
  console.log(
    `${label.padEnd(38)} ${`${reached.length}/${runs}`.padStart(8)}   ${clock(median(times)).padStart(11)}   ${String(median(rounds)).padStart(12)}   ${clock(Math.min(...times)).padStart(8)}   ${clock(Math.max(...times)).padStart(6)}`,
  );
}

// ---- The headline numbers.
const won = results.filter((r) => r.saved);
const stood = results.filter((r) => 'stand' in r.marks);
const lost = results.filter((r) => !r.saved && !r.timedOut);
console.log('');
if (won.length) {
  const times = won.map((r) => r.marks.saved.time);
  const rounds = won.map((r) => r.marks.saved.round);
  const inTime = times.filter((t) => t >= 15 * 60 && t <= 20 * 60).length;
  const inRounds = rounds.filter((r) => r >= 10 && r <= 12).length;
  console.log(`Finished the mission: ${won.length} of ${runs} (${Math.round((won.length / runs) * 100)}%). Median ${clock(median(times))} in round ${median(rounds)}; fastest ${clock(Math.min(...times))}, slowest ${clock(Math.max(...times))}.`);
  console.log(`  ${inTime} of those ${won.length} took between 15 and 20 minutes; ${inRounds} ended in rounds 10 to 12.`);
  const stands = won.map((r) => r.marks.saved.time - r.marks.stand.time);
  console.log(`  The final stand took them ${clock(median(stands))} (median) from arming the switch to pulling it.`);
} else {
  console.log(`Finished the mission: 0 of ${runs}.`);
}
console.log(`Reached the final stand: ${stood.length} of ${runs}${stood.length ? `, and won it ${stood.filter((r) => r.saved).length} times (${Math.round((stood.filter((r) => r.saved).length / stood.length) * 100)}%)` : ''}.`);
if (lost.length) {
  const where = {};
  for (const r of lost) where[r.doing.toLowerCase()] = (where[r.doing.toLowerCase()] ?? 0) + 1;
  const rounds = lost.map((r) => r.round);
  console.log(`Went down: ${lost.length} of ${runs}, in round ${median(rounds)} (median; ${Math.min(...rounds)} to ${Math.max(...rounds)}). What they were doing:`);
  for (const [what, count] of Object.entries(where).sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(3)} x  ${what}`);
}
const stuck = results.filter((r) => r.timedOut);
if (stuck.length) console.log(`\n${stuck.length} run(s) were still going after ${MINUTE_CAP} game minutes and were stopped. That is worth a look: something may be out of reach.`);
console.log(`\n(${((Date.now() - started) / 1000).toFixed(0)} seconds to play them.)`);

await browser.close();
await site?.close();
process.exit(stuck.length ? 1 : 0);
