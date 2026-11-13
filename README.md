# HUMAN OVERRIDE

**Don't let the AI win.**

A first-person survival shooter that runs in the browser. One human holds a facility against endless rounds of AI-controlled robots while trying to reach the only manual kill switch for ARGUS, a rogue AI that has taken over the world's networks. Inspired by classic round-based survival modes; every name, place and design in it is original.

> **Status: Stage 0 of 5, the look test.** One finished room, one robot, one rifle. This stage exists to lock down how the game looks, sounds and feels before the rest is built on top of it. The rounds, the scrap economy, the mission and ARGUS's adaptive behaviour are designed (see [SPEC.md](SPEC.md)) but not built yet. [PROGRESS.md](PROGRESS.md) tracks exactly what exists.

![A robot walks in through the breached entrance](media/look-target/02-first-contact.jpg)

| | |
| --- | --- |
| ![Robot up close](media/look-target/03-robot-close.jpg) | ![Firefight](media/look-target/08-firefight.jpg) |
| ![A destroyed robot breaks into scrap](media/look-target/09-destroyed.jpg) | ![The blast door to the server hall](media/look-target/04-server-hall-door.jpg) |

## Play it

You need [Node.js](https://nodejs.org/) 20 or newer.

```
npm install
npm run dev
```

Your browser opens the game. Click **ENTER THE LOBBY** to start. It needs a mouse and keyboard; on a phone it shows the title scene and a note instead.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look |
| Left click | Fire |
| Right click | Aim down sights |
| R | Reload |
| Shift | Sprint |
| Space | Jump |
| Esc | Pause, settings and credits |
| M | Mute |

Graphics quality is chosen automatically and steps down by itself if the frame rate drops. You can also pick a level in the pause menu.

## What is in Stage 0

- **The security lobby**, built from real-world surfaces: worn concrete, steel plate, rusted beams, ducts, pipe runs, hazard paint, a monitor wall ARGUS has taken over, and the breached entrance robots come through.
- **Lighting and atmosphere**: warm pools from the old pendant lamps against a hard cold floodlight from the yard, red emergency lamps, moonlight through a torn-open window, fog, light shafts, drifting dust, real-time shadows, reflections baked from the room itself, ambient occlusion, bloom, a filmic grade and film grain.
- **One robot**: a worn-metal humanoid with glowing eyes that walks in, finds its way around obstacles, attacks, flinches and staggers when hit, takes extra damage to the head, and breaks apart into scrap and sparks.
- **One rifle**: recoil, spread, tracers, muzzle flash that lights the room, ejected casings, aim-down-sights, reload, bullet holes and sparks on whatever it hits.
- **Sound**: layered recorded gunshots, impacts, robot footsteps and servos placed in 3D, a room reverb, and a low ambient and music bed.
- **Four quality levels** from integrated graphics to a gaming GPU, an FPS counter, a pause menu with settings, and credits.

## What is coming

Built stage by stage, each one played and approved before the next begins:

1. **Core loop**: the whole four-area map, rounds, scrap, wall weapons, doors, melee, game over and restart.
2. **The mission**: restore power, recover three override keys, survive the final stand, pull the kill switch.
3. **ARGUS**: the AI that studies how you play, adapts its tactics between rounds and tells you what it noticed. This is **rule-based game AI, not machine learning**: a set of readable rules that watch things like which weapon you rely on and whether you hold one spot, and pick visible counters you can beat by changing how you play.
4. **The full economy**: shutters and repairs, boost stations, the prototype crate, the overclock bench, pickups, swarm rounds, grenades.
5. **Polish**: feel, balance, performance, loading time and final docs.

## How it is put together

| Folder | What lives there |
| --- | --- |
| `src/config.ts` | Every tuning number in the game, in one file |
| `src/sim/` | The rules, with no graphics in them: weapon timing, robot decisions, path-finding, collision, hit tests. Unit-tested. |
| `src/game/` | The frame loop that ties everything together |
| `src/entities/` | The player, the rifle, the robot |
| `src/world/` | The level: a small kit for building rooms, and the security lobby itself |
| `src/render/` | Renderer, materials, lights, atmosphere, post-processing |
| `src/fx/` | Particles, bullet decals, shell casings |
| `src/audio/` | Sound engine and the list of sounds |
| `src/ui/` | HUD and menus |
| `tools/assets/` | The asset pipeline: downloads free source assets and converts them into small game files |
| `tools/` | Automated checks: end-to-end test, screenshots, performance report, credits check |
| `tests/` | Unit tests |

Built with [three.js](https://threejs.org/), TypeScript (strict) and Vite. No backend, accounts, analytics or API keys: `npm run build` produces a plain static site with relative paths that works from any folder address.

For a plain-English tour of how the game works under the hood, see [HOW_IT_WORKS.md](HOW_IT_WORKS.md).

## Checks

```
npm run build          type-check and production build
npm test               unit tests for the rule modules
npm run e2e            drives the built game in a headless browser and checks it end to end
npm run shots          re-takes the reference screenshots in media/look-target
npm run perf           frame rate at each quality level, start-up time and download size
npm run check:credits  every shipped asset traces to a credited source; nothing raw is in git
```

Add `?debug=1` to the address to expose the debug hooks those scripts use.

## Credits

Every third-party asset, with its author, source and license, is listed in [CREDITS.md](CREDITS.md) and in the game's pause menu. Everything is CC0, CC-BY or under the SIL Open Font License, plus the robot character and animations from Adobe Mixamo, which ship only in converted, re-skinned form.

Rebuilding the assets from source (`npm run assets:fetch`, then `npm run assets:build`) needs the Mixamo and Sketchfab downloads placed in `assets-source/`, which is deliberately kept out of this repository. The converted game files in `public/assets` are committed, so this is not needed to play or to work on the code.

## How this was built

Designed and directed by Christian Fortezzo. The code was written by [Claude Code](https://claude.com/claude-code), Anthropic's AI coding agent, working stage by stage from Christian's specification and feedback. Art and sound come from the free sources credited in [CREDITS.md](CREDITS.md).
