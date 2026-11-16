// Timed pickups, shutters, grenades and swarm rounds.

import { describe, expect, it } from 'vitest';
import { GRENADE, PICKUPS, SHUTTERS, SWARM } from '../src/config';
import { createWallet, earn } from '../src/sim/economy';
import { blastShare, createGrenades, grenadesRoundBegan, refillGrenades, takeGrenade } from '../src/sim/grenades';
import { composeSwarm, isSwarmRound, swarmSize } from '../src/sim/horde';
import { PICKUP_IDS, createDrops, createEffects, dropsRoundBegan, rollDrop, scrapMultiplier, startEffect, tickEffects, type PickupId } from '../src/sim/pickups';
import { createShutter, isShut, lockdown, repairOffer, repairShutter, strikeShutter } from '../src/sim/shutters';

describe('pickups: what destroyed robots leave', () => {
  const always = () => 0;
  const never = () => 0.9999;

  it('nothing is left until a few robots have been destroyed since the last one', () => {
    const state = createDrops();
    for (let kill = 1; kill <= PICKUPS.minKills; kill++) expect(rollDrop(state, PICKUPS, always)).toBeNull();
    expect(rollDrop(state, PICKUPS, always)).not.toBeNull();
    // And the count starts again.
    expect(rollDrop(state, PICKUPS, always)).toBeNull();
  });

  it('no more than so many are left in one round, and a new round starts the count again', () => {
    const state = createDrops();
    let left = 0;
    for (let kill = 0; kill < 500; kill++) if (rollDrop(state, PICKUPS, always)) left += 1;
    expect(left).toBe(PICKUPS.perRound);
    dropsRoundBegan(state);
    let more = 0;
    for (let kill = 0; kill < 500; kill++) if (rollDrop(state, PICKUPS, always)) more += 1;
    expect(more).toBe(PICKUPS.perRound);
  });

  it('most destroyed robots leave nothing', () => {
    const state = createDrops();
    for (let kill = 0; kill < 100; kill++) expect(rollDrop(state, PICKUPS, never)).toBeNull();
    expect(PICKUPS.chance).toBeGreaterThan(0);
    expect(PICKUPS.chance).toBeLessThan(0.15);
  });

  it('all five kinds can be left, each as often as its weight says', () => {
    const counts: Record<PickupId, number> = { resupply: 0, overload: 0, emp: 0, doubleScrap: 0, lockdown: 0 };
    const total = PICKUP_IDS.reduce((sum, id) => sum + PICKUPS.weights[id], 0);
    const steps = total * 20;
    for (let i = 0; i < steps; i++) {
      const state = createDrops();
      state.sinceDrop = PICKUPS.minKills;
      let call = 0;
      const id = rollDrop(state, PICKUPS, () => (call++ === 0 ? 0 : (i + 0.5) / steps));
      counts[id!] += 1;
    }
    for (const id of PICKUP_IDS) expect(counts[id]).toBe(PICKUPS.weights[id] * 20);
  });

  it('a kind the caller rules out is never left (a Lockdown with no shutter to repair)', () => {
    for (let i = 0; i < 40; i++) {
      const state = createDrops();
      state.sinceDrop = PICKUPS.minKills;
      let call = 0;
      const id = rollDrop(state, PICKUPS, () => (call++ === 0 ? 0 : i / 40), (kind) => kind !== 'lockdown');
      expect(id).not.toBeNull();
      expect(id).not.toBe('lockdown');
    }
  });

  it('Overload and Double Scrap run for their time and stop; taking another starts the time again', () => {
    const effects = createEffects();
    expect(scrapMultiplier(effects)).toBe(1);
    startEffect(effects, 'doubleScrap', PICKUPS);
    startEffect(effects, 'overload', PICKUPS);
    expect(scrapMultiplier(effects)).toBe(2);
    tickEffects(effects, PICKUPS.overloadSeconds - 1);
    expect(effects.overload).toBeCloseTo(1, 6);
    startEffect(effects, 'overload', PICKUPS);
    expect(effects.overload).toBe(PICKUPS.overloadSeconds);
    tickEffects(effects, 1000);
    expect(effects).toEqual({ overload: 0, doubleScrap: 0 });
    expect(scrapMultiplier(effects)).toBe(1);
    // The other three act at once: they start no timer.
    for (const id of ['resupply', 'emp', 'lockdown'] as const) startEffect(effects, id, PICKUPS);
    expect(effects).toEqual({ overload: 0, doubleScrap: 0 });
  });

  it('every kind has a name and a line saying what it does', () => {
    for (const id of PICKUP_IDS) {
      expect(PICKUPS.names[id].length).toBeGreaterThan(2);
      expect(PICKUPS.notes[id].length).toBeGreaterThan(2);
    }
  });
});

