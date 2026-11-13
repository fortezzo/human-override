// One robot: a copy of the shared model with its own skeleton, driven by
// the decisions in sim/robotMind.ts. This file is the "body": it moves,
// turns, plays animations, glows, and reports what a bullet hit.

import * as THREE from 'three';
import { ROBOT } from '../../config';
import { angleDelta, clamp, damp, rand } from '../../core/math';
import { resolveCircle, type CircleBody, type Collider } from '../../sim/collision';
import { nextWaypoint, type NavGrid } from '../../sim/navGrid';
import { rayCapsule, raySphere } from '../../sim/rayShapes';
import { createRobotMind, damageRobot, moveFactor, thinkRobot, type HitZone, type RobotMind } from '../../sim/robotMind';
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
}

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
  readonly mind: RobotMind = createRobotMind(ROBOT);
  readonly bones = new Map<string, THREE.Bone>();
  /** Direction and force of the shot that destroyed it. */
  readonly killImpulse = new THREE.Vector3();
  /** Set once the robot has been removed from play. */
  removed = false;
  /** Stand still and idle (used on the start screen). */
  hold = false;

  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<ClipName, THREE.AnimationAction>();
  private current: ClipName = 'idle';
  private readonly eyeMaterial: THREE.MeshBasicMaterial;
  private readonly glow: THREE.Sprite;
  private readonly eyeColor = new THREE.Color(ROBOT.eyeColor);
  /** The bones the hunch is applied to, paired with their extra rotation. */
  private readonly posture: Array<{ bone: THREE.Bone; rotation: THREE.Quaternion }>;

  private heading = 0;
  private speed = 0;
  private stride = 0;
  private lastHalfStride = 0;
  private collapse = 0;
  // Procedural flinch: a quick lean away from the shot.
  private flinchLean = 0;
  private flinchTwist = 0;
  private time = rand(0, 10);
  private readonly body: CircleBody = { x: 0, z: 0, radius: ROBOT.radius, feet: 0, head: 1.8 };

  constructor(
    private readonly model: RobotModel,
    x: number,
    z: number,
    heading: number,
  ) {
    this.root = model.instantiate();
    this.root.position.set(x, 0, z);
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

    this.posture = model.posture.map(({ bone, rotation }) => ({ bone: this.bones.get(bone)!, rotation }));

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
    this.bones.get('Head')!.add(this.glow);
    this.setEyes(1);
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  get alive(): boolean {
    return this.mind.state !== 'dead';
  }

  /** Roughly the middle of the chest, for effects. */
  chest(out: THREE.Vector3): THREE.Vector3 {
    return out.setFromMatrixPosition(this.bones.get('Spine1')!.matrixWorld);
  }

  update(dt: number, target: THREE.Vector3, targetAlive: boolean, grid: NavGrid, colliders: readonly Collider[]): RobotEventsOut {
    this.time += dt;
    const out: RobotEventsOut = { hitPlayer: 0, attackStarted: false, footstep: false, breakApart: false };
    const p = this.root.position;
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const distance = Math.hypot(dx, dz);

    if (this.hold && this.alive) {
      this.play('idle', 0.3);
      this.setEyes(0.85 + 0.15 * Math.sin(this.time * 3));
      this.mixer.update(dt);
      this.applyPosture();
      this.root.updateMatrixWorld(true);
      return out;
    }

    if (this.mind.state === 'dead') {
      // Collapsing: the death animation plays briefly, eyes guttering.
      this.collapse += dt;
      this.setEyes(Math.random() < 0.5 ? 0.15 : 1 - this.collapse / COLLAPSE_TIME);
      if (this.collapse >= COLLAPSE_TIME) out.breakApart = true;
    } else {
      const events = thinkRobot(this.mind, ROBOT, dt, distance, targetAlive);
      out.hitPlayer = events.hit;
      out.attackStarted = events.attackStarted;
      if (events.attackStarted) this.play('attack', 0.12, true);

      // Decide where to face and how fast to go.
      let wantX = dx;
      let wantZ = dz;
      let wantSpeed = 0;
      if (this.mind.state === 'chase') {
        if (distance > ROBOT.attackRange * 0.85) {
          const waypoint = distance > 2.2 ? nextWaypoint(grid, p.x, p.z) : null;
          if (waypoint) {
            wantX = waypoint.x - p.x;
            wantZ = waypoint.z - p.z;
          }
          wantSpeed = ROBOT.walkSpeed * moveFactor(this.mind);
        }
        this.play(wantSpeed > 0.05 || this.speed > 0.2 ? 'walk' : 'idle', 0.25);
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
      this.body.x = p.x;
      this.body.z = p.z;
      resolveCircle(this.body, colliders, 0.3);
      p.x = this.body.x;
      p.z = this.body.z;
      this.root.rotation.y = this.heading;

      // Match the walk cycle to ground speed so the feet do not slide.
      const walk = this.actions.get('walk')!;
      walk.timeScale = clamp(this.speed / ROBOT.walkAnimSpeedAt, 0.6, 3.2);
      this.stride += this.speed * dt;
      const half = Math.floor(this.stride / 0.42);
      if (half !== this.lastHalfStride) {
        this.lastHalfStride = half;
        out.footstep = true;
      }
      this.setEyes(0.9 + 0.1 * Math.sin(this.time * 9));
    }

    this.mixer.update(dt);
    this.applyPosture();

    // Layer the flinch on top of whatever animation is playing.
    this.flinchLean = damp(this.flinchLean, 0, 9, dt);
    this.flinchTwist = damp(this.flinchTwist, 0, 9, dt);
    if (Math.abs(this.flinchLean) > 0.002 || Math.abs(this.flinchTwist) > 0.002) {
      const spine = this.bones.get('Spine1')!;
      const neck = this.bones.get('Neck')!;
      spine.rotation.x += this.flinchLean;
      spine.rotation.y += this.flinchTwist;
      neck.rotation.x += this.flinchLean * 0.8;
    }
    this.root.updateMatrixWorld(true);
    return out;
  }

  /**
   * The animations were recorded for an upright figure. This adds the
   * design's hunch on top of whatever pose the animation just set. (The
   * animation overwrites these bones every frame, so it never accumulates.)
   */
  private applyPosture(): void {
    for (const { bone, rotation } of this.posture) bone.quaternion.multiply(rotation);
  }

  /**
   * Test a bullet against the robot's hit shapes.
   * `direction` must be a unit vector.
   */
  hitTest(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): RobotHit | null {
    if (!this.alive) return null;
    // Cheap rejection: is the ray anywhere near the robot at all?
    const p = this.root.position;
    _a.set(p.x, 0.9, p.z);
    if (raySphere(origin, direction, _a, 1.3) < 0) return null;

    let best = maxDistance;
    let zone: HitZone | null = null;

    const head = this.bones.get('Head')!;
    _headCentre.copy(this.model.weakPoint.centre).applyMatrix4(head.matrixWorld);
    const headHit = raySphere(origin, direction, _headCentre, this.model.weakPoint.radius);
    if (headHit >= 0 && headHit < best) {
      best = headHit;
      zone = 'head';
    }

    _a.setFromMatrixPosition(this.bones.get('Hips')!.matrixWorld);
    _b.setFromMatrixPosition(this.bones.get('Neck')!.matrixWorld);
    const torsoHit = rayCapsule(origin, direction, _a, _b, 0.2);
    // The head wins a near-tie so shots at the neckline count as weak-point hits.
    if (torsoHit >= 0 && torsoHit < best - (zone === 'head' ? 0.08 : 0)) {
      best = torsoHit;
      zone = 'torso';
    }

    for (const [from, to, radius] of LIMBS) {
      _a.setFromMatrixPosition(this.bones.get(from)!.matrixWorld);
      _b.setFromMatrixPosition(this.bones.get(to)!.matrixWorld);
      const hit = rayCapsule(origin, direction, _a, _b, radius);
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
    const result = damageRobot(this.mind, ROBOT, amount);
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
