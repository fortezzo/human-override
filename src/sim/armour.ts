// What a hit really does to a robot that is carrying something to stop it:
// the heavy's plating, ARGUS's shielding against one weapon, and the plate
// ARGUS puts over a weak point. Each of them can be seen on the robot, and
// each has a way round it: shoot the heavy's core, use another weapon,
// shoot the plate off.
//
// Pure logic: no rendering, no browser APIs.

import type { WeaponKey } from './argus';
import { damageForZone, type DamageSpec, type HitZone } from './robotMind';

export interface Armour {
  /** Shielding against one weapon (null if none): that weapon does `shieldFactor` of its damage. */
  shield: WeaponKey | null;
  shieldFactor: number;
  /** Plating: a hit anywhere but the weak point does this share of its damage (1 = no plating). */
  plating: number;
  /** A plate over the weak point: how much more damage it will take before it comes off (0 = none). */
  guard: number;
}

export function createArmour(): Armour {
  return { shield: null, shieldFactor: 1, plating: 1, guard: 0 };
}

export interface HitOutcome {
  /** Damage done to the robot itself. */
  damage: number;
  /** It counted as a weak-point hit. */
  weakPoint: boolean;
  /** The robot's shielding took part of it. */
  resisted: boolean;
  /** The plating took part of it (a hit on the heavy that missed its core). */
  plated: boolean;
  /** It landed on the plate over the weak point ... */
  guarded: boolean;
  /** ... and that was the hit that knocked the plate off. */
  guardBroke: boolean;
}

/**
 * One projectile (or strike) lands on `zone`. `weapon` is what fired it,
 * `spec` its damage figures, and `falloff` the share left at this range.
 * Wears the plate over the weak point down if it lands there.
 */
export function resolveHit(armour: Armour, zone: HitZone, weapon: WeaponKey, spec: DamageSpec, falloff = 1): HitOutcome {
  const outcome: HitOutcome = { damage: 0, weakPoint: zone === 'head', resisted: false, plated: false, guarded: false, guardBroke: false };
  let landed = zone;
  if (zone === 'head' && armour.guard > 0) {
    // The plate is in the way: the shot does what it would to the body,
    // and the plate is that much nearer to coming off.
    landed = 'torso';
    outcome.weakPoint = false;
    outcome.guarded = true;
  }
  let damage = damageForZone(spec, landed) * falloff;
  if (outcome.guarded) {
    armour.guard = Math.max(0, armour.guard - damage);
    outcome.guardBroke = armour.guard === 0;
  }
  if (!outcome.weakPoint && armour.plating < 1) {
    damage *= armour.plating;
    outcome.plated = true;
  }
  if (armour.shield !== null && armour.shield === weapon) {
    damage *= armour.shieldFactor;
    outcome.resisted = true;
  }
  outcome.damage = damage;
  return outcome;
}
