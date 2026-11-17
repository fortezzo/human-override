// A stranger's first visit to the published game.
//
//   npm run check:live                  the address in site-address.txt
//   npm run check:live -- <address>     another address
//
// Everything else in tools/ tests the build on this computer. This opens the
// public address in a fresh browser (nothing remembered, nothing cached, no
// debug flag) and does what a visitor does: waits for the start screen,
// presses PLAY with a real click, walks, fires, and fights the first round
// with the real mouse and keys. It also reads the things other sites read
// when the link is shared, visits at a phone's size, and times the load on
// a slower connection. A last part uses the debug flag, on the live
// address, to let the autopilot play on through three rounds.

import fs from 'node:fs';
import sharp from 'sharp';
import { launch } from './lib/browser.mjs';
import { parseSiteAddress } from './lib/site-address.mjs';

const address = process.argv[2] ?? (fs.existsSync('site-address.txt') ? parseSiteAddress(fs.readFileSync('site-address.txt', 'utf8')) : '');
if (!address) {
  console.error('No address: site-address.txt has none. Give one: npm run check:live -- https://...');
  process.exit(1);
}
/** Seconds to the start screen that the spec allows on a normal connection, and the most the whole game may weigh (MB). */
const BUDGET = { seconds: 10, megabytes: 40 };

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const problems = [];
const watch = (page, label) => {
  page.on('console', (m) => m.type() === 'error' && problems.push(`${label}: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${label}: exception: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`${label}: failed to load ${r.url()} (${r.failure()?.errorText ?? '?'})`));
  page.on('response', (r) => r.status() >= 400 && problems.push(`${label}: ${r.status()} for ${r.url()}`));
};
const hud = (page) =>
  page.evaluate(() => {
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? '';
    const shown = (selector) => {
      const el = document.querySelector(selector);
      return !!el && !el.classList.contains('hidden');
    };
    return {
      round: Number(text('.hud-round-number')) || 0,
      sub: text('.hud-brand-sub'),
      scrap: Number(text('.hud-scrap-count').replace(/\D/g, '')) || 0,
      ammo: Number(text('.hud-ammo-count')),
      hint: document.querySelector('.hud-coach')?.classList.contains('show') ? text('.hud-coach-text') : '',
      hintDone: !!document.querySelector('.hud-coach.show.done'),
      over: shown('.screen.over'),
      overTitle: text('.screen.over .over-title'),
      locked: document.pointerLockElement !== null,
      hudShown: shown('.hud'),
    };
  });

console.log(`Visiting ${address} as a stranger would.\n`);

// ---- 1. The first visit: how long to the start screen, how much was fetched, and what the page says about itself.
const first = await launch({ width: 1920, height: 1080, capped: true });
watch(first.page, 'first visit');
const fetched = [];
first.page.on('requestfinished', async (request) => {
  try {
    const sizes = await request.sizes();
    fetched.push({ url: request.url(), bytes: sizes.responseBodySize + sizes.responseHeadersSize });
  } catch {
    // (The page went away before the size could be read.)
  }
});
const started = Date.now();
const response = await first.page.goto(address, { waitUntil: 'commit' });
await first.page.waitForSelector('.screen.title:not(.hidden)', { timeout: 120000 });
const toTitle = (Date.now() - started) / 1000;
await first.page.waitForTimeout(1500);
const megabytes = fetched.reduce((n, f) => n + f.bytes, 0) / 1048576;
const offSite = fetched.filter((f) => !f.url.startsWith(address) && !f.url.startsWith('blob:') && !f.url.startsWith('data:'));
check('the address answers, over https', response.status() === 200 && address.startsWith('https://'), `status ${response.status()}`);
check(`the start screen is up within the ${BUDGET.seconds} seconds the spec allows on a normal connection`, toTitle <= BUDGET.seconds, `${toTitle.toFixed(1)} s on this computer's own connection, nothing cached`);
check(`the whole game is under ${BUDGET.megabytes} MB to fetch`, megabytes > 5 && megabytes < BUDGET.megabytes, `${megabytes.toFixed(1)} MB in ${fetched.length} files`);
check('nothing is fetched from anywhere but the game\'s own address (no trackers, no outside scripts or fonts)', offSite.length === 0, offSite.length ? offSite.slice(0, 3).map((f) => f.url).join(', ') : `${fetched.length} requests, all to ${new URL(address).host}`);

const head = await first.page.evaluate(async () => {
  const meta = (key) => document.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.getAttribute('content') ?? '';
  const sizeOf = (src) =>
    new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
      image.onerror = () => resolve([0, 0]);
      image.src = src;
    });
  const icons = [...document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')].map((link) => link.href);
  return {
    title: document.title,
    description: meta('description'),
    ogTitle: meta('og:title'),
    ogImage: meta('og:image'),
    ogUrl: meta('og:url'),
    card: meta('twitter:card'),
    twitterImage: meta('twitter:image'),
    icons,
    iconSizes: await Promise.all(icons.map(sizeOf)),
    tools: typeof window.__HO,
    words: document.body.innerText,
    buttons: [...document.querySelectorAll('.screen.title button')].map((b) => b.textContent.trim()),
  };
});
// The preview picture, fetched the way another site's server fetches it: from outside, by the address in the tag.
const preview = { status: 0, type: '', size: [0, 0], kilobytes: 0 };
try {
  const fetchedPicture = await fetch(head.ogImage, { cache: 'no-store' });
  preview.status = fetchedPicture.status;
  preview.type = fetchedPicture.headers.get('content-type') ?? '';
  const bytes = Buffer.from(await fetchedPicture.arrayBuffer());
  preview.kilobytes = Math.round(bytes.length / 1024);
  const info = await sharp(bytes).metadata();
  preview.size = [info.width ?? 0, info.height ?? 0];
} catch {
  // (Not there, or not a picture: the check below says so.)
}
check('the page title is the game\'s', /^HUMAN OVERRIDE/.test(head.title), `"${head.title}"`);
check('it has a description for search results and link previews', head.description.length > 80 && head.ogTitle.length > 10, `"${head.description.slice(0, 70)}..."`);
check(
  'the link preview picture is named by its full public address, is there, and is 1200 by 630',
  head.ogImage === `${address}social-preview.jpg` && head.twitterImage === head.ogImage && head.ogUrl === address && head.card === 'summary_large_image' && preview.status === 200 && /^image\/jpeg/.test(preview.type) && preview.size[0] === 1200 && preview.size[1] === 630,
  `${head.ogImage}: status ${preview.status}, ${preview.type}, ${preview.size.join(' x ')}, ${preview.kilobytes} KB`,
);
check('the icons load: one for the browser tab, a PNG, and one for a phone\'s home screen', head.icons.length >= 3 && head.iconSizes.every(([w, h]) => w > 0 && h > 0), head.icons.map((href, i) => `${href.split('/').pop()} ${head.iconSizes[i].join('x')}`).join(', '));
check('a visitor\'s page has none of the test tools on it, and no debug word or frame-rate counter on the start screen', head.tools === 'undefined' && !/debug|autopilot|god mode|\bfps\b|localhost|127\.0\.0\.1/i.test(head.words), `start screen buttons: ${head.buttons.join(', ')}`);

// ---- 2. PLAY, with a real click; then the real keys and the real mouse.
// (Where the pointer is when the mouse is captured: every turn of the view afterwards is a move measured from here.)
const playButton = await first.page.locator('.screen.title [data-action="start"]').boundingBox();
const pointer = { x: Math.round(playButton.x + playButton.width / 2), y: Math.round(playButton.y + playButton.height / 2) };
await first.page.mouse.click(pointer.x, pointer.y);
await first.page.waitForFunction(() => document.pointerLockElement !== null && !document.querySelector('.hud').classList.contains('hidden'), null, { timeout: 15000 }).catch(() => {});
let s = await hud(first.page);
check('PLAY starts a run: the mouse is captured and the HUD is up', s.locked && s.hudShown && !s.over, `${s.ammo} rounds in the sidearm`);
await first.page.waitForFunction(() => document.querySelector('.hud-coach')?.classList.contains('show'), null, { timeout: 10000 }).catch(() => {});
s = await hud(first.page);
const firstHint = s.hint;
await first.page.keyboard.down('KeyW');
let moved = false;
for (let i = 0; i < 20 && !moved; i++) {
  await first.page.waitForTimeout(100);
  moved = (await hud(first.page)).hintDone;
}
await first.page.keyboard.up('KeyW');
check('the first hint is waiting for a new player (MOVE), and holding W does it', firstHint === 'MOVE' && moved, `hint shown: "${firstHint}"; turned green after walking: ${moved}`);
const before = (await hud(first.page)).ammo;
await first.page.mouse.down();
await first.page.waitForTimeout(60);
await first.page.mouse.up();
await first.page.waitForTimeout(400);
const afterShot = (await hud(first.page)).ammo;
check('a real left click fires one round', before - afterShot === 1, `${before} rounds, then ${afterShot}`);

// The first round, fought the plainest way there is: stand, face the entrance the robots come in by, and keep
// firing, sweeping a little from side to side and reloading when the sidearm runs dry. No aiming help of any kind.
// (The view is tipped down about five degrees first, as anyone's would be: level, the sidearm fires over the
// back of a hunched robot.)
const TIP = 46;
await first.page.mouse.move(pointer.x, pointer.y + TIP, { steps: 4 });
let sweep = 0;
let direction = 1;
let outcome = 'still fighting when the time allowed ran out';
let most = { round: 0, scrap: 0 };
const fightUntil = Date.now() + 150000;
while (Date.now() < fightUntil) {
  s = await hud(first.page);
  most = { round: Math.max(most.round, s.round), scrap: Math.max(most.scrap, s.scrap) };
  if (s.over) {
    outcome = `went down: "${s.overTitle}"`;
    break;
  }
  if (s.round >= 2) {
    outcome = 'round 1 cleared, round 2 begun';
    break;
  }
  if (s.ammo === 0) {
    await first.page.keyboard.press('KeyR');
    await first.page.waitForTimeout(1500);
    continue;
  }
  await first.page.mouse.down();
  await first.page.waitForTimeout(50);
  await first.page.mouse.up();
  // (Mouse movement turns the view: a slow sweep across the doorway and back.)
  sweep += direction;
  if (Math.abs(sweep) >= 6) direction = -direction;
  await first.page.mouse.move(pointer.x + sweep * 12, pointer.y + TIP, { steps: 2 });
  await first.page.waitForTimeout(150);
}
check('a round can be played with the real mouse and keys: robots come in, shots land and pay scrap, and the round ends', most.scrap > 0 && (most.round >= 2 || /ROUND/.test(outcome)), `${outcome}; ${most.scrap} scrap earned`);
if ((await hud(first.page)).over) {
  await first.page.click('.screen.over [data-action="restart"]');
  await first.page.waitForFunction(() => document.pointerLockElement !== null && document.querySelector('.screen.over').classList.contains('hidden'), null, { timeout: 10000 }).catch(() => {});
  s = await hud(first.page);
  check('PLAY AGAIN starts a fresh run', s.locked && !s.over && s.scrap === 0, `scrap ${s.scrap}, round ${s.round}`);
}
await first.browser.close();

// ---- 3. On, through three rounds, with the debug flag and the autopilot (the same live files; the flag only adds the tools).
const debug = await launch({ width: 1280, height: 720, capped: true });
watch(debug.page, 'autopilot');
await debug.page.goto(`${address}?debug=1`);
await debug.page.waitForFunction(() => window.__HO?.ready, null, { timeout: 120000 });
await debug.page.evaluate(() => {
  const ho = window.__HO;
  ho.hints?.(false);
  ho.play();
  ho.god(true);
  ho.autopilot(true);
});
await debug.page.waitForFunction(() => window.__HO.run().round >= 3, null, { timeout: 240000 }).catch(() => {});
const played = await debug.page.evaluate(() => ({ round: window.__HO.run().round, state: window.__HO.run().state, fps: Math.round(window.__HO.stats().fps), quality: window.__HO.stats().quality, gpu: window.__HO.stats().gpu }));
check('the autopilot plays the live game on into round 3', played.round >= 3 && played.state === 'playing', `round ${played.round}; ${played.fps} frames a second on ${played.quality}, ${played.gpu}`);
await debug.browser.close();

// ---- 4. At a phone's size, with a touch screen: the note, and the address to open on a computer.
{
  const { browser } = await launch({ width: 414, height: 896, capped: true });
  const phone = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const page = await phone.newPage();
  watch(page, 'phone');
  await page.goto(address);
  await page.waitForSelector('.screen.touch:not(.hidden)', { timeout: 120000 }).catch(() => {});
  const note = await page.evaluate(() => ({
    shown: !!document.querySelector('.screen.touch') && !document.querySelector('.screen.touch').classList.contains('hidden'),
    text: document.querySelector('.touch-note')?.textContent ?? '',
    url: document.querySelector('.touch-url')?.textContent ?? '',
    play: !!document.querySelector('.screen.title:not(.hidden)'),
  }));
  const expected = address.replace(/^https?:\/\//, '');
  check('at a phone\'s size, with a touch screen, the visitor gets the note to play on a computer, with this address to open there', note.shown && /mouse and keyboard/i.test(note.text) && note.url === expected && !note.play, `address shown: "${note.url}"`);
  await browser.close();
}

// ---- 5. The same first visit on a slower connection (50 megabits a second, simulated), nothing cached.
{
  const { browser, context, page } = await launch({ width: 1920, height: 1080, capped: true });
  watch(page, 'slow connection');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 30, downloadThroughput: (50 * 1e6) / 8, uploadThroughput: 1e6 });
  const t0 = Date.now();
  await page.goto(address, { waitUntil: 'commit' });
  await page.waitForSelector('.screen.title:not(.hidden)', { timeout: 180000 });
  const seconds = (Date.now() - t0) / 1000;
  check(`on a 50 megabit connection the start screen is still up within ${BUDGET.seconds} seconds`, seconds <= BUDGET.seconds, `${seconds.toFixed(1)} s`);
  await browser.close();
}

// Shader translation warnings from the graphics driver are not errors.
const errors = [...new Set(problems)].filter((p) => !/X3595|gradient instruction/.test(p));
check('no console errors and no failed requests, in any of those visits', errors.length === 0, errors.slice(0, 5).join(' | '));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed on ${address}`);
process.exit(failed.length ? 1 : 0);
