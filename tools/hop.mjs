// Does hopping over a barrier let a player dodge the horde for ever?
//
// The player can jump anything up to about waist height, and the robots
// cannot: they walk round. This plays a "hopper", a player who never fires
// a shot and does nothing but stand beside something low until the robots
// are nearly on them, jump it, and wait on the far side to do it again. If
// that worked, a round would never have to be fought. Each try is timed
// from the first robot coming near until the hopper goes down, and set
// beside someone who just stands there.
//
//   npm run build && npm run hop          rounds 3, 6, 8 and 10, 5 tries at each place
//   npm run hop -- 8 3                    round 8 only, 3 tries
//
// It is a model, not a person; what it shows is that the robots still get
// to someone who plays like this, and roughly how soon.

import fs from 'node:fs';
import { launch } from './lib/browser.mjs';
import { HOP_SITES, hopTrial } from './lib/jumping.mjs';
import { serve } from './lib/static-server.mjs';

const rounds = process.argv[2] ? [Number(process.argv[2])] : [3, 6, 8, 10];
const tries = Number(process.argv[3] ?? 5);
/** A try still going after this many seconds has dodged the horde for long enough to call it "for ever". */
const CAP = Number(process.argv[4] ?? 240);
const dist = process.env.HO_DIST ?? 'dist';
if (!fs.existsSync(`${dist}/index.html`)) {
  console.error('No production build found. Run "npm run build" first.');
  process.exit(1);
}

const site = await serve(dist, '/');
const { browser, page } = await launch({ width: 640, height: 360 });
page.on('pageerror', (e) => console.log('exception:', e.message));
await page.goto(`${site.url}?debug=1`);
await page.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
await page.evaluate(() => {
  window.__HO.freeze(true);
  window.__HO.play();
});

console.log(`${tries} tries at each place in each round; a try is stopped after ${CAP} seconds. Seconds until the player went down:\n`);
let escaped = 0;
let longest = 0;
for (const round of rounds) {
  console.log(`Round ${round}`);
  for (const place of HOP_SITES) {
    const line = [];
    for (const policy of ['hop', 'stand']) {
      const results = [];
      for (let n = 0; n < tries; n++) results.push(await page.evaluate(hopTrial, { place, policy, round, cap: CAP }));
      const times = results.map((r) => r.seconds).sort((x, y) => x - y);
      const still = results.filter((r) => !r.down).length;
      if (policy === 'hop') {
        escaped += still;
        longest = Math.max(longest, ...times);
        line.push(`hopping ${times.map((t) => t.toFixed(0)).join(', ')} (${Math.round(results.reduce((sum, r) => sum + r.hops, 0) / results.length)} hops a try)${still ? `, ${still} STILL STANDING` : ''}`);
      } else {
        line.push(`standing still ${times.map((t) => t.toFixed(0)).join(', ')}`);
      }
    }
    console.log(`  ${place.name}: ${line.join('; ')}`);
  }
}
console.log(escaped ? `\n${escaped} tries were still standing when stopped: hopping dodged the horde.` : `\nNo try outlasted the horde. The longest any hopper lasted was ${longest.toFixed(0)} seconds: hopping buys a little time, never safety.`);

await browser.close();
await site.close();
process.exit(escaped ? 1 : 0);
