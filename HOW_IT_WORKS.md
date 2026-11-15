# How HUMAN OVERRIDE works

A plain-English tour, written so you can explain the game to someone who asks "how does it actually work?" It covers what exists today (Stage 2: the core loop and the mission) and is extended as each stage is added.

## The one-paragraph version

The game is a web page. When it opens, it downloads about 17 MB of pictures, 3D models and sounds, builds a 3D building out of them, and then redraws it 60 or more times a second from wherever you are standing. Every redraw is one "frame". Between frames the game does a little bookkeeping: move the player, move the robots, check whether bullets hit anything, decide whether another robot should come in, play sounds. That loop of "update a little, draw, repeat" is the whole game.

## What it is built with

- **three.js**: a free library that lets a web page draw 3D graphics using your computer's graphics card.
- **TypeScript**: the programming language. It is JavaScript (the language of web pages) with extra checking that catches mistakes before the game runs.
- **Vite**: the tool that bundles the code into a small set of files a browser can load.

There is no server behind it. Once the files are downloaded, everything runs on the player's own computer. That is why it can be hosted for free as a static site.

## How a run works

**Rounds.** A round is a fixed number of robots: 6 in round 1, 8 in round 2, then 10, 13, 16, 20 and so on. They do not all arrive at once: one comes in every couple of seconds (faster in later rounds), and never more than 24 are on the map together. When the last one is destroyed there is a ten-second lull, then the next round starts with more robots that are tougher and faster. From round 5 some of them run, slowly at first; by round 13 the runners are just under your own sprinting speed. All of this is one small table of numbers in a single file (`src/config.ts`), so the difficulty can be retuned without touching the rest of the code.

**Scrap.** Destroying robots pays scrap: 10 for a hit, 60 for a kill, 100 for a kill through the head, 130 for a kill with the melee strike. The riskier the kill, the better it pays. The shotgun pays for one hit per shell however many of its nine pellets land, or it would print money.

**Spending it.** Guns hang on wall racks with their price beside them; walk up, press F. Buying a gun you already own refills its ammunition for less. Doors cost scrap too, and stay open. You can only carry two guns, so a third replaces the one in your hands. Every purchase goes through one small piece of code that checks the price, takes the scrap and reports what happened, which is what lets a test buy everything in the game and add up the bill.

**Running away.** Sprinting is paid for with stamina, the thin bar under your health. A full bar is four seconds of sprinting. It starts refilling a second after you stop, and if you run it dry you are "winded": walking pace only until about a third of it has come back. So running buys time, not safety. Robots are also solid: you cannot run through one, and a crowd can box you in.

**Taking hits.** After a blow lands there is just under half a second in which another cannot, so three robots reaching you at once is three blows spread over a second and a half, not one instant. It is the difference between "I was overwhelmed" and "I died and do not know why".

**Going down.** Your health comes back if nothing hits you for four seconds. If it reaches zero, the run ends, the game shows how far you got, and "Play Again" puts everything back exactly as it was at the start: robots, doors, guns, scrap, timers.

The rules for all of this (how a round grows, what a hit pays, what a purchase does) are written as plain logic with no graphics in them, in `src/sim/`. That separation is what makes them testable: a test can play out round 30 in a thousandth of a second without drawing anything.

## How the mission works

The mission is a checklist with an order to it, and it lives in one small file of plain logic (`src/sim/mission.ts`) that knows nothing about graphics. The game tells that file what you did ("the player threw the breaker"), and asks it two questions: "is this allowed yet?" and "what should the player be told to do next?"

1. **Restore power.** The power room's main breaker. Until it is thrown, the key cage's lock is dead, the uplink is dead, and the Custodian does not come.
2. **Recover three override keys**, in any order:
   - one sits in the **key cage** in the power room, whose lock lets go when the power comes back;
   - one is issued by the **uplink** in the server hall to whoever starts it and then holds the ground around it for sixty seconds. The clock only runs while you are standing inside the ring on the floor; step out and it stops, keeping what you have earned. While it runs, ARGUS sends extra robots at it;
   - one is carried by the **Custodian**, a tall, pale security machine that arrives with round 8 (or with the next round, if the power came on later than that). Destroy it and the key drops where it fell.
