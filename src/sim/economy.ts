// Scrap: how it is earned and spent. Pure logic, no rendering.
//
// Earning: every shot that hits a robot pays a little, and destroying one
// pays more, with bonuses for weak-point and melee kills.
// Spending: wall racks (a weapon, or ammunition for one already carried)
// and doors. Each purchase is decided here and reported back as a result,
// so the same rules drive the prompt on screen and the purchase itself.

import { needsAmmo, owns, refill, slotOf, takeWeapon, type Loadout, type TakeResult } from './loadout';
import type { WeaponSpec } from './weapon';

export interface Wallet {
  scrap: number;
  /** Totals for the end-of-run screen. */
  earned: number;
  spent: number;
}

export function createWallet(start = 0): Wallet {
  return { scrap: start, earned: 0, spent: 0 };
}

export interface ScrapAwards {
  hit: number;
  kill: number;
  weakPointKill: number;
  meleeKill: number;
}

export interface HitReport {
  /** The shot or strike destroyed the robot. */
  killed: boolean;
  /** It landed on the weak point. */
  weakPoint: boolean;
  melee: boolean;
}

/** Scrap for one shot (or strike) that landed on one robot. */
export function awardFor(report: HitReport, awards: ScrapAwards): number {
  if (!report.killed) return awards.hit;
  if (report.melee) return awards.meleeKill;
  return report.weakPoint ? awards.weakPointKill : awards.kill;
}

export function earn(wallet: Wallet, amount: number): void {
  wallet.scrap += amount;
  wallet.earned += amount;
}

/** Pay if possible. Returns false (and takes nothing) if the wallet is short. */
export function spend(wallet: Wallet, cost: number): boolean {
  if (cost > wallet.scrap) return false;
  wallet.scrap -= cost;
  wallet.spent += cost;
  return true;
}

// ----------------------------------------------------------- wall racks

export interface RackOffer {
  /** What pressing the button would do right now. */
  kind: 'weapon' | 'ammo' | 'full';
  cost: number;
  affordable: boolean;
}

export interface RackItem extends WeaponSpec {
  price: number;
  ammoPrice: number;
  reserveMax: number;
}

/** What a wall rack offers this player: the weapon, ammunition for it, or nothing (already full). */
export function rackOffer<Id extends string>(wallet: Wallet, loadout: Loadout<Id>, id: Id, item: RackItem): RackOffer {
  if (!owns(loadout, id)) return { kind: 'weapon', cost: item.price, affordable: wallet.scrap >= item.price };
  const state = loadout.slots[slotOf(loadout, id)]!.state;
  if (!needsAmmo(state, item, item.reserveMax)) return { kind: 'full', cost: 0, affordable: false };
  return { kind: 'ammo', cost: item.ammoPrice, affordable: wallet.scrap >= item.ammoPrice };
}

export interface RackPurchase<Id extends string> {
  bought: 'weapon' | 'ammo' | null;
  cost: number;
  /** For a weapon: where it went and what it replaced. */
  taken?: TakeResult<Id>;
}

/** Use a wall rack. Charges the wallet and changes the loadout only if the purchase goes through. */
export function buyFromRack<Id extends string>(wallet: Wallet, loadout: Loadout<Id>, id: Id, item: RackItem): RackPurchase<Id> {
  const offer = rackOffer(wallet, loadout, id, item);
  if (offer.kind === 'full' || !spend(wallet, offer.cost)) return { bought: null, cost: 0 };
  if (offer.kind === 'weapon') {
    const taken = takeWeapon(loadout, id, item);
    loadout.slots[taken.slot]!.state.reserve = item.reserve;
    return { bought: 'weapon', cost: offer.cost, taken };
  }
  refill(loadout.slots[slotOf(loadout, id)]!.state, item, item.reserveMax);
  return { bought: 'ammo', cost: offer.cost };
}
