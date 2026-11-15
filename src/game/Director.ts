// Runs the rounds: decides when robots arrive, where they come in, and how
// tough and fast each one is. The rules themselves are in sim/rounds.ts and
// sim/facility.ts; this class connects them to the map and the robots.

import * as THREE from 'three';
import { ROBOT, ROUNDS } from '../config';
import { rand } from '../core/math';
import type { Robot, RobotTraits } from '../entities/robot/Robot';
import { pickEntry, pickUnseenEntry } from '../sim/facility';
import { createRounds, remaining, robotDestroyed, robotRecalled, skipRound, speedFor, updateRounds, type RoundState } from '../sim/rounds';
import { ENTRY_PLANS, insideRoom, type AreaId, type EntryPlan } from '../world/plan';
import type { World } from '../world/World';
import type { Sight } from './Sight';

/** Where a robot is about to be created. */
interface Arrival {
  entry: EntryPlan;
  x: number;
  z: number;
  /** A debug order, exempt from the "out of sight" rule. */
  forced: boolean;
}

const _mouth = new THREE.Vector3();

export class Director {
  rounds: RoundState = createRounds(ROUNDS);
  onRoundStart: (round: number) => void = () => {};
  onRoundClear: (round: number) => void = () => {};
  /** A robot has just been created at an entry (`forced` = by a debug order). */
  onArrival: (robot: Robot, entry: EntryPlan, forced: boolean) => void = () => {};
  /**
   * Robots the round has released that are still waiting for somewhere to
   * come in unseen. They are tried again on every update.
   */
  waiting = 0;
  /** How long the robot at the head of that queue has waited, in seconds. */
  waited = 0;
  /** How many robots have had to be let in at an entry the player could have seen, had they turned round. Should stay 0. */
  lastResorts = 0;
  /** Debug: stop the rounds where they are (for staged screenshots). */
  paused = false;
  /**
   * The final stand has the map to itself: while this is set the rounds
   * stand still (no robots of their own are released, and no round begins
   * or ends), and whatever the mission sends in still comes.
   */
  suspended = false;
  /** Debug: send every robot in through this entry (its id), whatever the rules say. */
  forceEntry: string | null = null;

  constructor(
    private readonly world: World,
    private readonly robots: Robot[],
    private readonly spawn: (x: number, z: number, heading: number, traits: RobotTraits) => Robot,
    private readonly sight: Sight,
  ) {}

  /** Start again from before round 1. */
  reset(): void {
    this.rounds = createRounds(ROUNDS);
    this.paused = false;
    this.suspended = false;
    this.waiting = 0;
    this.waited = 0;
    this.lastResorts = 0;
  }

  /** Robots left to destroy this round, on the map or still to come. */
  get remaining(): number {
    return remaining(this.rounds);
  }

  /** Robots on the map and working, of every kind. */
  get active(): number {
    return this.robots.reduce((count, robot) => count + (robot.alive ? 1 : 0), 0);
  }

  /** Is there room on the map for one more? */
  get room(): boolean {
    return this.active + this.waiting < ROUNDS.maxActive;
  }

  /**
   * Send in a robot of the mission's own, on top of the round's: a wave at
   * the uplink or the final stand, the Custodian, ARGUS's Proxy. It comes
   * in at an entry in one of `areas` if one of those is out of the
   * player's sight, at any other entry if not, and not at all (null) if
   * the player can see every entry: the caller tries again. `health` is
   * a multiple of an ordinary robot's in the current round; `speed`, if
   * given, is in metres per second (otherwise it walks or runs as that
   * round's robots do).
   */
  sendExtra(areas: readonly AreaId[], make: { health?: number; speed?: number } & Pick<RobotTraits, 'role' | 'attackDamage' | 'staggerDamage' | 'flinchTime'> = {}): Robot | null {
    const reachable = this.world.reachable;
    const spots = new Map<EntryPlan, [number, number]>();
    const unseen = (entry: EntryPlan): boolean => {
      const spot = this.unseenSpot(entry);
      if (spot) spots.set(entry, spot);
      return spot !== null;
    };
    const wanted = ENTRY_PLANS.filter((entry) => areas.includes(entry.area) && reachable.has(entry.area) && unseen(entry));
    const others = wanted.length ? [] : ENTRY_PLANS.filter((entry) => !areas.includes(entry.area) && reachable.has(entry.area) && unseen(entry));
    const pool = wanted.length ? wanted : others;
    if (!pool.length) return null;
    const entry = pool[Math.floor(Math.random() * pool.length)]!;
    const [x, z] = spots.get(entry)!;
    // Before the first round there is no plan yet for "an ordinary robot of this round": use round 1's.
    const plan = this.rounds.plan;
    const traits: RobotTraits = {
      health: plan.health * (make.health ?? 1),
      speed: make.speed ?? speedFor(plan, Math.random()),
      role: make.role,
      attackDamage: make.attackDamage,
      staggerDamage: make.staggerDamage,
      flinchTime: make.flinchTime,
      extra: true,
    };
    if (entry.kind === 'drop') traits.dropFrom = (entry.height ?? 4.8) + ROBOT.dropStart;
    const robot = this.spawn(x, z, rand(-Math.PI, Math.PI), traits);
    robot.hurry = entry.kind === 'walk';
    robot.entry = entry.id;
    this.onArrival(robot, entry, false);
    return robot;
  }

  /**
   * The kill switch has been pulled: whatever was left of the round is
   * over. The rounds pick up again with the next one, after the usual lull.
   */
  endRound(): void {
    this.waiting = 0;
    this.waited = 0;
    if (this.rounds.phase === 'active') skipRound(this.rounds);
    // Pulled during a lull: the next round still waits its full time.
    else this.rounds.timer = ROUNDS.lull;
  }

