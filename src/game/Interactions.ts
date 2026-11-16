// The things the player can use with F: weapon racks, doors, the six
// stations (four boosts, the crate, the bench), shutters to repair, and
// the mission's own (the breaker, the keys, the uplink, the kill switch).
//
// Each frame this finds the nearest usable thing the player is facing and
// works out the prompt to show for it; when F is pressed it makes the
// purchase. Whether a purchase is allowed, and what it costs, is decided by
// the rules in sim/economy.ts, so the prompt can never disagree with what
// pressing the key actually does.

import * as THREE from 'three';
import { SHUTTERS, WEAPONS, type WeaponId } from '../config';
import type { Player } from '../entities/Player';
import type { WeaponController } from '../entities/weapon/WeaponController';
import { buyFromRack, rackOffer, spend, type Wallet } from '../sim/economy';
import { held } from '../sim/loadout';
import { repairOffer, repairShutter } from '../sim/shutters';
import type { Door } from '../world/Door';
import { AREA_NAMES, RACK_PLANS, STATION_PLANS, type RackPlan, type StationPlan } from '../world/plan';
import type { World } from '../world/World';
import type { Economy, StationPurchase } from './Economy';
import type { Mission } from './Mission';

export interface Prompt {
  /** What pressing F will do, in plain words. */
  text: string;
  /** Price in scrap, or null when there is nothing to pay (or nothing to buy). */
  cost: number | null;
  /** False when the player cannot afford it, or it cannot be used at all. */
  usable: boolean;
  /** A second, smaller line. */
  note: string;
}

export type Purchase =
  | { kind: 'weapon' | 'ammo'; weapon: WeaponId; cost: number; replaced: WeaponId | null }
  | { kind: 'door'; door: Door; cost: number }
  | { kind: 'shutter'; id: string; cost: number }
  | StationPurchase;

/** How close the player must be to use a rack, a station or a door, in metres. */
const RACK_REACH = 2.3;
const STATION_REACH = 2.2;
const DOOR_REACH = 2.7;

const _forward = new THREE.Vector3();

export class Interactions {
  /** The prompt to show right now, or null. */
  prompt: Prompt | null = null;
  onPurchase: (purchase: Purchase) => void = () => {};
  /** The player pressed F on something they cannot afford or use. */
  onDenied: () => void = () => {};

  constructor(
    private readonly world: World,
    private readonly player: Player,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly weapons: WeaponController,
    private readonly wallet: () => Wallet,
    private readonly mission: Mission,
    private readonly economy: Economy,
  ) {
    // (What is bought at a station is reported the same way as everything else.)
    economy.onPurchase = (purchase) => this.onPurchase(purchase);
  }

  /** The station the player is standing in front of and facing, or null. */
  private nearestStation(): StationPlan | null {
    let best: StationPlan | null = null;
    let nearest = STATION_REACH;
    for (const station of STATION_PLANS) {
      if (station.area !== this.world.playerArea) continue;
      const [nx, nz] = station.normal;
      const dx = this.player.position.x - station.at[0];
      const dz = this.player.position.z - station.at[1];
      // In front of it, not beside or behind.
      const out = dx * nx + dz * nz;
      const along = Math.abs(-dx * nz + dz * nx);
      if (out < station.depth * 0.6 || along > station.half + 0.9) continue;
      const distance = Math.hypot(out - station.depth, Math.max(0, along - station.half));
      const frontX = station.at[0] + nx * station.depth;
      const frontZ = station.at[1] + nz * station.depth;
      if (distance < nearest && this.facing(frontX, frontZ)) {
        nearest = distance;
        best = station;
      }
    }
    return best;
  }

