// The four Boost Stations: what each one sells, what it costs, and when it
// can be bought. Pure logic, no rendering.
//
// A boost is permanent for the run, with one exception: the fail-safe is
// used up the moment it saves the player, and can then be bought again for
// more than it cost the last time. The stations only work while the power
// is on.

import { spend, type Wallet } from './economy';

export type BoostId = 'carapace' | 'autoloader' | 'hairTrigger' | 'failsafe';
export const BOOST_IDS: readonly BoostId[] = ['carapace', 'autoloader', 'hairTrigger', 'failsafe'];

export interface BoostRule {
  price: number;
  /** How much more it costs each time it is bought again (the fail-safe only). */
  priceStep?: number;
}
export type BoostRules = Record<BoostId, BoostRule>;

export interface Boosts {
  /** Which boosts the player has right now. */
  owned: Record<BoostId, boolean>;
  /** How many times each has been bought this run. */
  bought: Record<BoostId, number>;
}

export function createBoosts(): Boosts {
  return {
    owned: { carapace: false, autoloader: false, hairTrigger: false, failsafe: false },
    bought: { carapace: 0, autoloader: 0, hairTrigger: 0, failsafe: 0 },
  };
}

/** What a station is asking right now. */
export function boostPrice(boosts: Boosts, id: BoostId, rules: BoostRules): number {
  const rule = rules[id];
  return rule.price + (rule.priceStep ?? 0) * boosts.bought[id];
}

export type BoostOffer =
  | { kind: 'buy'; cost: number; affordable: boolean }
  /** The player already has it. */
  | { kind: 'owned' }
  /** The power is out: the station is dead. */
  | { kind: 'noPower' };

export function boostOffer(wallet: Wallet, boosts: Boosts, id: BoostId, rules: BoostRules, powerOn: boolean): BoostOffer {
  if (!powerOn) return { kind: 'noPower' };
  if (boosts.owned[id]) return { kind: 'owned' };
  const cost = boostPrice(boosts, id, rules);
  return { kind: 'buy', cost, affordable: wallet.scrap >= cost };
}

/** Use a station. Returns what was paid, or null if nothing was bought. */
export function buyBoost(wallet: Wallet, boosts: Boosts, id: BoostId, rules: BoostRules, powerOn: boolean): number | null {
  const offer = boostOffer(wallet, boosts, id, rules, powerOn);
  if (offer.kind !== 'buy' || !spend(wallet, offer.cost)) return null;
  boosts.owned[id] = true;
  boosts.bought[id] += 1;
  return offer.cost;
}

/**
 * The player has taken a blow that would put them down. If they are
 * carrying the fail-safe it is used up, and the answer is true: they get
 * back up. It is gone after that until it is bought again.
 */
export function useFailsafe(boosts: Boosts): boolean {
  if (!boosts.owned.failsafe) return false;
  boosts.owned.failsafe = false;
  return true;
}
