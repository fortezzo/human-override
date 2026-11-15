// Stamina: what sprinting costs.
//
// Sprinting drains a bar; walking or standing lets it refill after a short
// pause. Run it dry and the player is "winded": sprinting does not work
// again until a good part of the bar is back, so the key cannot be
// feathered to sprint forever. The point is that running buys time, not
// safety: in later rounds the fast robots are nearly as quick as a sprint,
// and they do not get tired.

export interface StaminaRules {
  /** Seconds of sprinting a full bar pays for. */
  sprintSeconds: number;
  /** Seconds after the last sprint before the bar starts to refill. */
  recoverDelay: number;
  /** Seconds to refill from empty, once refilling. */
  recoverSeconds: number;
  /** After running dry, the share of the bar (0..1) that must return before sprinting works again. */
  restartAt: number;
}

export interface Stamina {
  /** 0 = empty, 1 = full. */
  level: number;
  /** Seconds since the player last sprinted. */
  idle: number;
  /** True from the moment the bar runs dry until enough of it has come back. */
  winded: boolean;
}

export function createStamina(): Stamina {
  return { level: 1, idle: 0, winded: false };
}

/**
 * Advance by `dt` seconds. `wantSprint` is whether the player is trying to
 * sprint (the key is held and they are moving forward). Returns whether
 * they actually sprint this frame.
 */
export function updateStamina(stamina: Stamina, rules: StaminaRules, wantSprint: boolean, dt: number): boolean {
  if (stamina.winded && stamina.level >= rules.restartAt) stamina.winded = false;
  const sprinting = wantSprint && !stamina.winded && stamina.level > 0;
  if (sprinting) {
    stamina.level = Math.max(0, stamina.level - dt / rules.sprintSeconds);
    stamina.idle = 0;
    if (stamina.level === 0) stamina.winded = true;
  } else {
    stamina.idle += dt;
    if (stamina.idle >= rules.recoverDelay) stamina.level = Math.min(1, stamina.level + dt / rules.recoverSeconds);
  }
  return sprinting;
}
