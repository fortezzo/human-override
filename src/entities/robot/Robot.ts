// One robot: a copy of the shared model with its own skeleton, driven by
// the decisions in sim/robotMind.ts. This file is the "body": it moves,
// turns, plays animations, glows, and reports what a bullet hit.

import * as THREE from 'three';
import { addsLightOnly } from '../../render/glow';
import { PoseLayers } from './kit/PoseLayers';
import { ARGUS, ROBOT, SPECIALS, TURNCOAT } from '../../config';
import { angleDelta, clamp, damp, rand } from '../../core/math';
import { settings } from '../../core/settings';
import { resolveCircle, type CircleBody, type Collider } from '../../sim/collision';
import { cellAt, clearLine, nextWaypoint, type NavGrid } from '../../sim/navGrid';
import { rayCapsule, raySphere } from '../../sim/rayShapes';
import type { WeaponKey } from '../../sim/argus';
import { createArmour, type Armour } from '../../sim/armour';
import type { RobotKind } from '../../sim/horde';
import { createRobotMind, damageRobot, moveFactor, thinkRobot, type HitZone, type RobotMind, type RobotSpec } from '../../sim/robotMind';
import { createGuard, createShield, type Shield } from './attachments';
import type { ClipName, RobotModel } from './RobotModel';

export interface RobotHit {
  distance: number;
  zone: HitZone;
  point: THREE.Vector3;
}

export interface RobotEventsOut {
  /** Damage dealt to the player this frame (0 if none). */
  hitPlayer: number;
  attackStarted: boolean;
  /** A foot came down this frame. */
  footstep: boolean;
  /** The robot finished collapsing and should now break apart. */
  breakApart: boolean;
  /** It dropped from a vent and hit the floor this frame. */
  landed: boolean;
  /** It has made no headway for too long and should be sent round again. */
  stuck: boolean;
  /** A bomber has come within reach and started its fuse. */
  primed: boolean;
  /** It was turned to the player's side, and its time is up: its core has burnt out. */
  burnedOut: boolean;
}

/** What makes one robot different from the next: set by the round it belongs to. */
export interface RobotTraits {
  health: number;
  /** Ground speed when chasing, metres per second. */
  speed: number;
  /** Dropping from a ceiling vent: the height it starts at. Leave out for one that walks in. */
  dropFrom?: number;
  /** An elite: the Custodian, which carries an override key, or the Proxy, ARGUS's own unit. */
  role?: RobotRole;
  /**
   * Sent in by the mission, on top of the round's own robots: destroying
   * it pays scrap but does not count toward clearing the round.
   */
  extra?: boolean;
  /** Damage of one blow, if not the usual. */
  attackDamage?: number;
  /** How hard a single hit has to be to knock it off balance, if not the usual. */
  staggerDamage?: number;
  /** How long a hit slows it for (seconds), if not the usual. */
  flinchTime?: number;
  /** One of the specials (a drone, a bomber, a heavy); the ordinary robot if left out. */
  kind?: RobotKind;
  /** ARGUS's shielding against one weapon: that weapon does half its damage to this robot. */
  shield?: WeaponKey;
  /** ARGUS's plate over the weak point: the damage it takes to shoot off. */
  guard?: number;
}

export type RobotRole = 'custodian' | 'proxy';

/** Capsules that follow the limbs: [bone at one end, bone at the other, radius]. */
const LIMBS: Array<[string, string, number]> = [
  ['LeftArm', 'LeftForeArm', 0.07],
  ['LeftForeArm', 'LeftHand', 0.075],
  ['RightArm', 'RightForeArm', 0.07],
  ['RightForeArm', 'RightHand', 0.075],
  ['LeftUpLeg', 'LeftLeg', 0.085],
  ['LeftLeg', 'LeftFoot', 0.075],
  ['RightUpLeg', 'RightLeg', 0.085],
  ['RightLeg', 'RightFoot', 0.075],
];

/** Seconds a destroyed robot staggers before it comes apart. */
const COLLAPSE_TIME = 0.42;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _headCentre = new THREE.Vector3();

