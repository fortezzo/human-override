// Is there anywhere the player can stand that no robot can reach?
//
// The player is narrower than a robot, so a gap that stops a robot may let
// the player through. If what lies beyond it is deeper than a robot's
// reach, the player can stand there for ever and the round never ends. This
// finds every such spot, so the map can be checked for them automatically
// (the first time it ran it found whole aisles between the server racks).
//
// Pure logic: no rendering, no browser APIs.

import { colliderContains, resolveCircle, type CircleBody, type Collider } from './collision';
import { cellCentre, createNavGrid, nearestReachableCell, type NavBounds, type NavGrid, type NavRect } from './navGrid';

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


/**
 * The same question, asked by standing everywhere instead of by reading a
 * floor plan: every place the player can come to stand, by the game's own
 * rules of movement, from which no robot can be within striking distance.
 *
 * The check above looks at the floor only. It missed the one spot a player
 * actually found, because that spot was not on the floor: a jump put the
 * player on top of a barrel, and a cluster of barrels in a corner is wider
 * than a robot's reach. This one samples positions every `step` metres
 * across the whole map, at floor level and on top of everything that can
 * be stood on, starting from where the player starts and going wherever
 * the rules of movement allow: on the level, down any drop, and up onto
 * anything whose top is no higher than `climb` above the floor (the
 * game's own rule: see resolveCircle in collision.ts). That takes in the
 * top of every low thing, and any floor fenced off by low things, which is
 * everywhere a jump can put the player. (Give it one step for `climb` and
 * it reports the map as it is for someone who cannot jump.)
 *
 * `robots` is the game's own map of where a robot can stand. Returns how
 * many places were stood on, those out of reach, and the `count` most
 * awkward places that are still within reach (no two of them within
 * `apart` metres of each other), so that the game itself can be asked to
 * send a robot to each and see the blow land.
 */
export function findStandableOutOfReach(
  bounds: NavBounds,
  step: number,
  colliders: readonly Collider[],
  robots: NavGrid,
  player: Walker & { climb: number },
  start: readonly [number, number],
  reach: number,
  count = 16,
  apart = 5,
): { stoodOn: number; spots: SafeSpot[]; hardest: Array<SafeSpot & { y: number }> } {
  const cols = Math.ceil((bounds.x1 - bounds.x0) / step);
  const rows = Math.ceil((bounds.z1 - bounds.z0) / step);
  const body: CircleBody = { x: 0, z: 0, radius: player.radius, feet: 0, head: 0 };
  const tops = colliders.filter((c) => c.y1 > 0.02 && c.y1 <= player.climb);
  /** Whether someone standing with their feet at this height here is clear of everything solid. */
  const fits = (x: number, y: number, z: number): boolean => {
    body.x = x;
    body.z = z;
    body.feet = y;
    body.head = y + player.height;
    return !resolveCircle(body, colliders, player.stepHeight, player.climb);
  };
  /** The heights that can be stood at over each sample point: the floor, and the top of anything under the feet there. */
  const levels = new Map<number, number[]>();
  const levelsAt = (col: number, row: number): number[] => {
    const key = row * cols + col;
    let found = levels.get(key);
    if (!found) {
      const x = bounds.x0 + (col + 0.5) * step;
      const z = bounds.z0 + (row + 0.5) * step;
      const candidates = [0];
      for (const c of tops) if (!candidates.includes(c.y1) && colliderContains(c, x, z, player.radius * 0.35)) candidates.push(c.y1);
      found = candidates.filter((y) => fits(x, y, z)).sort((a, b) => a - b);
      levels.set(key, found);
    }
    return found;
  };

  const startCol = Math.floor((start[0] - bounds.x0) / step);
  const startRow = Math.floor((start[1] - bounds.z0) / step);
  const seen = new Set<string>();
  const queue: Array<[number, number, number]> = [];
  const visit = (col: number, row: number, y: number): void => {
    const key = `${col},${row},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    queue.push([col, row, y]);
  };
  for (const y of levelsAt(startCol, startRow)) if (y <= player.stepHeight) visit(startCol, startRow, y);

  const dropReach = player.radius * 1.8;
  const dropCells = Math.floor(dropReach / step);
  const spots: SafeSpot[] = [];
  const awkward: Array<SafeSpot & { y: number }> = [];
  const rings = Math.ceil((reach + 2) / robots.cell);
  for (let head = 0; head < queue.length; head++) {
    const [col, row, y] = queue[head]!;
    const x = bounds.x0 + (col + 0.5) * step;
    const z = bounds.z0 + (row + 0.5) * step;
    const nearest = nearestReachableCell(robots, x, z, rings);
    const gap = nearest < 0 ? Infinity : Math.hypot(cellCentre(robots, nearest).x - x, cellCentre(robots, nearest).z - z);
    if (gap > reach) spots.push({ x, z, gap });
    else if (gap > robots.cell) awkward.push({ x, z, y, gap });
    // To the samples next to this one, at whatever height can be stood at
    // there: on the level, down, or up (everything that can be stood on is
    // low enough to jump onto from the floor). And to those a little
    // further off (within `dropReach`) when the difference in height is
    // more than a step: there is a band round anything raised where a body
    // can stand neither on the floor (too near its side) nor on top (not
    // yet over it), and someone who drops off it, or jumps up onto it,
    // crosses that band. (Never far enough to cross a wall: the two sides
    // of the thinnest wall are further apart than that for a body this
    // wide.)
    for (let dr = -dropCells; dr <= dropCells; dr++) {
      for (let dc = -dropCells; dc <= dropCells; dc++) {
        if (dr === 0 && dc === 0) continue;
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const beside = Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
        if (!beside && (dr * dr + dc * dc) * step * step > dropReach * dropReach) continue;
        for (const next of levelsAt(c, r)) {
          if (beside || next < y - player.stepHeight || next > y + player.stepHeight + 1e-6) visit(c, r, next);
        }
      }
    }
  }
  awkward.sort((a, b) => b.gap - a.gap);
  const hardest: Array<SafeSpot & { y: number }> = [];
  for (const spot of awkward) {
    if (hardest.length >= count) break;
    if (hardest.every((other) => Math.hypot(other.x - spot.x, other.z - spot.z) >= apart)) hardest.push(spot);
  }
  return { stoodOn: queue.length, spots, hardest };
}
