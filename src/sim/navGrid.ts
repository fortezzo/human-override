// How robots find their way to the player without ever getting stuck.
//
// The walkable floor is cut into a grid of small squares. From the square
// the player stands in, we flood outward and write into every reachable
// square how far it is from the player (walking around obstacles). A robot
// anywhere on the map then only has to step toward a neighbouring square
// with a smaller number: there is always one, so it can never be trapped,
// and one flood serves any number of robots.
//
// Pure logic: no rendering, no browser APIs.

import { colliderContains, type Collider } from './collision';

export interface NavGrid {
  x0: number;
  z0: number;
  cell: number;
  cols: number;
  rows: number;
  /** 1 where a robot cannot stand. */
  blocked: Uint8Array;
  /** 1 where nothing may ever walk (outside the allowed regions), whatever the obstacles. */
  mask: Uint8Array;
  /**
   * 1 where a robot can actually get to: open floor joined to one of the
   * places robots come in. A gap too narrow for a robot can leave a patch
   * of open floor cut off from the rest (a "pocket"); those squares are 0.
   */
  reach: Uint8Array;
  /** The places robots come in (their squares), which is what "can get to" is measured from. */
  anchors: number[];
  /** Walking distance to the current goal, or Infinity if unreachable. */
  distance: Float32Array;
  /** Goal square of the last flood (-1 before the first). */
  goal: number;
  /**
   * Counts the times the map of the floor has changed (a door opening or
   * shutting). Anything that keeps its own flood of this grid compares the
   * number with the one it saw last, and floods again if it has moved on.
   */
  version: number;
  /** The size of robot the grid was built for. */
  agentRadius: number;
  stepHeight: number;
  agentHeight: number;
}

export interface NavBounds {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** A rectangle on the ground: [x0, z0, x1, z1]. */
export type NavRect = readonly [number, number, number, number];

/**
 * Build the grid. A square is blocked when its centre is within
 * `agentRadius` of any obstacle tall enough to stop a walking robot. With
 * `walkable`, squares outside every one of those rectangles are blocked
 * too, which keeps robots to the approaches built for them. `anchors` are
 * the places robots come in; without any, all open floor counts as
 * somewhere a robot can get to.
 */
export function createNavGrid(
  bounds: NavBounds,
  cell: number,
  colliders: readonly Collider[],
  agentRadius: number,
  stepHeight: number,
  agentHeight: number,
  walkable?: readonly NavRect[],
  anchors: ReadonlyArray<readonly [number, number]> = [],
): NavGrid {
  const cols = Math.ceil((bounds.x1 - bounds.x0) / cell);
  const rows = Math.ceil((bounds.z1 - bounds.z0) / cell);
  const mask = new Uint8Array(cols * rows);
  if (walkable) {
    mask.fill(1);
    for (const [rx0, rz0, rx1, rz1] of walkable) {
      const c0 = Math.max(0, Math.ceil((rx0 - bounds.x0) / cell - 0.5));
      const c1 = Math.min(cols - 1, Math.floor((rx1 - bounds.x0) / cell - 0.5));
      const r0 = Math.max(0, Math.ceil((rz0 - bounds.z0) / cell - 0.5));
      const r1 = Math.min(rows - 1, Math.floor((rz1 - bounds.z0) / cell - 0.5));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) mask[r * cols + c] = 0;
    }
  }
  const grid: NavGrid = {
    x0: bounds.x0,
    z0: bounds.z0,
    cell,
    cols,
    rows,
    blocked: mask.slice(),
    mask,
    reach: new Uint8Array(cols * rows),
    anchors: [],
    distance: new Float32Array(cols * rows).fill(Infinity),
    goal: -1,
    version: 0,
    agentRadius,
    stepHeight,
    agentHeight,
  };
  blockColliders(grid, colliders);
  grid.anchors = anchors.map(([x, z]) => nearestOpenCell(grid, x, z)).filter((index) => index >= 0);
  markReach(grid);
  return grid;
}

/**
 * Work out which open squares a robot can actually get to: everything
 * joined to a place robots come in. Called again whenever a door changes.
 */
