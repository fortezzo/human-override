// Grenades: how many the player carries, and how hard a blast hits at a
// distance. Pure logic, no rendering.

export interface GrenadeRules {
  /** How many a run starts with, the most that can be carried, and how many each new round hands out. */
  start: number;
  max: number;
  perRound: number;
}

export interface Grenades {
  count: number;
}

export function createGrenades(rules: GrenadeRules): Grenades {
  return { count: Math.min(rules.start, rules.max) };
}

/** A round has begun: a few more, up to what can be carried. */
export function grenadesRoundBegan(grenades: Grenades, rules: GrenadeRules): void {
  grenades.count = Math.min(rules.max, grenades.count + rules.perRound);
}

/** Take one to throw. False if there are none. */
export function takeGrenade(grenades: Grenades): boolean {
  if (grenades.count <= 0) return false;
  grenades.count -= 1;
  return true;
}

/** A Full Resupply: as many as can be carried. */
export function refillGrenades(grenades: Grenades, rules: GrenadeRules): void {
  grenades.count = rules.max;
}

/**
 * How much of a blast reaches something `distance` metres from its middle:
 * all of it at the middle, none at `radius` and beyond, in a straight line
 * between.
 */
export function blastShare(distance: number, radius: number): number {
  if (radius <= 0) return 0;
  return Math.max(0, 1 - distance / radius);
}
