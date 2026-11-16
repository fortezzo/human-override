// Shutters: the roller doors over the openings robots walk in through.
// Pure logic, no rendering.
//
// A shutter that is down keeps robots (and the player) on their own side of
// it. Robots batter it: each blow takes one off its strength, and at none
// it is forced up and they come through. The player can run it back down
// from indoors for a little scrap, as often as they like.

import { spend, type Wallet } from './economy';

export interface ShutterRules {
  /** Blows a sound shutter takes before it is forced. */
  strength: number;
  /** Scrap to run one back down. */
  repairCost: number;
}

export interface Shutter {
  id: string;
  /** Blows it can still take. 0 = forced open. */
  strength: number;
}

export function createShutter(id: string, rules: ShutterRules): Shutter {
  return { id, strength: rules.strength };
}

/** Is it down (and so in the way)? */
export function isShut(shutter: Shutter): boolean {
  return shutter.strength > 0;
}

/** A blow lands on it (or several at once). Returns true if that was the blow that forced it. */
export function strikeShutter(shutter: Shutter, blows = 1): boolean {
  if (shutter.strength <= 0) return false;
  shutter.strength = Math.max(0, shutter.strength - blows);
  return shutter.strength === 0;
}

export type RepairOffer =
  | { kind: 'repair'; cost: number; affordable: boolean }
  /** There is nothing wrong with it. */
  | { kind: 'sound' };

export function repairOffer(wallet: Wallet, shutter: Shutter, rules: ShutterRules): RepairOffer {
  if (shutter.strength >= rules.strength) return { kind: 'sound' };
  return { kind: 'repair', cost: rules.repairCost, affordable: wallet.scrap >= rules.repairCost };
}

/** Run it back down. Returns what was paid, or null if nothing was done. */
export function repairShutter(wallet: Wallet, shutter: Shutter, rules: ShutterRules): number | null {
  const offer = repairOffer(wallet, shutter, rules);
  if (offer.kind !== 'repair' || !spend(wallet, offer.cost)) return null;
  shutter.strength = rules.strength;
  return offer.cost;
}

/**
 * Lockdown: every shutter is made sound, free, except those `skip` picks
 * out (one the player is standing on the wrong side of must not shut them
 * out). Returns how many were repaired.
 */
export function lockdown(shutters: readonly Shutter[], rules: ShutterRules, skip: (shutter: Shutter) => boolean = () => false): number {
  let repaired = 0;
  for (const shutter of shutters) {
    if (shutter.strength >= rules.strength || skip(shutter)) continue;
    shutter.strength = rules.strength;
    repaired += 1;
  }
  return repaired;
}
