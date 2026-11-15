# Progress

The full specification is in [SPEC.md](SPEC.md). This file records what has been built so far, the design decisions made along the way, and what is still rough. It is updated at the end of every stage.

## Where things stand

| Stage | What | Status |
| --- | --- | --- |
| 0 | The look test: one room, one robot, one rifle | **Approved** (after two rounds of feedback, recorded below) |
| 1 | Core loop: whole map, rounds, scrap, weapons, HUD, restart, debug mode | **Built. Waiting for you to play it.** |
| 2 | The mission | **Built and committed, but the end-of-stage write-up is not finished** (the session ran out of usage on 2026-11-15). All nine Stage 1 feedback items are done and the mission plays start to finish. Still to do: rebuild and re-run `npm run e2e` (the last run had 1 failure of 123, "no robot created in view" at the lobby vent; the fix is in `src/game/Director.ts` but has not been re-tested), re-take screenshots, then write this file and the README from the drafts in `.cache/progress-top.md`, `.cache/readme-new.md` with `node .cache/assemble-docs.cjs`. Until then the sections below still describe Stage 1. |
| 3 | ARGUS: specials, tracking, counters, banner, end-of-run report | Not started |
| 4 | Full economy | Not started |
| 5 | Polish | Not started |

The approved look lives in `media/look-target/` and is never overwritten. Stage 1's pictures are in `media/stage-1/` and are re-taken with `npm run build` then `npm run shots`.

## Stage 1: what is built

**The map** (`src/world/`): four areas joined by doors.

```
        yard (robots arrive)
              |
      [ SECURITY LOBBY ] ---- power door (1000) ---- [ POWER ROOM ] -- breach -- transformer yard
              |                                            |
       blast door (750)                           service door (1250)
              |                                            |
        [ SERVER HALL ] -----------------------------------+
         |          |
   loading dock   core door (sealed until the mission, Stage 2)
                    |
                 [ CORE ]
```

- **Security lobby**: the room from Stage 0, now with a weapon rack on a column and a ceiling vent.
- **Server hall** (20 x 18 m): nine rows of server racks with blinking status lights either side of a central aisle, a loading dock robots come in through, an uplink desk, the sealed core door.
- **Power room** (13 x 18 m): two generators, the main breaker and a locked key cage (both waiting for the mission), and a breach in the east wall onto a transformer yard. The power is out, so it is lit only by emergency lamps.
- **Core** (12 x 12 m): ARGUS's eye and the kill switch on a dais. Built and lit, but sealed: it opens in Stage 2.
- Doors slide open when bought and stay open. The three doors form a loop (lobby, hall, power room, back to the lobby), so there is always a way to keep moving.
- The yard outside the main entrance is fenced with road barriers. You can step out into it; you cannot leave it.

**The loop** (`src/sim/rounds.ts`, `src/game/Director.ts`)
- Round 1 starts 3.2 seconds after Play. Each round sends a fixed number of robots (6, 8, 11, 14, 18, 22, ... then 4 more each round), at most 24 on the map at once. When the last one is destroyed there is a 7 second lull, then the next round.
- Robots get tougher (70 health in round 1, +35 a round, then +10% a round from round 10) and faster (walking 1.25 m/s rising to 2.2; from round 4 a growing share run, at 2.9 rising to 4.0).
- Eight ways in: the main breach, the loading dock, the east breach, and five ceiling vents robots drop out of. Robots only use entrances that connect to where you are, and favour the area you are in, so the fight follows you around the map.
- When three or fewer robots are left in a round, markers on the HUD point to them.

**Scrap** (`src/sim/economy.ts`): 10 for a hit, 60 for a kill, 100 for a kill through the head, 130 for a melee kill. Spent on wall weapons, their ammunition, and doors.

**Weapons** (`src/entities/weapon/`, `src/sim/weapon.ts`, `src/sim/loadout.ts`)

| Weapon | Where | Price | Ammunition | Notes |
| --- | --- | --- | --- | --- |
| VK-9 Sidearm | You start with it | - | - | 12 rounds, 28 damage, one shot per click |
| DB-12 Breacher (shotgun) | Rack on column C1 in the lobby, visible from the start | 750 | 375 | 6 shells of 9 pellets; devastating up close, weak beyond 18 m |
| KR-7 Carbine | Rack in the server hall | 1500 | 600 | 30 rounds, automatic, the Stage 0 rifle with its reflex sight |
| Melee strike | V key | - | - | 150 damage within 2.1 m, every 0.62 s |

