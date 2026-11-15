# Progress

The full specification is in [SPEC.md](SPEC.md). This file records what has been built so far, the design decisions made along the way, and what is still rough. It is updated at the end of every stage.

## Where things stand

| Stage | What | Status |
| --- | --- | --- |
| 0 | The look test: one room, one robot, one rifle | **Approved** (after two rounds of feedback, recorded below) |
| 1 | Core loop: whole map, rounds, scrap, weapons, HUD, restart, debug mode | **Played; nine items of feedback, all done** (recorded below) |
| 2 | The mission: power, three keys, the Custodian, the uplink, the final stand, HUMANITY SAVED, endless rounds, the objective tracker | **Built. Waiting for you to play it.** |
| 3 | ARGUS: specials, tracking, counters, banner, end-of-run report | Not started |
| 4 | Full economy | Not started |
| 5 | Polish | Not started |

The approved look lives in `media/look-target/` and is never overwritten. Stage 2's pictures are in `media/stage-2/` (30 of them, including every Stage 1 view re-taken) and are re-made with `npm run build` then `npm run shots`. Stage 1's are kept in `media/stage-1/` as they were when you played it.

## Stage 1 feedback: what changed

You approved the HUD, the prompts and the game-over screen, and listed nine things to fix, in order.

| # | You asked for | What was wrong, and what was done | How it is checked now |
| --- | --- | --- | --- |
| 1 | The server hall was completely black once inside it | One pixel. The cones of haze under the lamps are drawn by a small program on the graphics card, and at the very rim of a cone that program divided nought by nought. The answer is "not a number", which a screen shows as nothing, so it had never been visible. But each room's reflections are made from a photograph of the room, and on Ultra (the only level whose photograph is large enough to catch that pixel) the one bad pixel spread through the whole photograph as it was blurred. Every surface in the hall was then lit by "not a number", which is black. My screenshot path teleported in with the lamps held steady; yours walked in. Fixed at the source (the haze, and three other effects with the same weakness), and the photograph is now cleaned of any such pixel before it is used, so one bad pixel can never black out a room again. | A new check plays the way you did: a new run, each door opened with F and **walked** through, both directions, at all four levels (now 36 crossings, with the core's door), measuring the picture in the room beyond. A second scans every reflection photograph for bad pixels. A third deliberately puts an object that draws nothing but bad pixels in the hall, re-makes the reflections, and requires the hall to stay lit. |
| 2 | Sprinting let you outrun everything | **Stamina**: a thin bar under the vitals. A full bar is 4 seconds of sprinting; it refills in 5, starting a second after you stop; run it dry and you can only walk until about a third is back. **Runners** now start in round 5 at 3.4 m/s and climb to 6.0 by round 13 (you walk at 4.3 and sprint at 6.4). **Robots are solid** (you can no longer run through one). Blows cannot land closer together than 0.45 s. Round sizes and toughness were re-tuned around all of that. | `npm run balance` plays whole runs as a "first-timer" (slow to react, shaky, aims at the body, backs away late): **median round 5; 16 of 16 runs (100%) ended in rounds 5 to 8; earliest 5, latest 7** (the target is rounds 5 to 8). Across the batches run while tuning, about one run in sixteen ended in round 4. 9 new unit tests for stamina; end-to-end checks for the drain, the winded state, solid robots, and the gap between blows. |
| 3 | An empty sidearm with nothing to spend scrap on | A **sidearm rack** on the lobby column to the right of the start (matching the shotgun's on the left): ammunition for 100 scrap, or the sidearm itself back for 100 if you traded it away. | End-to-end: an emptied sidearm is refilled there for 100. |
| 4 | Power room flat and murky; generator a dark blob; rods across the MAIN BREAKER sign | Re-lit to the lobby's pattern: emergency lamps hung low on drop rods so each throws its own pool with dark between (the breaker, the two aisles beside the generators, the floor between the west doors, the key cage). Two hang level with the generators' drums so the machines are lit across their flanks; each generator has a name plate, a pale guard, and a task lamp over its control panel. The MAIN BREAKER sign is now a lit box standing clear of the wall, with the feeder cables moved either side of it. | By eye, from each doorway a player first sees the room from (pictures 11, 12, 22, 23). |
| 5 | Robots almost invisible in the dark | An **edge light** on the robots' steel: wherever a robot's own surface comes out near black, its edges pick up a faint cold sheen and the body lifts a shade off pure black. It fades out where real light falls, so lit robots look as they did, and it widens with distance, where a thin outline would vanish. | A new check photographs the darkest places on the map empty and then with robots in them, backs turned, at two quality levels, and measures how much of each robot stands out from what was behind it: at least 29% of every one of 20 robots. With the edge light switched off, 16 of the 20 fail. |
| 6 | Shotgun muzzle flash cartoonish | A short ragged burst round a hot core in place of the long-spiked star, a little over half the size, drawn for one frame instead of three. | End-to-end: the flash is on for the firing frame and gone by the next. |
| 7 | A proper round announcement | See "The round announcement" under Stage 2 below. | 10 end-to-end checks; three pictures of it arriving, held and flying to the counter (18 to 20) and one of the cleared line (21). |
| 8 | A dark bar across the open server hall doorway | It was the steel rail that caps the hall's wall cladding. It ran the full length of each wall, straight across all four of the hall's openings (the bright streak was light catching it). It now stops at each door frame. The other rooms' rails already did. | A new check looks straight through every doorway and entrance on a fine grid and fails if anything is in the way. Proved by putting the old rail back for one run: it reported 216 blocked lines across four openings. |
| 9 | Robots seen appearing | Robots that walk in are now created in the gap **behind a shipping container** in each yard and come out round the end of it; the yard outside the main entrance has a container of its own for this. Robots that drop from vents are created **above the ceiling** and fall out. And before any robot is created, the game asks whether you could see it: a walk-in spot must have no line of sight to you at all; a vent is used only while you are not looking at it or at the space under it. If the entrance it wanted is being watched it uses another; if all of them are, the robot waits. | 7 unit tests of the rule. A check that from every half metre of indoor floor, with every door open, no line of sight reaches the walk-in spots. And a count, kept by separate code that shares nothing with the rule, of any robot inside the picture on screen at the moment it was created: zero of 72 with the player stood staring at each entrance in turn (12 positions, including inside the yards), zero of 441 over eight whole runs of ordinary play by the autopilot, zero through the whole mission. A vent is also left alone while you are standing under it. |

### Found on the way, and fixed

These were not on your list. Each was found while fixing something that was.

| What was wrong | How it showed | The fix | How it is checked now |
| --- | --- | --- | --- |
| **Rooms borrowed their neighbours' walls** | A room is only drawn while it can be seen. Where two rooms share a wall, one of them was using the back of the other's, so with a door shut the night sky showed through that stretch (the power room's west side with the hall not drawn). Door frames had the same fault: from the far room a shut door had no frame, and one popped into place as it opened. | Each room has a facing of its own on shared walls; the door frames belong to the doors, which are always drawn; the seam between the double doors' leaves is sealed. | A check looks from inside each room toward every other through that room's own walls only: 12 pairs, 2,420 lines of sight each, none may get out. |
| **Places a player could stand that no robot could reach** | Gaps between server rack rows too narrow for a robot but wide enough for a player made safe pockets. | Rack rows re-spaced; the path-finding now knows which floor is actually joined to a robot entrance. | A check floods the map as a player and as a robot and compares. |
| **The loading dock was cut off from the rest of the map, as far as robots were concerned** | A storage cart parked a pace inside the dock left no gap a robot could pass on the map of the floor they steer by. A robot sent in through the dock while you were anywhere but in line with the opening walked straight at you, into a wall, and stood there until the seven-second rule took it away and sent it round again. It had been so since Stage 1. The check "a robot from the dock reaches the player" passed all along, because with the player standing in the hall, walking straight at them happens to go through the opening. Found when the Custodian came in that way and never arrived. | The cart is parked elsewhere. | A new check floods the robots' own map from the middle of each room and requires all eight ways in to be reached from all four. |
| **A vent half hidden behind a column counted as "not being looked at"** | Found by the count described under item 9, in the last full run before this write-up: a robot dropped from the lobby vent while part of the space under it could be seen past a pillar. The rule tested only the middle of that space. It happened to about one robot in two hundred. | The rule now tests the whole space a robot falls through, from ceiling to floor and as wide as the robot. | The eight-run sample: with the old rule put back, 3 of 554 robots appeared in view, all at vents; with the new one, none of 558. That sample is now part of the end-to-end test, because a single played-through run would catch the old rule only about one time in eight. |
| **A flash shorter than one frame was never drawn** | Found when the shotgun's flash was shortened: its clock ran from the shot, so it was put out again before the picture was made. | A flash is always drawn on the frame it fires; its clock starts with the next. | End-to-end. |
| **The autopilot held R instead of pressing it** | It could stand in a crowd with an empty gun: reloading acts on the press, not on the key being down. | It taps. It also now shops mid-round and never trades a better gun for a worse one. | The balance runs. |
| **An elite robot removed by the debug "skip round" key left the mission waiting for it for ever** | Found by my own test script while building Stage 2. | The mission notices when a robot it still needs has left the map by any route, and sends it in again. | The scripted mission skips rounds with the Custodian due. |

## Stage 2: what is built

**The mission** (`src/sim/mission.ts` for the rules, `src/game/Mission.ts` to connect them to the map, `src/world/MissionSet.ts` for the moving parts)

1. **Restore power** at the main breaker in the power room. Until then the key cage is locked ("The lock needs power"), the uplink is dead and the Custodian does not come. Throwing it moves the lever, turns the breaker's lamp from red to green, brings up a little cool light over the machines, and slides the cage's gate aside.
2. **Three override keys**, in any order:
   - **The cage.** The key sits on a stand in the gateway. Nobody goes into the cage; you take it through the gate.
   - **The uplink**, in the server hall. Press F to start it, then stay inside the ring on the floor (6.5 m) for 60 seconds. The clock only runs while you are in the ring and keeps what you have earned if you leave. A row of lights on the console fills as it goes. ARGUS sends up to 8 extra robots at it, on top of the round's.
   - **The Custodian.** Arrives with round 8, or with the next round if the power came on later. Taller than the others, pale enamel, amber lights, the key glowing in a cradle on its back. Six times an ordinary robot's health in that round, 3.0 m/s, 34 damage a blow. Destroying it pays 500 scrap and drops the key where it fell, turning in a shaft of light.
3. **The core.** With three keys, F on the core door unseals it. F on the kill-switch console starts it **arming: 75 seconds**. The rounds stand aside; ARGUS sends a robot every 1.5 seconds (up to 16 on the map) and, 10 seconds in, **the Proxy**: half as big again as anything else, black with red seams, twelve times an ordinary robot's health, 3.6 m/s, 45 damage a blow, 1,500 scrap if you destroy it. A bar at the top of the screen shows what is left of it. You do not have to destroy it, and you do not have to stay in the core: you have to be alive when the ring of lights round the dais is full.
4. **Pull the switch.** Every robot on the map goes limp and falls where it stands, ARGUS's eye gutters out and the core's red light goes with it. Two and a half seconds later the **HUMANITY SAVED** card: mission time, round, robots destroyed, weak-point kills, accuracy, scrap. **KEEP FIGHTING** clears the wrecks and the rounds carry on from the next one for as long as you last; **END RUN** goes to the title.

**The objective tracker**: a box under the round number with the next step, a second line of detail (a countdown, "POWER ROOM", "OVERRIDE KEYS 2 / 3"), three lozenges for the keys, and a marker in the world with the distance. The marker slides to the edge of the screen when its target is out of view and fades when you are standing at it.

**Mission notices**: one line across the top of the view when something happens (POWER RESTORED, OVERRIDE KEY RECOVERED 2 OF 3, A CUSTODIAN HAS ENTERED THE FACILITY, ARGUS HAS SENT ITS PROXY...), in the mission's own colour, queued so they never overlap a round announcement.

**The round announcement** (`src/ui/RoundAnnouncer.ts`; feedback item 7)
- A round begins: a red scan line crosses the whole view and the round number snaps in behind it, in the title's lettering with the numeral in red, sheared and split into red and blue for a tenth of a second as it lands. Under it a rule draws out from the middle and "8 ROBOTS INBOUND" types itself. It holds for 1.5 seconds, then the numeral flies to the round counter in the corner, which takes the new number and pulses.
- A round is cleared: "ROUND 4 CLEARED", with the scrap that round paid counting up under it.
- Both start on the same instruction as their sound. The two round stings were rebuilt to open on a sharp burst (machine noise over a low thump, from sound packs already in the game) with the swell cut in so it peaks during the hold.
- Lettering only, above the crosshair, covering about 6% of the view; the game never pauses for it.
- With "reduce screen shake and flashing" on: no scan line, no interference, no glitch; the lettering fades in.
- It is my own design: nothing in it is taken from another game's round display.

**Records**: the fastest mission time is remembered beside the best round and shown on the title screen. Going down after the switch has been pulled shows "HUMANITY SAVED · ARGUS IS OFFLINE" on the game-over card, not "ARGUS WINS".

**Debug mode** gained **6**: move the mission on to its next step (power on; three keys in hand; the final stand; armed; pulled). The other keys are unchanged: **7** god mode, **8** free scrap, **9** skip round, **0** autopilot.

**Sound**: 6 new sounds for the mission (the breaker, a key, a notice, the alarm, the switch, the ending) and the two rebuilt stings, all cut from packs already credited. 85 in all.

## Design decisions made in Stage 2

Numbering continues from Stage 1's list further down. The first group came out of your feedback.

45. **Stamina numbers**: 4 seconds of sprint, a 1 second pause, 5 seconds to refill, and a "winded" state until 30% is back. Chosen so that one sprint crosses the lobby, and two in a row are not possible.
46. **Robots are solid to the player.** Running through a crowd was the other half of "sprint lets me outrun everything".
47. **A 0.45 second gap between blows.** Without it, the re-tuned crowd of runners killed in a single instant.
48. **Round numbers, re-tuned**: 6, 8, 10, 13, 16, 20, 24, 28, 32, 36, then 4 more a round; health 70 in round 1 and +22 a round; a 10 second lull; runners from round 5. (The step was +25 until the loading dock was fixed. With robots really arriving that way the first-timer model began going down about half a round earlier, and +22 eases that a little. Its median comes out at round 5 or round 6 from one batch of sixteen runs to the next. Delaying the runners by a round was tried first and made no measurable difference.) All in `src/config.ts` under `ROUNDS`. (Supersedes the numbers in Stage 1's description below, which is left as it was written.)
49. **The first-timer is a model, and says so.** It reacts in 0.45 s, misses, aims at the body, backs away late, and buys the first thing it can. It tells me whether the numbers are in the right place. It cannot tell me whether the game is fun at those numbers.
50. **Sidearm ammunition costs 100** at a rack in the lobby. Cheap enough never to be a dead end. (Supersedes decision 36.)
51. **The edge light is a property of the robots' steel, not a lamp**, so it costs nothing extra to draw, cannot light anything else, and cannot be seen on a robot that is already lit.
52. **Robots appear behind shipping containers.** The yard outside the main entrance gained one. This also answers the Stage 1 rough edge "robots walk out of the fog".
53. **If you watch every entrance at once, robots wait.** The map is built so that this cannot be done (the test tries), but the rule has a last resort all the same: after 5 seconds a robot comes in behind you. It has never fired in a test; the debug tools count it.
54. **The announcement is placed frame by frame from one clock**, not played as a canned animation. That is what lets it be frozen for a screenshot or a check, and what lets the reduced-flashing setting remove parts of it cleanly.

The mission:

55. **Keys in any order.** Only the cage needs the power; but nothing at all happens before the power, so the breaker is always first.
56. **The mission's colour is a cold blue-green** (keys, tracker, marker, notices, the uplink's lights, the dais), so it never reads as scrap (amber) or as ARGUS (red).
57. **The uplink's clock stops when you leave the ring and keeps what you have earned.** Losing progress for dodging a robot would punish the right instinct.
58. **The Custodian comes with round 8.** Late enough that the other two keys are usually in hand, so a focused player reaches the final stand around round 9 or 10. If you restore power later than round 8 it comes with the very next round. If it gets wedged somewhere or is removed by a debug key, it is sent in again.
59. **The Custodian and the Proxy are the Drudge's skeleton and body**, re-scaled, re-plated and re-lit, as the spec asks ("so I don't need more character downloads"). Each is one short file. Automatic fire slows an ordinary robot; it barely slows the Custodian and does not slow the Proxy at all. A point-blank shotgun blast or a melee strike still staggers the Custodian; nothing staggers the Proxy.
60. **The names "Custodian" and "Proxy"** are mine (the spec names the first; the second is "ARGUS's boss unit"). It is called the Proxy because it is the one body ARGUS keeps for itself.
61. **The final stand is survived, not won by a kill.** The spec says "survive the final stand while it arms". The Proxy can be destroyed (the test does it) and pays well, but the switch arms on the clock either way. You may leave the core; the robots follow.
62. **The rounds stand aside during the final stand** and the round that was in progress is counted as over when the switch is pulled. Otherwise the horde would be whatever happened to be left of round 9.
63. **Robots power down; they do not explode.** They go limp and fall, and their lights die. "Every robot on the map powers down" is the spec's phrase, and the room full of fallen machines behind the HUMANITY SAVED card is the picture the mission ends on.
64. **Why robots keep coming afterwards**: "The switch is pulled and every machine it ran has stopped. The ones still outside have not heard." One line on the card. The rounds resume with the next one after the usual lull.
65. **Nobody enters the key cage.** It stays walled off for players and robots alike (so it cannot become a place to hide), and the key is presented on a stand in the gateway.
66. **Power does not light the building up.** It turns a lamp green and adds a little cool light in the power room. The facility stays dark; Boost Stations and the bench, which need power, arrive in Stage 4.
67. **The fastest mission time** is measured from pressing Play to pulling the switch, and stored with the best round (same browser storage, same key).
68. **Screenshots go to `media/stage-2/`.**

## Checks run at the end of Stage 2

| Check | Result |
| --- | --- |
| 1. Type-check and production build | Pass, zero errors |
| 2. Unit tests | **126 of 126 pass** in 12 files. New since Stage 1: the mission's steps (15 tests: every order the keys can be found in, every step tried too early, the clocks), stamina, the entry rule, and the path-finding's "can a robot actually get here". Adaptation rules come with Stage 3. |
| 3. Headless browser | **125 of 125 pass** against the production build served from a sub-folder address. What is new is listed below. |
| 4. Screenshots | 30 in `media/stage-2/`, compared by eye with `media/look-target/`. |
| 5. Performance | See below. |
| 6. Credits | Pass: 167 shipped asset files all trace to credited sources; the credits match `links.txt`; no file tracked by git is a raw download. |

**The spec's scripted mission run** (check 3) is in the end-to-end test, as 22 checks. With god mode on and scrap for the asking, but every step taken as a player takes it (standing where they would stand, pressing F):
- before power: the cage refuses, the uplink refuses, the core refuses;
- the breaker restores power; the cage gives up its key, once;
- the uplink: 20.0 s on the clock after 20 s in the ring, nothing gained in 10 s away (and the tracker says GET BACK TO THE UPLINK), no key at 59 s, the key at 60; up to 8 extra robots sent at it;
- with two keys the tracker explains that a Custodian carries the third; it arrives with its round; shot until destroyed; its key drops; picked up;
- three keys unseal the core; the switch refuses to be pulled early; the rounds stand aside; the Proxy arrives 10.0 s in and shows on the HUD; the Proxy is shot until destroyed; the switch arms at 75.0 s;
- pulling it puts out every robot on the map (16 in the last run), which stay where they fell; the HUMANITY SAVED card shows the run; the mission time is remembered;
- **then three more rounds are played through** by the autopilot, with the wrecks cleared away;
- going down after that shows humanity saved on the card; a new run starts the mission afresh.

Also new in the end-to-end test: the ten checks of the round announcement (including the reduced-flashing version); the real F key pulling the switch and real clicks on KEEP FIGHTING and END RUN, with the mouse let go and taken back; the checks listed against each feedback item above.

### Performance (check 5)

Measured on the production build on an NVIDIA GeForce RTX 4070 SUPER (a fast desktop card).

**The heaviest moment the game can produce**: the most robots ever allowed on the map (24), closing on the player in the server hall with every door open so three areas are in view, the carbine firing without pause. 1920 x 1080, frame rate uncapped. (The final stand is lighter than this: the same limit of 24 robots, in one room.)

| Quality | Frames per second | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | 258 | 536 | 1.31 M | 23 | 89 | 11 |
| Medium | 186 | 686 | 1.53 M | 24 | 105 | 11 |
| High | 198 | 685 | 1.53 M | 24 | 133 | 11 |
| Ultra | 175 | 708 | 1.62 M | 23 | 153 | 11 |

**Smoothness**: the same scene with the frame rate limited to the screen's, as a player sees it (this screen refreshes 240 times a second, so a perfect frame is 4.2 ms). An average can hide stutter; this looks at the slowest frames instead.

| | Quality | Usual frame | Slowest 1% | Worst frame | Frames over 25 ms in 5 s |
| --- | --- | --- | --- | --- | --- |
| 1920 x 1080 | Low | 4.2 ms | 5.2 ms | 6.0 ms | 0 |
|  | Medium | 5.1 ms | 6.8 ms | 14.2 ms | 0 |
|  | High | 5.2 ms | 7.1 ms | 10.7 ms | 0 |
|  | Ultra | 5.5 ms | 9.1 ms | 11.2 ms | 0 |
| 3840 x 2160 | Low | 5.1 ms | 6.4 ms | 10.0 ms | 0 |
|  | Medium | 11.2 ms | 12.6 ms | 12.8 ms | 0 |
|  | High | 11.9 ms | 13.4 ms | 42.1 ms | 1 |
|  | Ultra | 19.1 ms | 21.6 ms | 22.0 ms | 0 |

The 4K rows are there because 4K loads this card about as heavily as 1080p loads a much slower one. One frame in the 4K High row took 42 ms. A single slow frame like it turned up at 4K in two of the three runs of this report made today (in a different row each time) and in none at 1080p; the Stage 1 version's one run today had none. I have not found what causes it.

**These numbers are lower than Stage 1's report** (which gave 318 / 231 / 226 / 193 frames a second), so I checked whether that was the game or the machine. The Stage 1 version was rebuilt as it was and measured again today on the same machine:

| | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| Stage 1's report, measured then | 318 | 231 | 226 | 193 |
| The Stage 1 version, measured today | 266 | 196 | 204 | 162 |
| This version, measured today | 258 | 186 | 198 | 175 |

Most of the difference is the machine on the day. What is left is small (between a tenth and a third of a millisecond a frame on Low, Medium and High, and nothing on Ultra) and is the heaviest moment itself: robots are now solid, so two dozen of them stand in a wall in front of you where before they walked into you and were half cut away by the edge of the view. A still room costs the same as it did: at 3840 x 2160 on Ultra, 18.5 ms a frame now against 18.3 ms in the Stage 1 version, and the HUD (which gained the objective tracker, its marker and the announcement) costs nothing measurable. Two things were tightened on the way: the HUD's markers now move without making the browser lay the page out again, and the announcement is taken out of the picture entirely while nothing is being announced.

Budgets held: at most 24 robots on the map, the mission's own included; 22 lights live at once (4 of them casting shadows on Ultra, 3 on High and Medium, 2 on Low); at most 900 glowing and 320 smoke particles, 160 bullet decals, 48 casings, 72 scrap pieces, all pooled and recycled. Lower quality levels cut shadows, effects and resolution, never the number of robots.

- **Total download: 17.0 MB** of the 40 MB budget (models 8.7, textures 4.9, sound 2.0, code 1.3).
- **Time to the title screen**: 3.5 s from local files; 3.8 s at 100 Mbps, 4.9 s at 50 Mbps, 7.7 s at 25 Mbps (simulated).

## Not verified

- **Why today's frame rates are lower than Stage 1's report.** See the performance section: measured like for like on the same day there is little difference, and what difference there is comes from the heaviest moment itself having changed. I have not found out why the machine as a whole was faster on the day Stage 1 was measured, nor what causes the occasional single slow frame at 4K.
- **How it sounds.** I cannot hear. The 6 new sounds and the two rebuilt stings were built and levelled by measuring them. In particular, "the number lands on the sting's opening burst" is true of the timing (both start on the same instruction, and the burst is in the first twentieth of a second of the file) and unheard.
- **How the announcement feels in motion.** Its stages were looked at as frozen pictures, and its timings measured. I have not watched it move.
- **Mission pacing for a real player.** The spec asks for 15 to 20 minutes, around round 10 to 12, for a focused player. The scripted run proves every step works and takes under three minutes with god mode; it says nothing about how long a person takes. The Custodian's round (8) and the 75 seconds are my best estimate. If the final stand comes too early or too late for you, those are two numbers in `src/config.ts` under `MISSION`.
- **Whether the final stand is the right difficulty.** Nothing has fought it without god mode. The autopilot does not know how to do the mission.
- **Balance for a real first-time player.** The first-timer model usually goes down in rounds 5 to 7; about one run in sixteen ends in round 4. A model is not a person.
- **Slower hardware, browsers other than Chromium, and how bright it is on your screen**: as at the end of Stage 1.

## Known rough edges

- **The final stand can be survived by running laps** of the lobby, hall and power room loop until the clock runs out, then walking back to the switch. It is allowed by the rules as written (decision 61). If you want the stand held in the core, that is a small change.
- **The Proxy is slower than you walk**, so on open floor it is a threat to your space more than to your health. Its job is to push you off the dais into the runners.
- **You can open an empty-handed prompt at the kill switch while it is arming** ("Kill switch: arming"); pressing F plays the refusal sound. Deliberate, but it is one more beep in a loud minute.
- **The autopilot cannot do the mission.** It still plays rounds. A pilot that restores power and collects keys by itself would let the balance tool measure mission time; it is the obvious next test tool.
- **Nothing to spend scrap on once you own two guns and three doors** (Stage 4), **every ordinary robot is the same Drudge** (Stage 3), and **the music does not build through a round** (later): unchanged from Stage 1.
- **The sidearm and shotgun have no hands on them**, and their reloads are a simple dip: unchanged.
- **Auto never raises quality again by itself**, and **changing level pauses the picture for about a second**: unchanged.

## Stage 1: what is built

*As written at the end of Stage 1, and left as it was. Where a number here differs from the feedback table or from decisions 45 to 68 above (round sizes, robot health and speed, the lull, the sidearm rack, the debug keys), the ones above are current.*

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

## Found and fixed during the Stage 1 end-of-stage checks

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
npm run shots          re-take this stage's screenshots (media/stage-2)
npm run balance        whole runs played by a model of a first-time player
npm run perf           performance and smoothness report
npm run check:credits  licensing check
```

The last five need `npm run build` first. The headless browser they use is installed inside `node_modules` (the scripts point at it themselves).
