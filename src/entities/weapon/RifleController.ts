// Turns the player's trigger, aim and reload inputs into shots.
//
// Ammunition and timing rules come from sim/weapon.ts; this class adds the
// parts that need the 3D world: where each bullet goes (including spread)
// and telling the rest of the game that a shot happened.

import * as THREE from 'three';
import { RIFLE } from '../../config';
import type { Input } from '../../core/input';
import { damp } from '../../core/math';
import { canReload, createWeapon, fire, reloadProgress, startReload, updateWeapon, type WeaponSpec, type WeaponState } from '../../sim/weapon';
import type { Player } from '../Player';

export interface ShotEvent {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
}

const SPEC: WeaponSpec = {
  magazine: RIFLE.magazine,
  reserve: RIFLE.reserve,
  fireInterval: RIFLE.fireInterval,
  reloadTime: RIFLE.reloadTime,
  reloadCommit: RIFLE.reloadCommit,
  // The look test has no way to buy ammunition yet, so spares never run out.
  infiniteReserve: true,
};

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

export class RifleController {
  readonly state: WeaponState = createWeapon(SPEC);
  readonly spec = SPEC;
  /** Extra spread built up by sustained fire; decays when the trigger rests. */
  bloom = 0;

  onShot: (shot: ShotEvent) => void = () => {};
  onDryFire: () => void = () => {};
  onReloadStart: () => void = () => {};
  /** Fired at moments through the reload, for its sound cues. */
  onReloadStage: (stage: 'magOut' | 'magIn' | 'bolt') => void = () => {};

  private lastProgress = 0;
  private readonly shot: ShotEvent = { origin: new THREE.Vector3(), direction: new THREE.Vector3() };

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly input: Input,
  ) {}

  get reloading(): boolean {
    return this.state.reloading;
  }

  get reload(): number {
    return reloadProgress(this.state, this.spec);
  }

  /** Current cone of fire in radians, also used to size the crosshair. */
  spread(player: Player): number {
    const base = RIFLE.spreadHip + (RIFLE.spreadAim - RIFLE.spreadHip) * player.aim;
    const moving = Math.min(player.speedFraction, 1.5) * RIFLE.spreadMoveBonus * (1 - player.aim * 0.7);
    const airborne = player.onGround ? 0 : RIFLE.spreadMoveBonus * 1.5;
    return base + moving + airborne + this.bloom * (1 - player.aim * 0.6);
  }

  update(dt: number, player: Player): void {
    const tick = updateWeapon(this.state, this.spec, dt);
    this.bloom = damp(this.bloom, 0, RIFLE.spreadRecovery, dt);

    // Reload sound cues at fixed points in the animation.
    const progress = this.reload;
    const crossed = (at: number) => this.lastProgress < at && progress >= at;
    if (this.state.reloading) {
      if (crossed(0.24)) this.onReloadStage('magOut');
      if (crossed(0.6)) this.onReloadStage('magIn');
      if (crossed(0.84)) this.onReloadStage('bolt');
    }
    this.lastProgress = tick.finished ? 0 : progress;

    if (this.input.wasPressed('reload') && canReload(this.state, this.spec)) this.beginReload();

    const trigger = this.input.isDown('fire') && player.alive && !player.sprinting;
    if (trigger) {
      if (this.state.ammo === 0 && !this.state.reloading) {
        if (this.input.wasPressed('fire')) this.onDryFire();
        this.beginReload();
      }
      // A long frame can owe more than one shot; fire them all.
      while (fire(this.state, this.spec)) this.shoot(player);
    }
  }

  private beginReload(): void {
    if (startReload(this.state, this.spec)) {
      this.lastProgress = 0;
      this.onReloadStart();
    }
  }

  private shoot(player: Player): void {
    const spread = this.spread(player);
    this.camera.getWorldDirection(_forward);
    _right.crossVectors(_forward, this.camera.up).normalize();
    _up.crossVectors(_right, _forward);
    // Random point in a disc gives an even spread inside the cone.
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * spread;
    this.shot.origin.copy(this.camera.position);
    this.shot.direction
      .copy(_forward)
      .addScaledVector(_right, Math.cos(angle) * radius)
      .addScaledVector(_up, Math.sin(angle) * radius)
      .normalize();
    this.bloom = Math.min(RIFLE.spreadMax, this.bloom + RIFLE.spreadPerShot);
    this.onShot(this.shot);
  }
}
