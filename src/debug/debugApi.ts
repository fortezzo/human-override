// Debug mode, only switched on when the page is opened with ?debug=1.
//
// It adds four keys for a person testing by hand (god mode, free scrap,
// skip the round, autopilot) and a small API on window.__HO that the
// automated tests and the screenshot script use to drive the game, since
// they cannot hold a mouse.

import * as THREE from 'three';
import type { QualityLevel, WeaponId } from '../config';
import { PLAYER, QUALITY, ROBOT, WEAPONS } from '../config';
import type { Action } from '../core/input';
import { setEdgeLight } from '../entities/robot/robotMaterial';
import type { Game } from '../game/Game';
import type { SurfaceKind } from '../render/materials';
import { remaining } from '../sim/rounds';
import { findSafeSpots, groupSafeSpots } from '../sim/safeSpots';
import { BREACH } from '../world/lobby/plan';
import { AREA_IDS, DOCK, DOOR_PLANS, EAST_BREACH, ENTRY_PLANS, HALL, LOBBY, NAV_BOUNDS, POWER, ROOM_RECTS, WALKABLE, WALL, type DoorPlan } from '../world/plan';
import { PLAYER_START } from '../world/lobby/plan';
import { Autopilot, PILOTS, type PilotName } from './Autopilot';

export interface DebugState {
  state: string;
  round: number;
  phase: string;
  remaining: number;
  scrap: number;
  earned: number;
  spent: number;
  weapon: WeaponId;
  slots: Array<WeaponId | null>;
  ammo: number;
  reserve: number;
  area: string;
  doors: Record<string, boolean>;
  prompt: { text: string; cost: number | null; usable: boolean } | null;
  health: number;
  kills: number;
  robots: Array<{ x: number; z: number; alive: boolean; entry: string; area: string }>;
  position: { x: number; z: number };
  lights: string[];
  autopilot: string;
}

