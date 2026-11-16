// Debug mode, only switched on when the page is opened with ?debug=1.
//
// It adds four keys for a person testing by hand (god mode, free scrap,
// skip the round, autopilot) and a small API on window.__HO that the
// automated tests and the screenshot script use to drive the game, since
// they cannot hold a mouse.

import * as THREE from 'three';
import type { QualityLevel, WeaponId } from '../config';
import { BENCH, BOOSTS, CRATE, GRENADE, MISSION, PICKUPS, PLAYER, QUALITY, ROBOT, SCRAP, SHUTTERS, SPECIALS, SWARM, TURNCOAT, WEAPONS } from '../config';
import { boostPrice, type BoostId } from '../sim/boosts';
import { takeOffer } from '../sim/loadout';
import type { PickupId } from '../sim/pickups';
import type { Action } from '../core/input';
import { settings } from '../core/settings';
import { setEdgeLight } from '../entities/robot/robotMaterial';
import type { ArgusReport } from '../game/Argus';
import type { Game } from '../game/Game';
import type { MissionStep } from '../game/Mission';
import type { SurfaceKind } from '../render/materials';
import type { Adaptation, Notes, RemarkCue } from '../sim/argus';
import type { RobotKind } from '../sim/horde';
import { remaining } from '../sim/rounds';
import { findSafeSpots, findStandableOutOfReach, groupSafeSpots } from '../sim/safeSpots';
import { cellAt, cellCentre, createNavGrid, floodFrom, nearestReachableCell, type NavGrid } from '../sim/navGrid';
import { BREACH, VESTIBULE } from '../world/lobby/plan';
import { AREA_IDS, DOCK, DOCK_BAYS, DOCK_PASSAGE, DOOR_PLANS, EAST_BREACH, ENTRY_PLANS, LAB, LAB_LINE, LOBBY, MISSION_PLACES, NAV_BOUNDS, POWER, ROOM_RECTS, STATION_PLANS, WALKABLE, WALL, type DoorPlan } from '../world/plan';
import { PLAYER_START } from '../world/lobby/plan';
import { Autopilot, PILOTS, type PilotName } from './Autopilot';