export function markReach(grid: NavGrid): void {
  const { cols, rows, blocked, reach } = grid;
  if (!grid.anchors.length) {
    for (let i = 0; i < reach.length; i++) reach[i] = blocked[i] ? 0 : 1;
    return;
  }
  reach.fill(0);
  const queue: number[] = [];
  for (const anchor of grid.anchors) {
    if (blocked[anchor] || reach[anchor]) continue;
    reach[anchor] = 1;
    queue.push(anchor);
  }
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head]!;
    const c = index % cols;
    const r = (index - c) / cols;
    for (let k = 0; k < 8; k++) {
      const nc = c + DC[k]!;
      const nr = r + DR[k]!;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const next = nr * cols + nc;
      if (blocked[next] || reach[next]) continue;
      // The same rule as walking: never cut across the corner of an obstacle.
      if (k >= 4 && (blocked[r * cols + nc] || blocked[nr * cols + c])) continue;
      reach[next] = 1;
      queue.push(next);
    }
  }
}

/** Mark the squares that each obstacle (grown by the robot's radius) covers. */
export function blockColliders(grid: NavGrid, colliders: readonly Collider[], within?: NavRect): void {
  const { cols, rows, cell, blocked, agentRadius } = grid;
  for (const o of colliders) {
    if (o.y1 <= grid.stepHeight || o.y0 >= grid.agentHeight) continue;
    // The box's footprint as an axis-aligned rectangle, grown by the radius.
    const ex = Math.abs(o.cos) * o.hx + Math.abs(o.sin) * o.hz + agentRadius;
    const ez = Math.abs(o.sin) * o.hx + Math.abs(o.cos) * o.hz + agentRadius;
    let x0 = o.x - ex;
    let x1 = o.x + ex;
    let z0 = o.z - ez;
    let z1 = o.z + ez;
    if (within) {
      x0 = Math.max(x0, within[0]);
      z0 = Math.max(z0, within[1]);
      x1 = Math.min(x1, within[2]);
      z1 = Math.min(z1, within[3]);
      if (x0 > x1 || z0 > z1) continue;
    }
    const c0 = Math.max(0, Math.floor((x0 - grid.x0) / cell));
    const c1 = Math.min(cols - 1, Math.floor((x1 - grid.x0) / cell));
    const r0 = Math.max(0, Math.floor((z0 - grid.z0) / cell));
    const r1 = Math.min(rows - 1, Math.floor((z1 - grid.z0) / cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (!blocked[i] && colliderContains(o, grid.x0 + (c + 0.5) * cell, grid.z0 + (r + 0.5) * cell, agentRadius)) blocked[i] = 1;
      }
    }
  }
}

/**
 * Work out one patch of the grid again from scratch, after something in it
 * changed (a door opened or closed). `colliders` is everything solid now.
 */
export function refreshRegion(grid: NavGrid, region: NavRect, colliders: readonly Collider[]): void {
  const { cols, rows, cell } = grid;
  const pad = grid.agentRadius + cell;
  const rect: NavRect = [region[0] - pad, region[1] - pad, region[2] + pad, region[3] + pad];
  const c0 = Math.max(0, Math.floor((rect[0] - grid.x0) / cell));
  const c1 = Math.min(cols - 1, Math.floor((rect[2] - grid.x0) / cell));
  const r0 = Math.max(0, Math.floor((rect[1] - grid.z0) / cell));
  const r1 = Math.min(rows - 1, Math.floor((rect[3] - grid.z0) / cell));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) grid.blocked[r * cols + c] = grid.mask[r * cols + c]!;
  blockColliders(grid, colliders, rect);
  markReach(grid);
  // Whatever was flooded before is out of date.
  grid.goal = -1;
  grid.version++;
}

export function cellAt(grid: NavGrid, x: number, z: number): number {
  const c = Math.floor((x - grid.x0) / grid.cell);
  const r = Math.floor((z - grid.z0) / grid.cell);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return -1;
  return r * grid.cols + c;
}

export function cellCentre(grid: NavGrid, index: number): { x: number; z: number } {
  const c = index % grid.cols;
  const r = (index - c) / grid.cols;
  return { x: grid.x0 + (c + 0.5) * grid.cell, z: grid.z0 + (r + 0.5) * grid.cell };
}

/** The nearest square that is not blocked, searching outward in rings. */
export function nearestOpenCell(grid: NavGrid, x: number, z: number, maxRings = 8): number {
  return nearestCell(grid, x, z, maxRings, grid.blocked, 0);
}

