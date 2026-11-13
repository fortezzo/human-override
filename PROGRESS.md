# Progress

The full specification is in [SPEC.md](SPEC.md). This file records what has been built so far, the design decisions made along the way, and what is still rough. It is updated at the end of every stage.

## Where things stand

| Stage | What | Status |
| --- | --- | --- |
| 0 | The look test: one room, one robot, one rifle | **Built. First round of feedback fixed (see below). Waiting for approval of the look.** |
| 1 | Core loop: whole map, rounds, scrap, weapons, HUD, restart, debug mode | Not started |
| 2 | The mission | Not started |
| 3 | ARGUS: specials, tracking, counters, banner, end-of-run report | Not started |
| 4 | Full economy | Not started |
| 5 | Polish | Not started |

The look lives in `media/look-target/`. Later stages are judged against those pictures. They are re-taken with `npm run build` then `npm run shots`.

## Stage 0 feedback, round 1: what changed

The mood, lighting direction, signage, menus and HUD were approved; the look as a whole was not. Six things were asked for, in this order.

| # | Asked for | What was done | How it was checked |
| --- | --- | --- | --- |
| 1 | The robot must stop reading as the stock mannequin | The mannequin's body is gone. The game now ships only its skeleton and movements, and builds an original body on them in code: "the Drudge", a hunched machine with a visor slit and sensor cluster, armor plates, exposed pistons, bellows and cables, three-claw hands, longer forearms and wider shoulders, in dark gunmetal with rust and grime. Your second character (X Bot) was checked first: it is the same mannequin family, so it was not a better base. | Judged at three distances in the room (doorway silhouette, mid-range, close up); pictures 02, 03, 07, 08 |
| 2 | Aiming: light the weapon, less of the view, a proper sight picture | The rifle's own tiny folding sight is removed and a raised reflex sight is mounted in its place, so the eye sits 68 mm above the gun instead of 33 mm and the gun takes about half the width it did. The sight has a glowing ring-and-dot reticle that stays on the point of aim. The rifle carries its own soft fill light and its near-black paint is lifted to gunmetal. | Picture 11; an automated check that the reticle comes up when aiming |
| 3 | Upper wall texture looked tiled and cheap | Replaced with a calm painted plaster. Stains, water runs and soot are now worked out from each point's position in the room, so they never repeat. The long walls are divided into bays by a concrete ring beam and shallow piers. | Pictures 04, 05, 06 |
| 4 | Too dark; Low much darker than High; brightness slider | Every light is now on at every quality level (quality only decides how many cast shadows). Fill light raised, two soft "bounce" lights added along the aisle, and the film-style tone curve no longer clips the darkest tones to pure black. New Brightness slider in the pause menu. | Measured: near-black share of the picture fell from 33-85% to 3-14% across eight views; average brightness differs by under 1 part in 255 between Low and Ultra; both are now automated checks |
| 5a | Sign wear made "OVERRIDE" read "OVERRICE" | Wear is now sized against each sign's thinnest stroke: a chip can bite a letter but never cut it through. The two red warning signs were also hard to read (red paint is darker than the wall), so they are now painted on a pale panel, and the shelving that stood in front of one was moved. | Every sign read back from the full sheet of signs |
| 5b | Hard edges where lamp cones cross the shutter | The cause was not the cones themselves: the ambient-occlusion pass treated every see-through effect as glass and switched itself off behind it, stamping the cone's outline onto whatever was behind. Effects that only add light are now marked so the pass ignores them. The doorway shaft was also moved to pass under the shutter. | Pictures 03, 07, 11 |
| 5c | Muzzle flash was a soft round glow | Now a spiky star with two crossed tongues of flame, drawn for two frames (0.034 s), different every shot. The glint where a bullet strikes a robot is smaller and shorter so it no longer hides the target. | Picture 08; an automated check that the flash is gone within 4 frames |
| 5d | Destroyed parts looked like chrome blobs and stood upright; a shadow with nothing casting it | Parts use the robot's own material and tip over to lie flat. The shadow was real: a piece still in the air near the doorway, lit from very low by the yard floodlight. Parts are now thrown less hard. | Pictures 09, 10 |
| 5e | Boxes by the server hall door looked tilted into each other | The red tool chest stands open (its lid leans back), which read as tilted against the crate. It now stands against the wall with its lid to the wall, and the ammunition cans sit squarely on the crate. | Pictures 04, 06 |
| 5f | Wall graphic showed through the title | A dark, softly blurred panel sits behind the title, and the title is sized to stay inside it. | Picture 01 |
| 6 | Credits must match your four gun links | Done, and it exposed a mistake of mine: see decision 16. | `npm run check:credits` now fails if the credits and `links.txt` disagree |