You carry two weapons. Buying a third replaces the one in your hands. 1, 2 or the mouse wheel switch.

**Going down and starting again**: health comes back after 4 seconds without being hit. At zero the run ends: a game-over card shows the round reached, robots destroyed, accuracy, scrap earned and time survived, and the best round is remembered on this computer. Play Again starts a clean run.

**Interface** (`src/ui/`): the HUD gained the round number, scrap (with the amounts earned and spent popping up beside it), both weapon slots, purchase prompts with their price ("F  Buy the DB-12 Breacher  750"), round banners and the last-robot markers. The title screen has a Play button and the controls; the pause menu gained Restart Run and Title Screen.

**Debug mode** (add `?debug=1` to the address): an overlay with the round, robots and lights in use, and four keys: **7** god mode, **8** 2000 free scrap, **9** skip to the next round, **0** autopilot (the game plays itself: moves, aims, shoots, reloads, buys weapons and doors). Jump-to-mission-step arrives with the mission in Stage 2.

**Under the hood**
- Only the rooms that can be seen from where you stand are drawn and lit.
- A fixed pool of 22 lights (8 spot lights, 14 point lights) is shared by the whole facility and handed from lamp to lamp, with a short fade, as you move.
- Each room has its own baked reflections.
- 79 sounds (18 new: the two new guns, switching, melee, robots landing, buying, a refused purchase, doors, round cleared, game over).

## Design decisions made in Stage 1

Numbering continues from Stage 0's list further down.

26. **The map is a loop with one dead end.** Lobby, hall and power room connect in a ring so a player being chased always has somewhere to run; the core is the dead end the mission will end in.
27. **Door prices rise with distance from the start**: 750 (blast door), 1000 (power door), 1250 (service door). The first door costs the same as the first weapon, so the first real choice of a run is "gun or room".
28. **The core is built now but sealed.** Its door shows "Core: sealed" and cannot be bought. Building it now means the mission in Stage 2 is rules and props, not a new room.
29. **Robots only come in where they can reach you.** In rounds 1 and 2 with no doors bought, that is the main breach alone, which teaches the game: they come from the bright doorway. The lobby's ceiling vent joins in from round 3.
30. **Robots hurry across the yards and slow down indoors**, so a round does not stall while the last robot strolls in from the dark.
31. **A robot that makes no progress toward you for 7 seconds is pulled out and sent in again**, without paying scrap, so a round can never be stuck on a robot wedged behind furniture.
32. **Weapon names and prices**: VK-9 Sidearm, DB-12 Breacher (750), KR-7 Carbine (1500). All invented; no real brands. Ammunition costs half the weapon's price at the same rack, less for the carbine.
33. **The shotgun pays for one hit per shell**, however many pellets land, so it does not print scrap.
34. **The sidearm and shotgun use their own iron sights.** Only the carbine has the reflex sight.
35. **Melee is a quick jab with whatever is in hand** (no knife model): 150 damage, a one-hit kill for the first three rounds, and the best-paid kill in the game because it is the riskiest.
36. **The sidearm's ammunition cannot be bought** in this stage (it starts with 12 + 72). Ammunition pickups arrive with the full economy in Stage 4; until then the answer to an empty sidearm is the shotgun rack or the V key.
37. **Your fourth gun model is held back** for the prototype crate in Stage 4. It is still credited as not shipped.
38. **Scrap starts at zero.** Rounds 1 and 2 (14 robots) pay about 1,200 to 1,800 depending on how you fight, so the shotgun (750) is affordable by the end of round 2, as the spec asks.
39. **Round numbers** (how many, how tough, how fast) are in decision form in `src/config.ts` under `ROUNDS`. They are a first guess to be tuned in Stage 5.
40. **The best round is stored in the browser** (local storage, key `human-override.best.v1`). Nothing leaves the computer.
41. **The yard is fenced in.** Without a fence the player could walk off into the dark. Road barriers plus an invisible wall behind them keep the play area honest.
42. **The pale panels behind the two red warning signs stay**, as you asked.
43. **"Auto" quality starts afresh when pressed.** It returns to the level guessed for the graphics chip and steps down from there if it must. (Before, it kept whatever level was in use.)
44. **Screenshots go to `media/stage-1/`**; the script refuses to write into `media/look-target/`.

