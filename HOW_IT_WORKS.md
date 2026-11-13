# How HUMAN OVERRIDE works

A plain-English tour, written so you can explain the game to someone who asks "how does it actually work?" It covers what exists today (Stage 0, the look test) and is extended as each stage is added.

## The one-paragraph version

The game is a web page. When it opens, it downloads about 17 MB of pictures, 3D models and sounds, builds a 3D room out of them, and then redraws that room 60 or more times a second from wherever you are standing. Every redraw is one "frame". Between frames the game does a little bookkeeping: move the player, move the robot, check whether bullets hit anything, play sounds. That loop of "update a little, draw, repeat" is the whole game.

## What it is built with

- **three.js**: a free library that lets a web page draw 3D graphics using your computer's graphics card.
- **TypeScript**: the programming language. It is JavaScript (the language of web pages) with extra checking that catches mistakes before the game runs.
- **Vite**: the tool that bundles the code into a small set of files a browser can load.

There is no server behind it. Once the files are downloaded, everything runs on the player's own computer. That is why it can be hosted for free as a static site.

## How the picture is made

Five layers stack up to make the look. If someone asks why it does not look like a typical browser game, this is the answer.

1. **Real surfaces.** Walls, floor and metal are not flat colors. Each one uses three photographs of a real surface: its color, its bumps, and how rough or shiny it is. The graphics card combines them so light catches scratches and rust the way it would in life. This is called physically based rendering, and it is the same approach modern console games use.

2. **A few carefully placed lights.** The room is deliberately dark, with warm pools under the old lamps and a hard cold floodlight blasting in from outside. Robots walk in with that cold light behind them, so you first see a silhouette with a glowing visor and a long shadow. A handful of the lights cast real shadows that are recalculated every frame. Two faint extra lights stand in for lamplight bouncing back up off the floor, so that columns and corners read as dark concrete instead of black holes.

3. **Reflections of the actual room.** When the game starts it quietly photographs the room in all six directions from its centre. Shiny things (the rifle, the robot, damp patches on the floor) then reflect that photograph, so they mirror the real lamps around them. It also acts as soft bounce light.

4. **Air you can see.** Fog fades distant things. Faint cones of haze hang under the lamps. Hundreds of dust specks drift about and only light up while they pass through a beam. None of this is physically simulated; they are cheap visual tricks that read as atmosphere.

5. **A film look on top.** After the 3D scene is drawn, the finished image goes through a few filters, like a photo editor running 60 times a second: soft shadows where surfaces meet (ambient occlusion), a glow around bright things (bloom), a cold color grade that keeps warm lights rich, darker corners, and film grain. The Brightness setting in the pause menu is the last of these filters.

## Quality levels

The same scene can be drawn at four levels: Low, Medium, High and Ultra. Lower levels turn off the most expensive steps (fewer shadow-casting lights, no ambient occlusion, lower resolution, fewer particles) but never change what happens in the game: the same robots, the same rules. Every lamp stays switched on at every level, so the room is equally bright on all of them; an automated check measures that.

On "Auto" the game guesses a level from the name of your graphics chip, then watches the frame rate. If it stays under about 44 frames a second for three seconds, it drops a level and tells you. If even Low is too slow, it starts drawing fewer pixels and stretching them to fit.

## How the room was built

The lobby is assembled in code from a small kit: "put a concrete wall from here to here", "hang a duct along this line", "place this barrel model there". Textures are sized by real-world measurements, so concrete looks the same scale on a huge wall and a small ledge.

When the level loads, hundreds of separate pieces that share a material are fused into one object each. The graphics card is slow at drawing many small things and fast at drawing a few large ones, so this keeps the frame rate high.

The signs and floor markings ("SITE 04", "STOP - ID CHECK AHEAD", the eye logo) are painted by code onto one shared image, then scuffed and chipped so they look sprayed on years ago. Every chip is kept smaller than the thinnest stroke of the lettering it lands on, so a worn sign can never turn into a different word. The security monitors are a tiny animation redrawn a few times a second.

The stains on the upper walls are not part of any picture. The wall's texture is a plain, calm plaster that repeats every few metres; the damp patches, the streaks where water has run down from the ceiling and the soot above them are worked out for each point from where it is in the room, so no two metres of wall look the same.

## How the robot works

**The body.** A robot has two halves. The first is a skeleton with a set of recorded movements (walk, punch, flinch, fall), which comes from Adobe Mixamo, a library of motion-captured animation. The second is the body you see, which is original: the game builds it when it loads, out of a few simple kinds of shape (plates with their edges cut off, tubes, ribbed bellows, cables), each one fixed to a bone of the skeleton. The whole robot is described in one short file as a list of parts ("a plate here on the chest", "a piston from this bone to that one"), along with its proportions and its hunch. That is why it does not look like a stock character, and why a new type of robot later is a new list of parts, not a new download.

The body is painted in code too: every part is given a paint color and a wear level, and the shader adds rust, chipped edges and grime that gathers toward the feet. The visor and sensor lights are bright enough to trigger the glow filter.

**Finding you.** The floor is divided into a grid of 30 cm squares. Starting from the square you are standing in, the game "floods" outward and writes into every square how many steps it is from you, going around walls and furniture. A robot anywhere on the map only has to step toward a neighbouring square with a smaller number. There is always one, so a robot can never get stuck, and one flood works for any number of robots at once. (This is called a flow field.)

