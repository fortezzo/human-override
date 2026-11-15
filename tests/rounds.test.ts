import { describe, expect, it } from 'vitest';
import { ROUNDS } from '../src/config';
import { createRounds, planRound, remaining, robotDestroyed, robotRecalled, skipRound, speedFor, updateRounds, type RoundState } from '../src/sim/rounds';

const STEP = 1 / 60;

/** Run the rounds for `seconds`, destroying each robot `life` seconds after it arrives. */
function play(state: RoundState, seconds: number, life: number) {
  const alive: number[] = [];
  const events = { started: [] as number[], cleared: [] as number[], spawned: 0, peak: 0 };
  for (let t = 0; t < seconds; t += STEP) {
    for (let i = alive.length - 1; i >= 0; i--) {
      alive[i]! -= STEP;
      if (alive[i]! <= 0) {
        alive.splice(i, 1);
        robotDestroyed(state);
      }
    }
    const tick = updateRounds(state, ROUNDS, STEP, alive.length);
    if (tick.started !== null) events.started.push(tick.started);
    if (tick.cleared !== null) events.cleared.push(tick.cleared);
    for (let i = 0; i < tick.spawn; i++) alive.push(life);
    events.spawned += tick.spawn;
    events.peak = Math.max(events.peak, alive.length);
  }
  return events;
}

describe('round scaling', () => {
  it('sends more robots every round', () => {
    for (let round = 1; round < 25; round++) {
      expect(planRound(ROUNDS, round + 1).count).toBeGreaterThan(planRound(ROUNDS, round).count);
    }
    expect(planRound(ROUNDS, 1).count).toBe(ROUNDS.counts[0]);
    // Past the listed rounds, the count keeps growing by a fixed step.
    const listed = ROUNDS.counts.length;
    expect(planRound(ROUNDS, listed + 3).count).toBe(ROUNDS.counts[listed - 1]! + 3 * ROUNDS.countGrowth);
  });

  it('makes robots tougher every round, by a step at first and then by a percentage', () => {
    expect(planRound(ROUNDS, 1).health).toBe(ROUNDS.health);
    expect(planRound(ROUNDS, 2).health).toBe(ROUNDS.health + ROUNDS.healthStep);
    for (let round = 1; round < 25; round++) {
      expect(planRound(ROUNDS, round + 1).health).toBeGreaterThan(planRound(ROUNDS, round).health);
    }
    const last = planRound(ROUNDS, ROUNDS.healthStepRounds).health;
    expect(planRound(ROUNDS, ROUNDS.healthStepRounds + 1).health).toBe(Math.round(last * ROUNDS.healthGrowth));
  });

  it('has robots walk in early rounds and run in later ones, never faster than the limits', () => {
    expect(planRound(ROUNDS, 1).runShare).toBe(0);
    expect(planRound(ROUNDS, ROUNDS.runFrom - 1).runShare).toBe(0);
    expect(planRound(ROUNDS, ROUNDS.runFrom).runShare).toBeGreaterThan(0);
    for (let round = 1; round < 40; round++) {
      const plan = planRound(ROUNDS, round);
      expect(plan.walkSpeed).toBeLessThanOrEqual(ROUNDS.walkSpeedMax);
      expect(plan.runSpeed).toBeLessThanOrEqual(ROUNDS.runSpeedMax);
      expect(plan.runShare).toBeLessThanOrEqual(ROUNDS.runShareMax);
      expect(plan.spawnInterval).toBeGreaterThanOrEqual(ROUNDS.spawnIntervalMin);
    }
    const late = planRound(ROUNDS, 8);
    expect(speedFor(late, 0)).toBe(late.runSpeed);
    expect(speedFor(late, 0.999)).toBe(late.walkSpeed);
  });
});

describe('the rhythm of a round', () => {
  it('starts round 1 within five seconds of pressing Play', () => {
    const state = createRounds(ROUNDS);
    const events = play(state, 5, 999);
    expect(events.started).toEqual([1]);
    expect(events.spawned).toBeGreaterThan(0);
  });

  it('sends exactly the planned number, then clears, rests and starts the next round', () => {
    const state = createRounds(ROUNDS);
    const events = play(state, 200, 3);
    expect(events.started.slice(0, 3)).toEqual([1, 2, 3]);
    expect(events.cleared.slice(0, 2)).toEqual([1, 2]);
    // Round 2 must not begin until the lull after round 1 has passed.
    const fresh = createRounds(ROUNDS);
    let clearedAt = -1;
    let nextAt = -1;
    const alive: number[] = [];
    for (let t = 0; t < 120 && nextAt < 0; t += STEP) {
      for (let i = alive.length - 1; i >= 0; i--) {
        alive[i]! -= STEP;
        if (alive[i]! <= 0) {
          alive.splice(i, 1);
          robotDestroyed(fresh);
        }
      }
      const tick = updateRounds(fresh, ROUNDS, STEP, alive.length);
      for (let i = 0; i < tick.spawn; i++) alive.push(1);
      if (tick.cleared === 1) clearedAt = t;
      if (tick.started === 2) nextAt = t;
    }
    expect(clearedAt).toBeGreaterThan(0);
    expect(nextAt - clearedAt).toBeCloseTo(ROUNDS.lull, 1);
  });

  it('never has more than the limit on the map, and queues the rest', () => {
    const state = createRounds(ROUNDS);
    // Jump to a round bigger than the limit and never destroy anything.
    state.round = 9;
    state.timer = 0;
    const events = play(state, 120, 9999);
    expect(planRound(ROUNDS, 10).count).toBeGreaterThan(ROUNDS.maxActive);
    expect(events.peak).toBe(ROUNDS.maxActive);
    expect(events.spawned).toBe(ROUNDS.maxActive);
    expect(remaining(state)).toBe(planRound(ROUNDS, 10).count);
  });

  it('does not pour the queue in all at once when the map has been full', () => {
    const state = createRounds(ROUNDS);
    state.round = 9;
    state.timer = 0;
    play(state, 60, 9999); // the map is now full and has been for a while
    // Two robots are destroyed: only one arrives straight away.
    robotDestroyed(state);
    robotDestroyed(state);
    const tick = updateRounds(state, ROUNDS, STEP, ROUNDS.maxActive - 2);
    expect(tick.spawn).toBe(1);
  });

  it('counts remaining robots down as they are destroyed', () => {
    const state = createRounds(ROUNDS);
    play(state, 4, 9999);
    const total = planRound(ROUNDS, 1).count;
    expect(remaining(state)).toBe(total);
    robotDestroyed(state);
    expect(remaining(state)).toBe(total - 1);
  });

  it('sends a recalled robot round again', () => {
    const state = createRounds(ROUNDS);
    const events = play(state, 30, 9999);
    const total = planRound(ROUNDS, 1).count;
    expect(events.spawned).toBe(total);
    robotRecalled(state);
    const again = updateRounds(state, ROUNDS, 5, total - 1);
    expect(again.spawn).toBe(1);
    expect(remaining(state)).toBe(total);
  });

  it('skip ends the round and the next one follows after the lull', () => {
    const state = createRounds(ROUNDS);
    play(state, 6, 9999);
    skipRound(state);
    expect(updateRounds(state, ROUNDS, STEP, 0).cleared).toBe(1);
    expect(remaining(state)).toBe(0);
    const events = play(state, ROUNDS.lull + 1, 9999);
    expect(events.started).toEqual([2]);
  });
});
