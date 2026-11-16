// A sliding door between two areas.
//
// Each door is built from the same kit as the rooms, but kept as its own
// moving pieces instead of being fused into the level: one or two leaves
// that slide into the wall, the fixed frame they slide in, a solid box that
// blocks the doorway while it is shut, and a small status lamp on each side.

import * as THREE from 'three';
import { DOORS } from '../config';
import type { Assets } from '../core/assets';
import { smoothstep } from '../core/math';
import type { MaterialLibrary } from '../render/materials';
import { makeCollider, type Collider } from '../sim/collision';
import { LevelBuilder } from './build/LevelBuilder';
import { DOOR_FRAMES } from './doorFrames';
import type { DoorPlan, Rect } from './plan';
import { WALL } from './plan';

type Vec3 = THREE.Vector3Tuple;

/** Thickness of a door leaf. */
const LEAF = 0.2;

interface Leaf {
  group: THREE.Group;
  /** How far, and which way, it slides to open. */
  slide: THREE.Vector3;
}

export class Door {
  readonly group = new THREE.Group();
  /** Meshes that stop bullets. */
  readonly solids: THREE.Mesh[] = [];
  /** Blocks the doorway while the door is shut. */
  readonly collider: Collider;
  /** The frame's own solid parts, which never move. */
  readonly frame: Collider[];
  /** The doorway's footprint, for path-finding and for finding the door. */
  readonly rect: Rect;
  /** Middle of the doorway at chest height. */
  readonly centre: THREE.Vector3;

  /** The door has been opened (it may still be sliding). */
  open = false;
  /** 0 = shut, 1 = fully open. */
  progress = 0;

  private readonly leaves: Leaf[] = [];
  private readonly lamp: THREE.MeshStandardMaterial;

  constructor(
    readonly plan: DoorPlan,
    assets: Assets,
    materials: MaterialLibrary,
  ) {
    const { along, at, from, to, top } = plan;
    const mid = (from + to) / 2;
    // Boxes are described in the wall's own frame: u along the wall, v up, w through it.
    const box = (u0: number, v0: number, w0: number, u1: number, v1: number, w1: number): [Vec3, Vec3] =>
      along === 'x' ? [[u0, v0, at + w0], [u1, v1, at + w1]] : [[at + w0, v0, u0], [at + w1, v1, u1]];
    const axis = along === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);

    this.rect = along === 'x' ? [from, at - WALL / 2, to, at + WALL / 2] : [at - WALL / 2, from, at + WALL / 2, to];
    this.centre = along === 'x' ? new THREE.Vector3(mid, 1.3, at) : new THREE.Vector3(at, 1.3, mid);
    this.collider = along === 'x' ? makeCollider(mid, at, (to - from) / 2, LEAF / 2 + 0.03, 0, 0, top) : makeCollider(at, mid, LEAF / 2 + 0.03, (to - from) / 2, 0, 0, top);

    const h = LEAF / 2;
    /** One sliding leaf covering u0..u1, dressed on both faces. */
    type Put = (key: Parameters<LevelBuilder['box']>[0], u0: number, v0: number, w0: number, u1: number, v1: number, w1: number, cast?: boolean) => void;
    const leaf = (u0: number, u1: number, slide: number, heavy: boolean, extra?: (put: Put) => void) => {
      const b = new LevelBuilder(assets, materials);
      const put: Put = (key, u0_, v0, w0, u1_, v1, w1, cast = false) => {
        const [min, max] = box(u0_, v0, w0, u1_, v1, w1);
        b.box(key, min, max, { collide: false, cast });
      };
      extra?.(put);
      put(heavy ? 'steelPlate' : 'paintedMetal', u0, 0, -h, u1, top, h, true);
      for (const side of [-1, 1]) {
        const face = side * h;
        const out = side * (h + 0.012);
        const far = side * (h + 0.05);
        const w = (a: number, c: number): [number, number] => (a < c ? [a, c] : [c, a]);
        const [f0, f1] = w(face, out);
        const [r0, r1] = w(face, far);
        if (heavy) {
          // Hazard band along the foot and stiffening ribs across the leaf.
          put('hazard', u0, 0, f0, u1, 0.34, f1);
          for (const y of [1.0, 1.95, Math.min(2.75, top - 0.3)]) put('darkSteel', u0 + 0.06, y, r0, u1 - 0.06, y + 0.09, r1);
        } else {
          put('hazard', u0, 0.9, f0, u1, 1.2, f1);
          put('darkSteel', u0, 0, r0, u1, 0.28, r1);
          // A recessed pull and a small vision slot.
          put('darkSteel', u0 + 0.14, 1.0, r0, u0 + 0.42, 1.1, r1);
          put('darkSteel', (u0 + u1) / 2 - 0.2, 1.55, f0, (u0 + u1) / 2 + 0.2, 1.85, f1);
        }
      }
      const built = b.build();
      this.group.add(built.group);
      this.solids.push(...built.solids);
      // Leaves move, so their matrices must be allowed to update.
      built.group.traverse((o) => (o.matrixAutoUpdate = true));
      this.leaves.push({ group: built.group, slide: axis.clone().multiplyScalar(slide) });
    };

