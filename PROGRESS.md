# Progress

The full specification is in [SPEC.md](SPEC.md). This file records what has been built so far, the design decisions made along the way, and what is still rough. It is updated at the end of every stage.

## Where things stand

| Stage | What | Status |
| --- | --- | --- |
| 0 | The look test: one room, one robot, one rifle | **Approved** (after two rounds of feedback, recorded below) |
| 1 | Core loop: whole map, rounds, scrap, weapons, HUD, restart, debug mode | **Played; nine items of feedback, all done** (recorded below) |
| 2 | The mission: power, three keys, the Custodian, the uplink, the final stand, HUMANITY SAVED, endless rounds, the objective tracker | **Played; four items of feedback, all done** (recorded below) |
| 3 | ARGUS: specials, tracking, counters, banner, remarks, end-of-run report | **Played; eight items of feedback, all done, and approved from the screenshots** (recorded below). The map is six areas. |
| 4 | Full economy: stations, shutters, pickups, grenades, swarm rounds, the special weapon, settings and how-to-play screens, the phone message | **Approved from the screenshots; three answers and one fix (jumping), all done** (recorded below) |
| 5 | Polish: no new features. Feel, hints, the fail-safe, the Turncoat, the truck and the wall, speed, a public link's needs, the final documents | **Built. Waiting for you to play it.** |

The approved look lives in `media/look-target/` and is never overwritten. Stage 5's pictures are in `media/stage-5/` (76 of them: every earlier view re-taken on this build as 01 to 64, and this stage's as 65 to 73) and are re-made with `npm run build` then `npm run shots`. Stage 4's and Stage 3's are kept in `media/stage-4/` and `media/stage-3/` as they were when you approved them. Stage 2's and Stage 1's are kept in `media/stage-2/` and `media/stage-1/` as they were when you played them.

## Before Stage 5: your answers to the Stage 4 feedback

You approved Stage 4 from the screenshots (the four Boost Stations, the Overclock Bench, the Prototype Crate, the pickups and timers, the shutters, swarm rounds, grenades, the settings and how-to-play screens, the phone message) and the design calls listed for it. Your three answers, and what was done about each:

- **The final stand: "leave it as it is. I'd rather people reach the ending than lose nine minutes in at the last step."** Left alone.
- **The first robot: "shorten it in round 1 only. Start the entrance shutter already damaged in round 1 so the first robot is indoors about 8 seconds in. Leave every later round alone."** Done: the main entrance's shutter starts a run one blow from giving (`SHUTTERS.entranceStart`). Measured over four starts, it is forced at 7.2 to 7.4 seconds and the first robot is inside the lobby at 8.4 to 8.7. The other four shutters start sound, and this one is sound again once it has been repaired.
- **The Custodian: "leave it as it is."** Left alone.

Then the one fix before the polish (jumping), and Stage 5 with your list on top of the spec's. All of it is below. `SPEC.md` carries the three changes as marked notes, like the earlier ones.

## The jumping fix

