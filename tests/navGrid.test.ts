import { describe, expect, it } from 'vitest';
import { makeCollider, type Collider } from '../src/sim/collision';
import { cellAt, clearLine, createNavGrid, floodFrom, nearestOpenCell, nextWaypoint } from '../src/sim/navGrid';

const bounds = { x0: -10, x1: 10, z0: -10, z1: 10 };

/** A wall across the middle of the map (z = 0) with a 2 m gap at x = 6..8. */
function wallWithGap(): Collider[] {
  return [makeCollider(-2, 0, 8, 0.25, 0, 0, 3), makeCollider(9, 0, 1, 0.25, 0, 0, 3)];
}

/** Walk an agent along its waypoints and report whether it reached the goal. */
function walk(colliders: Collider[], from: [number, number], to: [number, number], maxSteps = 2000) {
  const grid = createNavGrid(bounds, 0.3, colliders, 0.4, 0.3, 1.8);
  expect(floodFrom(grid, to[0], to[1])).toBe(true);
  let [x, z] = from;
  let travelled = 0;
  for (let i = 0; i < maxSteps; i++) {
    const distance = Math.hypot(to[0] - x, to[1] - z);
    if (distance < 0.6) return { reached: true, travelled, grid };
    const wp = nextWaypoint(grid, x, z);
    if (!wp) return { reached: false, travelled, grid };
    const dx = wp.x - x;
    const dz = wp.z - z;
    const d = Math.hypot(dx, dz) || 1;
    x += (dx / d) * 0.1;
    z += (dz / d) * 0.1;
    travelled += 0.1;
    // The agent must never be steered into a blocked square.
    const cell = cellAt(grid, x, z);
    expect(grid.blocked[cell]).toBe(0);
  }
  return { reached: false, travelled, grid };
}

describe('navigation grid', () => {
  it('walks straight to the goal on open ground', () => {
    const result = walk([], [-6, -6], [6, 6]);
    expect(result.reached).toBe(true);
    // Close to the straight-line distance (17 m), not a staircase.
    expect(result.travelled).toBeLessThan(19.5);
  });

  it('finds the gap in a wall', () => {
    const result = walk(wallWithGap(), [-6, -6], [-6, 6]);
    expect(result.reached).toBe(true);
    expect(result.travelled).toBeGreaterThan(20); // had to detour through the gap
    expect(result.travelled).toBeLessThan(40);
  });

  it('reports no route when the goal is sealed off', () => {
    const sealed = [makeCollider(0, 0, 10, 0.25, 0, 0, 3)];
    const grid = createNavGrid(bounds, 0.3, sealed, 0.4, 0.3, 1.8);
    floodFrom(grid, 0, 6);
    expect(nextWaypoint(grid, 0, -6)).toBeNull();
  });

  it('ignores obstacles low enough to step over and those above head height', () => {
    const kerb = makeCollider(0, 0, 10, 0.25, 0, 0, 0.2);
    const beam = makeCollider(0, 3, 10, 0.25, 0, 2.5, 3);
    const grid = createNavGrid(bounds, 0.3, [kerb, beam], 0.4, 0.3, 1.8);
    expect(grid.blocked.some((b) => b === 1)).toBe(false);
  });

  it('never cuts across the corner of an obstacle', () => {
    const block = [makeCollider(0, 0, 1, 1, 0, 0, 3)];
    const grid = createNavGrid(bounds, 0.5, block, 0.2, 0.3, 1.8);
    const a = cellAt(grid, -1.5, -1.5);
    const b = cellAt(grid, 1.5, 1.5);
    expect(clearLine(grid, a, b)).toBe(false);
    const c = cellAt(grid, -3, -1.5);
    const d = cellAt(grid, 3, -1.5);
    expect(clearLine(grid, c, d)).toBe(true);
  });

  it('routes around a rotated obstacle', () => {
    const slanted = [makeCollider(0, 0, 5, 0.3, Math.PI / 4, 0, 3)];
    const result = walk(slanted, [-4, 4], [4, -4]);
    expect(result.reached).toBe(true);
  });

  it('recovers an agent that has been pushed into a wall margin', () => {
    const grid = createNavGrid(bounds, 0.3, wallWithGap(), 0.4, 0.3, 1.8);
    floodFrom(grid, -6, 6);
    // Standing inside the blocked band right next to the wall.
    const inside = cellAt(grid, -2, -0.5);
    expect(grid.blocked[inside]).toBe(1);
    const wp = nextWaypoint(grid, -2, -0.5);
    expect(wp).not.toBeNull();
    expect(grid.blocked[cellAt(grid, wp!.x, wp!.z)]).toBe(0);
  });

  it('uses the nearest open square when the goal itself is blocked', () => {
    const grid = createNavGrid(bounds, 0.3, wallWithGap(), 0.4, 0.3, 1.8);
    expect(floodFrom(grid, -2, 0)).toBe(true); // goal is inside the wall
    expect(grid.blocked[grid.goal]).toBe(0);
    expect(nearestOpenCell(grid, -2, 0)).toBe(grid.goal);
  });

  it('skips the flood when the goal square has not changed', () => {
    const grid = createNavGrid(bounds, 0.3, [], 0.4, 0.3, 1.8);
    floodFrom(grid, 1, 1);
    const marker = grid.distance[0]!;
    grid.distance[0] = -123; // would be overwritten by a real flood
    floodFrom(grid, 1.05, 1.05);
    expect(grid.distance[0]).toBe(-123);
    floodFrom(grid, 4, 4);
    expect(grid.distance[0]).not.toBe(-123);
    expect(marker).toBeGreaterThan(0);
  });
});