    const width = to - from;
    if (plan.id === 'lobbyHall' || plan.id === 'hallCore' || plan.id === 'lobbyDock' || plan.id === 'hallDock') {
      // Two heavy leaves that part in the middle. The first carries a seal
      // set back in the gap between them, so the seam reads as a dark
      // groove and nothing can be seen through it.
      leaf(from, mid - 0.012, -(width / 2 - 0.04), true, (put) => put('darkSteel', mid - 0.012, 0, -h + 0.025, mid + 0.012, top, h - 0.025));
      leaf(mid + 0.012, to, width / 2 - 0.04, true);
    } else {
      leaf(from, to, (plan.slides ?? 1) * (width - 0.05), false);
    }

    // The fixed frame the leaves slide in (see doorFrames.ts for why it is
    // the door's and not either room's).
    const frame = new LevelBuilder(assets, materials);
    DOOR_FRAMES[plan.id](frame);
    const fixed = frame.build();
    this.group.add(fixed.group);
    this.solids.push(...fixed.solids);
    this.frame = fixed.colliders;

    // Status lamps: a small box beside the doorway on each side, red while shut.
    this.lamp = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2a12, emissiveIntensity: 3, roughness: 0.4 });
    const lampGeometry = new THREE.BoxGeometry(0.07, 0.07, 0.03);
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(lampGeometry, this.lamp);
      const u = to + 0.32;
      const w = side * (WALL / 2 + 0.05);
      if (along === 'x') lamp.position.set(u, 1.5, at + w);
      else {
        lamp.position.set(at + w, 1.5, u);
        lamp.rotation.y = Math.PI / 2;
      }
      this.group.add(lamp);
    }
    this.group.name = `door-${plan.id}`;
  }

  /** Begin sliding open. */
  unlock(): void {
    this.open = true;
    this.lamp.emissive.set(0x35ff6a);
  }

  /** Shut again at once (a new run). */
  reset(): void {
    this.open = false;
    this.progress = 0;
    this.lamp.emissive.set(0xff2a12);
    this.place();
  }

  /**
   * Stand the leaves where they would be this far through the slide, without
   * opening or shutting the door (for checks that need to look at the map
   * with every door shut, or every door open). Call `settle` afterwards.
   */
  pose(progress: number): void {
    const actual = this.progress;
    this.progress = progress;
    this.place();
    this.progress = actual;
  }

  /** Put the leaves back where the door really is, after `pose`. */
  settle(): void {
    this.place();
  }

  /** True once the gap is wide enough to walk through. */
  get passable(): boolean {
    return this.progress > 0.5;
  }

  /** Advance the slide. Returns true on the update when it becomes passable. */
  update(dt: number): boolean {
    if (!this.open || this.progress >= 1) return false;
    const before = this.passable;
    this.progress = Math.min(1, this.progress + dt / DOORS.openTime);
    this.place();
    return !before && this.passable;
  }

  private place(): void {
    // Heavy doors start slowly and settle: ease in and out.
    const eased = smoothstep(0, 1, this.progress);
    for (const leaf of this.leaves) {
      leaf.group.position.copy(leaf.slide).multiplyScalar(eased);
      leaf.group.updateMatrixWorld(true);
    }
  }
}