3. **Unseal the core** with the three keys, **arm the kill switch**, and **survive** the 75 seconds it takes to arm. This is the final stand: the ordinary rounds stand aside and ARGUS sends a steady stream of robots at you, and ten seconds in, its own unit, the **Proxy**: half as tall again as anything else, black, with twelve times the health of an ordinary robot.
4. **Pull the switch.** Every robot on the map goes limp and falls where it stands, ARGUS's eye on the core wall gutters and goes out, and the HUMANITY SAVED screen shows your run. From there you can stop, or keep fighting for a higher round (the machines still outside "have not heard").

**The tracker.** The box under the round number always shows the next step, with three small lozenges for the keys and a marker in the world pointing at where to go. It never has to be kept in step with the mission by hand, because it does not store anything: every frame it asks the mission file "what now?" and prints the answer. With several keys still to find, the answer is whichever is nearest to hand: a key lying on the floor first, then the cage, then the Custodian if it is on the map, then the uplink.

**The two elite robots** are the ordinary robot with different numbers and a different finish, exactly as the spec asked: the same skeleton and movements, scaled up, re-plated in another colour, with other lights. The Custodian carries a real glowing key in a cradle on its back, so you can see what you are being asked to shoot. Neither can be slowed to a crawl by automatic fire the way an ordinary robot can.

**Records.** The fastest time from pressing Play to pulling the switch is remembered in your browser alongside your best round, and shown on the title screen.

## How the map works

The facility is four areas joined by doors: the security lobby where you start, a server hall, a power room, and the core. Three of the doors can be bought, and together they make a loop, so someone being chased always has somewhere to run. The core's door cannot be bought at any price: it opens when you press F on it with all three override keys in hand.

**Only what can be seen is drawn.** The game keeps a tiny map of which areas are joined by open doors. An area you could not possibly see (behind a closed door) is not drawn and its lamps are not lit. That is most of why four rooms cost little more than one.

**Lights are shared.** A graphics card can only afford a couple of dozen lights at once, and the facility has about sixty lamps. So the game keeps a fixed pool of 22 lights and lends them to whichever lamps matter most from where you are standing, fading one out and the next in as you walk. A few of them cast real shadows; which ones is chosen the same way.

**Every room closes itself.** Because a room behind a shut door is not drawn, each room has to be sealed by surfaces of its own. Two rooms that share a wall cannot share one *wall object*: the room that borrowed its neighbour's would have a hole in it whenever the neighbour was not being drawn, and the night sky would show through. So where two rooms meet, each has its own facing on its own side, and the door frames belong to the doors (which are always drawn), not to either room. An automated check looks from inside every room toward every other, through that room's own walls only, and fails if any line of sight gets out.

**Where robots come in.** There are eight entrances: three they walk through (the main breach, a loading dock, a hole in the power room wall) and five ceiling vents they drop out of. Robots only use entrances that connect to where you are, and favour the area you are in, so the fight follows you. In the first two rounds, with no doors bought, that means the one bright doorway in front of you, which is how the game teaches where to look.

**You never see one appear.** A robot that walks in is created outside, in the gap behind a shipping container, and comes out round the end of it; from nowhere inside the building can those gaps be seen. A robot that drops from a vent is created above the ceiling and falls out of it. Before creating any robot, the game asks whether you could see it: for a walk-in spot, whether there is any clear line from your eye to it, whichever way you are facing; for a vent, whether you are looking at it or at the space under it. If the answer is yes it uses a different entrance, and if you are somehow watching all of them, the robot simply waits and is tried again a moment later. A separate piece of test code, which shares nothing with that rule, counts any robot that was in the picture on screen at the moment it was created. The count has to stay at zero.

## How the picture is made

Five layers stack up to make the look. If someone asks why it does not look like a typical browser game, this is the answer.