export class Robot {
  readonly root: THREE.Object3D;
  readonly spec: RobotSpec;
  readonly mind: RobotMind;
  /** Chasing speed for this robot, metres per second. */
  readonly moveSpeed: number;
  readonly bones = new Map<string, THREE.Bone>();
  /** Direction and force of the shot that destroyed it. */
  readonly killImpulse = new THREE.Vector3();
  /** Set once the robot has been removed from play. */
  removed = false;
  /** Stand still and idle (used on the start screen). */
  hold = false;
  /** Still outside the building: hurry in. Cleared once it is indoors. */
  hurry = false;
  /** Where it came in, for the debug tools. */
  entry = '';
  /** An elite, or null for one of the horde. */
  readonly role: RobotRole | null;
  /** Sent in by the mission, on top of the round's own robots. */
  readonly extra: boolean;
  /** Switched off by the kill switch: it slumps where it stands and stays there. */
  poweredDown = false;
  /** The ordinary robot, or which special it is. */
  readonly kind: RobotKind;
  /** What stands between a hit and this robot: plating, shielding, a plate over the weak point. */
  readonly armour: Armour = createArmour();
  /** A bomber's fuse: seconds left once it has primed, -1 until then. */
  fuse = -1;
  /** A bomber that went off by itself (no one destroyed it). */
  selfDestructed = false;
  /** A primed bomber: seconds until its next beep. */
  beepIn = 0;
  /** Turned to the player's side by the Turncoat: seconds of it left (0 = one of ARGUS's). */
  turned = 0;
  /** It has been turned at some point (what it does from then on is the player's doing). */
  wasTurned = false;

  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<ClipName, THREE.AnimationAction>();
  private current: ClipName = 'idle';
  private readonly eyeMaterial: THREE.MeshBasicMaterial;
  private readonly glow: THREE.Sprite;
  private readonly eyeColor: THREE.Color;
  /** The design's hunch and the bullet flinch, layered over the animation. */
  private readonly pose: PoseLayers;

  private heading = 0;
  private speed = 0;
  private stride = 0;
  private lastHalfStride = 0;
  private collapse = 0;
  /** Falling from a vent: vertical speed, and how long since it landed. */
  private falling = false;
  private fallSpeed = 0;
  private landing = 0;
  /** Stuck check: the shortest walk to the target seen lately, and how long since it improved. */
  private bestRemaining = Infinity;
  private sinceProgress = 0;
  // Procedural flinch: a quick lean away from the shot.
  private flinchLean = 0;
  private flinchTwist = 0;
  private time = rand(0, 10);
  private readonly body: CircleBody = { x: 0, z: 0, radius: ROBOT.radius, feet: 0, head: 1.8 };
  /** For one that flies: how far its feet hang off the floor. */
  private readonly lift: number;
  private shield: Shield | null = null;
  private shieldFlash = 0;
  private guard: THREE.Object3D | null = null;

