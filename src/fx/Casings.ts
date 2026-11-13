// Spent brass flung out of the rifle.
//
// A fixed pool of small cylinders with toy physics: they fly, spin, bounce
// off the floor a couple of times with a tink, then come to rest and are
// recycled when the pool wraps around.

import * as THREE from 'three';
import { FX } from '../config';

interface Casing {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  spin: THREE.Vector3;
  resting: boolean;
  bounces: number;
}

export class Casings {
  readonly mesh: THREE.InstancedMesh;
  private readonly casings: Casing[] = [];
  private next = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  /** Called when a casing strikes the floor, with its position and speed. */
  onBounce: (position: THREE.Vector3, speed: number) => void = () => {};

  constructor() {
    const geometry = new THREE.CylinderGeometry(0.0055, 0.0062, 0.034, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 1, roughness: 0.32, envMapIntensity: 1.6 });
    this.mesh = new THREE.InstancedMesh(geometry, material, FX.maxCasings);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.name = 'casings';
    for (let i = 0; i < FX.maxCasings; i++) {
      this.casings.push({ position: new THREE.Vector3(0, -10, 0), velocity: new THREE.Vector3(), rotation: new THREE.Euler(), spin: new THREE.Vector3(), resting: true, bounces: 0 });
    }
  }

  eject(position: THREE.Vector3, velocity: THREE.Vector3): void {
    const casing = this.casings[this.next]!;
    this.next = (this.next + 1) % this.casings.length;
    this.mesh.count = Math.min(this.casings.length, this.mesh.count + 1);
    casing.position.copy(position);
    casing.velocity.copy(velocity);
    casing.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    casing.spin.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
    casing.resting = false;
    casing.bounces = 0;
  }

  update(dt: number): void {
    let moved = false;
    for (let i = 0; i < this.mesh.count; i++) {
      const casing = this.casings[i]!;
      if (casing.resting) continue;
      moved = true;
      casing.velocity.y -= 9.8 * dt;
      casing.position.addScaledVector(casing.velocity, dt);
      casing.rotation.x += casing.spin.x * dt;
      casing.rotation.y += casing.spin.y * dt;
      casing.rotation.z += casing.spin.z * dt;

      if (casing.position.y < 0.007 && casing.velocity.y < 0) {
        casing.position.y = 0.007;
        const speed = -casing.velocity.y;
        if (speed > 0.6 && casing.bounces < 3) {
          this.onBounce(casing.position, speed);
          casing.velocity.y = speed * 0.36;
          casing.velocity.x *= 0.55;
          casing.velocity.z *= 0.55;
          casing.spin.multiplyScalar(0.6);
          casing.bounces++;
        } else {
          // Settle lying flat on its side.
          casing.resting = true;
          casing.rotation.set(Math.PI / 2, 0, casing.rotation.z);
        }
      }
      this.quaternion.setFromEuler(casing.rotation);
      this.matrix.compose(casing.position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    if (moved) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.mesh.count = 0;
    this.next = 0;
    for (const casing of this.casings) casing.resting = true;
  }
}
