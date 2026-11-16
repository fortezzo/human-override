import { describe, expect, it } from 'vitest';
import { ARGUS, ROUNDS, SPECIALS } from '../src/config';
import type { Adaptation } from '../src/sim/argus';
import { composeRound, specialsIn, type HordeRules, type SpawnOrder } from '../src/sim/horde';
import { planRound } from '../src/sim/rounds';

const rules: HordeRules = { specials: SPECIALS, shielding: ARGUS.shielding, flush: ARGUS.flush, intercept: ARGUS.intercept, guard: ARGUS.guard };

/** A repeatable stand-in for Math.random. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const compose = (round: number, counters: Adaptation[] = [], seed = 7): SpawnOrder[] => composeRound(rules, round, planRound(ROUNDS, round).count, counters, seeded(seed));
const count = (orders: SpawnOrder[], kind: SpawnOrder['kind']): number => orders.filter((order) => order.kind === kind).length;

describe('the special robots', () => {
  it('stay out of the first rounds, and arrive in the order drone, bomber, heavy', () => {
    expect(SPECIALS.drone.from).toBeGreaterThanOrEqual(3);
    expect(SPECIALS.drone.from).toBeLessThan(SPECIALS.bomber.from);
    expect(SPECIALS.bomber.from).toBeLessThan(SPECIALS.heavy.from);
    for (let round = 1; round < SPECIALS.drone.from; round++) {
      const orders = compose(round);
      expect(orders.every((order) => order.kind === 'drudge')).toBe(true);
    }
  });

  it('grow in number as the rounds climb, up to a limit', () => {
    for (const rule of Object.values(SPECIALS)) {
      expect(specialsIn(rule, rule.from - 1)).toBe(0);
      expect(specialsIn(rule, rule.from)).toBe(rule.count);
      expect(specialsIn(rule, rule.from + rule.every)).toBe(Math.min(rule.most, rule.count + 1));
      expect(specialsIn(rule, 99)).toBe(rule.most);
    }
  });

  it('take the place of ordinary robots: the round is no longer for having them', () => {
    for (let round = 1; round <= 20; round++) {
      const orders = compose(round);
      expect(orders).toHaveLength(planRound(ROUNDS, round).count);
      expect(count(orders, 'drone')).toBe(specialsIn(SPECIALS.drone, round));
      expect(count(orders, 'bomber')).toBe(specialsIn(SPECIALS.bomber, round));
      expect(count(orders, 'heavy')).toBe(specialsIn(SPECIALS.heavy, round));
      // The horde is still mostly horde.
      expect(count(orders, 'drudge')).toBeGreaterThanOrEqual(orders.length * 0.6);
    }
  });

  it('are spread through the round, not sent all at once or first', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const orders = compose(12, [], seed);
      const at = orders.map((order, i) => (order.kind === 'drudge' ? -1 : i)).filter((i) => i >= 0);
      expect(at[0]).toBeGreaterThanOrEqual(3);
      // Some in each half of the round.
      expect(at.some((i) => i < orders.length / 2)).toBe(true);
      expect(at.some((i) => i >= orders.length / 2)).toBe(true);
    }
  });

  it('never outnumber a tiny round', () => {
    const orders = composeRound(rules, 20, 6, [], seeded(3));
    expect(orders).toHaveLength(6);
    expect(count(orders, 'drudge')).toBeGreaterThanOrEqual(4);
  });
});

describe("ARGUS's counters in the horde", () => {
  it('with none in force, no robot carries one', () => {
    for (const order of compose(10)) {
      expect(order.shield).toBeUndefined();
      expect(order.guard).toBeUndefined();
      expect(order.route).toBeUndefined();
    }
  });

  it('shielding: a share of the ordinary robots carry it, against the weapon named, and the rest do not', () => {
    const orders = compose(10, [{ counter: 'shielding', weapon: 'carbine' }]);
    const ordinary = orders.filter((order) => order.kind === 'drudge');
    const shielded = ordinary.filter((order) => order.shield === 'carbine');
    expect(shielded.length).toBe(Math.round(ordinary.length * ARGUS.shielding.share));
    expect(shielded.length).toBeLessThan(ordinary.length);
    expect(orders.filter((order) => order.kind !== 'drudge').every((order) => order.shield === undefined)).toBe(true);
    // The round is the same size: shielding is not more robots.
    expect(orders).toHaveLength(planRound(ROUNDS, 10).count);
  });

  it('guard: a share of the ordinary robots wear a plate over the weak point', () => {
    const orders = compose(10, [{ counter: 'guard' }]);
    const ordinary = orders.filter((order) => order.kind === 'drudge');
    expect(ordinary.filter((order) => order.guard).length).toBe(Math.round(ordinary.length * ARGUS.guard.share));
    expect(orders).toHaveLength(planRound(ROUNDS, 10).count);
  });

  it('flush: bombers are added, and a share of the round comes in behind the player', () => {
    const plain = compose(5);
    const orders = compose(5, [{ counter: 'flush' }]);
    expect(count(plain, 'bomber')).toBe(0);
    expect(count(orders, 'bomber')).toBe(ARGUS.flush.bombers);
    expect(orders).toHaveLength(plain.length + ARGUS.flush.bombers);
    expect(orders.filter((order) => order.kind === 'bomber').every((order) => order.route === 'behind')).toBe(true);
    const ordinary = orders.filter((order) => order.kind === 'drudge');
    expect(ordinary.filter((order) => order.route === 'behind').length).toBe(Math.round(ordinary.length * ARGUS.flush.breach));
  });

  it('intercept: drones are added, sent in ahead of the player', () => {
    const plain = compose(5);
    const orders = compose(5, [{ counter: 'intercept' }]);
    expect(count(orders, 'drone') - count(plain, 'drone')).toBe(ARGUS.intercept.drones);
    expect(orders.filter((order) => order.route === 'ahead')).toHaveLength(ARGUS.intercept.drones);
    expect(orders.filter((order) => order.route === 'ahead').every((order) => order.kind === 'drone')).toBe(true);
  });

  it('two counters at once both show', () => {
    const orders = compose(9, [{ counter: 'shielding', weapon: 'shotgun' }, { counter: 'guard' }]);
    expect(orders.some((order) => order.shield === 'shotgun')).toBe(true);
    expect(orders.some((order) => order.guard)).toBe(true);
  });

  it('is the same list for the same roll of the dice', () => {
    const counters: Adaptation[] = [{ counter: 'shielding', weapon: 'carbine' }, { counter: 'flush' }];
    expect(compose(11, counters, 42)).toEqual(compose(11, counters, 42));
    expect(compose(11, counters, 42)).not.toEqual(compose(11, counters, 43));
  });
});