/** Somewhere a robot can stand that is about `metres` of walking from the nearest such place to (x, z). */
function walkAway(grid: NavGrid, x: number, z: number, metres: number): [number, number] {
  const start = nearestReachableCell(grid, x, z, 12);
  if (start < 0) return [x, z];
  const steps = Math.round(metres / grid.cell);
  const depth = new Map<number, number>([[start, 0]]);
  const queue = [start];
  let last = start;
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head]!;
    const d = depth.get(index)!;
    last = index;
    if (d >= steps) break;
    const col = index % grid.cols;
    const row = (index - col) / grid.cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
      const next = r * grid.cols + c;
      if (!grid.reach[next] || depth.has(next)) continue;
      depth.set(next, d + 1);
      queue.push(next);
    }
  }
  const at = cellCentre(grid, last);
  return [at.x, at.z];
}

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
  robots: Array<{ x: number; z: number; alive: boolean; entry: string; area: string; kind: string; shield: string | null; guard: number }>;
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
    /** Take down whatever is on screen and forget any notices waiting. */
    clear(): void;
    freezeAt(seconds: number | null): void;
    status(): { showing: 'none' | 'start' | 'clear' | 'notice'; seconds: number; counter: string };
  } | null;
  /**
   * ARGUS's analysis on the HUD (connected by main.ts): which stage it is
   * at (large at the top centre, or shrunk into the corner; 'waiting' while
   * an announcement is in its way), and a way to hold it at either stage,
   * since its own clock is real time and the checks do not run in real time.
   */
  analysisBanner: {
    hold(stage: 'moment' | 'corner' | null): void;
    showing(): 'moment' | 'corner' | 'waiting' | null;
  } | null;
  /** The sounds the game has asked for since this was last called, in order (whether or not the browser was playing sound). */
  sounds(): string[];
  game: Game;
  /** Start playing without capturing the mouse. */
  play(): void;
  /** Start a new run from round 1 (as "Play again" does). */
  restart(): void;
  /** Park the camera somewhere and look in a direction (degrees). */
  view(x: number, y: number, z: number, yawDeg: number, pitchDeg: number, fov?: number): void;
  /** Hand the camera back to the player. */
  releaseView(): void;
  /** Put the player somewhere, facing a direction (degrees); `height` is where their feet are (the floor, unless they are to stand on something). */
  place(x: number, z: number, yawDeg: number, pitchDeg?: number, height?: number): void;
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
  spawnRobot(x: number, z: number, headingDeg?: number, hold?: boolean, speed?: number, health?: number, role?: 'custodian' | 'proxy'): void;
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
  /**
   * Put one robot of any kind on the map: a special (`kind`), one carrying
   * ARGUS's shielding against a weapon, or one with a plate over its weak
   * point (`guard` is the damage the plate takes). Returns its place in
   * the game's list of robots.
   */
  spawnKind(x: number, z: number, headingDeg: number, traits?: { kind?: RobotKind; shield?: string; guard?: number; hold?: boolean; health?: number; speed?: number }): number;
  /** Rounds of ordinary robots only: no specials and none of ARGUS's counters (for checks that count on a plain horde). */
  plainRounds(on: boolean): void;
  /** What the round being played is made of. */
  composition(): { total: number; drudge: number; drone: number; bomber: number; heavy: number; shielded: number; guarded: number; behind: number; ahead: number };
  /** The entry ARGUS would use right now for a robot routed 'behind' the player or 'ahead' of them (its id and where it is), or null. */
  entryFor(route: 'behind' | 'ahead'): { id: string; area: string; x: number; z: number } | null;
  /** Set ARGUS's counters for the next round to start, as if it had chosen them (null leaves them to it). */
  forceCounters(counters: Adaptation[]): void;
  /** What ARGUS has made of the player so far. */
  argus(): {
    offline: boolean;
    active: Adaptation[];
    /** Every analysis so far: the round it was for and what the banner said. */
    history: Array<{ round: number; lines: Array<{ observed: string; adapting: string }>; adaptations: Adaptation[]; withdrawn: Adaptation[] }>;
    /** Its notes on the round being played. */
    notes: Notes;
    report: ArgusReport;
  };
  /** Have ARGUS pass a remark, if it has one to make and has not spoken too recently. Returns whether it did. */
  argusSay(cue: RemarkCue): boolean;
  /** Stop the rounds from sending robots (for staged screenshots). */
  holdRounds(on: boolean): void;
  /**
   * Let the game play itself: as the "expert" that never misses (the
   * default), or as the "firstTimer", a rough model of a beginner; or as
   * the "regular" (a real person a few attempts in, whom the mission is
   * paced for) or the "skilled" player.
   */
  autopilot(on: boolean, pilot?: PilotName, mission?: boolean): void;
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
   * The same thing found by standing everywhere: every place the player
   * can come to stand by the game's rules of movement (sampled every 20 cm
   * across the whole map, on the floor and on top of whatever can be stood
   * on) from which no robot could strike them. `climb` is the height of the
   * tallest thing the player can get on top of: PLAYER.climb, in the game;
   * give a greater height to see what being able to climb higher would let
   * them reach. Returns how many places were stood on, and the patches out
   * of reach (there should be none); and the most awkward places that are
   * still in reach, each with somewhere about five metres' walk away for a
   * robot to set out from, so that a check can watch one arrive and strike.
   */
  outOfReach(climb?: number): {
    stoodOn: number;
    patches: Array<{ x: number; z: number; squares: number; deepest: number }>;
    hardest: Array<{ x: number; z: number; y: number; gap: number; from: [number, number] }>;
  };
  /** How far a point is from the nearest place a robot can stand, with every door open. */
  strikeGap(x: number, z: number): number;
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
  /**
   * Put the mission at the start of a step, as if everything before it
   * had been done: 'keys' = power on; 'core' = all three keys in hand, the
   * core still sealed; 'arming' = the core open and the switch arming (the
   * final stand); 'armed' = ready to pull; 'saved' = pulled. The map is
   * cleared of robots first.
   */
  missionJump(step: MissionStep): void;
  /** Where the mission stands, what it is telling the player, and the places it happens. */
  mission(): {
    phase: string;
    time: number;
    keys: Record<string, boolean>;
    custodian: string;
    uplink: string;
    uplinkHeld: number;
    coreOpen: boolean;
    armed: number;
    bossSent: boolean;
    bossDestroyed: boolean;
    savedAt: number | null;
    objective: { title: string; detail: string; target: string | null };
    marker: { x: number; y: number; onScreen: boolean; distance: number } | null;
    holdingUplink: boolean;
    /** True while the player is in the core (the kill switch only arms while they are). */
    holdingCore: boolean;
    /** How awake ARGUS is, 1 to 0: its eye, its red light, its face on the monitors. */
    argus: number;
    boss: { name: string; health: number } | null;
    /** Robots of the mission's own on the map, and the elites among them (with where they are). */
    extras: number;
    elites: Array<{ role: string; x: number; z: number; health: number }>;
    /** Where the Custodian's key is lying, if it is. */
    droppedKey: { x: number; z: number } | null;
    suspended: boolean;
    places: Record<string, { area: string; at: readonly number[]; stand: readonly number[] }>;
    /** The mission's numbers, from the config. */
    rules: typeof MISSION;
  };
  /**
   * Every robot the rounds have created since the count was last reset, and
   * each one the player could see at the moment it was created: inside the
   * picture on screen, with a clear line to some part of it (or, for one
   * dropping from a vent, to the space it is about to fall through).
   * `seen` should stay empty. (Robots placed by debug orders are left
   * out.) Pass true to start the count again.
   */
  spawnAudit(reset?: boolean): { created: number; seen: Array<{ entry: string; x: number; y: number; z: number; eye: [number, number, number] }>; byEntry: Record<string, number>; waiting: number; lastResorts: number };
  /**
   * Whether a robot can walk from each way in to each room, on the same
   * map of the floor the robots themselves steer by, with every door open.
   * For each of the eight ways in: the rooms it cannot be reached from
   * (which should be none). A robot with no route walks straight at the
   * player and into the nearest wall, so one arriving in a test does not
   * prove there is a route: this does.
   */
  entryRoutes(): Record<string, string[]>;
  /** Debug: the solid things within `radius` metres of a point on the floor (their centres, half sizes and turn). */
  solidsNear(x: number, z: number, radius: number): Array<{ x: number; z: number; hx: number; hz: number; turn: number; y0: number; y1: number }>;
  /**
   * Whether the places robots walk in from can be seen from indoors. From
   * every half metre of floor inside the building (rooms, doorways, the
   * entry corridor and the thresholds of the dock and the breach), with
   * every door open, it looks toward each of those places, at the height of
   * a robot's feet, chest and head, and reports how many of those lines of
   * sight are clear. Every count should be zero.
   */
  spawnSightlines(): Record<string, number>;
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
  /** Stage 4: the stations, the shutters, the pickups and the grenades, as the game has them now. */
  economy(): {
    boosts: Record<string, boolean>;
    /** What each boost station is asking right now. */
    boostPrices: Record<string, number>;
    maxHealth: number;
    grace: number;
    grenades: number;
    grenadesInAir: number;
    effects: { overload: number; doubleScrap: number };
    crate: { phase: string; offer: { weapon: string; level: number; special: boolean } | null; dry: number };
    shutters: Array<{ id: string; area: string; strength: number; shut: boolean; x: number; z: number }>;
    pickups: Array<{ id: string; x: number; z: number; left: number }>;
    /** Each weapon carried, as it really is: its level and the figures the bench and the boosts change. */
    weapons: Array<{ id: string; level: number; ammo: number; reserve: number; magazine: number; reserveMax: number; damage: number; reloadTime: number; fireInterval: number } | null>;
    /** Where each station is, and where to stand to use it. */
    stations: Array<{ id: string; area: string; stand: [number, number]; look: [number, number] }>;
    swarm: boolean;
    turned: number;
    revives: number;
    /** The config's numbers for all of it. */
    rules: { climb: number; bench: typeof BENCH; boosts: typeof BOOSTS; shutters: typeof SHUTTERS; crate: typeof CRATE; pickups: typeof PICKUPS; grenade: typeof GRENADE; swarm: typeof SWARM; turncoat: typeof TURNCOAT; scrap: typeof SCRAP };
  };
  /** Leave a timed pickup on the floor. */
  dropPickup(id: PickupId, x: number, z: number): void;
  /** Whether destroyed robots leave pickups by chance (they do, unless this is told otherwise); false also clears any lying about. */
  randomDrops(on: boolean): void;
  /** The first-minute hints: off, or on and starting again from the first of them (as the setting does). */
  hints(on: boolean): void;
  /** Force a shutter up or run it down, at once and for nothing (every one of them if no id is given). */
  setShutter(shut: boolean, id?: string): void;
  /** The crate's next rolls use these numbers for dice, in order; after them, real ones again. */
  crateDice(values: number[]): void;
  /** Put a weapon in the player's hands at a given level, fully loaded. */
  giveWeapon(id: WeaponId, level?: number): void;
  /** Give the player a boost for nothing (or take it away). */
  setBoost(id: BoostId, owned: boolean): void;
  /** Turn the robot nearest the player to their side, as the Turncoat's beam would. Returns false if there is none. */
  turnNearest(seconds?: number): boolean;
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
const KEYS = { mission: 'Digit6', god: 'Digit7', scrap: 'Digit8', skip: 'Digit9', autopilot: 'Digit0' };
/** The steps the mission can be jumped to, in order. */
const MISSION_STEPS: MissionStep[] = ['power', 'keys', 'core', 'arming', 'armed', 'saved'];
const FREE_SCRAP = 2000;

