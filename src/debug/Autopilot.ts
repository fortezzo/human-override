// A debug player that moves, aims and shoots by itself.
//
// The code was written by an agent that cannot hold a mouse, so this is how
// the game gets played during testing: it presses the same buttons a person
// would. It turns to the nearest robot it can see, fires when lined up,
// backs away when crowded, strikes when one is in reach, reloads when it
// should, and between fights walks to the next thing it can afford (a
// weapon, then doors) and buys it.
//
// It comes in two characters. The "expert" never misses and never
// hesitates: it is the test tool that proves the game can be played. The
// "first-timer" is a rough model of someone new to this kind of game: slow
// to notice, shaky, aims at the body, backs up late and runs when hurt. It
// exists to answer one question the expert cannot: how far does a beginner
// usually get? (tools/balance.mjs plays it many times and counts.)

import * as THREE from 'three';
import { MELEE, WEAPONS, type WeaponId } from '../config';
import type { Action } from '../core/input';
import { angleDelta, clamp } from '../core/math';
import type { Robot } from '../entities/robot/Robot';
import type { Game } from '../game/Game';
import { rackOffer } from '../sim/economy';
import { floodFrom, nextWaypoint, type NavGrid } from '../sim/navGrid';
import { DOOR_PLANS, RACK_PLANS } from '../world/plan';

export interface PilotProfile {
  /** Seconds before it reacts to a robot it has just noticed. */
  reaction: number;
  /** How fast it can turn, radians per second. */
  turnRate: number;
  /** Share of its targets it aims at the head of (the rest get the chest). */
  headShare: number;
  /** How far its aim wanders off the point it means to hit, in metres at the target. */
  wobble: number;
  /** It fires when this close to lined up (radians), at range and up close. */
  linedFar: number;
  linedNear: number;
  /** Fastest it will pull the trigger of a one-shot-per-click weapon, in seconds between shots. */
  tapEvery: number;
  /** How near a robot comes before it starts backing away, metres. */
  retreatAt: number;
  /** Below this health it turns and runs. 0 = never. */
  panicBelow: number;
  /** Reloads in every lull (true), or only when the magazine is empty (false). */
  tidyReloads: boolean;
  /** Seconds between looking round for somewhere better to back away to. */
  rethink: number;
}

export type PilotName = 'expert' | 'firstTimer';

export const PILOTS: Record<PilotName, PilotProfile> = {
  expert: { reaction: 0, turnRate: 7, headShare: 1, wobble: 0, linedFar: 0.035, linedNear: 0.12, tapEvery: 0, retreatAt: 5, panicBelow: 0, tidyReloads: true, rethink: 0.2 },
  firstTimer: { reaction: 0.45, turnRate: 3.4, headShare: 0.15, wobble: 0.5, linedFar: 0.07, linedNear: 0.18, tapEvery: 0.3, retreatAt: 4, panicBelow: 50, tidyReloads: false, rethink: 0.8 },
};

/** Which gun is worth more than which: it never trades down. */
const WORTH: Record<WeaponId, number> = { pistol: 0, shotgun: 1, carbine: 2 };

