// The scrap a destroyed robot leaves behind.
//
// When a robot is destroyed its body is swapped for rigid chunks (head,
// torso, limbs) that start exactly where the animated parts were and are
// then thrown apart with simple physics: gravity, bouncing off the floor,
// and being pushed out of walls. Old chunks shrink away to keep the count
// bounded.

import * as THREE from 'three';
import { FX } from '../../config';
import { rand } from '../../core/math';
import { resolveCircle, type CircleBody, type Collider } from '../../sim/collision';
import type { RobotModel } from './RobotModel';

interface Gib {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  radius: number;
  age: number;
  resting: boolean;
  active: boolean;
}

const _body: CircleBody = { x: 0, z: 0, radius: 0.12, feet: 0, head: 0.3 };
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _spin = new THREE.Quaternion();
const _axis = new THREE.Vector3();

export class Gibs {
  readonly group = new THREE.Group();
  private readonly pool: Gib[] = [];
  private next = 0;
  /** Called when a chunk hits the floor hard, for a clang. */
  onImpact: (position: THREE.Vector3, speed: number) => void = () => {};

  constructor(private readonly model: RobotModel) {
    this.group.name = 'gibs';
    for (let i = 0; i < FX.maxGibs; i++) {
      const mesh = new THREE.Mesh(model.gibs[0]!.geometry, model.gibMaterial);
      mesh.visible = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.pool.push({ mesh, velocity: new THREE.Vector3(), spin: new THREE.Vector3(), radius: 0.1, age: 0, resting: true, active: false });
    }
  }

  /**
   * Replace a robot with its chunks.
   * @param bones the robot's bones, in their current animated pose
   * @param centre roughly the middle of the body
   * @param impulse direction and strength of the killing shot
   */
  burst(bones: Map<string, THREE.Bone>, centre: THREE.Vector3, impulse: THREE.Vector3): void {
    for (const part of this.model.gibs) {
      const bone = bones.get(part.bone);
      if (!bone) continue;
      const gib = this.pool[this.next]!;
      this.next = (this.next + 1) % this.pool.length;

      bone.matrixWorld.decompose(_position, _quaternion, _scale);
      gib.mesh.geometry = part.geometry;
      gib.mesh.position.copy(_position);
      gib.mesh.quaternion.copy(_quaternion);
      gib.mesh.scale.copy(_scale);
      gib.mesh.visible = true;

      // Thrown outward from the body's middle, up, and along the shot.
      gib.velocity.copy(_position).sub(centre);
      gib.velocity.y *= 0.4;
      gib.velocity.normalize().multiplyScalar(rand(0.8, 2.6));
      gib.velocity.y += rand(1.2, 3.4);
      gib.velocity.addScaledVector(impulse, rand(0.5, 1.2));
      gib.spin.set(rand(-7, 7), rand(-7, 7), rand(-7, 7));
      gib.radius = part.radius;
      gib.age = 0;
      gib.resting = false;
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
      if (remaining < 0.8) gib.mesh.scale.setScalar(Math.max(0.001, remaining / 0.8));
      if (gib.resting) continue;

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
        if (speed > 1.2) {
          this.onImpact(p, speed);
          gib.velocity.y = speed * 0.32;
          gib.velocity.x *= 0.62;
          gib.velocity.z *= 0.62;
          gib.spin.multiplyScalar(0.55);
        } else {
          gib.velocity.y = 0;
          gib.velocity.x *= 1 - Math.min(1, 6 * dt);
          gib.velocity.z *= 1 - Math.min(1, 6 * dt);
          gib.spin.multiplyScalar(1 - Math.min(1, 8 * dt));
          if (gib.velocity.lengthSq() < 0.02) gib.resting = true;
        }
      }
    }
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
