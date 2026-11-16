import { describe, expect, it } from 'vitest';
import { PLAYER, ROBOT } from '../src/config';
import { groundHeight, makeCollider, resolveCircle, type CircleBody, type Collider } from '../src/sim/collision';
import { createNavGrid } from '../src/sim/navGrid';
import { findStandableOutOfReach, groupSafeSpots } from '../src/sim/safeSpots';

// What a jump gets the player over: anything whose top is no higher than
// PLAYER.climb above the floor, and nothing taller, wherever their feet are.

const STEP = PLAYER.stepHeight;
const CLIMB = PLAYER.climb;
const body = (x: number, z: number, feet = 0): CircleBody => ({ x, z, radius: PLAYER.radius, feet, head: feet + PLAYER.height });
/** A box 1 m square at the origin, standing on the floor, this tall. */
const box = (top: number): Collider => makeCollider(0, 0, 0.5, 0.5, 0, 0, top);
/** How high the feet get at the top of a jump from the floor. */
const apex = (PLAYER.jumpSpeed * PLAYER.jumpSpeed) / (2 * PLAYER.gravity);

describe('what a jump clears', () => {
  it('a jump from the floor lifts the feet high enough for anything up to the climbing height, and no higher than that plus a little', () => {
    // The feet need to be within a step of the top to clear it.
    expect(apex + STEP).toBeGreaterThan(CLIMB + 0.1);
    // And the rule is not asking for the impossible the other way: waist height, not head height.
    expect(CLIMB).toBeGreaterThan(0.9);
    expect(CLIMB).toBeLessThan(1.15);
  });

  it('something low stops a body on the floor, and lets one through whose feet are within a step of its top', () => {
    const barrier = box(0.82);
    expect(resolveCircle(body(0.6, 0), [barrier], STEP, CLIMB)).toBe(true);
    expect(resolveCircle(body(0.6, 0, 0.3), [barrier], STEP, CLIMB)).toBe(true);
    expect(resolveCircle(body(0.6, 0, 0.82 - STEP), [barrier], STEP, CLIMB)).toBe(false);
    expect(resolveCircle(body(0, 0, apex), [barrier], STEP, CLIMB)).toBe(false);
  });

  it('something at exactly the climbing height can be cleared; something a little taller cannot, however high the feet are', () => {
    expect(resolveCircle(body(0.6, 0, apex), [box(CLIMB)], STEP, CLIMB)).toBe(false);
    for (const feet of [0, apex, 1.2, 1.9, 2.5]) expect(resolveCircle(body(0.6, 0, feet), [box(CLIMB + 0.1)], STEP, CLIMB)).toBe(true);
    // (Without the limit, which is how robots are tested, it is only a matter of where the feet are.)
    expect(resolveCircle(body(0.6, 0, 1.9), [box(CLIMB + 0.1)], STEP)).toBe(false);
  });

  it('something tall is still walked under when it starts above the head', () => {
    const lintel = makeCollider(0, 0, 0.5, 0.5, 0, 2.3, 3);
    expect(resolveCircle(body(0, 0), [lintel], STEP, CLIMB)).toBe(false);
    // ...and stops a head that a jump has lifted into it.
    expect(resolveCircle(body(0, 0, apex), [lintel], STEP, CLIMB)).toBe(true);
  });

  it('can be asked about the tall things alone, or the low ones alone', () => {
    const world = [box(0.82), makeCollider(2, 0, 0.5, 0.5, 0, 0, 3)];
    expect(resolveCircle(body(0.6, 0), world, STEP, CLIMB, 'tall')).toBe(false);
    expect(resolveCircle(body(0.6, 0), world, STEP, CLIMB, 'low')).toBe(true);
    expect(resolveCircle(body(1.4, 0), world, STEP, CLIMB, 'tall')).toBe(true);
    expect(resolveCircle(body(1.4, 0), world, STEP, CLIMB, 'low')).toBe(false);
  });

  it('the top of something low is ground to land on; the top of something tall never is', () => {
    expect(groundHeight(body(0, 0, 0.7), [box(0.82)], STEP, 0, CLIMB)).toBeCloseTo(0.82);
    // Not yet high enough: still the floor under the feet.
    expect(groundHeight(body(0, 0, 0.3), [box(0.82)], STEP, 0, CLIMB)).toBe(0);
    // Standing on a crate a metre high beside something 1.25 m high: a step up by height, and still not ground.
    expect(groundHeight(body(0, 0, 1.0), [box(1.25)], STEP, 0, CLIMB)).toBe(0);
    expect(groundHeight(body(0, 0, 1.0), [box(1.25)], STEP)).toBeCloseTo(1.25);
  });

  it('so nothing can be climbed in stages: from the top of a low thing, a taller one beside it is as solid as from the floor', () => {
    const crate = makeCollider(0, 0, 0.5, 0.5, 0, 0, 0.95);
    const cart = makeCollider(1.0, 0, 0.5, 0.5, 0, 0, 1.25);
    // On the crate, at the top of a jump from it, leaning toward the cart.
    const b = body(0.4, 0, 0.95 + apex);
    expect(resolveCircle(b, [crate, cart], STEP, CLIMB)).toBe(true);
    expect(b.x).toBeLessThanOrEqual(0.5 - PLAYER.radius + 1e-6);
  });
});

