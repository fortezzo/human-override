// A debug player that moves, aims and shoots by itself.
//
// The code was written by an agent that cannot hold a mouse, so this is how
// the game gets played during testing: it presses the same buttons a person
// would. It turns to the nearest robot it can see, fires when lined up,
// backs away when crowded, strikes when one is in reach, reloads when it
// should, and between fights walks to the next thing it can afford (a
// weapon, then doors) and buys it.
//
// It comes in three characters. The "expert" never misses and never
// hesitates: it is the test tool that proves the game can be played. The
// "first-timer" is a rough model of someone new to this kind of game: slow
// to notice, shaky, aims at the body, backs up late and runs when hurt. It
// exists to answer one question the expert cannot: how far does a beginner
// usually get? (tools/balance.mjs plays it many times and counts.) The
// "skilled" player is in between, and is the model of the "focused player"
// the mission is paced for: quick but not instant, mostly on target, aims
// for the head a little over half the time, and gets ready before starting
// a fight.
//
// Any of them can also be told to play the mission: it then follows the
// objective tracker as a player would, walking to each step in the gaps
// between fights, standing its ground at the uplink and in the core, and
// pulling the switch. (tools/mission.mjs plays whole missions that way and
// reports how long they take and how they end.)

import * as THREE from 'three';
import { MELEE, MISSION, SPECIALS, WEAPONS, type WeaponId } from '../config';
import type { Action } from '../core/input';
import { angleDelta, clamp } from '../core/math';
import type { Robot } from '../entities/robot/Robot';
import type { Game } from '../game/Game';
import { rackOffer } from '../sim/economy';
import { floodFrom, nextWaypoint, type NavGrid } from '../sim/navGrid';
import { CORE, DOOR_PLANS, HALL, MISSION_PLACES, RACK_PLANS, UPLINK } from '../world/plan';

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
  /**
   * The habits of someone who has played this kind of game before. Caught
   * reloading with robots closing, it sprints clear and then turns to
   * fight again; with an empty gun and robots close it swaps to the other
   * gun instead of reloading; and in every quiet moment it sees that both
   * guns are loaded and tops up their ammunition.
   */
  practised: boolean;
  /**
   * Holding ground for the mission (the uplink's circle, the core), it
   * gives the ground up when its health falls below this, or a crowd is
   * on top of it, and comes back when it has recovered: the clock only
   * stops while it is away, which is what the pause is for.
   */
  yieldBelow: number;
  /** Playing the mission: how far off the nearest robot must be before it breaks off to do the next step, metres. */
  errandAt: number;
  /** Playing the mission: before starting a fight (the uplink, the final stand) it waits until it is healthy and loaded. */
  prepares: boolean;
}

export type PilotName = 'expert' | 'skilled' | 'firstTimer';

export const PILOTS: Record<PilotName, PilotProfile> = {
  expert: { reaction: 0, turnRate: 7, headShare: 1, wobble: 0, linedFar: 0.035, linedNear: 0.12, tapEvery: 0, retreatAt: 5, panicBelow: 0, tidyReloads: true, rethink: 0.2, practised: false, yieldBelow: 35, errandAt: 6, prepares: true },
  skilled: { reaction: 0.22, turnRate: 5.2, headShare: 0.55, wobble: 0.16, linedFar: 0.045, linedNear: 0.14, tapEvery: 0.17, retreatAt: 5, panicBelow: 0, tidyReloads: true, rethink: 0.3, practised: true, yieldBelow: 45, errandAt: 6, prepares: true },
  firstTimer: { reaction: 0.45, turnRate: 3.4, headShare: 0.15, wobble: 0.5, linedFar: 0.07, linedNear: 0.18, tapEvery: 0.3, retreatAt: 4, panicBelow: 50, tidyReloads: false, rethink: 0.8, practised: false, yieldBelow: 60, errandAt: 9, prepares: false },
};

/** A patch of floor: what is inside a circle and inside a rectangle. */
interface Zone {
  x: number;
  z: number;
  radius: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}
