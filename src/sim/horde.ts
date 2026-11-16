// What a round is made of: how many of each kind of robot, which of them
// carry one of ARGUS's counters, and in what order they are sent in.
//
// Pure logic: no rendering, no browser APIs. The director asks for the
// list at the start of a round and works through it.

import type { Adaptation, WeaponKey } from './argus';

/** The ordinary labour robot, or one of the specials. */
export type RobotKind = 'drudge' | 'drone' | 'bomber' | 'heavy';

/** One robot to be sent in. */
export interface SpawnOrder {
  kind: RobotKind;
  /** It carries shielding against this weapon (ARGUS's answer to leaning on one). */
  shield?: WeaponKey;
  /** It wears a plate over its weak point (ARGUS's answer to precise fire). */
  guard?: boolean;
  /**
   * Where it should come in, if ARGUS has a say: 'behind' is the entry
   * nearest the player (the breach that flushes them out), 'ahead' is the
   * entry in front of the way they are running (an interceptor).
   */
  route?: 'behind' | 'ahead';
}

export interface SpecialRule {
  /** The first round this kind appears in. */
  from: number;
  /** How many that round has, how often one more is added (in rounds), and the most there can be. */
  count: number;
  every: number;
  most: number;
}

export interface HordeRules {
  specials: Record<'drone' | 'bomber' | 'heavy', SpecialRule>;
  shielding: { share: number };
  flush: { bombers: number; breach: number };
  intercept: { drones: number };
  guard: { share: number };
}

/** Swarm rounds: every `every`th round is all drones, `count` of them the first time and `countStep` more each time after. */
export interface SwarmRules {
  every: number;
  count: number;
  countStep: number;
}

export function isSwarmRound(rules: SwarmRules, round: number): boolean {
  return rules.every > 0 && round > 0 && round % rules.every === 0;
}

/** How many drones a swarm round sends. */
export function swarmSize(rules: SwarmRules, round: number): number {
  return rules.count + rules.countStep * Math.max(0, Math.floor(round / rules.every) - 1);
}

/** The robots of a swarm round: drones and nothing else. ARGUS's counters are for the rounds between. */
export function composeSwarm(rules: SwarmRules, round: number): SpawnOrder[] {
  return Array.from({ length: swarmSize(rules, round) }, (): SpawnOrder => ({ kind: 'drone' }));
}

/** How many of a special kind an ordinary round has. */
export function specialsIn(rule: SpecialRule, round: number): number {
  if (round < rule.from) return 0;
  return Math.min(rule.most, rule.count + Math.floor((round - rule.from) / rule.every));
}

/**
 * The robots of a round, in the order they are sent.
 *
 * `count` is the size the round would have with ordinary robots alone. The
 * round's own specials take the place of that many ordinary robots (never
 * more than a third of them), and are spread through the round so that
 * they do not arrive all at once. Whatever ARGUS adds for a counter (extra
 * bombers, interceptors) comes on top. `random` returns numbers from 0 up
 * to (not including) 1.
 */
export function composeRound(rules: HordeRules, round: number, count: number, counters: readonly Adaptation[], random: () => number): SpawnOrder[] {
  const has = (id: Adaptation['counter']): Adaptation | undefined => counters.find((c) => c.counter === id);

  // The round's own specials, capped so that the horde is still mostly horde.
  const kinds: Array<'drone' | 'bomber' | 'heavy'> = ['heavy', 'bomber', 'drone'];
  const wanted = kinds.map((kind) => ({ kind, n: specialsIn(rules.specials[kind], round) }));
  let room = Math.floor(count / 3);
  const specials: SpawnOrder[] = [];
  for (const { kind, n } of wanted) {
    const take = Math.min(n, room);
    room -= take;
    for (let i = 0; i < take; i++) specials.push({ kind });
  }

  // The ordinary robots, some of them carrying ARGUS's counters.
  const ordinary: SpawnOrder[] = [];
  const plain = count - specials.length;
  const shielding = has('shielding');
  const shielded = shielding?.weapon ? Math.round(plain * rules.shielding.share) : 0;
  const guarded = has('guard') ? Math.round(plain * rules.guard.share) : 0;
  const breaching = has('flush') ? Math.round(plain * rules.flush.breach) : 0;
  for (let i = 0; i < plain; i++) ordinary.push({ kind: 'drudge' });
  // (Each counter is dealt out to a different, random set of them; a robot can carry more than one.)
  const deal = (n: number, mark: (order: SpawnOrder) => void): void => {
    const picks = ordinary.map((_, i) => i);
    for (let i = 0; i < n && picks.length; i++) {
      const at = Math.floor(random() * picks.length);
      mark(ordinary[picks[at]!]!);
      picks.splice(at, 1);
    }
  };
  deal(shielded, (order) => (order.shield = shielding!.weapon));
  deal(guarded, (order) => (order.guard = true));
  deal(breaching, (order) => (order.route = 'behind'));

  // What ARGUS adds on top.
  if (has('flush')) for (let i = 0; i < rules.flush.bombers; i++) specials.push({ kind: 'bomber', route: 'behind' });
  if (has('intercept')) for (let i = 0; i < rules.intercept.drones; i++) specials.push({ kind: 'drone', route: 'ahead' });

  // Spread the specials through the round: none among the first few
  // arrivals, the rest at even intervals, each nudged a little.
  const orders = ordinary.slice();
  const lead = Math.min(3, orders.length);
  const span = orders.length - lead;
  // (Shuffled first, so that it is not always the heavy that comes first.)
  for (let i = specials.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [specials[i], specials[j]] = [specials[j]!, specials[i]!];
  }
  const slots = specials.map((_, i) => lead + Math.floor(((i + 0.2 + random() * 0.6) / specials.length) * span));
  // (Inserted from the back, so that earlier positions are not shifted by later insertions.)
  for (let i = specials.length - 1; i >= 0; i--) orders.splice(Math.min(slots[i]!, orders.length), 0, specials[i]!);
  return orders;
}