## Found and fixed during the end-of-stage checks

These came out of measuring and of driving the game with real key presses and clicks, not from the feature list. Three of them had been there since Stage 0.

| What was wrong | How it showed | The fix | How it is checked now |
| --- | --- | --- | --- |
| **Sprinting did not make you faster** (since Stage 0) | Shift widened the view and lowered the gun, but the speed was about 4.2 m/s walking or sprinting. Friction grows with speed and the push forward did not, so they balanced at the same speed whatever was asked for. | The push is sized to the speed being aimed for. Walking is 4.3 m/s and sprinting 6.4, as the settings always said. | 8 unit tests of the movement rule; an end-to-end check measures both speeds; another holds the real Shift key |
| **A change of graphics quality left freezes for later** | After the level changed (which the game does by itself on slow computers), the next robot to appear, the next kill and the next gun bought each froze the picture for 0.4 to 0.8 seconds while a shader was rebuilt. | Every shader is rebuilt at the moment of the change, all together, including those for things out of sight. A hidden spare robot keeps the robots' shaders ready between rounds. | An end-to-end check changes level three times and counts shaders built late: must be zero |
| **The monitors stalled the game whenever the graphics card was busy** (since Stage 0) | Sending the monitors' picture to the graphics card nine times a second made it stop and catch up each time. Invisible on a fast card at 1080p; a 50 ms stall nine times a second at 4K, which is also what a slower card would see. | All monitors share one picture, painted in a tenth of the time, sent in a form that does not stall and converted on the graphics card. They look the same (compared side by side). | The performance report now has a smoothness section, at 1080p and 4K |
| **The rack lights were repainted eight times a second** | Two large pictures redrawn and re-sent constantly; on Ultra this alone caused 14 to 26 stalls of 25 ms or more every five seconds. | The lights are three pictures made once. The blinking is worked out on the graphics card. | Same smoothness section |
| **"Auto" quality did nothing after trying another level** (since Stage 0) | Pick Low, then Auto: the game stayed on Low until the page was reloaded. | See decision 43. | An end-to-end check clicks the real buttons |
| Restart while playing did nothing | Restart Run from the pause menu resumed the same run. | Fixed. | End-to-end: three restarts in a row |
| The scrap counter kept the last run's number after a restart | | Fixed. | Same check |
| Signs in the new rooms were blurry | The shared sheet of signs was too small for four rooms. | Enlarged. | By eye |

What the smoothness fixes bought, measured on the same scene (the full horde in the server hall):

| | Before | After |
| --- | --- | --- |
| Frames per second, Low / Medium / High / Ultra | 231 / 161 / 193 / 112 | 318 / 231 / 226 / 193 |
| Slowest 1% of frames at 1080p, High | 11 ms | 6 ms |
| Stalls over 25 ms in 5 seconds at 1080p, Ultra | 26 | 0 |
| Slowest 1% of frames at 4K, High | 51 ms | 13 ms |
| Freeze when the next robot appears after a change of level | 481 ms | none |

## Checks run at the end of Stage 1

| Check | Result |
| --- | --- |
| 1. Type-check and production build | Pass, zero errors |
| 2. Unit tests | **85 of 85 pass** in 9 files: weapon rules, robot behaviour, path-finding, collision, robot posture, and new in this stage: rounds, scrap and purchases, the two-weapon loadout, which areas connect and where robots may enter, and player movement. Tests for adaptation and mission steps come with those features. |
| 3. Headless browser | **72 of 72 pass** against the production build served from a sub-folder address. Listed below. |
| 4. Screenshots | 17 in `media/stage-1/`. |
| 5. Performance | See below. |
| 6. Credits | Pass: 161 shipped asset files all trace to credited sources; the credits match `links.txt`; no file tracked by git is a raw download. The sidearm and shotgun are now credited as shipped, with what was changed. |

