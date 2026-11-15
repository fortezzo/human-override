// Assembles a robot body from parts.
//
// A design (see ../designs) hands this builder a list of shapes, each with
// a paint finish and the bone it rides on. The builder turns them into:
//
//   - one skinned mesh for the whole body (a single draw call per robot)
//   - one small skinned mesh for everything that glows
//   - the rigid chunks the robot breaks into when destroyed
//
// Parts are rigid: every vertex follows exactly one bone, as on a real
// machine. The exception is anything that spans a joint (pistons, cables,
// bellows), which blends between the bones at its ends so it stretches and
// bends as the joint moves.

import * as THREE from 'three';
import type { Rig } from './Rig';
import type { Vec } from '../../../render/shapes';

/** A surface finish. Colors are the actual base color, in linear light. */
export interface Paint {
  color: [number, number, number];
  /** 0 = paint or rubber, 1 = bare metal. */
  metal: number;
  /** Added to the texture's roughness (negative = shinier). */
  rough: number;
  /** 0..1: how readily rust and grime take hold. */
  grime: number;
}

/** Where a blended part is pinned: at `at`, it follows `bone` completely. */
export interface Anchor {
  bone: string;
  at: Vec;
}

export interface PartOptions {
  /** The bone a rigid part rides on, or the anchors a flexible part blends between. */
  bone: string | Anchor[];
  paint?: Paint;
  /** Also add a mirror image on the robot's other side. */
  mirror?: boolean;
  /** Brightness if the part glows (it then goes in the glow mesh). */
  glow?: number;
  /** Edges sharper than this many degrees stay crisp. */
  crease?: number;
}

/** One rigid piece of a destroyed robot. */
export interface Chunk {
  /** The bone this chunk rides on until the robot breaks apart. */
  bone: string;
  geometry: THREE.BufferGeometry;
  /** The chunk's centre, in that bone's space. */
  offset: THREE.Vector3;
  /** Direction (in the chunk's space) it is thinnest along: it comes to rest with this pointing up or down. */
  thinAxis: THREE.Vector3;
  /** Half its thickness along that direction: how high its centre sits when lying flat. */
  restHeight: number;
  /** Rough size, for bouncing off things while tumbling. */
  radius: number;
}

interface Part {
  positions: Float32Array;
  anchors: Anchor[];
  paint: Paint;
  glow: number;
  crease: number;
}

/** Which bones break away together. Anything not listed goes with its nearest listed ancestor. */
const CHUNK_BONES: Array<{ bone: string; members: RegExp }> = [
  { bone: 'Head', members: /^(Head|Neck)$/ },
  { bone: 'Spine2', members: /^(Spine1|Spine2|LeftShoulder|RightShoulder)$/ },
  { bone: 'Hips', members: /^(Hips|Spine)$/ },
  { bone: 'LeftArm', members: /^LeftArm$/ },
  { bone: 'LeftForeArm', members: /^(LeftForeArm|LeftHand)$/ },
  { bone: 'RightArm', members: /^RightArm$/ },
  { bone: 'RightForeArm', members: /^(RightForeArm|RightHand)$/ },
  { bone: 'LeftUpLeg', members: /^LeftUpLeg$/ },
  { bone: 'LeftLeg', members: /^(LeftLeg|LeftFoot|LeftToeBase)$/ },
  { bone: 'RightUpLeg', members: /^RightUpLeg$/ },
  { bone: 'RightLeg', members: /^(RightLeg|RightFoot|RightToeBase)$/ },
];

/** Size in metres that one repeat of the surface texture covers. */
const TEXTURE_TILE = 0.42;

const DEFAULT_PAINT: Paint = { color: [0.06, 0.065, 0.072], metal: 1, rough: 0, grime: 0.3 };

/**
 * Rust and dirt gather low down: anything within half a metre of the floor
 * picks up extra grime, most of all at the feet. Clean finishes stay clean.
 */
const grimeAt = (paint: Paint, height: number) => (paint.grime <= 0.06 ? paint.grime : paint.grime + Math.max(0, 0.45 - height) * 0.38);

const mirrorName = (name: string) => (name.startsWith('Left') ? `Right${name.slice(4)}` : name.startsWith('Right') ? `Left${name.slice(5)}` : name);

/** Growable lists of vertex data for one output mesh. */
class Buffers {
  position: number[] = [];
  normal: number[] = [];
  uv: number[] = [];
  color: number[] = [];
  surface: number[] = [];
  skinIndex: number[] = [];
  skinWeight: number[] = [];

  geometry(skinned: boolean): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    geometry.setAttribute('aSurface', new THREE.Float32BufferAttribute(this.surface, 3));
    if (skinned) {
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.skinIndex, 4));
      geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.skinWeight, 4));
    }
    return geometry;
  }
}

export class RobotBuilder {
  private readonly parts: Part[] = [];
  /**
   * A design built on top of another sets this while the borrowed body is
   * being added, to give it a finish of its own: every paint passes
   * through it on the way in.
   */
  repaint: ((paint: Paint) => Paint) | null = null;

