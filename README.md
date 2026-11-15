# HUMAN OVERRIDE

**Don't let the AI win.**

A first-person survival shooter that runs in the browser. One human holds a facility against endless rounds of AI-controlled robots while fighting through to the only manual kill switch for ARGUS, a rogue AI that has taken over the world's networks. Inspired by classic round-based survival modes; every name, place and design in it is original.

> **Status: Stage 2 of 5, the mission.** The whole map, rounds that grow, scrap, three weapons and a melee strike, doors to buy, and now the mission from first breaker to kill switch, with endless rounds after it. ARGUS's adaptive behaviour and the rest of the economy are designed (see [SPEC.md](SPEC.md)) but not built yet. [PROGRESS.md](PROGRESS.md) tracks exactly what exists, what was decided and what is still rough.

![Round eight: a full horde comes through the breach](media/stage-2/05-horde.jpg)

| | |
| --- | --- |
| ![A new round is announced](media/stage-2/19-round-announcement.jpg) | ![The final stand: ARGUS's Proxy in the core](media/stage-2/26-mission-final-stand.jpg) |
| ![Holding the uplink](media/stage-2/24-mission-uplink.jpg) | ![The Custodian, carrying an override key](media/stage-2/25-mission-custodian.jpg) |
| ![The kill switch, armed](media/stage-2/27-mission-kill-switch.jpg) | ![Every robot powers down](media/stage-2/28-mission-powered-down.jpg) |
| ![The server hall](media/stage-2/10-server-hall-from-uplink.jpg) | ![Humanity saved](media/stage-2/29-humanity-saved.jpg) |

## Play it

You need [Node.js](https://nodejs.org/) 20 or newer.

```
npm install
npm run dev
```

Your browser opens the game. Click **PLAY**. It needs a mouse and keyboard; on a phone it shows the title scene and a note instead.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look |
| Left click | Fire |
| Right click | Aim down sights |
| R | Reload |
| V | Melee strike |
| F | Use what the prompt offers: buy, open, take, start, pull |
| 1, 2 or the mouse wheel | Switch weapon |
| Shift | Sprint (uses stamina) |
| Space | Jump |
| Esc | Pause, settings and credits |
| M | Mute |

Graphics quality is chosen automatically and steps down by itself if the frame rate drops. You can also pick a level in the pause menu.

## How a run goes

- You start in the security lobby with a sidearm and no scrap. A few seconds later round 1 comes through the breached entrance.
- **Scrap** is the currency: 10 for a hit, 60 for a kill, 100 for a kill through the head, 130 for a melee kill.
- Spend it at **wall racks** (a shotgun in the lobby for 750, a carbine in the server hall for 1500, ammunition for either, sidearm ammunition for 100) and on **doors** (750 to 1250) that open up the server hall and the power room. You carry two weapons.
- Every round sends more robots, tougher and faster. From round 5 some of them run, and by round 13 the runners nearly match your sprint. Sprinting drains a **stamina** bar, so running buys time, not safety. Open more of the map and they find more ways in: a loading dock, a breach in the power room wall, ceiling vents. You will never see one appear: they come from behind cover outside, or drop from vents you are not watching.
- Health comes back if you stay out of reach for a few seconds. When it runs out, the run is over and the game shows how far you got.

## The mission: save humanity

An objective tracker and a marker in the world always show the next step.

1. **Restore power** at the main breaker in the power room.
2. **Recover three override keys**, in any order: one from the key cage beside the breaker (its lock needs power); one from the uplink in the server hall, by holding the ground around it for 60 seconds while ARGUS throws robots at you; one carried by the **Custodian**, an elite machine that arrives in round 8.
3. **Unseal the core** with the keys, **arm the kill switch**, and survive the 75 seconds it takes: a constant horde, and ARGUS's own unit, the **Proxy**.
4. **Pull the switch.** Every robot on the map powers down. Then end the run, or keep fighting endless rounds for a higher score.

Your best round and your fastest mission time are remembered on the title screen.

## What is in the game so far

- **Four areas**: the security lobby, a server hall of blinking racks, a power room running on emergency lamps, and the core where ARGUS's eye watches over the kill switch.
- **Robots**: a hunched, armor-plated machine with a glowing visor, built in code on a motion-captured skeleton, and two elites built on the same frame. They find their way around obstacles and each other, hurry in from outside, drop from vents, attack, flinch and stagger when hit, take extra damage to the head, and break apart into scrap and sparks. Up to 24 at once.
- **Weapons**: a sidearm, a shotgun that fires nine pellets a shell, an automatic carbine with a reflex sight whose reticle stays on the point of aim, and a melee jab. Recoil, spread, tracers, muzzle flashes that light the room, ejected casings, bullet holes and sparks on whatever is hit.
- **The mission**: a breaker, a key cage, an uplink to defend, two elite robots, a final stand, an ending, and endless play after it.
- **A round announcement** timed to its sound: the number snaps in behind a scan line, holds, and flies to the round counter. It respects the reduced-flashing setting.
- **Lighting and atmosphere**: warm pools from old pendant lamps against a hard cold floodlight from the yard, red emergency lamps, fog, light shafts, drifting dust, real-time shadows, reflections baked from each room, ambient occlusion, bloom, a filmic grade and film grain.
- **Sound**: 85 layered recorded sounds placed in 3D, a room reverb, and a low ambient and music bed.
- **Four quality levels** from integrated graphics to a gaming GPU, equally bright at every level, with the same robots and rules at every level.

## What is coming

Built stage by stage, each one played and approved before the next begins:

3. **ARGUS**: the AI that studies how you play, adapts its tactics between rounds and tells you what it noticed. This is **rule-based game AI, not machine learning**: a set of readable rules that watch things like which weapon you rely on and whether you hold one spot, and pick visible counters you can beat by changing how you play.
4. **The full economy**: shutters and repairs, boost stations, the prototype crate, the overclock bench, pickups, swarm rounds, grenades.
5. **Polish**: feel, balance, performance, loading time and final docs.

## How it is put together

| Folder | What lives there |
| --- | --- |
| `src/config.ts` | Every tuning number in the game, in one file |
| `src/sim/` | The rules, with no graphics in them: rounds, scrap and purchases, the mission's steps, the two-weapon loadout, which areas connect and where robots may enter, stamina, weapon timing, player movement, robot decisions, path-finding, collision. Unit-tested. |
| `src/game/` | The frame loop, and the parts that run a match: the director that sends robots in (and never where you can see), the mission, combat, purchases, the run's statistics |
| `src/entities/` | The player, the weapons and their sights, the robot, the kit its body is built from, and the three robot designs |
| `src/world/` | The level: a small kit for building rooms, the four areas, their doors, and the mission's moving parts |
| `src/render/` | Renderer, materials, the light pool, atmosphere, post-processing |
| `src/fx/` | Particles, bullet decals, shell casings |
| `src/audio/` | Sound engine and the list of sounds |
| `src/ui/` | HUD, the round announcement and menus |
| `src/debug/` | Debug mode and the autopilot |
| `tools/assets/` | The asset pipeline: downloads free source assets and converts them into small game files |
| `tools/` | Automated checks: end-to-end test, screenshots, performance report, balance runs, credits check |
| `tests/` | Unit tests |

Built with [three.js](https://threejs.org/), TypeScript (strict) and Vite. No backend, accounts, analytics or API keys: `npm run build` produces a plain static site with relative paths that works from any folder address. The only thing stored is your settings, best round and fastest mission time, in your own browser.

For a plain-English tour of how the game works under the hood, see [HOW_IT_WORKS.md](HOW_IT_WORKS.md).

## Checks, and how a game written by an AI gets tested

The code was written by an AI agent that cannot pick up a mouse, so the project carries its own proof.

```
npm run build          type-check and production build
npm test               126 unit tests for the rule modules
npm run e2e            125 checks that drive the built game in a headless browser
npm run balance        whole runs played by a model of a first-time player
npm run shots          re-takes this stage's screenshots in media/stage-2
npm run perf           frame rate, smoothness, start-up time and download size
npm run check:credits  every shipped asset traces to a credited source; nothing raw is in git
```

The end-to-end run plays **the whole mission**: it restores power, takes the key from the cage, holds the uplink for its sixty seconds, destroys the Custodian and picks up its key, unseals the core, arms the switch, destroys the Proxy, pulls the switch, checks every robot has gone down, and then fights on through three more rounds. It makes every kind of purchase and checks what each one charged, sends a robot through each of the eight entrances and waits for it to reach the player in each area, goes down without god mode, and restarts three times in a row looking for anything left behind.

It also checks things about the building that were first found by eye: that every room is sealed by its own walls, that nothing stands across a doorway, that a robot in the darkest corner still stands out from what is behind it, and that **no robot is ever created where the player can see it**, with the player stood staring at each entrance in turn.

Then it does it the way a visitor would: real clicks on the real buttons, the browser really capturing the mouse, and every key on the controls list really pressed. That last part is not decoration. It found that sprinting had never made the player any faster, which the scripted checks had walked straight past.

![Debug mode: the autopilot fighting through round three](media/stage-2/17-debug-autopilot.jpg)

**Debug mode**: add `?debug=1` to the address for an overlay and five keys: **6** next mission step, **7** god mode, **8** free scrap, **9** skip to the next round, **0** autopilot.

Measured on an NVIDIA GeForce RTX 4070 SUPER at 1920 x 1080 with the most robots the game allows (24) on screen: 258 / 186 / 198 / 175 frames a second on Low / Medium / High / Ultra. The whole game is a 17.0 MB download and reaches its title screen in 4.9 seconds on a 50 Mbps connection. A model of a first-time player, played sixteen times, went down between rounds 5 and 7, with a median of round 5 (the target is rounds 5 to 8). The full tables are in [PROGRESS.md](PROGRESS.md).

## Credits

Every third-party asset, with its author, source and license, is listed in [CREDITS.md](CREDITS.md) and in the game's pause menu. Everything is CC0, CC-BY or under the SIL Open Font License, plus the robot's skeleton and movements from Adobe Mixamo. The robot's body itself is original, built by the game's own code; no Mixamo character model is in the game.

Rebuilding the assets from source (`npm run assets:fetch`, then `npm run assets:build`) needs the Mixamo and Sketchfab downloads placed in `assets-source/`, which is deliberately kept out of this repository. The converted game files in `public/assets` are committed, so this is not needed to play or to work on the code.

## How this was built

Designed and directed by Christian Fortezzo. The code was written by [Claude Code](https://claude.com/claude-code), Anthropic's AI coding agent, working stage by stage from Christian's specification and feedback. Art and sound come from the free sources credited in [CREDITS.md](CREDITS.md).
