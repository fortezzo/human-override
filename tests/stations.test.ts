// The Boost Stations, the Overclock Bench and the Prototype Crate: what
// each sells, what it charges, and when it will not sell.

import { describe, expect, it } from 'vitest';
import { BENCH, BOOSTS, CRATE, ORDINARY_GUNS, WEAPONS, type WeaponId } from '../src/config';
import { benchOffer, benchPrice, buyUpgrade, markName, tune } from '../src/sim/bench';
import { BOOST_IDS, boostOffer, boostPrice, buyBoost, createBoosts, useFailsafe } from '../src/sim/boosts';
import { createCrate, rollCrate, specialChance } from '../src/sim/crate';
import { createWallet, earn } from '../src/sim/economy';
import { createLoadout, held, takeOffer, takeWeapon } from '../src/sim/loadout';

const rich = () => {
  const wallet = createWallet();
  earn(wallet, 100000);
  return wallet;
};

describe('boost stations', () => {
  it('sell nothing while the power is out, however much scrap there is', () => {
    const wallet = rich();
    const boosts = createBoosts();
    for (const id of BOOST_IDS) {
      expect(boostOffer(wallet, boosts, id, BOOSTS, false).kind).toBe('noPower');
      expect(buyBoost(wallet, boosts, id, BOOSTS, false)).toBeNull();
    }
    expect(wallet.spent).toBe(0);
  });

  it('charge the listed price once, and then the boost is the player\'s for the run', () => {
    for (const id of BOOST_IDS) {
      const wallet = rich();
      const boosts = createBoosts();
      expect(buyBoost(wallet, boosts, id, BOOSTS, true)).toBe(BOOSTS[id].price);
      expect(wallet.spent).toBe(BOOSTS[id].price);
      expect(boosts.owned[id]).toBe(true);
      expect(boostOffer(wallet, boosts, id, BOOSTS, true).kind).toBe('owned');
      // A second press buys nothing and charges nothing.
      expect(buyBoost(wallet, boosts, id, BOOSTS, true)).toBeNull();
      expect(wallet.spent).toBe(BOOSTS[id].price);
    }
  });

  it('refuse a player who cannot pay, and take nothing', () => {
    const wallet = createWallet();
    earn(wallet, BOOSTS.carapace.price - 1);
    const boosts = createBoosts();
    const offer = boostOffer(wallet, boosts, 'carapace', BOOSTS, true);
    expect(offer).toEqual({ kind: 'buy', cost: BOOSTS.carapace.price, affordable: false });
    expect(buyBoost(wallet, boosts, 'carapace', BOOSTS, true)).toBeNull();
    expect(wallet.scrap).toBe(BOOSTS.carapace.price - 1);
    expect(boosts.owned.carapace).toBe(false);
  });

  it('the fail-safe is used up when it saves the player, and costs more each time it is bought again', () => {
    const wallet = rich();
    const boosts = createBoosts();
    expect(useFailsafe(boosts)).toBe(false);
    expect(buyBoost(wallet, boosts, 'failsafe', BOOSTS, true)).toBe(BOOSTS.failsafe.price);
    expect(useFailsafe(boosts)).toBe(true);
    // Gone: the next blow that would put the player down does.
    expect(useFailsafe(boosts)).toBe(false);
    expect(boostPrice(boosts, 'failsafe', BOOSTS)).toBe(BOOSTS.failsafe.price + BOOSTS.failsafe.priceStep);
    expect(buyBoost(wallet, boosts, 'failsafe', BOOSTS, true)).toBe(BOOSTS.failsafe.price + BOOSTS.failsafe.priceStep);
    expect(useFailsafe(boosts)).toBe(true);
    expect(boostPrice(boosts, 'failsafe', BOOSTS)).toBe(BOOSTS.failsafe.price + 2 * BOOSTS.failsafe.priceStep);
  });

  it('the other three never change price', () => {
    const wallet = rich();
    const boosts = createBoosts();
    for (const id of ['carapace', 'autoloader', 'hairTrigger'] as const) {
      buyBoost(wallet, boosts, id, BOOSTS, true);
      expect(boostPrice(boosts, id, BOOSTS)).toBe(BOOSTS[id].price);
    }
  });

  it('the numbers in the config make each boost a boost', () => {
    expect(BOOSTS.carapace.maxHealth).toBeGreaterThan(100);
    expect(BOOSTS.autoloader.reloadFactor).toBeLessThan(1);
    expect(BOOSTS.hairTrigger.fireFactor).toBeLessThan(1);
    expect(BOOSTS.failsafe.health).toBeGreaterThan(0);
  });
});