/**
 * The nearest square a robot can get to. This is what "go to the player"
 * aims for when the player is standing somewhere robots cannot go (inside
 * a pocket, or tight against a wall): they come as close as they can.
 *
 * Nearest on the player's side of the wall, that is. The nearest square of
 * all can be in the next room, half a metre away through the brickwork,
 * and a whole round of robots once stood there, pressed against the wrong
 * side of a wall, while the player they wanted stood untouched in a corner
 * of the lobby. A square with a wall between it and the point is only
 * settled for when there is no other within reach of the search.
 */
export function nearestReachableCell(grid: NavGrid, x: number, z: number, maxRings = 40): number {
  const sameSide = nearestCell(grid, x, z, maxRings, grid.reach, 1, true);
  return sameSide >= 0 ? sameSide : nearestCell(grid, x, z, maxRings, grid.reach, 1);
}

/**
 * Is there a wall on the straight line between two points? A wall is floor
 * that nothing may ever walk on (the gaps between the rooms' own floors):
 * furniture does not count, since a robot reaches over a desk.
 */
export function wallBetween(grid: NavGrid, ax: number, az: number, bx: number, bz: number): boolean {
  const length = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(length / (grid.cell * 0.5)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = Math.floor((ax + (bx - ax) * t - grid.x0) / grid.cell);
    const r = Math.floor((az + (bz - az) * t - grid.z0) / grid.cell);
    if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows || grid.mask[r * grid.cols + c]) return true;
  }
  return false;
}

/** The nearest square where `flags` has the value `wanted`, searching outward in rings; with `sameSide`, only squares with no wall between them and the point. */
function nearestCell(grid: NavGrid, x: number, z: number, maxRings: number, flags: Uint8Array, wanted: number, sameSide = false): number {
  const c0 = Math.min(grid.cols - 1, Math.max(0, Math.floor((x - grid.x0) / grid.cell)));
  const r0 = Math.min(grid.rows - 1, Math.max(0, Math.floor((z - grid.z0) / grid.cell)));
  let best = -1;
  let bestDist = Infinity;
  for (let ring = 0; ring <= maxRings; ring++) {
    for (let r = r0 - ring; r <= r0 + ring; r++) {
      for (let c = c0 - ring; c <= c0 + ring; c++) {
        if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== ring) continue;
        if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
        const i = r * grid.cols + c;
        if (flags[i] !== wanted) continue;
        const cx = grid.x0 + (c + 0.5) * grid.cell - x;
        const cz = grid.z0 + (r + 0.5) * grid.cell - z;
        const d = cx * cx + cz * cz;
        if (d < bestDist && !(sameSide && wallBetween(grid, x, z, x + cx, z + cz))) {
          bestDist = d;
          best = i;
        }
      }
    }
    // A square found in this ring may still be beaten by one in the next
    // (rings are square, distance is round), so look one ring further.
    if (best >= 0 && (ring - 1) * grid.cell >= Math.sqrt(bestDist)) return best;
  }
  return best;
}

// Neighbour offsets: four straight, four diagonal.
const DC = [1, -1, 0, 0, 1, 1, -1, -1];
const DR = [0, 0, 1, -1, 1, -1, 1, -1];
const COST = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

/**
 * Flood walking distances outward from the goal. Returns false if the goal
 * is off the grid or sealed in. Skips the work if the goal square is the
 * same as last time.
 */