export interface DebugApi {
  ready: boolean;
  /**
   * The round announcement on the HUD (connected by main.ts, which owns the
   * HUD): hold it at a moment so many seconds in (null lets it run on), and
   * report what it is showing and what the corner counter reads.
   */
  announcement: {
    freezeAt(seconds: number | null): void;
    status(): { showing: 'none' | 'start' | 'clear'; seconds: number; counter: string };
  } | null;
  game: Game;
  /** Start playing without capturing the mouse. */
  play(): void;
  /** Start a new run from round 1 (as "Play again" does). */
  restart(): void;
  /** Park the camera somewhere and look in a direction (degrees). */
  view(x: number, y: number, z: number, yawDeg: number, pitchDeg: number, fov?: number): void;
  /** Hand the camera back to the player. */
  releaseView(): void;
  /** Put the player somewhere, facing a direction (degrees). */
  place(x: number, z: number, yawDeg: number, pitchDeg?: number): void;
  /** Turn the player to look at the nearest robot's head or chest. Returns false if there is none. */
  aimAtRobot(part: 'head' | 'chest'): boolean;
  /** Hold or release a control, as if a key or button were pressed. */
  press(action: Action, down: boolean): void;
  /** Press a control for one frame. */
  tap(action: Action): void;
  /** Advance the game by `frames` steps of `dt` seconds, drawing each. */
  step(dt: number, frames?: number): void;
  /** Stop or resume the automatic frame loop. */
  freeze(frozen: boolean): void;
  /** Remove every robot, or add one at a spot facing `headingDeg`. */
  clearRobots(): void;
  spawnRobot(x: number, z: number, headingDeg?: number, hold?: boolean, speed?: number, health?: number): void;
  setQuality(level: QualityLevel): void;
  god(on: boolean): void;
  /** Free scrap. */
  scrap(amount: number): void;
  /** End the current round at once. */
  skipRound(): void;
  /** Open a door without paying. */
  openDoor(id: DoorPlan['id']): void;
  /** Send every robot in through one entry point (its id), or null for the usual rules. */
  forceEntry(id: string | null): void;
  /** Stop the rounds from sending robots (for staged screenshots). */
  holdRounds(on: boolean): void;
  /**
   * Let the game play itself: as the "expert" that never misses (the
   * default), or as the "firstTimer", a rough model of a beginner.
   */
  autopilot(on: boolean, pilot?: PilotName): void;
  /** Advance the game without drawing it (much faster; for playing whole runs in a tool). */
  simulate(dt: number, frames?: number): void;
  /**
   * Walk the player to a spot on foot (no teleport), then turn to face
   * (lookX, lookZ) if given. `walking()` is true until they have arrived.
   */
  walkTo(x: number, z: number, lookX?: number, lookZ?: number): void;
  walking(): boolean;
  /**
   * Places the player can stand that no robot can get within reach of,
   * grouped into patches (centre, size in squares of floor, how far out of
   * reach the deepest point is). There should be none.
   */
  safeSpots(): Array<{ x: number; z: number; squares: number; deepest: number }>;
  /**
   * Holes in the rooms. Each area is drawn only while it can be seen, so
   * it has to be closed off by its own walls: if a stretch of its wall is
   * really the back of a neighbour's, that stretch vanishes whenever the
   * neighbour is not being drawn, and the sky shows through. This looks
   * from the middle of each room toward points inside each other room,
   * through that room's own walls and the doors only, and reports how many
   * of those lines of sight get through. Every count should be zero.
   */
  enclosureGaps(): Record<string, number>;
  /**
   * Things standing across a doorway. Looks straight through each of the
   * four doors (as if open) and each opening robots walk in by, along a
   * fine grid of lines, and reports how many of them hit something. Every
   * count should be zero: a rail along a wall once carried on across the
   * doorways in it.
   */
  doorwayObstructions(): Record<string, number>;
  /** Broken pixels in each room's reflection photograph, at every size in use. All should be zero. */
  brokenReflections(): Record<string, number>;
  /**
   * Put a small object that draws broken pixels (not-a-number) at a point,
   * or remove it again with no arguments. For proving that one bad pixel
   * cannot black out a room.
   */
  poison(x?: number, y?: number, z?: number): void;
  /** Hide the weapon and HUD for clean photographs of the room. */
  photoMode(on: boolean): void;
  /** Film grain off (or back on), so pictures can be measured without its noise. */
  grain(on: boolean): void;
  /** The robots' edge light off (or back on), to show what it is worth. */
  edgeLight(on: boolean): void;
  /**
   * Where each living robot is on screen: a box round it in pixels of the
   * page, and how far away it is. Robots behind the camera are left out.
   */
  robotBoxes(): Array<{ x0: number; y0: number; x1: number; y1: number; distance: number }>;
  /** Hold every lamp at full brightness, so pictures can be compared. */
  steadyLights(on: boolean): void;
  /** Leave a bullet scar and sparks on a surface. */
  scar(x: number, y: number, z: number, nx: number, ny: number, nz: number, kind: SurfaceKind): void;
  stats(): { fps: number; calls: number; triangles: number; quality: string; gpu: string; robots: number; particles: number; gibs: number; state: string; health: number; ammo: number; aim: number; reticle: number; flash: boolean };
  /** Everything a test needs to know about the run. */
  run(): DebugState;
}

declare global {
  interface Window {
    __HO?: DebugApi;
  }
}

/** Keys for testing by hand, shown in the debug overlay. */
const KEYS = { god: 'Digit7', scrap: 'Digit8', skip: 'Digit9', autopilot: 'Digit0' };
const FREE_SCRAP = 2000;

export interface DebugTools {
  /** Lines for the on-screen overlay. */
  overlay(): string[];
}

