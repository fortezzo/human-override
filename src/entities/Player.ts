// The player: movement, looking around, health, and the small camera
// motions (head bob, recoil, shake, landing dip) that make it feel physical.

import * as THREE from 'three';
import { LOADOUT, LOOK, PLAYER } from '../config';
import type { Input } from '../core/input';
import { clamp, damp } from '../core/math';
import { settings } from '../core/settings';
import { groundHeight, resolveCircle, type CircleBody, type Collider } from '../sim/collision';

export class Player {
  /** Position of the feet. */
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  health = PLAYER.maxHealth;
  onGround = true;

  /** 0 = hip, 1 = fully aimed down sights. */
  aim = 0;
  sprinting = false;
  /** Horizontal speed as a fraction of walking speed (drives bob and sway). */
  speedFraction = 0;
  /** Advances with distance walked; the weapon model bobs in step with it. */
  bobPhase = 0;
  /** Fires once per footfall, for footstep sounds. */
  /** Set from the weapon in hand: how far it zooms and how long it takes to raise. */
  aimFov: number = LOOK.aimFov;
  aimTime = 0.17;

  onStep: () => void = () => {};
  onLand: (impact: number) => void = () => {};

  // Camera-only offsets, all of which ease back to zero.
  private recoilPitch = 0;
  private recoilYaw = 0;
  private shakeTrauma = 0;
  private landDip = 0;
  private hitRoll = 0;
  private sinceDamage = 99;
  private lastStepPhase = 0;
  private time = 0;

