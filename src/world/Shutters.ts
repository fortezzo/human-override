// The roller shutters over the five openings robots walk in through.
//
// Each one is the same downloaded shutter, stretched to fit its opening.
// Down, it fills the opening and is solid: robots outside have to batter
// it until it is forced. Forced, it is jammed part-way up and crooked, as
// the facility's shutters always were, and anything can walk in under it.
// The player can run one back down from indoors (see sim/shutters.ts for
// the rules; this file is what is seen, and what is solid).

import * as THREE from 'three';
import { SHUTTERS } from '../config';
import type { Assets } from '../core/assets';
import { damp } from '../core/math';
import { makeCollider, type Collider } from '../sim/collision';
import { createShutter, isShut, type Shutter } from '../sim/shutters';
import { SHUTTER_PLANS, type AreaId, type ShutterPlan } from './plan';

/** The downloaded shutter is this wide and this tall before it is stretched. */
const PROP = { width: 1.08, height: 2.4 };

export class ShutterGate {
  readonly state: Shutter;
  /** What is in the way while it is down. */
  readonly collider: Collider;
  readonly object = new THREE.Group();
  /** Its meshes: they stop bullets wherever the shutter happens to be. */
  readonly solids: THREE.Mesh[] = [];
  /** The middle of the opening, on the floor. */
  readonly centre = new THREE.Vector3();

  /** How far up it is, 0 (down) to 1 (forced), and how hard it is still shaking from the last blow. */
  private lift = 0;
  private shake = 0;
  private time = 0;

  constructor(
    readonly plan: ShutterPlan,
    assets: Assets,
  ) {
    this.state = createShutter(plan.id, SHUTTERS);
    const mid = (plan.from + plan.to) / 2;
    const half = (plan.to - plan.from) / 2;
    if (plan.along === 'x') {
      this.centre.set(mid, 0, plan.at);
      this.collider = makeCollider(mid, plan.at + 0.15, half, 0.17, 0, 0, plan.top);
    } else {
      this.centre.set(plan.at, 0, mid);
      this.collider = makeCollider(plan.at + 0.15, mid, 0.17, half, 0, 0, plan.top);
    }

    const curtain = assets.prop('rollershutter_door').scene.clone(true);
    curtain.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.kind = 'metal';
      // (Its own copy of the paint, a shade darker: down, it fills the opening, and as it came it was the brightest thing in the room.)
      const paint = (mesh.material as THREE.MeshStandardMaterial).clone();
      paint.color.multiplyScalar(0.62);
      mesh.material = paint;
      this.solids.push(mesh);
    });
    // Stretched to span the opening and to reach from its head to the floor.
    curtain.scale.set((plan.to - plan.from + 0.2) / PROP.width, (plan.top + 0.06) / PROP.height, 1);
    this.object.add(curtain);
    this.object.name = `shutter-${plan.id}`;
    // The download faces along +Z: turned so that it lies in its own wall.
    if (plan.along === 'x') this.object.position.set(mid, 0, plan.at);
    else {
      this.object.position.set(plan.at, 0, mid);
      this.object.rotation.y = Math.PI / 2;
    }
    this.object.rotation.order = 'YXZ';
    this.place();
  }

  get shut(): boolean {
    return isShut(this.state);
  }

  /** How far a point is on the indoor side of it (negative: outdoors), and how far along the wall from the middle of the opening. */
  where(x: number, z: number): { inside: number; along: number } {
    const { plan } = this;
    const across = plan.along === 'x' ? z - plan.at : x - plan.at;
    const along = (plan.along === 'x' ? x : z) - (plan.from + plan.to) / 2;
    return { inside: across * plan.inward, along };
  }

  /** The point of the shutter nearest to (x, z), set `out` metres to its outdoor side. */
  nearest(x: number, z: number, out: number, target: THREE.Vector3): THREE.Vector3 {
    const { plan } = this;
    const along = Math.min(plan.to - 0.35, Math.max(plan.from + 0.35, plan.along === 'x' ? x : z));
    // (The curtain is 0.3 thick, from `at` toward +X or +Z: measure from whichever of its faces is the outdoor one.)
    const face = plan.inward === 1 ? plan.at : plan.at + 0.3;
    const across = face - plan.inward * out;
    return plan.along === 'x' ? target.set(along, 0, across) : target.set(across, 0, along);
  }

  /** A blow has just landed on it. */
  jolt(): void {
    this.shake = 1;
  }

  /** Put it where its state says at once (a new run, the title screen). */
  snap(): void {
    this.lift = this.shut ? 0 : 1;
    this.shake = 0;
    this.place();
    // (So that anything that looks for it before the next frame is drawn finds it where it now is.)
    this.object.updateMatrixWorld(true);
  }

  update(dt: number): void {
    this.time += dt;
    const target = this.shut ? 0 : 1;
    if (this.lift !== target) {
      const step = dt / (target === 1 ? SHUTTERS.raiseTime : SHUTTERS.lowerTime);
      this.lift = target === 1 ? Math.min(1, this.lift + step) : Math.max(0, this.lift - step);
    }
    this.shake = damp(this.shake, 0, 7, dt);
    this.place();
  }

  private place(): void {
    const { plan } = this;
    // (Eased, so that it is wrenched up fast and stops hard.)
    const eased = 1 - (1 - this.lift) * (1 - this.lift);
    // A battered shutter sags out of true before it gives.
    const worn = this.shut ? 1 - this.state.strength / SHUTTERS.strength : 0;
    const rattle = this.shake * Math.sin(this.time * 46);
    this.object.position.y = plan.raised * eased;
    this.object.rotation.z = plan.crooked * eased + worn * 0.012 + rattle * 0.012;
    this.object.rotation.x = -(worn * 0.02 + this.shake * 0.03 + rattle * 0.012) * plan.inward * (plan.along === 'x' ? 1 : -1);
  }
}

