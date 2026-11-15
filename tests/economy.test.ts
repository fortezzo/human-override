import { describe, expect, it } from 'vitest';
import { LOADOUT, SCRAP, WEAPONS, type WeaponId } from '../src/config';
import { awardFor, buyFromRack, createWallet, earn, rackOffer, spend } from '../src/sim/economy';
import { createLoadout, held, nextSlot, owns, takeWeapon } from '../src/sim/loadout';
import { fire } from '../src/sim/weapon';

const fresh = () => createLoadout<WeaponId>(LOADOUT.slots, LOADOUT.starting, WEAPONS[LOADOUT.starting]);

describe('scrap awards', () => {
  it('pays a little for a hit and more for a kill, with bonuses for weak-point and melee kills', () => {
    expect(awardFor({ killed: false, weakPoint: false, melee: false }, SCRAP)).toBe(SCRAP.hit);
    expect(awardFor({ killed: false, weakPoint: true, melee: false }, SCRAP)).toBe(SCRAP.hit);
    expect(awardFor({ killed: true, weakPoint: false, melee: false }, SCRAP)).toBe(SCRAP.kill);
    expect(awardFor({ killed: true, weakPoint: true, melee: false }, SCRAP)).toBe(SCRAP.weakPointKill);
    expect(awardFor({ killed: true, weakPoint: false, melee: true }, SCRAP)).toBe(SCRAP.meleeKill);
    expect(SCRAP.hit).toBeLessThan(SCRAP.kill);
    expect(SCRAP.kill).toBeLessThan(SCRAP.weakPointKill);
    expect(SCRAP.weakPointKill).toBeLessThan(SCRAP.meleeKill);
  });

  it('keeps a running total of what was earned and spent', () => {
    const wallet = createWallet();
    earn(wallet, 60);
    earn(wallet, 100);
    expect(spend(wallet, 50)).toBe(true);
    expect(wallet).toEqual({ scrap: 110, earned: 160, spent: 50 });
  });

  it('refuses a purchase the wallet cannot cover, and takes nothing', () => {
    const wallet = createWallet(100);
    expect(spend(wallet, 101)).toBe(false);
    expect(wallet.scrap).toBe(100);
    expect(wallet.spent).toBe(0);
  });
});

describe('wall racks', () => {
  it('offers the weapon at its price, and charges exactly that', () => {
    const wallet = createWallet(1000);
    const loadout = fresh();
    expect(rackOffer(wallet, loadout, 'shotgun', WEAPONS.shotgun)).toEqual({ kind: 'weapon', cost: WEAPONS.shotgun.price, affordable: true });
    const result = buyFromRack(wallet, loadout, 'shotgun', WEAPONS.shotgun);
    expect(result.bought).toBe('weapon');
    expect(result.cost).toBe(WEAPONS.shotgun.price);
    expect(wallet.scrap).toBe(1000 - WEAPONS.shotgun.price);
    expect(owns(loadout, 'shotgun')).toBe(true);
    // It arrives loaded, with its starting spares, in the player's hands.
    expect(held(loadout).id).toBe('shotgun');
    expect(held(loadout).state.ammo).toBe(WEAPONS.shotgun.magazine);
    expect(held(loadout).state.reserve).toBe(WEAPONS.shotgun.reserve);
  });

  it('does nothing when the player is short', () => {
    const wallet = createWallet(WEAPONS.shotgun.price - 1);
    const loadout = fresh();
    expect(rackOffer(wallet, loadout, 'shotgun', WEAPONS.shotgun).affordable).toBe(false);
    expect(buyFromRack(wallet, loadout, 'shotgun', WEAPONS.shotgun).bought).toBeNull();
    expect(wallet.scrap).toBe(WEAPONS.shotgun.price - 1);
    expect(owns(loadout, 'shotgun')).toBe(false);
  });

  it('sells ammunition for a weapon already carried, at the ammunition price', () => {
    const wallet = createWallet(5000);
    const loadout = fresh();
    buyFromRack(wallet, loadout, 'shotgun', WEAPONS.shotgun);
    fire(held(loadout).state, WEAPONS.shotgun);
    const before = wallet.scrap;
    expect(rackOffer(wallet, loadout, 'shotgun', WEAPONS.shotgun).kind).toBe('ammo');
    const result = buyFromRack(wallet, loadout, 'shotgun', WEAPONS.shotgun);
    expect(result.bought).toBe('ammo');
    expect(wallet.scrap).toBe(before - WEAPONS.shotgun.ammoPrice);
    expect(held(loadout).state.ammo).toBe(WEAPONS.shotgun.magazine);
    expect(held(loadout).state.reserve).toBe(WEAPONS.shotgun.reserveMax);
  });

  it('will not sell ammunition to a weapon that is already full', () => {
    const wallet = createWallet(5000);
    const loadout = fresh();
    buyFromRack(wallet, loadout, 'shotgun', WEAPONS.shotgun);
    buyFromRack(wallet, loadout, 'shotgun', WEAPONS.shotgun); // tops the spares up
    const before = wallet.scrap;
    expect(rackOffer(wallet, loadout, 'shotgun', WEAPONS.shotgun).kind).toBe('full');
    expect(buyFromRack(wallet, loadout, 'shotgun', WEAPONS.shotgun).bought).toBeNull();
    expect(wallet.scrap).toBe(before);
  });
});