1. **Real surfaces.** Walls, floor and metal are not flat colors. Each one uses three photographs of a real surface: its color, its bumps, and how rough or shiny it is. The graphics card combines them so light catches scratches and rust the way it would in life. This is called physically based rendering, and it is the same approach modern console games use.

2. **A few carefully placed lights.** The rooms are deliberately dark, with warm pools under the old lamps and a hard cold floodlight blasting in from outside. Robots walk in with that cold light behind them, so you first see a silhouette with a glowing visor and a long shadow. Faint extra lights stand in for lamplight bouncing back up off the floor, so that columns and corners read as dark concrete instead of black holes.

3. **Reflections of the actual rooms.** When the game starts it quietly photographs each room in all six directions from its centre. Shiny things (the guns, the robots, damp patches on the floor) then reflect that photograph, so they mirror the real lamps around them. It also acts as soft bounce light.

4. **Air you can see.** Fog fades distant things. Faint cones of haze hang under the lamps. Hundreds of dust specks drift about and only light up while they pass through a beam. None of this is physically simulated; they are cheap visual tricks that read as atmosphere.

5. **A film look on top.** After the 3D scene is drawn, the finished image goes through a few filters, like a photo editor running 60 times a second: soft shadows where surfaces meet (ambient occlusion), a glow around bright things (bloom), a cold color grade that keeps warm lights rich, darker corners, and film grain. The Brightness setting in the pause menu is the last of these filters.

## Quality levels

The same scene can be drawn at four levels: Low, Medium, High and Ultra. Lower levels turn off the most expensive steps (fewer shadow-casting lights, no ambient occlusion, lower resolution, fewer particles) but never change what happens in the game: the same robots, the same rules. Every lamp stays switched on at every level, so the rooms are equally bright on all of them; an automated check measures that.

On "Auto" the game guesses a level from the name of your graphics chip, then watches the frame rate. If it stays under about 44 frames a second for three seconds, it drops a level and tells you. If even Low is too slow, it starts drawing fewer pixels and stretching them to fit.

Changing level is more work than it sounds. The little programs the graphics card runs to draw each surface ("shaders") have the number of shadow-casting lights built into them, so a change of level means rebuilding every one. The game does that at the moment of the change, for everything at once, including things that are out of sight. Left to happen on demand, each would freeze the picture for half a second the first time it was needed: the next robot through the door, the next gun bought.

## How the rooms were built

Each room is assembled in code from a small kit: "put a concrete wall from here to here, with a doorway in it", "hang a duct along this line", "place this barrel model there". Textures are sized by real-world measurements, so concrete looks the same scale on a huge wall and a small ledge.

When the level loads, hundreds of separate pieces that share a material are fused into one object each. The graphics card is slow at drawing many small things and fast at drawing a few large ones, so this keeps the frame rate high.

The signs and floor markings ("SITE 04", "STOP - ID CHECK AHEAD", the eye logo) are painted by code onto one shared image, then scuffed and chipped so they look sprayed on years ago. Every chip is kept smaller than the thinnest stroke of the lettering it lands on, so a worn sign can never turn into a different word.

The stains on the upper walls are not part of any picture. The wall's texture is a plain, calm plaster that repeats every few metres; the damp patches, the streaks where water has run down from the ceiling and the soot above them are worked out for each point from where it is in the room, so no two metres of wall look the same.

**Things that move on a surface.** The security monitors and the thousands of status lights on the server racks look like the same trick and are done two different ways, for a reason found by measuring.

- The **monitors** are one small picture, repainted nine times a second and shared by every screen in the building. Handing a fresh picture to the graphics card sounds free and is not: done the obvious way, the card stops and catches up with everything else it is doing first. On a busy card that was a stall of a twentieth of a second, nine times a second. The picture is now sent in a plainer form that does not cause the stall, and the card converts it itself.
- The **rack lights** are never repainted at all. The racks are a picture made once; which lights exist, and which of eight groups each belongs to, is two more pictures made once. Whether a group is lit at this instant is worked out by the graphics card for each rack unit, from the clock. Nothing is sent anywhere, however many racks are in view.

