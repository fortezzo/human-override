Build a polished first-person shooter that runs in the browser: a round-based survival game where one human holds out against endless rounds of AI-controlled robots while completing a mission to save humanity. Working title: HUMAN OVERRIDE. Tagline: "Don't let the AI win."

The gameplay loop is modeled on round-based zombies modes like Call of Duty Zombies, with robots in place of zombies, and the look should land in the same territory: dark, gritty and realistic-ish. Borrow the loop and the mood only. Don't use any names, perk names, jingles, logos, map layouts, characters or screen styling from Call of Duty or any other game, film or company. Everything here gets its own name, and the README should call it "inspired by classic round-based survival modes" without implying a connection to any existing game.

PROJECT FOLDER
[the folder's path on my computer, removed before publishing] (the folder you are in). Everything you create stays inside it.

WHY THIS EXISTS
I'm not a programmer. This is a portfolio piece I will publish on GitHub and post on LinkedIn. The people judging it are recruiters and engineers who will watch a 20-second clip or play for about a minute, and a few will open the repo. So looks come first: it has to look high quality and feel good in the first 60 seconds. After that it needs one idea people remember, and code and a README that hold up when someone skims them. Don't stop to ask me design questions in the middle of a stage; make the call yourself and list your calls in the end-of-stage summary.

HOW WE'LL BUILD IT
This message is the full spec, but don't build it all at once. First, save this entire message word for word as SPEC.md in the project folder, so any later session can pick up from it. Then build Stage 0 only and stop. After every stage I'll play it, tell you anything I want changed, and say "next stage" when I'm ready. Fix my feedback before starting the next stage.
- Stage 0, the look test: one finished room (the security lobby) at final quality. Real materials, lighting, reflections, fog and post-processing; one animated robot that walks at me, attacks, reacts to hits and dies; one rifle with firing, recoil, aim-down-sights and reload; sound; quality settings and an FPS counter. Save screenshots of it in media/look-target (if you can't take them yourself, tell me how to). Nothing else gets built until I approve this look, and every later stage is judged against those screenshots.
- Stage 1, the core loop: the whole map with its doors, the pistol, shotgun and wall weapons, melee, rounds, scrap, health, game over and restart, the HUD and purchase prompts, a simple title and pause screen, and debug mode.
- Stage 2, the mission: power, the three override keys, the Custodian, the uplink defense, the final stand and boss, the HUMANITY SAVED ending, endless rounds afterward, and the objective tracker.
- Stage 3, ARGUS: the special robots, play tracking, the counters, the analysis banner and remarks, and the end-of-run report.
- Stage 4, the full economy: shutters and repair, Boost Stations, the Prototype Crate and its special weapon, the Overclock Bench, timed pickups, swarm rounds, grenades, the settings and how-to-play screens, and the phone message.
- Stage 5, polish only: no new features. Game feel, menus and HUD, performance, loading time, balance, bug fixes, the docs, final screenshots, and a link preview image and page title for when the link is shared.
  - ADDED IN THE STAGE 4 FEEDBACK (my list for Stage 5, on top of the above): re-skin the Turncoat as a Site 04 lab prototype (dark worn metal, exposed wiring, a cold blue glow that matches its beam, a muzzle effect that fits the beam) and test it in a full horde; teach the basics in the first minute with short on-screen hints that disappear once done (move, fire, aim, jump, buy with F, follow the marker), with a five-line quick start at the top of How to Play; hide the frame-rate counter by default and keep the setting; make the fail-safe (going down and getting back up) a clear, dramatic moment; merge the station pieces and win back the frame rate they cost; fix the blocky truck in the loading dock and the blank west wall of the server hall; and everything a public link needs (page title, link preview image, favicon, no debug text or test leftovers anywhere a visitor can see). Apart from the jumping fix: no new features, and nothing made harder.
Anything in the spec that isn't named in a stage goes wherever it fits best.
At the end of every stage: run every check below that applies to what exists so far, commit, update a PROGRESS.md file (what's built, the design calls you made, known rough edges), and tell me in plain English exactly what to type to play it and which window to type it in, three to five specific things to try, and what you couldn't verify. Then wait for me.
If a stage turns out too big to finish well, finish the most important part properly and tell me what's left. Don't rush all of it.

THE LOOK
Realistic-ish, in the spirit of the early round-based zombies maps: a dark industrial facility at night, built from real-world surfaces (concrete, steel plate, rust, painted metal, cable and pipe runs), with hard shadows, pools of light, emergency lighting, fog, dust in the air and film grain. Use physically based materials with proper texture maps, an environment map for reflections, a few shadow-casting lights, ambient occlusion, restrained bloom, filmic tone mapping and a cold, desaturated color grade with warm accents. Bullet holes, scorch marks, sparks and smoke should mark the room as the fight goes on. Keep it dark enough to hide what's cheap and bright enough to read the fight.
The robots are humanoid machines with worn metal bodies and glowing eyes that read clearly in the dark. Destroyed robots break apart in sparks and scrap. No blood and no human enemies, because this has to be fine to show on LinkedIn.
It must run well on ordinary hardware: smooth 60 fps at high quality on a laptop with a dedicated graphics card, and a playable low setting for integrated graphics, chosen automatically at start and stepped down if the frame rate sags. Lower the visual cost, never the number of robots, so the game plays the same at every setting. Show a loading screen with progress, reach the title screen within about ten seconds on a normal connection, and keep the total download under about 40 MB by compressing models and textures.

ASSETS AND LICENSES
Use real assets, not code-only shapes. This goes in a public repo, so licenses matter.
- My downloads are in assets-source: robot (a humanoid character and animations from Adobe Mixamo, as FBX) and guns (models from Sketchfab, with their page links in links.txt). If anything is missing when you start, build with stand-ins and give me an exact list of what to download and where to put it.
- Mixamo files may be used in the game, but their raw files must not be redistributed. Keep assets-source out of git, and ship those files only as converted, compressed game assets.
- Re-skin the robot in worn metal and add the glowing eyes. Build the other robot types from that same model with different scale, plating, color accents and eye color, so I don't need more character downloads.
- Download the rest yourself from CC0 sources: surface textures, environment maps and props from Poly Haven and ambientCG, and recorded sound effects from CC0 libraries such as Kenney or OpenGameArt. Use an open-license font for the interface. If a site blocks you, give me the exact link to download by hand.
- Only CC0 or CC-BY assets (plus the Mixamo files). Nothing marked NonCommercial or NoDerivatives, no real-world gun brands, and nothing ripped from a game.
- Keep a CREDITS.md listing every third-party asset with its source link, author and license, and show the credits in the game's menu.

THE CORE LOOP
- Endless numbered rounds. Each round sends more robots, and they get tougher and faster as the rounds climb, with a short lull between rounds. Keep about 24 robots active at most and queue the rest.
- Robots break in from outside through shutters and vents around the map. I can repair a broken shutter for a little scrap.
- Scrap is the currency. I earn it for every hit and every kill, with bonuses for weak-point and melee kills.
- I start in one room with a pistol and a melee strike. Scrap buys: weapons mounted on walls (and ammo refills for them), doors that open new areas, a Prototype Crate that hands out a random weapon, four Boost Stations that each sell one permanent boost (more health, faster reload, faster fire rate, one self-revive), and an Overclock Bench that upgrades the weapon in my hands. Boost Stations and the bench only work after power is restored.
- The crate can also give one special weapon found nowhere else. Make it fit the robot theme, for example a beam that briefly turns a robot to my side.
- I carry two weapons; buying a third replaces the one I'm holding. Health regenerates after a few seconds without taking damage.
- Destroyed robots sometimes drop timed pickups: Full Resupply, Overload (one-hit kills), EMP Blast (destroys every robot on the map), Double Scrap, and Lockdown (repairs every shutter).
- The horde is mostly melee robots that walk in early rounds and run in later ones, with specials mixed in as rounds climb: fragile flying drones, a bomber, and a slow heavy with a glowing weak point. Every fifth round is a swarm round of fast drones that ends with a Full Resupply. Robots must never get stuck on walls, doors or each other.

THE MISSION: SAVE HUMANITY
A rogue AI called ARGUS has taken over the world's networks, and this facility holds the only manual kill switch. The mission runs alongside the rounds, with an always-visible objective tracker and a marker pointing to the next step:
1. Restore power at the breaker.
2. Recover three override keys: one in a locked cage in the power room, one carried by an elite Custodian robot that shows up mid-game, and one earned by defending an uplink in the server hall for 60 seconds.
3. Take the keys to the kill-switch console in the core and survive the final stand while it arms: ARGUS's boss unit plus a heavy horde.
4. Pull the switch. Every robot on the map powers down and a HUMANITY SAVED screen shows my stats. Then let me end the run or keep fighting endless rounds for a high score.
If I go down without a self-revive, ARGUS wins and the game-over screen shows the round I reached.

Pacing: round 1 starts within about five seconds of pressing Play. The first wall weapon is visible from the starting spot and affordable by the end of round 2. A first-time player should usually go down around round 9 (between rounds 7 and 10). A focused player can finish the mission in 15 to 20 minutes, around round 10 to 12.
- CHANGED AFTER THE STAGE 3 FEEDBACK (my decision, after the first full playthrough): the first-time player's target used to read "between rounds 5 and 8". After my playthrough, easier is the right direction, and a first-timer lasting to about round 9 in the ordinary rounds is fine. Don't make the game harder again without asking me.
- Also from the Stage 3 feedback: the mission's length follows how I play, and a fast mission ending before round 10 is fine, so the mission is no longer held to "15 to 20 minutes, around round 10 to 12".
- CHANGED IN THE STAGE 4 FEEDBACK (my decision): in round 1 only, the entrance shutter starts already damaged, so that the first robot is indoors about 8 seconds in. Every later round is left alone. The final stand stays as easy as the boosts made it: I'd rather people reach the ending than lose nine minutes in at the last step.

THE TWIST: THE AI STUDIES YOU
ARGUS watches how I play, changes its tactics, and tells me what it noticed. During each round, track things like which weapon does most of my damage, how long I hold one spot, whether I run the horde in circles, and how many weak-point hits I land. In the lull before the next round, choose one or two counters and show a short "ARGUS ANALYSIS" banner that doesn't pause the game, for example: "Observed: 72% of damage from the rifle. Adapting: rifle-resistant plating." Start adapting at round 3. Counters to include:
- I lean on one weapon: some robots get visible shielding that halves that weapon's damage
- I hold one spot: bombers flush me out and robots breach from behind me
- I run the horde in circles: interceptors cut across my loop
- I land lots of weak-point hits: robots guard their weak points with armor that can be shot off
Every adaptation must be visible and beatable by changing how I play, never a hidden stat boost. ARGUS also makes short on-screen remarks about what I'm doing. This is rule-based game AI, not machine learning, and the README must say so plainly.

MAP, CONTROLS AND SCREENS
- One facility with four connected areas: a starting security lobby, a server hall, a power room, and the core that holds the kill switch, sealed until I have the keys. Four well-finished areas beat six plain ones.
  - CHANGED IN THE STAGE 3 FEEDBACK (my decision, after the first full playthrough): the facility now has SIX connected areas. Four was not enough room once the horde was large; there was nowhere to run it. Two full areas were added, built to the approved look, each with its own mood: a LOADING DOCK (a large open bay with shipping containers and a truck bay, the biggest open space on the map) and a ROBOTICS LAB (where ARGUS builds and repairs its machines: racks of parts, half-built units and assembly arms). Each has a door to buy, a wall weapon, hidden robot entry points and room for the Stage 4 stations (the Overclock Bench suits the lab). Together they add two loops to the map and leave no dead ends.
  - Also changed then: the caged override key (mission step 2) moved from the power room to the robotics lab, and the Custodian arrives at the start of the round after I hold the other two keys, never before round 8.
  - CHANGED AGAIN BEFORE STAGE 4 (my decision): never before round 6, not 8. I'd rather more people reach the ending than keep the mission long.
- Controls: WASD to move, mouse to look, left click to shoot, right click to aim down sights, R to reload, F to interact (buy, open, repair, pick up), V for melee, G for a grenade, Shift to sprint, Space to jump, 1 and 2 or the scroll wheel to switch weapons, Esc to pause, M to mute. Show a prompt with the price whenever I'm near something I can buy.
  - ADDED IN THE STAGE 4 FEEDBACK (my decision; the one new feature allowed in Stage 5): Space jumps over low objects. The concrete barriers, low crates, toolboxes, the rails around the lab's assembly cell, and anything similar up to about waist height: I clear them and land on the far side. Tall things (containers, server racks, the truck) stay unclimbable, and robots don't need to jump. The safe spots must not come back: wherever I can land or stand, including on top of something low or inside a fenced area, robots must still be able to reach and hit me, and a bomber's blast must reach me too. The safe-spot check covers every place I can stand, and the test players show that hopping back and forth over a barrier does not dodge the horde for ever.
- HUD: health, ammo, scrap, round number, objective tracker, active boosts and pickup timers, a crosshair with hit markers, and an indicator showing which direction damage came from. When 3 or fewer robots remain, mark them so I never have to hunt for the last one.
- Screens: a title screen with the live map behind it, a slowly moving camera, and my best round and fastest mission time; how to play, written for someone who has never played this kind of game; settings (mouse sensitivity, volume, graphics quality, reduced screen shake and flashing, all remembered between visits); credits; pause; game over; HUMANITY SAVED. Restarting must work without reloading the page.
- End-of-run report, "ARGUS's profile of you": a play-style label, my key stats, the adaptations it used against me, the round I reached and whether humanity was saved. Design it as a clean card that looks good as a screenshot, and print the page's own web address on it so shared screenshots carry the link.
- On phones and touch screens: show the title scene with a friendly "play this on a computer with a mouse and keyboard" message, not a broken game.

SOUND AND FEEL
Make shooting feel good: muzzle flash, tracers, recoil, light screen shake, ejected casings, and robots that stagger when hit. Use recorded sounds: punchy layered gunshots, metal impacts, footsteps, and robot servos and voices positioned in 3D so I can hear where they are. Add a low, tense music bed with a sting when each round starts, building as the round goes on, at a comfortable volume.

TECH
Three.js, TypeScript in strict mode, and Vite. `npm run dev` plays it locally. `npm run build` must produce a fully static site with relative paths, so it works from any subfolder address (I'll put it on GitHub Pages later). No backend, accounts, multiplayer, API keys, paid services or analytics. Keep the game rules (rounds, scrap and purchases, adaptation, mission steps) in plain modules separate from rendering so they can be unit-tested, and keep every tuning number in one config file so balance is easy to change later. Use small, clearly named files, because people will skim this repo.

Add a debug mode behind a URL flag (?debug=1) with an FPS counter, god mode, free scrap, skip-round, jump-to-mission-step, and an autopilot that moves, aims and shoots by itself. You can't play the game the way a person does, so this is how you prove it works.

CHECKS (run the ones that apply at the end of each stage; all of them must pass before you call Stage 5 done)
1. Type-check and production build finish with zero errors.
2. Unit tests pass for round scaling, scrap awards and purchases, the adaptation rules and the mission steps.
3. In a headless browser (Playwright is fine): the game loads with no console errors; a scripted run using the debug tools restores power, collects all three keys, wins the final stand, reaches HUMANITY SAVED and then plays three more endless rounds; a run without god mode reaches game over; every kind of purchase is made at least once and charges the right amount; a robot from every entry point reaches me in every area; pause and resume work; restarting three times in a row leaves no leftover robots, timers or doubled-up input.
4. Take screenshots of the title screen, a full horde mid-round, a purchase prompt, the ARGUS banner and the end-of-run report, and compare them with the approved shots in media/look-target. If the lighting looks flat, the assets don't match each other, or it reads as a tech demo, it isn't done: improve it and shoot again. Save the best ones in the media folder and use them in the README.
5. Tell me the performance budget you held to at the heaviest moment (robots, particles, draw calls, frame rate at each quality setting) and the total download size.
6. Every third-party asset in the repo has a CREDITS.md entry, and no raw Mixamo files are committed.
If you can't get a headless browser working after a few tries, don't sink time into it. Do everything else and tell me exactly what you couldn't verify.

DOCS
- README.md: what it is, screenshots, how to run it, controls, how the rounds and scrap economy work, how ARGUS adapts, a link to CREDITS.md, and an honest "how this was built" line: designed and directed by Christian Fortezzo, with the code written by an AI coding agent (name the tool you are) and art and sound from the credited free sources.
- HOW_IT_WORKS.md: a plain-English walkthrough written for me, a non-programmer, so I can explain how the game and its AI work when someone asks.

BOUNDARIES
Already approved: creating and editing files in this folder, installing npm packages into this folder, installing a headless test browser, downloading assets from the sources named above, running the dev server, tests and build, and making local git commits (commit after each working step).
Ask me first: anything outside this folder, installing software system-wide, anything that costs money or needs an account, and pushing to GitHub or publishing anywhere. If Node.js or git is missing, stop and tell me.
