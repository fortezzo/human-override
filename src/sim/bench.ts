// The Overclock Bench: it upgrades the weapon in the player's hands, and
// can do so again and again, each step costing more than the last. Pure
// logic, no rendering.
//
// A weapon's level starts at 0 (as it comes off the wall). Each level adds
// damage and a bigger magazine. The level belongs to that one weapon: swap
// it for another and it is left behind with the gun.

import { spend, type Wallet } from './economy';

export interface BenchRules {
  /** Scrap for a weapon's first upgrade, and how much more each further one costs. */
  price: number;
  priceStep: number;
  /** The highest level a weapon can reach. */
  maxLevel: number;
  /** What each level adds, as a share of the weapon's own figures. */
  damagePerLevel: number;
  magazinePerLevel: number;
  reservePerLevel: number;
}

/** What it costs to take a weapon from `level` to the next, or null if it is as far as it goes. */
export function benchPrice(rules: BenchRules, level: number): number | null {
  if (level >= rules.maxLevel) return null;
  return rules.price + rules.priceStep * level;
}

export type BenchOffer =
  | { kind: 'upgrade'; cost: number; affordable: boolean; to: number }
  /** This weapon has had every upgrade there is. */
  | { kind: 'max' }
  /** The power is out: the bench is dead. */
  | { kind: 'noPower' };

export function benchOffer(wallet: Wallet, level: number, rules: BenchRules, powerOn: boolean): BenchOffer {
  if (!powerOn) return { kind: 'noPower' };
  const cost = benchPrice(rules, level);
  if (cost === null) return { kind: 'max' };
  return { kind: 'upgrade', cost, affordable: wallet.scrap >= cost, to: level + 1 };
}

/** Pay for the next level. Returns what was paid, or null if nothing was bought. (The caller raises the weapon's level.) */
export function buyUpgrade(wallet: Wallet, level: number, rules: BenchRules, powerOn: boolean): number | null {
  const offer = benchOffer(wallet, level, rules, powerOn);
  if (offer.kind !== 'upgrade' || !spend(wallet, offer.cost)) return null;
  return offer.cost;
}

/** The figures of a gun that the bench and the boosts change. */
export interface Tunable {
  damage: number;
  magazine: number;
  reserve: number;
  reserveMax: number;
  reloadTime: number;
  fireInterval: number;
}

/** What the player's boosts do to every gun: each is a multiple of the gun's own time (1 = no boost). */
export interface HandSpeed {
  reload: number;
  fire: number;
}

/**
 * A weapon as it really is in the player's hands: its own figures, with
 * the bench's levels and the player's boosts applied. Returns a new record
 * and leaves `base` alone.
 */
export function tune<T extends Tunable>(base: T, level: number, rules: BenchRules, hands: HandSpeed): T {
  const steps = Math.max(0, Math.min(level, rules.maxLevel));
  return {
    ...base,
    damage: base.damage * (1 + rules.damagePerLevel * steps),
    magazine: Math.round(base.magazine * (1 + rules.magazinePerLevel * steps)),
    reserve: Math.round(base.reserve * (1 + rules.reservePerLevel * steps)),
    reserveMax: Math.round(base.reserveMax * (1 + rules.reservePerLevel * steps)),
    reloadTime: base.reloadTime * hands.reload,
    fireInterval: base.fireInterval * hands.fire,
  };
}

const NUMERALS = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** How a level is written after a weapon's name: nothing for one off the wall, then "Mk II", "Mk III" ... */
export function markName(level: number): string {
  if (level <= 0) return '';
  return `Mk ${NUMERALS[level] ?? String(level + 1)}`;
}