describe('carrying two weapons', () => {
  it('starts with the sidearm and one empty slot', () => {
    const loadout = fresh();
    expect(loadout.slots.map((slot) => slot?.id ?? null)).toEqual(['pistol', null]);
  });

  it('puts a second weapon in the empty slot', () => {
    const loadout = fresh();
    const result = takeWeapon(loadout, 'shotgun', WEAPONS.shotgun);
    expect(result.replaced).toBeNull();
    expect(loadout.slots.map((slot) => slot?.id)).toEqual(['pistol', 'shotgun']);
  });

  it('replaces the weapon in hand when a third is taken', () => {
    const loadout = fresh();
    takeWeapon(loadout, 'shotgun', WEAPONS.shotgun); // now holding the shotgun
    const result = takeWeapon(loadout, 'carbine', WEAPONS.carbine);
    expect(result.replaced).toBe('shotgun');
    expect(loadout.slots.map((slot) => slot?.id)).toEqual(['pistol', 'carbine']);
    expect(held(loadout).id).toBe('carbine');
  });

  it('cycles between the weapons carried, and stays put with only one', () => {
    const loadout = fresh();
    expect(nextSlot(loadout)).toBe(0);
    takeWeapon(loadout, 'shotgun', WEAPONS.shotgun);
    expect(nextSlot(loadout)).toBe(0);
    loadout.current = 0;
    expect(nextSlot(loadout)).toBe(1);
    expect(nextSlot(loadout, -1)).toBe(1);
  });
});

describe('an empty gun is never the end', () => {
  it('lets one melee kill pay for a sidearm refill', () => {
    expect(SCRAP.meleeKill).toBeGreaterThanOrEqual(WEAPONS.pistol.ammoPrice);
    expect(WEAPONS.pistol.ammoPrice).toBeGreaterThan(0);
    expect(WEAPONS.pistol.ammoPrice).toBeLessThan(WEAPONS.shotgun.ammoPrice);
  });

  it('sells sidearm ammunition at its rack like any other weapon', () => {
    const wallet = createWallet();
    earn(wallet, 100);
    const loadout = fresh();
    held(loadout).state.ammo = 0;
    held(loadout).state.reserve = 0;
    const offer = rackOffer(wallet, loadout, 'pistol', WEAPONS.pistol);
    expect(offer.kind).toBe('ammo');
    expect(offer.kind === 'ammo' && offer.affordable).toBe(true);
    const result = buyFromRack(wallet, loadout, 'pistol', WEAPONS.pistol);
    expect(result.bought).toBe('ammo');
    expect(wallet.scrap).toBe(0);
    expect(held(loadout).state.reserve).toBe(WEAPONS.pistol.reserveMax);
  });
});
