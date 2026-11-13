# Progress

The full specification is in [SPEC.md](SPEC.md). This file records what has been built so far, the design decisions made along the way, and what is still rough. It is updated at the end of every stage.

## Where things stand

| Stage | What | Status |
| --- | --- | --- |
| 0 | The look test: one room, one robot, one rifle | **Built. Waiting for approval of the look.** |
| 1 | Core loop: whole map, rounds, scrap, weapons, HUD, restart, debug mode | Not started |
| 2 | The mission | Not started |
| 3 | ARGUS: specials, tracking, counters, banner, end-of-run report | Not started |
| 4 | Full economy | Not started |
| 5 | Polish | Not started |

The approved look lives in `media/look-target/`. Later stages are judged against those pictures. They are re-taken with `npm run build` then `npm run shots`.

## Stage 0: what is built

**The security lobby** (`src/world/lobby/`)
- 18 x 14 m room, 4.8 m ceiling: two-tone concrete walls, four columns with hazard sleeves, steel girders and joists, corrugated ceiling deck.
- Openings: the breached main entrance with a jammed roller shutter, an entry corridor and foggy yard beyond it; two shuttered west windows (one torn open); the blast door to the server hall; the power room door.
- Services: a ventilation duct run, three pipe runs with hangers and valve stations, a cable tray, four pendant lamps, caged strip lights.
- Furnishing: security desk with a wall of six monitors showing ARGUS feeds, the defenders' barricade and tripod flood light, ammunition crates, shelving, drums, a hand truck, security cameras.
- Stencilled signage and floor markings drawn in code, leak stains, hazard paint.

**Rendering** (`src/render/`)
- Physically based materials from downloaded texture sets, with world-scaled texturing and damp patches on the floor.
- 16 lights described as data; the quality preset decides which cast shadows and which are skipped.
- Reflections and bounce light baked from the room itself at load.
- Fog, light-shaft cones, haze cards, dust specks that light up in beams.
- Post-processing: ambient occlusion, bloom, chromatic aberration, a single-pass filmic grade (tone mapping, cold/warm split toning, selective desaturation, vignette, grain), SMAA anti-aliasing.
- Four quality presets, automatic selection, automatic step-down, and a resolution fallback below the lowest preset.

**The robot** (`src/entities/robot/`, `src/sim/robotMind.ts`, `src/sim/navGrid.ts`)
- Mixamo "Y Bot", reduced from 55,000 to 14,000 triangles, re-skinned in chipped painted metal with dark joints and glowing eyes.
- Flow-field path-finding on a 30 cm grid; walks in, turns, attacks, flinches, staggers, takes head/torso/limb damage.
- On destruction: brief collapse, then 11 pre-cut rigid chunks thrown with simple physics, sparks, smoke, a floor scorch.

**The rifle** (`src/entities/weapon/`, `src/sim/weapon.ts`)
- Hitscan with a spread cone that grows with movement and sustained fire, 30-round magazine, 650 rounds a minute.
- View model with its own lens, sway, bob, recoil spring, aim-down-sights, a procedural reload, muzzle flash and light, tracers, ejected casings.
- Bullet decals (concrete craters, steel dents), sparks, dust and chips per surface type.

**Sound** (`src/audio/`, `tools/assets/audio-spec.mjs`)
- 61 sounds cut, layered and levelled from CC0 / CC-BY recordings. 3D positioning, a generated room reverb, a limiter, looping ambience and music bed.

**Interface** (`src/ui/`)
- Loading screen with progress, start screen over the live scene, HUD (crosshair that follows the real spread, hit markers, damage direction, health, ammo, FPS), pause menu with settings (quality, sensitivity, volume, FPS counter, reduced shake and flashing; all remembered), credits screen, and a "use a computer" screen for touch devices.

**Tooling** (`tools/`)
- Asset pipeline: one manifest of every third-party asset; scripts that download, convert and compress them; `CREDITS.md` and the in-game credits generated from the same manifest.
- `npm run e2e`, `shots`, `perf`, `check:credits`, plus 42 unit tests.

## Design decisions made in Stage 0