describe('shutters', () => {
  const wallet = () => {
    const w = createWallet();
    earn(w, 1000);
    return w;
  };

  it('a sound shutter is in the way; it takes so many blows, and the last one forces it', () => {
    const shutter = createShutter('yard', SHUTTERS);
    expect(isShut(shutter)).toBe(true);
    for (let blow = 1; blow < SHUTTERS.strength; blow++) {
      expect(strikeShutter(shutter)).toBe(false);
      expect(isShut(shutter)).toBe(true);
    }
    expect(strikeShutter(shutter)).toBe(true);
    expect(isShut(shutter)).toBe(false);
    // Blows on one that is already up do nothing more.
    expect(strikeShutter(shutter)).toBe(false);
  });

  it('a heavy enough blow forces it at once', () => {
    const shutter = createShutter('dockBayNorth', SHUTTERS);
    expect(strikeShutter(shutter, SHUTTERS.strength)).toBe(true);
    expect(isShut(shutter)).toBe(false);
  });

  it('can be repaired for a little scrap, forced or only damaged, and there is nothing to pay for a sound one', () => {
    const w = wallet();
    const shutter = createShutter('yard', SHUTTERS);
    expect(repairOffer(w, shutter, SHUTTERS).kind).toBe('sound');
    expect(repairShutter(w, shutter, SHUTTERS)).toBeNull();
    strikeShutter(shutter);
    expect(repairOffer(w, shutter, SHUTTERS)).toEqual({ kind: 'repair', cost: SHUTTERS.repairCost, affordable: true });
    expect(repairShutter(w, shutter, SHUTTERS)).toBe(SHUTTERS.repairCost);
    expect(shutter.strength).toBe(SHUTTERS.strength);
    strikeShutter(shutter, 99);
    expect(repairShutter(w, shutter, SHUTTERS)).toBe(SHUTTERS.repairCost);
    expect(isShut(shutter)).toBe(true);
    expect(w.spent).toBe(2 * SHUTTERS.repairCost);
    // "A little": less than a single kill pays.
    expect(SHUTTERS.repairCost).toBeLessThanOrEqual(60);
  });

  it('is not repaired for a player who cannot pay', () => {
    const broke = createWallet();
    const shutter = createShutter('yard', SHUTTERS);
    strikeShutter(shutter, 99);
    expect(repairOffer(broke, shutter, SHUTTERS)).toEqual({ kind: 'repair', cost: SHUTTERS.repairCost, affordable: false });
    expect(repairShutter(broke, shutter, SHUTTERS)).toBeNull();
    expect(isShut(shutter)).toBe(false);
  });

  it('a Lockdown repairs every one of them for nothing, but not one the player would be shut out by', () => {
    const shutters = ['a', 'b', 'c', 'd'].map((id) => createShutter(id, SHUTTERS));
    strikeShutter(shutters[0]!, 99);
    strikeShutter(shutters[1]!, 2);
    strikeShutter(shutters[2]!, 99);
    const repaired = lockdown(shutters, SHUTTERS, (shutter) => shutter.id === 'c');
    expect(repaired).toBe(2);
    expect(shutters.map(isShut)).toEqual([true, true, false, true]);
    expect(shutters[1]!.strength).toBe(SHUTTERS.strength);
  });
});

describe('grenades', () => {
  it('a run starts with a few, each round hands out more, and no more than the pouch holds', () => {
    const grenades = createGrenades(GRENADE);
    expect(grenades.count).toBe(GRENADE.start);
    for (let round = 0; round < 20; round++) grenadesRoundBegan(grenades, GRENADE);
    expect(grenades.count).toBe(GRENADE.max);
  });

  it('one is used per throw, and none can be thrown when there are none', () => {
    const grenades = createGrenades(GRENADE);
    for (let i = 0; i < GRENADE.start; i++) expect(takeGrenade(grenades)).toBe(true);
    expect(takeGrenade(grenades)).toBe(false);
    expect(grenades.count).toBe(0);
    refillGrenades(grenades, GRENADE);
    expect(grenades.count).toBe(GRENADE.max);
  });

  it('a blast is strongest at its middle and reaches no further than its radius', () => {
    expect(blastShare(0, 5)).toBe(1);
    expect(blastShare(2.5, 5)).toBeCloseTo(0.5, 6);
    expect(blastShare(5, 5)).toBe(0);
    expect(blastShare(9, 5)).toBe(0);
    expect(blastShare(1, 0)).toBe(0);
  });

  it('a grenade wrecks an ordinary robot at its middle, and hurts the thrower less than a bomber would', () => {
    expect(GRENADE.wreck).toBeGreaterThanOrEqual(1);
    expect(GRENADE.selfDamage).toBeLessThan(60);
  });
});

describe('swarm rounds', () => {
  it('every fifth round is one, and no other', () => {
    for (let round = 1; round <= 30; round++) expect(isSwarmRound(SWARM, round)).toBe(round % SWARM.every === 0);
    expect(SWARM.every).toBe(5);
    expect(isSwarmRound(SWARM, 0)).toBe(false);
  });

  it('is drones and nothing else, more of them each time', () => {
    const first = composeSwarm(SWARM, 5);
    expect(first.length).toBe(SWARM.count);
    expect(first.every((order) => order.kind === 'drone' && !order.shield && !order.guard && !order.route)).toBe(true);
    expect(swarmSize(SWARM, 10)).toBe(SWARM.count + SWARM.countStep);
    expect(swarmSize(SWARM, 15)).toBe(SWARM.count + 2 * SWARM.countStep);
    expect(composeSwarm(SWARM, 10).length).toBe(swarmSize(SWARM, 10));
  });

  it('the drones of a swarm are fast: quicker than a walking player, slower than a sprinting one', () => {
    expect(SWARM.speed).toBeGreaterThan(4.3);
    expect(SWARM.speed).toBeLessThan(6.4);
  });
});