  constructor(private readonly rig: Rig) {}

  /** Add a shape (from ./shapes) to the robot. */
  add(shape: THREE.BufferGeometry, options: PartOptions): void {
    const positions = (shape.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const anchors: Anchor[] = typeof options.bone === 'string' ? [{ bone: options.bone, at: new THREE.Vector3() }] : options.bone;
    const paint = options.paint ?? DEFAULT_PAINT;
    const part: Part = { positions, anchors, paint: this.repaint ? this.repaint(paint) : paint, glow: options.glow ?? 0, crease: options.crease ?? 40 };
    this.parts.push(part);

    if (options.mirror) {
      // Flip across the robot's centre line and reverse each triangle so it
      // still faces outward.
      const flipped = new Float32Array(positions.length);
      for (let t = 0; t < positions.length; t += 9) {
        for (const [from, to] of [
          [0, 0],
          [3, 6],
          [6, 3],
        ] as const) {
          flipped[t + to] = -positions[t + from]!;
          flipped[t + to + 1] = positions[t + from + 1]!;
          flipped[t + to + 2] = positions[t + from + 2]!;
        }
      }
      this.parts.push({
        ...part,
        positions: flipped,
        anchors: anchors.map((a) => ({ bone: mirrorName(a.bone), at: new THREE.Vector3(-a.at.x, a.at.y, a.at.z) })),
      });
    }
  }

  build(): { body: THREE.BufferGeometry; glow: THREE.BufferGeometry; chunks: Chunk[]; triangles: number } {
    const body = new Buffers();
    const glow = new Buffers();
    const chunkBuffers = new Map<string, Buffers>();

    for (const part of this.parts) {
      const count = part.positions.length / 3;
      const normals = creasedNormals(part.positions, part.crease);
      const uvs = boxUvs(part.positions, TEXTURE_TILE);
      const target = part.glow > 0 ? glow : body;
      const color = part.glow > 0 ? [part.glow, part.glow, part.glow] : part.paint.color;

      for (let i = 0; i < count; i++) {
        const x = part.positions[i * 3]!;
        const y = part.positions[i * 3 + 1]!;
        const z = part.positions[i * 3 + 2]!;
        target.position.push(x, y, z);
        target.normal.push(normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!);
        target.uv.push(uvs[i * 2]!, uvs[i * 2 + 1]!);
        target.color.push(color[0]!, color[1]!, color[2]!);
        target.surface.push(part.paint.metal, part.paint.rough, grimeAt(part.paint, y));
        const [a, b, weight] = this.weights(part.anchors, x, y, z);
        target.skinIndex.push(a, b, 0, 0);
        target.skinWeight.push(1 - weight, weight, 0, 0);
      }

      // The same part, as it will look lying on the floor: rigid, in the
      // space of the bone its chunk breaks away with. Glowing parts are
      // left out: a destroyed robot is dark.
      if (part.glow > 0) continue;
      const chunkBone = this.chunkBone(part.anchors[0]!.bone);
      let buffers = chunkBuffers.get(chunkBone);
      if (!buffers) chunkBuffers.set(chunkBone, (buffers = new Buffers()));
      const toBone = this.rig.toBone(chunkBone);
      const p = new THREE.Vector3();
      const n = new THREE.Vector3();
      for (let i = 0; i < count; i++) {
        p.set(part.positions[i * 3]!, part.positions[i * 3 + 1]!, part.positions[i * 3 + 2]!).applyMatrix4(toBone);
        n.set(normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!).transformDirection(toBone);
        buffers.position.push(p.x, p.y, p.z);
        buffers.normal.push(n.x, n.y, n.z);
        buffers.uv.push(uvs[i * 2]!, uvs[i * 2 + 1]!);
        buffers.color.push(part.paint.color[0], part.paint.color[1], part.paint.color[2]);
        buffers.surface.push(part.paint.metal, part.paint.rough, grimeAt(part.paint, part.positions[i * 3 + 1]!));
      }
    }

    const chunks: Chunk[] = [];
    for (const [bone, buffers] of chunkBuffers) chunks.push(makeChunk(bone, buffers));
    return { body: body.geometry(true), glow: glow.geometry(true), chunks, triangles: body.position.length / 9 };
  }

  /** Bone indices and blend weight for a vertex of a part. */
  private weights(anchors: Anchor[], x: number, y: number, z: number): [number, number, number] {
    if (anchors.length === 1) {
      const index = this.rig.index(anchors[0]!.bone);
      return [index, index, 0];
    }
    // Find where the vertex falls along the chain of anchors.
    let best = 0;
    let bestT = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i]!.at;
      const b = anchors[i + 1]!.at;
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const abz = b.z - a.z;
      const lengthSq = abx * abx + aby * aby + abz * abz || 1;
      const t = THREE.MathUtils.clamp(((x - a.x) * abx + (y - a.y) * aby + (z - a.z) * abz) / lengthSq, 0, 1);
      const dx = x - (a.x + abx * t);
      const dy = y - (a.y + aby * t);
      const dz = z - (a.z + abz * t);
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
        bestT = t;
      }
    }
    return [this.rig.index(anchors[best]!.bone), this.rig.index(anchors[best + 1]!.bone), bestT];
  }

  /** The chunk a bone breaks away with: its own, or its nearest ancestor's. */
  private chunkBone(name: string): string {
    let bone: THREE.Object3D | null = this.rig.bone(name);
    while (bone) {
      const current: string = bone.name;
      const match = CHUNK_BONES.find((c) => c.members.test(current));
      if (match) return match.bone;
      bone = bone.parent;
    }
    return 'Hips';
  }
}

