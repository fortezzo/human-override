// Assembles a level from boxes, pipes, decals and prop models.
//
// Nothing is added to the scene piece by piece. Every piece is collected
// into a batch per material and merged at the end, so a room made of
// hundreds of parts renders in a few dozen draw calls. The builder also
// records a solid collision box for everything the player can bump into.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import type { DecalId, PropId } from '../../assetList';
import type { Assets } from '../../core/assets';
import type { MaterialKey, MaterialLibrary, SurfaceKind } from '../../render/materials';
import { makeCollider, type Collider } from '../../sim/collision';
import { applyWorldUvs, boxBetween, cableBetween, quadAt, toPlainGeometry, tubeBetween } from './geometry';

type Vec3 = THREE.Vector3Tuple;

interface Batch {
  material: THREE.Material;
  geometries: THREE.BufferGeometry[];
  cast: boolean;
  receive: boolean;
  kind: SurfaceKind;
  /** Decals are drawn over other surfaces and never block bullets. */
  decal: boolean;
}

export interface BoxOptions {
  /** Solid to the player and robots (default true). */
  collide?: boolean;
  /** Casts a shadow (default true). */
  cast?: boolean;
  /** Rotation about the vertical axis through the box's centre. */
  rotY?: number;
}

export interface PropOptions {
  /** Which named piece of a kit, or which group, to place. */
  part?: string;
  at: Vec3;
  rotY?: number;
  /** Full rotation, for props that are tipped over. Overrides rotY. */
  rot?: Vec3;
  scale?: number | Vec3;
  collide?: boolean;
  cast?: boolean;
  kind?: SurfaceKind;
  /**
   * Give this instance its own copy of the prop's materials (returned from
   * prop()), for example so one lamp can flicker without the others.
   */
  unique?: boolean;
}

export interface BuiltLevel {
  group: THREE.Group;
  colliders: Collider[];
  /** Meshes that stop bullets, each tagged with userData.kind. */
  solids: THREE.Mesh[];
}

export class LevelBuilder {
  private readonly batches = new Map<string, Batch>();
  private readonly colliders: Collider[] = [];
  private readonly extras: THREE.Object3D[] = [];
  private readonly decalMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private decalLayer = 0;
  private uniqueCounter = 0;

  constructor(
    private readonly assets: Assets,
    private readonly materials: MaterialLibrary,
  ) {}

  // ---------------------------------------------------------------- solids

  box(key: MaterialKey, min: Vec3, max: Vec3, options: BoxOptions = {}): void {
    const { material, tile, kind } = this.materials.get(key);
    const geometry = boxBetween(min, max);
    const cx = (min[0] + max[0]) / 2;
    const cz = (min[2] + max[2]) / 2;
    if (options.rotY) {
      // Texture the box before turning it so the pattern follows the object.
      applyWorldUvs(geometry, tile, cx * 0.37 + cz * 0.61);
      geometry.translate(-cx, 0, -cz).rotateY(options.rotY).translate(cx, 0, cz);
    } else {
      applyWorldUvs(geometry, tile);
    }
    this.add(key, material, geometry, kind, options.cast ?? true);
    if (options.collide ?? true) {
      this.colliders.push(makeCollider(cx, cz, (max[0] - min[0]) / 2, (max[2] - min[2]) / 2, -(options.rotY ?? 0), min[1], max[1]));
    }
  }

  /** A round pipe, bar or conduit. */
  tube(key: MaterialKey, from: Vec3, to: Vec3, radius: number, cast = true): void {
    const { material, tile, kind } = this.materials.get(key);
    this.add(key, material, tubeBetween(from, to, radius, tile), kind, cast);
  }

  /** A sagging cable between two points. */
  cable(key: MaterialKey, from: Vec3, to: Vec3, sag: number, radius = 0.014): void {
    const { material, tile, kind } = this.materials.get(key);
    this.add(key, material, cableBetween(from, to, sag, radius, tile), kind, false);
  }

  /** Any custom geometry (already in world space) in a library material. */
  mesh(key: MaterialKey, geometry: THREE.BufferGeometry, worldUvs = true, cast = true): void {
    const { material, tile, kind } = this.materials.get(key);
    if (worldUvs) applyWorldUvs(geometry, tile);
    this.add(key, material, geometry, kind, cast);
  }

  /** An invisible solid, for blocking off space without drawing anything. */
  blocker(min: Vec3, max: Vec3): void {
    this.colliders.push(makeCollider((min[0] + max[0]) / 2, (min[2] + max[2]) / 2, (max[0] - min[0]) / 2, (max[2] - min[2]) / 2, 0, min[1], max[1]));
  }

  // ----------------------------------------------------------------- props