export function installDebugApi(game: Game): DebugTools {
  const pilot = new Autopilot(game);
  const setAutopilot = (on: boolean, name: PilotName = 'expert') => {
    if (!on) pilot.release();
    pilot.profile = PILOTS[name];
    game.autopilot = on ? pilot : null;
  };
  /** True while the pilot is only running an errand for a test, not playing. */
  let onErrand = false;
  let poison: THREE.Mesh | null = null;

  game.input.onKey(KEYS.god, () => (game.godMode = !game.godMode));
  game.input.onKey(KEYS.scrap, () => game.grantScrap(FREE_SCRAP));
  game.input.onKey(KEYS.skip, () => game.skipRound());
  game.input.onKey(KEYS.autopilot, () => setAutopilot(!game.autopilot));

  window.__HO = {
    ready: false,
    announcement: null,
    game,
    play() {
      game.input.locked = true;
      game.setState('playing');
    },
    restart() {
      game.restart(false);
      game.input.locked = true;
      game.setState('playing');
    },
    view(x, y, z, yawDeg, pitchDeg, fov) {
      game.debugCamera = { position: new THREE.Vector3(x, y, z), yaw: THREE.MathUtils.degToRad(yawDeg), pitch: THREE.MathUtils.degToRad(pitchDeg), fov };
    },
    releaseView() {
      game.debugCamera = null;
    },
    place(x, z, yawDeg, pitchDeg = 0) {
      game.player.position.set(x, 0, z);
      game.player.velocity.set(0, 0, 0);
      game.player.yaw = THREE.MathUtils.degToRad(yawDeg);
      game.player.pitch = THREE.MathUtils.degToRad(pitchDeg);
    },
    aimAtRobot(part) {
      const eye = game.camera.position;
      let best: THREE.Vector3 | null = null;
      let bestDistance = Infinity;
      for (const robot of game.robots) {
        if (!robot.alive) continue;
        const bone = robot.bones.get(part === 'head' ? 'Head' : 'Spine1');
        if (!bone) continue;
        const point = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
        if (part === 'head') point.y += 0.08;
        const distance = point.distanceTo(eye);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = point;
        }
      }
      if (!best) return false;
      const dx = best.x - eye.x;
      const dy = best.y - eye.y;
      const dz = best.z - eye.z;
      game.player.yaw = Math.atan2(-dx, -dz);
      game.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      return true;
    },
    press(action, down) {
      if (down) game.input.press(action);
      else game.input.release(action);
    },
    tap(action) {
      game.input.press(action);
      game.frame(1 / 60);
      game.input.release(action);
    },
    step(dt, frames = 1) {
      for (let i = 0; i < frames; i++) game.frame(dt);
    },
    freeze(frozen) {
      if (frozen) game.stop();
      else game.start();
    },
    clearRobots() {
      game.clearRobots();
    },
    spawnRobot(x, z, headingDeg = 0, hold = false, speed, health) {
      const plan = game.director.rounds.plan;
      const robot = game.addRobot(x, z, THREE.MathUtils.degToRad(headingDeg), { health: health ?? plan.health, speed: speed ?? plan.walkSpeed });
      robot.hold = hold;
      robot.root.rotation.y = THREE.MathUtils.degToRad(headingDeg);
    },
    setQuality(level) {
      game.setQuality(level, false);
    },
    god(on) {
      game.godMode = on;
    },
    scrap(amount) {
      game.grantScrap(amount);
    },
    skipRound() {
      game.skipRound();
    },
    openDoor(id) {
      game.world.openDoor(id);
    },
    forceEntry(id) {
      game.director.forceEntry = id;
    },
    holdRounds(on) {
      game.director.paused = on;
    },
    walkTo(x, z, lookX, lookZ) {
      if (!game.autopilot) {
        onErrand = true;
        game.autopilot = pilot;
      }
      pilot.walkTo(x, z, lookX === undefined || lookZ === undefined ? null : { x: lookX, z: lookZ }, onErrand);
    },
    walking() {
      if (pilot.walking) return true;
      if (onErrand) {
        // The errand is done: hand the controls back.
        onErrand = false;
        setAutopilot(false);
      }
      return false;
    },
    brokenReflections() {
      return game.brokenReflectionPixels();
    },
    enclosureGaps() {
      const raycaster = new THREE.Raycaster();
      raycaster.firstHitOnly = true;
      // With every door shut, whatever state the run is in.
      for (const door of game.world.doors) door.pose(0);
      const doors = game.world.doors.flatMap((door) => door.solids);
      const from = new THREE.Vector3();
      const to = new THREE.Vector3();
      const gaps: Record<string, number> = {};
      for (const a of AREA_IDS) {
        const own = [...game.world.areas.get(a)!.solids, ...doors];
        const [ax0, az0, ax1, az1] = ROOM_RECTS[a];
        for (const b of AREA_IDS) {
          if (a === b) continue;
          const [bx0, bz0, bx1, bz1] = ROOM_RECTS[b];
          let through = 0;
          // From a few spots inside this room, at eye height ...
          for (const [fu, fv] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.7], [0.3, 0.75], [0.7, 0.25]] as const) {
            from.set(ax0 + (ax1 - ax0) * fu, 1.6, az0 + (az1 - az0) * fv);
            // ... toward a grid of points well inside the other room, low and high.
            for (let i = 1; i < 12; i++) {
              for (let j = 1; j < 12; j++) {
                for (const y of [0.4, 1.6, 3.2, 4.4]) {
                  to.set(bx0 + ((bx1 - bx0) * i) / 12, y, bz0 + ((bz1 - bz0) * j) / 12);
                  const distance = from.distanceTo(to);
                  raycaster.set(from, to.clone().sub(from).divideScalar(distance));
                  raycaster.far = distance;
                  if (!raycaster.intersectObjects(own, false).length) through++;
                }
              }
            }
          }
          gaps[`${a} toward ${b}`] = through;
        }
      }
      for (const door of game.world.doors) door.settle();
      return gaps;
    },
    doorwayObstructions() {
      const raycaster = new THREE.Raycaster();
      raycaster.firstHitOnly = true;
      // With every door open, whatever state the run is in.
      for (const door of game.world.doors) door.pose(1);
      const ways: Array<{ name: string; along: 'x' | 'z'; at: number; from: number; to: number; top: number }> = [
        ...DOOR_PLANS.map((d) => ({ name: d.id as string, along: d.along, at: d.at, from: d.from, to: d.to, top: d.top - 0.15 })),
        // The openings robots walk in through, up to head height (a jammed shutter hangs in the top of each).
        { name: 'entrance', along: 'x', at: LOBBY.z0 - WALL / 2, from: BREACH.x0, to: BREACH.x1, top: 1.85 },
        { name: 'dock', along: 'z', at: HALL.x0 - WALL / 2, from: DOCK.z0, to: DOCK.z1, top: 1.85 },
        { name: 'breachEast', along: 'z', at: POWER.x1 + WALL / 2, from: EAST_BREACH.z0, to: EAST_BREACH.z1, top: 1.85 },
      ];
      const origin = new THREE.Vector3();
      const blocked: Record<string, number> = {};
      for (const way of ways) {
        const through = way.along === 'x' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
        let count = 0;
        // Straight through the wall, from just outside one face to just
        // outside the other, on a grid fine enough to catch a 3 cm bar.
        for (let u = way.from + 0.2; u <= way.to - 0.2 + 1e-6; u += 0.1) {
          for (let y = 0.15; y <= way.top; y += 0.03) {
            if (way.along === 'x') origin.set(u, y, way.at - 0.45);
            else origin.set(way.at - 0.45, y, u);
            raycaster.set(origin, through);
            raycaster.far = 0.9;
            if (raycaster.intersectObjects(game.world.solids, false).length) count++;
          }
        }
        blocked[way.name] = count;
      }
      for (const door of game.world.doors) door.settle();
      return blocked;
    },
    safeSpots() {
      const cell = 0.15;
      const spots = findSafeSpots(
        NAV_BOUNDS,
        game.world.nav.cell,
        cell,
        game.world.openColliders,
        WALKABLE,
        ENTRY_PLANS.map((entry) => entry.at),
        { radius: ROBOT.radius + 0.06, stepHeight: 0.3, height: 1.8 },
        { radius: PLAYER.radius, stepHeight: PLAYER.stepHeight, height: PLAYER.height },
        [PLAYER_START.x, PLAYER_START.z],
        // A robot strikes when its centre is within this of the player's.
        ROBOT.attackRange - 0.15,
      );
      return groupSafeSpots(spots, cell);
    },
    poison(x, y, z) {
      if (poison) {
        game.scene.remove(poison);
        poison.geometry.dispose();
        (poison.material as THREE.Material).dispose();
        poison = null;
      }
      if (x === undefined || y === undefined || z === undefined) return;
      // Nothing divided by nothing: the textbook way to make "not a number".
      // (The zero arrives as a uniform so the shader compiler cannot tidy it away.)
      poison = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 12, 8),
        new THREE.ShaderMaterial({
          uniforms: { uZero: { value: 0 } },
          vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform float uZero; void main() { gl_FragColor = vec4(vec3(uZero / uZero), 1.0); }',
        }),
      );
      poison.position.set(x, y, z);
      game.scene.add(poison);
    },
    simulate(dt, frames = 1) {
      for (let i = 0; i < frames; i++) game.frame(dt, false);
    },
    autopilot(on, name) {
      setAutopilot(on, name);
    },
    grain(on) {
      game.renderer.grade.grain = on ? QUALITY[game.qualityLevel].filmGrain : 0;
    },
    edgeLight(on) {
      setEdgeLight(on);
    },
    robotBoxes() {
      const boxes: Array<{ x0: number; y0: number; x1: number; y1: number; distance: number }> = [];
      const point = new THREE.Vector3();
      const width = window.innerWidth;
      const height = window.innerHeight;
      for (const robot of game.robots) {
        if (!robot.alive) continue;
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        let behind = false;
        for (const bone of robot.bones.values()) {
          point.setFromMatrixPosition(bone.matrixWorld).project(game.camera);
          if (point.z > 1) behind = true;
          const x = (point.x * 0.5 + 0.5) * width;
          const y = (-point.y * 0.5 + 0.5) * height;
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
        if (behind) continue;
        const distance = robot.root.position.distanceTo(game.camera.position);
        // The body stands a little proud of its joints.
        const pad = (0.12 / Math.max(distance, 0.5)) * (height / (2 * Math.tan(THREE.MathUtils.degToRad(game.camera.fov) / 2)));
        boxes.push({ x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad, distance });
      }
      return boxes;
    },
    photoMode(on) {
      game.hideWeapon = on;
      document.querySelector('.hud')?.classList.toggle('photo', on);
    },
    steadyLights(on) {
      game.lights.steady = on;
    },
    scar(x, y, z, nx, ny, nz, kind) {
      game.debugScar(new THREE.Vector3(x, y, z), new THREE.Vector3(nx, ny, nz).normalize(), kind);
    },
    stats() {
      const { calls, triangles } = game.renderer.stats;
      return {
        fps: Math.round(game.fps),
        calls,
        triangles,
        quality: game.qualityLevel,
        gpu: game.renderer.gpuName,
        ...game.counts,
        state: game.state,
        health: Math.round(game.player.health),
        ammo: game.weapons.state.ammo,
      };
    },
    run() {
      const { director, wallet, weapons, world, interactions, player, stats } = game;
      const prompt = interactions.prompt;
      return {
        state: game.state,
        round: director.rounds.round,
        phase: director.rounds.phase,
        remaining: remaining(director.rounds),
        scrap: wallet.scrap,
        earned: wallet.earned,
        spent: wallet.spent,
        weapon: weapons.def.id,
        slots: weapons.loadout.slots.map((slot) => slot?.id ?? null),
        ammo: weapons.state.ammo,
        reserve: weapons.state.reserve,
        area: world.playerArea,
        doors: Object.fromEntries(world.doors.map((door) => [door.plan.id, door.open])),
        prompt: prompt ? { text: prompt.text, cost: prompt.cost, usable: prompt.usable } : null,
        health: Math.round(player.health),
        kills: stats.kills,
        robots: game.robots.map((robot) => ({ x: robot.position.x, z: robot.position.z, alive: robot.alive, entry: robot.entry, area: world.areaOf(robot.position.x, robot.position.z) })),
        position: { x: player.position.x, z: player.position.z },
        lights: game.lights.liveNames,
        autopilot: game.autopilot ? pilot.status : 'off',
      };
    },
  };

  return {
    overlay() {
      const { director } = game;
      const plan = director.rounds.plan;
      return [
        `DEBUG  [7] god mode ${game.godMode ? 'ON' : 'off'}  [8] +${FREE_SCRAP} scrap  [9] skip round  [0] autopilot ${game.autopilot ? 'ON' : 'off'}`,
        `round ${director.rounds.round} (${director.rounds.phase}${director.paused ? ', held' : ''})  robots ${game.robots.length} on map, ${remaining(director.rounds)} left  health ${plan.health}  speed ${plan.walkSpeed.toFixed(2)}${plan.runShare > 0 ? ` / ${plan.runSpeed.toFixed(2)} x${Math.round(plan.runShare * 100)}%` : ''}`,
        `${WEAPONS[game.weapons.def.id].name}  area ${game.world.playerArea}  lights ${game.lights.liveNames.length}${game.autopilot ? `  autopilot: ${pilot.status}` : ''}`,
      ];
    },
  };
}
