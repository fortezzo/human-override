// The player: movement, looking around, health, and the small camera
// motions (head bob, recoil, shake, landing dip) that make it feel physical.

import * as THREE from 'three';
import { LOADOUT, LOOK, PLAYER, STAMINA } from '../config';
import type { Input } from '../core/input';
import { clamp, damp } from '../core/math';
import { settings } from '../core/settings';
import { groundHeight, resolveCircle, type CircleBody, type Collider } from '../sim/collision';
import { accelerate, groundStep } from '../sim/movement';
import { createStamina, updateStamina, type Stamina } from '../sim/stamina';

/** Something round the player cannot walk through (a robot). */
export interface Obstacle {
  x: number;
  z: number;
}

export class Player {
  /** Position of the feet. */
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  health = PLAYER.maxHealth;
  /** Full health for this player right now (more with the health boost). */
  maxHealth = PLAYER.maxHealth;
  /** Seconds for which nothing can hurt them (just back on their feet from the fail-safe). */
  grace = 0;
  /** Down, waiting for the fail-safe: the controls do nothing. */
  frozen = false;
  /** How far the view has fallen, 0 (standing) to 1 (on the floor). Set by the game; see Game.updateFailsafe. */
  downPose = 0;
  onGround = true;
  // What a jump gets the player over is a rule of its own: PLAYER.climb.
  // Anything up to about waist height can be jumped onto or over; anything
  // taller is solid however high the feet are. (For a while nothing could
  // be jumped at all. A jump had put the first person to finish the mission
  // in among a cluster of barrels in a corner, wider than a robot's reach,
  // where nothing could hit them; shutting that corner by forbidding every
  // jump left the player stopped dead by a knee-high barrier. Now the map
  // is checked instead: tools/e2e.mjs stands the player everywhere a jump
  // can take them and sends a robot.)
  /** Seconds since jump was last pressed, and since the feet last had ground under them. */
  private sinceJumpPress = 99;
  private sinceGround = 0;

