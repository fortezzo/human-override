// Bullet-versus-robot hit tests.
//
// A robot is approximated by a handful of simple shapes that follow its
// bones (a sphere for the head, capsules for the torso and limbs). Testing a
// ray against those is exact, fast, and tells us which body part was hit.
//
// Pure math: no rendering, no browser APIs.

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Distance along the ray to a sphere, or -1 for a miss.
 * `d` must be a unit vector.
 */
export function raySphere(o: Vec3Like, d: Vec3Like, centre: Vec3Like, radius: number): number {
  const ox = o.x - centre.x;
  const oy = o.y - centre.y;
  const oz = o.z - centre.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const h = b * b - c;
  if (h < 0) return -1;
  const root = Math.sqrt(h);
  const near = -b - root;
  if (near >= 0) return near;
  const far = -b + root;
  return far >= 0 ? 0 : -1; // ray starts inside the sphere
}

/**
 * Distance along the ray to a capsule (a cylinder from `a` to `b` with
 * rounded ends), or -1 for a miss. `d` must be a unit vector.
 */
export function rayCapsule(o: Vec3Like, d: Vec3Like, a: Vec3Like, b: Vec3Like, radius: number): number {
  const bax = b.x - a.x;
  const bay = b.y - a.y;
  const baz = b.z - a.z;
  const oax = o.x - a.x;
  const oay = o.y - a.y;
  const oaz = o.z - a.z;
  const baba = bax * bax + bay * bay + baz * baz;
  if (baba < 1e-10) return raySphere(o, d, a, radius);
  const bard = bax * d.x + bay * d.y + baz * d.z;
  const baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = d.x * oax + d.y * oay + d.z * oaz;
  const oaoa = oax * oax + oay * oay + oaz * oaz;

  const qa = baba - bard * bard;
  const qb = baba * rdoa - baoa * bard;
  const qc = baba * oaoa - baoa * baoa - radius * radius * baba;

  let best = -1;
  if (qa > 1e-10) {
    const h = qb * qb - qa * qc;
    if (h >= 0) {
      const t = (-qb - Math.sqrt(h)) / qa;
      const y = baoa + t * bard;
      // Hit on the cylindrical body between the two ends.
      if (y > 0 && y < baba && t >= 0) best = t;
    }
  }
  // Rounded end caps.
  const capA = raySphere(o, d, a, radius);
  const capB = raySphere(o, d, b, radius);
  if (capA >= 0 && (best < 0 || capA < best)) best = capA;
  if (capB >= 0 && (best < 0 || capB < best)) best = capB;
  return best;
}