export interface DebugTools {
  /** Lines for the on-screen overlay. */
  overlay(): string[];
}

export function installDebugApi(game: Game): DebugTools {
  const pilot = new Autopilot(game);
  const setAutopilot = (on: boolean, name: PilotName = 'expert', mission = false) => {
    if (!on) pilot.release();
    pilot.profile = PILOTS[name];
    pilot.mission = mission;
    game.autopilot = on ? pilot : null;
  };
  /** True while the pilot is only running an errand for a test, not playing. */
  let onErrand = false;
  let poison: THREE.Mesh | null = null;
  // Where robots can stand with every door open: the game's own map, made
  // afresh (once) so that the state of the doors does not matter.
  let openFloor: NavGrid | null = null;
  const robotFloor = (): NavGrid =>
    (openFloor ??= createNavGrid(NAV_BOUNDS, game.world.nav.cell, game.world.openColliders, ROBOT.radius + 0.06, 0.3, 1.8, WALKABLE, ENTRY_PLANS.map((entry) => entry.at)));

  /** Put the mission at the start of a step, with the map cleared of whatever the old step had on it. */
  const jumpMission = (step: MissionStep): void => {
    game.clearRobots();
    game.mission.jump(step);
  };
  // [6] moves the mission on to its next step, as if the one in hand had been done.
  game.input.onKey(KEYS.mission, () => {
    if (game.state !== 'playing') return;
    const next = MISSION_STEPS[MISSION_STEPS.indexOf(game.mission.state.phase) + 1];
    if (next) jumpMission(next);
  });
  game.input.onKey(KEYS.god, () => (game.godMode = !game.godMode));
  game.input.onKey(KEYS.scrap, () => game.grantScrap(FREE_SCRAP));
  game.input.onKey(KEYS.skip, () => game.skipRound());
  game.input.onKey(KEYS.autopilot, () => setAutopilot(!game.autopilot));

  // Was each robot the rounds created in the player's view as it appeared?
  // This is worked out here, separately from the rule that is meant to
  // prevent it (game/Sight.ts), from the camera as it actually is: the
  // exact picture on screen, with no margin, and the robot as a column of
  // points from its feet to its head.
  const audit = { created: 0, seen: [] as Array<{ entry: string; x: number; y: number; z: number; eye: [number, number, number] }>, byEntry: {} as Record<string, number> };
  {
    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4();
    const eye = new THREE.Vector3();
    const point = new THREE.Vector3();
    const direction = new THREE.Vector3();
    game.onArrival = (robot, entry, forced) => {
      if (forced) return;
      audit.created += 1;
      audit.byEntry[entry.id] = (audit.byEntry[entry.id] ?? 0) + 1;
      const camera = game.camera;
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(matrix.copy(camera.matrixWorld).invert().premultiply(camera.projectionMatrix));
      camera.getWorldPosition(eye);
      const at = robot.root.position;
      // A robot that walks in: the robot itself, where it was created. One
      // that drops from a vent is created above the ceiling and cannot be
      // seen there, so what counts is the space it is about to fall
      // through, from the ceiling to the floor.
      const heights = entry.kind === 'drop' ? Array.from({ length: Math.ceil(at.y / 0.4) + 1 }, (_, i) => Math.min(at.y - 0.06, i * 0.4) - at.y) : [0.1, 0.5, 0.9, 1.3, 1.7, 1.95];
      for (const up of heights) {
        for (const [dx, dz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]] as const) {
          point.set(at.x + dx, at.y + up, at.z + dz);
          if (!frustum.containsPoint(point)) continue;
          const distance = eye.distanceTo(point);
          raycaster.set(eye, direction.copy(point).sub(eye).divideScalar(distance));
          raycaster.far = distance - 0.02;
          if (raycaster.intersectObjects(game.world.solids, false).length) continue;
          audit.seen.push({ entry: entry.id, x: at.x, y: at.y, z: at.z, eye: [eye.x, eye.y, eye.z] });
          return;
        }
      }
    };
  }

  window.__HO = {
    ready: false,
    announcement: null,
    analysisBanner: null,
    sounds: () => game.audio.asked.splice(0),
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
    place(x, z, yawDeg, pitchDeg = 0, height = 0) {
      game.player.position.set(x, height, z);
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
    spawnRobot(x, z, headingDeg = 0, hold = false, speed, health, role) {
      const plan = game.director.rounds.plan;
      const robot = game.addRobot(x, z, THREE.MathUtils.degToRad(headingDeg), { health: health ?? plan.health, speed: speed ?? plan.walkSpeed, ...(role ? { role, extra: true } : {}) });
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
    spawnKind(x, z, headingDeg, traits = {}) {
      const plan = game.director.rounds.plan;
      const robot = game.addRobot(x, z, THREE.MathUtils.degToRad(headingDeg), {
        health: traits.health ?? plan.health * (traits.kind === 'drone' ? SPECIALS.drone.health : traits.kind === 'bomber' ? SPECIALS.bomber.health : traits.kind === 'heavy' ? SPECIALS.heavy.health : 1),
        speed: traits.speed ?? (traits.kind === 'drone' ? SPECIALS.drone.speed : traits.kind === 'bomber' ? SPECIALS.bomber.speed : traits.kind === 'heavy' ? SPECIALS.heavy.speed : plan.walkSpeed),
        ...(traits.kind ? { kind: traits.kind } : {}),
        ...(traits.kind === 'bomber' ? { attackDamage: 0 } : traits.kind === 'drone' ? { attackDamage: SPECIALS.drone.damage } : traits.kind === 'heavy' ? { attackDamage: SPECIALS.heavy.damage } : {}),
        ...(traits.shield ? { shield: traits.shield } : {}),
        ...(traits.guard ? { guard: traits.guard } : {}),
      });
      robot.hold = traits.hold ?? false;
      robot.root.rotation.y = THREE.MathUtils.degToRad(headingDeg);
      return game.robots.indexOf(robot);
    },
    plainRounds(on) {
      game.director.plain = on;
    },
    composition() {
      return game.director.composition;
    },
    entryFor(route) {
      const entry = game.director.entryFor(route);
      return entry ? { id: entry.id, area: entry.area, x: entry.at[0], z: entry.at[1] } : null;
    },
    forceCounters(counters) {
      game.director.counters = counters;
    },
    argus() {
      const { argus } = game;
      return {
        offline: argus.offline,
        active: argus.active.map((a) => ({ ...a })),
        history: argus.history.map((analysis) => ({ round: analysis.round, lines: analysis.lines.map((line) => ({ ...line })), adaptations: analysis.adaptations.map((a) => ({ ...a })), withdrawn: analysis.withdrawn.map((a) => ({ ...a })) })),
        notes: { ...argus.roundNotes, damage: { ...argus.roundNotes.damage } },
        report: argus.report(),
      };
    },
    argusSay(cue) {
      return game.argus.say(cue);
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
    missionJump(step) {
      jumpMission(step);
    },
    mission() {
      const { mission } = game;
      const state = mission.state;
      const dropped = game.world.mission.droppedAt;
      return {
        phase: state.phase,
        time: state.time,
        keys: { ...state.keys },
        custodian: state.custodian,
        uplink: state.uplink,
        uplinkHeld: state.uplinkHeld,
        coreOpen: state.coreOpen,
        armed: state.armed,
        bossSent: state.bossSent,
        bossDestroyed: state.bossDestroyed,
        savedAt: state.savedAt,
        objective: mission.objective,
        marker: game.objectiveMarker(),
        holdingUplink: mission.holdingUplink,
        holdingCore: mission.holdingCore,
        argus: game.lights.argusLevel,
        boss: mission.boss,
        extras: game.robots.filter((robot) => robot.alive && robot.extra).length,
        elites: game.robots.filter((robot) => robot.alive && robot.role).map((robot) => ({ role: robot.role!, x: robot.position.x, z: robot.position.z, health: robot.healthLeft })),
        droppedKey: dropped ? { x: dropped.x, z: dropped.z } : null,
        suspended: game.director.suspended,
        places: MISSION_PLACES,
        rules: MISSION,
      };
    },
    spawnAudit(reset = false) {
      const report = { created: audit.created, seen: audit.seen.slice(), byEntry: { ...audit.byEntry }, waiting: game.director.waiting, lastResorts: game.director.lastResorts };
      if (reset) {
        audit.created = 0;
        audit.seen.length = 0;
        audit.byEntry = {};
      }
      return report;
    },
    entryRoutes() {
      // A map of the floor with every door open, built the way the game builds its own.
      const grid = createNavGrid(
        NAV_BOUNDS,
        game.world.nav.cell,
        game.world.openColliders,
        ROBOT.radius + 0.06,
        0.3,
        1.8,
        WALKABLE,
        ENTRY_PLANS.map((entry) => entry.at),
      );
      const cut: Record<string, string[]> = {};
      for (const entry of ENTRY_PLANS) cut[entry.id] = [];
      for (const area of AREA_IDS) {
        const [x0, z0, x1, z1] = ROOM_RECTS[area];
        // From the middle of the room (or the nearest open floor to it).
        floodFrom(grid, (x0 + x1) / 2, (z0 + z1) / 2);
        for (const entry of ENTRY_PLANS) {
          const cell = cellAt(grid, entry.at[0], entry.at[1]);
          if (cell < 0 || grid.blocked[cell] || grid.distance[cell] === Infinity) cut[entry.id]!.push(area);
        }
      }
      return cut;
    },
    solidsNear(x, z, radius) {
      return game.world.openColliders
        .filter((c) => Math.hypot(c.x - x, c.z - z) < radius)
        .map((c) => ({ x: c.x, z: c.z, hx: c.hx, hz: c.hz, turn: Math.atan2(c.sin, c.cos), y0: c.y0, y1: c.y1 }));
    },
    spawnSightlines() {
      const raycaster = new THREE.Raycaster();
      raycaster.firstHitOnly = true;
      for (const door of game.world.doors) door.pose(1);
      // Everywhere indoors a player can stand: [rectangle, skip squares robots cannot stand on].
      const t = WALL;
      const indoors: Array<[[number, number, number, number], boolean]> = [
        ...AREA_IDS.map((id): [[number, number, number, number], boolean] => [[...ROOM_RECTS[id]] as [number, number, number, number], true]),
        ...game.world.doors.map((door): [[number, number, number, number], boolean] => [[...door.rect] as [number, number, number, number], false]),
        // The entry corridor, from the lobby wall out to its outer doorway.
        [[VESTIBULE.x0, VESTIBULE.z0 - 0.5, VESTIBULE.x1, LOBBY.z0], false],
        // The passage from the lobby's goods door to the dock.
        [[DOCK_PASSAGE.x0, DOCK_PASSAGE.z0, DOCK_PASSAGE.x1, DOCK_PASSAGE.z1], false],
        // The openings robots walk in through, as far as the outer face of the wall.
        [[POWER.x1, EAST_BREACH.z0, POWER.x1 + t, EAST_BREACH.z1], false],
        [[DOCK.x0 - t, DOCK_BAYS.north.z0, DOCK.x0, DOCK_BAYS.north.z1], false],
        [[DOCK.x0 - t, DOCK_BAYS.south.z0, DOCK.x0, DOCK_BAYS.south.z1], false],
        [[LAB.x1, LAB_LINE.z0, LAB.x1 + t, LAB_LINE.z1], false],
      ];
      const nav = game.world.nav;
      const eyes: THREE.Vector3[] = [];
      for (const [[x0, z0, x1, z1], furnished] of indoors) {
        for (let x = x0 + 0.3; x <= x1 - 0.3 + 1e-6; x += 0.5) {
          for (let z = z0 + 0.3; z <= z1 - 0.3 + 1e-6; z += 0.5) {
            if (furnished) {
              const cell = cellAt(nav, x, z);
              if (cell < 0 || nav.blocked[cell] || nav.mask[cell]) continue;
            }
            eyes.push(new THREE.Vector3(x, PLAYER.eyeHeight, z));
          }
        }
      }
      const clear: Record<string, number> = {};
      const target = new THREE.Vector3();
      const direction = new THREE.Vector3();
      for (const entry of ENTRY_PLANS) {
        if (entry.kind !== 'walk') continue;
        let count = 0;
        const spots: Array<[number, number]> = [[entry.at[0], entry.at[1]]];
        for (let i = 0; i < 6; i++) spots.push([entry.at[0] + Math.cos(i * 1.047) * entry.spread, entry.at[1] + Math.sin(i * 1.047) * entry.spread]);
        for (const eye of eyes) {
          for (const [sx, sz] of spots) {
            for (const up of [0.15, 1.0, 1.85]) {
              target.set(sx, up, sz);
              const distance = eye.distanceTo(target);
              raycaster.set(eye, direction.copy(target).sub(eye).divideScalar(distance));
              raycaster.far = distance - 0.02;
              if (!raycaster.intersectObjects(game.world.solids, false).length) count++;
            }
          }
        }
        clear[entry.id] = count;
      }
      for (const door of game.world.doors) door.settle();
      return clear;
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
        { name: 'breachEast', along: 'z', at: POWER.x1 + WALL / 2, from: EAST_BREACH.z0, to: EAST_BREACH.z1, top: 1.85 },
        { name: 'dockBayNorth', along: 'z', at: DOCK.x0 - WALL / 2, from: DOCK_BAYS.north.z0, to: DOCK_BAYS.north.z1, top: 1.85 },
        { name: 'dockBaySouth', along: 'z', at: DOCK.x0 - WALL / 2, from: DOCK_BAYS.south.z0, to: DOCK_BAYS.south.z1, top: 1.85 },
        { name: 'labLine', along: 'z', at: LAB.x1 + WALL / 2, from: LAB_LINE.z0, to: LAB_LINE.z1, top: 1.85 },
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
    outOfReach(climb = PLAYER.climb) {
      // (A sample every 10 cm, for a body 5 cm slimmer than the player's:
      // someone sliding along two obstacles gets through a gap that leaves
      // them two centimetres to spare, and a coarser grid of full-width
      // bodies steps straight over a gap like that. One such gap, between
      // a bin and the corner of the security desk, hid a second safe spot.)
      const step = 0.1;
      const robots = robotFloor();
      const found = findStandableOutOfReach(
        NAV_BOUNDS,
        step,
        game.world.openColliders,
        robots,
        { radius: PLAYER.radius - 0.05, stepHeight: PLAYER.stepHeight, height: PLAYER.height, climb },
        [PLAYER_START.x, PLAYER_START.z],
        // A robot starts its swing when its centre is within attackRange of
        // the player's. (Ten centimetres are kept in hand: the robot's map
        // is in 30 cm squares, and the body tested here is slimmer than the
        // player's, so it stands a little nearer the walls than they can.)
        ROBOT.attackRange - 0.1,
      );
      return {
        stoodOn: found.stoodOn,
        patches: groupSafeSpots(found.spots, step),
        hardest: found.hardest.map((spot) => ({ ...spot, from: walkAway(robots, spot.x, spot.z, 5) })),
      };
    },
    strikeGap(x, z) {
      const robots = robotFloor();
      const nearest = nearestReachableCell(robots, x, z, 30);
      if (nearest < 0) return Infinity;
      const at = cellCentre(robots, nearest);
      return Math.hypot(at.x - x, at.z - z);
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
    autopilot(on, name, mission) {
      setAutopilot(on, name, mission);
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
    economy() {
      const { economy, weapons, world, player } = game;
      const carried = weapons.loadout.slots.map((slot) => {
        if (!slot) return null;
        const def = weapons.defOf(slot);
        return { id: slot.id, level: slot.level, ammo: slot.state.ammo, reserve: slot.state.reserve, magazine: def.magazine, reserveMax: def.reserveMax, damage: def.damage, reloadTime: def.reloadTime, fireInterval: def.fireInterval };
      });
      return {
        boosts: { ...economy.boosts.owned },
        boostPrices: Object.fromEntries((Object.keys(BOOSTS) as BoostId[]).map((id) => [id, boostPrice(economy.boosts, id, BOOSTS)])),
        maxHealth: player.maxHealth,
        grace: player.grace,
        grenades: economy.grenades.count,
        grenadesInAir: game.grenades.count,
        effects: { ...economy.effects },
        crate: { phase: economy.crate.phase, offer: economy.crate.offer ? { ...economy.crate.offer } : null, dry: economy.crate.state.dry },
        shutters: world.shutters.gates.map((gate) => ({ id: gate.plan.id, area: gate.plan.area, strength: gate.state.strength, shut: gate.shut, x: gate.centre.x, z: gate.centre.z })),
        pickups: game.pickups.list,
        weapons: carried,
        stations: STATION_PLANS.map((station) => {
          const [nx, nz] = station.normal;
          const out = station.depth + 1.0;
          return { id: station.id, area: station.area, stand: [station.at[0] + nx * out, station.at[1] + nz * out], look: [station.at[0] + nx * station.depth, station.at[1] + nz * station.depth] };
        }),
        swarm: game.director.swarm,
        turned: game.robots.filter((robot) => robot.alive && robot.turned > 0).length,
        revives: game.stats.revives,
        rules: { climb: PLAYER.climb, bench: BENCH, boosts: BOOSTS, shutters: SHUTTERS, crate: CRATE, pickups: PICKUPS, grenade: GRENADE, swarm: SWARM, turncoat: TURNCOAT, scrap: SCRAP },
      };
    },
    dropPickup(id, x, z) {
      game.pickups.drop(id, x, z);
    },
    randomDrops(on) {
      game.randomDrops = on;
      if (!on) game.pickups.clear();
    },
    hints(on) {
      settings.set(on ? { hints: true, learned: [] } : { hints: false });
    },
    setShutter(shut, id) {
      for (const gate of game.world.shutters.gates) {
        if (id && gate.plan.id !== id) continue;
        gate.state.strength = shut ? SHUTTERS.strength : 0;
        gate.snap();
      }
      game.world.shuttersChanged();
    },
    crateDice(values) {
      const queue = [...values];
      game.economy.random = () => (queue.length ? queue.shift()! : Math.random());
    },
    giveWeapon(id, level = 0) {
      takeOffer(game.weapons.loadout, id, game.weapons.defAt(id, level), level);
      game.weapons.raise();
    },
    setBoost(id, owned) {
      game.economy.boosts.owned[id] = owned;
      // (The economy puts its boosts into effect whenever one is bought: do the same here.)
      (game.economy as unknown as { applyBoosts(): void }).applyBoosts();
    },
    turnNearest(seconds = 10) {
      let best = null;
      let nearest = Infinity;
      for (const robot of game.robots) {
        if (!robot.alive || robot.role || robot.turned > 0) continue;
        const distance = robot.position.distanceTo(game.player.position);
        if (distance < nearest) {
          nearest = distance;
          best = robot;
        }
      }
      if (!best) return false;
      best.turn(seconds);
      return true;
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
        robots: game.robots.map((robot) => ({
          x: robot.position.x,
          z: robot.position.z,
          alive: robot.alive,
          entry: robot.entry,
          area: world.areaOf(robot.position.x, robot.position.z),
          kind: robot.kind,
          shield: robot.armour.shield,
          guard: robot.armour.guard,
        })),
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
        `DEBUG  [6] next mission step  [7] god mode ${game.godMode ? 'ON' : 'off'}  [8] +${FREE_SCRAP} scrap  [9] skip round  [0] autopilot ${game.autopilot ? 'ON' : 'off'}`,
        `round ${director.rounds.round} (${director.rounds.phase}${director.paused ? ', held' : ''})  robots ${game.robots.length} on map, ${remaining(director.rounds)} left  health ${plan.health}  speed ${plan.walkSpeed.toFixed(2)}${plan.runShare > 0 ? ` / ${plan.runSpeed.toFixed(2)} x${Math.round(plan.runShare * 100)}%` : ''}`,
        `${WEAPONS[game.weapons.def.id].name}  area ${game.world.playerArea}  lights ${game.lights.liveNames.length}  mission: ${game.mission.state.phase}${game.autopilot ? `  autopilot: ${pilot.status}` : ''}`,
      ];
    },
  };
}
