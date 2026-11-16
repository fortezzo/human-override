// Timed pickups: what destroyed robots sometimes leave behind, how often,
// and what each one does. Pure logic, no rendering.
//
//   Full Resupply   every weapon carried is filled, and the grenades
//   Overload        every hit destroys what it lands on, for a while
//   EMP Blast       every robot on the map is destroyed
//   Double Scrap    everything pays double, for a while
//   Lockdown        every shutter is repaired

export type PickupId = 'resupply' | 'overload' | 'emp' | 'doubleScrap' | 'lockdown';
export const PICKUP_IDS: readonly PickupId[] = ['resupply', 'overload', 'emp', 'doubleScrap', 'lockdown'];

export interface PickupRules {
  /** The chance that a destroyed robot leaves one. */
  chance: number;
  /** The most that can be left in one round, and how many robots must be destroyed between one and the next. */
  perRound: number;
  minKills: number;
  /** How likely each kind is, relative to the others. */
  weights: Record<PickupId, number>;
  /** Seconds that Overload and Double Scrap last. */
  overloadSeconds: number;
  doubleSeconds: number;
}

/** How many have been left this round, and how many robots have been destroyed since the last. */
export interface DropState {
  thisRound: number;
  sinceDrop: number;
}

export function createDrops(): DropState {
  return { thisRound: 0, sinceDrop: 0 };
}

/** A round has begun: the count of drops starts again. */
export function dropsRoundBegan(state: DropState): void {
  state.thisRound = 0;
}

/**
 * A robot has been destroyed: does it leave a pickup, and which? `allowed`
 * lets the caller rule a kind out for now (a Lockdown with no shutter to
 * repair would be wasted). `random` returns numbers from 0 up to (not
 * including) 1. Null means it leaves nothing.
 */
export function rollDrop(state: DropState, rules: PickupRules, random: () => number, allowed: (id: PickupId) => boolean = () => true): PickupId | null {
  state.sinceDrop += 1;
  if (state.thisRound >= rules.perRound || state.sinceDrop <= rules.minKills) return null;
  if (random() >= rules.chance) return null;
  const pool = PICKUP_IDS.filter((id) => rules.weights[id] > 0 && allowed(id));
  if (!pool.length) return null;
  const total = pool.reduce((sum, id) => sum + rules.weights[id], 0);
  let mark = random() * total;
  let picked = pool[pool.length - 1]!;
  for (const id of pool) {
    mark -= rules.weights[id];
    if (mark < 0) {
      picked = id;
      break;
    }
  }
  state.thisRound += 1;
  state.sinceDrop = 0;
  return picked;
}

/** The two pickups that last: seconds left of each (0 = not running). */
export interface TimedEffects {
  overload: number;
  doubleScrap: number;
}

export function createEffects(): TimedEffects {
  return { overload: 0, doubleScrap: 0 };
}

/** Start (or start again) whichever timer a pickup has. The others act at once and are the caller's to carry out. */
export function startEffect(effects: TimedEffects, id: PickupId, rules: PickupRules): void {
  if (id === 'overload') effects.overload = rules.overloadSeconds;
  else if (id === 'doubleScrap') effects.doubleScrap = rules.doubleSeconds;
}

export function tickEffects(effects: TimedEffects, dt: number): void {
  effects.overload = Math.max(0, effects.overload - dt);
  effects.doubleScrap = Math.max(0, effects.doubleScrap - dt);
}

/** What every award is multiplied by right now. */
export function scrapMultiplier(effects: TimedEffects): number {
  return effects.doubleScrap > 0 ? 2 : 1;
}
