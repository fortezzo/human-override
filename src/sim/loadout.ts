// What the player is carrying: two weapon slots, and the rules for filling
// them. Pure logic, so it can be unit-tested without a browser.
//
// The rule from the design: you carry two weapons; taking a third replaces
// the one in your hands.

import { createWeapon, type WeaponSpec, type WeaponState } from './weapon';

export interface CarriedWeapon<Id extends string> {
  id: Id;
  state: WeaponState;
  /** How many times the Overclock Bench has upgraded it (0 = as it comes off the wall). */
  level: number;
}

export interface Loadout<Id extends string> {
  slots: Array<CarriedWeapon<Id> | null>;
  /** Index of the slot in the player's hands. */
  current: number;
}

export function createLoadout<Id extends string>(slotCount: number, starting: Id, spec: WeaponSpec): Loadout<Id> {
  const slots: Array<CarriedWeapon<Id> | null> = Array.from({ length: slotCount }, () => null);
  slots[0] = { id: starting, state: createWeapon(spec), level: 0 };
  return { slots, current: 0 };
}

export function held<Id extends string>(loadout: Loadout<Id>): CarriedWeapon<Id> {
  return loadout.slots[loadout.current]!;
}

export function slotOf<Id extends string>(loadout: Loadout<Id>, id: Id): number {
  return loadout.slots.findIndex((slot) => slot?.id === id);
}

export function owns<Id extends string>(loadout: Loadout<Id>, id: Id): boolean {
  return slotOf(loadout, id) >= 0;
}

export interface TakeResult<Id extends string> {
  /** The slot the weapon went into (it becomes the held one). */
  slot: number;
  /** The weapon that was dropped to make room, if any. */
  replaced: Id | null;
}

/**
 * Pick up a new weapon, fully loaded. It goes into an empty slot if there
 * is one, otherwise it replaces the weapon in hand. Either way it ends up
 * in the player's hands. (Taking a weapon already carried is a refill; use
 * `refill` for that.)
 */
export function takeWeapon<Id extends string>(loadout: Loadout<Id>, id: Id, spec: WeaponSpec, level = 0): TakeResult<Id> {
  let slot = loadout.slots.findIndex((s) => s === null);
  let replaced: Id | null = null;
  if (slot < 0) {
    slot = loadout.current;
    replaced = loadout.slots[slot]!.id;
  }
  loadout.slots[slot] = { id, state: createWeapon(spec), level };
  loadout.current = slot;
  return { slot, replaced };
}

/**
 * Take what the Prototype Crate is offering: a weapon at a given level,
 * fully loaded (`spec` is that weapon at that level). If the player is
 * already carrying one of the same kind, the new one takes its place;
 * otherwise it is picked up like any other. Either way it ends up in hand.
 */
export function takeOffer<Id extends string>(loadout: Loadout<Id>, id: Id, spec: WeaponSpec, level: number): TakeResult<Id> {
  const own = slotOf(loadout, id);
  if (own < 0) return takeWeapon(loadout, id, spec, level);
  loadout.slots[own] = { id, state: createWeapon(spec), level };
  loadout.current = own;
  return { slot: own, replaced: null };
}

/** True if the weapon has room for more spare rounds or a fuller magazine. */
export function needsAmmo(state: WeaponState, spec: WeaponSpec, reserveMax: number): boolean {
  return state.reserve < reserveMax || state.ammo < spec.magazine;
}

/** Top a weapon up: full magazine and as many spares as can be carried. */
export function refill(state: WeaponState, spec: WeaponSpec, reserveMax: number): void {
  state.ammo = spec.magazine;
  state.reserve = reserveMax;
  state.reloading = false;
  state.reloadTimer = 0;
}

/** The next occupied slot after the current one, or the current one if it is the only one. */
export function nextSlot<Id extends string>(loadout: Loadout<Id>, direction: 1 | -1 = 1): number {
  const n = loadout.slots.length;
  for (let step = 1; step < n; step++) {
    const index = (loadout.current + direction * step + n * step) % n;
    if (loadout.slots[index]) return index;
  }
  return loadout.current;
}