describe('the overclock bench', () => {
  it('is dead while the power is out', () => {
    expect(benchOffer(rich(), 0, BENCH, false).kind).toBe('noPower');
    expect(buyUpgrade(rich(), 0, BENCH, false)).toBeNull();
  });

  it('can be bought more than once, each upgrade costing more than the last, up to a top level', () => {
    const wallet = rich();
    let level = 0;
    let last = 0;
    for (;;) {
      const cost = buyUpgrade(wallet, level, BENCH, true);
      if (cost === null) break;
      expect(cost).toBe(BENCH.price + BENCH.priceStep * level);
      expect(cost).toBeGreaterThan(last);
      last = cost;
      level += 1;
    }
    expect(level).toBe(BENCH.maxLevel);
    expect(level).toBeGreaterThan(1);
    expect(benchOffer(wallet, level, BENCH, true).kind).toBe('max');
    expect(benchPrice(BENCH, level)).toBeNull();
  });

  it('charges nothing when the player is short', () => {
    const wallet = createWallet();
    earn(wallet, BENCH.price - 1);
    expect(benchOffer(wallet, 0, BENCH, true)).toEqual({ kind: 'upgrade', cost: BENCH.price, affordable: false, to: 1 });
    expect(buyUpgrade(wallet, 0, BENCH, true)).toBeNull();
    expect(wallet.spent).toBe(0);
  });

  it('every level adds damage and a bigger magazine, and never makes a gun worse', () => {
    const plain = { reload: 1, fire: 1 };
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      let before = tune(WEAPONS[id], 0, BENCH, plain);
      expect(before.damage).toBe(WEAPONS[id].damage);
      expect(before.magazine).toBe(WEAPONS[id].magazine);
      for (let level = 1; level <= BENCH.maxLevel; level++) {
        const now = tune(WEAPONS[id], level, BENCH, plain);
        expect(now.damage).toBeGreaterThan(before.damage);
        expect(now.magazine).toBeGreaterThanOrEqual(before.magazine);
        expect(now.reserveMax).toBeGreaterThanOrEqual(before.reserveMax);
        expect(Number.isInteger(now.magazine)).toBe(true);
        before = now;
      }
      // The top level is worth having: at least twice the damage of the gun off the wall.
      expect(before.damage / WEAPONS[id].damage).toBeGreaterThanOrEqual(2);
    }
  });

  it('the boosts shorten the reload and the time between shots of every gun, and change nothing else', () => {
    const hands = { reload: BOOSTS.autoloader.reloadFactor, fire: BOOSTS.hairTrigger.fireFactor };
    const tuned = tune(WEAPONS.carbine, 0, BENCH, hands);
    expect(tuned.reloadTime).toBeCloseTo(WEAPONS.carbine.reloadTime * hands.reload, 6);
    expect(tuned.fireInterval).toBeCloseTo(WEAPONS.carbine.fireInterval * hands.fire, 6);
    expect(tuned.damage).toBe(WEAPONS.carbine.damage);
    // And the gun's own record is left as it was.
    expect(WEAPONS.carbine.reloadTime).toBe(2.15);
  });

  it('names its levels', () => {
    expect(markName(0)).toBe('');
    expect(markName(1)).toBe('Mk II');
    expect(markName(4)).toBe('Mk V');
  });
});

