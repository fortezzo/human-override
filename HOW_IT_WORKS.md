# How HUMAN OVERRIDE works

A plain-English tour, written so you can explain the game to someone who asks "how does it actually work?" It covers what exists today (Stage 3: the core loop, the mission, and ARGUS) and is extended as each stage is added.

## The one-paragraph version

The game is a web page. When it opens, it downloads about 17 MB of pictures, 3D models and sounds, builds a 3D building out of them, and then redraws it 60 or more times a second from wherever you are standing. Every redraw is one "frame". Between frames the game does a little bookkeeping: move the player, move the robots, check whether bullets hit anything, decide whether another robot should come in, play sounds. That loop of "update a little, draw, repeat" is the whole game.

## What it is built with

- **three.js**: a free library that lets a web page draw 3D graphics using your computer's graphics card.
- **TypeScript**: the programming language. It is JavaScript (the language of web pages) with extra checking that catches mistakes before the game runs.
- **Vite**: the tool that bundles the code into a small set of files a browser can load.

There is no server behind it. Once the files are downloaded, everything runs on the player's own computer. That is why it can be hosted for free as a static site.

## How a run works

**Rounds.** A round is a fixed number of robots: 6 in round 1, 10 in round 2, then 14, 18, 23, 29 and so on. They do not all arrive at once: one comes in every two and a half seconds or so (every two seconds from round 9), and never more than 24 are on the map together. When the last one is destroyed there is a fifteen-second lull, then the next round starts with more robots that are tougher and faster. Toughness climbs quickly for the first six rounds and slowly after that. From round 5 some of them run, slowly at first; by round 14 the runners are just under your own sprinting speed, but never more than half the horde runs. A round lasts about half a minute at the start and a minute and a half by round 10. All of this is one small table of numbers in a single file (`src/config.ts`), so the difficulty can be retuned without touching the rest of the code, and it has been: see "How the difficulty was set" further down.

**Scrap.** Destroying robots pays scrap: 10 for a hit, 60 for a kill, 100 for a kill through the head, 130 for a kill with the melee strike. The riskier the kill, the better it pays. The shotgun pays for one hit per shell however many of its nine pellets land, or it would print money.

**Spending it.** Guns hang on wall racks with their price beside them; walk up, press F. Buying a gun you already own refills its ammunition for less. Doors cost scrap too, and stay open. You can only carry two guns, so a third replaces the one in your hands. Every purchase goes through one small piece of code that checks the price, takes the scrap and reports what happened, which is what lets a test buy everything in the game and add up the bill.

**Running away.** Sprinting is paid for with stamina, the thin bar under your health. A full bar is four seconds of sprinting. It starts refilling a second after you stop, and if you run it dry you are "winded": walking pace only until about a third of it has come back. So running buys time, not safety. Robots are also solid: you cannot run through one, and a crowd can box you in.

**Taking hits.** A robot's blow takes a fifth of your health, and after one lands there is six tenths of a second in which another cannot. So a crowd needs five blows and at least 2.4 seconds to put you down from full health (in practice rather longer: a blow that would land inside that gap is lost, not put off, and each robot swings again a second and a half later), and health starts coming back three seconds after the last one. It is the difference between "I was overwhelmed" and "I died and do not know why". (Until the first real person played the whole mission it was four blows in 1.35 seconds, which is quicker than anyone can react; see "How the difficulty was set".)

**Going down.** Your health comes back if nothing hits you for four seconds. If it reaches zero, the run ends, the game shows how far you got, and "Play Again" puts everything back exactly as it was at the start: robots, doors, guns, scrap, timers.

The rules for all of this (how a round grows, what a hit pays, what a purchase does) are written as plain logic with no graphics in them, in `src/sim/`. That separation is what makes them testable: a test can play out round 30 in a thousandth of a second without drawing anything.

## How the mission works