const inZone = (zone: Zone, x: number, z: number): boolean => x >= zone.x0 && x <= zone.x1 && z >= zone.z0 && z <= zone.z1 && Math.hypot(x - zone.x, z - zone.z) <= zone.radius;

/** Somewhere the pilot means to walk to, and what to do there. */
interface Goal {
  x: number;
  z: number;
  label: string;
  /** For a gun that would take the place of one it carries: which one to give up. */
  giveUp?: WeaponId;
  /** What to turn to on arrival (otherwise the spot itself). */
  face?: { x: number; z: number };
  /** How near counts as there, metres. */
  reach?: number;
  /** Nothing to press on arrival: just stand there. */
  rest?: boolean;
  /** It cannot wait for a gap in the fighting. */
  urgent?: boolean;
}

/** Something the mission wants done. */
interface Duty extends Goal {
  /** Ground to stay on while it is being done. */
  hold?: Zone;
}

const PLACE_NAMES: Record<keyof typeof MISSION_PLACES, string> = {
  breaker: 'the main breaker',
  cage: 'the key cage',
  uplink: 'the uplink',
  coreDoor: "the core's door",
  killSwitch: 'the kill switch',
};

/** Which gun is worth more than which: it never trades down. */
const WORTH: Record<WeaponId, number> = { pistol: 0, shotgun: 1, carbine: 2 };
/** The wall racks, the best gun's first: that is the one it buys, and tops up, before the others. */
const RACKS_BEST_FIRST = [...RACK_PLANS].sort((a, b) => WORTH[b.weapon] - WORTH[a.weapon]);

