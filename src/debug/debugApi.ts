// Debug mode, only switched on when the page is opened with ?debug=1.
//
// It adds four keys for a person testing by hand (god mode, free scrap,
// skip the round, autopilot) and a small API on window.__HO that the
// automated tests and the screenshot script use to drive the game, since
// they cannot hold a mouse.

import * as THREE from 'three';
import type { QualityLevel, WeaponId } from '../config';
import { WEAPONS } from '../config';
import type { Action } from '../core/input';
import type { Game } from '../game/Game';
import type { SurfaceKind } from '../render/materials';
import { remaining } from '../sim/rounds';
import type { DoorPlan } from '../world/plan';
import { Autopilot } from './Autopilot';

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
  /** Let the game play itself. */
  autopilot(on: boolean): void;
  /**
   * Walk the player to a spot on foot (no teleport), then turn to face
   * (lookX, lookZ) if given. `walking()` is true until they have arrived.
   */
  walkTo(x: number, z: number, lookX?: number, lookZ?: number): void;
  walking(): boolean;
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
  const setAutopilot = (on: boolean) => {
    if (!on) pilot.release();
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
    autopilot(on) {
      setAutopilot(on);
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