**What the 72 headless checks cover**
- Loads with no console errors; all four quality levels render; equally bright at every level; shadows keep their detail; the brightness setting works.
- A new run starts clean; round 1 starts within five seconds; robots advance.
- Scrap: a hit pays 10, a kill 60, a head kill 100, a melee kill 130; a shotgun shell pays one hit.
- Every kind of purchase, each charging the right amount: a wall weapon, its ammunition, a full weapon refused, a third weapon replacing the one in hand, each of the three doors, a door from its far side, a purchase refused for lack of scrap, the sealed core refused.
- The carbine fires automatically, its flash lasts an instant, its sight comes up, reload works, 1 and 2 switch.
- Walking and sprinting reach their set speeds; the player can enter the yard and cannot leave it.
- Changing quality level leaves no shader to be built late.
- **A robot from each of the eight entrances reaches the player in each of the four areas.**
- Without god mode the player goes down and the game-over card shows the round.
- **Three restarts in a row leave no leftover robots, timers or doubled-up input**; the best round is remembered.
- The autopilot plays three whole rounds, earning and spending scrap.
- The last robots of a round are marked; pause freezes the world; resume returns to the same run.
- **With real clicks and real mouse capture**: Play, a real click firing one round, Esc pausing, the quality buttons, Resume, going down, Play Again, Title Screen.
- **Every key on the controls list, really pressed**: W A S D, Shift, Space, R, V, F, 1, 2, the wheel, right click, M, and the mouse turning the view.
- **With the browser slowed sixteen times to imitate a weak computer**, Auto lowers the quality by itself and shows its notice.
- Touch devices get the "use a computer" screen.

The spec's scripted mission run (restore power, three keys, final stand, HUMANITY SAVED, three endless rounds) belongs to Stage 2 and is not in the script yet.

### Performance (check 5)

Measured on the production build on an NVIDIA RTX 4070 SUPER (a fast desktop card).

**The heaviest moment the game can produce**: the most robots ever allowed on the map (24), closing on the player in the server hall with every door open so three areas are in view, the carbine firing without pause. 1920 x 1080, frame rate uncapped.

| Quality | Frames per second | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | 318 | 523 | 1.30 M | 23 | 94 | 11 |
| Medium | 231 | 667 | 1.51 M | 24 | 95 | 11 |
| High | 226 | 667 | 1.51 M | 23 | 218 | 11 |
| Ultra | 193 | 714 | 1.63 M | 23 | 140 | 22 |

**Smoothness**: the same scene with the frame rate limited to the screen's, as a player sees it (this screen refreshes 240 times a second, so a perfect frame is 4.2 ms). An average can hide stutter; this looks at the slowest frames instead.

| | Quality | Usual frame | Slowest 1% | Worst frame | Frames over 25 ms in 5 s |
| --- | --- | --- | --- | --- | --- |
| 1920 x 1080 | Low | 4.1 ms | 5.0 ms | 5.9 ms | 0 |
| | Medium | 4.3 ms | 5.8 ms | 12.4 ms | 0 |
| | High | 4.3 ms | 5.6 ms | 7.2 ms | 0 |
| | Ultra | 4.4 ms | 7.5 ms | 19.3 ms | 0 |
| 3840 x 2160 | Low | 4.4 ms | 6.6 ms | 8.4 ms | 0 |
| | Medium | 10.2 ms | 11.8 ms | 12.6 ms | 0 |
| | High | 10.6 ms | 12.7 ms | 13.0 ms | 0 |
| | Ultra | 16.9 ms | 19.9 ms | 19.9 ms | 0 |

The 4K rows are there because 4K loads this card about as heavily as 1080p loads a much slower one: High at 4K runs at about 95 frames a second here, evenly.

Budgets held: at most 24 robots on the map; 22 lights live at once (4 of them casting shadows on Ultra, 3 on High and Medium, 2 on Low); at most 900 glowing and 320 smoke particles, 160 bullet decals, 48 casings, 72 scrap pieces, all pooled and recycled. Lower quality levels cut shadows, effects and resolution, never the number of robots.

- **Total download: 16.8 MB** of the 40 MB budget (models 8.7, textures 4.9, sound 1.9, code 1.3).
- **Time to the title screen**: 2.9 s from local files; 3.5 s at 100 Mbps, 4.8 s at 50 Mbps, 7.4 s at 25 Mbps (simulated).

## Not verified