export class ShutterSet {
  readonly gates: ShutterGate[] = [];
  /** Each gate's part of the picture, to be drawn with its area. */
  readonly groups: Record<AreaId, THREE.Group> = { lobby: new THREE.Group(), hall: new THREE.Group(), power: new THREE.Group(), core: new THREE.Group(), dock: new THREE.Group(), lab: new THREE.Group() };

  constructor(assets: Assets) {
    for (const plan of SHUTTER_PLANS) {
      const gate = new ShutterGate(plan, assets);
      this.gates.push(gate);
      this.groups[plan.area].add(gate.object);
    }
  }

  gate(id: string): ShutterGate | undefined {
    return this.gates.find((gate) => gate.plan.id === id);
  }

  /** What is solid because of them right now. */
  get colliders(): Collider[] {
    return this.gates.filter((gate) => gate.shut).map((gate) => gate.collider);
  }

  /**
   * The shut shutter that a robot at (x, z) has to get through: one it is
   * outside of, close to, and more or less in front of. Null if there is
   * none (it is indoors, or the shutter ahead of it has been forced).
   */
  blocking(x: number, z: number): ShutterGate | null {
    for (const gate of this.gates) {
      if (!gate.shut) continue;
      const { inside, along } = gate.where(x, z);
      const half = (gate.plan.to - gate.plan.from) / 2;
      if (inside < 0.25 && inside > -3.2 && Math.abs(along) < half + 0.9) return gate;
    }
    return null;
  }

  /** Is (x, z) outdoors behind a shutter that is down: somewhere nobody indoors can walk to for now? */
  shutOut(x: number, z: number): boolean {
    for (const gate of this.gates) {
      if (!gate.shut) continue;
      const { inside, along } = gate.where(x, z);
      if (inside < 0.2 && inside > -16 && Math.abs(along) < (gate.plan.to - gate.plan.from) / 2 + 5) return true;
    }
    return false;
  }

  /** Every shutter down (a new run): sound, but for the main entrance, which has been at it already. */
  reset(): void {
    for (const gate of this.gates) {
      gate.state.strength = gate.plan.id === 'yard' ? SHUTTERS.entranceStart : SHUTTERS.strength;
      gate.snap();
    }
  }

  update(dt: number): void {
    for (const gate of this.gates) gate.update(dt);
  }
}