  /**
   * Places a prop model. Returns the materials it used (its own copies when
   * `unique` is set), so callers can animate things like lamp glow.
   */
  prop(id: PropId, options: PropOptions): THREE.MeshStandardMaterial[] {
    const gltf = this.assets.prop(id);
    let source: THREE.Object3D = gltf.scene;
    if (options.part) {
      const part = gltf.scene.getObjectByName(options.part);
      if (!part) throw new Error(`Prop ${id} has no part "${options.part}"`);
      source = part;
    }
    // Kit pieces and groups are stored centred on the origin, so a mesh's
    // world matrix inside the file is already "relative to the prop".
    gltf.scene.updateMatrixWorld(true);

    const s = options.scale ?? 1;
    const scale = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
    const rotation = options.rot ? new THREE.Euler(options.rot[0], options.rot[1], options.rot[2], 'YXZ') : new THREE.Euler(0, options.rotY ?? 0, 0);
    const placement = new THREE.Matrix4().compose(new THREE.Vector3(...options.at), new THREE.Quaternion().setFromEuler(rotation), scale);

    const used: THREE.MeshStandardMaterial[] = [];
    const copies = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    const instanceTag = options.unique ? `#${this.uniqueCounter++}` : '';
    const localBounds = new THREE.Box3();
    const worldBounds = new THREE.Box3();

    source.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      let material = mesh.material as THREE.MeshStandardMaterial;
      if (options.unique) {
        let copy = copies.get(material);
        if (!copy) {
          copy = material.clone();
          copies.set(material, copy);
        }
        material = copy;
      }
      if (!used.includes(material)) used.push(material);

      const geometry = toPlainGeometry(mesh.geometry, mesh.matrixWorld);
      geometry.computeBoundingBox();
      localBounds.union(geometry.boundingBox!);
      geometry.applyMatrix4(placement);
      geometry.computeBoundingBox();
      worldBounds.union(geometry.boundingBox!);

      const seeThrough = material.transparent || material.alphaTest > 0;
      this.batchFor(`prop:${material.uuid}${instanceTag}|${(options.cast ?? true) && !seeThrough ? 'c' : 'n'}`, material, options.kind ?? 'metal', (options.cast ?? true) && !seeThrough, false).geometries.push(geometry);
    });

    if (options.collide ?? true) {
      if (options.rot) {
        // Tipped-over props: an upright box around wherever they ended up.
        this.colliders.push(
          makeCollider(
            (worldBounds.min.x + worldBounds.max.x) / 2,
            (worldBounds.min.z + worldBounds.max.z) / 2,
            (worldBounds.max.x - worldBounds.min.x) / 2,
            (worldBounds.max.z - worldBounds.min.z) / 2,
            0,
            worldBounds.min.y,
            worldBounds.max.y,
          ),
        );
      } else {
        const centre = localBounds.getCenter(new THREE.Vector3()).applyMatrix4(placement);
        const size = localBounds.getSize(new THREE.Vector3()).multiply(scale);
        this.colliders.push(makeCollider(centre.x, centre.z, size.x / 2, size.z / 2, -(options.rotY ?? 0), worldBounds.min.y, worldBounds.max.y));
      }
    }
    return used;
  }

  // ---------------------------------------------------------------- decals

  /** A flat image laid over a surface: stains, painted markings, signs. */
  decal(
    texture: THREE.Texture,
    centre: Vec3,
    normal: Vec3,
    width: number,
    height: number,
    options: { roll?: number; opacity?: number; tint?: number; uvRect?: [number, number, number, number]; emissive?: number } = {},
  ): void {
    const key = `decal:${texture.uuid}:${options.opacity ?? 1}:${options.tint ?? 0xffffff}:${options.emissive ?? 0}`;
    let material = this.decalMaterials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: options.opacity ?? 1,
        color: options.tint ?? 0xffffff,
        roughness: 0.9,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      if (options.emissive) {
        material.emissive.set(options.tint ?? 0xffffff);
        material.emissiveMap = texture;
        material.emissiveIntensity = options.emissive;
      }
      this.decalMaterials.set(key, material);
    }
    // Lift each decal a hair further than the last so overlaps never flicker.
    const lift = 0.004 + (this.decalLayer++ % 40) * 0.0002;
    const n = new THREE.Vector3(...normal).normalize();
    const lifted: Vec3 = [centre[0] + n.x * lift, centre[1] + n.y * lift, centre[2] + n.z * lift];
    const geometry = quadAt(lifted, normal, width, height, options.roll ?? 0, options.uvRect);
    const batch = this.batchFor(key, material, 'concrete', false, true);
    batch.geometries.push(toPlainGeometry(geometry));
  }

  /** Convenience for the downloaded decal images. */
  decalImage(id: DecalId, centre: Vec3, normal: Vec3, width: number, height: number, options: { roll?: number; opacity?: number; tint?: number } = {}): void {
    this.decal(this.assets.decal(id), centre, normal, width, height, options);
  }

  /** Anything that should not be merged (animated screens, lights, effects). */
  addObject(object: THREE.Object3D): void {
    this.extras.push(object);
  }

  // ----------------------------------------------------------------- build

  build(): BuiltLevel {
    const group = new THREE.Group();
    group.name = 'level';
    const solids: THREE.Mesh[] = [];

    for (const [name, batch] of this.batches) {
      if (!batch.geometries.length) continue;
      const merged = mergeGeometries(batch.geometries, false);
      if (!merged) throw new Error(`Could not merge batch ${name}`);
      for (const g of batch.geometries) g.dispose();
      merged.computeBoundingSphere();
      merged.computeBoundingBox();

      const mesh = new THREE.Mesh(merged, batch.material);
      mesh.name = name;
      mesh.castShadow = batch.cast;
      mesh.receiveShadow = batch.receive;
      mesh.matrixAutoUpdate = false;
      mesh.userData.kind = batch.kind;
      if (batch.decal) {
        mesh.renderOrder = 2;
      } else {
        // A bounding-volume tree makes bullet ray tests against this mesh fast.
        merged.boundsTree = new MeshBVH(merged);
        solids.push(mesh);
      }
      group.add(mesh);
    }
    for (const extra of this.extras) group.add(extra);
    return { group, colliders: this.colliders, solids };
  }

  private add(key: string, material: THREE.Material, geometry: THREE.BufferGeometry, kind: SurfaceKind, cast: boolean): void {
    this.batchFor(`${key}|${cast ? 'c' : 'n'}`, material, kind, cast, false).geometries.push(toPlainGeometry(geometry));
    geometry.dispose();
  }

  private batchFor(key: string, material: THREE.Material, kind: SurfaceKind, cast: boolean, decal: boolean): Batch {
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { material, geometries: [], cast, receive: true, kind, decal };
      this.batches.set(key, batch);
    }
    return batch;
  }
}