Two things found and fixed along the way that were not on the list:

- **The robot slowly folded in half when standing still.** A bug I introduced with the new robot: its built-in hunch was added again every frame whenever the animation held a bone still. It showed on the title screen and in the close-up. Fixed, with a unit test that pins it down.
- **Low was still very slightly brighter than the rest** (it has no ambient occlusion). Its exposure is now trimmed to match.

## Stage 0: what is built

**The security lobby** (`src/world/lobby/`)
- 18 x 14 m room, 4.8 m ceiling: two-tone walls (painted plaster above a painted concrete band) divided into bays by a concrete ring beam and piers, four columns with hazard sleeves, steel girders and joists, corrugated ceiling deck.
- Openings: the breached main entrance with a jammed roller shutter, an entry corridor and foggy yard beyond it; two shuttered west windows (one torn open); the blast door to the server hall; the power room door.
- Services: a ventilation duct run, three pipe runs with hangers and valve stations, a cable tray, four pendant lamps, caged strip lights.
- Furnishing: security desk with a wall of six monitors showing ARGUS feeds, the defenders' barricade and tripod flood light, ammunition crates, shelving, drums, a hand truck, security cameras.
- Stencilled signage and floor markings drawn in code, leak stains, hazard paint.

**Rendering** (`src/render/`)
- Physically based materials from downloaded texture sets, with world-scaled texturing, damp patches on the floor and weathering on the walls that never repeats.
- 18 lights described as data, all switched on at every quality level; the quality preset only decides how many cast shadows.
- Reflections and bounce light baked from the room itself at load.
- Fog, light-shaft cones, haze cards, dust specks that light up in beams.
- Post-processing: ambient occlusion, bloom, chromatic aberration, a single-pass filmic grade (tone mapping, cold/warm split toning, selective desaturation, shadow lift, vignette, grain, the player's brightness setting), SMAA anti-aliasing.
- Four quality presets, automatic selection, automatic step-down, and a resolution fallback below the lowest preset.

**The robot** (`src/entities/robot/`, `src/sim/robotMind.ts`, `src/sim/navGrid.ts`)
- "The Drudge": an original body of about 7,400 triangles, built in code from chamfered plates, tubes, bellows and cables (`src/render/shapes.ts`, `src/entities/robot/kit/`, `designs/drudge.ts`) on a 22-bone skeleton with eight recorded movements.
- Flow-field path-finding on a 30 cm grid; walks in, turns, attacks, flinches, staggers, takes head/torso/limb damage.
- On destruction: brief collapse, then 11 rigid chunks thrown with simple physics that settle flat, sparks, smoke, a floor scorch.

**The rifle** (`src/entities/weapon/`, `src/sim/weapon.ts`)
- Hitscan with a spread cone that grows with movement and sustained fire, 30-round magazine, 650 rounds a minute.
- View model with its own lens and its own fill light, sway, bob, recoil spring, a raised reflex sight with a reticle that stays on the point of aim, a procedural reload, a two-frame muzzle flash and light, tracers, ejected casings.
- Bullet decals (concrete craters, steel dents), sparks, dust and chips per surface type.

**Sound** (`src/audio/`, `tools/assets/audio-spec.mjs`)
- 61 sounds cut, layered and levelled from CC0 / CC-BY recordings. 3D positioning, a generated room reverb, a limiter, looping ambience and music bed.

**Interface** (`src/ui/`)
- Loading screen with progress, start screen over the live scene, HUD (crosshair that follows the real spread, hit markers, damage direction, health, ammo, FPS), pause menu with settings (quality, sensitivity, brightness, volume, FPS counter, reduced shake and flashing; all remembered), credits screen, and a "use a computer" screen for touch devices.

**Tooling** (`tools/`)
- Asset pipeline: one manifest of every third-party asset; scripts that download, convert and compress them; `CREDITS.md` and the in-game credits generated from the same manifest.
- `npm run e2e`, `shots`, `perf`, `check:credits`, plus 46 unit tests.

## Design decisions made in Stage 0

1. **Lighting concept: warm room, cold enemy.** The room's own lamps are warm; everything hostile is cold or red. Robots arrive back-lit from the yard so they read as silhouettes with a glowing visor first.
2. **The room is built in code from a kit, not modelled in a 3D editor.** Structure is simple solids with real texture sets; all detail objects are downloaded models. This keeps the map editable as text and lets later rooms reuse the kit.
3. **The robot's body is original and built in code; only its skeleton and movements come from Mixamo.** No mannequin model ships with the game. Neither of your two characters is drawn: `character.fbx` (Y Bot) supplies the skeleton, and `character (1).fbx` (X Bot) is unused. A robot is described as a short list of parts in one file, so the other robot types in Stage 3 are new part lists on the same skeleton, not new downloads.
4. **The first robot type is called "the Drudge"** (an invented name) and has a hot orange-red visor. Other types will get other colors.
5. **Destroyed robots collapse for 0.4 s, then break apart.** No blood, nothing human.
6. **The rifle has no hands or arms.** No free, license-clean first-person arms were on hand; the gun is framed so the stock runs off-screen. Can be revisited.
7. **The rifle is named "KR-7 Carbine"** (an invented name; no real brands).
8. **The robot walks at a slow 1.05 m/s** in this stage, like a round-one enemy. Speeds scale with rounds in Stage 1.
9. **ARGUS's mark is a ring-shaped eye**, used on the facility's signage and the hijacked monitors. The facility is "Site 04, Manual Override Facility".
10. **Going down has no game-over screen yet**: the view fades and the test resets. The real screen comes in Stage 1.
11. **Rifle reserve ammunition is unlimited** in this stage, since there is nothing to buy yet.
12. **Music and ambience** are one looping dark-ambient track and a low factory hum. The round sting and the build-up through a round come with rounds in Stage 1.
13. **Textures ship as WebP and models as Meshopt-compressed GLB.** Total download is 15.7 MB of the 40 MB budget.
14. **MP3 for all audio**, because every browser decodes it.
15. **Fonts: Barlow Condensed and Share Tech Mono** (SIL Open Font License), self-hosted.
16. **The rifle is credited from your `links.txt`, and my first credit for it was wrong.** In the first pass I matched the gun zips to Sketchfab pages myself and credited the rifle to the wrong author. The page in your `links.txt` is "Sci-Fi Rifle" by Slayver (CC-BY 4.0), and its triangle and corner counts match the file exactly. The credit is corrected, and `npm run check:credits` now fails if the credits and `links.txt` ever disagree. Only the rifle ships so far; the other three guns are recorded against your links and will be credited when they are added.
17. **The fourth gun model's textures are not used.** The "arma sci-fi weapon" zip ships with what look like Quixel Megascans textures, which have their own license. When that gun is added it will be re-textured from CC0 sources.
18. **The rifle's sight is the game's own.** The downloaded rifle's folding sight is removed in the asset pipeline and a reflex sight built in code is clamped onto the block it stood on. This counts as a change to a CC-BY model, so the credit line says so.
19. **The reticle is always on the point of aim.** Like a real reflex sight, the mark is drawn where the bullets will go and the sight's window only decides how much of it can be seen; the gun shakes around the mark, not the mark with the gun.
20. **The rifle carries its own fill light**, worked out in its shader so it touches nothing else. It only tops up what the room's lamps leave dark, so the gun is never a black shape in a dark corner and never bleached under a lamp. Its paint is also lifted from near-black to dark gunmetal.
21. **Every light is on at every quality level.** Quality decides shadows, resolution, effects and particle counts, never how bright the room is. Low and Medium each gained a shadow-casting light so the moonlight can be on everywhere.
22. **Brightness is a gamma setting from 70% to 160%**, remembered between visits. It opens up the dark end without washing out the lamps.
23. **The upper walls are painted plaster** (Poly Haven "Painted Plaster Wall", CC0), with the weathering computed, not painted into the texture.
24. **Warning signs in red are painted on a pale panel.** Other signs stay as bare stencils.
25. **Reference screenshots are taken with the lamps held steady.** In the game one pendant and one strip light stutter; for pictures and brightness measurements they are held on, so runs can be compared.

## Checks run at the end of Stage 0 (after the feedback round)

| Check | Result |
| --- | --- |
| 1. Type-check and production build | Pass, zero errors |
| 2. Unit tests | 46 of 46 pass (weapon rules, robot behaviour, path-finding, collision, hit tests, robot posture). Tests for rounds, scrap, adaptation and mission steps come with those features. |
| 3. Headless browser | 24 of 24 pass against the production build served from a sub-folder address: loads with no console errors, title screen, all four quality levels render, play starts, **the room is equally bright at every quality level, shadows keep their detail, the brightness setting works**, robot advances, rifle destroys it, it breaks into scrap, **the muzzle flash is over within 4 frames, aiming brings up the sight and its reticle**, reload, the next robot arrives and hits, the player can go down, the test resets, health regenerates, pause freezes the world, resume works, touch devices get the notice. |
| 4. Screenshots | 14 re-taken in `media/look-target/`. |
| 5. Performance | See below. |
| 6. Credits | Pass: 141 shipped asset files all trace to credited sources; the credits match `links.txt`; no raw downloads tracked by git. |

### Performance (check 5)

Measured on the production build at 1920 x 1080 with the frame rate uncapped, on an NVIDIA RTX 4070 SUPER (a fast desktop card).

Heaviest moment this stage can produce (a firefight with several robots and fresh debris):

| Quality | Frames per second | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | 555 | 286 | 0.53 M | 3 | 110 | 33 |
| Medium | 411 | 518 | 0.75 M | 3 | 203 | 66 |
| High | 402 | 536 | 0.84 M | 5 | 161 | 66 |
| Ultra | 228 | 549 | 0.92 M | 5 | 184 | 55 |

Forward look, a full horde of about 22 robots in the room: Low 374, Medium 320, High 323, Ultra 206 frames per second, up to 756 draw calls and 1.7 M triangles.

Every level is faster than in the first pass (which measured 462 / 306 / 261 / 140), even though Low and Medium now run every light. I have not broken down why; the new robot body is about half the triangles of the old one.

Budgets held: at most 900 glowing and 320 smoke particles, 160 bullet decals, 48 casings, 72 scrap pieces, all pooled and recycled.

- **Total download: 15.7 MB** (models 7.8, textures 4.9, sound 1.7, code 1.2).
- **Time to the title screen**: 2.3 s from local files; 3.3 s at 100 Mbps, 4.5 s at 50 Mbps, 7.0 s at 25 Mbps (simulated).

### Brightness (new in this round)

Share of the picture that is near black (under 8 on a 0-255 scale), across the same eight views of the room. The "after" pictures were taken with the lamps held steady; the "before" ones as the game ran.

| | Before | After |
| --- | --- | --- |
| Low | 39-85% | 3-9% |
| Medium | 33-67% | 5-14% |
| High | 33-65% | 5-14% |
| Ultra | not measured | 5-14% |

Average brightness of the starting view, out of 255: Low 61.1, Medium 61.6, High 61.6, Ultra 61.8 (before: Low 42, Medium 50, High 29, where the gap between Medium and High was a lamp caught mid-flicker).

## Not verified

- **How it sounds.** I cannot hear. Sounds were chosen and levelled by measuring them, but the mix has never been listened to.
- **Real mouse feel.** Tests drive the game through debug controls, not a real mouse: mouse capture, sensitivity, recoil feel and how the new sight feels while tracking a moving robot are untested by hand.
- **How bright it looks on your screen.** The brightness numbers above are measured from saved pictures. How dark a dark room looks depends on the monitor and the light in the room you are sitting in; the Brightness slider is there for that.
- **The muzzle flash in real time.** It is checked frame by frame, where it lasts two frames. On a 144 Hz screen that is half as long as on a 60 Hz one; whether it reads well at speed needs your eyes.
- **Slower hardware.** Everything above was measured on a fast desktop card. A typical gaming laptop should be roughly a third of those numbers (still well above 60 at High); integrated graphics have not been measured at all. The automatic step-down exists for that case but has not been seen working on real slow hardware.
- **Browsers other than Chromium.** Firefox and Safari have not been tried.

## Known rough edges

- **The top of the rifle is plain when aiming.** The downloaded model has little detail on its top surface, so under a lamp the part nearest the eye reads as flat grey panels. It can be dressed with a rail and markings if it bothers you.
- **No hands on the rifle** (see decision 6).
- **The robot is angular on purpose.** It is built from chamfered blocks and tubes; it reads well in the doorway and mid-range, and looks faceted in a close-up.
- **The ceiling is the darkest part of the room.** The lamps point down, so the deck and beams sit just above black. It was left that way to keep the mood.
- **The title panel hides the left third of the room** behind the title.
- **Robots do not avoid each other yet.** Irrelevant with one robot; needed for hordes in Stage 1.
- **Hordes on slow hardware are unmeasured.** A full horde runs at 374 frames a second on Low on this machine, but each robot is still drawn again for every shadow-casting light. Before Stage 1 ships hordes on integrated graphics, distant robots may need a lighter model.
- **Changing quality causes a short hitch** while shaders rebuild and reflections are re-baked.
- **The start-up download is one batch.** Fine at 16 MB; as the map grows, the title scene should load first and the rest follow (Stage 5).

## How to run things

```
npm run dev            play it (opens the browser)
npm run build          type-check and production build
npm test               unit tests
npm run e2e            end-to-end check of the built game
npm run shots          re-take the look-target screenshots
npm run perf           performance report
npm run check:credits  licensing check
```

The headless browser used by the last four is installed inside `node_modules` (set `PLAYWRIGHT_BROWSERS_PATH=0` when running them by hand; the scripts set it themselves).
