// Is there anywhere the player can stand that no robot can reach?
//
// The player is narrower than a robot, so a gap that stops a robot may let
// the player through. If what lies beyond it is deeper than a robot's
// reach, the player can stand there for ever and the round never ends. This
// finds every such spot, so the map can be checked for them automatically
// (the first time it ran it found whole aisles between the server racks).
//
// Pure logic: no rendering, no browser APIs.

import type { Collider } from './collision';
import { cellCentre, createNavGrid, nearestReachableCell, type NavBounds, type NavRect } from './navGrid';

export interface Walker {
  radius: number;
  stepHeight: number;
  height: number;
}

export interface SafeSpot {
  x: number;
  z: number;
  /** How far the nearest spot a robot can stand on is from here, in metres. */
  gap: number;
}

/**
 * Every square the player can walk to that is further than `reach` from
 * anywhere a robot can stand. `colliders` should be the map with every door
 * open; `entries` are where robots come in; `start` is where the player
 * begins. `robotCell` must be the square size the game's own path-finding
 * uses (a coarse grid can close a gap a robot would physically fit
 * through, and that is exactly the kind of pocket this is looking for);
 * `playerCell` should be finer, to follow the player into narrow places.
 */
export function findSafeSpots(
  bounds: NavBounds,
  robotCell: number,
  playerCell: number,
  colliders: readonly Collider[],
  walkable: readonly NavRect[],
  entries: ReadonlyArray<readonly [number, number]>,
  robot: Walker,
  player: Walker,
  start: readonly [number, number],
  reach: number,
): SafeSpot[] {
  const forRobots = createNavGrid(bounds, robotCell, colliders, robot.radius, robot.stepHeight, robot.height, walkable, entries);
  // The same map for someone the player's size, reachable from where they start.
  const forPlayer = createNavGrid(bounds, playerCell, colliders, player.radius, player.stepHeight, player.height, walkable, [start]);
  const spots: SafeSpot[] = [];
  for (let index = 0; index < forPlayer.reach.length; index++) {
    if (!forPlayer.reach[index]) continue;
    const { x, z } = cellCentre(forPlayer, index);
    const nearest = nearestReachableCell(forRobots, x, z, Math.ceil((reach + 2) / robotCell));
    const gap = nearest < 0 ? Infinity : Math.hypot(cellCentre(forRobots, nearest).x - x, cellCentre(forRobots, nearest).z - z);
    if (gap > reach) spots.push({ x, z, gap });
  }
  return spots;
}

/** Group safe spots that touch into patches, largest first: [centre x, centre z, squares, deepest gap]. */
export function groupSafeSpots(spots: readonly SafeSpot[], cell: number): Array<{ x: number; z: number; squares: number; deepest: number }> {
  const left = new Set(spots.map((_, i) => i));
  const patches: Array<{ x: number; z: number; squares: number; deepest: number }> = [];
  while (left.size) {
    const first = left.values().next().value as number;
    left.delete(first);
    const members = [first];
    for (let head = 0; head < members.length; head++) {
      const a = spots[members[head]!]!;
      for (const other of [...left]) {
        const b = spots[other]!;
        if (Math.abs(a.x - b.x) <= cell * 1.5 && Math.abs(a.z - b.z) <= cell * 1.5) {
          left.delete(other);
          members.push(other);
        }
      }
    }
    const xs = members.map((i) => spots[i]!.x);
    const zs = members.map((i) => spots[i]!.z);
    patches.push({
      x: xs.reduce((a, b) => a + b, 0) / xs.length,
      z: zs.reduce((a, b) => a + b, 0) / zs.length,
      squares: members.length,
      deepest: Math.max(...members.map((i) => spots[i]!.gap)),
    });
  }
  return patches.sort((a, b) => b.squares - a.squares);
}

