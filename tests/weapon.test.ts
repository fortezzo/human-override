import { describe, expect, it } from 'vitest';
import { canFire, canReload, createWeapon, fire, reloadProgress, startReload, updateWeapon, type WeaponSpec } from '../src/sim/weapon';

const spec: WeaponSpec = { magazine: 30, reserve: 60, fireInterval: 0.1, reloadTime: 2, reloadCommit: 0.7 };

describe('weapon rules', () => {
  it('starts with a full magazine and can fire', () => {
    const w = createWeapon(spec);
    expect(w.ammo).toBe(30);
    expect(canFire(w)).toBe(true);
  });

  it('respects the rate of fire', () => {
    const w = createWeapon(spec);
    expect(fire(w, spec)).toBe(true);
    expect(fire(w, spec)).toBe(false); // too soon
    updateWeapon(w, spec, 0.05);
    expect(fire(w, spec)).toBe(false);
    updateWeapon(w, spec, 0.05);
    expect(fire(w, spec)).toBe(true);
    expect(w.ammo).toBe(28);
  });

  it('fires the right number of rounds over one second at any frame rate', () => {
    for (const dt of [1 / 240, 1 / 60, 1 / 30]) {
      const w = createWeapon(spec);
      let shots = 0;
      for (let t = 0; t < 1 - 1e-9; t += dt) {
        updateWeapon(w, spec, dt);
        while (fire(w, spec)) shots++;
      }
      // 0.1 s between shots: 10 or 11 shots in the first second depending on rounding.
      expect(shots).toBeGreaterThanOrEqual(10);
      expect(shots).toBeLessThanOrEqual(11);
    }
  });

  it('cannot fire with an empty magazine', () => {
    const w = createWeapon(spec);
    w.ammo = 0;
    expect(fire(w, spec)).toBe(false);
  });

  it('reloads from reserve and only as much as is missing', () => {
    const w = createWeapon(spec);
    w.ammo = 12;
    expect(startReload(w, spec)).toBe(true);
    expect(canFire(w)).toBe(false);
    updateWeapon(w, spec, 1.3);
    expect(w.ammo).toBe(12); // not committed yet
    const tick = updateWeapon(w, spec, 0.2);
    expect(tick.loaded).toBe(true);
    expect(w.ammo).toBe(30);
    expect(w.reserve).toBe(42);
    expect(w.reloading).toBe(true); // animation still finishing
    const done = updateWeapon(w, spec, 0.6);
    expect(done.finished).toBe(true);
    expect(w.reloading).toBe(false);
  });

  it('loads a partial magazine when reserve is short', () => {
    const w = createWeapon(spec);
    w.ammo = 0;
    w.reserve = 7;
    startReload(w, spec);
    updateWeapon(w, spec, 2);
    expect(w.ammo).toBe(7);
    expect(w.reserve).toBe(0);
    expect(canReload(w, spec)).toBe(false);
  });

  it('will not reload a full magazine or start a second reload', () => {
    const w = createWeapon(spec);
    expect(startReload(w, spec)).toBe(false);
    w.ammo = 5;
    expect(startReload(w, spec)).toBe(true);
    expect(startReload(w, spec)).toBe(false);
  });

  it('never drains reserve when it is marked infinite', () => {
    const endless: WeaponSpec = { ...spec, reserve: 0, infiniteReserve: true };
    const w = createWeapon(endless);
    w.ammo = 0;
    expect(startReload(w, endless)).toBe(true);
    updateWeapon(w, endless, 2);
    expect(w.ammo).toBe(30);
    expect(w.reserve).toBe(0);
  });

  it('reports reload progress from 0 to 1', () => {
    const w = createWeapon(spec);
    w.ammo = 1;
    expect(reloadProgress(w, spec)).toBe(0);
    startReload(w, spec);
    updateWeapon(w, spec, 1);
    expect(reloadProgress(w, spec)).toBeCloseTo(0.5);
  });
});