describe('standing everywhere a jump allows', () => {
  const bounds = { x0: -10, x1: 10, z0: -10, z1: 10 };
  const walkable = [[-10, -10, 10, 10]] as const;
  const robot = { radius: ROBOT.radius + 0.06, stepHeight: 0.3, height: 1.8 };
  const player = { radius: PLAYER.radius - 0.05, stepHeight: STEP, height: PLAYER.height, climb: CLIMB };
  const entries: Array<[number, number]> = [[-6, -6]];
  const reach = ROBOT.attackRange - 0.1;
  const stand = (colliders: Collider[]) => {
    const robots = createNavGrid(bounds, 0.3, colliders, robot.radius, robot.stepHeight, robot.height, walkable, entries);
    return findStandableOutOfReach(bounds, 0.1, colliders, robots, player, [0, 0], reach);
  };
  /** A fence 1 m high round a square 5 m across in the middle of the floor, with gaps in it on the west and east sides if asked. */
  const fence = (gaps: boolean): Collider[] => {
    const t = 0.05;
    const runs: Collider[] = [makeCollider(0, -2.5, 2.5 + t, t, 0, 0, 1), makeCollider(0, 2.5, 2.5 + t, t, 0, 0, 1)];
    for (const x of [-2.5, 2.5]) {
      if (gaps) runs.push(makeCollider(x, -1.75, t, 0.8, 0, 0, 1), makeCollider(x, 1.75, t, 0.8, 0, 0, 1));
      else runs.push(makeCollider(x, 0, t, 2.5 + t, 0, 0, 1));
    }
    return runs;
  };

  it('a fence with no way through for robots leaves the middle of what it encloses out of their reach', () => {
    const found = stand(fence(false));
    const patches = groupSafeSpots(found.spots, 0.1);
    expect(patches.length).toBe(1);
    expect(Math.abs(patches[0]!.x)).toBeLessThan(0.3);
    expect(Math.abs(patches[0]!.z)).toBeLessThan(0.3);
    expect(patches[0]!.deepest).toBeGreaterThan(2.5);
  });

  it('the same fence with a gateway on two sides leaves nowhere out of reach', () => {
    const found = stand(fence(true));
    expect(found.spots).toHaveLength(0);
    // And the player was stood inside it, and on the fence itself.
    expect(found.hardest.some((spot) => spot.y > 0.9)).toBe(true);
  });

  it('a heap of low things deep in a corner is flagged; with the back of it too tall to climb, it is not', () => {
    // Four drums in a square in the corner, wall to wall: the back one is 1.6 m from the open floor.
    const walls = [makeCollider(-10.25, 0, 0.25, 10.5, 0, 0, 3), makeCollider(0, -10.25, 10.5, 0.25, 0, 0, 3)];
    const drum = (x: number, z: number, top: number) => makeCollider(-10 + x, -10 + z, 0.32, 0.32, 0, 0, top);
    const low = stand([...walls, drum(0.35, 0.35, 0.93), drum(1.05, 0.35, 0.93), drum(0.35, 1.05, 0.93), drum(1.05, 1.05, 0.93)]);
    expect(low.spots.length).toBeGreaterThan(0);
    const stacked = stand([...walls, drum(0.35, 0.35, 1.86), drum(1.05, 0.35, 1.86), drum(0.35, 1.05, 0.93), drum(1.05, 1.05, 0.93)]);
    expect(stacked.spots).toHaveLength(0);
  });

  it('with the climbing height set to one step, the fence is a wall again and nothing inside it is stood on', () => {
    const robots = createNavGrid(bounds, 0.3, fence(false), robot.radius, robot.stepHeight, robot.height, walkable, entries);
    const found = findStandableOutOfReach(bounds, 0.1, fence(false), robots, { ...player, climb: STEP }, [5, 5], reach);
    expect(found.spots).toHaveLength(0);
  });
});
