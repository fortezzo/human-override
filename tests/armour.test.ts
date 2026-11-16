import { describe, expect, it } from 'vitest';
import { ARGUS, MELEE, SPECIALS, WEAPONS } from '../src/config';
import { createArmour, resolveHit, type Armour } from '../src/sim/armour';

const carbine = WEAPONS.carbine;
const strike = { damage: MELEE.damage, weakPointMultiplier: 1, limbMultiplier: 1 };
const armour = (change: Partial<Armour>): Armour => ({ ...createArmour(), ...change });

describe('a robot with nothing to stop a hit', () => {
  it('takes what the weapon does to that part of it', () => {
    const plain = createArmour();
    expect(resolveHit(plain, 'torso', 'carbine', carbine)).toMatchObject({ damage: carbine.damage, weakPoint: false, resisted: false, plated: false, guarded: false });
    expect(resolveHit(plain, 'head', 'carbine', carbine)).toMatchObject({ damage: carbine.damage * carbine.weakPointMultiplier, weakPoint: true });
    expect(resolveHit(plain, 'limb', 'carbine', carbine).damage).toBeCloseTo(carbine.damage * carbine.limbMultiplier);
    expect(resolveHit(plain, 'torso', 'carbine', carbine, 0.5).damage).toBeCloseTo(carbine.damage * 0.5);
  });
});

describe("ARGUS's shielding", () => {
  const shielded = (): Armour => armour({ shield: 'carbine', shieldFactor: ARGUS.shielding.factor });

  it('halves the damage of the weapon it answers, wherever it lands', () => {
    expect(ARGUS.shielding.factor).toBe(0.5);
    expect(resolveHit(shielded(), 'torso', 'carbine', carbine)).toMatchObject({ damage: carbine.damage / 2, resisted: true });
    expect(resolveHit(shielded(), 'head', 'carbine', carbine)).toMatchObject({ damage: (carbine.damage * carbine.weakPointMultiplier) / 2, resisted: true, weakPoint: true });
  });

  it('does nothing against any other weapon, or a strike: changing weapon beats it', () => {
    expect(resolveHit(shielded(), 'torso', 'shotgun', WEAPONS.shotgun)).toMatchObject({ damage: WEAPONS.shotgun.damage, resisted: false });
    expect(resolveHit(shielded(), 'torso', 'pistol', WEAPONS.pistol)).toMatchObject({ damage: WEAPONS.pistol.damage, resisted: false });
    expect(resolveHit(shielded(), 'torso', 'melee', strike)).toMatchObject({ damage: MELEE.damage, resisted: false });
  });

  it('can be raised against strikes too', () => {
    expect(resolveHit(armour({ shield: 'melee', shieldFactor: 0.5 }), 'torso', 'melee', strike)).toMatchObject({ damage: MELEE.damage / 2, resisted: true });
  });
});

describe("the heavy's plating", () => {
  const heavy = (): Armour => armour({ plating: SPECIALS.heavy.plating });

  it('takes most of a hit anywhere but the core', () => {
    expect(SPECIALS.heavy.plating).toBeLessThan(0.5);
    expect(resolveHit(heavy(), 'torso', 'carbine', carbine)).toMatchObject({ damage: carbine.damage * SPECIALS.heavy.plating, plated: true, weakPoint: false });
    expect(resolveHit(heavy(), 'limb', 'carbine', carbine).plated).toBe(true);
  });

  it('does nothing for the core: a hit there does full weak-point damage', () => {
    expect(resolveHit(heavy(), 'head', 'carbine', carbine)).toMatchObject({ damage: carbine.damage * carbine.weakPointMultiplier, plated: false, weakPoint: true });
  });

  it('makes the core worth far more than the plate with every gun', () => {
    for (const weapon of Object.values(WEAPONS)) {
      const core = resolveHit(heavy(), 'head', weapon.id, weapon).damage;
      const plate = resolveHit(heavy(), 'torso', weapon.id, weapon).damage;
      expect(core / plate).toBeGreaterThan(4);
    }
  });
});

describe('the plate ARGUS puts over a weak point', () => {
  it('turns a weak-point hit into an ordinary one, and wears down', () => {
    const guarded = armour({ guard: 100 });
    const hit = resolveHit(guarded, 'head', 'carbine', carbine);
    expect(hit).toMatchObject({ damage: carbine.damage, weakPoint: false, guarded: true, guardBroke: false });
    expect(guarded.guard).toBe(100 - carbine.damage);
  });

  it('comes off once it has taken enough, and the weak point is a weak point again', () => {
    const guarded = armour({ guard: 100 });
    const hits = [0, 1, 2].map(() => resolveHit(guarded, 'head', 'carbine', carbine));
    expect(hits.map((hit) => hit.guardBroke)).toEqual([false, false, true]);
    expect(guarded.guard).toBe(0);
    expect(resolveHit(guarded, 'head', 'carbine', carbine)).toMatchObject({ damage: carbine.damage * carbine.weakPointMultiplier, weakPoint: true, guarded: false });
  });

  it('is not worn down by hits elsewhere, which do what they always did', () => {
    const guarded = armour({ guard: 100 });
    expect(resolveHit(guarded, 'torso', 'carbine', carbine)).toMatchObject({ damage: carbine.damage, guarded: false });
    expect(guarded.guard).toBe(100);
  });

  it('never makes a hit worth less than a body shot: it is not a hidden boost', () => {
    const guarded = armour({ guard: 1000 });
    for (const weapon of Object.values(WEAPONS)) {
      expect(resolveHit(guarded, 'head', weapon.id, weapon).damage).toBe(resolveHit(createArmour(), 'torso', weapon.id, weapon).damage);
    }
  });

  it('and shielding stack: a shielded, guarded robot shot in the plate with the shielded weapon', () => {
    const both = armour({ guard: 100, shield: 'carbine', shieldFactor: 0.5 });
    const hit = resolveHit(both, 'head', 'carbine', carbine);
    expect(hit).toMatchObject({ damage: carbine.damage / 2, resisted: true, guarded: true, weakPoint: false });
    // The plate takes the whole of the shot; only the robot behind it is shielded.
    expect(both.guard).toBe(100 - carbine.damage);
  });
});