**Deciding what to do.** The robot's "brain" is a short list of states with plain rules, written separately from the graphics so it can be tested on its own:

- *Chase*: walk toward the player. If the player is within reach, switch to attack.
- *Attack*: swing. Partway through the swing, if the player is still in reach, they take damage. If they backed away in time, it misses.
- *Stagger*: a hard enough hit interrupts whatever it was doing for a moment.
- *Dead*: collapse briefly, then break apart.

**Breaking apart.** Because the body is built from parts, it also comes apart into them: eleven rigid chunks (head, torso, upper and lower arms and legs). When a robot is destroyed, its animated body is swapped for those chunks at exactly the positions they were in, and they are thrown outward with simple physics: gravity, bouncing off the floor, being pushed out of walls, then tipping over to lie flat.

## How shooting works

There are no bullet objects flying through the air. When you fire, the game draws an invisible straight line from the centre of your view, tilted by a small random amount (the "spread", which is bigger when you run or hold the trigger and much smaller when you aim down the sights). It then asks two questions:

1. Where does that line first hit the level?
2. Does it hit a robot before that?

For the second question, each robot is approximated by a handful of simple invisible shapes that follow its skeleton: a ball for the head and pill shapes for the torso and limbs. Testing a line against those is fast and exact, and it tells the game which body part was hit. The head is the weak point and takes 2.4 times the damage.

Whatever was hit gets the matching effect: a crater and dust on concrete, a bright dent and sparks on steel, sparks and a clang on a robot. The streak of light you see (the tracer), the muzzle flash, the kick of the gun and the shell casing are all cosmetic and happen after the game already knows the result.

**The rifle you see.** The gun on screen is drawn at a quarter of its real size, a quarter of the distance from your eye, which looks identical but stops it poking through walls. It is drawn through its own, narrower lens so it is not stretched the way things close to a wide lens are. And it carries its own soft light, worked out so that it only tops up what the room's lamps leave dark: without it, a dark gun in a dark room is just a black shape in front of you.

**The sight.** The rifle's sight is a small glass window with a glowing ring and dot. A real sight of this kind projects its mark "at infinity", so the mark stays on the target even when the gun shakes. The game does the same thing in a simple way: the mark is always drawn exactly where the bullets will go, and the window only decides how much of it you can see. The gun moves around the mark, not the mark with the gun.

## How the sound works

All sounds are real recordings from free libraries. Each gunshot blends two microphone positions from a real rifle recording, a close one for the crack and a distant one for the body, and the game adds a short low thump underneath. Four slightly different versions are shuffled with small random pitch changes so automatic fire never sounds like one sample repeating.

Sounds that come from somewhere in the room (robot footsteps, impacts, casings hitting the floor) are placed in 3D by the browser's audio system, so with headphones you can hear which side a robot is on. Everything is fed into a simulated echo of a hard concrete room, which is what makes the gunfire ring.

## Where the assets come from, and why the licenses are safe

Almost nothing in the game was drawn or recorded for it. The exceptions are made by the game's own code: the robot's body, the rifle's sight, the signs and the monitor screens. Everything else is free, openly licensed material, and each item is tracked from download to credit:

- A single list (the asset manifest) names every source and its license.
- A script downloads them and another set converts them into small game files: textures to WebP, 3D models to compressed GLB, sounds to MP3. The whole game is about 16 MB.
- `CREDITS.md` and the in-game credits screen are generated from that same list, so they cannot fall out of date.
- An automated check fails if any shipped file does not trace back to a credited source, if the credits disagree with the list of pages the models were downloaded from, or if a raw download ends up in the repository.

Only public-domain (CC0) and attribution (CC-BY) material is used, plus the Mixamo skeleton and movements. Mixamo's original files are never redistributed, and its character model is not in the game at all; what ships is one converted file holding a skeleton and how it moves.

## How I know it works without playing it

The code was written by an AI agent that cannot hold a mouse, so the project carries its own proof:

- **Unit tests** check the rule modules in isolation: fire rate at different frame rates, reloading, robot decisions, path-finding around walls, collision, hit detection. (They caught two real bugs during Stage 0.)
- **An end-to-end test** opens the finished game in an invisible browser and drives it through hidden debug controls: start, watch the robot walk in, shoot it, confirm it breaks apart, reload, get hit, go down, pause and resume. It also measures the picture itself: that the room is equally bright at every quality level, that the shadows are not solid black, that the brightness setting works, that the muzzle flash is over in an instant, and that raising the rifle brings up the sight's reticle.
- **A screenshot script** re-stages the same moments every time, so any change can be compared against the approved look.
- **A performance report** measures frame rate at each quality level and the total download size.

## Still to come

These parts are designed but not built yet. This document will grow as they are.

- **Rounds and scrap** (Stage 1): how many robots each round sends, how they get tougher, what earns scrap and what it buys.
- **The mission** (Stage 2): power, the three override keys, the final stand, the kill switch.
- **ARGUS, the AI that studies you** (Stage 3): during each round the game counts things about how you play, such as which weapon does most of your damage, how long you stay in one spot, and how many head shots you land. Between rounds, a set of plain rules turns those counts into one or two counters and tells you about them. It is rule-based game AI, not machine learning: there is no training and no neural network, just "if the player does X a lot, respond with Y", and every response is visible and beatable.
