// Collision between a moving circle (the player or a robot, seen from above)
// and the level's solid boxes. Pure math: no rendering, no browser APIs.

/** A solid box: any rotation about the vertical axis, with a height range. */
export interface Collider {
  /** Centre on the ground plane. */
  x: number;
  z: number;
  /** Half sizes along the box's own axes. */
  hx: number;
  hz: number;
  /** Rotation about the vertical axis, stored as cos/sin. */
  cos: number;
  sin: number;
  /** Bottom and top heights. */
  y0: number;
  y1: number;
}

export function makeCollider(x: number, z: number, hx: number, hz: number, rotY: number, y0: number, y1: number): Collider {
  return { x, z, hx, hz, cos: Math.cos(rotY), sin: Math.sin(rotY), y0, y1 };
}

export interface CircleBody {
  x: number;
  z: number;
  radius: number;
  /** Height of the feet and of the top of the head. */
  feet: number;
  head: number;
}

/**
 * Pushes the circle out of every box it overlaps. Boxes whose top is within
 * `stepHeight` of the feet are ignored (they are walked onto instead).
 * Returns true if anything was touched.
 *
 * `climb` is for a body that can jump: the height of the tallest thing it
 * may ever get on top of. A box taller than that is solid however high the
 * feet are, so a jump clears a barrier and never a server rack, even from
 * the top of a crate. (Left out, there is no such limit, which is right
 * for robots: their feet never leave the floor.)
 *
 * `only` narrows it to the boxes on one side of that line: 'tall' for what
 * can never be got over, 'low' for what can.
 */
export function resolveCircle(body: CircleBody, colliders: readonly Collider[], stepHeight: number, climb = Infinity, only?: 'tall' | 'low'): boolean {
  let touched = false;
  // A few passes settle the body when it is wedged into a corner.
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const c of colliders) {
      if (body.head <= c.y0) continue;
      const low = c.y1 <= climb;
      if (low && body.feet >= c.y1 - stepHeight) continue;
      if (only && (only === 'low') !== low) continue;

      // Into the box's own frame.
      const dx = body.x - c.x;
      const dz = body.z - c.z;
      const lx = dx * c.cos + dz * c.sin;
      const lz = -dx * c.sin + dz * c.cos;

      // Closest point on the box to the circle centre.
      const px = lx < -c.hx ? -c.hx : lx > c.hx ? c.hx : lx;
      const pz = lz < -c.hz ? -c.hz : lz > c.hz ? c.hz : lz;
      let nx = lx - px;
      let nz = lz - pz;
      const distSq = nx * nx + nz * nz;
      if (distSq >= body.radius * body.radius) continue;

      let push: number;
      if (distSq > 1e-10) {
        const dist = Math.sqrt(distSq);
        nx /= dist;
        nz /= dist;
        push = body.radius - dist;
      } else {
        // Centre is inside the box: leave through the nearest face.
        const toX = c.hx - Math.abs(lx);
        const toZ = c.hz - Math.abs(lz);
        if (toX < toZ) {
          nx = lx < 0 ? -1 : 1;
          nz = 0;
          push = toX + body.radius;
        } else {
          nx = 0;
          nz = lz < 0 ? -1 : 1;
          push = toZ + body.radius;
        }
      }

      // Back to world space.
      body.x += (nx * c.cos - nz * c.sin) * push;
      body.z += (nx * c.sin + nz * c.cos) * push;
      moved = true;
      touched = true;
    }
    if (!moved) break;
  }
  return touched;
}

/**
 * Height of the highest surface under the circle that the body could be
 * standing on (box tops at or below the feet plus a step), or `floor`.
 * Nothing taller than `climb` counts: see resolveCircle.
 */
export function groundHeight(body: CircleBody, colliders: readonly Collider[], stepHeight: number, floor = 0, climb = Infinity): number {
  let ground = floor;
  for (const c of colliders) {
    if (c.y1 <= ground || c.y1 > climb || c.y1 > body.feet + stepHeight) continue;
    const dx = body.x - c.x;
    const dz = body.z - c.z;
    const lx = Math.abs(dx * c.cos + dz * c.sin);
    const lz = Math.abs(-dx * c.sin + dz * c.cos);
    // Standing counts once the centre is over the box (plus a small lip).
    if (lx <= c.hx + body.radius * 0.35 && lz <= c.hz + body.radius * 0.35) ground = c.y1;
  }
  return ground;
}

/** True if the box covers the given ground point (optionally grown by `margin`). */
export function colliderContains(c: Collider, x: number, z: number, margin = 0): boolean {
  const dx = x - c.x;
  const dz = z - c.z;
  const lx = Math.abs(dx * c.cos + dz * c.sin);
  const lz = Math.abs(-dx * c.sin + dz * c.cos);
  return lx <= c.hx + margin && lz <= c.hz + margin;
}