/** Centre a chunk on itself and measure how it will lie on the floor. */
function makeChunk(bone: string, buffers: Buffers): Chunk {
  const geometry = buffers.geometry(false);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const offset = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  geometry.translate(-offset.x, -offset.y, -offset.z);
  geometry.computeBoundingSphere();

  const extents = [size.x, size.y, size.z];
  const thinnest = extents.indexOf(Math.min(...extents));
  const thinAxis = new THREE.Vector3().setComponent(thinnest, 1);
  return { bone, geometry, offset, thinAxis, restHeight: extents[thinnest]! / 2, radius: Math.min(0.14, (size.x + size.y + size.z) / 6) };
}

/**
 * Normals for loose triangles: faces that meet at less than `creaseDegrees`
 * blend smoothly; sharper edges stay crisp. That keeps flat plates flat and
 * round tubes round without any extra data.
 */
function creasedNormals(positions: Float32Array, creaseDegrees: number): Float32Array {
  const triangles = positions.length / 9;
  const faceNormals = new Float32Array(triangles * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const corners = new Map<string, number[]>();
  const key = (i: number) => `${Math.round(positions[i]! * 20000)},${Math.round(positions[i + 1]! * 20000)},${Math.round(positions[i + 2]! * 20000)}`;

  for (let t = 0; t < triangles; t++) {
    a.fromArray(positions, t * 9);
    b.fromArray(positions, t * 9 + 3);
    c.fromArray(positions, t * 9 + 6);
    // Left un-normalised, the cross product's length is the face's area,
    // which weights big faces more heavily in the blend.
    b.sub(a);
    c.sub(a);
    b.cross(c);
    faceNormals[t * 3] = b.x;
    faceNormals[t * 3 + 1] = b.y;
    faceNormals[t * 3 + 2] = b.z;
    for (let k = 0; k < 3; k++) {
      const id = key(t * 9 + k * 3);
      const list = corners.get(id);
      if (list) list.push(t);
      else corners.set(id, [t]);
    }
  }

  const limit = Math.cos(THREE.MathUtils.degToRad(creaseDegrees));
  const normals = new Float32Array(positions.length);
  const own = new THREE.Vector3();
  const other = new THREE.Vector3();
  const sum = new THREE.Vector3();
  for (let t = 0; t < triangles; t++) {
    own.fromArray(faceNormals, t * 3);
    const ownLength = own.length() || 1;
    for (let k = 0; k < 3; k++) {
      sum.set(0, 0, 0);
      for (const neighbour of corners.get(key(t * 9 + k * 3))!) {
        other.fromArray(faceNormals, neighbour * 3);
        if (own.dot(other) >= limit * ownLength * (other.length() || 1)) sum.add(other);
      }
      sum.normalize();
      normals[t * 9 + k * 3] = sum.x;
      normals[t * 9 + k * 3 + 1] = sum.y;
      normals[t * 9 + k * 3 + 2] = sum.z;
    }
  }
  return normals;
}

/**
 * Texture coordinates by box projection: each triangle is textured from
 * whichever side it faces most directly, at a constant real-world scale.
 */
function boxUvs(positions: Float32Array, tile: number): Float32Array {
  const uvs = new Float32Array((positions.length / 3) * 2);
  for (let t = 0; t < positions.length; t += 9) {
    const ux = positions[t + 3]! - positions[t]!;
    const uy = positions[t + 4]! - positions[t + 1]!;
    const uz = positions[t + 5]! - positions[t + 2]!;
    const vx = positions[t + 6]! - positions[t]!;
    const vy = positions[t + 7]! - positions[t + 1]!;
    const vz = positions[t + 8]! - positions[t + 2]!;
    const nx = Math.abs(uy * vz - uz * vy);
    const ny = Math.abs(uz * vx - ux * vz);
    const nz = Math.abs(ux * vy - uy * vx);
    for (let k = 0; k < 3; k++) {
      const x = positions[t + k * 3]!;
      const y = positions[t + k * 3 + 1]!;
      const z = positions[t + k * 3 + 2]!;
      const i = (t / 3 + k) * 2;
      if (nx >= ny && nx >= nz) {
        uvs[i] = z / tile;
        uvs[i + 1] = y / tile;
      } else if (ny >= nz) {
        uvs[i] = x / tile;
        uvs[i + 1] = z / tile;
      } else {
        uvs[i] = x / tile;
        uvs[i + 1] = y / tile;
      }
    }
  }
  return uvs;
}