The mission is a checklist with an order to it, and it lives in one small file of plain logic (`src/sim/mission.ts`) that knows nothing about graphics. The game tells that file what you did ("the player threw the breaker"), and asks it two questions: "is this allowed yet?" and "what should the player be told to do next?"

1. **Restore power.** The power room's main breaker. Until it is thrown, the key cage's lock is dead, the uplink is dead, and the Custodian does not come.
2. **Recover three override keys**, in any order:
   - one sits in the **key cage** in the robotics lab, next door to the power room, whose lock lets go when the power comes back (it was in the power room itself until the map grew: the walk through the lab is the reason to open it);
   - one is issued by the **uplink** in the server hall to whoever starts it and then holds the ground around it for sixty seconds. The clock only runs while you are standing inside the ring on the floor; step out and it stops, keeping what you have earned, which is what lets you back off to recover and come back. While it runs, ARGUS sends extra robots at it: none in the first two rounds, then one more at a time for every three rounds played, up to four, so an uplink started early is a smaller fight than one started late. And while it runs no more than seven robots are on the map at once, the round's own and the uplink's together; the rest of the round waits. Holding ground means standing where every robot knows to find you, and a round that would be fair to someone free to run is not fair to someone who is not;
   - one is carried by the **Custodian**, a tall, pale security machine that comes for the last key: it arrives with the first round to start once you hold the other two, and never before round 8. So the mission is as long as you make it. (It used to arrive with round 11 whatever you had done, and a fast player spent three rounds with nothing to do but wait.) Destroy it and the key drops where it fell.
3. **Unseal the core** with the three keys, **arm the kill switch**, and **hold the core** for the 75 seconds it takes to arm. The switch only arms while you are inside the core: step out and its clock stops, exactly as the uplink's does, and the tracker says GET BACK TO THE CORE. Running laps of the map does not win the game. This is the final stand: the ordinary rounds stand aside and ARGUS sends a heavy horde that presses in at a walk (one in five runs), and ten seconds in, its own unit, the **Proxy**: half as tall again as anything else, with eight times the health of an ordinary robot. It is too big for the ceiling ducts, so it comes in on foot, through one of the loading dock's truck bays if you have opened the dock and across the front yard if you have not, and in through the core's door, where you can see it coming from across the room.
4. **Pull the switch.** Every robot on the map goes limp and falls where it stands. ARGUS's eye on the core wall gutters twice and goes dark in a little over a second, the red light it threw on the room dies with it, the red lights on its machines go out, the monitors that showed its eye read ARGUS OFFLINE, and cold working light comes up in its place. Then the HUMANITY SAVED screen shows your run. From there you can stop, or keep fighting for a higher round (the machines still outside "have not heard").

**The tracker.** The box under the round number always shows the next step, with three small lozenges for the keys and a marker in the world pointing at where to go. It never has to be kept in step with the mission by hand, because it does not store anything: every frame it asks the mission file "what now?" and prints the answer. With several keys still to find, the answer is whichever is nearest to hand: a key lying on the floor first, then the cage, then the Custodian if it is on the map, then the uplink.

**The two elite robots** are the ordinary robot with different numbers and a different finish, exactly as the spec asked: the same skeleton and movements, scaled up, re-plated in another colour, with other lights. The Custodian carries a real glowing key in a cradle on its back, so you can see what you are being asked to shoot. Neither can be slowed to a crawl by automatic fire the way an ordinary robot can.

