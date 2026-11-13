// Hard-surface shapes: the building blocks for machinery made in code.
//
// The robots and the rifle's sight are assembled from a handful of
// generators here: lofted hulls with chamfered edges (armor plates,
// housings, limbs), tubes and ribbed tubes (joints, pistons, bellows),
// balls, and cables. Each returns plain triangles; whoever uses them adds
// normals, texture coordinates and materials afterwards.

import * as THREE from 'three';

export type Vec = THREE.Vector3;
export const vec = (x: number, y: number, z: number): Vec => new THREE.Vector3(x, y, z);

/** A cross-section outline: points in (u, v), listed counter-clockwise. */
export type Section = Array<[number, number]>;

/**
 * A rectangle with its corners cut off (an octagon). `chamfer` is one size
 * for all corners or [top-left, top-right, bottom-right, bottom-left].
 */
export function rect(width: number, height: number, chamfer: number | [number, number, number, number] = 0): Section {
  const [tl, tr, br, bl] = typeof chamfer === 'number' ? [chamfer, chamfer, chamfer, chamfer] : chamfer;
  const x = width / 2;
  const y = height / 2;
  return [
    [x, -y + br],
    [x, y - tr],
    [x - tr, y],
    [-x + tl, y],
    [-x, y - tl],
    [-x, -y + bl],
    [-x + bl, -y],
    [x - br, -y],
  ];
}

/** A circle (or ellipse) approximated by a polygon. */
export function round(radiusU: number, radiusV = radiusU, sides = 12): Section {
  const points: Section = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    points.push([Math.cos(a) * radiusU, Math.sin(a) * radiusV]);
  }
  return points;
}

const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();

/** Collects loose triangles. */
class Soup {
  private readonly p: number[] = [];

  tri(a: Vec, b: Vec, c: Vec): void {
    // Zero-size chamfers leave slivers with no area; drop them.
    _e1.subVectors(b, a);
    _e2.subVectors(c, a);
    if (_e1.cross(_e2).lengthSq() < 1e-16) return;
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }

  quad(a: Vec, b: Vec, c: Vec, d: Vec): void {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  geometry(): THREE.BufferGeometry {
    return fromPositions(new Float32Array(this.p));
  }
}

export function fromPositions(positions: Float32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

/** Position-only, non-indexed copy of any geometry. */
function plain(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = source.index ? source.toNonIndexed() : source;
  const position = flat.attributes.position as THREE.BufferAttribute;
  const out = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    out[i * 3] = position.getX(i);
    out[i * 3 + 1] = position.getY(i);
    out[i * 3 + 2] = position.getZ(i);
  }
  return fromPositions(out);
}

export interface Station {
  /** Centre of this cross-section. */
  at: Vec;
  section: Section;
}

/**
 * Lofts a skin through a series of cross-sections, like the frames of a
 * ship's hull. All sections must have the same number of points.
 *
 * Sections lie square to the line from the first station to the last; `up`
 * says which way their v axis points. Their u axis is then `up x axis`.
 */
export function hull(stations: Station[], up: Vec, caps: 'both' | 'start' | 'end' | 'none' = 'both'): THREE.BufferGeometry {
  const first = stations[0]!;
  const last = stations[stations.length - 1]!;
  const axis = last.at.clone().sub(first.at).normalize();
  const v = up.clone().addScaledVector(axis, -up.dot(axis)).normalize();
  const u = new THREE.Vector3().crossVectors(v, axis);
  const rings = stations.map((s) => s.section.map(([a, b]) => s.at.clone().addScaledVector(u, a).addScaledVector(v, b)));

  const soup = new Soup();
  const n = rings[0]!.length;
  for (let s = 0; s < rings.length - 1; s++) {
    const a = rings[s]!;
    const b = rings[s + 1]!;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      soup.quad(a[i]!, a[j]!, b[j]!, b[i]!);
    }
  }
  const centre = (ring: Vec[]) => ring.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(ring.length);
  if (caps === 'both' || caps === 'start') {
    const ring = rings[0]!;
    const c = centre(ring);
    for (let i = 0; i < n; i++) soup.tri(c, ring[(i + 1) % n]!, ring[i]!);
  }
  if (caps === 'both' || caps === 'end') {
    const ring = rings[rings.length - 1]!;
    const c = centre(ring);
    for (let i = 0; i < n; i++) soup.tri(c, ring[i]!, ring[(i + 1) % n]!);
  }
  return soup.geometry();
}