1. **Lighting concept: warm room, cold enemy.** The room's own lamps are warm; everything hostile is cold or red. Robots arrive back-lit from the yard so they read as silhouettes with glowing eyes first.
2. **The room is built in code from a kit, not modelled in a 3D editor.** Structure is simple solids with real texture sets; all detail objects are downloaded models. This keeps the map editable as text and lets later rooms reuse the kit.
3. **Robot: the Y Bot from your two characters.** `character.fbx` (Y Bot) is used; `character (1).fbx` (X Bot) is unused for now and could become a variant.
4. **Robot eyes are hot orange-red.** Other robot types will get other eye colors.
5. **Destroyed robots collapse for 0.4 s, then break apart.** No blood, nothing human.
6. **The rifle has no hands or arms.** No free, license-clean first-person arms were on hand; the gun is framed so the stock runs off-screen. Can be revisited.
7. **The rifle is named "KR-7 Carbine"** (an invented name; no real brands).
8. **The robot walks at a slow 1.05 m/s** in this stage, like a round-one enemy. Speeds scale with rounds in Stage 1.
9. **ARGUS's mark is a ring-shaped eye**, used on the facility's signage and the hijacked monitors. The facility is "Site 04, Manual Override Facility".
10. **Going down has no game-over screen yet**: the view fades and the test resets. The real screen comes in Stage 1.
11. **Rifle reserve ammunition is unlimited** in this stage, since there is nothing to buy yet.
12. **Music and ambience** are one looping dark-ambient track and a low factory hum. The round sting and the build-up through a round come with rounds in Stage 1.
13. **Textures ship as WebP and models as Meshopt-compressed GLB.** Total download is 17 MB of the 40 MB budget.
14. **MP3 for all audio**, because every browser decodes it.
15. **Fonts: Barlow Condensed and Share Tech Mono** (SIL Open Font License), self-hosted.
16. **Your `links.txt` was empty**, so the four gun pages were found by matching the zips against Sketchfab's public listing and written into that file. All four are CC-BY 4.0.
17. **The fourth gun model's textures are not used.** The "arma sci-fi weapon" zip ships with what look like Quixel Megascans textures, which have their own license. When that gun is added it will be re-textured from CC0 sources.

## Checks run at the end of Stage 0

| Check | Result |
| --- | --- |
| 1. Type-check and production build | Pass, zero errors |
| 2. Unit tests | 42 of 42 pass (weapon rules, robot behaviour, path-finding, collision, hit tests). Tests for rounds, scrap, adaptation and mission steps come with those features. |
| 3. Headless browser | 19 of 19 pass against the production build served from a sub-folder address: loads with no console errors, title screen, all four quality levels render, play starts, robot advances, rifle destroys it, it breaks into scrap, reload, the next robot arrives and hits, the player can go down, the test resets, health regenerates, pause freezes the world, resume works, touch devices get the notice. |
| 4. Screenshots | 14 saved in `media/look-target/`. These are the look target itself. |
| 5. Performance | See below. |
| 6. Credits | Pass: 144 shipped asset files all trace to credited sources; no raw downloads tracked by git. |

### Performance (check 5)

Measured on the production build at 1920 x 1080 with the frame rate uncapped, on an NVIDIA RTX 4070 SUPER (a fast desktop card).

Heaviest moment this stage can produce (a firefight with several robots and fresh debris):

| Quality | Frames per second | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | 462 | 225 | 0.48 M | 4 | 108 | 22 |
| Medium | 306 | 401 | 0.73 M | 4 | 155 | 44 |
| High | 261 | 516 | 1.04 M | 4 | 231 | 55 |
| Ultra | 140 | 597 | 1.23 M | 5 | 141 | 55 |

Forward look, a full horde of about 22 robots in the room: Low 303, Medium 218, High 201, Ultra 133 frames per second, up to 950 draw calls and 2.7 M triangles.

Budgets held: at most 900 glowing and 320 smoke particles, 160 bullet decals, 48 casings, 72 scrap pieces, all pooled and recycled.

- **Total download: 17.1 MB** (models 8.1, textures 6.1, sound 1.7, code 1.2).
- **Time to the title screen**: 3 s from local files; 4.0 s at 100 Mbps, 5.3 s at 50 Mbps, 8.1 s at 25 Mbps (simulated).

## Not verified

- **How it sounds.** I cannot hear. Sounds were chosen and levelled by measuring them, but the mix has never been listened to.
- **Real mouse feel.** Tests drive the game through debug controls, not a real mouse: mouse capture, sensitivity and recoil feel are untested by hand.
- **Slower hardware.** Everything above was measured on a fast desktop card. A typical gaming laptop should be roughly a third of those numbers (still well above 60 at High); integrated graphics have not been measured at all. The automatic step-down exists for that case but has not been seen working on real slow hardware.
- **Browsers other than Chromium.** Firefox and Safari have not been tried.

## Known rough edges

- **Aiming down the sights**: the rear half of the rifle is drawn as a dark silhouette while aiming, to stop it filling the view. It works but is the least polished part of the gun.
- **No hands on the rifle** (see decision 6).
- **The robot is recognisably the Mixamo mannequin** up close. Plating and variants come with the robot types in Stage 3; it could be brought forward.
- **The upper wall texture is busy** (pitted concrete that repeats every 3 m). Easy to swap or calm down.
- **Robots do not avoid each other yet.** Irrelevant with one robot; needed for hordes in Stage 1.
- **A full horde is heavy on Low.** Each robot is 14,000 triangles drawn again for every shadow-casting light. Before Stage 1 ships hordes on integrated graphics, distant robots need a lighter model and fewer shadow passes.
- **Changing quality causes a short hitch** while shaders rebuild and reflections are re-baked.
- **The start-up download is one batch.** Fine at 17 MB; as the map grows, the title scene should load first and the rest follow (Stage 5).

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