  /** True if the player is looking roughly toward a point on the ground plane. */
  private facing(x: number, z: number): boolean {
    this.camera.getWorldDirection(_forward);
    const dx = x - this.player.position.x;
    const dz = z - this.player.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.6) return true;
    const flat = Math.hypot(_forward.x, _forward.z) || 1;
    return (dx * _forward.x + dz * _forward.z) / (distance * flat) > 0.45;
  }

  private nearestRack(): RackPlan | null {
    let best: RackPlan | null = null;
    let nearest = RACK_REACH;
    for (const rack of RACK_PLANS) {
      // Stand in front of the board, not behind the column it hangs on.
      const dx = this.player.position.x - rack.at[0];
      const dz = this.player.position.z - rack.at[2];
      if (dx * rack.normal[0] + dz * rack.normal[2] < 0.15) continue;
      const distance = Math.hypot(dx, dz);
      if (distance < nearest && this.facing(rack.at[0], rack.at[2])) {
        nearest = distance;
        best = rack;
      }
    }
    return best;
  }

  /** Call once per frame. `pressed` is true on the frame F went down. */
  update(pressed: boolean): void {
    const wallet = this.wallet();
    const loadout = this.weapons.loadout;
    this.prompt = null;

    // The mission's own things first: the breaker, the keys, the uplink, the kill switch.
    const step = this.mission.interaction();
    if (step) {
      this.prompt = step.prompt;
      if (pressed) {
        if (step.use) step.use();
        else this.onDenied();
      }
      return;
    }

    const station = this.nearestStation();
    if (station) {
      const offer = this.economy.station(station.id);
      this.prompt = offer.prompt;
      if (pressed) {
        if (offer.use) offer.use();
        else this.onDenied();
      }
      return;
    }

    const rack = this.nearestRack();
    if (rack) {
      const def = this.weapons.defFor(rack.weapon);
      const offer = rackOffer(wallet, loadout, rack.weapon, def);
      if (offer.kind === 'full') {
        this.prompt = { text: `${def.name}: ammunition full`, cost: null, usable: false, note: '' };
      } else if (offer.kind === 'weapon') {
        const full = loadout.slots.every((slot) => slot !== null);
        this.prompt = { text: `Buy the ${def.name}`, cost: offer.cost, usable: offer.affordable, note: full ? `Replaces the ${WEAPONS[held(loadout).id].name}` : '' };
      } else {
        this.prompt = { text: `Ammunition for the ${def.name}`, cost: offer.cost, usable: offer.affordable, note: '' };
      }
      if (pressed) {
        const result = buyFromRack(wallet, loadout, rack.weapon, def);
        if (result.bought === 'weapon') {
          this.weapons.raise();
          this.onPurchase({ kind: 'weapon', weapon: rack.weapon, cost: result.cost, replaced: result.taken?.replaced ?? null });
        } else if (result.bought === 'ammo') {
          this.onPurchase({ kind: 'ammo', weapon: rack.weapon, cost: result.cost, replaced: null });
        } else {
          this.onDenied();
        }
      }
      return;
    }

    // A shutter that has been battered or forced: run it back down.
    const gate = this.world.shutterInReach(this.player.position, SHUTTERS.reach);
    if (gate && this.facing(gate.centre.x, gate.centre.z)) {
      const offer = repairOffer(wallet, gate.state, SHUTTERS);
      if (offer.kind === 'repair') {
        this.prompt = { text: 'Repair the shutter', cost: offer.cost, usable: offer.affordable, note: 'Robots must batter it down again' };
        if (pressed) {
          const cost = repairShutter(wallet, gate.state, SHUTTERS);
          if (cost !== null) {
            this.world.shuttersChanged();
            this.onPurchase({ kind: 'shutter', id: gate.plan.id, cost });
          } else {
            this.onDenied();
          }
        }
        return;
      }
    }

    const door = this.world.nearestShutDoor(this.player.position, DOOR_REACH);
    if (door && this.facing(door.centre.x, door.centre.z)) {
      const { cost } = door.plan;
      const beyond = AREA_NAMES[door.plan.a === this.world.playerArea ? door.plan.b : door.plan.a];
      if (cost === null) {
        // The core: no amount of scrap opens it, only the three keys.
        const core = this.mission.coreDoor();
        this.prompt = core.prompt;
        if (pressed) {
          if (core.use) core.use();
          else this.onDenied();
        }
        return;
      }
      this.prompt = { text: `Open the door to the ${beyond}`, cost, usable: wallet.scrap >= cost, note: '' };
      if (pressed) {
        if (spend(wallet, cost)) {
          this.world.openDoor(door.plan.id);
          this.onPurchase({ kind: 'door', door, cost });
        } else {
          this.onDenied();
        }
      }
    }
  }
}