describe('pockets: open floor that robots cannot get to', () => {
  // A small room in the north-east corner whose only way in is a gap 0.7 m
  // wide: enough for a person, not for a robot.
  const pocket = (): Collider[] => [
    // West wall of the room, with the narrow gap at its south end (z = 4 .. 4.7).
    makeCollider(4, 7.35, 0.15, 2.65, 0, 0, 3),
    // South wall.
    makeCollider(7, 4, 3.15, 0.15, 0, 0, 3),
  ];
  const entries: Array<[number, number]> = [[-6, -6]];
  const build = () => createNavGrid(bounds, 0.3, pocket(), 0.42, 0.3, 1.8, undefined, entries);

  it('knows the room is out of reach although its floor is open', () => {
    const grid = build();
    const inside = cellAt(grid, 7, 7);
    expect(grid.blocked[inside]).toBe(0);
    expect(grid.reach[inside]).toBe(0);
    expect(grid.reach[cellAt(grid, 0, 0)]).toBe(1);
  });

  it('sends robots as close as they can get when the player stands in it', () => {
    const grid = build();
    // Before pockets were understood, flooding from inside the room reached
    // nothing outside it, and every robot on the map stood still.
    expect(floodFrom(grid, 7, 7)).toBe(true);
    expect(grid.reach[grid.goal]).toBe(1);
    const waypoint = nextWaypoint(grid, -6, -6);
    expect(waypoint).not.toBeNull();
    expect(Number.isFinite(waypoint!.remaining)).toBe(true);
    // And the square they are sent to is right outside the room, not across the map.
    const c = grid.goal % grid.cols;
    const r = (grid.goal - c) / grid.cols;
    const gx = grid.x0 + (c + 0.5) * grid.cell;
    const gz = grid.z0 + (r + 0.5) * grid.cell;
    expect(Math.hypot(gx - 7, gz - 7)).toBeLessThan(4.5);
  });

  it('walks a robot that has been shoved into the room back out toward open floor', () => {
    const grid = build();
    floodFrom(grid, -5, 5);
    const waypoint = nextWaypoint(grid, 5.2, 4.9);
    expect(waypoint).not.toBeNull();
    expect(grid.reach[cellAt(grid, waypoint!.x, waypoint!.z)]).toBe(1);
  });

  it('counts all open floor as reachable when no entries are given', () => {
    const grid = createNavGrid(bounds, 0.3, pocket(), 0.42, 0.3, 1.8);
    expect(grid.reach[cellAt(grid, 7, 7)]).toBe(1);
  });
});
