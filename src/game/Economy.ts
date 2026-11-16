// Everything scrap buys beyond weapons and doors, and everything a run
// collects: the four boosts, the Overclock Bench, the Prototype Crate,
// grenades, and the timed pickups in force.
//
// The rules are in src/sim (boosts, bench, crate, pickups, grenades). This
// class holds the run's state for them, connects them to the stations on
// the map and to the player's weapons, and says what each station's prompt
// should read right now.

import { BENCH, BOOSTS, CRATE, GRENADE, ORDINARY_GUNS, PICKUPS, PLAYER, WEAPONS, type WeaponId } from '../config';
import type { Player } from '../entities/Player';
import type { WeaponController } from '../entities/weapon/WeaponController';
import { benchOffer, buyUpgrade, markName } from '../sim/bench';
import { boostOffer, buyBoost, createBoosts, useFailsafe, type BoostId, type Boosts } from '../sim/boosts';
import { createCrate, rollCrate, type CrateOffer, type CrateState } from '../sim/crate';
import { spend, type Wallet } from '../sim/economy';
import { createGrenades, grenadesRoundBegan, refillGrenades, type Grenades } from '../sim/grenades';
import { held, refill, slotOf, takeOffer } from '../sim/loadout';
import { createDrops, createEffects, dropsRoundBegan, startEffect, tickEffects, type DropState, type PickupId, type TimedEffects } from '../sim/pickups';
import type { StationId } from '../world/plan';
import type { World } from '../world/World';
import type { Prompt } from './Interactions';

/** Something was bought at a station (or taken from the crate). */
export type StationPurchase =
  | { kind: 'boost'; boost: BoostId; cost: number }
  | { kind: 'bench'; weapon: WeaponId; level: number; cost: number }
  | { kind: 'crate'; cost: number }
  | { kind: 'crateTake'; weapon: WeaponId; level: number; replaced: WeaponId | null; cost: 0 };

/** What the crate is doing: shut, choosing (its lid up, weapons flickering past), or holding out its offer. */
export type CratePhase = 'shut' | 'choosing' | 'offer';

const mark = (level: number): string => (level > 0 ? ` ${markName(level)}` : '');

export class Economy {
  boosts: Boosts = createBoosts();
  effects: TimedEffects = createEffects();
  grenades: Grenades = createGrenades(GRENADE);
  drops: DropState = createDrops();
  readonly crate: { state: CrateState; phase: CratePhase; timer: number; flicker: number; offer: CrateOffer<WeaponId> | null } = { state: createCrate(), phase: 'shut', timer: 0, flicker: 0, offer: null };

  onPurchase: (purchase: StationPurchase) => void = () => {};
  /** The crate's lid, its ticking while it chooses, and the moment it settles. */
  onCrate: (event: 'open' | 'tick' | 'offer' | 'close') => void = () => {};
  /** Debug and tests: what the crate's next roll uses for dice (Math.random unless set). */
  random: () => number = Math.random;

  constructor(
    private readonly world: World,
    private readonly weapons: WeaponController,
    private readonly player: Player,
    private readonly wallet: () => Wallet,
    private readonly powerOn: () => boolean,
  ) {}

  /** A new run: nothing bought, nothing in force, the crate shut. */
  reset(): void {
    this.boosts = createBoosts();
    this.effects = createEffects();
    this.grenades = createGrenades(GRENADE);
    this.drops = createDrops();
    this.crate.state = createCrate();
    this.crate.phase = 'shut';
    this.crate.timer = 0;
    this.crate.offer = null;
    this.applyBoosts();
  }

  /** A round has begun: a grenade or two, and the count of pickups starts again. */
  roundStarted(): void {
    grenadesRoundBegan(this.grenades, GRENADE);
    dropsRoundBegan(this.drops);
  }

  update(dt: number): void {
    tickEffects(this.effects, dt);
    const crate = this.crate;
    if (crate.phase === 'shut') return;
    crate.timer -= dt;
    if (crate.phase === 'choosing') {
      // Weapons flicker past over the open case until it settles.
      crate.flicker -= dt;
      if (crate.flicker <= 0) {
        crate.flicker = 0.11;
        const all = Object.keys(WEAPONS) as WeaponId[];
        this.world.stations.setCrate(true, all[Math.floor(Math.random() * all.length)]!);
        this.onCrate('tick');
      }
      if (crate.timer <= 0) {
        crate.phase = 'offer';
        crate.timer = CRATE.offerSeconds;
        this.world.stations.setCrate(true, crate.offer!.weapon);
        this.onCrate('offer');
      }
    } else if (crate.timer <= 0) {
      this.shutCrate();
    }
  }

  private shutCrate(): void {
    this.crate.phase = 'shut';
    this.crate.offer = null;
    this.world.stations.setCrate(false, null);
    this.onCrate('close');
  }

  /** Put the player's boosts into effect: their health, and how fast their hands are. */
  private applyBoosts(): void {
    const { owned } = this.boosts;
    this.player.setMaxHealth(owned.carapace ? BOOSTS.carapace.maxHealth : PLAYER.maxHealth);
    this.weapons.setHands({ reload: owned.autoloader ? BOOSTS.autoloader.reloadFactor : 1, fire: owned.hairTrigger ? BOOSTS.hairTrigger.fireFactor : 1 });
    for (const id of Object.keys(owned) as BoostId[]) this.world.stations.setOwned(id, owned[id]);
  }

  /** The fail-safe, if the player has one: it is used up, and the answer is true. */
  spendFailsafe(): boolean {
    if (!useFailsafe(this.boosts)) return false;
    this.world.stations.setOwned('failsafe', false);
    return true;
  }

