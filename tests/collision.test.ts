import { describe, expect, it } from 'vitest';
import { colliderContains, groundHeight, makeCollider, resolveCircle, type CircleBody } from '../src/sim/collision';
import { rayCapsule, raySphere } from '../src/sim/rayShapes';

const body = (x: number, z: number, feet = 0): CircleBody => ({ x, z, radius: 0.35, feet, head: feet + 1.8 });

describe('circle versus boxes', () => {
  it('pushes a body out of a wall along the shortest way', () => {
    const wall = makeCollider(0, 0, 5, 0.25, 0, 0, 3);
    const b = body(1, 0.4);
    expect(resolveCircle(b, [wall], 0.3)).toBe(true);
    expect(b.z).toBeCloseTo(0.6); // wall face (0.25) + radius (0.35)
    expect(b.x).toBeCloseTo(1);
  });

  it('leaves a body alone when it is not touching', () => {
    const wall = makeCollider(0, 0, 5, 0.25, 0, 0, 3);
    const b = body(1, 2);
    expect(resolveCircle(b, [wall], 0.3)).toBe(false);
    expect(b.z).toBe(2);
  });

  it('settles a body wedged into a corner', () => {
    const walls = [makeCollider(0, -1, 5, 0.25, 0, 0, 3), makeCollider(-1, 0, 0.25, 5, 0, 0, 3)];
    const b = body(-0.6, -0.6);
    resolveCircle(b, walls, 0.3);
    expect(b.x).toBeGreaterThanOrEqual(-0.75 + 0.35 - 1e-6);
    expect(b.z).toBeGreaterThanOrEqual(-0.75 + 0.35 - 1e-6);
  });

  it('handles rotated boxes', () => {
    const slanted = makeCollider(0, 0, 3, 0.2, Math.PI / 4, 0, 3);
    const b = body(0.2, 0.2);
    expect(resolveCircle(b, [slanted], 0.3)).toBe(true);
    expect(colliderContains(slanted, b.x, b.z, 0.34)).toBe(false);
  });

  it('gets a body out even when its centre is inside the box', () => {
    const crate = makeCollider(0, 0, 0.5, 0.5, 0, 0, 1);
    const b = body(0.1, 0);
    resolveCircle(b, [crate], 0.3);
    expect(Math.abs(b.x)).toBeGreaterThanOrEqual(0.85 - 1e-6);
  });

  it('lets a body pass under a lintel and over a low step', () => {
    const lintel = makeCollider(0, 0, 2, 0.25, 0, 2.5, 4);
    const kerb = makeCollider(0, 0, 2, 0.25, 0, 0, 0.2);
    const b = body(0, 0);
    expect(resolveCircle(b, [lintel, kerb], 0.3)).toBe(false);
  });

  it('reports the top of a crate as ground once the body is above it', () => {
    const crate = makeCollider(0, 0, 0.6, 0.6, 0, 0, 0.5);
    expect(groundHeight(body(0, 0, 0), [crate], 0.3)).toBe(0); // too tall to step onto
    expect(groundHeight(body(0, 0, 0.6), [crate], 0.3)).toBe(0.5); // jumped on top
    expect(groundHeight(body(3, 0, 0.6), [crate], 0.3)).toBe(0); // off to the side
  });
});

describe('bullet hit shapes', () => {
  const origin = { x: 0, y: 0, z: 0 };
  const forward = { x: 0, y: 0, z: -1 };

  it('hits a sphere dead ahead at the right distance', () => {
    expect(raySphere(origin, forward, { x: 0, y: 0, z: -10 }, 1)).toBeCloseTo(9);
  });

  it('misses a sphere off to the side or behind', () => {
    expect(raySphere(origin, forward, { x: 2, y: 0, z: -10 }, 1)).toBe(-1);
    expect(raySphere(origin, forward, { x: 0, y: 0, z: 10 }, 1)).toBe(-1);
  });

  it('reports zero when the ray starts inside the sphere', () => {
    expect(raySphere(origin, forward, { x: 0, y: 0, z: -0.2 }, 1)).toBe(0);
  });

  it('hits the side of an upright capsule', () => {
    const a = { x: 0, y: -1, z: -5 };
    const b = { x: 0, y: 1, z: -5 };
    expect(rayCapsule(origin, forward, a, b, 0.25)).toBeCloseTo(4.75);
  });

  it('hits the rounded end of a capsule', () => {
    const a = { x: 0, y: -2, z: -5 };
    const b = { x: 0, y: -0.2, z: -5 };
    // The ray passes 0.2 above the top end: inside the cap (radius 0.25), so a hit.
    const t = rayCapsule(origin, forward, a, b, 0.25);
    expect(t).toBeGreaterThan(4.75);
    expect(t).toBeLessThan(5);
  });

  it('misses a capsule that the ray passes beside or above', () => {
    const a = { x: 0, y: -2, z: -5 };
    const b = { x: 0, y: -0.5, z: -5 };
    expect(rayCapsule(origin, forward, a, b, 0.25)).toBe(-1);
    expect(rayCapsule(origin, forward, { x: 1, y: -1, z: -5 }, { x: 1, y: 1, z: -5 }, 0.25)).toBe(-1);
  });

  it('treats a zero-length capsule as a sphere', () => {
    const p = { x: 0, y: 0, z: -4 };
    expect(rayCapsule(origin, forward, p, p, 0.5)).toBeCloseTo(3.5);
  });

  it('hits a capsule lying along the ray direction', () => {
    const t = rayCapsule(origin, forward, { x: 0, y: 0, z: -4 }, { x: 0, y: 0, z: -6 }, 0.3);
    expect(t).toBeCloseTo(3.7);
  });
});
