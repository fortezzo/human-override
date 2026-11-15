// How the player's speed changes from one frame to the next.
//
// Two things act on someone walking. Friction drags their speed toward
// zero all the time, which is what stops them when the keys are let go.
// Holding a direction pushes their speed toward the speed they are aiming
// for (walking, sprinting, or slower while aiming down the sights).
//
// The push is sized relative to that target speed. An earlier version used
// one fixed push for every target, and because friction grows with speed
// while the push did not, the two balanced out at about 4.2 metres a second
// whatever the target was: sprinting changed the view and nothing else.
// Sized this way the top speed is always reached, as long as the push is
// stronger than friction (see the test in tests/movement.test.ts).

export interface Velocity {
  x: number;
  z: number;
}

export interface GroundRules {
  /** Share of the current speed lost per second. */
  friction: number;
  /** Push toward the target speed, as a multiple of that speed per second. */
  accel: number;
}

/** Friction: lose a share of the current speed. */
export function applyFriction(v: Velocity, friction: number, dt: number): void {
  const speed = Math.hypot(v.x, v.z);
  if (speed <= 0) return;
  const scale = Math.max(0, speed - speed * friction * dt) / speed;
  v.x *= scale;
  v.z *= scale;
}

/**
 * Push toward a wished direction (a unit vector, or zero for "no keys
 * held") at `rate` metres per second per second, but never beyond
 * `maxSpeed` along that direction.
 */
export function accelerate(v: Velocity, wishX: number, wishZ: number, maxSpeed: number, rate: number, dt: number): void {
  const along = v.x * wishX + v.z * wishZ;
  const room = maxSpeed - along;
  if (room <= 0) return;
  const step = Math.min(rate * dt, room);
  v.x += wishX * step;
  v.z += wishZ * step;
}

/** One frame on the ground: friction, then the push toward the target speed. */
export function groundStep(v: Velocity, wishX: number, wishZ: number, maxSpeed: number, rules: GroundRules, dt: number): void {
  applyFriction(v, rules.friction, dt);
  accelerate(v, wishX, wishZ, maxSpeed, rules.accel * maxSpeed, dt);
}