  private readonly body: CircleBody = { x: 0, z: 0, radius: PLAYER.radius, feet: 0, head: PLAYER.height };
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly input: Input,
  ) {}

  spawn(x: number, z: number, yaw: number): void {
    this.position.set(x, 0, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.health = PLAYER.maxHealth;
  }

  get alive(): boolean {
    return this.health > 0;
  }

  /** 0 = unhurt, 1 = nearly down. Drives the red screen edge. */
  get hurt(): number {
    return 1 - this.health / PLAYER.maxHealth;
  }

  /** Kick the view up (and a little sideways) when the weapon fires. */
  addRecoil(pitchDeg: number, yawDeg: number): void {
    this.recoilPitch += THREE.MathUtils.degToRad(pitchDeg);
    this.recoilYaw += THREE.MathUtils.degToRad(yawDeg);
  }

  /** Add screen shake. 0.2 is a rifle shot, 1 is a nearby explosion. */
  addShake(amount: number): void {
    const scale = settings.value.reducedMotion ? 0.25 : 1;
    this.shakeTrauma = Math.min(1, this.shakeTrauma + amount * scale);
  }

  /** Take a hit. `fromX/Z` is where it came from, to tilt the view away. */
  damage(amount: number, fromX: number, fromZ: number): void {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    this.sinceDamage = 0;
    this.addShake(0.5);
    // Roll the view away from the side the blow came from.
    const toX = fromX - this.position.x;
    const toZ = fromZ - this.position.z;
    const side = toX * Math.cos(this.yaw) - toZ * Math.sin(this.yaw);
    this.hitRoll += THREE.MathUtils.degToRad(PLAYER.hitKick) * (side >= 0 ? -1 : 1) * (settings.value.reducedMotion ? 0.3 : 1);
    this.recoilPitch += THREE.MathUtils.degToRad(PLAYER.hitKick * 0.6);
  }

  /** @param look mouse movement this frame, in pixels */
  update(dt: number, colliders: readonly Collider[], wantAim: boolean, look: { x: number; y: number }): void {
    this.time += dt;
    this.look(look);
    this.move(dt, colliders, wantAim);
    this.regenerate(dt);
    this.updateCamera(dt);
  }

  private look(look: { x: number; y: number }): void {
    const sensitivity = LOOK.radiansPerPixel * settings.value.sensitivity * (1 - this.aim * (1 - LOOK.aimSensitivityFactor));
    this.yaw -= look.x * sensitivity;
    this.pitch = clamp(this.pitch - look.y * sensitivity, -LOOK.pitchLimit, LOOK.pitchLimit);
  }

  private move(dt: number, colliders: readonly Collider[], wantAim: boolean): void {
    const input = this.input;
    let ax = 0;
    let az = 0;
    if (input.isDown('forward')) az -= 1;
    if (input.isDown('back')) az += 1;
    if (input.isDown('left')) ax -= 1;
    if (input.isDown('right')) ax += 1;
    const moving = ax !== 0 || az !== 0;
    if (moving) {
      const length = Math.hypot(ax, az);
      ax /= length;
      az /= length;
    }

    // Sprint only while moving mostly forward and not aiming.
    this.sprinting = input.isDown('sprint') && az < -0.5 && !wantAim && this.onGround;
    this.aim = damp(this.aim, wantAim && !this.sprinting ? 1 : 0, 1 / (this.aimTime * 0.35), dt);

    let maxSpeed = this.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    maxSpeed *= 1 - this.aim * (1 - PLAYER.aimSpeedFactor);

    // Wish direction in world space.
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wishX = this.right.x * ax - this.forward.x * az;
    const wishZ = this.right.z * ax - this.forward.z * az;

    const v = this.velocity;
    if (this.onGround) {
      // Friction, then accelerate toward the wished velocity.
      const speed = Math.hypot(v.x, v.z);
      if (speed > 0) {
        const drop = speed * PLAYER.groundFriction * dt;
        const scale = Math.max(0, speed - drop) / speed;
        v.x *= scale;
        v.z *= scale;
      }
      this.accelerate(wishX, wishZ, maxSpeed, PLAYER.groundAccel, dt);
      if (input.wasPressed('jump')) {
        v.y = PLAYER.jumpSpeed;
        this.onGround = false;
      }
    } else {
      this.accelerate(wishX, wishZ, maxSpeed, PLAYER.airAccel, dt);
    }
    v.y -= PLAYER.gravity * dt;

    // Integrate, then push out of anything solid.
    const p = this.position;
    p.addScaledVector(v, dt);
    const body = this.body;
    body.x = p.x;
    body.z = p.z;
    body.feet = p.y;
    body.head = p.y + PLAYER.height;
    resolveCircle(body, colliders, PLAYER.stepHeight);
    // Remove the part of the velocity that was pushing into the obstacle.
    const pushX = body.x - p.x;
    const pushZ = body.z - p.z;
    const pushLength = Math.hypot(pushX, pushZ);
    if (pushLength > 1e-6) {
      const nx = pushX / pushLength;
      const nz = pushZ / pushLength;
      const into = v.x * nx + v.z * nz;
      if (into < 0) {
        v.x -= nx * into;
        v.z -= nz * into;
      }
    }
    p.x = body.x;
    p.z = body.z;

    // Ground: the floor, or the top of a crate or barrier.
    const ground = groundHeight(body, colliders, PLAYER.stepHeight);
    const wasAirborne = !this.onGround;
    if (p.y <= ground + 0.001 && v.y <= 0) {
      if (wasAirborne) {
        const impact = clamp(-v.y / 9, 0, 1);
        this.landDip = Math.max(this.landDip, impact * 0.14);
        this.onLand(impact);
      }
      p.y = ground;
      v.y = 0;
      this.onGround = true;
    } else if (p.y > ground + 0.02) {
      // Walked off an edge.
      this.onGround = false;
    }

    // Footsteps and bob follow distance travelled, not time.
    const horizontal = Math.hypot(v.x, v.z);
    this.speedFraction = horizontal / PLAYER.walkSpeed;
    if (this.onGround && horizontal > 0.4) {
      this.bobPhase += horizontal * dt * 1.9;
      const half = Math.floor(this.bobPhase / Math.PI);
      if (half !== this.lastStepPhase) {
        this.lastStepPhase = half;
        this.onStep();
      }
    }
  }

  private accelerate(wishX: number, wishZ: number, maxSpeed: number, accel: number, dt: number): void {
    const v = this.velocity;
    const current = v.x * wishX + v.z * wishZ;
    const add = maxSpeed - current;
    if (add <= 0) return;
    const step = Math.min(accel * dt, add);
    v.x += wishX * step;
    v.z += wishZ * step;
  }

  private regenerate(dt: number): void {
    this.sinceDamage += dt;
    if (this.alive && this.sinceDamage > PLAYER.regenDelay && this.health < PLAYER.maxHealth) {
      this.health = Math.min(PLAYER.maxHealth, this.health + PLAYER.regenPerSecond * dt);
    }
  }

  private updateCamera(dt: number): void {
    // Ease the temporary offsets back to rest.
    this.recoilPitch = damp(this.recoilPitch, 0, LOADOUT.recoilRecovery, dt);
    this.recoilYaw = damp(this.recoilYaw, 0, LOADOUT.recoilRecovery, dt);
    this.hitRoll = damp(this.hitRoll, 0, 6, dt);
    this.landDip = damp(this.landDip, 0, 9, dt);
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.2);

    const reduced = settings.value.reducedMotion;
    const bobAmount = (reduced ? 0.25 : 1) * Math.min(this.speedFraction, 1.6) * (this.onGround ? 1 : 0) * (1 - this.aim * 0.7);
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.034 * bobAmount;
    const bobX = Math.cos(this.bobPhase) * 0.018 * bobAmount;

    const shake = this.shakeTrauma * this.shakeTrauma;
    const t = this.time * 38;
    const shakePitch = (Math.sin(t * 1.13) + Math.sin(t * 2.71 + 1.3)) * 0.006 * shake;
    const shakeYaw = (Math.sin(t * 1.57 + 4.1) + Math.sin(t * 3.03)) * 0.006 * shake;
    const shakeRoll = Math.sin(t * 1.91 + 2.2) * 0.01 * shake;

    const camera = this.camera;
    camera.position.set(this.position.x + this.right.x * bobX, this.position.y + PLAYER.eyeHeight - bobY - this.landDip, this.position.z + this.right.z * bobX);
    camera.rotation.set(this.pitch + this.recoilPitch + shakePitch, this.yaw + this.recoilYaw + shakeYaw, this.hitRoll + shakeRoll + bobX * 0.35);

    const fov = LOOK.fov + (this.sprinting ? LOOK.sprintFovBoost : 0) - this.aim * (LOOK.fov - this.aimFov);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = damp(camera.fov, fov, LOOK.fovLerp, dt);
      camera.updateProjectionMatrix();
    }
  }
}