## How the robot works

**The body.** A robot has two halves. The first is a skeleton with a set of recorded movements (walk, run, punch, flinch, fall), which comes from Adobe Mixamo, a library of motion-captured animation. The second is the body you see, which is original: the game builds it when it loads, out of a few simple kinds of shape (plates with their edges cut off, tubes, ribbed bellows, cables), each one fixed to a bone of the skeleton. The whole robot is described in one short file as a list of parts ("a plate here on the chest", "a piston from this bone to that one"), along with its proportions and its hunch. That is why it does not look like a stock character, and why a new type of robot later is a new list of parts, not a new download.

The body is painted in code too: every part is given a paint color and a wear level, and the shader adds rust, chipped edges and grime that gathers toward the feet. The visor and sensor lights are bright enough to trigger the glow filter.

**Seeing it in the dark.** A dark machine in a dark room is invisible, and being hit by something you could not see feels unfair. So wherever a robot's own surface comes out close to black, its edges (the parts of it turned away from you) pick up a faint cold sheen, the way bare steel catches stray light, and the rest of it lifts a shade off pure black. Where real light falls on the robot the effect fades to nothing, so in a lit room it looks exactly as it did. Across a room a thin outline would be finer than a pixel, so with distance the sheen spreads over more of each surface. A test photographs the darkest places on the map empty, then with robots standing in them with their backs turned, and measures how much of each robot comes out clearly different from what was behind it.

**Finding you.** The floor is divided into a grid of 30 cm squares. Starting from the square you are standing in, the game "floods" outward and writes into every square how many steps it is from you, going around walls, furniture and closed doors. A robot anywhere on the map only has to step toward a neighbouring square with a smaller number. One flood works for any number of robots at once, which is why two dozen cost barely more than one. (This is called a flow field.) When a door opens, the squares in its doorway are unblocked and the next flood finds the new route by itself.

**Not walking through each other.** Robots also push gently away from any robot that is too close, so a horde spreads out around furniture instead of merging into one.

**Deciding what to do.** The robot's "brain" is a short list of states with plain rules, written separately from the graphics so it can be tested on its own:

- *Chase*: walk (or run) toward the player. If the player is within reach, switch to attack.
- *Attack*: swing. Partway through the swing, if the player is still in reach, they take damage. If they backed away in time, it misses.
- *Stagger*: a hard enough hit interrupts whatever it was doing for a moment.
- *Dead*: collapse briefly, then break apart.

Two safety nets keep a round from stalling. Robots hurry across the yards outside and only slow to their own pace indoors. And a robot that makes no progress toward you for seven seconds is quietly taken out and sent in again.

**Breaking apart.** Because the body is built from parts, it also comes apart into them: eleven rigid chunks (head, torso, upper and lower arms and legs). When a robot is destroyed, its animated body is swapped for those chunks at exactly the positions they were in, and they are thrown outward with simple physics: gravity, bouncing off the floor, being pushed out of walls, then tipping over to lie flat.

## How shooting works

There are no bullet objects flying through the air. When you fire, the game draws an invisible straight line from the centre of your view, tilted by a small random amount (the "spread", which is bigger when you run or hold the trigger and much smaller when you aim down the sights). It then asks two questions:

1. Where does that line first hit the level?
2. Does it hit a robot before that?

For the second question, each robot is approximated by a handful of simple invisible shapes that follow its skeleton: a ball for the head and pill shapes for the torso and limbs. Testing a line against those is fast and exact, and it tells the game which body part was hit. The head is the weak point: a hit there does more than double the damage with the sidearm and the carbine, and half as much again with the shotgun.

The shotgun is the same thing nine times over in a wider cone, with damage that falls away quickly with distance. The melee strike asks a different question: is a robot within about two metres, in the arc in front of you?