  /** A Full Resupply: every weapon carried is filled, and the grenades. */
  resupply(): void {
    for (const slot of this.weapons.loadout.slots) {
      if (!slot) continue;
      const def = this.weapons.defOf(slot);
      refill(slot.state, def, def.reserveMax);
    }
    refillGrenades(this.grenades, GRENADE);
  }

  /** Start whichever timer a pickup has (Overload, Double Scrap). */
  startTimed(id: PickupId): void {
    startEffect(this.effects, id, PICKUPS);
  }

  // ------------------------------------------------------------ the stations

  /** What a station offers right now, and what pressing F at it does (null: nothing). */
  station(id: StationId): { prompt: Prompt; use: (() => void) | null } {
    if (id === 'crate') return this.crateStation();
    if (id === 'bench') return this.benchStation();
    return this.boostStation(id);
  }

  private boostStation(id: BoostId): { prompt: Prompt; use: (() => void) | null } {
    const rule = BOOSTS[id];
    const wallet = this.wallet();
    const offer = boostOffer(wallet, this.boosts, id, BOOSTS, this.powerOn());
    if (offer.kind === 'noPower') return { prompt: { text: `${rule.name}: no power`, cost: null, usable: false, note: 'Restore power at the main breaker' }, use: null };
    if (offer.kind === 'owned') return { prompt: { text: `${rule.name}: active`, cost: null, usable: false, note: rule.effect }, use: null };
    return {
      prompt: { text: `Buy ${rule.name}`, cost: offer.cost, usable: offer.affordable, note: rule.effect },
      use: offer.affordable
        ? () => {
            const cost = buyBoost(wallet, this.boosts, id, BOOSTS, this.powerOn());
            if (cost === null) return;
            this.applyBoosts();
            this.onPurchase({ kind: 'boost', boost: id, cost });
          }
        : null,
    };
  }

  private benchStation(): { prompt: Prompt; use: (() => void) | null } {
    const wallet = this.wallet();
    const weapon = held(this.weapons.loadout);
    const name = WEAPONS[weapon.id].name;
    const offer = benchOffer(wallet, weapon.level, BENCH, this.powerOn());
    if (offer.kind === 'noPower') return { prompt: { text: 'Overclock Bench: no power', cost: null, usable: false, note: 'Restore power at the main breaker' }, use: null };
    if (offer.kind === 'max') return { prompt: { text: `${name}${mark(weapon.level)}: fully overclocked`, cost: null, usable: false, note: 'Bring another weapon' }, use: null };
    return {
      prompt: { text: `Overclock the ${name} to ${markName(offer.to)}`, cost: offer.cost, usable: offer.affordable, note: 'More damage, a bigger magazine, and it is refilled' },
      use: offer.affordable && !this.weapons.busy
        ? () => {
            const cost = buyUpgrade(wallet, weapon.level, BENCH, this.powerOn());
            if (cost === null) return;
            weapon.level += 1;
            const def = this.weapons.defOf(weapon);
            refill(weapon.state, def, def.reserveMax);
            this.weapons.raise();
            this.world.stations.benchWork();
            this.onPurchase({ kind: 'bench', weapon: weapon.id, level: weapon.level, cost });
          }
        : null,
    };
  }

  private crateStation(): { prompt: Prompt; use: (() => void) | null } {
    const crate = this.crate;
    const wallet = this.wallet();
    const loadout = this.weapons.loadout;
    if (crate.phase === 'choosing') return { prompt: { text: 'Prototype Crate: choosing', cost: null, usable: false, note: '' }, use: null };
    if (crate.phase === 'offer' && crate.offer) {
      const offer = crate.offer;
      const title = `${WEAPONS[offer.weapon].name}${mark(offer.level)}`;
      const own = slotOf(loadout, offer.weapon);
      const full = loadout.slots.every((slot) => slot !== null);
      const note = own >= 0 ? `Replaces your ${WEAPONS[offer.weapon].name}${mark(loadout.slots[own]!.level)}` : full ? `Replaces the ${this.weapons.title}` : offer.special ? 'Its beam turns a robot to your side' : '';
      return {
        prompt: { text: `Take the ${title}`, cost: null, usable: true, note: note || (offer.special ? 'Its beam turns a robot to your side' : 'Or leave it: the lid will shut') },
        use: () => {
          const taken = takeOffer(loadout, offer.weapon, this.weapons.defAt(offer.weapon, offer.level), offer.level);
          this.weapons.raise();
          this.shutCrate();
          this.onPurchase({ kind: 'crateTake', weapon: offer.weapon, level: offer.level, replaced: taken.replaced, cost: 0 });
        },
      };
    }
    const affordable = wallet.scrap >= CRATE.price;
    return {
      prompt: { text: 'Open the Prototype Crate', cost: CRATE.price, usable: affordable, note: 'A random weapon. You can leave it.' },
      use: affordable
        ? () => {
            if (!spend(wallet, CRATE.price)) return;
            const carried = loadout.slots.filter((slot) => slot !== null).map((slot) => ({ id: slot!.id, level: slot!.level }));
            crate.offer = rollCrate(crate.state, CRATE, ORDINARY_GUNS, 'turncoat', carried, this.random);
            crate.phase = 'choosing';
            crate.timer = CRATE.cycleSeconds;
            crate.flicker = 0;
            this.world.stations.setCrate(true, null);
            this.onCrate('open');
            this.onPurchase({ kind: 'crate', cost: CRATE.price });
          }
        : null,
    };
  }
}