  /** 0 = hip, 1 = fully aimed down sights. */
  aim = 0;
  sprinting = false;
  /** What sprinting draws on. */
  stamina: Stamina = createStamina();
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
  /** How far the view still has to rise after the feet were put up onto something. */
  private rise = 0;
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
    this.maxHealth = PLAYER.maxHealth;
    this.health = PLAYER.maxHealth;
    this.grace = 0;
    this.sinceDamage = 99;
    this.stamina = createStamina();
    this.onGround = true;
    this.sinceJumpPress = 99;
    this.sinceGround = 0;
    this.rise = 0;
    this.frozen = false;
    this.downPose = 0;
  }

  /** Change what full health is. Raising it fills the player up to the new mark. */
  setMaxHealth(max: number): void {
    if (max > this.maxHealth && this.alive) this.health = max;
    this.maxHealth = max;
    this.health = Math.min(this.health, max);
  }

  /**
   * The fail-safe: back on their feet from a blow that put them down, with
   * this share of full health, and untouchable for `grace` seconds.
   */
  revive(share: number, grace: number): void {
    this.health = Math.max(1, this.maxHealth * share);
    this.grace = grace;
    this.sinceDamage = 0;
  }

  get alive(): boolean {
    return this.health > 0;
  }

  /** 0 = unhurt, 1 = nearly down. Drives the red screen edge. */
  get hurt(): number {
    return 1 - this.health / this.maxHealth;
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

  /**
   * Take a hit. `fromX/Z` is where it came from, to tilt the view away.
   * Returns false if the blow did not land (the player is already down, or
   * was hit a moment ago: see PLAYER.mercy).
   */
  damage(amount: number, fromX: number, fromZ: number): boolean {
    if (!this.alive || this.grace > 0 || this.sinceDamage < PLAYER.mercy) return false;
    this.health = Math.max(0, this.health - amount);
    this.sinceDamage = 0;
    this.addShake(0.5);
    // Roll the view away from the side the blow came from.
    const toX = fromX - this.position.x;
    const toZ = fromZ - this.position.z;
    const side = toX * Math.cos(this.yaw) - toZ * Math.sin(this.yaw);
    this.hitRoll += THREE.MathUtils.degToRad(PLAYER.hitKick) * (side >= 0 ? -1 : 1) * (settings.value.reducedMotion ? 0.3 : 1);
    this.recoilPitch += THREE.MathUtils.degToRad(PLAYER.hitKick * 0.6);
    return true;
  }

  /**
   * @param look mouse movement this frame, in pixels
   * @param obstacles robots standing in the way
   */
  update(dt: number, colliders: readonly Collider[], wantAim: boolean, look: { x: number; y: number }, obstacles: readonly Obstacle[] = []): void {
    this.time += dt;
    this.look(look);
    this.move(dt, colliders, wantAim, obstacles);
    this.regenerate(dt);
    this.updateCamera(dt);
  }

  private look(look: { x: number; y: number }): void {
    if (this.frozen) return;
    const sensitivity = LOOK.radiansPerPixel * settings.value.sensitivity * (1 - this.aim * (1 - LOOK.aimSensitivityFactor));
    this.yaw -= look.x * sensitivity;
    this.pitch = clamp(this.pitch - look.y * sensitivity, -LOOK.pitchLimit, LOOK.pitchLimit);
  }

  private move(dt: number, colliders: readonly Collider[], wantAim: boolean, obstacles: readonly Obstacle[]): void {
    const input = this.input;
    let ax = 0;
    let az = 0;
    if (!this.frozen) {
      if (input.isDown('forward')) az -= 1;
      if (input.isDown('back')) az += 1;
      if (input.isDown('left')) ax -= 1;
      if (input.isDown('right')) ax += 1;
    }
    const moving = ax !== 0 || az !== 0;
    if (moving) {
      const length = Math.hypot(ax, az);
      ax /= length;
      az /= length;
    }

    // Sprint only while moving mostly forward and not aiming, and only
    // while there is stamina to pay for it.
    const wantSprint = input.isDown('sprint') && az < -0.5 && !wantAim && this.onGround;
    this.sprinting = updateStamina(this.stamina, STAMINA, wantSprint, dt);
    this.aim = damp(this.aim, wantAim && !this.sprinting ? 1 : 0, 1 / (this.aimTime * 0.35), dt);

    let maxSpeed = this.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    maxSpeed *= 1 - this.aim * (1 - PLAYER.aimSpeedFactor);

    // Wish direction in world space.
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wishX = this.right.x * ax - this.forward.x * az;
    const wishZ = this.right.z * ax - this.forward.z * az;

    const v = this.velocity;
    // A jump a moment early (just before landing) or a moment late (just
    // off an edge) still happens: hopping from one thing to the next should
    // not need the press to land on one exact frame.
    this.sinceJumpPress = input.wasPressed('jump') && !this.frozen ? 0 : this.sinceJumpPress + dt;
    this.sinceGround = this.onGround ? 0 : this.sinceGround + dt;
    const wantJump = this.sinceJumpPress <= PLAYER.jumpBuffer;
    if (this.onGround) {
      // Friction, then a push toward the wished velocity.
      groundStep(v, wishX, wishZ, maxSpeed, { friction: PLAYER.groundFriction, accel: PLAYER.groundAccel }, dt);
    } else {
      accelerate(v, wishX, wishZ, maxSpeed, PLAYER.airAccel, dt);
    }
    if (wantJump && (this.onGround || (this.sinceGround <= PLAYER.jumpGrace && v.y <= 0))) {
      v.y = PLAYER.jumpSpeed;
      this.onGround = false;
      this.sinceJumpPress = 99;
      this.sinceGround = 99;
    }
    v.y -= PLAYER.gravity * dt;

    // Integrate, then push out of anything solid.
    const p = this.position;
    p.addScaledVector(v, dt);
    // Robots first: step back out of any that are too close, and lose the
    // speed that was carrying the player into them. (Walls are dealt with
    // afterwards, so a robot can never shove the player through one. And at
    // any height: nobody jumps off a crate over a robot's head.)
    for (const robot of obstacles) {
      const dx = p.x - robot.x;
      const dz = p.z - robot.z;
      const distance = Math.hypot(dx, dz);
      if (distance >= PLAYER.robotGap || distance < 1e-4) continue;
      const nx = dx / distance;
      const nz = dz / distance;
      p.x = robot.x + nx * PLAYER.robotGap;
      p.z = robot.z + nz * PLAYER.robotGap;
      const into = v.x * nx + v.z * nz;
      if (into < 0) {
        v.x -= nx * into;
        v.z -= nz * into;
      }
    }
    const body = this.body;
    body.feet = p.y;
    body.head = p.y + PLAYER.height;
    // What can never be got over, on its own: the speed that was carrying
    // the player into a wall is lost.
    body.x = p.x;
    body.z = p.z;
    resolveCircle(body, colliders, PLAYER.stepHeight, PLAYER.climb, 'tall');
    this.loseSpeedInto(body.x - p.x, body.z - p.z);
    // Then everything, which is where the body ends up. Speed into
    // something low is lost as well, but not in mid-air: someone who jumps
    // while pressed against a barrier keeps pushing at it, and goes over
    // the moment their feet are high enough, instead of rising and dropping
    // back where they stood.
    body.x = p.x;
    body.z = p.z;
    resolveCircle(body, colliders, PLAYER.stepHeight, PLAYER.climb);
    if (this.onGround) this.loseSpeedInto(body.x - p.x, body.z - p.z);
    p.x = body.x;
    p.z = body.z;

    // Ground: the floor, or the top of something low that the feet are level with (give or take a step).
    const ground = groundHeight(body, colliders, PLAYER.stepHeight, 0, PLAYER.climb);
    const wasAirborne = !this.onGround;
    if (p.y <= ground + 0.001 && v.y <= 0) {
      if (wasAirborne) {
        const impact = clamp(-v.y / 9, 0, 1);
        this.landDip = Math.max(this.landDip, impact * 0.14);
        this.onLand(impact);
      }
      // Put up onto something (a step, or the top of a thing the jump did
      // not quite reach): the feet are there at once, the view follows.
      if (ground - p.y > 0.03) this.rise = Math.min(0.4, this.rise + ground - p.y);
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

  /** Lose whatever speed was carrying the player the opposite way to a push out of something solid. */
  private loseSpeedInto(pushX: number, pushZ: number): void {
    const length = Math.hypot(pushX, pushZ);
    if (length <= 1e-6) return;
    const nx = pushX / length;
    const nz = pushZ / length;
    const v = this.velocity;
    const into = v.x * nx + v.z * nz;
    if (into < 0) {
      v.x -= nx * into;
      v.z -= nz * into;
    }
  }

  private regenerate(dt: number): void {
    this.sinceDamage += dt;
    this.grace = Math.max(0, this.grace - dt);
    if (this.alive && this.sinceDamage > PLAYER.regenDelay && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + PLAYER.regenPerSecond * dt);
    }
  }

  private updateCamera(dt: number): void {
    // Ease the temporary offsets back to rest.
    this.recoilPitch = damp(this.recoilPitch, 0, LOADOUT.recoilRecovery, dt);
    this.recoilYaw = damp(this.recoilYaw, 0, LOADOUT.recoilRecovery, dt);
    this.hitRoll = damp(this.hitRoll, 0, 6, dt);
    this.landDip = damp(this.landDip, 0, 9, dt);
    this.rise = damp(this.rise, 0, 13, dt);
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

    // Down: the view drops to the floor and keels over, looking up at whatever did it.
    const fallen = this.downPose * this.downPose * (3 - 2 * this.downPose);
    const camera = this.camera;
    camera.position.set(this.position.x + this.right.x * bobX, this.position.y + PLAYER.eyeHeight - bobY - this.landDip - this.rise - fallen * 1.05, this.position.z + this.right.z * bobX);
    camera.rotation.set(this.pitch * (1 - fallen) + fallen * 0.22 + this.recoilPitch + shakePitch, this.yaw + this.recoilYaw + shakeYaw, this.hitRoll + shakeRoll + bobX * 0.35 + fallen * (reduced ? 0.12 : 0.5));

    const fov = LOOK.fov + (this.sprinting ? LOOK.sprintFovBoost : 0) - this.aim * (LOOK.fov - this.aimFov);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = damp(camera.fov, fov, LOOK.fovLerp, dt);
      camera.updateProjectionMatrix();
    }
  }
}
