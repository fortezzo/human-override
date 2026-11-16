// The Prototype Crate: pay, and it hands out a weapon chosen at random.
// Pure logic, no rendering.
//
// What it can give:
//   - the one special weapon found nowhere else, if the player is not
//     already carrying it. The chance grows with every roll that does not
//     produce it, so nobody goes a dozen rolls without seeing it;
//   - otherwise one of the ordinary guns, already overclocked. A gun the
//     player is not carrying comes at `freshLevel`; one they are carrying
//     comes a level above their own, so the crate never offers something
//     worse than what is already in their hands.
//
// The player may leave what it offers. (Taking it is in sim/loadout.ts.)

export interface CrateRules {
  price: number;
  /** The chance of the special weapon on a roll, and how much it grows with each roll that misses it. */
  specialChance: number;
  specialChanceStep: number;
  /** The level a gun the player is not carrying comes at. */
  freshLevel: number;
  /** The bench's highest level: the crate does not go past it either. */
  maxLevel: number;
}

export interface CrateState {
  /** Rolls since the special weapon last came up. */
  dry: number;
}

export function createCrate(): CrateState {
  return { dry: 0 };
}

export interface CrateOffer<Id extends string> {
  weapon: Id;
  level: number;
  special: boolean;
}

/** The chance that the next roll is the special weapon (if the player is not carrying it). */
export function specialChance(state: CrateState, rules: CrateRules): number {
  return Math.min(1, rules.specialChance + rules.specialChanceStep * state.dry);
}

/**
 * Roll the crate. `guns` are the ordinary weapons it can hand out,
 * `special` the one found nowhere else, and `carried` what the player has
 * now. `random` returns numbers from 0 up to (not including) 1.
 */
export function rollCrate<Id extends string>(
  state: CrateState,
  rules: CrateRules,
  guns: readonly Id[],
  special: Id,
  carried: ReadonlyArray<{ id: Id; level: number }>,
  random: () => number,
): CrateOffer<Id> {
  const levelOf = (id: Id): number | null => carried.find((weapon) => weapon.id === id)?.level ?? null;
  const hasSpecial = levelOf(special) !== null;
  // The guns it could still improve on: ones not carried, and ones carried below the top level.
  const open = guns.filter((id) => (levelOf(id) ?? -1) < rules.maxLevel);

  if (!hasSpecial && (random() < specialChance(state, rules) || open.length === 0)) {
    state.dry = 0;
    return { weapon: special, level: 0, special: true };
  }
  state.dry += 1;
  // (Everything carried is at the top level, the special included: hand out a top-level gun, which is at least a full refill.)
  const pool = open.length ? open : guns;
  const weapon = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
  const own = levelOf(weapon);
  const level = own === null ? rules.freshLevel : Math.min(rules.maxLevel, own + 1);
  return { weapon, level, special: false };
}