**What you asked for:** to jump over low objects (the concrete barriers, low crates, toolboxes, the rails around the lab's assembly cell, and anything similar up to about waist height), clearing them and landing on the far side; tall things to stay unclimbable; robots not to need to jump; and the safe spots not to come back: wherever you can land or stand, robots must still reach and hit you, and a bomber's blast must reach you too.

**The rule now.** Anything whose top is no more than **one metre** above the floor can be jumped onto or over. Anything taller is solid however high your feet are, even from the top of something low, so nothing can be climbed in stages. It is one number, `PLAYER.climb` in `src/config.ts`.

### What can be jumped, and what cannot

**Can be jumped onto or over** (heights are the tops, from the floor):

- **The concrete barriers** (0.82 m): the two in the lobby, and the ones out in the yard.
- **A drum standing by itself** (0.87 or 0.93 m, by the kind of drum), and **a drum lying on its side** (about 0.6 m).
- **Wooden crates** (0.46 m), and **a crate stacked on a crate** (0.92 m).
- **Cardboard boxes** (0.34 m).
- **Desks** (0.79 m): the security desk in the lobby and the two in the lab.
- **Tool chests** (0.65 m): your "toolboxes".
- **The small things**: stools (0.45 m), fire extinguishers standing on the floor (0.66 m), the tipped-over chair by the security desk (0.59 m), the bin (0.91 m).
- **The Prototype Crate** (0.60 m).
- **The fence round the lab's assembly cell** (1.00 m), on every side, and **the trolley** inside it (0.56 m).

**Cannot** (taller than a metre, and solid at any height):

- **Drums stacked two high** (1.86 m): the back of the two corner heaps.
- **The wall cabinets** (1.12 m), **the hand trucks** (1.40 m), **the storage cart** (1.38 m), **the standing floodlight** (1.80 m).
- **The control post of the lab's cell** (1.25 m), and the jig and the three arms inside the fence.
- **Server racks and shelving.**
- **The containers and the truck.**
- **Generators and transformers.**
- **The uplink console, the core's console, the key cage.**
- **The four Boost Stations and the Overclock Bench.** (The Prototype Crate, the sixth station, is on the first list.)
- **The window sills in the lobby** (1.15 m).

Two of those are low but carry something tall, so they are on the second list on purpose: the uplink console (a desk with a bank of screens standing on it) and the Overclock Bench (a bench with its arm working over it). Standing "in" either would have put you inside what is on top of it.

**How it feels.** The jump is the height it always was (about 83 cm; a step's worth of tucking the feet up does the rest). Walking or sprinting at a barrier and jumping takes you over it. Jumping from a standstill while pressed against it works too: you keep pushing at it and go over the moment your feet are high enough, where before you would have risen and dropped back where you stood. A press of Space a moment before landing, or a moment after walking off an edge, still counts. And the view eases up onto something instead of snapping.

### Why there are still no safe spots

Giving the jump back the simple way would have given the barrel corner back with it. So the map changed, and the check that guards it now covers everywhere a jump can put you.

- **No invisible blocks over heaps of low things.** There were six, and each was exactly the knee-high barrier you could not get over. Every low thing is now solid by itself.
- **The back of a heap is tall.** A robot strikes from 1.45 metres, so nothing low may be deeper than that from the open floor. In the two corners where drums stood in a heap (the lobby's, which is the corner you hid in, and the dock's), the drums at the back are now stacked two high and the ones in front can be climbed. The lobby's other corner drum was moved tight into its corner, and the drum lying in the entry corridor moved clear of the nook it made.
- **The lab's assembly cell has a real fence, with a gateway on two sides.** It was one solid block. Now you can hop its waist-high rails, and the robots walk round to a gateway (the middle third of its west side and of its east side) and in after you. What stands inside (the jig, the three arms) is solid; the trolley in the corner is low enough to stand on. The arms were moved a little toward the corners so that a robot can get right round the jig.
- **Robots go round what you have jumped.** Close in, a robot used to walk straight at you, which was right while nothing could stand between you. Now it only does that if the way is clear; otherwise it keeps to its map and comes round. If you are within its reach across a barrier or a rail, it hits you across it.
- **Nobody jumps over a robot.** Robots are solid to you at any height. (They were only solid below 1.2 metres, which never mattered until a crate could be a springboard.)

**The check.** "Standing everywhere" now stands the player on the floor, on top of every low thing, and on the floor inside the fence: **152,874 places**, a sample every 10 cm across the whole map, for a body a little slimmer than yours. None is further from where a robot can stand than a robot reaches. Then real robots and bombers are sent:

- to each of the sixteen most awkward places it found (most are up on something: the trolley in the cell, the stacked crates, a desk, a drum), from five metres off: all sixteen land a blow;
- from each of the four sides of the fence to four places inside it: sixteen out of sixteen;
- a bomber beside a player standing on the lobby's desk, on a drum in the dock corner, inside the fence, and on the trolley inside the fence: it hurts them every time.

And the jump itself is tried in the game: eleven jumps at the lobby's barrier (all end on the far side; without the jump it stops you), three at a drum (all end standing on it), nine at the fence (all end inside) and one back out; then four tries each at eight tall things (a server rack, a wall cabinet, the control post, a container, the truck, the uplink console, the Overclock Bench, the stacked drums) and at the cart from the top of the crates beside it. In all of them the player never stood higher than a metre. The yard's barriers were sprinted at and jumped at from nine places: there is no way out of the yard over them. And the lobby's drum corner, the one you hid in, was run and jumped at ten times from every side: the player got onto the front drums and no further, and was never out of a robot's reach.

To be sure the check would notice, it is also asked what would be out of reach if you could climb things 2.2 metres high. It reports the tops of the power room's generators.

### Hopping back and forth

You asked for the test players to show that hopping over a barrier does not dodge the horde for ever. The mission's test players do not jump, so this has a tool of its own, `npm run hop`. It plays a **hopper**: someone who never fires a shot and does nothing but stand beside something low until the robots are nearly on them, jump it, and wait on the far side to do it again. Seconds until the hopper went down, five tries each (80 tries in all), beside someone who just stands still:

| Seconds until down (hopping; standing still) | Round 3 | Round 6 | Round 8 | Round 10 |
| --- | --- | --- | --- | --- |
| The concrete barrier in the lobby | 13 to 29; 10 to 12 | 11 to 22; 9 to 11 | 11 to 14; 8 to 11 | 8 to 13; 9 to 11 |
| The fence round the lab's assembly cell | 43 to 131; 11 to 15 | 35 to 51; 7 to 13 | 23 to 56; 8 to 11 | 13 to 27; 8 to 10 |
| A desk in the lab (onto it and off again) | 10 to 16; 10 to 16 | 7 to 11; 8 to 13 | 7 to 9; 7 to 10 | 7 to 10; 8 to 11 |
| The drums in the dock corner (onto them and off) | 9 to 15; 10 to 15 | 8 to 16; 8 to 12 | 9 to 15; 8 to 14 | 7 to 11; 10 to 12 |

**No try outlasted the horde.** The longest any hopper lasted was 131 seconds (the fence round the lab's assembly cell, round 3), and by round 10 the best of them lasted 27. The fence is the best place to try it, because the robots have the furthest to walk round to a gateway. In round 3, when there are fourteen of them and they walk, the hopper kept it up for between three quarters of a minute and a little over two minutes before they came at it from both sides; by round 6 for about forty seconds, by round 10 for about twenty. The concrete barrier buys a few seconds over standing still (up to twenty in round 3, none to speak of by round 10). Climbing onto a desk or the drums buys nothing: a robot strikes someone up there exactly as it does on the floor. In every one of the tries the hopper went down. One caution: this is a model that hops in one place. A person can hop the fence, run, and hop back in somewhere else, and that I could not play.

### Difficulty, measured again

The jump could not make the game harder, but the change to how robots close in could have, and you asked for nothing to be made harder. So the test players were run again, twice: once on the build as it stood when the jumping fix went in, and again on the finished build. Nothing was tuned after either. The table is the finished build.

| | Skilled (32 missions) | First-timer (60 missions, 16 runs of ordinary rounds) | Regular (60 missions, 16 runs of ordinary rounds) |
| --- | --- | --- | --- |
| Finished the mission | **29 of 32**; was 28 | **39 of 60**; was 31 | **44 of 60**; was 40 |
| Mission time (median) | 8:44; was 9:18 | 9:03; was 8:57 | 8:51; was 9:06 |
| Won the final stand | 29 of 29; was 28 of 28 | 39 of 41; was 31 of 37 | 44 of 45; was 40 of 43 |
| Ordinary rounds: went down in | not run | round 9 (median); 9 of 16 in rounds 7 to 10; earliest 6, latest 12; was round 9 | round 11 (median); 5 of 16 in rounds 7 to 10; earliest 4, latest 14; was round 9 |

The first batch, on the build with the jumping fix alone, gave: skilled 29 of 32; first-timer 37 of 60 missions, and round 10 in ordinary rounds; regular 37 of 60, and round 8.5. Taking the two batches together, the first-timer finished 76 missions in 120 where it finished 31 in 60 at the end of Stage 4, and the regular 81 in 120 where it finished 40 in 60.

Read with care: batches of this size wander a good deal (at the end of Stage 3, three batches of one model on identical rules gave 75%, 33% and 47%). What they say is that the game is **no harder**. If anything the first-timer does a little better, and the likely reason is the fail-safe: on the finished build it brought the first-timer back in 16 of its 60 missions and the regular in 6, and getting up now throws the robots back a pace, which is the gap it was always meant to give. Most lost runs still end in round 6 with two keys, waiting for the Custodian, which you chose to leave. The test players do not jump, so none of this measures the jump itself; that is what the hopper above is for.

## Stage 5: what was polished

Polish only: apart from the jumping fix, nothing here is a new feature, and nothing was made harder.

**The Turncoat (your pictures 54 to 56).** It kept its model and lost everything that made it a toy. The shell is dark worn steel; the brass rings are blackened steel. Bolted onto it are a steel frame along both flanks, a finned shroud round the barrel, a control box with a circuit board for a lid and a label (XM-0 PROTOTYPE, SITE 04 LAB, UNIT 04, over a strip of hazard tape), two capacitors, a cage over the cell, a guard round the trigger, and wiring: two cables forward to the muzzle, a red and a yellow wire down from the cell, a blue one back to the grip. The only things that glow are the cell, a row of lamps and a charge gauge on the box, and a ring in the muzzle, all the cold blue of the beam. The cartoon star at the muzzle is gone: what shows there now is a discharge, a ring with forked arcs off it and a thin lance of light down the line of the shot. **In a full horde:** fired into twenty-four robots of round 8 in six places (the lobby, two places in the server hall, beside the lab's fence, among the dock's containers, between the generators), the robot it turned spent its ten seconds fighting every time: six or seven blows, each destroying a robot, and then it burnt out, so seven or eight robots a shot. It never wandered off into the furniture: in a crowd there is always a robot in arm's reach. (With a choice, it now prefers a robot it can walk straight at to a nearer one behind a rack.)

**The first minute without reading.** One short hint at a time during the first rounds, above the middle of the bottom of the screen, in the HUD's own lettering: `W A S D  MOVE`, `LEFT CLICK  FIRE`, `HOLD RIGHT CLICK  AIM`, `SPACE  JUMP OVER LOW THINGS`, `FOLLOW THE MARKER TO YOUR OBJECTIVE`, and `F  BUY: WALK UP TO A WEAPON ON THE WALL`. Each turns green with a tick and goes the moment you have done it. Something you do before its hint comes up is never asked for. The last one waits until you have the scrap for the gun on the wall in front of you (750), so it never tells you to buy what you cannot afford. What you have done is remembered in your browser, so a second run does not teach you again; Settings has a switch that turns the hints off, or starts them again from the first. How to Play now opens with a five-line **Quick start**.

**The frame-rate counter is hidden** unless you ask for it in Settings. Your own browser had remembered the old "on", so the setting has a new name inside and the old memory is ignored: it will be off for you too. (In debug mode it always shows; it is one of the debug tools.)

**The fail-safe is a moment.** I had not looked at it, and when I did there was nothing to see: a flash and a notice, in the same instant as the blow. Now, when the blow lands, you go **down**: the view falls to the floor and keels over, the colour drains out of the picture and the dark closes in from its edges, every sound goes dull, a red line runs flat across the view under the word DOWN, and for a little over a second the world runs at a third of its speed while nothing you press does anything (and nothing can hurt you). Then it fires: the flat line beats, the picture floods violet, **FAILSAFE ENGAGED, BACK ON YOUR FEET**, the view comes up, and every robot within five metres is rocked and thrown back a pace. The violet stays round the edge of the view for the three seconds in which nothing can hurt you. Pictures 67 and 68.

**Speed.** The six stations were 114 separate things to draw. The part of each that never moves is now built into the room it stands in, by the room's own builder, and what lights up (a sign and a card, the lamps) is two shapes a station where it was seven: **33 shapes** between the six.

That was the job you set. Then I counted what a frame actually draws, and found that the rest of this stage's work had been adding pieces while that took them away: the truck I rebuilt had eleven lamp lenses drawn one at a time, four layers of stains of its own, and ten tyres that were drawn again for every lamp that casts a shadow; and the lettering and little lamps on the server hall's new wall each used a setting nothing else in the hall uses, which makes each one a layer of its own. All of that is merged too now (the lenses are five shapes, the stains two layers, the tyres are drawn once, the wall borrows the settings of the hall's other lettering), and none of it changes a picture: I compared the truck and the wall before and after, side by side.

**What that bought, and what it did not.** A frame of the server hall with a full horde standing in it now draws 686 separate things on High. At the end of Stage 4 it drew 728, and before Stage 4 637. So a little under half of what Stage 4 added is gone; the rest is what Stage 4 put into the game and the game still has (six stations with their lit signs and lamps, five shutters that move), plus this stage's cooling units and wall lamps. **I cannot show you the frame rate coming back, and I am not going to claim it.** Measured as fairly as I know how (a scene that stands still, the three builds in turn, 6 rounds, a different one first each time), the build you approved at the end of Stage 4 came out 7% slower than the build from before it, and this build 6% slower. One build's own readings of the same thing lay 22% apart from round to round, so the gap between those two figures means nothing. Three things I can say. The 12% I reported last time was too high: it came from one pair of runs of a fight that is never the same twice, and I should have measured it this way then. The game does less work in a frame than it did when you approved Stage 4. And it is not slow here: in its heaviest moment it runs at about 191 frames a second on High on this computer, which has a fast desktop graphics card. (The spec's target is a smooth 60 on a laptop with a dedicated card. I have no such laptop to try it on, which is where a few per cent would matter most.) The tables are under the checks, with a profile of where a frame's time goes.

**Two stutters, found and removed.** I added the fail-safe's moment and a first-minute hint to the list of things whose first appearance is timed, and the first row was bad: the picture stopped for 73 thousandths of a second when the player went down. Taking it apart showed two things. Most of it was not the fail-safe at all. It was **the first blow a player ever takes**: the red wedge that shows where the blow came from is blurred, and the first time it was drawn the picture stopped for 67 ms. That has been in the game since Stage 1, in every run anyone has played; my speed tests never saw it because their player cannot be hurt. The rest was the fail-safe's own lettering (24 ms). Both are now drawn once, too faint to see, while the start screen is up, the way ARGUS's banner has been since Stage 3. Timed again as a visitor meets them: the first blow 5 ms, going down 5 ms.

**The truck (picture 39).** Rebuilt from shaped parts in a file of its own: a cab with every corner rounded, in worn green paint, with a raked windscreen in its rubber, a visor and wipers; a grille set into the front between two round lamps in housings; a steel bumper; doors with seams, handles, hinges and SITE 04 on them; mirrors on arms; the cab's skirts coming down in front of the front wheel and behind it, with a step let into the front one; and **real tyres** (a photographed one from the same free library as the other props) on steel rims with hubs and nuts. Its headlamps still cut across the floor. Pictures 39, 71 and 72.

**The server hall's west wall (picture 46).** It has what a wall like that has in a room that must be kept cold: four cooling units up out of reach (a photographed model), fed from two header pipes that run its length; drain lines and the stains under them; conduit and junction boxes at shoulder height; COOLING LOOP 02, an arrow to ROWS A - E, a gas-suppression notice, an emergency power-off point by the dock's shutter, a lit panel giving the hall's temperature; and two cold wall lamps that put a pool of light on it. Nothing on it is solid, and nothing below head height stands more than a hand's width off the wall: the walkway is as clear as it was. Pictures 46 and 73.

**Everything a public link needs.**

- **Page title**: "HUMAN OVERRIDE · Don't let the AI win", and a description that says what it is.
- **Link preview**: the tags LinkedIn, Slack and the rest read (title, description, picture), and the picture itself, `public/social-preview.jpg`, 1200 x 630: the game's own lobby with a horde coming on under the title. `npm run social` re-takes it.
- **Favicon**: the red eye, as a file of its own, with a PNG for browsers that want one and an icon for a phone's home screen.
- **No debug text or test leftovers.** A visitor's page has none of the test tools on it at all (they only exist with `?debug=1` in the address); the counter is hidden; an end-to-end check loads the page as a visitor does and reads everything on the start screen and in play for the words. The picture of ARGUS's profile card no longer shows the local test address (the card prints the page's own address, which in the pictures was `127.0.0.1`).
- **One thing I could not finish for you: the address.** The sites that show a link preview want the picture's full address, and I do not know where the game will live. So there is `site-address.txt`: when you know the address, tell me (or put it on a line in that file) and the next build writes it into the page. Until then the game works anywhere and only the preview picture is missing from a shared link.

**The music builds through a round.** The spec asks for it, and it had been listed as a rough edge since Stage 1: the bed was the same at the first robot as at the last. Now it is low and muffled in the lull, steps up when a round starts, rises and opens up as the round is fought, and is at its full level in the final stand. It never goes above the level it always played at.

**Smaller things.** The strip listing every control (shown at the start of a run to a player who has the hints off) says SPACE jump, wraps on a narrow screen instead of running under the health bar and the ammunition count, and keeps real time. The start screen's one-line note no longer runs on over the lit scene. The controls list says what Space is for. A setting that nothing had used since Stage 0 (spare ammunition that never ran out) is gone from the weapon rules.

### Found on the way, and fixed

- **A robot close to you with a barrier in between pressed against the barrier for ever.** It had never mattered: nothing could stand between you. Found when the fence became something you could hop, before it was ever played. (Robots go round now: see above.)
- **You could have jumped off a crate over a robot's head.** Robots were only solid to you below 1.2 metres. Found by reading the movement code for what "standing on things" would change.
- **The strip of controls ran on the game's clock, not the wall's**, so in the frozen-time checks it vanished at once. It was the hints' own check that showed it. In play it made no difference; it is right now.
- **Getting up from the fail-safe, the robots were in your face.** They crowd in while you are down, and being rocked did not move them. The first picture of the moment was five visors filling the screen. They are thrown back a pace now.
- **The start screen's note ran over the bright part of the picture** at smaller window sizes, where it could not be read.
- **The fail-safe's throw could put a robot through a shut door, on a computer slow enough.** Found by reading my own change again before committing it, not by a check. A robot is thrown back at seven metres a second. In an ordinary frame that is a few centimetres. But in a frame a tenth of a second long (the longest the game allows: a frame rate of ten, or one bad stutter at the wrong moment) it is 70 centimetres in one step, and a shut door is 26 centimetres thick. I tried it on the build as it stood: two robots touching the power room's shut door, the player a pace away, the fail-safe fired in frames that long. Both robots ended up inside the power room, behind its shut door. At sixty and at twenty frames a second it did not happen. A thrown robot is now moved in steps shorter than a robot is wide, however long the frame, and the same trial is a check: neither robot gets past the face of the door.
- **The hints check was wrong twice, and neither time was it the game.** The first full run of everything was 214 of 215: the run the hints check started fired one shot by itself in its first instant, so FIRE was never hinted. The checks just before it press the start screen's real buttons with the real mouse, and the test page holds the mouse as "captured" all the time (a visitor's page only does while playing), so each of those clicks also counted as a pull of the trigger, waiting for the next moment of play. A visitor cannot do this: on their page a click on a menu button is not a pull of the trigger at all. I did not take that on trust: the part of the test that clicks the real PLAY button on a page with the mouse really captured now also checks that the click which starts a run fires nothing (0 shots, 12 rounds still in the sidearm). Then, run by itself on a quiet computer, the same check failed the other way: it was waiting 1.4 seconds for a hint that takes 1.9 to come, and had only been passing because a busy computer made its waits longer. It keeps real time now, and passes alone three times running and in the full run.
- **The first blow a player ever took stopped the picture for 67 ms, and had since Stage 1.** See "Two stutters" above: found by timing the fail-safe's first appearance, fixed by drawing the damage wedge once ahead of time.
- **My own polish had been adding pieces to draw while the stations' merge took them away.** See "Speed" above: found by counting the pieces in a frame, when the frame rates I was measuring would not agree with themselves.
- **The 12% I reported after Stage 4 was too high, and the cause I gave for it was only part of the story.** It came from one pair of runs of a fight that is never the same twice. Measured properly this time, Stage 4 cost a few per cent, and what costs it is every separate thing in the scene, not the stations alone. See "Speed" above and the tables under the checks.
- **One of my new checks was wrong, not the game.** To prove the reach check has teeth I asked it what it would find if you could climb onto server racks, and it found nothing there: a row of racks is only a metre deep, so its top is within reach from the aisle. The generators are what it reports, and the check says so now.

## Design decisions made in Stage 5

Numbered on from Stage 4's (which ended at 152). None of these was asked as a question; each is mine to defend and yours to overrule.

153. **"About waist height" is one metre.** That takes in everything you named and what is like it (barriers 0.82 m, drums 0.87 to 0.93, the stacked crates 0.92, desks 0.79, the fence, which I built at exactly a metre), and leaves out the wall cabinets (1.12 m), the hand trucks, the cart and everything above. It is one number, `PLAYER.climb`.
154. **Nothing taller than that is ever stood on, from anywhere.** A tall thing is solid at any height, not just from the floor. Without that, a crate would be a step up to a cart, the cart a step up to a container. It also means the check has an exact edge to test.
155. **No invisible blocks over low things; the back of a heap is made tall instead.** The two corner heaps of drums look different because of it: the back pair are stacked two high. I think they look better (a drum store, with some height to it), but it is a change to two corners you had approved, so it is here.
156. **The lab's cell has gateways, and the robots use them.** You asked for the rails to be jumpable and for no safe spot inside. A fence all the way round would have been one: the middle of the cell is further from the fence than a robot reaches. Two gateways (west and east) let them walk in, and put no dead end in the room. The gates themselves are drawn swung back and left open.
157. **Two low things cannot be stood on, on purpose**: the uplink console and the Overclock Bench, because of what stands on them (a bank of screens; the arm). The Prototype Crate can be, though its lid opens under you; it is a low crate, and a low crate that could not be climbed would have been the complaint again.
158. **The jump is the same height. What changed is what it is allowed to do, and three small things about how it feels**: speed carried into a low thing is kept while you are in the air (so a jump from a standstill against a barrier goes over), a press a moment early or late still counts, and the view eases up onto things. Jumping higher would have reached more than waist height.
159. **Robots do not jump; they go round, and hit across.** As you said they need not. The change to them is the one thing in the fix that could have made the game harder, which is why the difficulty was measured again before anything else was built.
160. **The entrance starts round 1 one blow from giving.** Two blows left gave about nine and a half seconds; one gives eight and a half. It is `SHUTTERS.entranceStart`.
161. **The hints: which, in what order, and when they stop.** The six you listed, in the order a first minute needs them (move, fire, aim, jump, follow the marker, buy). Buying is last and waits for 750 scrap, the price of the gun on the wall in front of where you start, so it appears at the moment it can be acted on, which is usually in round 2. No hint appears after round 3: by then nobody is reading. A hint that is still up when its moment has passed is taken down unlearned and comes back next run.
162. **What you have done is remembered, per browser.** A returning player is not taught again, which matters for anyone who plays twice. The cost is that you will see each hint once: to see them again, switch "Show hints for new players" off and on in Settings (on starts them from the first).
163. **While there are hints to come, the old strip of controls stays away.** It listed ten controls at once at the start of every run. One thing at a time; a player with the hints off still gets it.
164. **The frame-rate counter's setting was renamed inside** so that browsers which had stored the old default (on) forget it. Otherwise it would have been "hidden by default" for everyone but you.
165. **The fail-safe's moment costs a second, and gives a little back.** You are down for 1.15 seconds with the world at 30% speed, and nothing can hurt you in it; the three seconds of cover start when you get up, where they used to start at the blow. And robots within five metres are thrown back about a metre as well as rocked. Both are slightly in the player's favour, and neither was measured separately.
166. **The Turncoat kept its model and its name.** Everything that read as another game's weapon was the finish and the bareness: pale paint, brass rings, a smooth bulb, a star at the muzzle. I did not change its shape, only what is bolted to it, because you said to keep the model. If the bulb still reads wrong to you under the frame, the next step would be a different model, which needs a download from you.
167. **The truck was rebuilt in code, not replaced with a model.** The free library the props come from has no truck (I looked through all 522 of its models), and the sites that do have one need an account, which is yours to say yes to. If you would rather have a downloaded one, tell me and I will give you the exact page to fetch. The tyres are a real model from that library.
168. **The west wall's theme is cooling**, because it is a server hall and the hall's temperature is a small piece of story (the panel reads 31.4 C: ARGUS is working the machines hard). Everything on it is flat to the wall or above head height, because the walkway beside it was cleared on purpose in the Stage 3 feedback.
169. **The link preview is a photograph of the game**, not a made-up poster: its own lobby, its own robots, the title in the game's own lettering.
170. **The page's address is a text file, not a guess.** I did not invent an address for the share tags or print one on the profile card in the pictures. `site-address.txt` is empty until you have one.
171. **The music's build is by loudness and tone, not by new music.** There is one bed. A second, busier layer would have been a new recording to find, credit and mix by measurement alone, at the very end; shaping the one that is there does what the spec asks.
172. **The pictures are in `media/stage-5/`**: the whole set re-taken on the final build (01 to 64), and 65 to 73 new. Stage 4's are kept as they were when you approved them.
173. **What I left alone because you said so**: the final stand, the Custodian's timing, and every later round's opening.
174. **The truck's tyres cast no shadows of their own.** They stand in the shadow of the truck. Drawn again for every lamp that casts a shadow, ten tyres were 36,000 triangles more in every frame of the dock. I put the truck's pictures from before and after side by side (front and side) and can find no difference; if the wheels look to you as if they float, it is one word in `src/world/dock/truck.ts`. The cooling units on the server hall's wall do still cast theirs: the shadows under them are most of what gives that wall its depth.
175. **Builds are compared in a scene that stands still, measured in turn, and the count of what a frame draws is the result I stand on.** That count is exact. The frame rate on this computer is not: the same build read 18% apart in two runs of the usual report a quarter of an hour apart, which is more than the 12% in question. So the frame rates are given beside the counts, as medians of six rounds, with how far apart one build's own readings lay, and I have not claimed more from them than they show.

## Checks run at the end of Stage 5

The spec asks for all six to pass before Stage 5 is called done. They do.

| Check | Result |
| --- | --- |
| 1. Type-check and production build | Pass, zero errors |
| 2. Unit tests | **258 of 258 pass** in 21 files. New in this stage (30 tests): what a jump clears and what it never does, and the reach check on a fence with and without its gateways and on a heap of drums with and without its back row stacked; the first-minute hints (their order, never hinting at what has been done, the marker measured from where the hint found the player, buying held back until there is scrap); the music's build; the page's share tags and the address file. One test went, with the unused setting it tested. |
| 3. Headless browser | **216 of 216 pass** against the production build served from a sub-folder address. What is new is listed below. |
| 4. Screenshots | 76 in `media/stage-5/`: the whole set re-taken on this build (01 to 64), and 65 to 73 new. Every one looked at, and 01 to 64 compared with the set you approved. What differs is what this stage changed: no frame-rate counter in the corner, the Turncoat in pictures 54 to 56, the truck in 38 and 39, the west wall in 46, the two corners of drums, the fence round the lab's cell, and a first-minute hint in none of them (the tool switches the hints off except for the two pictures that are of one). Five pictures were staged badly by my own tool the first time and were re-taken (the game was right in each): a strip of controls that a visitor who has changed nothing never sees lay across most of the set; ARGUS's Proxy stood with its arm across the kill switch; the shutter under attack showed no attack, because the entrance now starts a blow from giving; the phone message carried the local test address; and the first-hint picture showed eleven rounds in the sidearm. |
| 5. Performance | See below. |
| 6. Credits | Pass: 199 shipped asset files all trace to credited sources (two more than at the end of Stage 4: the tyre and the cooling unit, both CC0 from Poly Haven); the credits match `links.txt`; no file tracked by git is a raw download. |

**New in the end-to-end test** (19 checks, making 216):

- *Jumping*: standing everywhere a jump can put the player (152,874 places) with none out of reach; the same check finding the generators' tops when told the player can climb 2.2 m; eleven jumps over the lobby's barrier, three onto a drum, nine over the fence and one back; eight tall things and the cart never stood on, and the player never higher than a metre; ten runs and jumps at the lobby's drum corner from every side; a robot sent to each of the sixteen most awkward places, and from all four sides of the fence to four places inside it; a bomber's blast reaching a player on a desk, on a drum, inside the fence and on the trolley; the yard's barriers jumped at from nine places; and a hopper at the barrier and at the fence against a round-8 horde.
- *The opening*: four shutters sound and the entrance one blow from giving; forced with the first blow, the first robot indoors between seven and ten seconds in.
- *The hints*: MOVE, FIRE and AIM shown in turn and each going once done; a jump made early never asked for; the marker's hint ended by walking toward it; the buying hint held back until there is scrap; nothing taught twice on a second run; none at all with the hints off, and the strip of controls back.
- *The fail-safe's moment*: down, with DOWN on the HUD; half a second of it lasting 0.15 seconds of game time; the view fallen a metre; pressing forward and fire doing nothing; then FAILSAFE ENGAGED, 60 health, three seconds of cover, robots rocked, and the view back at eye height.
- *The fail-safe's throw in slow frames*: two robots touching the power room's shut door, the fail-safe fired in frames a tenth of a second long; neither gets past the face of the door. (On the build before the fix, both ended in the power room.)
- *The Turncoat in a horde*: twenty-four robots of round 8 in the server hall and again in the lab; the turned robot fights for its ten seconds and destroys at least four (it destroyed eight in each); the rig is on the weapon.
- *Speed*: the six stations are no more than forty shapes of their own between them (they are 33).
- *The music*: lower in the lull than at the start of a round, lower then than near its end, and never above its old level.
- *The west walk*: a robot can stand all the way along it.
- *A visitor's page* (loaded with no debug flag, as a first-time visitor): title, description, share tags, a preview picture 1200 by 630, three icons that load; no test tools on the page; no counter, no debug panel, and none of the words (debug, autopilot, god mode, fps, localhost, test, todo) anywhere on the start screen or in play; and the first hint, MOVE, waiting.
- *Changed, not new*: the settings list now has "Show frame rate" and "Show hints for new players"; the reach check's threshold is the jump rule's; and the real click on PLAY, on a page with the mouse really captured, is now also checked for firing nothing.

### Performance (check 5)

Measured on the production build on an NVIDIA GeForce RTX 4070 SUPER (a fast desktop card), at 1920 x 1080 unless it says otherwise. The heaviest moment is the one every stage has measured: the most robots the game allows, in the server hall, with every door on the map open so that all six areas are being drawn.

*A full horde of ordinary robots, in the server hall, every door open* (six areas drawn):

| Quality | Frames per second (median of 3 runs; lowest to highest) | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | **228** (206 to 255) | 581 | 1.26 M | 22 | 122 | 22 |
| Medium | **181** (99 to 195) | 742 | 1.50 M | 23 | 156 | 22 |
| High | **191** (159 to 194) | 744 | 1.50 M | 24 | 142 | 22 |
| Ultra | **200** (185 to 202) | 775 | 1.57 M | 23 | 110 | 22 |

*The same horde as ARGUS sends it*: two heavies, two bombers and four drones among the 24, and of the sixteen ordinary robots seven shielded against the gun being fired and eight with a plate over the visor.

| Quality | Frames per second (median of 3 runs; lowest to highest) | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | **237** (199 to 249) | 626 | 1.26 M | 22 | 169 | 33 |
| Medium | **178** (146 to 186) | 797 | 1.49 M | 22 | 309 | 44 |
| High | **190** (166 to 196) | 813 | 1.50 M | 22 | 370 | 55 |
| Ultra | **185** (121 to 193) | 850 | 1.58 M | 22 | 291 | 66 |

*That horde in the loading dock*, with the player by the hall's shutter and the robots coming across the open floor:

| Quality | Frames per second (median of 3 runs; lowest to highest) | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | **304** (221 to 323) | 371 | 0.90 M | 23 | 112 | 55 |
| Medium | **232** (155 to 245) | 501 | 1.19 M | 24 | 79 | 33 |
| High | **244** (121 to 253) | 491 | 1.18 M | 24 | 101 | 22 |
| Ultra | **188** (186 to 188) | 505 | 1.30 M | 24 | 81 | 11 |

**Smoothness**: ARGUS's horde in the server hall, with the frame rate limited to the screen's, as a player sees it. (The screen the test browser paced itself by was not the same throughout: 240 times a second in 1 of the 3 runs and 165 times a second in 2 of the 3 runs. A perfect frame is 4.2 ms at 240 a second and 6.1 ms at 165.) The usual frame and the slowest 1% are medians of the 3 runs; the worst frame and the count of frames over 25 ms are the worst of them.

| | Quality | Usual frame | Slowest 1% | Worst frame | Frames over 25 ms in 5 s |
| --- | --- | --- | --- | --- | --- |
| 1920 x 1080 | Low | 6.1 ms | 8.8 ms | 13.3 ms | 0 |
|  | Medium | 6.0 ms | 8.2 ms | 16.1 ms | 0 |
|  | High | 6.0 ms | 7.8 ms | 17.2 ms | 0 |
|  | Ultra | 6.0 ms | 7.7 ms | 14.4 ms | 0 |
| 3840 x 2160 | Low | 6.1 ms | 7.3 ms | 11.4 ms | 0 |
|  | Medium | 9.0 ms | 11.1 ms | 17.5 ms | 0 |
|  | High | 9.6 ms | 11.4 ms | 15.2 ms | 0 |
|  | Ultra | 18.7 ms | 20.9 ms | 26.0 ms | 1 |

**First appearances**: the slowest frame in the second after each thing is drawn for the first time, on High; the worst of the 3 runs. The last four rows are new with this stage. (The page now waits a moment on the start screen before the run begins, as every visitor does: that is when the HUD draws its costly parts once, unseen.)

| First time on screen | Slowest frame in the next second | Frames over 25 ms |
| --- | --- | --- |
| An ordinary robot | 7.1 ms | 0 |
| A robot carrying shielding | 7.3 ms | 0 |
| A robot with a plate over its visor | 7.2 ms | 0 |
| A shot that the shielding turns | 13.7 ms | 0 |
| A drone | 7.0 ms | 0 |
| A heavy | 7.1 ms | 0 |
| A bomber | 8.2 ms | 0 |
| The bomber going off | 8.8 ms | 0 |
| A Custodian | 7.4 ms | 0 |
| The Proxy | 7.3 ms | 0 |
| The ARGUS analysis arriving | 8.5 ms | 0 |
| The analysis shrinking into its corner | 7.1 ms | 0 |
| A timed pickup lying on the floor | 15.2 ms | 0 |
| A pickup taken: its notice, and its timer on the HUD | 7.1 ms | 0 |
| A boost on the HUD | 7.0 ms | 0 |
| A grenade thrown, and going off | 7.7 ms | 0 |
| An EMP Blast taking three robots | 8.2 ms | 0 |
| The Turncoat fired, and a robot turned | 11.0 ms | 0 |
| A shutter battered, and forced up | 7.0 ms | 0 |
| Going down with the fail-safe | 8.1 ms | 0 |
| The fail-safe firing: back on their feet | 8.4 ms | 0 |
| A first-minute hint coming up | 7.1 ms | 0 |
| The hint done: it turns green, and goes | 18.2 ms | 0 |

Nothing stalls: the slowest in any of the runs is 18.2 ms (the hint done: it turns green, and goes). The slowest are the first hint turning green (18 ms in one run, 9 in the other two), the first timed pickup on the floor and the first shot that shielding turns: a single frame each, once. Going down with the fail-safe, which stopped the picture for 73 ms when it was first timed, is now 7 or 8 ms.

**Against the earlier builds.** The tables above cannot be used to compare one build with another. The fight they measure is alive (robots are destroyed as it is measured, and their debris piles up differently every time), and the computer was doing other things besides: the three runs behind those medians gave, for the ordinary horde on Medium, 99, 181 and 195 frames a second, and two runs of an earlier build of this stage, a quarter of an hour apart, lay 18% apart across the board (239 / 181 / 191 / 165, then 193 / 147 / 157 / 164). So the comparison you asked for was made another way: **a scene that stands still** (24 robots held where they are put, every door open, lamps steady, nobody firing), with this build, the build you approved at the end of Stage 4 and the build from before Stage 4 **measured in turn, six rounds, a different one first each round**. What a frame draws in that scene is exact and the same every time; the frame rate is the median of the six rounds.

| The server hall, 24 robots standing in it | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| Pieces drawn in a frame: before Stage 4 | 498 | 637 | 637 | 670 |
| at the end of Stage 4 | 576 | 728 | 728 | 761 |
| **now** | **536** | **686** | **686** | **721** |
| Triangles in a frame: before Stage 4 | 1.17 M | 1.37 M | 1.37 M | 1.43 M |
| at the end of Stage 4 | 1.18 M | 1.38 M | 1.38 M | 1.44 M |
| **now** | **1.24 M** | **1.44 M** | **1.44 M** | **1.53 M** |
| Frames a second (median of 6 rounds): before Stage 4 | 308 | 241 | 253 | 191 |
| at the end of Stage 4 | 295 | 224 | 219 | 197 |
| **now** | **305** | **229** | **216** | **202** |

| The loading dock, 24 robots standing in it | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| Pieces drawn in a frame: before Stage 4 | 307 | 409 | 409 | 436 |
| at the end of Stage 4 | 313 | 419 | 419 | 446 |
| **now** | **323** | **434** | **434** | **462** |
| Triangles in a frame: before Stage 4 | 0.77 M | 1.02 M | 1.02 M | 1.14 M |
| at the end of Stage 4 | 0.77 M | 1.02 M | 1.02 M | 1.14 M |
| **now** | **0.88 M** | **1.15 M** | **1.15 M** | **1.28 M** |
| Frames a second (median of 6 rounds): before Stage 4 | 397 | 298 | 314 | 208 |
| at the end of Stage 4 | 404 | 282 | 293 | 201 |
| **now** | **405** | **291** | **303** | **209** |

**What the tables say.** The count of things drawn is exact, and in the hall it is down: 728 at the end of Stage 4, 686 now, on High (637 before Stage 4). In the dock it is a little up on Stage 4 (419 to 434; 409 before), and the triangles with it (1.02 M to 1.15 M): that is the truck, which is a great deal more of a truck than it was. **The frame rates do not separate this build from Stage 4's.** Round by round against the build from before Stage 4, Stage 4's build is 7% slower over the eight measurements (the hall 10%, the dock 4%) and this build 6% slower (the hall 7%, the dock 5%); and one build's 6 readings of the same thing lay 22% apart as a rule, 48% at worst. On Ultra, where the graphics card is the limit and not the processor, the three builds are the same. So both later builds are a few per cent slower than the one before Stage 4 wherever the processor is the limit, I cannot tell the two of them apart, and the 12% is not shown to be won back.

**Where a frame's time goes** (a profile of the still server-hall scene on this build, High): about three quarters of the script time is the drawing library walking through the scene and handing each thing in it to the graphics card, which it does once for the picture and again for every face of every shadow. The game's own rules, HUD and effects together are about a twentieth. With 24 robots standing in the hall that walk reaches 1,431 things in this build, 1,493 in Stage 4's and 1,348 in the build before it. That is why the number of separate things matters more here than how detailed any of them is, why six stations and five shutters cost what they do, and why merging is the saving there is to be had.

Budgets held: at most 24 robots on the map; 22 lamps live at once from the shared pool (8 that can cast shadows, 14 that cannot) plus the muzzle flash and the lamp that travels with the Proxy. The building has 118 lamps now (the west wall's two are new), which compete for the same 22 places.

- **Total download: 18.4 MB** of the 40 MB budget (models 9.4, textures 4.9, sound 2.4, code 1.5). It was 17.8 MB: the tyre and the cooling unit are 0.4 MB between them, the link preview picture and the icons 0.10 MB (counted here, though it is other sites and the browser's tab that fetch those, not the game), and the rest is code.
- **Time to the title screen**: 5.1 s from local files; 4.4 s at 100 Mbps, 5.7 s at 50 Mbps, 8.6 s at 25 Mbps (simulated).

## Not verified

- **How any of it sounds.** I cannot hear. This stage changed three things about the sound by measurement alone: the music bed's rise through a round, the dulling of every sound while you are down, and nothing else. The eighteen sounds Stage 4 added are still unheard too.
- **How the jump feels in your hands.** The checks prove what it clears and what it does not, from a standstill and from run-ups of several lengths. Whether clearing a barrier feels like a vault or like a scramble (at a walk you touch the top of it for a few frames on the way over; at a sprint you do not), and whether a metre is where you expected "waist height" to be, needs you.
- **Whether hopping is an exploit for a person.** The hopper is a simple model: two places to stand, one thing to hop. A person can hop the fence on any side, run, and hop back in somewhere else. The robots come in by two gateways and can strike across the rails, and the model never lasted, but a person is more inventive than a model.
- **The fail-safe's moment in a real fight.** I have looked at it now, in pictures taken at about real speed and in the checks. Whether a second on the floor feels dramatic or feels long when it happens to you in the middle of round 9 is yours to say; it is one number (`BOOSTS.failsafe.down`).
- **The hints, read by someone who has never played.** They are checked for appearing, going and not repeating. Whether six hints are the right six, and whether the buying hint arrives when a new player is ready for it, needs a new player.
- **The Turncoat's new look, against your eye.** It is no longer shiny and no longer bare, and it is in three pictures (54, 55, 56). The shape under the frame is still the model you downloaded. Whether it now belongs to this world is the judgement you made last time, and it is yours again.
- **The truck and the west wall, against your eye**, for the same reason: pictures 38, 39, 46, 71, 72 and 73.
- **The link preview on a real site.** The page carries the tags and the picture, and a check reads them back. Whether LinkedIn shows the card as intended can only be seen once the game has a public address and that address is in `site-address.txt`. LinkedIn also remembers a link's preview for about a week; its Post Inspector page is what refreshes it.
- **The favicon in other browsers.** It was looked at in the test browser (Chromium) only.
- **Whether a person finishes the mission as often as the models say.** About six times in ten for both the first-timer and the regular model this time. They never get lost, never misread a prompt, and never jump.
- **Everything listed as not verified after Stage 4 that this stage did not touch**: how the economy plays in your hands and whether scrap still piles up, grenade feel, a swarm for a real person, the phone message on a real phone, slower hardware, browsers other than Chromium, and how bright it is on your screen.

## Known rough edges

- **At a walk, clearing a barrier touches the top of it.** The jump's height did not change, so for a moment you are standing on the barrier and then you are off the far side. It is quick and it never stops you, but it is a hop-up-and-over, not a clean vault.
- **You can stand on a handrail.** The fence round the cell is a metre high and five centimetres thick, and anything low can be stood on. It is where robots can reach, so it is harmless, and it is how a jump from a standstill gets you over.
- **The Prototype Crate can be stood on, and its lid opens through your feet.**
- **Robots strike a player who is up on something as if they were on the floor**: there is no reaching-up animation.
- **The stacked drums and the cell's gateways are new to two rooms you had approved.** See decisions 155 and 156.
- **The truck is still made in code.** It has rounded corners, depth and real tyres now, and no interior behind its dark glass.
- **The Turncoat's shell is still the model it was**, under the frame and the wiring. Aiming it still shows you the back of it: it has no sights.
- **The music builds by getting louder and brighter, not by adding instruments.** There is one recording.
- **The hints are remembered per browser**, so someone borrowing your computer for a first go is not taught unless you switch them off and on in Settings.
- **The link preview picture needs the page's address** before sites will show it: see "Everything a public link needs".
- **The crate's offer simply hangs in the air and turns**, and the bench's arm is two links and a tip. There is no animation of the weapon leaving your hands, and no throwing animation for a grenade.
- **A robot battering a shutter uses its ordinary blow**, and the shutter shakes, sags and throws sparks; it does not dent.
- **The Turncoat's ammunition cannot be bought**, and the bench only gives it more shots.
- **Swarm drones are the ordinary drone**, a little faster.
- **The test players do not jump, open the Prototype Crate or repair shutters**, so the difficulty numbers leave those out.
- **The final stand is easy for the test players**, and stays so at your word.
- **Unchanged from before**: the game still throws away about 100 MB of script memory a second in a heavy fight, the shielding is flat, the drone's rotors do not turn, the heavy swings like an ordinary robot, ARGUS only knows four things about you and forgets from round to round, the rounds after the switch are plainer, the sidearm and shotgun have no hands on them, Auto never raises quality again by itself, the assembly arms do not move, and the dock's lamps light the ground outside its north wall.

## Before Stage 4: your answers to the Stage 3 feedback work

You approved the bigger map and all seven fixes from the screenshots (the loading dock, the robotics lab, the ARGUS analysis moment, the resisted hit and the redesigned heavy), and both notes in `SPEC.md`. Three things you said then are recorded here because they bind what comes after:

- **The Custodian comes sooner.** "Have it arrive the round after I hold the other two keys, and no earlier than round 6. I'd rather more people reach the ending than keep the mission long." Done before anything else in this stage (`MISSION.custodianFromRound`, 8 to 6), and `SPEC.md` says so.
- **For Stage 4:** spread the stations across all six areas; scrap must stay useful through a long run (the boosts, the crate, bench upgrades that can be bought more than once); re-tune once boosts and upgrades exist, still aiming for a real player being able to finish the mission with good play.
- **For Stage 5, not now:** the truck in the loading dock is blocky next to everything else (picture 39), and the long wall in picture 46 (the server hall's west walk) is blank. Neither has been touched.

## Stage 4: what is built

Everything the spec lists for Stage 4: shutters and repair, Boost Stations, the Prototype Crate and its special weapon, the Overclock Bench, timed pickups, swarm rounds, grenades, the settings and how-to-play screens, and the phone message. *(This is the record of Stage 4 as it was handed over. What Stage 5 changed in it is above.)*

**The stations: one in every area.** Six stations, six areas. Each is a painted cabinet built from the rooms' own kit, with a lit sign in a colour of its own, a lamp bar under the sign that lights its face and the floor in front of it, hazard stripes, and a prompt with the price when you walk up.

| Area | Station | What it sells | Price |
| --- | --- | --- | --- |
| Security lobby | Boost Station: **FAILSAFE** (violet) | One self-revive | 1,500, and 1,000 more each time it is bought again |
| Power room | Boost Station: **CARAPACE** (green) | More health: 160, where it was 100 | 2,500 |
| Server hall | Boost Station: **AUTOLOADER** (amber) | Reloading takes six tenths of the time | 1,500 |
| Core | Boost Station: **HAIR TRIGGER** (red) | A quarter less time between shots | 2,000 |
| Loading dock | **The Prototype Crate** | A random weapon, already overclocked, or the Turncoat | 1,000 a go |
| Robotics lab | **The Overclock Bench** | Upgrades the weapon in hand, up to four times | 2,000, 3,500, 5,000, 6,500 |

- **The Boost Stations and the bench only work once the power is on.** Before that they are dark, with a red lamp, and the prompt says "no power: restore power at the main breaker". The notice when the breaker is thrown now ends "STATIONS ONLINE". The crate works without power.
- **A boost is yours for the run.** Its charge is gone from the cabinet, and a tag in its colour appears above your health bar.
- **The fail-safe.** A blow that would put you down does not: you are back up with six tenths of your health, untouchable for three seconds, and every robot within five metres is knocked off balance. Then it is used up, and its station sells another for more.
- **The Overclock Bench** works on the weapon in your hands: each upgrade adds three tenths of the gun's own damage and a fifth of its magazine and spare ammunition, refills it, and renames it (Mk II to Mk V). Its arm comes down over the cradle and arcs for a moment.
- **The Prototype Crate.** The lid comes up, weapons flicker past, and it settles on one that hangs there for nine seconds: F again takes it, walking away leaves it and the lid shuts. An ordinary gun you do not carry comes as a Mk II; one you do carry comes a level above yours and takes its place. One go in five (and likelier with every miss) it is the Turncoat.
- **The Turncoat**, the special weapon, is the fourth gun model you downloaded, re-painted. Its beam turns a robot to your side: its lights go pale blue, it attacks the robots round it, and after ten seconds its core burns out. Everything it destroys, and itself, are your kills. The Custodian and the Proxy cannot be turned (the HUD says so); the beam hurts them instead. It comes with sixteen shots, and no wall rack sells more: only a Full Resupply refills it.

**Shutters.** The five openings robots walk in by (main entrance, power room breach, two truck bays, the lab's hatch) have working shutters, down at the start of a run. Robots outside batter one (five blows, with a bang, sparks and the shutter shaking each time) until it is wrenched up; F from indoors runs it back down for 50 scrap. A shutter that is down stops you and your bullets as well. You cannot shut yourself out.

**Timed pickups.** A destroyed robot sometimes leaves a badge of light under a thin shaft: **Full Resupply**, **Overload** (one-hit kills, 20 s), **EMP Blast** (every robot on the map), **Double Scrap** (30 s) or **Lockdown** (every shutter repaired). Walk into it. The two that last show on the HUD with a draining bar.

**Grenades.** G throws one: two to start, another each round, four at most. It bounces, stops near where it lands and goes off after 1.7 seconds: thrown level, about twelve metres away.

**Swarm rounds.** Rounds 5, 10, 15 and so on are drones only (14, then 20, then 26), announced as "SWARM", never more than ten on the map at once, and the last one leaves a Full Resupply that waits a minute.

**Screens.**
- **How to Play**, from the start screen and the pause screen: seven short sections for someone who has never played a game like this (the idea, staying alive, fighting, scrap and what it buys, the mission, ARGUS, things worth knowing) and the controls.
- **Settings**, from the start screen as well as the pause screen: graphics quality, mouse sensitivity, brightness, volume, sound off, show frame rate, reduce screen shake and flashing. All remembered in your browser.
- **Phones and tablets** get the title scene (the live lobby, the camera drifting) with "Play this on a computer with a mouse and keyboard", why, the page's address and a button that copies it.
- The start screen has three more buttons under PLAY: HOW TO PLAY, SETTINGS, CREDITS.

**On the HUD:** grenades (a pip for each), the boosts you hold, timers for Overload and Double Scrap, the weapon's mark after its name (KR-7 CARBINE MK II), TURNED and CANNOT BE TURNED under the crosshair, and "G grenade" in the opening hint.

**Sound:** eighteen new sounds (the beam, a robot turned, a boost bought, the bench, the crate's lid, ticking, offer and close, a pickup, the EMP, three blows on a shutter, a shutter forced, a shutter repaired, a grenade bouncing, the fail-safe), all cut from packs already credited.

### Difficulty, with the economy in

You asked me to re-tune once boosts and upgrades existed, still aiming for a real player being able to finish the mission with good play, and not to make anything harder without asking. **So I measured, and changed nothing**: every change in this stage either gives the player something, or was your own (the Custodian from round 6), or is the spec's (every fifth round is a swarm: fourteen fragile drones, a little faster than the ordinary drone, in place of round 5's twenty-three robots). No number that sets how tough, how fast or how many the robots are was turned up. The table is the same one as before, set beside the numbers from the end of the Stage 3 feedback.

60 missions each by the first-timer and the regular model, 32 by the skilled, and 16 runs of ordinary rounds each by the first-timer and the regular. No god mode, no free scrap.

| | Skilled model (32 missions) | First-timer model (60 missions, 16 ordinary runs) | Regular model (60 missions, 16 ordinary runs) |
| --- | --- | --- | --- |
| Finished the mission | **28 of 32 (88%)**; it was 43 of 48 (90%) | **31 of 60 (52%)**; it was 4 of 16 (25%) | **40 of 60 (67%)**; it was 12 of 48 (25%) |
| Mission time, of those that finished | **median 9:18** (fastest 7:13, slowest 11:00); it was 11:35 | median 8:57 (6:37 to 11:00); it was 13:15 | median 9:06 (6:45 to 10:53); it was 13:19 |
| Round the mission ended in | 8 (14 runs), 7 (13) or 6 (1); it was 8, sometimes 9 | 7 (22 runs), 6 (5) or 8 (4); it was 8, once 9 | 7 (20 runs), 6 (10) or 8 (10); it was 8 |
| Reached the final stand | 28 of 32; it was 45 of 48 | 37 of 60; it was 7 of 16 | 43 of 60; it was 22 of 48 |
| **Won the final stand** | **28 of 28**, taking about 1:15 (median); it was 43 of 45, taking 1:25 | **31 of 37 (84%)**, taking about 1:35; it was 4 of 7 | **40 of 43 (93%)**, taking about 1:40; it was 12 of 22 (55%), taking 3:33 |
| Got the uplink's key | 29 of 32; it was 46 of 48 | 55 of 60; it was 14 of 16 | 53 of 60; it was 38 of 48 |
| Went down in round (attempting the mission) | 3, 3, 6 and 6: the 4 that went down | 6 (median; 3 to 8), of the 29 that went down | 6 (median; 3 to 7), of the 20 that went down |
| Went down in round (ordinary rounds only) | | **9** (median); 8 of 16 in rounds 7 to 10; earliest 6, latest 13; it was 9 | 9 (median); 9 of 16 in rounds 7 to 10; earliest 8, latest 12; it was 8 |

Where the regular model's 20 lost missions ended: 2 at the key cage (rounds 3 and 4); 5 at the uplink (rounds 5 and 6); **6 with two keys in hand in round 6, waiting for the Custodian** (which comes with round 7 for them); 2 fighting it; 2 at the core's door with all three keys; and 3 in the final stand.

Where the first-timer's 29 ended: 2 at the cage in round 3; 3 at the uplink; **9 with two keys in round 6, waiting for the Custodian**; 6 fighting it; 3 with it destroyed and its key lying on the floor; and 6 with all three keys (one inside the core during the stand, two on their way back into it, three with the switch armed and not yet pulled).

The skilled model's 4: two at the cage in round 3, one at the uplink, one waiting for the Custodian.

**What made the difference.** Two things, and I cannot fully separate them. The first is yours: the Custodian now comes in round 6 or 7 for a player who has both keys, where it came in round 8, so the two models nearest to you finish about four minutes sooner than they did, before the rounds get heavy. The second is the economy. In the runs where I recorded what was bought: the regular model bought the health boost in 9 of 12 missions, the fail-safe in 8, the reload boost in 4 and the fire-rate boost in 1 (that one is in the core), overclocked a gun in 3, and was brought back by the fail-safe once. The first-timer buys what it is standing next to: in 44 missions, the reload boost in 25, the fail-safe in 24, the fire-rate boost in 21 and the health boost in 2, and the fail-safe brought it back in 11. Every model ended its missions with about 6,500 to 7,200 scrap unspent (median): a mission is short, and there is more to buy than it has time for.

**How much these numbers move.** The first batch of 16 first-timer missions finished 12 (75%); the next 12 finished 4 (33%); the next 32 finished 15 (47%). That is what sixteen runs are worth, and it is why the table now stands on 60. Read "about half" and "about two in three", not the percentages.

**Against the targets:**

- *A real player can finish the mission with good play and no exploit* (yours). The two models nearest to a real person now finish **about half their missions (the first-timer) and two in three (the regular)**, where each finished one in four. I think that is "can finish with good play". They are models; they follow the tracker without ever getting lost; your own first run on this version will tell you more than they can.
- *A first-time player should usually go down around round 9 (between rounds 7 and 10)*, fighting the ordinary rounds only. The first-timer model's median is **still 9**. Half its runs end in rounds 7 to 10 (it was three quarters), and nearly all the rest go further, to 11, 12 and 13. None of the sixteen ended in round 5 or round 10, the swarms: a swarm round ends with everything refilled, and a run that reaches one tends to get a round or two beyond it.
- *The final stand is hard but winnable.* **It is no longer hard for the test players**: the regular model wins 40 of 43 and the skilled every one; the first-timer wins 31 of 37. That is boosts, the fail-safe and overclocked guns meeting a fight that was sized before any of them existed, in a round (7) with fewer and weaker robots than the round it used to happen in. I have left it, because you asked me not to make the game harder without asking. If you want it to bite again, the numbers are `MISSION.standMax` (9 robots at once), `MISSION.standInterval` (one every 2.2 s) and the Proxy's health (`MISSION.proxy.health`, 8), and I would rather you played it first.

**The one place I would look next, if you want more people still to reach the ending:** round 6 with two keys in hand. It is where the largest single group of both models' runs ends (6 of the regular's 20, 9 of the first-timer's 29): the Custodian is due with the next round, and round 6 is the first with a bomber in it. That is not a change I have made; it is where the numbers point.

**How far to trust this.** The same cautions as before, and one more: the test players use only part of the economy. They buy boosts, overclock a gun and throw grenades; they never open the crate and never repair a shutter. A person who does those as well has more than they do. (These batches were played on the build from just before the stations were re-lit and re-painted. Nothing that affects play changed after it.)

### Found on the way, and fixed

- **The stations were black shapes in the dark rooms.** Built from bare steel, a cabinet in the power room or the core showed its lit sign and nothing else. They are painted now, with a lamp bar under each sign and a stronger light (decision 151). Walking up to any of the six, its light is fully up from six metres away (measured).
- **The bench stood on a stretch of wall that was not free.** A wall-mounted power box in the lab was inside it and showed through the bench's back board, across its card. The box has moved two metres along the wall, and the card to the clear half of the board. In the core, the first letters of "ARGUS CORE" ran 5 cm behind the fire-rate station's sign; the lettering is a little smaller and clear of it. I then checked the other four stations against everything on their walls: the lobby's, the power room's, the hall's and the dock's are clear.
- **A thrown grenade rolled on for a room's length.** It kept its speed at every bounce. It now loses half its pace each time it hits the floor and drags to a stop.
- **ARGUS's analysis stayed marked as in force after the kill switch.** Shutting ARGUS down cleared what it would do next but not what it was doing. Found by the check that ARGUS is off after HUMANITY SAVED; fixed.
- **The test players walked into shutters.** They planned retreats through a shutter that was down, and walked up to robots that were still outside one. They now treat a shutter that is down as a wall, as a person would. This was fixed before any of the difficulty numbers above were measured.
- **The special weapon was a black teardrop in the hand.** Its body was bare dark steel. It is now a pale, worn steel that takes the room's light as the other guns do, and its beam is thicker and brighter.
- **A check failed that was right, because of chance** (decision 152).
- **Three pictures were staged badly, not three things wrong in the game**, and I checked each before deciding which it was: stations photographed half a second after a jump across the map, before the lamps round them had come up (walking, they are up long before); a round number left on the HUD by the debug restart (the real PLAY AGAIN button clears it); and a swarm photographed with a drone against the lens.

## Design decisions made in Stage 4

Numbered on from the Stage 3 feedback's (which ended at 128). None of these was asked as a question; each is mine to defend and yours to overrule.

129. **One station in each area, and which goes where.** Six stations, six areas, so I took "spread the stations across all six areas" literally. The fail-safe is in the lobby, the room every route passes through and the one place you can always get back to. The health boost is in the power room beside the breaker, so the first station you see come to life is the one a new player most needs. The reload boost is in the server hall, on the way to the uplink. The crate is in the dock and the bench in the lab, as you suggested. **That leaves the core, which is sealed until you hold all three keys.** I put the fire-rate boost there: it is the one whose absence costs least earlier on, and the one worth most at that moment, on the way in to fight the Proxy. If you would rather the core had none and another area had two, that is one line in `src/world/plan.ts`.
130. **The boosts have their own names**: CARAPACE (health), AUTOLOADER (reload), HAIR TRIGGER (rate of fire), FAILSAFE (self-revive), each with its own colour. None is taken from another game, and each station's sign and prompt also says in plain words what it does. The special weapon is the XM-0 Turncoat, after what it does.
131. **Prices**: the boosts 1,500 to 2,500; the bench 2,000 for the first upgrade and 1,500 more for each one after; the crate 1,000; a shutter 50. They were set against what the first-timer model earns in ordinary rounds: 15,000 to 18,000 in a run that ends in round 8 (about where a mission ends), and 38,000 to 47,000 in one that reaches round 12. So during the mission you choose (two or three boosts and perhaps one upgrade), and in a long run there is always something left to buy.
132. **The fail-safe can be bought again**, for 1,000 more each time. The spec says "one self-revive", and it is one at a time. Buying another is the most direct answer to your note about scrap staying useful, and it turns a big pile of scrap into a way to finish.
133. **The bench: four upgrades to a gun**, each adding three tenths of its original damage and a fifth of its magazine and spares, and refilling it. The level belongs to the gun, not to the kind of gun: swap it away and the upgrades go with it. Four, not endless, so that the numbers stay honest (a Mk V does 2.2 times what the gun did off the wall).
134. **The crate hands out overclocked guns.** There are only three ordinary guns, and all three hang on walls. A crate that handed out the same guns would be worth nothing, so its guns come a level up: a Mk II if you do not carry that kind, one level above yours if you do. It never offers something worse than you have, and you can leave what it offers. At 1,000 it is a cheaper way up than the bench for anyone willing to take what comes.
135. **The Turncoat, and what "briefly turns a robot to my side" means here.** A turned robot fights for ten seconds and then its core burns out, which counts as your kill. I chose that over having it turn back, because a robot that turns on you again from a pace away is a punishment for using the weapon. It goes straight for the nearest robot (it does not use the robots' map, which leads to you). ARGUS's own machines cannot be turned. Its chance from the crate starts at one in five and rises by one in ten with each miss.
136. **Its model is your fourth gun, with none of its own pictures.** The textures in that download look like a scanned-surface library's, which has its own licence, so only the shape is used (28,000 of its 330,000 triangles) and the game paints it from surfaces already credited: a pale, worn steel body, brass rings, and a cell lit the colour of everything on your side.
137. **Repairing a shutter costs scrap; it does not pay it.** "I can repair a broken shutter for a little scrap" reads either way. I took it as a price (50), because the spec lists it with the things F buys, and because you finished with scrap to burn.
138. **A run starts with every shutter down.** So the first thing that happens in a run is something beating on the entrance, and the first robot is inside the lobby about 13 seconds into a run where it was about 8 (measured: 12.8 s and 7.6 s, the median of six starts each). That is a quieter opening than you have played. I considered starting the shutters already battered so that it was shorter, and did not: it lets the robots in sooner, which is harder, and that is yours to ask for. The shutters the building always had, jammed part-way up, are what a forced one looks like. A shutter that is down stops you and your bullets as well as the robots.
139. **You cannot shut yourself out.** A shutter will not run down while you are outside it or under it, by F or by a Lockdown.
140. **Pickups are walked into, not picked up with F.** The spec's controls list has F for "pick up", which the keys on the floor still use. In the middle of a fight a pickup that needs a key press is a pickup people miss.
141. **Pickups stay an event**: one kill in twenty-five, at most three a round, at least five kills apart, 25 seconds on the floor. None is left where you cannot walk to it, and a Lockdown is never left when no shutter needs it.
142. **ARGUS's own machines are not destroyed by an EMP Blast or by one hit under Overload.** The blast takes a quarter of their health; Overload triples what a hit does to them. The Custodian carries a key and the Proxy is the boss: neither should vanish to a lucky drop.
143. **Grenades are handed out, not sold**: two to start, one more each round, four at most. They are something to do with a pack, not another shop.
144. **Swarm rounds take the place of rounds 5, 10, 15**, they are not added between. Fourteen drones the first time, six more each time, ten on the map at once. ARGUS announces no counters before one (drones carry none), and whatever it had in force waits a round.
145. **Settings are one set of controls in two places**: on the pause screen, where they have always been, and on a Settings screen from the start screen. "Sound off" was added (M still does it too). Brightness and the frame-rate counter stay, though the spec does not list them.
146. **How to Play is words, not a tutorial level.** Seven short sections in the order a new player needs them, and the controls. It is on the start screen and the pause screen.
147. **The phone message offers the page's address and a button that copies it.** Nothing is sent anywhere: it goes on the device's own clipboard.
148. **What the test players use.** All three buy boosts and walk into pickups; the regular and the skilled also make the trip to a station they are not standing next to, overclock their best gun once the boosts they can reach are bought, and throw a grenade at a pack. None of them uses the crate or repairs a shutter. So the numbers above are for a player who uses some of the economy, not all of it.
149. **Nothing was made harder.** Stage 4 gives the player a great deal, and the robots nothing beyond the swarm rounds the spec asks for. I measured what that did and report it above; I have not turned anything up to compensate, as you asked.
150. **The pictures are in `media/stage-4/`**: the whole set re-taken (so 01 to 46 match the game as it is now), and 47 to 64 new.
151. **The stations are painted, not bare steel.** My first version built them from the same dark steel as the breaker. In the two dark rooms (the power room and the core) and the lab, that was a black shape with a lit sign: bare metal shows reflections, not the light of a lamp beside it. They are now painted (grey for the Boost Stations and the bench, olive for the crate), each with a lamp bar under its sign and a brighter light of its own colour, so that each can be seen and read from across its room.
152. **The checks and the pictures switch chance pickups off.** A destroyed robot leaves a pickup one time in twenty-five, by chance, and a check that counts what is lying on the floor cannot have one turn up uninvited (one did, and failed a check that was right). So the test tools turn chance drops off (`__HO.randomDrops(false)`, debug only), and one check turns them back on to prove that they happen and that three a round is the limit. The game itself is unchanged, and the test players that measure difficulty play with them on.

## Checks run at the end of Stage 4

*(As they stood then. The current counts are under "Checks run at the end of Stage 5" above.)*

| Check | Result |
| --- | --- |
| 1. Type-check and production build | Pass, zero errors |
| 2. Unit tests | **229 of 229 pass** in 17 files. New (38 tests): every Boost Station with the power off and on, what each charges, and the fail-safe's rising price; the bench's levels and prices, and what each level and each boost does to every gun; the crate's dice (the special weapon's growing chance, never an offer worse than what is carried); how often pickups are left and which; a shutter's blows, repair and Lockdown; grenades; swarm rounds. |
| 3. Headless browser | **197 of 197 pass** against the production build served from a sub-folder address. What is new is listed below. |
| 4. Screenshots | 67 in `media/stage-4/`: the whole set re-taken on this build (01 to 46), and 47 to 64 new. Every one looked at: 01 to 46 as contact sheets, for anything dark, missing or out of place, and five of them (02, 07, 13, 26, 31) side by side with the versions you approved. Two things came of that beyond the fixes listed above: pictures 31 and 31b (ARGUS's analysis) are now staged a round earlier, because the round they used to precede is a swarm and ARGUS announces nothing before a swarm; and the rooms' pictures now show a station where one stands. |
| 5. Performance | See below. |
| 6. Credits | Pass: 197 shipped asset files all trace to credited sources (19 more than at the end of the Stage 3 feedback: eighteen sounds cut from packs already credited, and the Turncoat's model, the fourth of your gun downloads, now credited as shipped); the credits match `links.txt`; no file tracked by git is a raw download. |

**New in the end-to-end test** (197 checks now; there were 169):

- *The stations*: one in every area; with the power out the four Boost Stations and the bench sell nothing, charge nothing and say why, and the crate works; each boost bought with F for its price, once, and then measured (health 160 and full, the reload and the time between shots shorter by the stated share); the boosts on the HUD.
- *The bench*: the same gun overclocked twice, 2,000 then 3,500, its damage and magazine measured after each, and handed back full; a Mk V gun refused, nothing charged.
- *The crate*: with its dice fixed, F charges 1,000, it chooses, and a second F takes the Turncoat for nothing more; then an ordinary gun offered already overclocked and left where it is, the lid shutting on it with nothing but the roll paid.
- *The Turncoat*: a robot turned, the robot beside it destroyed half a second later, the turned one burnt out at ten seconds, two kills and their scrap; a Custodian struck and not turned.
- *The fail-safe*: robots put the player down; back up with six tenths of their health, a second of blows doing nothing, the fail-safe gone, the next one dearer; then down again with no fail-safe, and the run ends.
- *Shutters*: all five down and sound at the start of a run; a robot counted through its five blows, and coming in only after the last; repaired with F from indoors for 50, and the next robot held again; no repair offered for a sound one, or from the wrong side; a shutter that is down stops the player as well.
- *Pickups*: all five taken and their effects measured (a Lockdown that will not shut the player out; a strike paying 130 and then 260; one sidearm shot destroying a robot with twenty shots' worth of health, and half a minute later not; an EMP taking eight robots and a quarter of a Custodian); the timers on the HUD; one nobody takes gone after 25 seconds; and, with chance switched on, robots destroyed eight at a time until one of them leaves a pickup, and then a thousand more to see that three in a round is the limit.
- *Grenades*: thrown, one fewer, not twice in a breath, off when the fuse says, four robots nine metres away destroyed; one at the thrower's feet; another handed out with the next round.
- *A swarm round*: the fifth round, every robot of it a drone, announced as a swarm, no more than ten on the map, a Full Resupply left when it ends; and no counter of ARGUS's on the tenth.
- *Screens*: How to Play and Settings from the start screen, what each contains, and a setting changed there found in the browser's storage; the phone's message and the address on it.
- *Changed, not new*: the yard cannot be walked into while its shutter is down; the Custodian is expected with the round after the second key or round 6, whichever is later.

### Performance (check 5)

Measured on the production build on an NVIDIA GeForce RTX 4070 SUPER (a fast desktop card), at 1920 x 1080 unless it says otherwise. The heaviest moment is the one every stage has measured: the most robots the game allows, in the server hall, with every door on the map open so that all six areas are being drawn.

*A full horde of ordinary robots, in the server hall, every door open* (six areas drawn):

| Quality | Frames per second | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | 198 | 622 | 1.21 M | 22 | 122 | 22 |
| Medium | 165 | 787 | 1.43 M | 24 | 110 | 22 |
| High | 167 | 786 | 1.43 M | 23 | 227 | 22 |
| Ultra | 145 | 793 | 1.47 M | 24 | 83 | 11 |

*The same horde as ARGUS sends it*: two heavies, two bombers and four drones among the 24, and of the sixteen ordinary robots seven shielded against the gun being fired and eight with a plate over the visor.

| Quality | Frames per second | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | 202 | 659 | 1.20 M | 22 | 122 | 33 |
| Medium | 133 | 830 | 1.41 M | 22 | 245 | 44 |
| High | 151 | 847 | 1.43 M | 22 | 301 | 55 |
| Ultra | 111 | 883 | 1.48 M | 22 | 288 | 66 |

*That horde in the loading dock*, with the player by the hall's shutter and the robots coming across the open floor:

| Quality | Frames per second | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | 269 | 360 | 0.79 M | 23 | 113 | 55 |
| Medium | 197 | 482 | 1.06 M | 24 | 80 | 33 |
| High | 209 | 473 | 1.04 M | 23 | 285 | 22 |
| Ultra | 151 | 508 | 1.16 M | 23 | 429 | 22 |

**Smoothness**: ARGUS's horde in the server hall, with the frame rate limited to the screen's, as a player sees it (this screen refreshes 240 times a second, so a perfect frame is 4.2 ms).

| | Quality | Usual frame | Slowest 1% | Worst frame | Frames over 25 ms in 5 s |
| --- | --- | --- | --- | --- | --- |
| 1920 x 1080 | Low | 4.3 ms | 7.4 ms | 11.5 ms | 0 |
|  | Medium | 5.7 ms | 9.4 ms | 17.8 ms | 0 |
|  | High | 6.1 ms | 9.5 ms | 11.8 ms | 0 |
|  | Ultra | 6.3 ms | 11.6 ms | 14.4 ms | 0 |
| 3840 x 2160 | Low | 4.9 ms | 10.4 ms | 13.1 ms | 0 |
|  | Medium | 11.1 ms | 13.8 ms | 15.6 ms | 0 |
|  | High | 12.1 ms | 14.4 ms | 15.5 ms | 0 |
|  | Ultra | 20.7 ms | 23.6 ms | 25.3 ms | 2 |

**First appearances**: the slowest frame in the second after each thing is drawn for the first time, on High. The last seven rows are new with this stage.

| First time on screen | Slowest frame in the next second | Frames over 25 ms |
| --- | --- | --- |
| An ordinary robot | 6.0 ms | 0 |
| A robot carrying shielding | 5.2 ms | 0 |
| A robot with a plate over its visor | 5.4 ms | 0 |
| A shot that the shielding turns | 12.0 ms | 0 |
| A drone | 5.0 ms | 0 |
| A heavy | 6.0 ms | 0 |
| A bomber | 5.1 ms | 0 |
| The bomber going off | 7.2 ms | 0 |
| A Custodian | 6.3 ms | 0 |
| The Proxy | 4.9 ms | 0 |
| The ARGUS analysis arriving | 6.7 ms | 0 |
| The analysis shrinking into its corner | 5.4 ms | 0 |
| A timed pickup lying on the floor | 11.9 ms | 0 |
| A pickup taken: its notice, and its timer on the HUD | 6.4 ms | 0 |
| A boost on the HUD | 5.0 ms | 0 |
| A grenade thrown, and going off | 4.7 ms | 0 |
| An EMP Blast taking three robots | 6.4 ms | 0 |
| The Turncoat fired, and a robot turned | 7.4 ms | 0 |
| A shutter battered, and forced up | 5.0 ms | 0 |

Nothing stalls: the slowest is 12.0 ms (a shot that the shielding turns). The two slowest are a shot that shielding turns (as before) and the first timed pickup to be dropped; neither is near a stall.

**Against the build you approved, measured the same hour.** Frame rates on this machine drift from day to day, so the build from the end of the Stage 3 feedback was measured again straight after this one. Same scene for both.

| | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| Ordinary horde, server hall: the build you approved | 233 | 176 | 186 | 160 |
| **This build** | **198 (-15%)** | **165 (-6%)** | **167 (-10%)** | **145 (-9%)** |
| ARGUS's horde, server hall: the build you approved | 212 | 161 | 175 | 135 |
| **This build** | **202 (-5%)** | **133 (-17%)** | **151 (-14%)** | **111 (-18%)** |
| ARGUS's horde, loading dock: the build you approved | 286 | 225 | 239 | 181 |
| **This build** | **269 (-6%)** | **197 (-12%)** | **209 (-13%)** | **151 (-17%)** |

**This build is slower than the one you approved: by about 12% on average at 1920 x 1080**, and between 5% and 18% across the twelve measurements above, each of which is a two-second average that wobbles by several per cent from one run to the next. I looked for the cause in one of them (the ordinary horde on High) and found it: the six stations are drawn as 114 separate pieces, which is 67 more draw calls in that scene. Measured turn and turn about with the same horde, a frame takes 5.9 ms with the stations drawn and 5.4 ms with them hidden (169 frames a second against 185), which is the whole of the difference there; the shutters cost nothing measurable. I did not take the other eleven measurements apart. At 3840 x 2160, where the graphics card is the limit and not the number of things drawn, the two builds are the same (418 frames in five seconds on High against 417). It is well inside the budget and nothing stalls. Merging those pieces is performance work, which is Stage 5's; I have not done it now.

Two more things to read these tables by. The machine itself was slower today than on the night the last report was made: the build you approved gives 233 / 176 / 186 / 160 here, where that night it gave 283 / 218 / 231 / 198, with no change to it. And at 3840 x 2160 on Ultra two frames in five seconds went over 25 ms in both builds today (worst 25.3 ms in this one, 27.0 ms in the earlier one); that night there were none.

Budgets held: at most 24 robots on the map; 22 lamps live at once from the shared pool (8 that can cast shadows, 14 that cannot) plus the muzzle flash and the lamp that travels with the Proxy. The six stations add six lamps to the building's 110 (now 116), which compete for the same 22 places; pickups, grenades and the beam are particles and unlit glows, and add no lamps at all.

- **Total download: 17.8 MB** of the 40 MB budget (models 9.0, textures 4.9, sound 2.4, code 1.5). It was 17.2 MB: the Turncoat's model is 0.36 MB, the eighteen sounds 0.18 MB, and the rest is code.
- **Time to the title screen**: 5.1 s from local files; 4.5 s at 100 Mbps, 5.7 s at 50 Mbps, 8.5 s at 25 Mbps (simulated). The build you approved, measured the same hour: 4.6 s from local files; 4.2 s, 5.4 s and 8.1 s. So this stage adds a third to half a second: six stations and their signs to build, one more gun, eighteen more sounds.

## Stage 3 feedback: what changed

You finished the mission, the first real person to do so, approved the four Stage 2 fixes, ARGUS's counters and remarks, the three special robots, the profile card and the lamp glass, and listed eight things. Seven are done and are in the table; the eighth is a note for Stage 4 and is recorded under it. **Stage 4 has not been started.**

**Your answer since** (16 November, after reading the summary of this work, which reported that the first-timer model now lasts to about round 9 in the ordinary rounds, over the spec's "rounds 5 to 8"): that is fine, and after your playthrough easier is the right direction. The target in `SPEC.md` has been changed to match (decision 126), and **the game is not to be made harder again without asking you first.**

| # | You asked for | What was done | How it is checked now |
| --- | --- | --- | --- |
| 1 | A bigger map: a loading dock and a robotics lab, built to the approved look, each with its own mood; two new loops and no dead ends; cramped spots widened; each with a door to buy, a wall weapon, hidden robot entries and room for Stage 4's stations; a mission step moved if it helps | **Six areas.** The **loading dock** is west of the server hall: 22 metres by 22 and seven and a half high, the biggest open space on the map, under sodium lamps; shipping containers in islands with lanes all round, a box truck backed into the middle bay with its headlamps on, a crane, and two truck bays open to the yards the robots cross. The **robotics lab** is south of the power room and east of the hall: cold and white, a fenced assembly cell with three arms working on a half-built unit, torsos coming in on an overhead line, racks of arms and legs, units standing switched off in recharging bays (all of them the robots' own bodies, taken apart by the game). **Three loops** now: lobby, hall, power room (as before); lobby, dock, hall; hall, lab, power room. **Four new doors**: lobby to dock 1000, hall to dock 1000, power room to lab 1000, hall to lab 1250. **Wall weapons**: a second carbine in the dock, a second shotgun in the lab. **Entries**: two truck bays and a ceiling vent in the dock, the assembly-line hatch and a vent in the lab, one more vent in the hall; thirteen in all, none of them visible from indoors. **Widened**: the server hall's rack rows now stop short of both side walls, leaving a walkway down each side (they ran wall to wall), and both doors into the power room are wider. **The caged key moved to the lab**, as you suggested: the mission now walks you through it. Floor is left clear in both for the stations: in the lab, three and a half metres of the west wall in the south-west corner and six metres of the east wall north of the hatch (either would take the Overclock Bench); in the dock, seven metres of the north wall either side of the stacked containers and twelve of the south wall. See pictures 38 to 46. | Unit tests of the map: three loops, no dead end but the core. End to end: every one of the eight doors bought with F and walked through on foot, round each of the three loops, at all four quality levels (60 crossings), each room measured for light; a robot sent in at each of the thirteen entrances reaches the player; every entry is joined to every room on the robots' map; none of the five walk-in spots can be seen from indoors; each new area's doors, prices, wall weapon, entries and HUD name. |
| 2 | The safe spot by the barrels: robots must reach and hit me anywhere I can stand, and a bomber's blast too; add a check that samples standable positions across the whole map | **Found, with three more like it, and closed at the root.** Your spot was the corner among the barrels in the lobby. There were two ways into it: a jump (which put you on top of anything up to waist height) and a gap between two of the barrels only just as wide as you are. The Stage 1 check saw neither, because it studied the floor plan in 15 cm squares. **Jumping no longer gets you onto or over anything taller than a step**, so every spot of the first kind is gone at once, including a way out of the building over the new dock's barriers that I had just built without knowing. **The barrels' corner is solid.** **A bomber's blast is no longer stopped by low cover** (a barrel or a barrier between you used to block it); only a wall, or something taller than you are, does. **The new check stands everywhere**: about 147,000 places, one every 10 cm, for a body slightly slimmer than yours so that it goes through anything you could squeeze through, on the floor and on top of whatever can be stood on, reached by the game's own rules of movement. It fails if a robot cannot get within striking distance of any of them without a wall between. Besides your corner it found **a second safe spot behind the security desk** in the lobby's opposite corner (through a gap between a bin and the corner of the desk that a person can just squeeze through), a strip behind a crate in the power room, and a slot in the new dock. All are closed. **And robots no longer gather on the wrong side of a wall**: see "found on the way". | That check, in the end-to-end run and as unit tests on made-up maps (a fenced corner, a gap 70 cm wide). Told that jumping onto things still works, it must find your corner again (2.2 m out of reach). Then real robots: one sent from five metres away to each of the sixteen most awkward places the check can find, and each must land a blow (the slowest took 4.4 s). A player run at the barrels from five sides, jumping all the way, never ends up on or among them. A bomber set off across a low barrier hurts; across a wall it does not. |
| 3 | Difficulty for a real person: I would not have survived without the safe spot; treat a human as closer to the first-timer model; re-tune so a real player can finish with good play and no exploit; say what changed | See **"Difficulty for a real person"** below. The short version: what ends an ordinary player's run is being boxed in by a pack, so a blow now takes a fifth of your health (it was three tenths) and a crowd cannot land them faster than one every 0.6 s; the mission's own fights are sized for someone holding ground; and the ordinary rounds were left alone. | `npm run mission` and `npm run balance` re-produce every number in that section. |
| 4 | Do not make me wait for the Custodian: have it arrive at the start of the round after I hold the other two keys, never before round 8; re-run both models, same table | Exactly that. With two keys in hand the tracker reads **A CUSTODIAN CARRIES THE LAST KEY / IT ARRIVES WITH ROUND 8** (or whichever round is next, if you are past 7). The skilled model now finishes in about eleven and a half minutes, in round 8 or 9. The table is below. | Unit tests of the rule both ways round. End to end: keys early, it comes with round 8; no keys by round 10, it does not come; both keys taken in round 10, it comes with round 11. |
| 5 | Make the ARGUS analysis a moment: large near the top centre with ARGUS's eye and its own sound, about two seconds, then shrink into the corner for the rest of the pause; never pause; keep the crosshair and the middle clear; respect reduced flashing; screenshots of both states | It arrives across the top of the view under ARGUS's eye mark (the one painted on the walls, drawn as a vector so it is sharp at any size): the ring turns into place and the iris opens, the title is 38 px on a 1080p screen and the "ADAPTING" lines 36 px in capitals, where the corner banner's are 13 and 17. It holds for about two seconds (2.6 from first appearing), then flies to the corner as it fades and the small banner takes its place, where it stays **until the next round begins** (it used to go after eight seconds). It has a sound of its own, rebuilt to open on a sharp burst as the banner snaps in. It is sized as a share of the window, so it ends about a third of the way down in a small window and on a big screen alike. With flashing reduced nothing moves or blinks: it fades in and fades across. Only one thing is shown at the top of the view at a time: it waits for "ROUND 4 CLEARED" to leave, and a mission notice waits for it. Pictures 31 and 31b. | End to end, measured on the screen: where it is, how big its lettering is at 1280 x 720 and at 1920 x 1080, that it ends above 42% of the way down (the crosshair is at 50%), that the eye mark is there, that its sound was asked for, that the game went on playing behind it, that the corner banner takes its place and stays until the next round starts. |
| 6 | Make a resisted hit obvious: a larger, clearer word, a deflecting spark, a flash on the plate and its own sound | **RESISTED** is 26 px and bold (it was 11 px), in the colour of the plating that turned the shot, with a dark edge so it reads over a pale floor, and a deflection mark either side. The plate it struck flares white and swells. A spray of long sparks is thrown back off it in the plating's colour, and the round itself glances away as a bright streak. The sound is new: a struck bell and a struck plate, three versions, in place of the soft shimmer it had. The word snaps in once and stays while you keep firing into the same plating, so it does not strobe. Pictures 32 and 32b. | End to end: the word's size, weight, place and colour; that the plate is still flaring a quarter of a second on; that the new sound was asked for; and that a resisted hit throws at least a dozen more sparks than an ordinary one into the same robot. |
| 7 | The heavy looks like plain boxes next to the horde robot: same level of design, with plating seams, pistons and joints, and a head of the same family; keep the glowing chest | Rebuilt. It keeps the horde robot's own body and head underneath and wears armour made for it: a breastplate in two halves that close on an eight-sided housing round the reactor (bolted, with three claws gripping the core), a bank of cooling fins and a hose each side running back to the power pack; strips down the belly that lap one another, one on each joint of the spine; shoulder plates in two layers with a rolled edge between them, carried on a strut from the yoke; a cap over each elbow, plates down the forearms, thighs and shins with a rib down each, a hinged cap over each knee, skirt plates hung from hinges on the hips. The head is the horde robot's head, visor and all, inside a helm: a hood over the brow, a guard round the jaw, a crest. Its numbers, its reactor and where to shoot it are unchanged. Pictures 35 and 35b. | By eye, in the studio viewer from every side and in four poses, and in the game's own light beside one of the horde. The end-to-end checks on the heavy (plating, weak point) pass unchanged. |
| 8 | For Stage 4, not now: I finished with far more scrap than I could spend | Recorded for Stage 4: scrap must have a use all the way through a long run (the boosts, the crate, and weapon upgrades at the bench that can be bought more than once). The models agree with you: in the seven runs I read that ended in round 8, the regular model was carrying between 5,400 and 23,600 scrap with nothing left to spend it on. | |

### Difficulty for a real person

*(This is the record of the tuning after your first playthrough. Its table was superseded by Stage 4's: see "Difficulty, with the economy in" above.)*

**A third model.** You said the skilled model is stronger than a real player like you and that a human is closer to the first-timer. So there is now a **regular** player: nearly the first-timer's hands (it notices a robot in 0.38 s to the first-timer's 0.45, turns a little faster, aims at the body three shots in four, and its aim wanders almost as much) with the habits of someone on their fourth or fifth attempt: it reloads in the lulls, buys the carbine before it starts the uplink, breaks out of a crowd, steps away from a robot that is hitting it from round a corner, and does not back into the yards the robots walk in from. The mission is paced for this one now, not for the skilled one.

**What I read before changing anything.** As in Stage 2, the last seconds of dozens of runs. Two things came out of it.

- *The game:* nobody was being out-shot. They were being **boxed in**. A pack arrives, three or four robots are in reach, and from full health to down took a second and a half (four blows, 0.45 s apart). No person reacts in that.
- *The models:* the new one had habits no person has, and each was fixed before the game's numbers were touched: retreating into the dead-end yards the robots come in by and being cornered there; shooting at a robot six metres away while one it could not see hit it from round the end of a rack; waiting for the round to be nearly over before starting the uplink; leaving the Custodian's key on the floor until there was an eight-metre gap in the fighting; crossing the whole map to top up ammunition before the final stand. The first two are things a beginner really does, so the first-timer model keeps them.

**What was changed in the game** (all of it in `src/config.ts`):

| | Was | Now |
| --- | --- | --- |
| A robot's blow | 30 of your 100 health | **20** |
| Least time between two blows from a crowd | 0.45 s | **0.6 s** |
| So, from full health to down in a crowd | 4 blows, 1.35 s at the quickest | **5 blows, 2.4 s at the quickest**; with four robots round you, about six seconds, measured |
| Health starts coming back after | 4 s | **3 s** |
| A heavy's blow / the Custodian's / the Proxy's | 50 / 34 / 45 | **40 / 28 / 36** |
| Robots on the map at once while you hold the uplink | whatever the round sent (10 to 15 in rounds 5 and 6) | **7 at most**; the rest of the round waits |
| The final stand's horde | 12 at once, one every 1.9 s | **9 at once, one every 2.2 s** |
| The Custodian's health / the Proxy's (times an ordinary robot's) | 6 / 10 | **5 / 8** |
| The Custodian arrives | with round 11 | with the round after you hold the other two keys, never before round 8 (item 4) |

**What was not changed:** the ordinary rounds. How many robots each round sends, how tough they are, how many run and how fast (still just under your sprint in the late rounds, as you asked after Stage 1), the specials, ARGUS's counters, what things cost.

**Where it stands now**, on the final code: 48 missions each by the skilled and the regular model, 16 by the first-timer, and 16 runs of ordinary rounds each by the first-timer and the regular. No god mode, no free scrap. The first two columns are the table you asked for, set beside Stage 3's.

| | Skilled model (48 missions) | First-timer model (16 missions, 16 ordinary runs) | Regular model, new (48 missions, 16 ordinary runs) |
| --- | --- | --- | --- |
| Finished the mission | **43 of 48 (90%)**; it was 17 of 48 (35%) | **4 of 16 (25%)**; it was 0 of 16 | **12 of 48 (25%)** |
| Mission time, of those that finished | **median 11:35** (fastest 10:41, slowest 14:50); it was 17:44 | median 13:15 (12:20 to 14:17) | median 13:19 (11:12 to 14:51) |
| Round the mission ended in | **8** (39 runs) or 9 (4 runs); it was 11 | 8 (3 runs) or 9 (1 run) | 8 (all 12) |
| Reached the final stand | 45 of 48 | 7 of 16; it was 0 | 22 of 48 |
| **Won the final stand** | **43 of 45 (96%)**, taking 1:25 (median); it was 17 of 29 (59%) | 4 of 7 | **12 of 22 (55%)**, taking 3:33 (median: it steps out of the core to recover, and the clock stops) |
| Got the uplink's key | 46 of 48 | 14 of 16; it was 7 of 16 | 38 of 48 |
| Went down in round (attempting the mission) | 8 (median; 3 to 8), of the 5 that went down | **8** (median; 4 to 9), of the 12 that went down; it was 5 | 7 (median; 5 to 9), of the 36 that went down |
| Went down in round (ordinary rounds only) | | **9** (median); 6 of 16 ended by round 8; earliest 4, latest 12; it was 7 | 8 (median); 9 of 16 in rounds 5 to 8; earliest 5, latest 13 |

Where the skilled model's 5 lost runs ended: 2 in round 3 at the key cage, and 3 in round 8 with all three keys (one about to arm the switch, two inside the core during the stand). **None was lost waiting for the Custodian**; in Stage 3 that was 10 of 48.

Where the first-timer's 12 lost missions ended: 2 at the uplink (rounds 4 and 5), 2 in round 7 with two keys in hand, 4 in round 8 with the Custodian destroyed and its key lying on the floor, and 4 in round 8 or 9 with all three keys (one at the core's door, one on its way back into the core, two with the switch armed and not yet pulled).

Where the regular model's 36 lost missions ended: 10 at the uplink in round 5; **10 with two keys in hand, waiting for the Custodian** (5 in round 5, 5 in round 7); 5 in round 8 at the Custodian (one fighting it, four with its key on the floor); and 11 in rounds 8 and 9 with all three keys (one at the core's door, nine in the final stand, four of them inside the core and five on their way back into it, and one with the switch armed).

**Against the spec's three targets, and yours:**

- *A real player can finish the mission with good play and no exploit* (yours). The two models that are meant to be closest to a real person, the first-timer and the regular, each now finish **one mission in four**, where neither finished any before; the skilled model finishes nine in ten. A person who learns the game should land between those. I think one in four for a near-beginner is the right side of "hard", but it is a judgment, and it is a number from models. **One thing in it is yours to decide:** the regular model has both keys by round 5 and then has to live through rounds 5, 6 and 7 before the Custodian may come. Ten of its 48 runs end there. That is the wait you asked me to remove, in a smaller form, and it is your "never before round 8" that keeps it. If you would rather it came as soon as the other two keys are held, whatever the round, that is one number (`MISSION.custodianFromRound`), and I would expect the regular model to finish about one mission in three.
- *A first-time player should usually go down between rounds 5 and 8* (as the spec read). **This one moved, and you have since changed the target to match.** Fighting the ordinary rounds only, the first-timer model's median is now round 9 (it was 7): of its sixteen runs one ended in round 4, one in 7, four in 8, five in 9, two in 10, two in 11 and one in 12. Across four batches on near-identical rules the median was 8, 8, 8.5 and 9. That is the cost of making a crowd survivable. I reported it as over the spec's range; you answered that about round 9 is fine and that easier is the right direction, so `SPEC.md` now reads "around round 9 (between rounds 7 and 10)", which twelve of those sixteen runs meet. The levers are written down in case you ever want it back (`ROUNDS.counts` from round 8 on, or `ROUNDS.runShareMax`, how much of a round runs), **but nothing gets harder unless you ask for it.**
- *A focused player can finish the mission in 15 to 20 minutes, around round 10 to 12.* **No longer, by your choice** (item 4: "a fast mission ending before round 10 is fine"). Every finished mission, by every model, took between 10 and 15 minutes and ended in round 8 or 9. `SPEC.md` now carries that sentence of yours beside the old figure (decision 127).
- *The final stand is hard but winnable.* For the regular model it is exactly that: 12 wins in 22 (55%). For the skilled model it is no longer hard: 43 in 45 (it was 59%).

**How far to trust the regular model.** Less than the other two. Its result moved between 6 wins in 48 and 17 as I changed its habits, on rules that barely changed: whether it waited to own the carbine before starting the uplink was worth more to it than anything I did to the game. The version reported here starts the uplink when it gets there, which is what the tracker tells a person to do. I report it because it is the model nearest to you; I would not lean on its exact number.

**What I would watch when you play it.** Whether five blows feels right, or soft. The models cannot tell me that; they only tell me how far a player with certain hands gets. If the final stand still feels unwinnable to you, the first numbers I would turn are `MISSION.standMax` (9 robots at once) and the Proxy's blow (`MISSION.proxy.damage`, 36). If something now feels too forgiving, tell me which: the ordinary rounds (the first number I would offer to turn back is `ROBOT.attackDamage`, toward 25), or the uplink (seven robots at once is deliberately fewer than the round around it would send, and starting it early has become the safe thing to do). I will not turn any of them up unasked.

### Found on the way, and fixed

- **A second safe spot, and robots on the wrong side of a wall.** In one of 48 missions my regular test player was still "getting back to the core" after 45 minutes. It was standing in the corner behind the lobby's security desk at full health, and nine robots and the Proxy were pressed against the other side of the wall behind it, in the power room. Two faults, one hiding the other. It had squeezed into a corner robots could not enter (see item 2). And a robot told to get "as close as it can" to someone it cannot reach was heading for the nearest floor it could stand on, which was through the brickwork. Robots now make for the nearest floor on the player's side of the wall. My first version of the stand-everywhere check, at 20 cm for a full-width body, had passed this corner: a body sliding along the bin and the desk gets through a gap that samples that far apart step straight over. The check now samples every 10 cm with a slimmer body.
- **The breaker could be thrown through a wall.** It hangs on the power room's south wall, and the lab is behind that wall: from inside the lab, standing against it, the game offered "Restore power". Worse, the lab's weapon rack hangs on the back of the same wall, and the breaker's prompt hid the rack's until the power was on. The check I wrote for the lab's rack found it. A console can now only be used from the room it is in.
- **A slot in the new loading dock** between a container and the barrels in the corner, 80 cm wide: a person fitted and a robot did not. The stand-everywhere check found it the first time it ran. The container now meets the barrels.
- **The loading dock could be seen through from outside.** A room is only drawn while its doors are open, and its walls face inward. From the lobby's open window you looked either at open country where a building should be, or straight into the dock through its missing outside wall. It now has an outside face (concrete plinth, steel cladding, two sodium lamps) that belongs to the lobby and is always there.
- **A browser will not start a fade on something an animation has just moved.** The large banner jumped straight to the corner instead of flying there. It is two boxes now: one arrives, the other carries it away.
- **A held bomber never goes off**, which made my first test of the blast pass for the wrong reason (nothing exploded on either side of the wall). The check now uses one that primes but barely moves.
- **My stand-everywhere check could not step off the far side of a barrel**: someone who drops off a tall thing lands clear of its side, not against it, and the first version only looked one sample away. Its unit test caught it.
- **Three browsers started in the same second**: one timed out loading and a whole batch of missions was lost. Batches now start a few seconds apart, and play a kept copy of the build so that work can go on meanwhile.

## Design decisions made in the Stage 3 feedback

Numbered on from Stage 3's (which ended at 100). None of these was asked as a question; each is mine to defend and yours to overrule.

101. **Where the two areas go.** The dock is west of the server hall, with a short passage up to a goods door in the lobby's west wall; the lab is south of the power room and east of the hall. That gives each new area a door from two different rooms, which is what makes the two new loops (lobby, dock, hall; hall, lab, power room), and it puts the old "loading dock" entrance in the hall's west wall to use: it is now the shutter into the real dock.
102. **The caged key is in the lab**, as you suggested. It makes the lab part of every mission, where otherwise it would be a room some players never opened. The cost is one more door on the mission's path (1000 from the power room, or 1250 from the hall).
103. **The new doors cost what the old ones do**: 1000 for the dock's two and the power room's door to the lab, 1250 for the hall's door to the lab (the same as the hall's other side door). Opening the whole map is 7,250 scrap, up from 3,000.
104. **The new wall weapons are a second carbine (dock) and a second shotgun (lab)**, not new guns. New weapons arrive in Stage 4 with the crate and the bench; until then a second rack means ammunition is never a whole map away.
105. **The dock's bays and the lab's hatch are entrances**, not scenery: robots walk in through two of the three truck bays (the third has the truck in it) and through the hatch the assembly line comes in by, and each room has a ceiling vent as well. Each walk-in has a walled yard behind it, as the old ones do, so nothing is ever seen to appear.
106. **The hall's racks were shortened, not removed.** The rows stop short of the side walls now, which makes a walkway down each side and turns the hall from a comb into a grid. The uplink's corner is unchanged.
107. **The safe spot was closed by changing the jump, not by moving the barrels.** Moving them would have fixed one corner. A jump that cannot mount anything taller than a step fixes every corner on the map, including ones not built yet, and the check now proves it. Space still jumps (the spec lists it); it just does not take you anywhere a robot cannot go.
108. **A robot's blow is still decided by distance, not by line of sight.** A robot on the other side of a rack's end can hit you. Making blows need a clear line would have made every thin obstacle a safe spot.
109. **Low cover does not stop a blast; tall cover does.** A container or a rack between you and a bomber still saves you. A barrel does not.
110. **The Custodian's rule is exactly yours**, with one reading of mine: "the round after I hold the other two keys" means the next round to *start*, so keys taken during the lull before round 8 bring it with round 8. The tracker names the round.
111. **The analysis is on screen twice over**, large and small, and only one is visible at a time. The large one is centred lettering and the small one is right-aligned, so one box could not turn into the other; one arrives and leaves, and the other takes its place.
112. **The large banner is sized from the window**, not in fixed pixels, and from the room there is between the objective box on the left and ARGUS's corner on the right. On a 1920 x 1080 screen its main lines are 36 px; in a 1280 x 720 window, 22 px. It never covers the objective.
113. **One thing at a time at the top of the view.** The analysis waits for a round or mission announcement to finish, and a mission notice waits for the analysis. Nothing is dropped: the notice is shown when the banner shrinks.
114. **The banner stays in the corner until the next round begins**, as you asked, where it used to leave after eight seconds. If no round begins (the debug hold) it goes after twenty.
115. **RESISTED is in the plating's own colour** (green for the sidearm's, orange for the shotgun's, blue for the carbine's, pink for the strike's), so the word and the plates on the robot say the same thing. The other three words under the crosshair (ARMOUR, PLATE, PLATE OFF) are unchanged: you asked about this one, and they are answered by the heavy's and the plate's own look.
116. **The heavy is the Drudge underneath.** Its body and head are the horde robot's own parts, re-finished in bare plate, with the armour added over them. That is what makes them one family, and it is why the heavy's helm has the Drudge's visor in it. Its size, health, speed, plating and weak point are unchanged; only what it looks like is.
117. **A third test player, the "regular"**, and the mission is paced for it. The skilled model stays, because the table you asked for needs it and because it shows the ceiling.
118. **Crowd damage was eased; the rounds were not.** The spec's first-timer target is about the ordinary rounds, so those numbers were left alone, and the change was made where the logs said runs were ending: the second and a half between a pack arriving and the run being over. (It moved the first-timer model all the same, and you have since moved the target: decision 126.)
119. **Fixes to how the test players behave are only given to the ones who would know.** Staying out of the robots' entry yards and stepping away from a robot you cannot see are things a person learns; the first-timer model does not have them. (When it was given them too, it went from round 8 to round 10 in the ordinary rounds, which is not a first-timer.)
120. **The uplink's limit is on the whole map, not on the uplink's own wave.** Seven robots at once, the round's and the uplink's together. Its own wave was never the problem: in rounds 5 and 6 the round itself had ten to fifteen robots converging on someone who is not allowed to leave.
121. **With the dock shut, the Proxy comes in across the front yard.** It is too big for the ducts and needs a way in on foot; the dock's bays are that way when the dock is open, and the main breach is when it is not.
122. **The dock has an outside wall that belongs to the lobby.** See "found on the way". It is the lobby that has the window, so it is the lobby that draws what the window shows.
123. **One sound was replaced and one rebuilt**: the shimmer for a resisted hit gave way to three versions of a struck bell and plate, and the analysis's sound now opens on a sharp burst and a low thump. Both come from packs already credited; the download is unchanged at 17.2 MB.
124. **SPEC.md keeps your words.** The change from four areas to six is added under the original sentence, marked as a change and dated to this feedback, with the two mission changes (the cage, the Custodian) beside it.
125. **The pictures keep their numbers.** 31, 32 and 35 are the ones you named, re-taken; 31b, 32b and 35b are the second state of each; the new areas are 38 to 46. Picture 12 was "the breaker and the cage" and is now "the breaker and the lab door".
126. **The first-timer's target in `SPEC.md` is now "around round 9 (between rounds 7 and 10)"**, changed on your instruction of 16 November. This time the sentence itself was changed, because you asked for the target to be updated; a marked note under it keeps what it said before ("between rounds 5 and 8"), your reason (after your playthrough, easier is the right direction) and your rule (**don't make the game harder again without asking**). "Between rounds 7 and 10" is my wording of your "about round 9": it is the old four-round window moved up by two, and twelve of the model's sixteen runs fall in it.
127. **Your sentence about the mission's length is beside it.** "A fast mission ending before round 10 is fine" (item 4) is recorded under the same paragraph of `SPEC.md`, because the spec's "15 to 20 minutes, around round 10 to 12" is still printed there and no longer describes what you asked for. That original sentence is untouched. You did not ask for this line; strike it if you would rather the spec said nothing.
128. **The two test tools report against what you have decided.** `npm run balance` now counts the runs that end in rounds 7 to 10 (it counted 5 to 8), and `npm run mission` no longer prints how many missions took 15 to 20 minutes. Neither change touches the game.

## Checks run at the end of the Stage 3 feedback

*(As they stood then. The current counts are under "Checks run at the end of Stage 4" above.)*

| Check | Result |
| --- | --- |
| 1. Type-check and production build | Pass, zero errors |
| 2. Unit tests | **191 of 191 pass** in 15 files. New: the Custodian's rule both ways round and what the tracker says about it; the stand-everywhere check on made-up maps (a fenced corner, a low step, a gap a person only just fits, the same at a finer spacing); the map as six areas in three loops with no dead end but the core. |
| 3. Headless browser | **169 of 169 pass** against the production build served from a sub-folder address. What is new is listed below. |
| 4. Screenshots | 49 in `media/stage-3/`, the whole set re-taken, compared by eye with `media/look-target/`. New: 31b, 32b, 35b and 38 to 46. |
| 5. Performance | See below. |
| 6. Credits | Pass: 178 shipped asset files all trace to credited sources (two more than at the end of Stage 3: three versions of the new deflection sound in place of the one it replaces, cut from packs already credited); the credits match `links.txt`; no file tracked by git is a raw download. The two new areas use only models and textures that were already in the game, and shapes made in code. |

*When these were run.* The headless-browser run, the performance report and the screenshots are all from the final build of the game. After them only documents changed, and what the two test tools print at the end of a batch (decision 128). The type-check, the unit tests and the credits check were run again after that, and each of the two tools was run to see that it still works.

**New in the end-to-end test** (20 checks, making 169):

- *Nowhere to hide*: the stand-everywhere check (about 147,000 places; none out of reach); the same check told that jumping onto things still works (it must find the barrel corner); ten runs at the barrels, jumping all the way; a real robot sent to each of the sixteen most awkward places; a bomber across a low barrier and across a wall.
- *The two new areas*: each one's doors, from the plan and from the prompt on screen; its wall weapon bought; its name on the HUD; its ways in. All eight doors bought with F and walked through on foot round the map's three loops at every quality level. A robot from each of the thirteen entrances reaching the player.
- *The Custodian*: not before the other two keys, however late the round; then with the very next round. With the dock shut the Proxy comes in at the front yard; with it open, through a truck bay.
- *The analysis*: where the large banner is and how big, in a small window and on a 1080p screen; its eye mark and its sound; the small banner taking its place; that it stays until the next round begins and then goes.
- *A resisted hit*: the word's size, weight, place and colour; the plate's flare; the sparks counted against an ordinary hit's; the sound.
- *Changed, not new*: going down in a crowd now takes five blows, never two within 0.6 s (it was four, 0.45 s).

### Performance (check 5)

Measured on the production build on an NVIDIA GeForce RTX 4070 SUPER (a fast desktop card), at 1920 x 1080 unless it says otherwise.

**The heaviest moment the game can produce** is the one every stage has measured, with one change that makes it heavier: the horde is in the server hall with **every door on the map open**, and the hall now has a door to each of the other five areas, so all six are being drawn where it used to be three. A third table is new: the same horde in the loading dock, the biggest room.

*A full horde of ordinary robots, in the server hall, every door open* (six areas drawn):

| Quality | Frames per second | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | 283 | 543 | 1.20 M | 22 | 124 | 22 |
| Medium | 218 | 712 | 1.43 M | 23 | 155 | 33 |
| High | 231 | 715 | 1.44 M | 23 | 211 | 33 |
| Ultra | 198 | 738 | 1.48 M | 23 | 183 | 33 |

*The same horde as ARGUS sends it*: two heavies, two bombers and four drones among the 24, and of the sixteen ordinary robots seven shielded against the gun being fired and eight with a plate over the visor.

| Quality | Frames per second | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | 257 | 602 | 1.21 M | 22 | 137 | 44 |
| Medium | 200 | 758 | 1.41 M | 22 | 286 | 55 |
| High | 215 | 758 | 1.42 M | 23 | 266 | 55 |
| Ultra | 162 | 788 | 1.47 M | 22 | 278 | 55 |

*That horde in the loading dock*, with the player by the hall's shutter and the robots coming across the open floor:

| Quality | Frames per second | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | 359 | 351 | 0.79 M | 23 | 112 | 44 |
| Medium | 254 | 474 | 1.06 M | 24 | 130 | 33 |
| High | 262 | 465 | 1.04 M | 23 | 289 | 22 |
| Ultra | 166 | 498 | 1.17 M | 23 | 290 | 22 |

**Smoothness**: ARGUS's horde in the server hall, with the frame rate limited to the screen's, as a player sees it (this screen refreshes 240 times a second, so a perfect frame is 4.2 ms).

| | Quality | Usual frame | Slowest 1% | Worst frame | Frames over 25 ms in 5 s |
| --- | --- | --- | --- | --- | --- |
| 1920 x 1080 | Low | 4.1 ms | 5.3 ms | 6.9 ms | 0 |
|  | Medium | 4.8 ms | 10.0 ms | 18.5 ms | 0 |
|  | High | 4.7 ms | 6.8 ms | 9.9 ms | 0 |
|  | Ultra | 4.8 ms | 9.7 ms | 12.7 ms | 0 |
| 3840 x 2160 | Low | 4.2 ms | 9.5 ms | 13.2 ms | 0 |
|  | Medium | 8.7 ms | 11.2 ms | 17.0 ms | 0 |
|  | High | 9.4 ms | 11.9 ms | 12.4 ms | 0 |
|  | Ultra | 17.6 ms | 21.9 ms | 23.8 ms | 0 |

No frame took longer than 25 ms at either size, at any level. (The 4K rows are there because 4K loads this card about as heavily as 1080p loads a much slower one.)

**First appearances**: the slowest frame in the second after each thing is drawn for the first time, on High.

| First time on screen | Slowest frame in the next second | Frames over 25 ms |
| --- | --- | --- |
| An ordinary robot | 4.8 ms | 0 |
| A robot carrying shielding | 5.9 ms | 0 |
| A robot with a plate over its visor | 4.7 ms | 0 |
| A shot that the shielding turns | 13.1 ms | 0 |
| A drone | 4.9 ms | 0 |
| A heavy | 5.7 ms | 0 |
| A bomber | 5.9 ms | 0 |
| The bomber going off | 6.1 ms | 0 |
| A Custodian | 5.0 ms | 0 |
| The Proxy | 5.1 ms | 0 |
| The ARGUS analysis arriving | 5.3 ms | 0 |
| The analysis shrinking into its corner | 5.1 ms | 0 |

Nothing stalls: the slowest is 13.1 ms (a shot that the shielding turns). **The last two rows are new, and the first of them found something**: the first time the large banner appeared, the picture stopped for about a fifth of a second (frames of 110, 107 and 55 ms, measured). The second time cost nothing. It was the browser preparing, on the graphics card, to draw large soft-shadowed lettering on a faded band, and the game shares that card. The whole HUD is now drawn once, too faint to see, while the title screen is up; the banner's first appearance costs 5.3 ms.

**Against Stage 3, measured the same day.** Frame rates on this machine differ from day to day, so the Stage 3 version was rebuilt as it was and measured today as well. Same scene for both: the ordinary horde in the server hall, every door open.

| | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| Stage 3's report, measured then (three areas drawn) | 302 | 239 | 253 | 182 |
| The Stage 3 version, measured today (three areas drawn) | 304 | 242 | 249 | 182 |
| **This version** (six areas drawn) | **283** | **218** | **231** | **198** |
| This version, an earlier run today | 272 | 179 | 197 | 195 |
| ARGUS's horde: Stage 3 version today / this version | 281 / 257 | 202 / 200 | 222 / 215 | 173 / 162 |

With twice as many rooms being drawn, the heaviest scene is **7% slower on Low, 10% on Medium and 7% on High** than the Stage 3 version measured the same day, and no slower on Ultra, where the graphics card is the limit and one run differs from the next by more than the two versions do. (Two runs of this version today differed from each other by up to a fifth on Medium and High, so read these as "a little slower", not as exact figures.) It is fewer triangles than before, not more: the server hall's shortened rack rows take more out of the picture than the two new rooms, seen through their doors, put in. On this card every level still runs at more than two and a half times the spec's 60 frames a second in its worst case (162, on Ultra, with ARGUS's horde); I have not measured a laptop.

Budgets held: at most 24 robots on the map, the mission's own and the specials included; 22 lamps live at once from the shared pool (8 that can cast shadows, 14 that cannot) plus the muzzle flash and the lamp that travels with the Proxy, however many of the building's 110 lamps are in view; nothing in the two new areas raised either number.

- **Total download: 17.2 MB** of the 40 MB budget (models 8.7, textures 4.9, sound 2.2, code 1.4). It was 17.2 MB at the end of Stage 3: the two areas are built from models and textures already in the game.
- **Time to the title screen**: 3.6 s from local files; 4.0 s at 100 Mbps, 5.2 s at 50 Mbps, 7.9 s at 25 Mbps (simulated).

## Stage 2 feedback: what changed

You approved the mission flow, the objective tracker and marker, the round announcement, the Custodian and the HUMANITY SAVED screen, and listed four things.

| # | You asked for | What was done | How it is checked now |
| --- | --- | --- | --- |
| 1 | Hold the core: the switch only arms while you are inside it, and the timer pauses when you leave, as the uplink's does | Exactly that. Outside the core the clock stops, the tracker reads **GET BACK TO THE CORE** with the time left and "CLOCK STOPPED", and the lights round the dais dim until you are back. The notice now says "HOLD THE CORE FOR 1:15", the prompt at the switch "Hold the core until it is armed". The Proxy is not sent while you are outside, either. | Unit tests of the rule (the clock, what the tracker says, the Proxy waiting). End to end: ten seconds stood in the hall leave the clock where it was (14.4 s, then 14.4 s), and two seconds back inside move it on by two. |
| 2 | The Proxy reads as a dark clump at fighting distance; give it glowing accents of its own and enough light that its shape reads from across the core. (Up close it looks great.) | **Accents of its own**: broad lit seams down its chest and back, bands round its forearms and shins, lit shoulder plates, lights on the sides of its head and a row of eyes over the visor, in the white-hot orange of ARGUS's own iris, not the horde's red. **Light**: from across a room its edges glow pale whatever light it stands in, and a lamp travels with it, lighting its shape and the floor round it. **The close-up is kept**: both of those fade as it closes in, and within two or three metres it is the black machine you approved, with only its seams burning. It also **walks in now** (through the loading dock and the core's door) where it used to drop out of a ceiling duct, sometimes three metres beside you: you see it coming from across the room. | A new check photographs it from 8 m in the core, from the front, the side and behind, against one of the horde on the same spot, and measures how much brighter than the room each is. The old Proxy measured exactly the same as an ordinary robot (+23 steps of brightness out of 255); the new one **+46 to +58**, twice as bright or more, with 80 to 89% of it standing out from what is behind it. Another checks that it comes in at the dock and never falls from above. |
| 3 | ARGUS's eye still glows after the switch is pulled; make it flicker and go dark and let the room's red light die with it | Pulling the switch now kills ARGUS where you can see it. Its eye gutters twice and is out in 1.2 seconds; the red light it threw on the core, the red lights on its racks and its face on the lobby monitors (which change to "ARGUS OFFLINE / MANUAL OVERRIDE ENGAGED") all follow the same number, so none can be left on; and cold working light comes up in the core as the red goes, so the room and what is lying in it can be seen. With "reduce screen shake and flashing" on, it fades without the flicker. The ending card waits 3 seconds, so you watch it happen. | End to end, from a fixed camera on the eye's wall: the eye measures 156 of red (out of 255) before the pull and 18 a second and a half after; the whole picture goes from 1.67 times as red as blue to 0.79. Picture 28 is re-taken two seconds after the pull. |
| 4 | Nothing has fought the mission without god mode. Run a first-timer model and a skilled-player model through it, say how long it takes and how often each wins the final stand, and tune toward the spec | Done; see **"Mission length and difficulty"** below. The short version: the game was about twice too fast and got too hard too suddenly after round 6. After re-tuning, the skilled model finishes **17 missions in 48**; the ones it finishes take **17:44 (median), in round 11**; it wins the final stand **17 times in the 29 it reaches**. The first-timer never finishes and goes down in **round 5** (median) when it attempts the mission, **round 7** when it only fights. | `npm run mission` and `npm run balance` re-produce every number in that section. |

### Mission length and difficulty

*(This is the record of Stage 2's tuning. The numbers in it were superseded by the Stage 3 feedback: see "Difficulty for a real person" above.)*

Two models of a player did this. The **first-timer** is the one from Stage 1: slow to notice a robot, shaky, aims at the body, backs away late, runs when hurt. The **skilled** player is new, and is my stand-in for the spec's "focused player": quick but not instant (0.22 s), mostly on target, goes for the head a little over half the time, sprints clear to reload, keeps both guns loaded and topped up, and gets ready before starting a fight. Both can now play the mission by themselves: they follow the objective tracker, hold the uplink's ring and the core, step out to recover and come back, and pull the switch. Two tools play whole runs with them, with no god mode and no free scrap, without drawing anything: `npm run balance` (ordinary rounds) and `npm run mission` (the whole mission).

**What they found first was wrong with the models, not the game.** At arm's length they nearly stopped shooting: their aim was held to a standard meant for distant targets, every change of target restarted their reaction time, and they went on using the strike long after it had stopped destroying a robot in one blow. That made every model go down in the same round for an artificial reason. Fixing it, and then reading the last seconds of dozens of their runs, turned up more habits no real player has: letting both guns run dry with 13,000 scrap in the bank, standing at a door they had just opened (a real bug in the autopilot: it kept following a route worked out while the door was shut), topping up a nearly full magazine with robots three steps away, backing into corners, and, once ARGUS existed, swapping guns for every other target. Each was fixed before the game's numbers were touched. I am telling you this because it is the main risk in this section: **the numbers below are only as good as the models**.

**What was wrong with the game:**

- It was about **twice too fast**. Round 10 started six and a half minutes in; the spec wants the mission to end at fifteen to twenty, around round 10 to 12.
- It got **too hard too suddenly**. The "damage per second the rounds demand" grew by about 35 to 40% a round after round 5 (robots arriving faster, each tougher, more of them running). So skill bought almost nothing: the first-timer went down in round 6, the skilled model in round 8, and a model that never misses in round 9.
- **The uplink was a trap**: its ring sits in a corner of the hall with a ceiling vent inside it, and a full extra wave came on top of whatever round it was. The skilled model died there four times in twelve; the first-timer almost every time.
- **The final stand could not be won**: 0 wins in 12 for the skilled model with a full loadout. Half the horde were sprinters, in a room twelve metres across.

**What was changed** (all of it in `src/config.ts`; decisions 75 to 80 below give every number):

- Rounds are longer: more robots, arriving a little slower, with a 15-second lull. Round 5 now starts at about 3 minutes, round 8 at 7, round 10 at 10, round 11 at 12.
- The climb after round 6 is gentler: toughness nearly levels off, arrivals stop speeding up at round 9, and no more than half the horde runs. **Runners still reach just under your sprint speed in the late rounds**, as you asked after Stage 1; I tried capping them below walking pace first, saw that it contradicted that instruction, and put them back.
- The uplink's ring is wider (8.5 m, was 6.5), and its extra wave grows with the round: none in rounds 1 and 2, one robot at a time in rounds 3 to 5, two in 6 to 8, up to four from round 12.
- The final stand's horde presses in at a walk, with one runner in five; twelve at once. The Proxy is the thing that hunts. It has ten times an ordinary robot's health (was twelve).
- The Custodian arrives with round 11 (was 8). That, more than anything, is what puts the end of the mission past fifteen minutes.

**Where it stands now**, on the final code, with everything in Stage 3 switched on (specials and ARGUS's counters): 48 missions by the skilled model, 16 by the first-timer, and 16 runs of ordinary rounds by the first-timer. No god mode, no free scrap.

| | Skilled model (48 missions) | First-timer model (16 missions, 16 ordinary runs) |
| --- | --- | --- |
| Finished the mission | **17 of 48 (35%)** | 0 of 16 |
| Mission time, of those that finished | **median 17:44** (fastest 16:34, slowest 21:57); 13 of 17 between 15 and 20 minutes | |
| Round the mission ended in | **11** (median); 17 of 17 in rounds 10 to 12 | |
| Reached the final stand | 29 of 48 | 0 of 16 |
| **Won the final stand** | **17 of 29 (59%)**, taking 1:35 (median) from arming the switch to pulling it | never reached it |
| Got the uplink's key | 45 of 48 | 7 of 16 |
| Went down in round (attempting the mission) | 11 (median; 4 to 12), of the 31 that went down | **5** (median; 4 to 8); 15 of 16 in rounds 5 to 8 |
| Went down in round (ordinary rounds only) | | **7** (median); 14 of 16 (88%) in rounds 5 to 8; earliest 3, latest 8 |

Where the skilled model's lost runs ended: 13 before the Custodian came (ten of them in rounds 8 to 10, fighting the rounds with two keys in hand; one each, in rounds 4 to 6, at the breaker, in the uplink's ring and on the way back to it), 6 in round 11 or 12 with the Custodian down or the core open but the switch not yet armed, and 12 in the final stand (8 inside the core, 4 on their way back into it).

Where the first-timer's missions ended: 9 at the uplink (6 holding its ring, 3 on their way back to it), in rounds 4 to 6, and 7 with two keys in hand, in rounds 5 to 8, waiting for a Custodian that does not come until round 11.

**Against the spec's three targets:**

- *A first-time player should usually go down between rounds 5 and 8.* Met by the model both ways of playing. When it only fights: median round 7, 14 of 16 runs in rounds 5 to 8 (the other two went down in round 3). When it attempts the mission: median round 5, 15 of 16 in rounds 5 to 8 (the other in round 4). Attempting the mission costs it about two rounds because it starts the uplink as soon as it can, in round 4; nine of its sixteen runs ended there, six of them before it had bought the carbine. A real first-timer may well not find the uplink that early.
- *A focused player can finish the mission in 15 to 20 minutes, around round 10 to 12.* Met for time and round. The 17 missions it finished took a median of 17:44 and every one ended in round 11 or 12; 13 of the 17 took between 15 and 20 minutes, and the other four between 20:33 and 21:57 (runs in which it stepped out of the core to recover, which stops the clock). **It finishes about one mission in three: 17 of 48.** I think that is the right side of "can finish" for a mission that is meant to be the hard thing in the game, but it is your call, and it is one number in a model.
- *The final stand is hard but winnable.* The skilled model wins it 17 times in the 29 it reaches (59%), in about a minute and a half. Played by itself forty times from a full loadout, it won 22 (55%). Before the changes described above it was 0 in 12. Every loss now comes in the fight itself. None comes with the switch ready, which is where my test player had been throwing runs away (see "found on the way" below).

**What I would watch when you play it:** the ten minutes between the uplink and the Custodian. The model that finishes one mission in three loses 10 of its 48 runs there, all in rounds 8 to 10, to the ordinary rounds with ARGUS's counters and the first heavy on them, before the mission asks anything more of it. That is where a focused player's run is most likely to end, and it is where I am least sure the model is a fair stand-in: it is a carbine specialist (about 70% of its damage), so ARGUS shields against the carbine from round 6 on in most runs, and it answers that less nimbly than a person would. If those rounds feel too hard to you, the quickest levers are in `src/config.ts`: how much of a round is shielded (`ARGUS.shielding.share`, 0.4), the heavy's health (`SPECIALS.heavy.health`, 4), and the round the Custodian comes in (`MISSION.custodianFromRound`, 11). If the final stand feels wrong, the Proxy's blow is the first thing I would turn (`MISSION.proxy.damage`, 45: three of them and you are down).

### Found on the way, and fixed

- **The Proxy could land beside you.** It was sent to "the core", whose only ways in are two ceiling ducts. See item 2.
- **The autopilot could stand at a door for ever.** It keeps a route of its own; when a door opened, that route was not thrown away. In ordinary play its next errand usually hid this; in the mission it could wait at the core's door until a robot happened to distract it. The map of the floor now counts its own changes, and anything that keeps a route compares the count.
- **The test's own helper was sabotaging the Proxy fight.** It struck every 0.7 seconds at close range, and a strike cancels a reload, so with a crowd round it it barely fired. One run in several took four minutes of "fire" to fail. It now waits for a reload to finish.
- **The profile card could list a counter for a round that never came.** ARGUS chooses its counters in the lull, and a run that ended before the next round began (the switch pulled, for one) still listed them. I saw it on the last screenshot of the set: "rounds 10 to 12" on a card that said the run reached round 11. The card now lists a counter only for rounds that began, and a check holds it to that.
- **The glass on the lamps was costing a megabyte of memory a frame.** Found while asking where the occasional single slow frame came from; it has been there since the first stage. See "Three things found by measuring" in the performance section: the heaviest scene now runs at 229 frames a second where it ran at 188.
- **My test player would not pull the switch.** With the switch armed and a robot standing between it and the console, the skilled model pushed at the robot's chest for four seconds and went down, a metre and a half from the switch with a loaded shotgun in its hands. No person does that: the prompt reaches two and a half metres. It now presses F as soon as the prompt is offered, and deals with a robot at arm's length before walking through it. In the final stand played by itself forty times it won 15 before the change and 22 after. A difference that size in forty is suggestive, not proof; but in about seventy stands since, it has not once gone down with the switch ready.
- **Sixteen runs are too few to judge the mission by.** Three batches on identical rules finished 6 of 16, 2 of 32 and 5 of 32. I had been reading differences of that size as the effect of my changes. The numbers in this document come from 48 missions, and I say how many runs each number is from.
- **Things shown for a set time on the HUD must count real time.** ARGUS's banner first counted the game's clock, which the debug tools stop and step, and so was gone before any screenshot could catch it. (The round announcement already did this right.)

## Stage 3: what is built

**ARGUS watches, adapts and says so.** This is **rule-based game AI, not machine learning**: a handful of counts compared with fixed thresholds, all in one plain file (`src/sim/argus.ts`) with a unit test for every rule.

- **What it tracks, each round**: damage by weapon (the strike counts as one), hits on weak points, time spent holding one spot (within 4.5 m for 10 s or more), and laps run (back within 3.5 m of where you were at least 8 s ago, having covered 25 m and been 8 m away). Only while there are robots on the map.
- **Four counters**, chosen in the lull, from round 3, at most two at once, the strongest evidence first:

| It notices | When | The counter | How it shows | How you beat it |
| --- | --- | --- | --- | --- |
| You lean on one weapon | 60% of a round's damage | **Shielding**: 4 in 10 ordinary robots take half damage from that weapon | Plates of light round the chest in that weapon's colour (sidearm green, shotgun amber, carbine blue, strike magenta); "RESISTED" under the crosshair | The other gun or the strike. Spread your damage and it is withdrawn |
| You hold one spot | 45% of the round | **Flushing out**: 2 extra bombers; half the round comes in at the entrance nearest you | The bombers; robots arriving close by | Move; shoot the bombers among their own |
| You run the horde in circles | 3 laps | **Interception**: 4 extra drones sent in ahead of the way you are running | The drones, from in front | Change direction; stand and fight |
| You land many weak-point hits | 40% of hits | **Guarding**: half the ordinary robots wear a plate over the visor; a hit there is a body hit until the plate has taken 45% of a robot's health | The plate, with a lit edge; "PLATE", then "PLATE OFF" when it flies off | Shoot it off, or shoot the body |

- A counter stays while the habit does ("Maintaining") and goes the round after you stop ("Withdrawing: ..."). None is a hidden boost: a plated head never takes less than a body shot would, and the tests hold it to that.
- **The ARGUS ANALYSIS banner**: 3.2 seconds into the lull, on the right of the screen (your objective is on the left), for 8 seconds, without pausing the game. "Observed: 77% of damage from the carbine. Adapting: carbine-resistant plating."
- **Remarks**: 17 things it may comment on, 23 lines, never repeated, at least 18 seconds apart.
- **"ARGUS's profile of you"**: a card offered on the game-over and HUMANITY SAVED screens: a play-style label (the Marksman, the Fortress, the Runner, the Specialist, the Brawler, the Improviser), six numbers, every counter it used and in which rounds, the round reached, whether humanity was saved, and the web address of the page.
- **When the switch is pulled it is off**: no more analysis, counters or remarks.

**Three special robots**, built in code on the same skeleton as the ordinary one, mixed in as the rounds climb. They take the place of ordinary robots (never more than a third of a round) and are spread through it.

| | From round | How many | What it does | Its answer |
| --- | --- | --- | --- | --- |
| **Drone** | 4 | 2, +1 every 2 rounds, up to 6 | Flies at head height at 5.2 m/s; a third of a robot's health; stings for 12 | One or two shots |
| **Bomber** | 6 | 1, up to 3 | Runs at 3.9 m/s; within 2.4 m it primes (beeping, lights beating) and 0.8 s later goes off: up to 60 damage, reaching 4.5 m | Back away (it costs almost nothing), or shoot it first: it goes off among its own, and their destruction is paid to you |
| **Heavy** | 8 | 1; 2 from round 12 | 1.35 m/s; four times the health; plating turns 70% of a hit; 50 a blow; only ever walks in | The reactor glowing in its chest takes full weak-point damage |

**Also new**: a word under the crosshair when a hit does less than it might (RESISTED, ARMOUR, PLATE, PLATE OFF); nine sounds (the blast, the bomber's beep, the drone, shielding, the plate, the banner, the remark); debug tools to put any kind of robot on the map and to read what ARGUS has noted.

## Design decisions made in Stage 3

Numbering continues from Stage 2's list further down. The first group came out of your feedback.

69. **The switch arms only while you are in the core.** (Supersedes decision 61's "you may leave the core".) The Proxy is not sent while you are outside.
70. **The Proxy's own light comes up with distance.** You said the close-up was right and the distance was wrong, so the close-up was left alone: beyond 6.5 m everything is on, within 2.5 m a fifth of the edge glow and an eighth of the lamp are left. Its lit seams and bands are there at any distance.
71. **The Proxy walks in**, at the loading dock (or the main entrance, if you could see the dock), never by the power room, whose doors are lower than it is. It reaches the core's door about nine seconds after the notice.
72. **ARGUS dies in 1.2 seconds, guttering twice.** Two flashes in a second is inside what is safe to show; the reduced-flashing setting removes them. Cold light comes up as the red goes, or the room would be black. The ending card waits 3 seconds (was 2.5).
73. **One lamp for two jobs.** The light that travels with the Proxy is also the flash of a bomber's blast (the two never happen together: the rounds stand aside during the final stand). The number of lights in the building never changes mid-game, which is what keeps the picture from stalling.
74. **Three player models.** The "skilled" one is my reading of "a focused player"; it is described above and in `src/debug/Autopilot.ts`. If you think a focused player is better or worse than that, its numbers are one line.
75. **Rounds, re-tuned again** (supersedes 48): 6, 10, 14, 18, 23, 29, 35, 40, 46, 52 robots, then 6 more a round; one arrival every 2.6 s in round 1, quickening to every 2.0 s by round 9 and no further; a 15-second lull; health 70 in round 1, +26 a round to round 6 (200), then +3% a round.
76. **Runners**: from round 5; 8% more of the horde each round, up to half; 3.4 m/s rising 0.31 a round to 6.0 by round 14 (you sprint at 6.4). Your Stage 1 instruction stands.
77. **The uplink**: ring 8.5 m; one extra robot every 5 s, as many at once as the round allows (0, 1, 2, 3, 4 from rounds 1, 3, 6, 9, 12).
78. **The final stand**: one robot every 1.9 s, 12 at once, walking, one in five running; the Proxy at 10 seconds with 10 times a robot's health.
79. **The Custodian arrives with round 11** (supersedes 58).
80. **ARGUS's counters are for the rounds.** What the mission sends in (the wave at the uplink, the final stand) does not carry shielding or plates. I tried it the other way: the stand, which had been tuned to about one win in two, went to one in eleven.

ARGUS and the specials:

81. **Rule-based, and it says so**: in the README, in the guide, on the first line of the code.
82. **The thresholds** (60% of damage, 45% of the round, 3 laps, 40% of hits) are high enough that an ordinary mixed round triggers nothing. A round with too little to go on (under 300 damage, 10 hits or 12 seconds) is not judged.
83. **The first two rounds always get shielding against the sidearm at round 3**, because the sidearm is all you have. I left that in: it is the game teaching the rule early, and the shotgun is affordable by then.
84. **Two counters at most, and a counter is not sticky.** ARGUS reads only the round just played. That makes it easy to beat, on purpose: the spec asks for "beatable by changing how I play", and a player who has just worked out what it wants should see it work in the very next round.
85. **"Behind you" means the entrance nearest you that you cannot see**, not literally behind your back; and "ahead" means in front of the way you are *moving*, which for someone leading a horde is usually not the way they are looking. Neither ever overrides the rule that no robot is created in view.
86. **A heavy cannot use a ceiling duct**, and is as tall as will still pass under the power room's doors (it was shortened for that).
87. **The bomber does not strike**: its blow is the blast. One that goes off by itself is nobody's kill but still counts toward clearing the round.
88. **Drones use the floor's routes.** They fly at head height but go round what a walking robot goes round, so they can never be somewhere a route does not reach.
89. **The banner is on the right; the words under the crosshair are plain** (RESISTED, ARMOUR, PLATE). Colour alone would not tell a colour-blind player which gun a shield is against; the word and the banner do.
90. **The profile's style is judged over the whole run, against bars set from the counters' thresholds**: 40% of hits on weak points (the Marksman), 45% of the fighting spent holding one spot (the Fortress), three laps for every minute and a half of fighting (the Runner), three quarters of all damage from one gun (the Specialist: a higher bar than the 60% that brings shielding in a single round, because nearly everyone's best gun does most of the damage over a run), 30% of damage done by hand (the Brawler). The habit furthest past its bar is the label. With none past its bar you are "the Improviser", which is the best thing it can call you.
91. **The end screens gained one button** ("ARGUS'S PROFILE OF YOU") and the game-over panel is 100 pixels wider to fit three in a row. Nothing else on those approved screens changed.
92. **The card prints the page's address without "https://"**, so it is short enough to read off a screenshot. In the screenshots here it shows the test server's address; on the published site it will show that site's.
93. **ARGUS is off after the switch.** The rounds you fight on through are plain: specials, no counters, no remarks. The monitors say ARGUS OFFLINE and it would be odd if it went on talking.
94. **Nine new sounds, all cut from the Kenney packs already credited.** No new downloads in this stage.
95. **Screenshots go to `media/stage-3/`.**
96. **The speed report's "heaviest moment" is two scenes now**: the full horde of ordinary robots, kept so that one stage can be set beside another, and the same horde as ARGUS sends it (specials, shielding, plates), which is the heavier. Smoothness is measured on the heavier one. The report also puts each new thing on screen for the first time and looks for a stall.
97. **A shield is one piece and a plate is two** (its steel, and its lit edge), where they were four and six: found by that second scene. And the spare robot the game keeps under the floor wears one of each, so their shaders are built while the game loads and stay built between rounds.
98. **See-through, two-sided surfaces are drawn in one go.** That is the glass on lamps, cameras and extinguishers, the muzzle flash, the shaft of light over a dropped key, the uplink's ring and ARGUS's shielding. Drawing each twice (backs, then fronts) only matters where one part of a see-through object can be seen through another part of it, and none of these is big enough or solid enough for that to show: I compared the screenshots before and after. This touches the approved look in principle, so it is listed here and in the things to look at.
99. **A plate casts no shadow of its own, and a robot's scrap has its own copy of the robot's material.** Both for the same reason: a material used in turn by a mesh with bones and a mesh without has its shader swapped at every turn.
100. **The skilled model is corrected, not the game**, where a death came from something no person would do (decision 74, and "found on the way" above). The game's numbers were not changed after the 48-mission measurement.

## Checks run at the end of Stage 3

*(As they stood when Stage 3 was first handed over. The current counts are under "Checks run at the end of the Stage 3 feedback" above.)*

| Check | Result |
| --- | --- |
| 1. Type-check and production build | Pass, zero errors |
| 2. Unit tests | **183 of 183 pass** in 15 files. New: ARGUS's rules (30 tests: what it writes down, each habit and its threshold, the analysis and its wording, withdrawal, remarks, the profile), what a round is made of (13), shielding, plating and the plate over a weak point (13), the uplink's wave. |
| 3. Headless browser | **149 of 149 pass** against the production build served from a sub-folder address. What is new is listed below. |
| 4. Screenshots | 37 in `media/stage-3/`, compared by eye with `media/look-target/`. |
| 5. Performance | See below. |
| 6. Credits | Pass: 176 shipped asset files all trace to credited sources (9 more than at the end of Stage 2: the new sounds, cut from packs already credited); the credits match `links.txt`; no file tracked by git is a raw download. |

**New in the end-to-end test** (24 checks, making 149):

- *Your feedback*: the clock stopping outside the core; the Proxy coming in on foot at the dock; the Proxy measured from 8 m against one of the horde; ARGUS's eye and red light measured before and after the pull.
- *Each counter can be seen and beaten*: a sidearm shot on a robot shielded against the sidearm does 14 of its 28 and the screen says RESISTED, while a strike does its full 150. Three shots on a plated head do 28 each (PLATE), the third knocks the plate off (PLATE OFF), and the next does 61.6. A shot on the heavy does 61.6 to its core, 8.4 to its helmet (ARMOUR) and 6.7 to a leg.
- *The specials*: a drone hangs 1.5 m off the floor, crosses 4 m in a second and goes down to one shot. A bomber primes 2.3 m off and goes off 0.8 s later: a player who stood still is left with about 53 health, one who backed away with about 86. A bomber shot first destroys the three robots standing round it, and all four are paid for.
- *What a round is made of*: no specials in rounds 1 to 3; drones from 4, a bomber from 6, a heavy from 8; with each counter in force the right share of the round carries it and arrives carrying it; bombers and drones are added for flushing and interception; "behind" at the main breaker is the power room's vent, "ahead" is on the side you are running toward, and there is no "ahead" standing still.
- *A real analysis, played*: a round fought with the sidearm alone; the banner reads "OBSERVED: 100% of damage from the sidearm. ADAPTING: sidearm-resistant plating."; the game does not pause; round 3 arrives with shielded robots. Then a round split between the sidearm and the strike: the banner reads "You changed your approach. WITHDRAWING: sidearm-resistant plating." and round 4 arrives unshielded.
- *The remark* after the first kill, and none straight after it.
- *The profile card*, reached by real clicks from the game-over screen and from HUMANITY SAVED: the label, the six numbers, the counter used in that run with its round, the stamp (ARGUS WINS / HUMANITY SAVED), the page's own address, and BACK. A counter goes on the card when its round begins, not when it is chosen. After the switch ARGUS is off, and three more rounds add no analysis.

### Performance (check 5)

Measured on the production build on an NVIDIA GeForce RTX 4070 SUPER (a fast desktop card), at 1920 x 1080 unless it says otherwise.

**The heaviest moment the game can produce** is measured two ways now, frame rate uncapped.

*A full horde of ordinary robots* is the scene every stage has measured, so it can be set beside Stage 2's: the most robots ever allowed on the map (24), closing on the player in the server hall with every door open so three areas are in view, the carbine firing without pause.

| Quality | Frames per second | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | 302 | 519 | 1.31 M | 23 | 91 | 11 |
| Medium | 239 | 711 | 1.52 M | 22 | 166 | 33 |
| High | 253 | 720 | 1.56 M | 24 | 136 | 33 |
| Ultra | 182 | 742 | 1.66 M | 23 | 103 | 33 |

*The same horde as ARGUS sends it* is new, and is the heaviest thing Stage 3 can put on screen: two heavies, two bombers and four drones among the 24, and of the sixteen ordinary robots seven shielded against the gun being fired and eight with a plate over the visor.

| Quality | Frames per second | Draw calls | Triangles | Robots | Particles | Scrap pieces |
| --- | --- | --- | --- | --- | --- | --- |
| Low | 294 | 599 | 1.28 M | 22 | 116 | 33 |
| Medium | 217 | 738 | 1.51 M | 23 | 231 | 33 |
| High | 233 | 763 | 1.51 M | 23 | 283 | 44 |
| Ultra | 171 | 728 | 1.60 M | 24 | 86 | 22 |

ARGUS's horde costs 3 to 9% of the frame rate: up to 80 more separate things to draw than the ordinary horde (the count depends on what is in view at the moment it is taken), and more sparks and scrap.

**Smoothness**: the heavier scene, with the frame rate limited to the screen's, as a player sees it (this screen refreshes 240 times a second, so a perfect frame is 4.2 ms). An average can hide stutter; this looks at the slowest frames instead.

| | Quality | Usual frame | Slowest 1% | Worst frame | Frames over 25 ms in 5 s |
| --- | --- | --- | --- | --- | --- |
| 1920 x 1080 | Low | 4.2 ms | 5.1 ms | 5.9 ms | 0 |
|  | Medium | 4.2 ms | 5.9 ms | 16.8 ms | 0 |
|  | High | 4.2 ms | 5.7 ms | 9.8 ms | 0 |
|  | Ultra | 5.6 ms | 7.1 ms | 9.9 ms | 0 |
| 3840 x 2160 | Low | 4.7 ms | 8.6 ms | 11.5 ms | 0 |
|  | Medium | 11.2 ms | 13.8 ms | 14.1 ms | 0 |
|  | High | 12.4 ms | 16.2 ms | 17.6 ms | 0 |
|  | Ultra | 21.3 ms | 25.0 ms | 32.7 ms | 1 |

The 4K rows are there because 4K loads this card about as heavily as 1080p loads a much slower one. No frame at 1920 x 1080 took longer than 25 ms at any level, and Low, Medium and High now hold this screen's 240 a second in the heaviest scene. At 4K on Ultra, where a usual frame is already about 20 ms, one frame in the five seconds took 32.7 ms; the second run of the report had one of 28.1 ms in the same row, and the Stage 2 version measured between them one of 25.7 ms. Those are the pauses described under "Three things found by measuring" below.

**First appearances** (new in the report): does the picture stall the first time a thing is drawn? In a fresh page, on High, each kind of robot and each of ARGUS's counters is put in front of the camera for the first time, and the slowest frame in the second that follows is reported. The usual frame is 4.2 ms; one frame at 60 a second is 16.7 ms.

| First time on screen | Slowest frame in the next second | Frames over 25 ms |
| --- | --- | --- |
| An ordinary robot | 5.0 ms | 0 |
| A robot carrying shielding | 5.4 ms | 0 |
| A robot with a plate over its visor | 5.2 ms | 0 |
| A shot that the shielding turns | 9.8 ms | 0 |
| A drone | 5.1 ms | 0 |
| A heavy | 6.0 ms | 0 |
| A bomber | 6.1 ms | 0 |
| The bomber going off | 8.9 ms | 0 |
| A Custodian | 4.9 ms | 0 |
| The Proxy | 5.6 ms | 0 |

Nothing stalls: the slowest is 9.8 ms (a shot that the shielding turns).

**Against Stage 2, measured the same day.** Frame rates on this machine differ from day to day, so the Stage 2 version was rebuilt as it was and measured today, between two runs of this one. Same scene for all: the ordinary horde.

| | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| Stage 2's report, measured then | 258 | 186 | 198 | 175 |
| The Stage 2 version, measured today | 290 | 206 | 221 | 189 |
| This version earlier today, before the fixes below | 292 | 210 | 222 | 191 |
| **This version** | **302** | **239** | **253** | **182** |
| This version, measured again | 308 | 233 | 253 | 180 |

Like for like, this version is **faster than Stage 2 wherever the processor is the limit**: 4% on Low, 16% on Medium and 14% on High. That is the first of the three fixes below. **On Ultra, where the graphics card is the limit, it is the same.** The report's two-second window read 182 and 180 against the Stage 2 version's 189, which is inside the spread between runs, so I checked two other ways. Second-by-second traces of the two versions lie on top of each other (182 to 197 frames a second from the second to the sixth second of the horde for this version, 185 to 193 for Stage 2). And switching the glass fix off and on four times in one session gives 203 either way on Ultra, and 237 against 286 on High.

**Three things found by measuring, and fixed.** The report had only ever used ordinary robots and only ever looked at frame times. Adding ARGUS's horde to it, and then asking where the occasional single slow frame in the Stage 2 tables came from, turned up three things:

1. **The glass on the lamps was being drawn twice, and its shader chosen afresh every time.** The drawing library draws a see-through, two-sided surface in two goes and marks its material as changed for each; a changed material has its shader looked up again and every light handed to the graphics card again. About fourteen small panes of glass (lamps, cameras, fire extinguishers) were doing that four times a frame each. It has been in the game since the first stage. It cost about a megabyte of throw-away memory a frame (190 MB a second in a heavy fight), and the browser's pauses to clear that up are, as far as I can tell, the single slow frames. They are now drawn in one go, which looks the same (decision 98).
2. **Each of ARGUS's plates was six separate things to draw (five of them casting shadows) and each shield four.** With both on the horde that was 243 to 275 more things to draw than the ordinary horde; a shield is now one and a plate two, and it is at most 80.
3. **A plate's own small shadow made the shadow pass change shaders at every plated robot.** It casts none now; the head behind it already does.

Together, in the heaviest scene, played for 40 seconds on High at the screen's own rate: **229 frames a second where it was 188, 106 MB of memory a second thrown away where it was 190, and a worst frame of 16.5 ms where it was 21.8**.

Frame rate in ARGUS's horde, uncapped, at each step:

| | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| As first measured | 227 | 168 | 171 | 148 |
| Shields and plates each one piece | 250 | 185 | 183 | 184 |
| **Glass drawn once, plates casting no shadow** | **294** | **217** | **233** | **171** |

(These fixes are all on the processor's side, and on Ultra the graphics card is the limit: the last two rows of the Ultra column differ by no more than one run of the report differs from the next.)

What is left of the throw-away memory (about 100 MB a second in the heaviest scene) is mostly the drawing library handing all 24 lights to each of about 60 shaders whenever the view moves, the ambient-occlusion pass walking the whole scene several times a frame, and my own per-robot update. Those are Stage 5 work, and now there is a tool that shows them.

**Something I got wrong today, and what it did to these numbers.** A test run I started in the small hours (a balance run with the never-missing model) was still alive nineteen hours later: stopping the command that started it had not stopped the hidden browser it was playing in. Every speed measurement I made before finding it was about 15% low (this version's ordinary horde read 257 / 184 / 189 / 164 with it running and 292 / 210 / 222 / 191 an hour later without it). Everything in this section was measured after it was stopped, with nothing else of mine running. I now check for leftovers before measuring. It may also be part of the day-to-day difference the Stage 2 notes could not explain; I cannot prove that after the fact.

Budgets held: at most 24 robots on the map, the mission's own and the specials included; 24 lights live at once (one more than at Stage 2: the lamp that travels with the Proxy and doubles as the flash of a bomber's blast), a number that never changes during play, 4 of them casting shadows on Ultra, 3 on High and Medium, 2 on Low; at most 900 glowing and 320 smoke particles, 160 bullet decals, 48 casings, 72 scrap pieces, all pooled and recycled. Lower quality levels cut shadows, effects and resolution, never the number of robots.

- **Total download: 17.2 MB** of the 40 MB budget (models 8.7, textures 4.9, sound 2.1, code 1.4).
- **Time to the title screen**: 3.6 s from local files; 3.7 s at 100 Mbps, 5.0 s at 50 Mbps, 7.7 s at 25 Mbps (simulated).

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

*As written at the end of Stage 2, and left as it was. Where something here differs from the Stage 2 feedback table or from decisions 69 to 100 above (leaving the core during the final stand, how the Proxy arrives, the Custodian's round, the round sizes, the uplink's ring and wave, the final stand's horde), the ones above are current.*

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
npm run shots          re-take the screenshots (media/stage-5)
npm run social         re-take the link preview picture and the icons
npm run balance        whole runs of ordinary rounds, played by a model of a first-time player
npm run mission        the whole mission with no god mode, played by a model of a player (and what it bought)
npm run hop            a player who does nothing but hop a barrier: do the robots still get them?
npm run perf           performance and smoothness report
npm run check:credits  licensing check
```

`npm run balance -- 16 firstTimer` and `npm run mission -- 16 skilled` (or `firstTimer`, or `expert`) choose how many runs and which model. Everything from `npm run e2e` down needs `npm run build` first. The headless browser they use is installed inside `node_modules` (the scripts point at it themselves).