- **How it sounds.** I cannot hear. All 79 sounds were chosen and levelled by measuring them; none has been listened to, including the 18 new ones.
- **How it feels in the hand.** The real keys and the real mouse are now pressed by the test (so every control is known to work), but nothing can tell me whether the recoil, the sprint, the weapon swap or the melee jab *feel* right. Sprinting in particular is 50% faster than anything you have played so far.
- **Balance.** The spec wants a first-time player to go down between rounds 5 and 8. The autopilot is not a first-time player, and with sprinting now working you can outrun everything, so the game is probably easier than that target. Round numbers are a first guess (decision 39).
- **Slower hardware, for real.** The step-down has now been seen working with the browser slowed artificially, and the 4K numbers stand in for a slower card, but no real laptop or integrated graphics chip has run this. The spec's target (smooth 60 at High on a laptop with a dedicated card) looks comfortable from these numbers and is not proven.
- **Browsers other than Chromium.** Firefox and Safari have not been tried. The stall fixed in the monitors was specific to how Chromium on Windows handles one texture format; other browsers may have their own.
- **How bright it looks on your screen.** Measured from saved pictures; the Brightness slider is there for the rest.
- **The scripted mission run** in the spec's check 3: Stage 2.

## Known rough edges

- **The power room and the core are darker than the lobby.** The power room is meant to be (its power is out until the mission restores it), but neither room has had the lobby's round of lighting feedback.
- **Every robot is the same Drudge.** The other types arrive in Stage 3.
- **Robots walk out of the fog in the yards** rather than arriving from somewhere you can see. A truck, a hatch or a fence gap would sell it better.
- **No way to buy sidearm ammunition** (decision 36).
- **Nothing to spend scrap on once you own two guns and three doors.** Shutters, repairs, the crate, the bench and pickups are Stage 4.
- **The music does not build through a round yet.** There is a sting at the start and a cue when a round is cleared.
- **Auto never raises quality again by itself.** After a slow spell it stays on the lower level; pressing Auto in the pause menu makes it pick again.
- **Changing quality level pauses the picture for about a second** while every shader is rebuilt. That is one pause at the change, in place of several later.
- **The autopilot is crude.** It backs away from what is close, shoots what is nearest, and buys the first thing it can afford. It is a test tool, not an opponent or a demo.
- **The sidearm and shotgun have no hands on them**, like the rifle (Stage 0 decision 6), and their reloads are a simple dip.
- **The top of the rifle is plain when aiming**, and **the robot is angular on purpose** (both from Stage 0).
- **The start-up download is one batch.** Fine at 17 MB; splitting it is a Stage 5 job.

## Stage 0 feedback, round 2: the sight

You approved the look, asked to keep the pale panels on the two red warning signs, asked for the other guns to be credited when added (done: see check 6), and asked for one fix to the rifle's sight. The sight is now a smaller optic in dark worn gunmetal on an open mount, the two knobs on the side of the rifle that crowded the view are gone, and the rifle shades itself when raised so the sight does not glow against a dark room. The reticle is unchanged. The reference pictures in `media/look-target/` were re-taken with it.

## Stage 0 feedback, round 1: what changed

The mood, lighting direction, signage, menus and HUD were approved; the look as a whole was not. Six things were asked for, in this order.

| # | Asked for | What was done | How it was checked |
| --- | --- | --- | --- |
| 1 | The robot must stop reading as the stock mannequin | The mannequin's body is gone. The game now ships only its skeleton and movements, and builds an original body on them in code: "the Drudge", a hunched machine with a visor slit and sensor cluster, armor plates, exposed pistons, bellows and cables, three-claw hands, longer forearms and wider shoulders, in dark gunmetal with rust and grime. Your second character (X Bot) was checked first: it is the same mannequin family, so it was not a better base. | Judged at three distances in the room (doorway silhouette, mid-range, close up) |
| 2 | Aiming: light the weapon, less of the view, a proper sight picture | The rifle's own tiny folding sight is removed and a raised reflex sight is mounted in its place. The sight has a glowing ring-and-dot reticle that stays on the point of aim. The rifle carries its own soft fill light and its near-black paint is lifted to gunmetal. | An automated check that the reticle comes up when aiming |
| 3 | Upper wall texture looked tiled and cheap | Replaced with a calm painted plaster. Stains, water runs and soot are worked out from each point's position in the room, so they never repeat. The long walls are divided into bays by a concrete ring beam and shallow piers. | By eye |
| 4 | Too dark; Low much darker than High; brightness slider | Every light is on at every quality level (quality only decides how many cast shadows). Fill light raised, two soft "bounce" lights added, and the film-style tone curve no longer clips the darkest tones to black. New Brightness slider in the pause menu. | Two automated checks: equally bright at every level, shadows keep their detail |
| 5a | Sign wear made "OVERRIDE" read "OVERRICE" | Wear is sized against each sign's thinnest stroke: a chip can bite a letter but never cut it through. The two red warning signs are painted on a pale panel. | Every sign read back from the full sheet of signs |
| 5b | Hard edges where lamp cones cross the shutter | The ambient-occlusion pass treated every see-through effect as glass and switched itself off behind it. Effects that only add light are now marked so the pass ignores them. | By eye |
| 5c | Muzzle flash was a soft round glow | A spiky star with two crossed tongues of flame, drawn for two frames, different every shot. | An automated check that the flash is gone within 4 frames |
| 5d | Destroyed parts looked like chrome blobs and stood upright | Parts use the robot's own material and tip over to lie flat. | By eye |
| 5e | Boxes by the server hall door looked tilted into each other | The tool chest stands against the wall; the ammunition cans sit squarely on the crate. | By eye |
| 5f | Wall graphic showed through the title | A dark, softly blurred panel sits behind the title. | By eye |
| 6 | Credits must match your four gun links | Done, and it exposed a mistake of mine: see decision 16. | `npm run check:credits` fails if the credits and `links.txt` disagree |

