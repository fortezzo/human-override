// Grenades in the air: thrown from the hand, falling, bouncing off the
// floor and the walls, and going off when the fuse runs out. What the blast
// does is the game's business; this moves them and says where and when.

import * as THREE from 'three';
import { GRENADE, PLAYER } from '../config';
import { resolveCircle, type CircleBody, type Collider } from '../sim/collision';

const RADIUS = 0.07;

interface Flying {
  object: THREE.Group;
  lamp: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  fuse: number;
}

export class GrenadeSet {
  readonly group = new THREE.Group();
  /** One bounced, at this speed (for its sound). */
  onBounce: (position: THREE.Vector3, speed: number) => void = () => {};

  private readonly flying: Flying[] = [];
  private readonly body: CircleBody = { x: 0, z: 0, radius: RADIUS, feet: 0, head: RADIUS * 2 };
  private readonly shell = new THREE.MeshStandardMaterial({ color: 0x23272b, metalness: 0.8, roughness: 0.5 });
  private readonly geometry = new THREE.SphereGeometry(RADIUS, 12, 8);
  private readonly band = new THREE.CylinderGeometry(RADIUS * 1.03, RADIUS * 1.03, 0.022, 12);

  constructor() {
    this.group.name = 'grenades';
  }

  get count(): number {
    return this.flying.length;
  }

  /** Throw one from `origin` along `direction` (a unit vector), carrying the thrower's own motion with it. */
  throw(origin: THREE.Vector3, direction: THREE.Vector3, carried: THREE.Vector3): void {
    const lamp = new THREE.MeshBasicMaterial({ color: 0xff3a1a, toneMapped: false, fog: false });
    const object = new THREE.Group();
    const ball = new THREE.Mesh(this.geometry, this.shell);
    ball.castShadow = true;
    object.add(ball, new THREE.Mesh(this.band, lamp));
    object.position.copy(origin).addScaledVector(direction, 0.35);
    object.position.y = Math.max(RADIUS, object.position.y - 0.12);
    this.group.add(object);
    const velocity = direction.clone().multiplyScalar(GRENADE.throwSpeed).addScaledVector(carried, 0.6);
    // A little lift, so that one thrown level still carries.
    velocity.y += 2.4;
    this.flying.push({ object, lamp, velocity, fuse: GRENADE.fuse });
  }

  /** Move them. Returns where each one that went off this update was. */
  update(dt: number, time: number, colliders: readonly Collider[]): THREE.Vector3[] {
    const burst: THREE.Vector3[] = [];
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const grenade = this.flying[i]!;
      const p = grenade.object.position;
      const v = grenade.velocity;
      grenade.fuse -= dt;
      if (grenade.fuse <= 0) {
        burst.push(p.clone());
        grenade.object.removeFromParent();
        grenade.lamp.dispose();
        this.flying.splice(i, 1);
        continue;
      }
      v.y -= PLAYER.gravity * dt;
      p.addScaledVector(v, dt);
      // The floor.
      if (p.y < RADIUS) {
        p.y = RADIUS;
        if (v.y < -1.2) this.onBounce(p, -v.y);
        v.y = Math.abs(v.y) * GRENADE.bounce;
        if (v.y < 0.9) v.y = 0;
        v.x *= 0.72;
        v.z *= 0.72;
      }
      // Walls and anything else solid: pushed out, and sent back the way it was pushed.
      const body = this.body;
      body.x = p.x;
      body.z = p.z;
      body.feet = p.y - RADIUS;
      body.head = p.y + RADIUS;
      if (resolveCircle(body, colliders, 0)) {
        const nx = body.x - p.x;
        const nz = body.z - p.z;
        const length = Math.hypot(nx, nz);
        if (length > 1e-5) {
          const dot = (v.x * nx + v.z * nz) / length;
          if (dot < 0) {
            v.x -= ((1 + GRENADE.bounce) * dot * nx) / length;
            v.z -= ((1 + GRENADE.bounce) * dot * nz) / length;
            if (-dot > 2) this.onBounce(p, -dot);
          }
        }
        p.x = body.x;
        p.z = body.z;
      }
      grenade.object.rotation.x += v.z * dt * 6;
      grenade.object.rotation.z -= v.x * dt * 6;
      // Its lamp beats faster as the fuse runs down.
      const through = 1 - grenade.fuse / GRENADE.fuse;
      grenade.lamp.color.setRGB(Math.sin(time * (18 + through * 60)) > 0 ? 9 : 0.6, 0.5, 0.2);
    }
    return burst;
  }

  clear(): void {
    for (const grenade of this.flying) {
      grenade.object.removeFromParent();
      grenade.lamp.dispose();
    }
    this.flying.length = 0;
  }
}