**Making the Proxy readable.** A black machine in a dark red room is a dark clump, however good it looks up close. So the Proxy is lit from inside (broad seams down its chest and back, bands round its forearms and shins, lit shoulder plates, a row of eyes over the visor, all in the white-hot orange of ARGUS's own iris), and from a distance its edges glow pale and a light travels with it, so its shape and the floor round it are lit. Both of those fade out as it closes in: within two or three metres it is the black machine it was built as, with only its seams burning. A check measures it from eight metres against one of the horde on the same spot: it has to be about twice as bright, from the front, the side and behind.

**Records.** The fastest time from pressing Play to pulling the switch is remembered in your browser alongside your best round, and shown on the title screen.

## How ARGUS works

ARGUS is the AI in the story. In the code it is **a set of rules, not machine learning**. Nothing in it learns, guesses or improves by itself, and there is no neural network anywhere in the game. It keeps a handful of running totals about how you are playing, compares each with a fixed number, and picks from four fixed responses. Every rule is in one file of plain logic (`src/sim/argus.ts`), every number it uses is in the config file, and every rule has a unit test. That is the honest description of it, and it is also why it is fair: the same play always gets the same answer.

**What it writes down during a round** (only while there are robots on the map, so standing in an empty room does not count against you):

- how much damage each weapon did (the melee strike counts as a weapon);
- how many of your hits landed on a weak point;
- how long you stayed within 4.5 metres of one spot (a stay counts once it has lasted 10 seconds);
- how many laps you ran: coming back to within 3.5 metres of where you were at least 8 seconds ago, having covered 25 metres and been 8 metres away in between. Pacing up and down a corridor is not a lap.

**What it does about it.** In the lull after each round, starting with the lull before round 3, it asks four questions:

| It notices | When | Its counter for the next round | How you beat it |
| --- | --- | --- | --- |
| You lean on one weapon | 60% or more of the round's damage came from it | **Shielding**: four in ten of the ordinary robots carry plates of light round the chest, in that weapon's colour. That weapon does half damage to them | Use your other gun, or the strike, on the ones with shields. Spread your damage and the shielding is withdrawn |
| You hold one spot | 45% or more of the round spent holding | **Flushing out**: two extra bombers, and half the round comes in at the entrance nearest you | Move. Shoot the bombers while they are still among their own |
| You run the horde in circles | 3 or more laps in the round | **Interception**: four extra drones, sent in ahead of the way you are running | Change direction, or stand and fight for a while |
| You land a lot of weak-point hits | 40% or more of your hits | **Guarding**: half the ordinary robots wear a steel plate over the visor. A hit there counts as a body hit until the plate has taken about half a robot's health; then it flies off | Shoot the plate off, or shoot the body |

It acts on at most two at once: the two with the strongest evidence. A counter stays for as long as the habit does (the banner says "Maintaining"), and is taken away the round after you stop (the banner says "Withdrawing"). So every counter is something you can see on the robots, and something you can undo by playing differently. None of them is a hidden boost to a robot's health or damage, and the tests hold it to that: a shot on a plated head never does less than the same shot on the body would.

**The banner.** This is the one idea the game is built around, so it arrives as a moment. About three seconds into the lull it comes in large across the top of the view, under ARGUS's eye mark (the same mark that is painted on the walls) and with a sound of its own: ARGUS ANALYSIS, then what it observed and what it is doing, one sentence each. For example: "Observed: 77% of damage from the carbine. Adapting: carbine-resistant plating." It holds for about two seconds, then shrinks into the top right corner, where it stays until the next round begins. Its corner is on the right because your objective is on the left: your side of the screen, and its side.

Three rules it keeps. The game never pauses for it. It never covers the middle of the view: it is sized as a share of the window, so that on a big screen and in a small one it ends about a third of the way down, well above the crosshair. And with "reduce screen shake and flashing" on, nothing in it moves or blinks: it fades in, and fades from one place to the other. Only one thing is ever shown at the top of the view at a time: it waits for "ROUND 4 CLEARED" to go, and a mission notice waits for it.

**Hits that did less.** When a shot lands on a heavy's plating or a plated head, a small word appears under the crosshair saying which (ARMOUR, PLATE, and PLATE OFF when the plate goes), and the hit marker is dimmer. A shot turned by shielding, which is ARGUS answering the gun in your hands, gets more than a small word, because you have to know at once: **RESISTED** in large letters in the shielding's own colour, the plate it struck flaring white and swelling, a spray of sparks thrown back off it, the round itself glancing away as a bright streak, and a ring of struck metal that no other hit makes. The word snaps in once and then stays while you keep firing into the same plating; it does not jump with every round, which would strobe. You are never left wondering why a robot took so long to go down.

**Remarks.** There are seventeen things it may comment on in one line: your first kill, a run of weak-point kills, standing still for twenty seconds, running laps, low health, an empty gun, a new weapon, each step of the mission. It never repeats a line and waits at least 18 seconds between them.

**The profile.** At the end of a run, the game-over and HUMANITY SAVED screens both offer "ARGUS's profile of you": a card with a play-style label (the Marksman, the Fortress, the Runner, the Specialist, the Brawler or the Improviser), six numbers, the counters it used and in which rounds, the round you reached, whether humanity was saved, and the web address of the page, so a screenshot of the card carries the link to the game. The label is the habit that stood out most over the whole run, measured against bars set from the same thresholds as the counters (the bar for a favourite weapon is higher over a whole run, three quarters of all damage, because nearly everyone's best gun does most of the work). If no habit is past its bar you are the Improviser, which is the best thing it can call you.

**When the switch is pulled, ARGUS is off.** It stops watching and adapting, its counters are withdrawn, and the rounds you fight on through afterwards are plain ones.

## The special robots

From round 4 the horde is no longer all one kind. The specials take the place of ordinary robots, so a round is no longer for having them, and they are spread through the round, never sent first or all at once.

- **Drones** (from round 4: two, and one more every two rounds, up to six). They fly at head height at 5.2 metres a second, faster than you walk, and sting for a little. They have a third of an ordinary robot's health, so one or two shots bring one down. You hear them before you see them.
- **Bombers** (from round 6: one, up to three). A robot with a yellow charge strapped to its chest. It runs at you, and within 2.4 metres it primes: its lights beat faster, it beeps, and 0.8 seconds later it goes off, hurting everything within 4.5 metres, less with distance. Stand still and it costs about half your health; back away and it costs almost nothing. Destroy it first and it goes off where it stands, which wrecks the robots round it and pays you for each.
- **Heavies** (from round 8: one; two from round 12). Slow, a third bigger, with four times the health and plating that turns seven tenths of any hit. The plating has one opening: the reactor burning in the middle of its chest. A shot there does full weak-point damage. Shoot the glow. It is the ordinary robot's body and head underneath, in armour made for it: a breastplate in two halves that close on the reactor's housing, strips down the belly that lap one another, shoulder plates in two layers carried on a strut, shaped plates down the legs with a hinged cap over each knee, and a helm round the ordinary robot's own visor. Stood beside one of the horde it is plainly the same make of machine, built heavier.

All three are built in code on the same skeleton as the ordinary robot (the drone simply has nothing built on its limbs, and the game holds it in the air), so they needed no new downloads, and they share its path-finding, hit testing and the way it breaks apart.

## How the map works

The facility is six areas joined by doors: the security lobby where you start, a server hall, a power room, a loading dock, a robotics lab, and the core. (It was four until the first full playthrough: "it feels cramped once the horde is large and there is nowhere to run it".)

```
                                 yard (robots arrive)
                                       |
 truck bays     goods door     [ SECURITY LOBBY ] -- power door -- [ POWER ROOM ] -- breach
     |        +----1000--------+       |                 1000         |        |
     |        |             blast door 750             service door 1250    lab door 1000
     |        |                        |                              |        |
[ LOADING DOCK ]--- dock shutter ---[ SERVER HALL ]-------------------+        |
                      1000             |       \                               |
                                   core door    +----- lab shutter 1250 --[ ROBOTICS LAB ] -- assembly line
                                  (three keys)
                                       |
                                    [ CORE ]
```

Seven of the doors can be bought (the numbers are their prices in scrap), and together they make three loops: lobby, hall, power room; lobby, dock, hall; hall, lab, power room. Every area but the core has at least two ways out, so someone being chased always has somewhere to run, and there is no dead end to be cornered in. The core's door cannot be bought at any price: it opens when you press F on it with all three override keys in hand.

**The two new areas have their own moods.** The loading dock is the biggest open space on the map, seven and a half metres high, under sodium lamps: shipping containers standing in islands with lanes all round them, a box truck backed into the middle bay with its headlamps on, a crane on its rail, and two truck bays open to the yards the robots cross. The robotics lab is cold and white: a fenced assembly cell where three arms are putting a unit together, torsos coming in on an overhead line, racks of arms and legs, units standing switched off in their recharging bays, and the key cage in the corner. The torsos and limbs are the robots' own bodies, taken apart by the game, not separate models. Each area has a wall weapon, and floor left clear for the stations that come in Stage 4.

**Only what can be seen is drawn.** The game keeps a tiny map of which areas are joined by open doors. An area you could not possibly see (behind a closed door) is not drawn and its lamps are not lit. That is most of why six rooms cost little more than one.

**Lights are shared.** A graphics card can only afford a couple of dozen lights at once, and the facility has over a hundred lamps. So the game keeps a fixed pool of 22 lights and lends them to whichever lamps matter most from where you are standing, fading one out and the next in as you walk. A few of them cast real shadows; which ones is chosen the same way.

**Every room closes itself.** Because a room behind a shut door is not drawn, each room has to be sealed by surfaces of its own. Two rooms that share a wall cannot share one *wall object*: the room that borrowed its neighbour's would have a hole in it whenever the neighbour was not being drawn, and the night sky would show through. So where two rooms meet, each has its own facing on its own side, and the door frames belong to the doors (which are always drawn), not to either room. An automated check looks from inside every room toward every other, through that room's own walls only, and fails if any line of sight gets out.

**Where robots come in.** There are thirteen entrances: five they walk through (the main breach, the loading dock's two open truck bays, the lab's assembly-line hatch, a hole in the power room wall) and eight ceiling vents they drop out of. Robots only use entrances that connect to where you are, and favour the area you are in, so the fight follows you. In the first two rounds, with no doors bought, that means the one bright doorway in front of you, which is how the game teaches where to look.

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

**Jumping.** Space jumps about 80 centimetres. What it does not do is put you on top of a barrel, a crate or a barrier: anything taller than a step stays solid to you however high your feet are. The reason is in "Nowhere to hide" below.

## How the sound works

All sounds are real recordings from free libraries. Each gunshot blends two microphone positions from a real recording, a close one for the crack and a distant one for the body, and the game adds a short low thump underneath. Four slightly different versions are shuffled with small random pitch changes so automatic fire never sounds like one sample repeating.

Sounds that come from somewhere in the room (robot footsteps, impacts, casings hitting the floor, a door grinding open) are placed in 3D by the browser's audio system, so with headphones you can hear which side a robot is on. Everything is fed into a simulated echo of a hard concrete room, which is what makes the gunfire ring.

## Where the assets come from, and why the licenses are safe

Almost nothing in the game was drawn or recorded for it. The exceptions are made by the game's own code: the robot's body, the carbine's sight, the signs, the monitor screens and the rack lights. Everything else is free, openly licensed material, and each item is tracked from download to credit:

- A single list (the asset manifest) names every source and its license.
- A script downloads them and another set converts them into small game files: textures to WebP, 3D models to compressed GLB, sounds to MP3. The whole game is about 17 MB, and the two areas added after Stage 3 did not change that: they are built from models and textures already in the game, and from shapes made in code (the containers, the truck, the assembly arms).
- `CREDITS.md` and the in-game credits screen are generated from that same list, so they cannot fall out of date.
- An automated check fails if any shipped file does not trace back to a credited source, if the credits disagree with the list of pages the models were downloaded from, or if a raw download ends up in the repository.

Only public-domain (CC0) and attribution (CC-BY) material is used, plus the Mixamo skeleton and movements. Mixamo's original files are never redistributed, and its character model is not in the game at all; what ships is one converted file holding a skeleton and how it moves.

## How I know it works without playing it

The code was written by an AI agent that cannot hold a mouse, so the project carries its own proof. It comes in several kinds, and the interesting part is what each one caught that the others could not.

- **Unit tests** check the rule modules in isolation, with no graphics: how rounds grow, what every kind of kill pays, what every purchase does to your scrap and your two weapon slots, which areas connect when which doors are open, which entrance a robot may use when some are being watched, every step of the mission in every order the keys can be found, how stamina drains and returns, fire rate at different frame rates, robot decisions, path-finding, collision, and how the player's speed builds up.

- **An end-to-end test** opens the finished game in an invisible browser and drives it through hidden debug controls with time stepped by hand, so every result is exact. It makes every kind of purchase and checks what each one charged, sends a robot through each of the thirteen entrances and waits for it to reach the player in each of the six areas, goes down without god mode, and restarts three times in a row looking for leftover robots, timers still running, or one click firing twice. It also measures the picture itself: equally bright at every quality level, shadows not solid black, the muzzle flash over in an instant.

- **A whole mission, scripted.** The same test plays the mission from the first breaker to HUMANITY SAVED: it stands where a player would stand and presses F at each step, holds the uplink for its sixty seconds (and walks away for ten of them to check the clock stops), shoots the Custodian and the Proxy until they are destroyed, pulls the switch, checks every robot has gone down, then fights on through three more rounds. It also tries each step too early and checks that nothing happens.

- **An autopilot** (the 0 key in debug mode) plays the game by itself: it backs away from what is close, shoots what is nearest, reloads, and shops. It comes in four characters. The "expert" never misses and is there to prove the game can be played. The "first-timer" is a rough model of someone new to this kind of game: slow to notice a robot, shaky, aims at the body, backs away late, runs when hurt. The "skilled" player is quick but not instant, on target most of the time, sprints clear to reload, keeps both guns loaded and topped up, and gets ready before starting a fight. The "regular" is the one the mission is now paced for. The first real person to finish the mission said the skilled model was stronger than they were and that a human is closer to the first-timer, so the regular has nearly the first-timer's hands (a little quicker and steadier, still aiming at the body three shots in four) and the habits of someone on their fourth or fifth attempt: it reloads in the lulls, brings the good gun to a fight, breaks out of a crowd, and does not back into the yards the robots walk in from. Any of them can also be told to play the mission, following the objective tracker as a person would.

- **Whole runs, played many times.** Two tools use those characters to answer questions about difficulty, without drawing anything (so a fifteen-minute run takes about twenty seconds). `npm run balance` plays ordinary rounds and reports the round each run ended in. `npm run mission` plays the whole mission with no god mode and reports when each step was reached, in what round, and how each run ended. They are models, not people: they show whether the numbers are in the right place, not how the game feels.

- **Checks that look at the building itself.** Some bugs are in the map, not the rules, and were found by eye first and then turned into checks so they cannot come back: every room is sealed by its own walls; nothing stands across any doorway (a rail along one wall once carried straight on across four openings); there is nowhere a player can stand that no robot can reach (see "Nowhere to hide" below); every way in is joined to every room on the map the robots steer by (a parked cart once cut the loading dock off, and every robot sent that way stood against a wall); the places robots walk in from cannot be seen from indoors; a robot in the darkest corner still stands out from what is behind it; and every door, the core's included, is opened with F and walked through on foot at every quality level, with the room beyond measured to make sure it is lit.

- **Real input.** The debug controls press the game's buttons from the inside, which cannot notice a key that is wired to nothing, or a menu button that fails to capture the mouse. So the last part of the test uses the real thing: real clicks on Play, Resume and Play Again with the browser really capturing and releasing the mouse, and every key on the controls list really pressed. This found the sprint bug described above, and that choosing "Auto" quality after trying another level did nothing. Finally the browser's processor is slowed sixteen times over to imitate a weak computer, and the test waits for the game to notice and lower its own quality.

Alongside these, **a screenshot script** re-stages the same moments every time so any change can be compared with the approved look, and **a performance report** measures frame rate at each quality level, the download size, and smoothness: not the average frame, which can hide stutter, but the slowest frames. That report is how the stalling monitors were found; the average had looked fine. It measures the heaviest moment two ways (a full horde of ordinary robots, and the same horde as ARGUS sends it, with specials, shielding and plates), and it puts each new kind of robot in front of the camera for the first time in a fresh page to see whether the picture stalls when a thing is first drawn. That second scene earned its keep the day it was added: it showed that each plate was six separate things to draw and each shield four, and they were merged into one apiece.

The same day's digging answered an older question, which was where the occasional single slow frame came from. The game was throwing away about 190 MB of short-lived memory every second in a heavy fight, and the browser has to stop now and then to clear that up. Nearly all of it came from about fourteen small panes of glass on lamps, cameras and fire extinguishers. The drawing library draws a see-through, two-sided surface in two goes, and each go made it choose that surface's shader afresh and hand every light in the building to the graphics card again. Drawing them in one go looks the same, and the heaviest scene went from 188 frames a second to 229. The lesson is the one the stalling monitors taught: measure the thing itself (here, memory), not only the frame rate it eventually shows up in.

## Nowhere to hide

The first real person to play the mission through finished it by standing in a spot by some barrels where no robot could hit them. An automatic check for exactly that had existed since Stage 1 and had passed every time. It was looking too coarsely, and only at the floor. It studied the floor plan in 15 cm squares. There turned out to be two ways into the corner among those barrels, and it saw neither: a jump, which could put you on top of anything up to waist height, and a gap between two of the barrels that was only just as wide as you are, which falls between squares that size.

Four things changed.

- **Jumping no longer gets you onto or over anything taller than a step.** Solid things are tested against the ground you last stood on, not against where a jump has lifted your feet to. Space still jumps; it just does not open up places the robots cannot follow.
- **A bomber's blast is stopped by walls, not by whatever is lying on the floor.** It used to need a clear line from where it went off to your eyes, and a barrier or a barrel on the floor between you was enough to break that line. It now also counts a line from above head height, so cover has to be taller than you are to be cover.
- **"As close as they can get" now means on your side of the wall.** A robot heading for someone it cannot quite reach makes for the nearest spot it can stand on. The nearest spot of all can be in the next room, half a metre away through the brickwork. That is how a whole final stand's worth of robots, the Proxy among them, came to be pressed against the wrong side of a wall while my test player stood untouched a pace away on the other side of it.
- **The check asks the question by standing everywhere.** It walks the whole map by the game's own rules of movement, a sample every 10 centimetres, for a body a little slimmer than yours (so that it goes through anything you could squeeze through): on the level, down any drop, up onto anything a step high, and on from there. That is about 147,000 places, on the floor and on top of things. At each it asks how far away the nearest spot is that a robot can stand on without a wall between, and fails if that is more than a robot's reach.

What it found: your corner among the barrels; **a second safe spot**, behind the security desk in the lobby's opposite corner, reached through a gap between a bin and the corner of the desk that a person can just squeeze through and a robot cannot (my regular test player had wandered into it in the middle of a final stand and stood there for half an hour of game time, which is how I learned the first version of this check, at 20 cm, was still too coarse); a strip behind a crate in the power room; and a slot beside a container in the new loading dock. All four are closed, and told that the player can still jump onto things it finds the barrel corner again, and a way out of the building over the dock's barriers besides.

Then, because a map can be right on paper and wrong in play, real robots are sent: one to each of the sixteen most awkward places the check can find, from five metres off, and each has to land a blow. A bomber is set off on the far side of a low barrier (it must hurt) and on the far side of a wall (it must not). And a player is run at the barrels from five sides, jumping all the way.

## How the difficulty was set

The spec gave three targets: a first-time player should usually go down between rounds 5 and 8; a focused player should finish the mission in 15 to 20 minutes, around round 10 to 12; and the final stand should be hard but winnable. (You have changed the first two since: see the end of this section.) Nobody had fought the mission without god mode until the two models did.

The first thing they showed was a flaw in the models themselves. At arm's length they nearly stopped shooting (their aim was held to a standard meant for distant targets, every change of target restarted their reaction time, and they kept using the strike long after it had stopped destroying a robot in one blow). That made every character go down in the same round for an artificial reason, and hid the real picture. Those were fixed first, and several more habits a real player does not have were fixed as they showed up: letting guns run dry with thousands of scrap in the bank, standing at a door that had just been opened, topping up a full magazine with robots three steps away, backing into corners.

The real picture was that the game got harder too steeply after round 6, so skill bought almost nothing: the first-timer went down in round 6 and a never-missing expert in round 9. The rounds were also twice too short: round 10 came at six and a half minutes. So:

- **Rounds are longer**: more robots, arriving a little slower, with a 15-second lull.
- **The climb after round 6 is gentler**: toughness nearly levels off, arrivals stop speeding up at round 9, and no more than half the horde runs (the runners still reach just under sprint speed in the late rounds, as you asked for after Stage 1).
- **The uplink's ring is wider** (it sits in a corner of the hall, under a ceiling vent) and its wave grows with the round.
- **The final stand's horde walks.** In a room the size of the core, a crowd of sprinters leaves nothing to do but go down; the Proxy is there to be the thing that hunts.
- **The Custodian arrived with round 11**, which is what put the end of the mission at fifteen minutes and more. (Changed since: see below.)

**Then a real person played it**, finished the mission only because of the spot by the barrels, and said so: the skilled model is stronger than a real player, and a human is closer to the first-timer. Three things followed.

- **A third model, the "regular"**, described above, and the mission is now paced for it, not for the skilled one.
- **What ends a run for an ordinary player is being boxed in, not being out-shot.** Reading the last seconds of dozens of the regular model's runs showed the same thing again and again: a pack arrives, and from full health to down took a second and a half. So a blow now takes a fifth of your health (it was three tenths), a crowd cannot land them faster than one every 0.6 seconds (it was 0.45), and health starts coming back after three seconds (it was four). The big robots hit less hard as well: the heavy 40, the Custodian 28, the Proxy 36 (they were 50, 34 and 45).
- **The mission's own fights are sized for someone holding ground.** While the uplink is being held no more than seven robots are on the map at once. The final stand sends nine at a time (it was twelve), a little more slowly, and the Proxy has eight times an ordinary robot's health (it was ten); the Custodian has five times (it was six). And the Custodian comes for the last key, with the round after the other two are held and never before round 8, so nobody waits three rounds for it.

The ordinary rounds themselves were left alone: how many robots a round sends, how tough and how fast they are. Even so, making a crowd survivable moved the first-timer model: fighting the ordinary rounds only, it now goes down in round 9 where it went down in round 7 (the median of 16 runs; 12 of them ended in rounds 7 to 10). That was over the top of the spec's "usually between rounds 5 and 8", so it was put to you. You said that about round 9 is fine and that, after playing it, easier is the right direction. The target in SPEC.md now reads "around round 9 (between rounds 7 and 10)", and **nothing is to be made harder again without asking you first**.

After it, the two models nearest to a real person (the first-timer and the regular) each finish about one mission in four, where neither finished any; the skilled model finishes nine in ten. A finished mission takes ten to fifteen minutes and ends in round 8 or 9, which is the other target you changed: the mission's length follows how you play, and a fast one ending before round 10 is fine.

The numbers the models produce now are in PROGRESS.md, with how many runs each is based on. They will move again in Stage 4, when the player gets boosts, a better weapon and grenades, and the same tools will measure them again. If that leaves the game too easy, that is a question for you and not something to be tuned back unasked.

## Still to come

These parts are designed but not built yet. This document will grow as they are.

- **The full economy** (Stage 4): shutters to repair, boost stations, a prototype crate, an overclock bench, pickups, swarm rounds, grenades.