## Stage 0: what is built

**The security lobby** (`src/world/lobby/`)
- 18 x 14 m room, 4.8 m ceiling: two-tone walls (painted plaster above a painted concrete band) divided into bays by a concrete ring beam and piers, four columns with hazard sleeves, steel girders and joists, corrugated ceiling deck.
- Openings: the breached main entrance with a jammed roller shutter, an entry corridor and foggy yard beyond it; two shuttered west windows (one torn open); the blast door to the server hall; the power room door.
- Services: a ventilation duct run, three pipe runs with hangers and valve stations, a cable tray, four pendant lamps, caged strip lights.
- Furnishing: security desk with a wall of six monitors showing ARGUS feeds, the defenders' barricade and tripod flood light, ammunition crates, shelving, drums, a hand truck, security cameras.
- Stencilled signage and floor markings drawn in code, leak stains, hazard paint.

**Rendering** (`src/render/`)
- Physically based materials from downloaded texture sets, with world-scaled texturing, damp patches on the floor and weathering on the walls that never repeats.
- Lights described as data, all switched on at every quality level; the quality preset only decides how many cast shadows.
- Reflections and bounce light baked from the rooms themselves at load.
- Fog, light-shaft cones, haze cards, dust specks that light up in beams.
- Post-processing: ambient occlusion, bloom, chromatic aberration, a single-pass filmic grade (tone mapping, cold/warm split toning, selective desaturation, shadow lift, vignette, grain, the player's brightness setting), SMAA anti-aliasing.
- Four quality presets, automatic selection, automatic step-down, and a resolution fallback below the lowest preset.

**The robot** (`src/entities/robot/`, `src/sim/robotMind.ts`, `src/sim/navGrid.ts`)
- "The Drudge": an original body of about 7,400 triangles, built in code from chamfered plates, tubes, bellows and cables on a 22-bone skeleton with recorded movements.
- Flow-field path-finding on a 30 cm grid; walks in, turns, attacks, flinches, staggers, takes head/torso/limb damage.
- On destruction: brief collapse, then 11 rigid chunks thrown with simple physics that settle flat, sparks, smoke, a floor scorch.

**The rifle** (`src/entities/weapon/`, `src/sim/weapon.ts`)
- Hitscan with a spread cone that grows with movement and sustained fire, 30-round magazine, 650 rounds a minute.
- View model with its own lens and its own fill light, sway, bob, recoil spring, a raised reflex sight with a reticle that stays on the point of aim, a procedural reload, a two-frame muzzle flash and light, tracers, ejected casings.
- Bullet decals (concrete craters, steel dents), sparks, dust and chips per surface type.

**Sound** (`src/audio/`, `tools/assets/audio-spec.mjs`): sounds cut, layered and levelled from CC0 / CC-BY recordings. 3D positioning, a generated room reverb, a limiter, looping ambience and music bed.

**Interface** (`src/ui/`): loading screen with progress, start screen over the live scene, HUD, pause menu with settings (quality, sensitivity, brightness, volume, FPS counter, reduced shake and flashing; all remembered), credits screen, and a "use a computer" screen for touch devices.

**Tooling** (`tools/`): one manifest of every third-party asset; scripts that download, convert and compress them; `CREDITS.md` and the in-game credits generated from the same manifest; `npm run e2e`, `shots`, `perf`, `check:credits`.

## Design decisions made in Stage 0

1. **Lighting concept: warm room, cold enemy.** The room's own lamps are warm; everything hostile is cold or red. Robots arrive back-lit from the yard so they read as silhouettes with a glowing visor first.
2. **The rooms are built in code from a kit, not modelled in a 3D editor.** Structure is simple solids with real texture sets; all detail objects are downloaded models. This keeps the map editable as text and let Stage 1's rooms reuse the kit.
3. **The robot's body is original and built in code; only its skeleton and movements come from Mixamo.** No mannequin model ships with the game. Neither of your two characters is drawn: `character.fbx` (Y Bot) supplies the skeleton, and `character (1).fbx` (X Bot) is unused. A robot is described as a short list of parts in one file, so the other robot types in Stage 3 are new part lists on the same skeleton, not new downloads.
4. **The first robot type is called "the Drudge"** (an invented name) and has a hot orange-red visor. Other types will get other colors.
5. **Destroyed robots collapse for 0.4 s, then break apart.** No blood, nothing human.
6. **The weapons have no hands or arms.** No free, license-clean first-person arms were on hand; each gun is framed so its grip runs off-screen. Can be revisited.
7. **The rifle is named "KR-7 Carbine"** (an invented name; no real brands).
8. *(Superseded in Stage 1: robot speeds now come from the round. See `ROUNDS`.)*
9. **ARGUS's mark is a ring-shaped eye**, used on the facility's signage and the hijacked monitors. The facility is "Site 04, Manual Override Facility".
10. *(Superseded in Stage 1: there is now a game-over card.)*
11. *(Superseded in Stage 1: ammunition is limited and bought at the racks.)*
12. **Music and ambience** are one looping dark-ambient track and a low factory hum. Stage 1 added a sting at the start of a round and a cue when it is cleared; the build-up through a round is still to come.
13. **Textures ship as WebP and models as Meshopt-compressed GLB.**
14. **MP3 for all audio**, because every browser decodes it.
15. **Fonts: Barlow Condensed and Share Tech Mono** (SIL Open Font License), self-hosted.
16. **The guns are credited from your `links.txt`, and my first credit for the rifle was wrong.** In the first pass I matched the gun zips to Sketchfab pages myself and credited the rifle to the wrong author. The page in your `links.txt` is "Sci-Fi Rifle" by Slayver (CC-BY 4.0), and its triangle and corner counts match the file exactly. `npm run check:credits` fails if the credits and `links.txt` ever disagree.
17. **The fourth gun model's textures are not used.** The "arma sci-fi weapon" zip ships with what look like Quixel Megascans textures, which have their own license. When that gun is added it will be re-textured from CC0 sources.
18. **The rifle's sight is the game's own.** The downloaded rifle's folding sight is removed in the asset pipeline and a reflex sight built in code is clamped onto the block it stood on. This counts as a change to a CC-BY model, so the credit line says so.
19. **The reticle is always on the point of aim.** Like a real reflex sight, the mark is drawn where the bullets will go and the sight's window only decides how much of it can be seen.
20. **Each gun carries its own fill light**, worked out in its shader so it touches nothing else. It only tops up what the room's lamps leave dark.
21. **Every light is on at every quality level.** Quality decides shadows, resolution, effects and particle counts, never how bright the room is.
22. **Brightness is a gamma setting from 70% to 160%**, remembered between visits.
23. **The upper walls are painted plaster** (Poly Haven "Painted Plaster Wall", CC0), with the weathering computed, not painted into the texture.
24. **Warning signs in red are painted on a pale panel.** Other signs stay as bare stencils.
25. **Reference screenshots are taken with the lamps held steady.** In the game some lamps stutter; for pictures and brightness measurements they are held on, so runs can be compared.

## How to run things

```
npm run dev            play it (opens the browser)
npm run build          type-check and production build
npm test               unit tests
npm run e2e            end-to-end check of the built game
npm run shots          re-take this stage's screenshots (media/stage-1)
npm run perf           performance and smoothness report
npm run check:credits  licensing check
```

The last four need `npm run build` first. The headless browser they use is installed inside `node_modules` (the scripts point at it themselves).