describe('the prototype crate', () => {
  const SPECIAL: WeaponId = 'turncoat';
  /** A source of "random" numbers that hands back the ones it is given, in order, then 0.5 for ever. */
  const feed = (...values: number[]) => {
    let i = 0;
    return () => values[i++] ?? 0.5;
  };

  it('costs what the config says, and its top level is the bench\'s', () => {
    expect(CRATE.price).toBeGreaterThan(0);
    expect(CRATE.maxLevel).toBe(BENCH.maxLevel);
  });

  it('gives the special weapon when the roll says so, and not when the player already has it', () => {
    const state = createCrate();
    const offer = rollCrate(state, CRATE, ORDINARY_GUNS, SPECIAL, [{ id: 'pistol', level: 0 }], feed(0));
    expect(offer).toEqual({ weapon: SPECIAL, level: 0, special: true });
    // Carrying it: every roll is an ordinary gun, whatever the dice say.
    for (let i = 0; i < 50; i++) {
      const again = rollCrate(state, CRATE, ORDINARY_GUNS, SPECIAL, [{ id: SPECIAL, level: 0 }], feed(0, i / 50));
      expect(again.special).toBe(false);
      expect(ORDINARY_GUNS).toContain(again.weapon);
    }
  });

  it('grows likelier to give the special weapon with every roll that misses it, until it must', () => {
    const state = createCrate();
    const carried = [{ id: 'pistol' as WeaponId, level: 0 }];
    let rolls = 0;
    let chance = specialChance(state, CRATE);
    for (;;) {
      // (A roll of 0.9999 misses any chance short of certainty.)
      const offer = rollCrate(state, CRATE, ORDINARY_GUNS, SPECIAL, carried, feed(0.9999, 0.5));
      rolls += 1;
      if (offer.special) break;
      expect(specialChance(state, CRATE)).toBeGreaterThan(chance);
      chance = specialChance(state, CRATE);
      expect(rolls).toBeLessThan(40);
    }
    expect(rolls).toBeLessThanOrEqual(Math.ceil((1 - CRATE.specialChance) / CRATE.specialChanceStep) + 1);
    // And having given it, the count starts again.
    expect(specialChance(state, CRATE)).toBe(CRATE.specialChance);
  });

  it('never offers an ordinary gun worse than, or the same as, the one the player is carrying', () => {
    const state = createCrate();
    for (let own = 0; own < CRATE.maxLevel; own++) {
      const carried = [{ id: 'carbine' as WeaponId, level: own }, { id: SPECIAL, level: 0 }];
      for (let i = 0; i < 60; i++) {
        const offer = rollCrate(state, CRATE, ORDINARY_GUNS, SPECIAL, carried, feed(0.5, i / 60));
        if (offer.weapon === 'carbine') expect(offer.level).toBe(own + 1);
        else expect(offer.level).toBe(CRATE.freshLevel);
        expect(offer.level).toBeLessThanOrEqual(CRATE.maxLevel);
      }
    }
  });

  it('a gun the player is not carrying comes already overclocked', () => {
    expect(CRATE.freshLevel).toBeGreaterThanOrEqual(1);
    const offer = rollCrate(createCrate(), CRATE, ['shotgun'], SPECIAL, [{ id: 'pistol', level: 0 }, { id: SPECIAL, level: 0 }], feed(0.5, 0.2));
    expect(offer).toEqual({ weapon: 'shotgun', level: CRATE.freshLevel, special: false });
  });

  it('skips a gun that is already at the top level, and still hands something out when everything is', () => {
    const state = createCrate();
    const top = CRATE.maxLevel;
    for (let i = 0; i < 40; i++) {
      const offer = rollCrate(state, CRATE, ORDINARY_GUNS, SPECIAL, [{ id: 'carbine', level: top }, { id: SPECIAL, level: 0 }], feed(0.5, i / 40));
      expect(offer.weapon).not.toBe('carbine');
    }
    // Everything it could improve is at the top, and the player has no special: it is the special.
    const forced = rollCrate(state, CRATE, ['carbine'], SPECIAL, [{ id: 'carbine', level: top }, { id: 'pistol', level: 0 }], feed(0.9999));
    expect(forced.special).toBe(true);
    // And with the special in hand too, a top-level gun (a full refill).
    const last = rollCrate(state, CRATE, ['carbine'], SPECIAL, [{ id: 'carbine', level: top }, { id: SPECIAL, level: 0 }], feed(0.5, 0.5));
    expect(last).toEqual({ weapon: 'carbine', level: top, special: false });
  });

  it('what it offers takes the place of the same kind of gun, or is picked up like any other', () => {
    const loadout = createLoadout<WeaponId>(2, 'pistol', WEAPONS.pistol);
    takeWeapon(loadout, 'carbine', WEAPONS.carbine);
    // A better carbine replaces the carbine, wherever it is, and comes to hand full.
    loadout.current = 0;
    held(loadout).state.ammo = 3;
    const better = tune(WEAPONS.carbine, 2, BENCH, { reload: 1, fire: 1 });
    const taken = takeOffer(loadout, 'carbine', better, 2);
    expect(taken).toEqual({ slot: 1, replaced: null });
    expect(loadout.current).toBe(1);
    expect(held(loadout)).toMatchObject({ id: 'carbine', level: 2 });
    expect(held(loadout).state.ammo).toBe(better.magazine);
    expect(loadout.slots[0]).toMatchObject({ id: 'pistol', level: 0 });
    // A kind not carried replaces what is in hand, as a third weapon always does.
    const swapped = takeOffer(loadout, 'turncoat', WEAPONS.turncoat, 0);
    expect(swapped).toEqual({ slot: 1, replaced: 'carbine' });
    expect(loadout.slots.map((slot) => slot?.id)).toEqual(['pistol', 'turncoat']);
  });
});