/** Some direction that is not parallel to `axis`, to orient round sections. */
function anyUp(axis: Vec): Vec {
  return Math.abs(axis.y) < 0.9 ? vec(0, 1, 0) : vec(1, 0, 0);
}

/**
 * A box with every edge chamfered. Size is (x, y, z); `rotation` turns it
 * about its own centre.
 */
export function box(centre: Vec, size: Vec, chamfer = 0, rotation?: THREE.Euler): THREE.BufferGeometry {
  const c = Math.min(chamfer, size.x / 2 - 1e-4, size.y / 2 - 1e-4, size.z / 2 - 1e-4);
  const hy = size.y / 2;
  const outer = rect(size.x, size.z, c);
  const stations: Station[] =
    c > 0
      ? [
          { at: vec(0, -hy, 0), section: rect(size.x - 2 * c, size.z - 2 * c, 0) },
          { at: vec(0, -hy + c, 0), section: outer },
          { at: vec(0, hy - c, 0), section: outer },
          { at: vec(0, hy, 0), section: rect(size.x - 2 * c, size.z - 2 * c, 0) },
        ]
      : [
          { at: vec(0, -hy, 0), section: outer },
          { at: vec(0, hy, 0), section: outer },
        ];
  // With the axis along +Y and "up" along -Z, a section's u axis is +X.
  const geometry = hull(stations, vec(0, 0, -1));
  if (rotation) geometry.applyQuaternion(new THREE.Quaternion().setFromEuler(rotation));
  geometry.translate(centre.x, centre.y, centre.z);
  return geometry;
}

/** A straight bar with a chamfered rectangular section, `height` measured along `up`. */
export function beam(from: Vec, to: Vec, width: number, height: number, chamfer: number, up: Vec): THREE.BufferGeometry {
  const section = rect(width, height, chamfer);
  return hull(
    [
      { at: from, section },
      { at: to, section },
    ],
    up,
  );
}

/** A round bar. Give two radii for a cone. */
export function tube(from: Vec, to: Vec, radius: number, radiusTo = radius, sides = 12, caps: 'both' | 'start' | 'end' | 'none' = 'both'): THREE.BufferGeometry {
  const axis = to.clone().sub(from);
  return hull(
    [
      { at: from, section: round(radius, radius, sides) },
      { at: to, section: round(radiusTo, radiusTo, sides) },
    ],
    anyUp(axis.normalize()),
    caps,
  );
}

/** A round bar with ridges along it: flexible bellows, cooling fins, springs. */
export function ribbed(from: Vec, to: Vec, radius: number, depth: number, ribs: number, sides = 12): THREE.BufferGeometry {
  const axis = to.clone().sub(from);
  const stations: Station[] = [];
  const steps = ribs * 2;
  for (let i = 0; i <= steps; i++) {
    const r = i % 2 === 0 ? radius - depth : radius;
    stations.push({ at: from.clone().addScaledVector(axis, i / steps), section: round(r, r, sides) });
  }
  return hull(stations, anyUp(axis.clone().normalize()));
}

/** A faceted ball. */
export function ball(centre: Vec, radius: number, detail = 1): THREE.BufferGeometry {
  const geometry = plain(new THREE.IcosahedronGeometry(radius, detail));
  geometry.translate(centre.x, centre.y, centre.z);
  return geometry;
}

/** A hose or cable running through a list of points. */
export function cable(points: Vec[], radius: number, sides = 6): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  return plain(new THREE.TubeGeometry(curve, Math.max(6, (points.length - 1) * 6), radius, sides, false));
}

/** Several shapes as one. */
export function merge(...geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const g of geometries) total += (g.attributes.position as THREE.BufferAttribute).array.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const g of geometries) {
    const array = (g.attributes.position as THREE.BufferAttribute).array;
    out.set(array, offset);
    offset += array.length;
  }
  return fromPositions(out);
}

/** A row of identical shapes: `make(i)` is called for each. */
export function row(count: number, make: (i: number) => THREE.BufferGeometry): THREE.BufferGeometry {
  return merge(...Array.from({ length: count }, (_, i) => make(i)));
}