export function floodFrom(grid: NavGrid, goalX: number, goalZ: number): boolean {
  let goal = cellAt(grid, goalX, goalZ);
  // A goal robots cannot get to (inside a wall's margin, or in a pocket of
  // floor cut off by a gap too narrow for them) is swapped for the nearest
  // square they can. Flooding from the pocket itself would reach nothing
  // outside it, and every robot on the map would stand still.
  if (goal < 0 || !grid.reach[goal]) goal = nearestReachableCell(grid, goalX, goalZ);
  if (goal < 0) return false;
  if (goal === grid.goal) return true;
  grid.goal = goal;

  const { cols, rows, blocked, distance } = grid;
  distance.fill(Infinity);
  distance[goal] = 0;

  // Dijkstra's algorithm with a small binary heap of [distance, cell].
  const heapCell: number[] = [goal];
  const heapDist: number[] = [0];
  const push = (cell: number, dist: number) => {
    let i = heapCell.length;
    heapCell.push(cell);
    heapDist.push(dist);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heapDist[parent]! <= dist) break;
      heapCell[i] = heapCell[parent]!;
      heapDist[i] = heapDist[parent]!;
      i = parent;
    }
    heapCell[i] = cell;
    heapDist[i] = dist;
  };
  const pop = (): number => {
    const top = heapCell[0]!;
    const lastCell = heapCell.pop()!;
    const lastDist = heapDist.pop()!;
    const n = heapCell.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let child = i * 2 + 1;
        if (child >= n) break;
        if (child + 1 < n && heapDist[child + 1]! < heapDist[child]!) child++;
        if (heapDist[child]! >= lastDist) break;
        heapCell[i] = heapCell[child]!;
        heapDist[i] = heapDist[child]!;
        i = child;
      }
      heapCell[i] = lastCell;
      heapDist[i] = lastDist;
    }
    return top;
  };

  while (heapCell.length) {
    const dist = heapDist[0]!;
    const cell = pop();
    if (dist > distance[cell]!) continue;
    const c = cell % cols;
    const r = (cell - c) / cols;
    for (let k = 0; k < 8; k++) {
      const nc = c + DC[k]!;
      const nr = r + DR[k]!;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const next = nr * cols + nc;
      if (blocked[next]) continue;
      // Never cut across the corner of an obstacle.
      if (k >= 4 && (blocked[r * cols + nc] || blocked[nr * cols + c])) continue;
      // Rounded to the precision the grid stores, so the "is this heap entry
      // stale?" check above compares like with like.
      const nd = Math.fround(dist + COST[k]!);
      if (nd < distance[next]!) {
        distance[next] = nd;
        push(next, nd);
      }
    }
  }
  return true;
}

/** True if a straight walk between two squares crosses no blocked square. */
export function clearLine(grid: NavGrid, from: number, to: number): boolean {
  const { cols, blocked } = grid;
  let c = from % cols;
  let r = (from - c) / cols;
  const c1 = to % cols;
  const r1 = (to - c1) / cols;
  const dc = Math.abs(c1 - c);
  const dr = Math.abs(r1 - r);
  const sc = c < c1 ? 1 : -1;
  const sr = r < r1 ? 1 : -1;
  let err = dc - dr;
  for (;;) {
    if (blocked[r * cols + c]) return false;
    if (c === c1 && r === r1) return true;
    const e2 = err * 2;
    // Moving diagonally: both squares being squeezed past must be open too.
    if (e2 > -dr && e2 < dc) {
      if (blocked[r * cols + (c + sc)] || blocked[(r + sr) * cols + c]) return false;
    }
    if (e2 > -dr) {
      err -= dr;
      c += sc;
    }
    if (e2 < dc) {
      err += dc;
      r += sr;
    }
  }
}

export interface Waypoint {
  x: number;
  z: number;
  /** Walking distance from here to the goal, in metres. */
  remaining: number;
}

/**
 * Where a robot standing at (x, z) should walk next: the furthest square
 * along its downhill path that it can reach in a straight line. Looking a
 * few squares ahead gives smooth diagonal paths instead of a staircase.
 * Returns null when there is no route at all.
 */
export function nextWaypoint(grid: NavGrid, x: number, z: number, lookahead = 6): Waypoint | null {
  let start = cellAt(grid, x, z);
  if (start < 0 || !grid.reach[start]) {
    // Shoved into a wall's margin or a dead-end pocket: head for the
    // nearest square with a way out first.
    start = nearestReachableCell(grid, x, z, 8);
    if (start < 0) return null;
    const p = cellCentre(grid, start);
    return { x: p.x, z: p.z, remaining: grid.distance[start]! * grid.cell };
  }
  if (grid.distance[start] === Infinity) return null;

  const { cols, rows, blocked, distance } = grid;
  let current = start;
  let best = start;
  for (let step = 0; step < lookahead; step++) {
    const c = current % cols;
    const r = (current - c) / cols;
    let next = -1;
    let nextDist = distance[current]!;
    for (let k = 0; k < 8; k++) {
      const nc = c + DC[k]!;
      const nr = r + DR[k]!;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const i = nr * cols + nc;
      if (blocked[i]) continue;
      if (k >= 4 && (blocked[r * cols + nc] || blocked[nr * cols + c])) continue;
      if (distance[i]! < nextDist) {
        nextDist = distance[i]!;
        next = i;
      }
    }
    if (next < 0) break;
    current = next;
    if (clearLine(grid, start, current)) best = current;
    else break;
  }
  const p = cellCentre(grid, best);
  return { x: p.x, z: p.z, remaining: distance[start]! * grid.cell };
}