Whatever was hit gets the matching effect: a crater and dust on concrete, a bright dent and sparks on steel, sparks and a clang on a robot. The streak of light you see (the tracer), the muzzle flash, the kick of the gun and the shell casing are all cosmetic and happen after the game already knows the result.

**The gun you see.** The gun on screen is drawn at a quarter of its real size, a quarter of the distance from your eye, which looks identical but stops it poking through walls. It is drawn through its own, narrower lens so it is not stretched the way things close to a wide lens are. And it carries its own soft light, worked out so that it only tops up what the room's lamps leave dark: without it, a dark gun in a dark room is just a black shape in front of you.

**The sight.** The carbine's sight is a small glass window with a glowing ring and dot. A real sight of this kind projects its mark "at infinity", so the mark stays on the target even when the gun shakes. The game does the same thing in a simple way: the mark is always drawn exactly where the bullets will go, and the window only decides how much of it you can see. The gun moves around the mark, not the mark with the gun.

## How the round announcement works

When a round begins, a red scan line sweeps down the view, the round number snaps in behind it in the title's lettering, holds for a second and a half, and then the numeral flies up to the round counter in the corner, which takes the new number and pulses. When a round is cleared, one line says so, with the scrap that round paid counting up under it.

Two things about how it is made are worth knowing. First, it starts on the same instruction as its sound. The round "sting" used to swell in slowly; it was rebuilt to open on a sharp burst for the number to land on. Second, none of it is a canned animation. Every frame, one small file works out where each piece should be from a single clock: "0.1 seconds in: the lettering is 1.2 times its size, skewed 3 degrees, the scan line is a sixth of the way down". That makes it possible to freeze it at any moment (which is how its screenshots are taken, and how the tests look at it), and it means the "reduce screen shake and flashing" setting can simply leave out the scan line, the interference and the glitch, and fade the lettering in instead.

It is lettering only, with no panel behind it, placed above the crosshair, and the game never stops for it.

## How the player moves

Two things act on you as you walk. Friction drags your speed toward zero all the time, which is what stops you when you let go of the keys. Holding a direction pushes your speed toward the speed you are aiming for: walking, sprinting, or slower while aiming.

This is worth knowing about because it hid a bug for two stages. The push was the same strength whatever speed was being aimed for, while friction gets stronger the faster you go. The two balanced out at about 4.2 metres a second, and it did not matter whether the target was a walk or a sprint. Holding Shift widened the view and lowered the gun, and felt like sprinting, and was not. The push is now sized to the target speed, so the target is always reached: 4.3 metres a second walking, 6.4 sprinting.

## How the sound works

All sounds are real recordings from free libraries. Each gunshot blends two microphone positions from a real recording, a close one for the crack and a distant one for the body, and the game adds a short low thump underneath. Four slightly different versions are shuffled with small random pitch changes so automatic fire never sounds like one sample repeating.

Sounds that come from somewhere in the room (robot footsteps, impacts, casings hitting the floor, a door grinding open) are placed in 3D by the browser's audio system, so with headphones you can hear which side a robot is on. Everything is fed into a simulated echo of a hard concrete room, which is what makes the gunfire ring.

## Where the assets come from, and why the licenses are safe

Almost nothing in the game was drawn or recorded for it. The exceptions are made by the game's own code: the robot's body, the carbine's sight, the signs, the monitor screens and the rack lights. Everything else is free, openly licensed material, and each item is tracked from download to credit:

- A single list (the asset manifest) names every source and its license.
- A script downloads them and another set converts them into small game files: textures to WebP, 3D models to compressed GLB, sounds to MP3. The whole game is about 17 MB.
- `CREDITS.md` and the in-game credits screen are generated from that same list, so they cannot fall out of date.
- An automated check fails if any shipped file does not trace back to a credited source, if the credits disagree with the list of pages the models were downloaded from, or if a raw download ends up in the repository.

Only public-domain (CC0) and attribution (CC-BY) material is used, plus the Mixamo skeleton and movements. Mixamo's original files are never redistributed, and its character model is not in the game at all; what ships is one converted file holding a skeleton and how it moves.