  update(dt: number): void {
    if (!this.paused && !this.suspended) {
      // Robots waiting to come in count towards how full the map is.
      const tick = updateRounds(this.rounds, ROUNDS, dt, this.active + this.waiting);
      if (tick.started !== null) this.onRoundStart(tick.started);
      this.waiting += tick.spawn;
      // Each is let in as soon as there is somewhere it can appear unseen.
      if (this.waiting > 0) this.waited += dt;
      while (this.waiting > 0 && this.sendOne()) {
        this.waiting -= 1;
        this.waited = 0;
      }
      if (tick.cleared !== null) this.onRoundClear(tick.cleared);
    }

    // Robots hurry across the yards outside and slow to their own pace indoors.
    for (const robot of this.robots) {
      if (robot.hurry && insideRoom(robot.position.x, robot.position.z)) robot.hurry = false;
    }
  }

  /** A robot was destroyed by the player. */
  destroyed(): void {
    robotDestroyed(this.rounds);
  }

  /** A robot was taken off the map without being destroyed; it will come round again. */
  recalled(): void {
    robotRecalled(this.rounds);
  }

  /** Debug: end the round now. The caller clears the robots off the map. */
  skip(): void {
    skipRound(this.rounds);
  }

  /** A random spot within an entry's spread. */
  private spotAt(entry: EntryPlan): [number, number] {
    const angle = rand(0, Math.PI * 2);
    const radius = Math.sqrt(Math.random()) * entry.spread;
    return [entry.at[0] + Math.cos(angle) * radius, entry.at[1] + Math.sin(angle) * radius];
  }

  /**
   * Somewhere at an entry where a robot could be created right now without
   * the player seeing it, or null if there is nowhere.
   *
   * Robots that walk in are created outside, round a corner: the spot must
   * have no line of sight to the player at all, whichever way they are
   * facing. Robots that drop from a vent are created above the ceiling,
   * where they cannot be seen, and fall out of it: a vent is used only
   * while the player is not looking at it, or at the space under it, and
   * is not standing beneath it.
   */
  private unseenSpot(entry: EntryPlan): [number, number] | null {
    if (entry.kind === 'drop') {
      // Not just the mouth of the vent (its torn grille hangs in front of
      // it from some angles) but the whole column the robot will fall
      // through, down to the floor it lands on.
      // Nor is one dropped on the player's head: a vent they are standing under is left alone.
      if (this.sight.standingNear(entry.at[0], entry.at[1], ROUNDS.ventClearance)) return null;
      // And as wide as the robot is, all the way up: a vent half hidden
      // behind a column is still being looked at. (Testing only the middle
      // of it once let a robot drop in plain view beside a pillar.)
      const [x, z] = this.spotAt(entry);
      const top = (entry.height ?? 4.8) - 0.05;
      for (let y = 0.1; y <= top; y += 0.2) {
        for (const [dx, dz] of [[0, 0], [0.36, 0], [-0.36, 0], [0, 0.36], [0, -0.36]] as const) {
          if (this.sight.watching(_mouth.set(x + dx, y, z + dz))) return null;
        }
      }
      return [x, z];
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      const spot = attempt === 0 ? ([entry.at[0], entry.at[1]] as [number, number]) : this.spotAt(entry);
      if (!this.sight.robotInSight(spot[0], 0, spot[1])) return spot;
    }
    return null;
  }

  /**
   * Where the next robot comes in: an entry the player can be reached
   * from, favouring their own area, and never one where they would see it
   * appear. Null if there is nowhere for now.
   */
  private chooseArrival(): Arrival | null {
    const forced = this.forceEntry && ENTRY_PLANS.find((entry) => entry.id === this.forceEntry);
    if (forced) {
      const [x, z] = this.spotAt(forced);
      return { entry: forced, x, z, forced: true };
    }
    const spots = new Map<EntryPlan, [number, number]>();
    const unseen = (entry: EntryPlan): boolean => {
      const spot = this.unseenSpot(entry);
      if (spot) spots.set(entry, spot);
      return spot !== null;
    };
    const entry = pickUnseenEntry(ENTRY_PLANS, this.rounds.round, this.world.playerArea, this.world.reachable, unseen, Math.random());
    if (entry) {
      const [x, z] = spots.get(entry)!;
      return { entry, x, z, forced: false };
    }
    // The player has a line of sight to every entry on the map at once.
    // The map is built so that this cannot happen, but a round must never
    // be stopped by it: after a few seconds, use an entry that is at least
    // behind them.
    if (this.waited < ROUNDS.arrivalPatience) return null;
    const reachable = this.world.reachable;
    const behind = ENTRY_PLANS.filter((candidate) => reachable.has(candidate.area) && !this.sight.inView(_mouth.set(candidate.at[0], 1.2, candidate.at[1])));
    const fallback = pickEntry(behind, this.world.playerArea, reachable, Math.random());
    if (!fallback) return null;
    this.lastResorts += 1;
    const [x, z] = this.spotAt(fallback);
    return { entry: fallback, x, z, forced: false };
  }

  /** Create the next robot, if there is somewhere it can appear unseen. Returns false if it has to wait. */
  private sendOne(): boolean {
    const arrival = this.chooseArrival();
    if (!arrival) return false;
    const { entry, x, z } = arrival;
    const plan = this.rounds.plan;
    const traits: RobotTraits = { health: plan.health, speed: speedFor(plan, Math.random()) };
    if (entry.kind === 'drop') traits.dropFrom = (entry.height ?? 4.8) + ROBOT.dropStart;
    const robot = this.spawn(x, z, rand(-Math.PI, Math.PI), traits);
    robot.hurry = entry.kind === 'walk';
    robot.entry = entry.id;
    this.onArrival(robot, entry, arrival.forced);
    return true;
  }
}