const _eye = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class Autopilot {
  /** What it is doing, for the debug overlay. */
  status = 'idle';
  /** Which character is playing. */
  profile: PilotProfile = PILOTS.expert;

  private readonly raycaster = new THREE.Raycaster();
  /** Its own copy of the walking-distance map, flooded toward wherever it wants to go. */
  private route: NavGrid | null = null;
  private strafe: 'left' | 'right' = 'left';
  private strafeTimer = 0;
  private fireHeld = false;
  /**
   * An errand: somewhere to walk to, and optionally something to face on
   * arrival. While it has one it does nothing else. Tests use this to move
   * the player the way a person does, on foot and through doorways, where a
   * teleport would skip everything that happens on the way.
   */
  private errand: { x: number; z: number; look: { x: number; z: number } | null } | null = null;
  /** True when an errand was all it was asked to do: stand still afterwards, do not start playing. */
  private resting = false;

  // What the less-than-perfect character needs to remember.
  private target: Robot | null = null;
  private aimAtHead = true;
  private reactTimer = 0;
  private readonly wobble = new THREE.Vector3();
  private wobbleTimer = 0;
  private sinceShot = 99;
  private fleeTimer = 0;
  private lull = 0;
  /** Buttons pressed for one frame, to be let go at the start of the next. */
  private readonly tapped = new Set<Action>();
  /** Which way it is backing away (a direction on the ground), and when it will look round again. */
  private readonly escape = { x: 0, z: 0, timer: 0, found: false, since: 99 };

  constructor(private readonly game: Game) {
    this.raycaster.firstHitOnly = true;
  }

  /**
   * Press a button for one frame. Reloading, striking, buying and switching
   * weapon all act on the press, not on the button being down: holding one
   * of those does it once and then nothing, which once left this player
   * standing in a crowd with an empty gun and a finger on R.
   */
  private tap(action: Action): void {
    this.game.input.press(action);
    this.tapped.add(action);
  }

  /** Let go of every button it can press (when it is switched off). */
  release(): void {
    this.tapped.clear();
    for (const action of ['forward', 'back', 'left', 'right', 'sprint', 'fire', 'aim', 'melee', 'reload', 'interact', 'weapon1', 'weapon2'] as const) this.game.input.release(action);
    this.fireHeld = false;
    this.errand = null;
    this.resting = false;
    this.target = null;
    this.fleeTimer = 0;
    this.status = 'idle';
  }

  /**
   * Walk to a spot, then (optionally) turn to face another. With
   * `thenRest`, it stands there afterwards instead of going back to playing.
   */
  walkTo(x: number, z: number, look: { x: number; z: number } | null = null, thenRest = false): void {
    this.errand = { x, z, look };
    this.resting = thenRest;
  }

  /** True while an errand is still under way. */
  get walking(): boolean {
    return this.errand !== null;
  }

  /** One frame of an errand. */
  private runErrand(dt: number): void {
    const { player, input, world } = this.game;
    const errand = this.errand!;
    const distance = Math.hypot(errand.x - player.position.x, errand.z - player.position.z);
    if (distance < 0.3) {
      this.status = 'arrived';
      if (!errand.look || this.turnToward(_aim.set(errand.look.x, player.position.y + 1.6, errand.look.z), dt, 7) < 0.03) this.errand = null;
      return;
    }
    this.status = `walking (${distance.toFixed(1)} m to go)`;
    this.route ??= { ...world.nav, distance: new Float32Array(world.nav.distance.length).fill(Infinity), goal: -1 };
    floodFrom(this.route, errand.x, errand.z);
    // For the last step, head straight for the spot itself.
    const waypoint = distance < 0.9 ? { x: errand.x, z: errand.z } : nextWaypoint(this.route, player.position.x, player.position.z);
    if (!waypoint) return;
    const error = this.turnToward(_aim.set(waypoint.x, player.position.y + 1.6, waypoint.z), dt, 7);
    if (error < 0.5) input.press('forward');
  }

  update(dt: number): void {
    const { game, profile } = this;
    const { player, input, weapons, robots, world } = game;
    for (const action of ['forward', 'back', 'left', 'right', 'sprint'] as const) input.release(action);
    for (const action of this.tapped) input.release(action);
    this.tapped.clear();
    if (!player.alive) return;
    if (this.errand) {
      this.runErrand(dt);
      return;
    }
    if (this.resting) return;
    this.sinceShot += dt;

    // The nearest robot it has a clear line to.
    _eye.copy(game.camera.position);
    let seen: Robot | null = null;
    let nearest = Infinity;
    let closestAny = Infinity;
    for (const robot of robots) {
      if (!robot.alive) continue;
      const head = robot.bones.get('Head');
      if (!head) continue;
      _aim.setFromMatrixPosition(head.matrixWorld);
      const distance = _aim.distanceTo(_eye);
      closestAny = Math.min(closestAny, distance);
      if (distance >= nearest) continue;
      _dir.copy(_aim).sub(_eye).divideScalar(distance);
      this.raycaster.set(_eye, _dir);
      this.raycaster.far = distance - 0.3;
      if (this.raycaster.intersectObjects(world.solids, false).length) continue;
      nearest = distance;
      seen = robot;
    }

    // A new target takes a moment to register, and gets a fresh decision
    // about where to aim.
    if (seen !== this.target) {
      this.target = seen;
      if (seen) {
        this.reactTimer = profile.reaction;
        this.aimAtHead = Math.random() < profile.headShare;
      }
    }
    if (this.reactTimer > 0) this.reactTimer -= dt;

    const state = weapons.state;
    const def = weapons.def;
    if (state.ammo === 0 && state.reserve === 0) {
      // Out of ammunition for this weapon: use the other one if there is one.
      const other = weapons.loadout.slots.findIndex((slot, i) => slot && i !== weapons.loadout.current && (slot.state.ammo > 0 || slot.state.reserve > 0));
      if (other >= 0) this.tap(other === 0 ? 'weapon1' : 'weapon2');
    }

    // Hurt and crowded: the beginner turns and runs, for as long as its legs last.
    if (profile.panicBelow > 0 && player.health < profile.panicBelow && closestAny < 6 && this.fleeTimer <= 0 && !player.stamina.winded) this.fleeTimer = 1.6;
    if (this.fleeTimer > 0) {
      this.fleeTimer -= dt;
      this.releaseTrigger();
      if (this.flee(dt)) return;
      this.fleeTimer = 0;
    }

    // Is there something worth breaking off for? A gun it can now afford,
    // or ammunition when it is running low, matters more than the robot
    // across the room: people do run for the rack in the middle of a round.
    // Not with one in its face, though, unless every gun is empty.
    const purchase = this.nextPurchase();
    const dry = state.ammo === 0 && state.reserve === 0 && !weapons.loadout.slots.some((slot, i) => slot && i !== weapons.loadout.current && (slot.state.ammo > 0 || slot.state.reserve > 0));
    const shopping = purchase !== null && (!seen || nearest > 6 || (dry && nearest > 2.5));

    if (seen && !shopping) {
      this.lull = 0;
      this.status = `fighting (${nearest.toFixed(1)} m)`;
      // Where it means to hit, plus however far its hands have wandered.
      if (this.aimAtHead) _aim.setFromMatrixPosition(seen.bones.get('Head')!.matrixWorld);
      else seen.chest(_aim);
      if (profile.wobble > 0) {
        this.wobbleTimer -= dt;
        if (this.wobbleTimer <= 0) {
          this.wobbleTimer = 0.35 + Math.random() * 0.3;
          this.wobble.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * profile.wobble);
        }
        _aim.add(this.wobble);
      }
      const reacting = this.reactTimer > 0;
      const error = reacting ? Infinity : this.turnToward(_aim, dt, profile.turnRate);
      // Pull the trigger when lined up. Tapping, so single-shot weapons fire too.
      const lined = error < (nearest < 4 ? profile.linedNear : profile.linedFar);
      if (lined && !this.fireHeld && state.ammo > 0 && (def.automatic || this.sinceShot >= profile.tapEvery)) {
        input.press('fire');
        this.fireHeld = true;
        this.sinceShot = 0;
      } else if (this.fireHeld && (!def.automatic || !lined)) {
        this.releaseTrigger();
      }
      if (nearest < MELEE.range - 0.2 && !reacting) this.tap('melee');
      if (state.ammo === 0 && state.reserve > 0 && !weapons.reloading) this.tap('reload');

      if (dry) {
        // Nothing left to shoot with and nothing it can afford: close in
        // and strike (a melee kill pays for a sidearm refill).
        this.status = 'out of ammunition: closing in to strike';
        if (nearest > MELEE.range - 0.5 && !reacting && error < 0.5) input.press('forward');
        return;
      }
      // Keep them at arm's length: back toward open floor, still facing them.
      if (nearest < profile.retreatAt) this.backAway(dt);
      return;
    }

    this.releaseTrigger();
    this.lull += dt;
    const wantsReload = profile.tidyReloads ? state.ammo < def.magazine : state.ammo === 0 || (this.lull > 2.5 && state.ammo < def.magazine * 0.5);
    if (wantsReload && state.reserve > 0 && !weapons.reloading) this.tap('reload');

    // Nothing to shoot at (or shopping comes first). If something is close
    // but out of sight, wait for it (not for ever: after a few seconds go
    // and find it); otherwise go shopping.
    if (!shopping && closestAny < 9 && this.lull < 4) {
      this.status = 'waiting';
      return;
    }
    const goal = shopping ? purchase : closestAny < 9 ? this.nearestRobot() : this.lull > 8 ? this.nearestRobot() : null;
    if (!goal) {
      this.status = 'waiting';
      return;
    }
    this.status = `going to ${goal.label}`;
    const distance = Math.hypot(goal.x - player.position.x, goal.z - player.position.z);
    if (distance < 1.5) {
      // Face it and press the button. A new gun takes the place of the one
      // in hand, so make sure that is the one worth less.
      this.turnToward(_aim.set(goal.x, 1.4, goal.z), dt, profile.turnRate);
      const giveUp = 'giveUp' in goal ? goal.giveUp : undefined;
      if (giveUp && def.id !== giveUp) {
        if (!weapons.busy) this.tap(weapons.loadout.slots.findIndex((slot) => slot?.id === giveUp) === 0 ? 'weapon1' : 'weapon2');
      } else if (game.interactions.prompt?.usable && !weapons.busy) {
        this.tap('interact');
      }
      return;
    }
    this.route ??= { ...world.nav, distance: new Float32Array(world.nav.distance.length).fill(Infinity), goal: -1 };
    floodFrom(this.route, goal.x, goal.z);
    const waypoint = nextWaypoint(this.route, player.position.x, player.position.z);
    if (!waypoint) return;
    const error = this.turnToward(_aim.set(waypoint.x, 1.5, waypoint.z), dt, profile.turnRate);
    if (error < 0.6) {
      input.press('forward');
      if (error < 0.2 && distance > 4) input.press('sprint');
    }
  }

  /** The nearest robot still standing, as somewhere to walk to. */
  private nearestRobot(): { x: number; z: number; label: string } | null {
    const { player, robots } = this.game;
    let best: { x: number; z: number; label: string } | null = null;
    let nearest = Infinity;
    for (const robot of robots) {
      if (!robot.alive) continue;
      const distance = Math.hypot(robot.position.x - player.position.x, robot.position.z - player.position.z);
      if (distance < nearest) {
        nearest = distance;
        best = { x: robot.position.x, z: robot.position.z, label: 'the nearest robot' };
      }
    }
    return best;
  }

  /**
   * Where to fall back to. Looks at spots a few metres away on the floor
   * map the robots themselves use (so it knows about every crate and
   * barrier, not just what is in its line of sight) and prefers one that is
   * far from the robots, has open floor around it (not a corner or a dead
   * end), is not on the far side of them, and lies roughly the way it is
   * already going. That last part is what turns backing away into circling
   * the room, as people do. Then it works out the walk there.
   */
  private pickRefuge(): boolean {
    const { player, robots, world } = this.game;
    const nav = world.nav;
    const escape = this.escape;
    escape.found = false;
    let bestScore = -Infinity;
    let bestX = 0;
    let bestZ = 0;
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    // The nearest robot, to avoid picking somewhere beyond it.
    let threatX = 0;
    let threatZ = 0;
    let threat = Infinity;
    for (const robot of robots) {
      if (!robot.alive) continue;
      const d = Math.hypot(robot.position.x - player.position.x, robot.position.z - player.position.z);
      if (d < threat) {
        threat = d;
        threatX = (robot.position.x - player.position.x) / (d || 1);
        threatZ = (robot.position.z - player.position.z) / (d || 1);
      }
    }
    for (let gx = -9; gx <= 9; gx += 1.5) {
      for (let gz = -9; gz <= 9; gz += 1.5) {
        const distance = Math.hypot(gx, gz);
        if (distance < 3 || distance > 9.5) continue;
        const x = player.position.x + gx;
        const z = player.position.z + gz;
        const c = Math.floor((x - nav.x0) / nav.cell);
        const r = Math.floor((z - nav.z0) / nav.cell);
        if (c < 3 || r < 3 || c >= nav.cols - 3 || r >= nav.rows - 3 || !nav.reach[r * nav.cols + c]) continue;
        // Open floor around it: corners and dead ends score low.
        let open = 0;
        for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) open += nav.reach[(r + dr) * nav.cols + (c + dc)]!;
        let nearestRobot = 12;
        for (const robot of robots) if (robot.alive) nearestRobot = Math.min(nearestRobot, Math.hypot(robot.position.x - x, robot.position.z - z));
        let score = nearestRobot + (open / 49) * 5;
        // Not through the robots.
        if (threat < 9 && (gx * threatX + gz * threatZ) / distance > 0.35) score -= 8;
        if (speed > 0.5) score += ((player.velocity.x * gx + player.velocity.z * gz) / (speed * distance)) * 1.5;
        if (score > bestScore) {
          bestScore = score;
          bestX = x;
          bestZ = z;
          escape.found = true;
        }
      }
    }
    if (!escape.found) return false;
    this.route ??= { ...nav, distance: new Float32Array(nav.distance.length).fill(Infinity), goal: -1 };
    this.route.goal = -1;
    floodFrom(this.route, bestX, bestZ);
    return true;
  }

  /** The direction of the next step toward the refuge, or false if there is no way there. */
  private refugeStep(): boolean {
    const { player } = this.game;
    const escape = this.escape;
    if (!escape.found || !this.route) return false;
    const waypoint = nextWaypoint(this.route, player.position.x, player.position.z);
    if (!waypoint) return false;
    const dx = waypoint.x - player.position.x;
    const dz = waypoint.z - player.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25) return false;
    escape.x = dx / d;
    escape.z = dz / d;
    return true;
  }

  /** Decide where to fall back to, now and then (sooner if it has stopped moving). */
  private considerRefuge(dt: number, every: number): void {
    const { player } = this.game;
    const escape = this.escape;
    escape.timer -= dt;
    escape.since += dt;
    if (escape.timer <= 0 || (player.speedFraction < 0.2 && escape.since > 0.5)) {
      escape.timer = every;
      escape.since = 0;
      this.pickRefuge();
    }
  }

  /**
   * Back away from the robots without turning round: walk toward the
   * refuge by holding whichever of the four movement keys go that way.
   */
  private backAway(dt: number): void {
    const { player, input } = this.game;
    this.considerRefuge(dt, this.profile.rethink);
    if (!this.refugeStep()) {
      // Nowhere to go: shuffle back and sideways.
      input.press('back');
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafe = this.strafe === 'left' ? 'right' : 'left';
        this.strafeTimer = 0.8;
      }
      input.press(this.strafe);
      return;
    }
    // Which keys move that way, given the direction it is facing.
    const escape = this.escape;
    const forward = -Math.sin(player.yaw) * escape.x - Math.cos(player.yaw) * escape.z;
    const right = Math.cos(player.yaw) * escape.x - Math.sin(player.yaw) * escape.z;
    if (forward > 0.38) input.press('forward');
    else if (forward < -0.38) input.press('back');
    if (right > 0.38) input.press('right');
    else if (right < -0.38) input.press('left');
  }

  private releaseTrigger(): void {
    if (!this.fireHeld) return;
    this.game.input.release('fire');
    this.fireHeld = false;
  }

  /**
   * Turn and run: face the way to the refuge and sprint, for as long as
   * the legs last. Returns false if there is nowhere to go.
   */
  private flee(dt: number): boolean {
    const { player, input } = this.game;
    this.status = 'running away';
    this.considerRefuge(dt, this.profile.rethink);
    if (!this.refugeStep()) return false;
    const escape = this.escape;
    const error = this.turnToward(_aim.set(player.position.x + escape.x * 4, player.position.y + 1.6, player.position.z + escape.z * 4), dt, this.profile.turnRate * 2);
    // Start moving before the turn is finished: standing still is what gets it caught.
    if (error < 1.3) input.press('forward');
    if (error < 0.7) input.press('sprint');
    return true;
  }

  /** Turn the view toward a point, no faster than `rate` radians a second. Returns how far off it still is, in radians. */
  private turnToward(point: THREE.Vector3, dt: number, rate: number): number {
    const { player, camera } = this.game;
    const dx = point.x - camera.position.x;
    const dy = point.y - camera.position.y;
    const dz = point.z - camera.position.z;
    const yawError = angleDelta(player.yaw, Math.atan2(-dx, -dz));
    const pitchError = Math.atan2(dy, Math.hypot(dx, dz)) - player.pitch;
    const step = rate * dt;
    player.yaw += clamp(yawError, -step, step);
    player.pitch += clamp(pitchError, -step, step);
    return Math.hypot(yawError, pitchError);
  }

  /**
   * The next thing worth walking to that it can pay for right now. For a
   * gun that would take the place of one it carries, `giveUp` names which.
   */
  private nextPurchase(): { x: number; z: number; label: string; giveUp?: WeaponId } | null {
    const { wallet, weapons, world } = this.game;
    const reachable = world.reachable;
    const carried = weapons.loadout.slots.filter((slot) => slot !== null).map((slot) => slot!.id);
    const full = carried.length === weapons.loadout.slots.length;
    const least = carried.reduce((a, b) => (WORTH[a] <= WORTH[b] ? a : b));
    for (const rack of RACK_PLANS) {
      if (!reachable.has(rack.area)) continue;
      const offer = rackOffer(wallet, weapons.loadout, rack.weapon, WEAPONS[rack.weapon]);
      if (offer.kind === 'weapon' && full) {
        // Both hands full: only a better gun than its worst is worth having.
        if (WORTH[rack.weapon] <= WORTH[least] || !offer.affordable) continue;
        return { x: rack.at[0] + rack.normal[0] * 0.9, z: rack.at[2] + rack.normal[2] * 0.9, label: `${WEAPONS[rack.weapon].name} rack`, giveUp: least };
      }
      if (offer.kind === 'ammo') {
        // Ammunition is worth the walk only when the weapon is running low.
        const slot = weapons.loadout.slots.find((s) => s?.id === rack.weapon);
        if (!slot || slot.state.reserve > WEAPONS[rack.weapon].reserveMax * 0.34) continue;
      }
      if (offer.kind !== 'full' && offer.affordable) {
        return { x: rack.at[0] + rack.normal[0] * 0.9, z: rack.at[2] + rack.normal[2] * 0.9, label: `${WEAPONS[rack.weapon].name} rack` };
      }
    }
    for (const plan of DOOR_PLANS) {
      const door = world.door(plan.id);
      if (door.open || plan.cost === null || wallet.scrap < plan.cost) continue;
      const near = reachable.has(plan.a) ? plan.a : reachable.has(plan.b) ? plan.b : null;
      if (!near) continue;
      // Stand a little way back from the door, on the side it can be reached from.
      // (A door's first area is always the one on its north or west side.)
      const side = near === plan.a ? -1 : 1;
      const x = plan.along === 'x' ? door.centre.x : door.centre.x + side * 1.0;
      const z = plan.along === 'x' ? door.centre.z + side * 1.0 : door.centre.z;
      return { x, z, label: `${plan.label} door` };
    }
    return null;
  }
}
