// The rules of a magazine-fed gun: rate of fire, ammunition and reloading.
// Pure logic, so it can be unit-tested without a browser.

export interface WeaponSpec {
  magazine: number;
  reserve: number;
  /** Seconds between shots. */
  fireInterval: number;
  reloadTime: number;
  /** Fraction of the reload after which the new magazine counts as loaded. */
  reloadCommit: number;
}

export interface WeaponState {
  ammo: number;
  reserve: number;
  /** Seconds until the next shot is allowed. */
  cooldown: number;
  reloading: boolean;
  /** Seconds into the current reload. */
  reloadTimer: number;
  /** True once this reload has put rounds in the magazine. */
  reloadCommitted: boolean;
}

export function createWeapon(spec: WeaponSpec): WeaponState {
  return { ammo: spec.magazine, reserve: spec.reserve, cooldown: 0, reloading: false, reloadTimer: 0, reloadCommitted: false };
}

/** Tolerance for floating-point drift when counting down the cooldown. */
const READY = 1e-9;

export function canFire(state: WeaponState): boolean {
  return !state.reloading && state.cooldown <= READY && state.ammo > 0;
}

/** Fire one round if allowed. Returns true if a shot left the barrel. */
export function fire(state: WeaponState, spec: WeaponSpec): boolean {
  if (!canFire(state)) return false;
  state.ammo -= 1;
  // Adding to (rather than resetting) the cooldown carries over any time
  // already "owed", so the fire rate stays exact at any frame rate.
  state.cooldown += spec.fireInterval;
  return true;
}

export function canReload(state: WeaponState, spec: WeaponSpec): boolean {
  return !state.reloading && state.ammo < spec.magazine && state.reserve > 0;
}

export function startReload(state: WeaponState, spec: WeaponSpec): boolean {
  if (!canReload(state, spec)) return false;
  state.reloading = true;
  state.reloadTimer = 0;
  state.reloadCommitted = false;
  return true;
}

/** Abandon a reload (for example when switching weapons). */
export function cancelReload(state: WeaponState): void {
  state.reloading = false;
  state.reloadTimer = 0;
}

export interface WeaponTick {
  /** The magazine was filled on this update. */
  loaded: boolean;
  /** The reload animation finished on this update. */
  finished: boolean;
}

export function updateWeapon(state: WeaponState, spec: WeaponSpec, dt: number): WeaponTick {
  const tick: WeaponTick = { loaded: false, finished: false };
  // The cooldown may dip below zero by at most this frame's length: that
  // is the part of the frame the gun was already ready for.
  state.cooldown = Math.max(-dt, state.cooldown - dt);

  if (state.reloading) {
    state.reloadTimer += dt;
    if (!state.reloadCommitted && state.reloadTimer >= spec.reloadTime * spec.reloadCommit) {
      const wanted = spec.magazine - state.ammo;
      const taken = Math.min(wanted, state.reserve);
      state.ammo += taken;
      state.reserve -= taken;
      state.reloadCommitted = true;
      tick.loaded = true;
    }
    if (state.reloadTimer >= spec.reloadTime) {
      state.reloading = false;
      state.reloadTimer = 0;
      tick.finished = true;
    }
  }
  return tick;
}

/** 0..1 progress through the reload, or 0 when not reloading. */
export function reloadProgress(state: WeaponState, spec: WeaponSpec): number {
  return state.reloading ? Math.min(1, state.reloadTimer / spec.reloadTime) : 0;
}