const _eye = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class Autopilot {
  /** What it is doing, for the debug overlay. */
  status = 'idle';
  /** Which character is playing. */
  profile: PilotProfile = PILOTS.expert;
  /** Play the mission as well as the rounds: follow the objective tracker. */
  mission = false;
  /** Ground it is holding for the mission (the uplink's circle, the core), or null. It does not back away out of it. */
  private zone: Zone | null = null;
  /** Seconds left of having given that ground up to save itself. */
  private givingGround = 0;

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
  /** Seconds since it last had a robot in its sights. */
  private sinceContact = 99;
  private readonly wobble = new THREE.Vector3();
  private wobbleTimer = 0;
  private sinceShot = 99;
  private fleeTimer = 0;
  /** Seconds since it last changed guns of its own accord (it does not change back and forth for every other target). */
  private sinceSwap = 99;
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

  /**
   * Its own flood of the floor map (the game's is flooded toward the
   * player, for the robots). It shares the map itself with the game's, so
   * when a door opens it sees the opening; but a flood made before that is
   * stale, and is thrown away here. (Without this it stood at a door it had
   * just opened, still following a route worked out while it was shut.)
   */
  private routeTo(fresh = false): NavGrid {
    const nav = this.game.world.nav;
    this.route ??= { ...nav, distance: new Float32Array(nav.distance.length).fill(Infinity), goal: -1 };
    if (fresh || this.route.version !== nav.version) {
      this.route.version = nav.version;
      this.route.goal = -1;
    }
    return this.route;
  }

  /** One frame of an errand. */
  private runErrand(dt: number): void {
    const { player, input } = this.game;
    const errand = this.errand!;
    const distance = Math.hypot(errand.x - player.position.x, errand.z - player.position.z);
    if (distance < 0.3) {
      this.status = 'arrived';
      if (!errand.look || this.turnToward(_aim.set(errand.look.x, player.position.y + 1.6, errand.look.z), dt, 7) < 0.03) this.errand = null;
      return;
    }
    this.status = `walking (${distance.toFixed(1)} m to go)`;
    floodFrom(this.routeTo(), errand.x, errand.z);
    // For the last step, head straight for the spot itself.
    const waypoint = distance < 0.9 ? { x: errand.x, z: errand.z } : nextWaypoint(this.routeTo(), player.position.x, player.position.z);
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
    this.sinceSwap += dt;

    // The nearest robot it has a clear line to.
    _eye.copy(game.camera.position);
    let seen: Robot | null = null;
    let nearest = Infinity;
    let closestAny = Infinity;
    let crowd = 0;
    let standing = 0;
    /** A bomber about to go off, close enough to matter. */
    let fuseNear = false;
    /** How near the robot it would shoot at counts as being: a bomber counts as nearer than it is, so it is shot first. */
    let nearestRank = Infinity;
    for (const robot of robots) {
      if (!robot.alive) continue;
      standing++;
      robot.aimPoint(_aim);
      const distance = _aim.distanceTo(_eye);
      closestAny = Math.min(closestAny, distance);
      if (distance < 3) crowd++;
      if (robot.fuse >= 0 && distance < SPECIALS.bomber.radius + 1) fuseNear = true;
      // (A practised player picks the bomber out of the crowd while it is
      // still a way off, and leaves the robots that are proof against the
      // gun in hand until last, unless they are on top of it.)
      let rank = distance;
      if (profile.practised && robot.kind === 'bomber' && distance > 4 && distance < 16) rank = distance * 0.4;
      else if (profile.practised && distance > 2.5 && robot.shieldedAgainst === weapons.def.id) rank = distance * 1.5;
      if (rank >= nearestRank) continue;
      _dir.copy(_aim).sub(_eye).divideScalar(distance);
      this.raycaster.set(_eye, _dir);
      this.raycaster.far = distance - 0.3;
      if (this.raycaster.intersectObjects(world.solids, false).length) continue;
      nearestRank = rank;
      nearest = distance;
      seen = robot;
    }

    // It stays on the robot it is already fighting unless another is
    // clearly nearer: flicking back and forth between two robots at the
    // same distance is how a crowd gets through.
    const current = this.target;
    if (current && current !== seen && current.alive) {
      current.aimPoint(_aim);
      const distance = _aim.distanceTo(_eye);
      if (distance * 0.7 < nearest && !(seen && seen.kind === 'bomber' && current.kind !== 'bomber')) {
        _dir.copy(_aim).sub(_eye).divideScalar(distance);
        this.raycaster.set(_eye, _dir);
        this.raycaster.far = distance - 0.3;
        if (!this.raycaster.intersectObjects(world.solids, false).length) {
          seen = current;
          nearest = distance;
        }
      }
    }

    // A new target takes a moment to register, and gets a fresh decision
    // about where to aim. The first robot it has seen in a while costs its
    // whole reaction time; moving on to the next one of a group, less.
    if (seen !== this.target) {
      const fresh = this.target === null && this.sinceContact > 1;
      this.target = seen;
      if (seen) {
        this.reactTimer = fresh ? profile.reaction : profile.reaction * 0.4;
        this.aimAtHead = Math.random() < profile.headShare;
      }
    }
    this.sinceContact = seen ? 0 : this.sinceContact + dt;
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
    // Caught reloading with robots closing: the practised player sprints
    // clear and turns. (Not once they are within reach: turning its back on
    // a robot at arm's length only gets it hit from behind.)
    if (profile.practised && this.fleeTimer <= 0 && !player.stamina.winded && weapons.reloading && closestAny < 6 && closestAny > 2.2) this.fleeTimer = 1.2;
    // A bomber beeping within reach of its blast: anybody runs.
    if (fuseNear && this.fleeTimer <= 0 && !player.stamina.winded) this.fleeTimer = 1.0;
    if (this.fleeTimer > 0) {
      this.fleeTimer -= dt;
      this.releaseTrigger();
      if (this.flee(dt)) return;
      this.fleeTimer = 0;
    }

    // What the mission wants done next, if it is playing the mission: an
    // errand (somewhere to go, something to use there) or ground to hold.
    const duty = this.mission ? this.nextDuty(standing) : null;
    let zone = duty?.hold ?? null;
    // Ground is given up when it is about to cost a life, and taken back
    // once there is the health to hold it again.
    if (zone) {
      if (this.givingGround <= 0 && (player.health < profile.yieldBelow || crowd >= 4)) this.givingGround = 7;
      if (this.givingGround > 0) {
        this.givingGround -= dt;
        if (player.health >= 90 && closestAny > 5) this.givingGround = 0;
        if (this.givingGround > 0) zone = null;
      }
    } else {
      this.givingGround = 0;
    }
    this.zone = zone;
    const outside = zone !== null && !inZone(zone, player.position.x, player.position.z);

    // Is there something worth breaking off for? A gun it can now afford,
    // or ammunition when it is running low, matters more than the robot
    // across the room: people do run for the rack in the middle of a round.
    // Not with one in its face, though, unless every gun is empty. (And not
    // while there is ground to hold: a trip to the rack would give it up.)
    const purchase = zone || this.givingGround > 0 ? null : this.nextPurchase(closestAny > 14);
    const dry = state.ammo === 0 && state.reserve === 0 && !weapons.loadout.slots.some((slot, i) => slot && i !== weapons.loadout.current && (slot.state.ammo > 0 || slot.state.reserve > 0));
    // (The practised player does not wait for a gap when it matters: a
    // better gun it can now afford, or a gun that is all but empty, is
    // worth running for with the robots a few steps behind.)
    const shopping = purchase !== null && (!seen || nearest > 6 || (dry && nearest > 2.5) || (profile.practised && purchase.urgent === true && nearest > 3.5));
    // The mission's errands wait for a gap in the same way; one that cannot
    // wait (the armed switch) is run at once, though not through a robot at
    // arm's length: that one is dealt with first, unless the switch can be
    // used from here. Ground that has been left is gone back to unless
    // something is close enough to hit.
    const offered = duty !== null && !duty.hold && game.mission.interaction()?.use != null;
    const errand =
      duty !== null && !shopping && this.givingGround <= 0 && (zone ? outside && (!seen || nearest > 2.5) : duty.urgent === true ? !seen || nearest > 1.6 || offered : !seen || nearest > profile.errandAt);

    if (seen && !shopping && !errand) {
      this.lull = 0;
      this.status = `fighting (${nearest.toFixed(1)} m)`;
      // Where it means to hit, plus however far its hands have wandered.
      // (The heavy's core is the only part of it worth shooting, and it glows: everybody aims there.)
      seen.aimPoint(_aim, this.aimAtHead || seen.kind === 'heavy');
      if (profile.wobble > 0) {
        this.wobbleTimer -= dt;
        if (this.wobbleTimer <= 0) {
          this.wobbleTimer = 0.35 + Math.random() * 0.3;
          this.wobble.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * profile.wobble);
        }
        // (The wander is an angle, really: at a robot two metres off it is a few centimetres, not half a metre.)
        _aim.addScaledVector(this.wobble, clamp(nearest / 5, 0.25, 1));
      }
      const reacting = this.reactTimer > 0;
      const error = reacting ? Infinity : this.turnToward(_aim, dt, profile.turnRate);
      // Pull the trigger when lined up. Tapping, so single-shot weapons fire too.
      // (Up close a robot fills the sights: nobody misses one at arm's length.)
      const lined = error < Math.max(nearest < 4 ? profile.linedNear : profile.linedFar, Math.atan2(0.22, nearest));
      if (lined && !this.fireHeld && state.ammo > 0 && (def.automatic || this.sinceShot >= profile.tapEvery)) {
        input.press('fire');
        this.fireHeld = true;
        this.sinceShot = 0;
      } else if (this.fireHeld && (!def.automatic || !lined)) {
        this.releaseTrigger();
      }
      // A strike is for a robot it will finish (in the first rounds that
      // is any robot; later, one that is already damaged), or for when
      // there is nothing left to shoot with. Otherwise the gun does more,
      // and a strike in the middle of a reload throws the reload away.
      const finishing = seen.healthLeft * seen.spec.health <= MELEE.damage;
      if (nearest < MELEE.range - 0.2 && !reacting && !weapons.reloading && (finishing || dry)) this.tap('melee');
      else if (!weapons.reloading && !weapons.busy) {
        const index = weapons.loadout.slots.findIndex((slot, i) => slot && i !== weapons.loadout.current);
        const other = index >= 0 ? weapons.loadout.slots[index]! : null;
        const swap = (): void => {
          this.tap(index === 0 ? 'weapon1' : 'weapon2');
          this.sinceSwap = 0;
        };
        // ARGUS's shielding is against one gun. A robot that is proof
        // against the gun in hand is shot with the other one, if it is
        // loaded and the robot is near enough for it; and having changed,
        // the practised player stays with that gun for a few seconds
        // rather than changing back for the next robot along.
        const shield = seen.shieldedAgainst;
        const proofAgainstThis = shield === def.id;
        const proofAgainstOther = other !== null && shield === other.id;
        const settled = this.sinceSwap > 2.5;
        if (profile.practised && proofAgainstThis && other && !proofAgainstOther && other.state.ammo > 0 && settled && (other.id !== 'shotgun' || nearest < 7)) swap();
        else if (state.ammo === 0) {
          // An empty gun with robots at arm's length: the other gun, if it
          // is loaded, is quicker than a reload. Otherwise reload the
          // better of the two.
          if (profile.practised && other && other.state.ammo > 0 && nearest < 4) swap();
          else if (profile.practised && other && WORTH[other.id] > WORTH[def.id] && other.state.reserve > 0) swap();
          else if (state.reserve > 0) this.tap('reload');
        } else if (profile.practised && other && WORTH[other.id] > WORTH[def.id] && !proofAgainstOther && settled) {
          // Holding the lesser gun: back to the better one as soon as it
          // is loaded, or as soon as there is room to load it (unless the
          // robot in its sights is proof against that one).
          if (other.state.ammo > 0 || (other.state.reserve > 0 && nearest > 4.5)) swap();
        }
      }

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
    // (Topping up a magazine that is nearly full is for when nothing is
    // near: with robots a few steps away it would only take the gun out of
    // its hands when it is needed.)
    const wantsReload = profile.tidyReloads ? state.ammo < def.magazine * (closestAny > 12 ? 1 : 0.4) : state.ammo === 0 || (this.lull > 2.5 && state.ammo < def.magazine * 0.5);
    if (wantsReload && state.reserve > 0 && !weapons.reloading) this.tap('reload');
    else if (profile.practised && !seen && !weapons.reloading && !weapons.busy) {
      // With this gun seen to, the practised player sees to the other one:
      // reloads it if it was left empty, and ends up holding the better.
      const index = weapons.loadout.slots.findIndex((slot, i) => slot && i !== weapons.loadout.current);
      const other = index >= 0 ? weapons.loadout.slots[index]! : null;
      if (other) {
        const needsLoading = other.state.ammo < WEAPONS[other.id].magazine && other.state.reserve > 0;
        const better = WORTH[other.id] > WORTH[def.id] && (other.state.ammo > 0 || other.state.reserve > 0);
        if (needsLoading || better) this.tap(index === 0 ? 'weapon1' : 'weapon2');
      }
    }

    // Nothing to shoot at (or something else comes first). If a robot is
    // close but out of sight, wait for it (not for ever: after a few seconds
    // go and find it); otherwise go and do whatever there is to do.
    if (!shopping && !errand && closestAny < 9 && this.lull < 4) {
      this.status = 'waiting';
      return;
    }
    let goal: Goal | null;
    if (shopping) goal = purchase;
    else if (errand) goal = duty;
    else if (zone && duty) {
      // Holding ground with nothing in sight: drift back to the middle of
      // it, where there is room to back away in any direction.
      goal = Math.hypot(duty.x - player.position.x, duty.z - player.position.z) > 2.2 ? duty : null;
    } else goal = closestAny < 9 || this.lull > 8 ? this.nearestRobot() : null;
    if (!goal) {
      this.status = zone ? `holding ${duty!.label}` : 'waiting';
      return;
    }
    this.status = `going to ${goal.label}`;
    const distance = Math.hypot(goal.x - player.position.x, goal.z - player.position.z);
    // (The mission's things can be used from as far away as their prompt
    // reaches. A player presses F the moment it comes up, and does not push
    // through a crowd for the last step to the console.)
    if (distance < (goal.reach ?? 1.5) || (goal === duty && offered)) {
      if (goal.rest) return;
      // Face it and press the button. A new gun takes the place of the one
      // in hand, so make sure that is the one worth less.
      const face = goal.face ?? goal;
      this.turnToward(_aim.set(face.x, 1.4, face.z), dt, Math.max(profile.turnRate, 4));
      if (goal.giveUp && def.id !== goal.giveUp) {
        if (!weapons.busy) this.tap(weapons.loadout.slots.findIndex((slot) => slot?.id === goal.giveUp) === 0 ? 'weapon1' : 'weapon2');
      } else if (game.interactions.prompt?.usable && !weapons.busy) {
        this.tap('interact');
      }
      return;
    }
    floodFrom(this.routeTo(), goal.x, goal.z);
    // (For the last step, head straight for the spot itself.)
    const waypoint = distance < 0.9 ? goal : nextWaypoint(this.routeTo(), player.position.x, player.position.z);
    if (!waypoint) return;
    const error = this.turnToward(_aim.set(waypoint.x, 1.5, waypoint.z), dt, Math.max(profile.turnRate, 4));
    if (error < 0.6) {
      input.press('forward');
      if (error < 0.2 && distance > 4) input.press('sprint');
    }
  }

  /**
   * What the mission wants done next, read off the objective tracker the
   * way a player reads it: somewhere to go and something to use there, or
   * ground to hold. Null when there is nothing to do but fight (the
   * Custodian comes to the player; so does everything else), or when the
   * way there is still shut.
   */
  private nextDuty(standing = 0): Duty | null {
    const { mission, world, player, weapons } = this.game;
    const state = mission.state;
    const target = mission.objective.target;
    if (!target || target === 'custodian' || state.phase === 'saved') return null;
    if (target === 'custodianKey') {
      const at = world.mission.droppedAt;
      return at ? { x: at.x, z: at.z, label: "the Custodian's key", reach: 1.1 } : null;
    }
    const place = MISSION_PLACES[target];
    if (!world.reachable.has(place.area)) return null;
    const at = { x: place.stand[0], z: place.stand[1], face: { x: place.at[0], z: place.at[2] }, reach: 0.8 };
    if (state.uplink === 'running' && target === 'uplink') {
      // The ground round the uplink: inside its circle and inside the hall.
      const inset = 0.7;
      return { x: UPLINK.zone.x, z: UPLINK.zone.z, label: 'the ground round the uplink', reach: 1.2, rest: true, hold: { x: UPLINK.zone.x, z: UPLINK.zone.z, radius: MISSION.uplinkRadius - 0.9, x0: HALL.x0 + inset, z0: HALL.z0 + inset, x1: HALL.x1 - inset, z1: HALL.z1 - inset } };
    }
    if (state.phase === 'arming') {
      const inset = 0.8;
      return { x: at.x, z: at.z, label: 'the core', reach: 1.2, rest: true, hold: { x: at.x, z: at.z, radius: Infinity, x0: CORE.x0 + inset, z0: CORE.z0 + inset, x1: CORE.x1 - inset, z1: CORE.z1 - inset } };
    }
    if (state.phase === 'armed') return { ...at, label: 'the kill switch', urgent: true };
    // Before anything that starts a fight (the uplink, the final stand), it
    // gets ready the way a careful player does: on its feet, loaded, and
    // not in the middle of something else.
    const startsFight = (target === 'uplink' && state.uplink === 'idle') || (target === 'killSwitch' && state.phase === 'core');
    if (startsFight && this.profile.prepares) {
      const slot = weapons.loadout.slots[weapons.loadout.current];
      const loaded = !slot || slot.state.ammo >= WEAPONS[slot.id].magazine * 0.6 || slot.state.reserve === 0;
      // (And it does not start one with less than the best gun on the map,
      // once the rack that sells it can be reached.)
      const best = RACKS_BEST_FIRST[0]!;
      const armed = !world.reachable.has(best.area) || weapons.loadout.slots.some((s) => s?.id === best.weapon);
      // (Nor with the room still full of the last one.)
      if (player.health < 85 || !loaded || !armed || standing > 3) return null;
    }
    return { ...at, label: PLACE_NAMES[target] };
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
        if (this.zone && !inZone(this.zone, x, z)) continue;
        const c = Math.floor((x - nav.x0) / nav.cell);
        const r = Math.floor((z - nav.z0) / nav.cell);
        if (c < 3 || r < 3 || c >= nav.cols - 3 || r >= nav.rows - 3 || !nav.reach[r * nav.cols + c]) continue;
        // Open floor around it: corners and dead ends score low.
        // (Measured over the few metres round the spot, not just the square it is in:
        // the corner of a room is open floor too, and the worst place to be caught.)
        let open = 0;
        let squares = 0;
        for (let dr = -8; dr <= 8; dr += 2) {
          for (let dc = -8; dc <= 8; dc += 2) {
            const rr = r + dr;
            const cc = c + dc;
            squares++;
            if (rr >= 0 && cc >= 0 && rr < nav.rows && cc < nav.cols) open += nav.reach[rr * nav.cols + cc]!;
          }
        }
        let nearestRobot = 12;
        for (const robot of robots) if (robot.alive) nearestRobot = Math.min(nearestRobot, Math.hypot(robot.position.x - x, robot.position.z - z));
        let score = nearestRobot + (open / squares) * 9;
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
    floodFrom(this.routeTo(true), bestX, bestZ);
    return true;
  }

  /** The direction of the next step toward the refuge, or false if there is no way there. */
  private refugeStep(): boolean {
    const { player } = this.game;
    const escape = this.escape;
    if (!escape.found || !this.route) return false;
    const waypoint = nextWaypoint(this.routeTo(), player.position.x, player.position.z);
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
  private nextPurchase(quiet = false): Goal | null {
    const { wallet, weapons, world } = this.game;
    // Ammunition is worth the walk when a gun is running low; in a quiet
    // moment the practised player tops up well before that, and with the
    // final stand ahead, sooner still.
    const lowAt = this.mission && this.profile.prepares && this.game.mission.state.phase === 'core' ? 0.8 : this.profile.practised && quiet ? 0.7 : 0.34;
    const reachable = world.reachable;
    const carried = weapons.loadout.slots.filter((slot) => slot !== null).map((slot) => slot!.id);
    const full = carried.length === weapons.loadout.slots.length;
    const least = carried.reduce((a, b) => (WORTH[a] <= WORTH[b] ? a : b));
    for (const rack of RACKS_BEST_FIRST) {
      if (!reachable.has(rack.area)) continue;
      const offer = rackOffer(wallet, weapons.loadout, rack.weapon, WEAPONS[rack.weapon]);
      if (offer.kind === 'weapon' && full) {
        // Both hands full: only a better gun than its worst is worth having.
        if (WORTH[rack.weapon] <= WORTH[least] || !offer.affordable) continue;
        return { x: rack.at[0] + rack.normal[0] * 0.9, z: rack.at[2] + rack.normal[2] * 0.9, label: `${WEAPONS[rack.weapon].name} rack`, giveUp: least, urgent: true };
      }
      let urgent = offer.kind === 'weapon';
      if (offer.kind === 'ammo') {
        // Ammunition is worth the walk only when the weapon is running low.
        const slot = weapons.loadout.slots.find((s) => s?.id === rack.weapon);
        if (!slot || slot.state.reserve > WEAPONS[rack.weapon].reserveMax * lowAt) continue;
        urgent = slot.state.reserve <= WEAPONS[rack.weapon].reserveMax * 0.12;
      }
      if (offer.kind !== 'full' && offer.affordable) {
        return { x: rack.at[0] + rack.normal[0] * 0.9, z: rack.at[2] + rack.normal[2] * 0.9, label: `${WEAPONS[rack.weapon].name} rack`, urgent };
      }
    }
    for (const plan of DOOR_PLANS) {
      const door = world.door(plan.id);
      if (door.open || plan.cost === null || wallet.scrap < plan.cost) continue;
      // (The mission needs the server hall and the power room; the door between them is a luxury.)
      if (this.mission && plan.id === 'hallPower') continue;
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
