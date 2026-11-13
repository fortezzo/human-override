// Geometry helpers for building the level out of simple solids.
//
// The key idea is "world-scaled UVs": texture coordinates are computed from
// where a surface sits in the world rather than from the shape it belongs
// to, so a texture keeps the same real-world size on a 20 m wall and a
// 20 cm trim piece, and lines up across neighbouring pieces.

import * as THREE from 'three';

const _n = new THREE.Vector3();
const _p = new THREE.Vector3();

/**
 * Overwrites a geometry's UVs by projecting each vertex along the axis its
 * normal points down most. Call after the geometry is in its final place.
 */
export function applyWorldUvs(geometry: THREE.BufferGeometry, tile: number, offset = 0): void {
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const normal = geometry.attributes.normal as THREE.BufferAttribute;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    _p.fromBufferAttribute(position, i);
    _n.fromBufferAttribute(normal, i);
    const ax = Math.abs(_n.x);
    const ay = Math.abs(_n.y);
    const az = Math.abs(_n.z);
    let u: number;
    let v: number;
    if (ax >= ay && ax >= az) {
      u = _p.z;
      v = _p.y;
    } else if (ay >= az) {
      u = _p.x;
      v = _p.z;
    } else {
      u = _p.x;
      v = _p.y;
    }
    uv[i * 2] = u / tile + offset;
    uv[i * 2 + 1] = v / tile + offset;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** A box spanning two corners, already positioned in the world. */
export function boxBetween(min: THREE.Vector3Tuple, max: THREE.Vector3Tuple): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  geometry.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  return geometry;
}

/** A round bar (pipe, conduit, rail) from one point to another. */
export function tubeBetween(from: THREE.Vector3Tuple, to: THREE.Vector3Tuple, radius: number, tile: number, segments = 10): THREE.BufferGeometry {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const length = a.distanceTo(b);
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments, 1, false);
  // Cylinder UVs run 0..1 around and along; rescale to real-world size.
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) * Math.PI * 2 * radius) / tile, (uv.getY(i) * length) / tile);
  }
  const direction = b.clone().sub(a).normalize();
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction));
  geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geometry;
}

/** A cable hanging between two points with some slack. */
export function cableBetween(from: THREE.Vector3Tuple, to: THREE.Vector3Tuple, sag: number, radius: number, tile: number): THREE.BufferGeometry {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const points: THREE.Vector3[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    points.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 16, radius, 6, false);
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  const length = curve.getLength();
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) * length) / tile, (uv.getY(i) * Math.PI * 2 * radius) / tile);
  }
  return geometry;
}

/** A flat rectangle facing along `normal`, used for decals and screens. */
export function quadAt(
  centre: THREE.Vector3Tuple,
  normal: THREE.Vector3Tuple,
  width: number,
  height: number,
  roll = 0,
  uvRect: [number, number, number, number] = [0, 0, 1, 1],
): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(width, height);
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  const [u0, v0, u1, v1] = uvRect;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  }
  if (roll) geometry.rotateZ(roll);
  const n = new THREE.Vector3(...normal).normalize();
  const q = new THREE.Quaternion();
  if (Math.abs(n.y) > 0.999) {
    // Floor or ceiling: keep the image's "up" pointing to -Z (north).
    q.setFromEuler(new THREE.Euler(n.y > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0));
  } else {
    const m = new THREE.Matrix4().lookAt(n, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    q.setFromRotationMatrix(m);
  }
  geometry.applyQuaternion(q);
  geometry.translate(centre[0], centre[1], centre[2]);
  return geometry;
}

/**
 * Returns a copy of a geometry holding only plain float position / normal /
 * uv attributes and an index, so geometries from different sources (code,
 * compressed GLB files) can be merged into one batch.
 */
export function toPlainGeometry(source: THREE.BufferGeometry, matrix?: THREE.Matrix4): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const count = source.attributes.position!.count;

  const copy = (name: string, size: number): Float32Array => {
    const array = new Float32Array(count * size);
    const attr = source.attributes[name] as THREE.BufferAttribute | undefined;
    if (attr) {
      for (let i = 0; i < count; i++) {
        array[i * size] = attr.getX(i);
        array[i * size + 1] = attr.getY(i);
        if (size > 2) array[i * size + 2] = attr.getZ(i);
      }
    }
    return array;
  };

  out.setAttribute('position', new THREE.BufferAttribute(copy('position', 3), 3));
  out.setAttribute('normal', new THREE.BufferAttribute(copy('normal', 3), 3));
  out.setAttribute('uv', new THREE.BufferAttribute(copy('uv', 2), 2));

  if (source.index) {
    out.setIndex(new THREE.BufferAttribute(new Uint32Array(source.index.array), 1));
  } else {
    const index = new Uint32Array(count);
    for (let i = 0; i < count; i++) index[i] = i;
    out.setIndex(new THREE.BufferAttribute(index, 1));
  }

  if (matrix) {
    out.applyMatrix4(matrix);
    // A mirrored transform flips triangle winding; flip it back.
    if (matrix.determinant() < 0) {
      const index = out.index!.array as Uint32Array;
      for (let i = 0; i < index.length; i += 3) {
        const t = index[i]!;
        index[i] = index[i + 2]!;
        index[i + 2] = t;
      }
    }
  }
  return out;
}