## How I know it works without playing it

The code was written by an AI agent that cannot hold a mouse, so the project carries its own proof. It comes in several kinds, and the interesting part is what each one caught that the others could not.

- **Unit tests** check the rule modules in isolation, with no graphics: how rounds grow, what every kind of kill pays, what every purchase does to your scrap and your two weapon slots, which areas connect when which doors are open, which entrance a robot may use when some are being watched, every step of the mission in every order the keys can be found, how stamina drains and returns, fire rate at different frame rates, robot decisions, path-finding, collision, and how the player's speed builds up.

- **An end-to-end test** opens the finished game in an invisible browser and drives it through hidden debug controls with time stepped by hand, so every result is exact. It makes every kind of purchase and checks what each one charged, sends a robot through each of the eight entrances and waits for it to reach the player in each of the four areas, goes down without god mode, and restarts three times in a row looking for leftover robots, timers still running, or one click firing twice. It also measures the picture itself: equally bright at every quality level, shadows not solid black, the muzzle flash over in an instant.

- **A whole mission, scripted.** The same test plays the mission from the first breaker to HUMANITY SAVED: it stands where a player would stand and presses F at each step, holds the uplink for its sixty seconds (and walks away for ten of them to check the clock stops), shoots the Custodian and the Proxy until they are destroyed, pulls the switch, checks every robot has gone down, then fights on through three more rounds. It also tries each step too early and checks that nothing happens.

- **An autopilot** (the 0 key in debug mode) plays the game by itself: it backs away from what is close, shoots what is nearest, reloads, and shops. It has two characters. The "expert" never misses. The "first-timer" is a rough model of someone new to this kind of game: slow to notice a robot, shaky, aims at the body, backs away late. The spec asks that a first-time player usually goes down between rounds 5 and 8, so a tool plays sixteen whole runs as the first-timer, without drawing them (a five-minute run takes about five seconds), and reports the round each ended in. It is a model, not a person: it shows whether the numbers are in the right place, not how the game feels.

- **Checks that look at the building itself.** Some bugs are in the map, not the rules, and were found by eye first and then turned into checks so they cannot come back: every room is sealed by its own walls; nothing stands across any doorway (a rail along one wall once carried straight on across four openings); there is nowhere a player can stand that no robot can reach; every way in is joined to every room on the map the robots steer by (a parked cart once cut the loading dock off, and every robot sent that way stood against a wall); the places robots walk in from cannot be seen from indoors; a robot in the darkest corner still stands out from what is behind it; and every door, the core's included, is opened with F and walked through on foot at every quality level, with the room beyond measured to make sure it is lit.

- **Real input.** The debug controls press the game's buttons from the inside, which cannot notice a key that is wired to nothing, or a menu button that fails to capture the mouse. So the last part of the test uses the real thing: real clicks on Play, Resume and Play Again with the browser really capturing and releasing the mouse, and every key on the controls list really pressed. This found the sprint bug described above, and that choosing "Auto" quality after trying another level did nothing. Finally the browser's processor is slowed sixteen times over to imitate a weak computer, and the test waits for the game to notice and lower its own quality.

Alongside these, **a screenshot script** re-stages the same moments every time so any change can be compared with the approved look, and **a performance report** measures frame rate at each quality level, the download size, and smoothness: not the average frame, which can hide stutter, but the slowest frames. That report is how the stalling monitors were found; the average had looked fine.

## Still to come

These parts are designed but not built yet. This document will grow as they are.

- **ARGUS, the AI that studies you** (Stage 3): during each round the game counts things about how you play, such as which weapon does most of your damage, how long you stay in one spot, and how many head shots you land. Between rounds, a set of plain rules turns those counts into one or two counters and tells you about them. It is rule-based game AI, not machine learning: there is no training and no neural network, just "if the player does X a lot, respond with Y", and every response is visible and beatable.
- **The full economy** (Stage 4): shutters to repair, boost stations, a prototype crate, an overclock bench, pickups, swarm rounds, grenades.
