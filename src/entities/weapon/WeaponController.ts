// Turns the player's trigger, reload, switch and melee inputs into actions.
//
// The rules for ammunition, reloading and the two-weapon limit are in
// sim/weapon.ts and sim/loadout.ts; this class adds the parts that need the
// 3D world (where each bullet goes, including spread) and the timing of the
// things the player does with their hands: swapping weapons and striking.

import * as THREE from 'three';
import { BENCH, LOADOUT, MELEE, WEAPONS, type WeaponDef, type WeaponId } from '../../config';
import { markName, tune, type HandSpeed } from '../../sim/bench';
import type { Input } from '../../core/input';
import { damp } from '../../core/math';
import { createLoadout, held, nextSlot, slotOf, type CarriedWeapon, type Loadout } from '../../sim/loadout';
import { cancelReload, canReload, fire, reloadProgress, startReload, updateWeapon, type WeaponState } from '../../sim/weapon';
import type { Player } from '../Player';

export interface ShotEvent {
  weapon: WeaponDef;
  origin: THREE.Vector3;
  /** One direction per projectile (a shotgun fires several). */
  directions: THREE.Vector3[];
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _centre = new THREE.Vector3();

/** A random direction inside a cone of half-angle `spread` around `centre`. */
function scatter(centre: THREE.Vector3, spread: number, out: THREE.Vector3): THREE.Vector3 {
  _right.crossVectors(centre, Math.abs(centre.y) < 0.99 ? _up.set(0, 1, 0) : _up.set(1, 0, 0)).normalize();
  _up.crossVectors(_right, centre);
  // A random point in a disc gives an even spread inside the cone.
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * spread;
  return out
    .copy(centre)
    .addScaledVector(_right, Math.cos(angle) * radius)
    .addScaledVector(_up, Math.sin(angle) * radius)
    .normalize();
}

export class WeaponController {
  loadout: Loadout<WeaponId> = createLoadout(LOADOUT.slots, LOADOUT.starting, WEAPONS[LOADOUT.starting]);
  /** Extra spread built up by sustained fire; decays when the trigger rests. */
  bloom = 0;
  /** What the player's boosts do to every gun (see sim/bench.ts). Set through `setHands`. */
  private hands: HandSpeed = { reload: 1, fire: 1 };
  /** Each weapon as it really is at each level, worked out once. */
  private readonly tuned = new Map<string, WeaponDef>();

  onShot: (shot: ShotEvent) => void = () => {};
  onDryFire: () => void = () => {};
  /** Fired at moments through the reload, for its sound cues. */
  onReloadStage: (stage: 'magOut' | 'magIn' | 'bolt') => void = () => {};
  /** A different weapon is now in hand (called at the mid-point of the swap). */
  onSwitch: (weapon: WeaponDef) => void = () => {};
  /** A melee strike started, and the moment it lands. */
  onMelee: () => void = () => {};
  onMeleeLand: () => void = () => {};

  /** Seconds left in the current weapon swap (0 when not swapping). */
  private switchTimer = 0;
  private switchTo = -1;
  /** Seconds since the last melee strike started. */
  private sinceMelee = 99;
  private meleeLanded = true;
  private lastProgress = 0;
  private readonly shot: ShotEvent = { weapon: WEAPONS.pistol, origin: new THREE.Vector3(), directions: [] };
  private readonly pool: THREE.Vector3[] = [];

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly input: Input,
  ) {}

  /** Back to the starting loadout (a new run). */
  reset(): void {
    this.loadout = createLoadout(LOADOUT.slots, LOADOUT.starting, WEAPONS[LOADOUT.starting]);
    this.bloom = 0;
    this.switchTimer = 0;
    this.switchTo = -1;
    this.sinceMelee = 99;
    this.meleeLanded = true;
    this.lastProgress = 0;
    this.setHands({ reload: 1, fire: 1 });
  }

  /** The player's boosts have changed: how fast their hands reload and fire now. */
  setHands(hands: HandSpeed): void {
    this.hands = hands;
    this.tuned.clear();
  }

  /** A weapon as it is at a given level in this player's hands: the bench's upgrades and the boosts applied. */
  defAt(id: WeaponId, level: number): WeaponDef {
    const key = `${id}:${level}`;
    let def = this.tuned.get(key);
    if (!def) this.tuned.set(key, (def = tune(WEAPONS[id], level, BENCH, this.hands)));
    return def;
  }

  /** One of the weapons being carried, as it really is. */
  defOf(weapon: CarriedWeapon<WeaponId>): WeaponDef {
    return this.defAt(weapon.id, weapon.level);
  }

  /** A kind of weapon as the player has it (at the level of the one they carry), or as it comes off the wall if they have none. */
  defFor(id: WeaponId): WeaponDef {
    const slot = slotOf(this.loadout, id);
    return this.defAt(id, slot >= 0 ? this.loadout.slots[slot]!.level : 0);
  }

  /** The weapon in hand. */
  get def(): WeaponDef {
    return this.defOf(held(this.loadout));
  }

  /** How many times the weapon in hand has been overclocked. */
  get level(): number {
    return held(this.loadout).level;
  }

  /** The weapon in hand by name, with its mark if it has been overclocked ("KR-7 Carbine Mk II"). */
  get title(): string {
    const mark = markName(this.level);
    return mark ? `${this.def.name} ${mark}` : this.def.name;
  }

  get state(): WeaponState {
    return held(this.loadout).state;
  }

  get reloading(): boolean {
    return this.state.reloading;
  }

  /** 0..1 through the reload, 0 when not reloading. */
  get reload(): number {
    return reloadProgress(this.state, this.def);
  }