  constructor(
    readonly model: RobotModel,
    x: number,
    z: number,
    heading: number,
    traits: RobotTraits = { health: ROBOT.health, speed: ROBOT.walkSpeed },
  ) {
    this.spec = {
      ...ROBOT,
      health: traits.health,
      attackDamage: traits.attackDamage ?? ROBOT.attackDamage,
      staggerDamage: traits.staggerDamage ?? ROBOT.staggerDamage,
      flinchTime: traits.flinchTime ?? ROBOT.flinchTime,
    };
    this.role = traits.role ?? null;
    this.extra = traits.extra ?? false;
    this.kind = traits.kind ?? 'drudge';
    if (this.kind === 'heavy') this.armour.plating = SPECIALS.heavy.plating;
    this.lift = model.flies ? Math.max(0, SPECIALS.drone.hover - model.chestHeight) : 0;
    this.eyeColor = new THREE.Color(model.eyeColor);
    this.mind = createRobotMind(this.spec);
    this.moveSpeed = traits.speed;
    this.root = model.instantiate();
    this.root.position.set(x, traits.dropFrom ?? this.lift, z);
    // (One that flies does not fall out of a vent: it comes down out of it.)
    this.falling = traits.dropFrom !== undefined && !model.flies;
    this.heading = heading;
    this.root.rotation.y = heading;
    this.root.traverse((node) => {
      const bone = node as THREE.Bone;
      if (bone.isBone) this.bones.set(bone.name, bone);
    });

    this.mixer = new THREE.AnimationMixer(this.root);
    for (const [name, clip] of model.clips) {
      const action = this.mixer.clipAction(clip);
      if (name === 'attack' || name === 'attackHeavy' || name === 'hit' || name === 'deathBack' || name === 'deathFront') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions.set(name, action);
    }
    this.actions.get('walk')!.play();
    this.current = 'walk';
    // Start each robot at a different point in its walk so a group never
    // marches in step.
    this.actions.get('walk')!.time = rand(0, 4);

    this.pose = new PoseLayers(this.bones, model.posture, ['Spine1', 'Neck']);

    // The visor and sensor lights are part of the model. This robot gets its
    // own copy of their material so it can flicker and go dark on its own,
    // plus a soft flare over the visor that reads from across the room.
    const lights = this.root.getObjectByName('glow') as THREE.SkinnedMesh;
    this.eyeMaterial = (lights.material as THREE.MeshBasicMaterial).clone();
    lights.material = this.eyeMaterial;
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: model.glowTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, toneMapped: false }),
    );
    this.glow.position.copy(model.glow.at);
    this.glow.scale.set(model.glow.size.x, model.glow.size.y, 1);
    this.glow.renderOrder = 9;
    addsLightOnly(this.glow);
    this.bones.get(model.glow.bone)!.add(this.glow);
    this.setEyes(1);

    // What ARGUS has hung on it.
    const hang = (object: THREE.Object3D, mount: { bone: string; toBone: THREE.Matrix4 }): void => {
      object.matrixAutoUpdate = false;
      object.matrix.copy(mount.toBone);
      this.bones.get(mount.bone)!.add(object);
    };
    if (traits.shield) {
      this.armour.shield = traits.shield;
      this.armour.shieldFactor = ARGUS.shielding.factor;
      this.shield = createShield(traits.shield, model.mounts.chest.at);
      hang(this.shield.object, model.mounts.chest);
    }
    if (traits.guard) {
      this.armour.guard = traits.guard;
      this.guard = createGuard(model.mounts.visor.at);
      hang(this.guard, model.mounts.visor);
    }
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  /** True once it is standing on the floor (not still dropping from a vent). */
  get grounded(): boolean {
    return !this.falling;
  }

  get alive(): boolean {
    return this.mind.state !== 'dead';
  }

  /** How much of its health is left, 0..1. */
  get healthLeft(): number {
    return Math.max(0, this.mind.health / this.spec.health);
  }

  /**
   * Hang an object on the robot (the Custodian's key, in the cradle on its
   * back). It rides on the bone and is left behind when the robot is
   * removed. Does nothing on a robot with nowhere to carry it.
   */
  carry(object: THREE.Object3D): void {
    const place = this.model.carry;
    const bone = place && this.bones.get(place.bone);
    if (!place || !bone) return;
    object.position.copy(place.at);
    bone.add(object);
  }

  /**
   * The kill switch has been pulled: it stops where it is, slumps, and its
   * lights die. It stays on the map as a wreck.
   */
  powerDown(): void {
    if (!this.alive) return;
    this.mind.state = 'dead';
    this.mind.health = 0;
    this.poweredDown = true;
    this.collapse = 0;
    const clip: ClipName = Math.random() < 0.5 ? 'deathBack' : 'deathFront';
    this.play(clip, 0.3, true);
    this.actions.get(clip)!.timeScale = rand(0.55, 0.9);
  }

  /** Roughly the middle of the chest, for effects. */
  chest(out: THREE.Vector3): THREE.Vector3 {
    return out.setFromMatrixPosition(this.bones.get(this.model.flies ? 'Spine2' : 'Spine1')!.matrixWorld);
  }

  /**
   * Where to aim to hit it: its weak point, if that is what is wanted and
   * it has one (the head, for most; the heavy's is the reactor in its
   * chest), otherwise the middle of it.
   */
  aimPoint(out: THREE.Vector3, weakPoint = true): THREE.Vector3 {
    const { hitShape, weakPoint: weak } = this.model;
    if (hitShape) return out.copy(hitShape.centre).applyMatrix4(this.bones.get(hitShape.bone)!.matrixWorld);
    if (!weakPoint || weak.radius <= 0) return this.chest(out);
    if (weak.bone === 'Head') return out.setFromMatrixPosition(this.bones.get('Head')!.matrixWorld);
    return out.copy(weak.centre).applyMatrix4(this.bones.get(weak.bone)!.matrixWorld);
  }

  /**
   * The Turncoat's beam has caught it: for `seconds` it is on the player's
   * side, and its lights say so.
   */
  turn(seconds: number): void {
    if (!this.alive) return;
    this.turned = Math.max(this.turned, seconds);
    this.wasTurned = true;
    this.eyeColor.setHex(TURNCOAT.color);
    // A bomber that had started its fuse starts again, for its new side.
    this.fuse = -1;
    this.mind.state = 'chase';
    this.mind.cooldown = 0;
  }

  /** Knocked off balance without being hurt (the fail-safe's shove). ARGUS's own machines stand their ground. */
  shove(): void {
    if (!this.alive || this.role || this.falling) return;
    this.mind.state = 'stagger';
    this.mind.timer = 0;
    this.play('hit', 0.08, true);
  }

  /** Which weapon it is shielded against, or null. */
  get shieldedAgainst(): WeaponKey | null {
    return this.armour.shield;
  }

  /** Its shielding has just turned part of a shot: flare it. */
  flashShield(): void {
    this.shieldFlash = 1;
  }

  /** The plate over its weak point has been shot off: let go of it. Returns where it was, or null if there was none. */
  dropGuard(out: THREE.Vector3): THREE.Vector3 | null {
    if (!this.guard) return null;
    this.guard.getWorldPosition(out);
    out.setFromMatrixPosition(this.bones.get('Head')!.matrixWorld);
    this.guard.removeFromParent();
    this.guard = null;
    return out;
  }

  /** @param others every robot on the map (this one included), to keep them from walking through each other */
  update(dt: number, target: THREE.Vector3, targetAlive: boolean, grid: NavGrid, colliders: readonly Collider[], others: readonly Robot[] = []): RobotEventsOut {
    this.time += dt;
    const out: RobotEventsOut = { hitPlayer: 0, attackStarted: false, footstep: false, breakApart: false, landed: false, stuck: false, primed: false, burnedOut: false };
    if (this.turned > 0 && this.alive) {
      this.turned -= dt;
      if (this.turned <= 0) {
        this.turned = 0;
        out.burnedOut = true;
      }
    }
    const flies = this.model.flies;
    if (this.shield) {
      this.shieldFlash = damp(this.shieldFlash, 0, 5.5, dt);
      this.shield.setLevel(this.alive ? 1 + 0.12 * Math.sin(this.time * 5) : 0, this.alive ? this.shieldFlash : 0);
    }
    const p = this.root.position;
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const distance = Math.hypot(dx, dz);

    if (this.hold && this.alive) {
      this.play('idle', 0.3);
      this.setEyes(0.85 + 0.15 * Math.sin(this.time * 3));
      this.mixer.update(dt);
      this.pose.apply();
      this.root.updateMatrixWorld(true);
      return out;
    }

    // Dropping from a vent: fall, hit the floor, take a moment to find its feet.
    if (this.alive && (this.falling || this.landing > 0)) {
      if (this.falling) {
        this.fallSpeed += 14 * dt;
        p.y -= this.fallSpeed * dt;
        this.play('idle', 0.1);
        if (p.y <= 0) {
          p.y = 0;
          this.falling = false;
          this.landing = ROBOT.landingTime;
          out.landed = true;
          this.play('hit', 0.05, true);
          this.actions.get('hit')!.timeScale = 1.3;
        }
      } else {
        this.landing -= dt;
      }
      this.heading = Math.atan2(dx, dz);
      this.root.rotation.y = this.heading;
      this.setEyes(0.9);
      this.mixer.update(dt);
      this.pose.apply();
      this.root.updateMatrixWorld(true);
      return out;
    }

    if (this.poweredDown) {
      // Switched off: it goes down slowly, its lights fading with a last
      // flicker, and stays where it falls. One caught in mid-air still lands.
      this.collapse += dt;
      if (this.falling) {
        this.fallSpeed += 14 * dt;
        p.y -= this.fallSpeed * dt;
        if (p.y <= 0) {
          p.y = 0;
          this.falling = false;
          out.landed = true;
        }
      }
      // Its lights die away over a second, each robot wavering at its own
      // pace (a room full of them must not strobe).
      const fade = Math.max(0, 1 - this.collapse / 1.1);
      this.setEyes(fade * (settings.value.reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(this.time * 11)));
    } else if (this.mind.state === 'dead') {
      // Collapsing: the death animation plays briefly, eyes guttering.
      this.collapse += dt;
      this.setEyes(Math.random() < 0.5 ? 0.15 : 1 - this.collapse / COLLAPSE_TIME);
      if (this.collapse >= COLLAPSE_TIME) out.breakApart = true;
    } else {
      const events = thinkRobot(this.mind, this.spec, dt, distance, targetAlive);
      out.hitPlayer = events.hit;
      out.attackStarted = events.attackStarted;
      if (events.attackStarted) {
        // (A drone has no arms to swing: it lunges. The heavy has a blow of its own.)
        if (flies) this.flinchLean += 0.5;
        else this.play(this.kind === 'heavy' && this.actions.has('attackHeavy') ? 'attackHeavy' : 'attack', 0.12, true);
      }

      // A bomber within reach starts its fuse, and when the fuse runs out
      // it goes off: there is that long to get clear of it.
      if (this.kind === 'bomber') {
        if (this.fuse < 0 && targetAlive && distance <= SPECIALS.bomber.trigger) {
          this.fuse = SPECIALS.bomber.fuse;
          out.primed = true;
        } else if (this.fuse >= 0) {
          this.fuse -= dt;
          if (this.fuse <= 0) {
            this.selfDestructed = true;
            this.mind.state = 'dead';
            this.mind.health = 0;
            this.collapse = COLLAPSE_TIME;
          }
        }
      }

      // Decide where to face and how fast to go.
      let wantX = dx;
      let wantZ = dz;
      let wantSpeed = 0;
      const pace = (this.hurry ? Math.max(this.moveSpeed, ROBOT.arrivalSpeed) : this.moveSpeed) * (this.fuse >= 0 ? 0.6 : 1);
      const running = pace > ROBOT.runAbove;
      if (this.mind.state === 'chase') {
        if (distance > ROBOT.attackRange * 0.85) {
          // (The robots' map leads to the player. One that has been turned is after another robot: it goes straight for it.)
          // Close in, a robot stops reading the map and walks straight at
          // the player, unless something it cannot cross stands between it
          // and the nearest floor to them: a barrier they have jumped, the
          // fence they have hopped. Then the map still shows the way round.
          const here = distance <= 2.2 ? cellAt(grid, p.x, p.z) : -1;
          const direct = here >= 0 && grid.goal >= 0 && clearLine(grid, here, grid.goal);
          const waypoint = !direct && this.turned <= 0 ? nextWaypoint(grid, p.x, p.z) : null;
          if (waypoint) {
            wantX = waypoint.x - p.x;
            wantZ = waypoint.z - p.z;
            // Stuck check: is the walk to the target getting any shorter?
            if (waypoint.remaining < this.bestRemaining - 0.4) {
              this.bestRemaining = waypoint.remaining;
              this.sinceProgress = 0;
            } else {
              this.sinceProgress += dt;
              // The target moving away is not being stuck: let the mark drift up slowly.
              this.bestRemaining += dt * 1.2;
              if (this.sinceProgress > ROBOT.stuckTime) out.stuck = true;
            }
          }
          wantSpeed = pace * moveFactor(this.mind);

          // Steer away from robots that are too close, so a crowd spreads
          // out round the player instead of queueing in single file.
          const length = Math.hypot(wantX, wantZ) || 1;
          let steerX = wantX / length;
          let steerZ = wantZ / length;
          for (const other of others) {
            if (other === this || !other.alive) continue;
            const ox = p.x - other.root.position.x;
            const oz = p.z - other.root.position.z;
            const gap = Math.hypot(ox, oz);
            if (gap < ROBOT.separation && gap > 0.001) {
              const push = ((ROBOT.separation - gap) / ROBOT.separation) * ROBOT.separationForce;
              steerX += (ox / gap) * push;
              steerZ += (oz / gap) * push;
            }
          }
          wantX = steerX;
          wantZ = steerZ;
        } else {
          this.sinceProgress = 0;
        }
        this.play(flies ? 'idle' : wantSpeed > 0.05 || this.speed > 0.2 ? (running ? 'run' : 'walk') : 'idle', 0.25);
      } else if (this.mind.state === 'stagger') {
        this.play('hit', 0.1);
      }

      const turnRate = this.mind.state === 'attack' ? ROBOT.turnSpeed * 0.35 : ROBOT.turnSpeed;
      if (Math.hypot(wantX, wantZ) > 0.05 && this.mind.state !== 'stagger') {
        const wantHeading = Math.atan2(wantX, wantZ);
        const delta = angleDelta(this.heading, wantHeading);
        this.heading += clamp(delta, -turnRate * dt, turnRate * dt);
        // Slow down for sharp turns rather than sliding sideways.
        wantSpeed *= clamp(1 - (Math.abs(delta) - 0.5) / 1.5, 0.25, 1);
      }
      this.speed = damp(this.speed, wantSpeed, 6, dt);

      p.x += Math.sin(this.heading) * this.speed * dt;
      p.z += Math.cos(this.heading) * this.speed * dt;
      // Robots are solid to each other: never let two overlap.
      for (const other of others) {
        if (other === this || !other.alive || other.falling) continue;
        const ox = p.x - other.root.position.x;
        const oz = p.z - other.root.position.z;
        const gap = Math.hypot(ox, oz);
        const least = ROBOT.radius * 1.7;
        if (gap < least && gap > 0.001) {
          p.x += (ox / gap) * (least - gap) * 0.5;
          p.z += (oz / gap) * (least - gap) * 0.5;
        }
      }
      this.body.x = p.x;
      this.body.z = p.z;
      resolveCircle(this.body, colliders, 0.3);
      p.x = this.body.x;
      p.z = this.body.z;
      this.root.rotation.y = this.heading;

      // Match the stride to ground speed so the feet do not slide.
      this.actions.get('walk')!.timeScale = clamp(this.speed / ROBOT.walkAnimSpeedAt, 0.6, 3.6);
      this.actions.get('run')!.timeScale = clamp(this.speed / ROBOT.runAnimSpeedAt, 0.55, 2.0);
      this.stride += this.speed * dt;
      const half = Math.floor(this.stride / (running ? 0.85 : 0.42));
      if (half !== this.lastHalfStride) {
        this.lastHalfStride = half;
        out.footstep = !flies;
      }
      if (this.fuse >= 0) {
        // Primed: its lights beat faster and faster as the fuse runs down.
        const through = 1 - Math.max(0, this.fuse) / SPECIALS.bomber.fuse;
        this.setEyes(Math.sin(this.time * (26 + through * 50)) > 0 ? 1.5 : 0.25);
      } else {
        this.setEyes(0.9 + 0.1 * Math.sin(this.time * 9));
      }
    }

    // One that flies hangs in the air, rising and falling a little, and
    // leans into the way it is going.
    if (flies && this.alive) {
      p.y = damp(p.y, this.lift + Math.sin(this.time * 2.3) * 0.07, 3, dt);
      this.flinchLean = damp(this.flinchLean, clamp(this.speed / 14, 0, 0.42), 5, dt);
    } else if (flies) {
      // Destroyed: it drops.
      this.fallSpeed += 12 * dt;
      p.y = Math.max(-this.model.chestHeight + 0.2, p.y - this.fallSpeed * dt);
    }

    this.mixer.update(dt);

    // The animations were recorded for an upright figure. Layer the
    // design's hunch on top, and a quick lean away from any bullet.
    if (!flies) this.flinchLean = damp(this.flinchLean, 0, 9, dt);
    this.flinchTwist = damp(this.flinchTwist, 0, 9, dt);
    if (Math.abs(this.flinchLean) > 0.002 || Math.abs(this.flinchTwist) > 0.002) {
      this.pose.apply([
        { bone: 'Spine1', pitch: this.flinchLean, twist: this.flinchTwist },
        { bone: 'Neck', pitch: this.flinchLean * 0.8, twist: 0 },
      ]);
    } else {
      this.pose.apply();
    }
    this.root.updateMatrixWorld(true);
    return out;
  }

  /**
   * Test a bullet against the robot's hit shapes.
   * `direction` must be a unit vector.
   */
  hitTest(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): RobotHit | null {
    if (!this.alive) return null;
    // Cheap rejection: is the ray anywhere near the robot at all?
    const p = this.root.position;
    // The shapes below were measured on the standard robot; bigger kinds are that much thicker.
    const girth = this.model.girth;
    _a.set(p.x, p.y + 0.9 * girth, p.z);
    if (raySphere(origin, direction, _a, 1.3 * girth) < 0) return null;

    let best = maxDistance;
    let zone: HitZone | null = null;

    // A body that is not a figure (the drone) is one sphere.
    const shape = this.model.hitShape;
    if (shape) {
      _a.copy(shape.centre).applyMatrix4(this.bones.get(shape.bone)!.matrixWorld);
      const hit = raySphere(origin, direction, _a, shape.radius);
      if (hit < 0 || hit >= best) return null;
      return { distance: hit, zone: 'torso', point: new THREE.Vector3().copy(origin).addScaledVector(direction, hit) };
    }

    // The weak point: the head, for most; the heavy's is the reactor in its chest.
    const weak = this.model.weakPoint;
    if (weak.radius > 0) {
      _headCentre.copy(weak.centre).applyMatrix4(this.bones.get(weak.bone)!.matrixWorld);
      const weakHit = raySphere(origin, direction, _headCentre, weak.radius);
      if (weakHit >= 0 && weakHit < best) {
        best = weakHit;
        zone = 'head';
      }
    }
    if (weak.bone !== 'Head') {
      // Its head is plated like the rest of it: a hit there is a hit on the body.
      _a.setFromMatrixPosition(this.bones.get('Head')!.matrixWorld);
      _a.y += 0.08 * girth;
      const hit = raySphere(origin, direction, _a, 0.15 * girth);
      if (hit >= 0 && hit < best - (zone ? 0.05 : 0)) {
        best = hit;
        zone = 'torso';
      }
    }

    _a.setFromMatrixPosition(this.bones.get('Hips')!.matrixWorld);
    _b.setFromMatrixPosition(this.bones.get('Neck')!.matrixWorld);
    const torsoHit = rayCapsule(origin, direction, _a, _b, 0.2 * girth);
    // The head wins a near-tie so shots at the neckline count as weak-point hits.
    if (torsoHit >= 0 && torsoHit < best - (zone === 'head' ? 0.08 : 0)) {
      best = torsoHit;
      zone = 'torso';
    }

    for (const [from, to, radius] of LIMBS) {
      _a.setFromMatrixPosition(this.bones.get(from)!.matrixWorld);
      _b.setFromMatrixPosition(this.bones.get(to)!.matrixWorld);
      const hit = rayCapsule(origin, direction, _a, _b, radius * girth);
      if (hit >= 0 && hit < best - (zone ? 0.05 : 0)) {
        best = hit;
        zone = 'limb';
      }
    }
    if (!zone) return null;
    return { distance: best, zone, point: new THREE.Vector3().copy(origin).addScaledVector(direction, best) };
  }

  /** Apply damage from a shot travelling along `direction`. */
  damage(amount: number, direction: THREE.Vector3): { killed: boolean; staggered: boolean } {
    const result = damageRobot(this.mind, this.spec, amount);
    // Which way the shot pushes the robot, in its own frame.
    const forward = direction.x * Math.sin(this.heading) + direction.z * Math.cos(this.heading);
    const side = direction.x * Math.cos(this.heading) - direction.z * Math.sin(this.heading);

    if (result.killed) {
      this.killImpulse.copy(direction).multiplyScalar(1.6);
      this.collapse = 0;
      // Shot from the front: fall backward. From behind: pitch forward.
      const clip: ClipName = forward < 0 ? 'deathBack' : 'deathFront';
      this.play(clip, 0.06, true);
      this.actions.get(clip)!.timeScale = 1.5;
    } else {
      this.flinchLean += clamp(forward * 0.5, -0.5, 0.5) * (result.staggered ? 1.4 : 1);
      this.flinchTwist += clamp(side * 0.35, -0.35, 0.35);
      if (result.staggered) {
        this.play('hit', 0.08, true);
        this.actions.get('hit')!.timeScale = 1.6;
      }
    }
    return { killed: result.killed, staggered: result.staggered };
  }

  /** Detach from the scene and free what this copy owns. */
  dispose(): void {
    this.removed = true;
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    this.eyeMaterial.dispose();
    this.glow.material.dispose();
    this.shield?.dispose();
  }

  private play(name: ClipName, fade: number, restart = false): void {
    if (this.current === name && !restart) return;
    const next = this.actions.get(name)!;
    const previous = this.actions.get(this.current)!;
    if (restart) next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (previous !== next) {
      next.play();
      previous.crossFadeTo(next, fade, false);
    } else {
      next.play();
    }
    this.current = name;
  }

  private setEyes(level: number): void {
    const l = Math.max(0, level);
    // Far above 1 so the visor blooms.
    this.eyeMaterial.color.copy(this.eyeColor).multiplyScalar(11 * l);
    this.glow.material.color.copy(this.eyeColor).multiplyScalar(0.9 * l);
  }
}
