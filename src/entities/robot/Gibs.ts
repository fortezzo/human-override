// The scrap a destroyed robot leaves behind.
//
// When a robot is destroyed its body is swapped for rigid chunks (head,
// torso, limbs) that start exactly where the animated parts were and are
// then thrown apart with simple physics: gravity, bouncing off the floor,
// and being pushed out of walls. When a chunk runs out of energy it tips
// over onto its flattest side, the way a dropped piece of metal comes to
// rest. Old chunks shrink away to keep the count bounded.

import * as THREE from 'three';
import { FX } from '../../config';
import { rand } from '../../core/math';
import { resolveCircle, type CircleBody, type Collider } from '../../sim/collision';
import type { RobotModel } from './RobotModel';

interface Gib {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  /** Size used for bouncing while it tumbles. */
  radius: number;
  /** Height of its centre once lying flat, and the direction (in its own space) that ends up vertical. */
  restHeight: number;
  thinAxis: THREE.Vector3;
  age: number;
  state: 'flying' | 'settling' | 'resting';
  settleFrom: THREE.Quaternion;
  settleTo: THREE.Quaternion;
  settleFromY: number;
  settleTime: number;
  active: boolean;
}

/** Seconds a chunk takes to tip over onto its flat side. */
const SETTLE_TIME = 0.28;

const _body: CircleBody = { x: 0, z: 0, radius: 0.12, feet: 0, head: 0.3 };
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _spin = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _up = new THREE.Vector3();

export class Gibs {
  readonly group = new THREE.Group();
  private readonly pool: Gib[] = [];
  private next = 0;
  /** Called when a chunk hits the floor hard, for a clang. */
  onImpact: (position: THREE.Vector3, speed: number) => void = () => {};

  constructor(private readonly model: RobotModel) {
    this.group.name = 'gibs';
    for (let i = 0; i < FX.maxGibs; i++) {
      const mesh = new THREE.Mesh(model.chunks[0]!.geometry, model.material);
      mesh.visible = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.pool.push({
        mesh,
        velocity: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        radius: 0.1,
        restHeight: 0.05,
        thinAxis: new THREE.Vector3(0, 1, 0),
        age: 0,
        state: 'resting',
        settleFrom: new THREE.Quaternion(),
        settleTo: new THREE.Quaternion(),
        settleFromY: 0,
        settleTime: 0,
        active: false,
      });
    }
  }

  /**
   * Replace a robot with its chunks.
   * @param bones the robot's bones, in their current animated pose
   * @param centre roughly the middle of the body
   * @param impulse direction and strength of the killing shot
   */
  burst(bones: Map<string, THREE.Bone>, centre: THREE.Vector3, impulse: THREE.Vector3): void {
    for (const chunk of this.model.chunks) {
      const bone = bones.get(chunk.bone);
      if (!bone) continue;
      const gib = this.pool[this.next]!;
      this.next = (this.next + 1) % this.pool.length;

      bone.matrixWorld.decompose(_position, _quaternion, _scale);
      gib.mesh.geometry = chunk.geometry;
      gib.mesh.position.copy(chunk.offset).applyMatrix4(bone.matrixWorld);
      gib.mesh.quaternion.copy(_quaternion);
      gib.mesh.scale.copy(_scale);
      gib.mesh.visible = true;

      // Thrown outward from the body's middle, up, and along the shot. Kept
      // modest: the machine falls apart where it stood rather than exploding.
      gib.velocity.copy(gib.mesh.position).sub(centre);
      gib.velocity.y *= 0.4;
      gib.velocity.normalize().multiplyScalar(rand(0.5, 1.8));
      gib.velocity.y += rand(0.9, 2.4);
      gib.velocity.addScaledVector(impulse, rand(0.3, 0.75));
      gib.spin.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
      gib.radius = chunk.radius * _scale.x;
      gib.restHeight = chunk.restHeight * _scale.x;
      gib.thinAxis.copy(chunk.thinAxis);
      gib.age = 0;
      gib.state = 'flying';
      gib.active = true;
    }
  }

  update(dt: number, colliders: readonly Collider[]): void {
    for (const gib of this.pool) {
      if (!gib.active) continue;
      gib.age += dt;

      // Shrink away at the end of its life.
      const remaining = FX.gibLifetime - gib.age;
      if (remaining <= 0) {
        gib.active = false;
        gib.mesh.visible = false;
        continue;
      }
      if (remaining < 0.8) gib.mesh.scale.multiplyScalar(Math.max(0.01, 1 - dt / remaining));

      if (gib.state === 'settling') this.settle(gib, dt);
      if (gib.state === 'flying') this.fly(gib, dt, colliders);
    }
  }

  private fly(gib: Gib, dt: number, colliders: readonly Collider[]): void {
    const p = gib.mesh.position;
    gib.velocity.y -= 9.8 * dt;
    p.addScaledVector(gib.velocity, dt);

    // Tumble.
    const spinSpeed = gib.spin.length();
    if (spinSpeed > 0.01) {
      _spin.setFromAxisAngle(_axis.copy(gib.spin).divideScalar(spinSpeed), spinSpeed * dt);
      gib.mesh.quaternion.premultiply(_spin);
    }

    // Walls and props.
    _body.x = p.x;
    _body.z = p.z;
    _body.feet = p.y - gib.radius;
    _body.head = p.y + gib.radius;
    _body.radius = gib.radius;
    if (resolveCircle(_body, colliders, 0)) {
      gib.velocity.x *= -0.3;
      gib.velocity.z *= -0.3;
      p.x = _body.x;
      p.z = _body.z;
    }

    // Floor.
    if (p.y < gib.radius && gib.velocity.y < 0) {
      p.y = gib.radius;
      const speed = -gib.velocity.y;
      if (speed > 1.3) {
        this.onImpact(p, speed);
        gib.velocity.y = speed * 0.3;
        gib.velocity.x *= 0.6;
        gib.velocity.z *= 0.6;
        gib.spin.multiplyScalar(0.55);
      } else {
        // Out of energy: tip over onto whichever flat side is nearer.
        gib.velocity.y = 0;
        _up.copy(gib.thinAxis).applyQuaternion(gib.mesh.quaternion);
        _axis.set(0, _up.y >= 0 ? 1 : -1, 0);
        gib.settleFrom.copy(gib.mesh.quaternion);
        gib.settleTo.setFromUnitVectors(_up, _axis).multiply(gib.mesh.quaternion);
        gib.settleFromY = p.y;
        gib.settleTime = 0;
        gib.state = 'settling';
      }
    }
  }

  private settle(gib: Gib, dt: number): void {
    gib.settleTime += dt;
    const t = Math.min(1, gib.settleTime / SETTLE_TIME);
    const eased = t * t * (3 - 2 * t);
    const p = gib.mesh.position;
    gib.mesh.quaternion.slerpQuaternions(gib.settleFrom, gib.settleTo, eased);
    p.y = gib.settleFromY + (gib.restHeight - gib.settleFromY) * eased;
    // It keeps sliding a little as it tips.
    p.x += gib.velocity.x * dt;
    p.z += gib.velocity.z * dt;
    const drag = Math.max(0, 1 - 7 * dt);
    gib.velocity.x *= drag;
    gib.velocity.z *= drag;
    if (t >= 1) gib.state = 'resting';
  }

  get active(): number {
    let count = 0;
    for (const gib of this.pool) if (gib.active) count++;
    return count;
  }

  clear(): void {
    for (const gib of this.pool) {
      gib.active = false;
      gib.mesh.visible = false;
    }
  }
}