  /** 0..1 through a weapon swap (0.5 is the moment the new one appears), 0 when not swapping. */
  get swap(): number {
    return this.switchTimer > 0 ? 1 - this.switchTimer / LOADOUT.switchTime : 0;
  }

  /** 0..1 through a melee strike, 0 when not striking. */
  get strike(): number {
    return this.sinceMelee < MELEE.cooldown ? this.sinceMelee / MELEE.cooldown : 0;
  }

  /** True while the hands are busy and the sights cannot be used. */
  get busy(): boolean {
    return this.switchTimer > 0 || this.sinceMelee < MELEE.cooldown || this.state.reloading;
  }

  /** Current cone of fire in radians, also used to size the crosshair. */
  spread(player: Player): number {
    const def = this.def;
    const base = def.spreadHip + (def.spreadAim - def.spreadHip) * player.aim;
    const moving = Math.min(player.speedFraction, 1.5) * def.spreadMoveBonus * (1 - player.aim * 0.7);
    const airborne = player.onGround ? 0 : def.spreadMoveBonus * 1.5;
    return base + moving + airborne + this.bloom * (1 - player.aim * 0.6) + def.pelletSpread * (1 - player.aim * 0.2);
  }

  /**
   * Bring a newly acquired weapon up (after a purchase has changed the
   * loadout). Plays the second half of the swap.
   */
  raise(): void {
    this.switchTimer = LOADOUT.switchTime / 2;
    this.switchTo = -1;
    this.bloom = 0;
    this.lastProgress = 0;
    this.onSwitch(this.def);
  }

  update(dt: number, player: Player): void {
    const { input, loadout } = this;
    const def = this.def;
    const state = this.state;
    this.sinceMelee += dt;

    // Weapons not in hand still cool down, so a swap never grants a free shot.
    for (const slot of loadout.slots) {
      if (slot && slot !== held(loadout)) updateWeapon(slot.state, this.defOf(slot), dt);
    }
    const tick = updateWeapon(state, def, dt);
    this.bloom = damp(this.bloom, 0, def.spreadRecovery, dt);

    // Reload sound cues at fixed points in the animation.
    const progress = this.reload;
    const crossed = (at: number) => this.lastProgress < at && progress >= at;
    if (state.reloading) {
      if (crossed(0.24)) this.onReloadStage('magOut');
      if (crossed(0.6)) this.onReloadStage('magIn');
      if (crossed(0.84)) this.onReloadStage('bolt');
    }
    this.lastProgress = tick.finished ? 0 : progress;

    // ---- Swapping weapons
    if (this.switchTimer > 0) {
      const before = this.switchTimer;
      this.switchTimer = Math.max(0, this.switchTimer - dt);
      const half = LOADOUT.switchTime / 2;
      if (this.switchTo >= 0 && before > half && this.switchTimer <= half) {
        cancelReload(state);
        loadout.current = this.switchTo;
        this.switchTo = -1;
        this.bloom = 0;
        this.lastProgress = 0;
        this.onSwitch(this.def);
      }
      return;
    }
    if (!player.alive) return;

    let wanted = -1;
    if (input.wasPressed('weapon1')) wanted = 0;
    else if (input.wasPressed('weapon2')) wanted = 1;
    else {
      const wheel = input.consumeWheel();
      if (wheel !== 0) wanted = nextSlot(loadout, wheel > 0 ? 1 : -1);
    }
    if (wanted >= 0 && wanted !== loadout.current && loadout.slots[wanted] && this.sinceMelee >= MELEE.cooldown) {
      this.switchTimer = LOADOUT.switchTime;
      this.switchTo = wanted;
      return;
    }

    // ---- Melee
    if (!this.meleeLanded && this.sinceMelee >= MELEE.hitTime) {
      this.meleeLanded = true;
      this.onMeleeLand();
    }
    if (input.wasPressed('melee') && this.sinceMelee >= MELEE.cooldown) {
      // A strike interrupts a reload that has not seated the magazine yet.
      if (state.reloading && !state.reloadCommitted) cancelReload(state);
      this.sinceMelee = 0;
      this.meleeLanded = false;
      this.onMelee();
    }
    if (this.sinceMelee < MELEE.cooldown) return;

    // ---- Reloading and firing
    if (input.wasPressed('reload') && canReload(state, def)) this.beginReload();

    const pulled = def.automatic ? input.isDown('fire') : input.wasPressed('fire');
    if (pulled && !player.sprinting) {
      if (state.ammo === 0 && !state.reloading) {
        if (input.wasPressed('fire')) this.onDryFire();
        this.beginReload();
      }
      // A long frame can owe an automatic weapon more than one shot; fire them all.
      while (fire(state, def)) {
        this.shoot(player, def);
        if (!def.automatic) break;
      }
    }
  }

  private beginReload(): void {
    if (startReload(this.state, this.def)) this.lastProgress = 0;
  }

  private shoot(player: Player, def: WeaponDef): void {
    const cone = this.spread(player) - def.pelletSpread * (1 - player.aim * 0.2);
    this.camera.getWorldDirection(_forward);
    // The whole shot wanders inside the weapon's cone; pellets then scatter around it.
    scatter(_forward, cone, _centre);
    const shot = this.shot;
    shot.weapon = def;
    shot.origin.copy(this.camera.position);
    shot.directions.length = 0;
    for (let i = 0; i < def.pellets; i++) {
      const direction = (this.pool[i] ??= new THREE.Vector3());
      if (def.pellets === 1) direction.copy(_centre);
      else scatter(_centre, def.pelletSpread * (1 - player.aim * 0.2), direction);
      shot.directions.push(direction);
    }
    this.bloom = Math.min(def.spreadMax, this.bloom + def.spreadPerShot);
    this.onShot(shot);
  }
}
