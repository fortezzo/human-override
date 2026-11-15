// Runs the rounds: decides when robots arrive, where they come in, and how
// tough and fast each one is. The rules themselves are in sim/rounds.ts and
// sim/facility.ts; this class connects them to the map and the robots.

import { ROBOT, ROUNDS } from '../config';
import { rand } from '../core/math';
import type { Robot, RobotTraits } from '../entities/robot/Robot';
import { pickEntry } from '../sim/facility';
import { createRounds, remaining, robotDestroyed, robotRecalled, skipRound, speedFor, updateRounds, type RoundState } from '../sim/rounds';
import { ENTRY_PLANS, insideRoom, type EntryPlan } from '../world/plan';
import type { World } from '../world/World';

export class Director {
  rounds: RoundState = createRounds(ROUNDS);
  onRoundStart: (round: number) => void = () => {};
  onRoundClear: (round: number) => void = () => {};
  /** Debug: stop the rounds where they are (for staged screenshots). */
  paused = false;
  /** Debug: send every robot in through this entry (its id), whatever the rules say. */
  forceEntry: string | null = null;

  constructor(
    private readonly world: World,
    private readonly robots: Robot[],
    private readonly spawn: (x: number, z: number, heading: number, traits: RobotTraits) => Robot,
  ) {}

  /** Start again from before round 1. */
  reset(): void {
    this.rounds = createRounds(ROUNDS);
    this.paused = false;
  }

  /** Robots left to destroy this round, on the map or still to come. */
  get remaining(): number {
    return remaining(this.rounds);
  }

  update(dt: number): void {
    if (this.paused) return;
    const active = this.robots.reduce((count, robot) => count + (robot.alive ? 1 : 0), 0);
    const tick = updateRounds(this.rounds, ROUNDS, dt, active);
    if (tick.started !== null) this.onRoundStart(tick.started);
    for (let i = 0; i < tick.spawn; i++) this.sendOne();
    if (tick.cleared !== null) this.onRoundClear(tick.cleared);

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

  /** Where the next robot comes in: an entry the player can be reached from, favouring their own area. */
  private chooseEntry(): EntryPlan {
    const forced = this.forceEntry && ENTRY_PLANS.find((entry) => entry.id === this.forceEntry);
    if (forced) return forced;
    const open = ENTRY_PLANS.filter((entry) => entry.fromRound <= this.rounds.round);
    return pickEntry(open, this.world.playerArea, this.world.reachable, Math.random()) ?? ENTRY_PLANS[0]!;
  }

  private sendOne(): void {
    const entry = this.chooseEntry();
    const plan = this.rounds.plan;
    const angle = rand(0, Math.PI * 2);
    const radius = Math.sqrt(Math.random()) * entry.spread;
    const x = entry.at[0] + Math.cos(angle) * radius;
    const z = entry.at[1] + Math.sin(angle) * radius;
    const traits: RobotTraits = { health: plan.health, speed: speedFor(plan, Math.random()) };
    if (entry.kind === 'drop') traits.dropFrom = (entry.height ?? 4.8) - ROBOT.dropStart;
    const robot = this.spawn(x, z, rand(-Math.PI, Math.PI), traits);
    robot.hurry = entry.kind === 'walk';
    robot.entry = entry.id;
  }
}
