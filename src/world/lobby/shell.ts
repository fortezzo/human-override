// The lobby's structure: floor, two-tone walls with their openings, the
// ring beam and piers that divide them into bays, columns, ceiling and
// steel beams.

import type { LevelBuilder } from '../build/LevelBuilder';
import { BLAST_DOOR, BREACH, COLUMNS, COLUMN_SIZE, GOODS_DOOR, PIER, PIERS, POWER_DOOR, RING_BEAM, ROOM, WINDOW, WINDOWS } from './plan';

type Vec3 = [number, number, number];

/**
 * One stretch of wall from floor (or `y0`) to ceiling (or `y1`): painted
 * concrete below the paint line, painted plaster above it.
 */
function wall(b: LevelBuilder, min: [number, number], max: [number, number], y0 = 0, y1: number = ROOM.height): void {
  const line = ROOM.paintLine;
  if (y0 < line) b.box('wallPaint', [min[0], y0, min[1]], [max[0], Math.min(y1, line), max[1]], { cast: false });
  if (y1 > line) b.box('wall', [min[0], Math.max(y0, line), min[1]], [max[0], y1, max[1]], { cast: false });
}

/** A steel I-beam built from two flanges and a web. `along` is its long axis. */
function beam(b: LevelBuilder, along: 'x' | 'z', from: number, to: number, at: number, top: number, depth: number, width: number): void {
  const flange = 0.035;
  const web = 0.03;
  const part = (lo: number, hi: number, half: number) => {
    const min: Vec3 = along === 'x' ? [from, lo, at - half] : [at - half, lo, from];
    const max: Vec3 = along === 'x' ? [to, hi, at + half] : [at + half, hi, to];
    b.box('rustedSteel', min, max, { collide: false });
  };
  part(top - flange, top, width / 2);
  part(top - depth + flange, top - flange, web / 2);
  part(top - depth, top - depth + flange, width / 2);
}

export function buildShell(b: LevelBuilder): void {
  const { x0, x1, z0, z1, height: h, wall: t } = ROOM;
  const line = ROOM.paintLine;

  // Floor slab. Walking height is always y = 0, so it needs no collision box.
  b.box('floor', [x0 - t, -0.4, z0 - t], [x1 + t, 0, z1 + t], { collide: false, cast: false });

  // Ceiling: corrugated steel deck on a concrete slab.
  b.box('ceilingDeck', [x0 - t, h, z0 - t], [x1 + t, h + 0.25, z1 + t], { collide: false, cast: false });

  // North wall, either side of and above the breach.
  wall(b, [x0 - t, z0 - t], [BREACH.x0, z0]);
  wall(b, [BREACH.x1, z0 - t], [x1 + t, z0]);
  wall(b, [BREACH.x0, z0 - t], [BREACH.x1, z0], BREACH.top);

  // South wall around the blast door.
  wall(b, [x0 - t, z1], [BLAST_DOOR.x0, z1 + t]);
  wall(b, [BLAST_DOOR.x1, z1], [x1 + t, z1 + t]);
  wall(b, [BLAST_DOOR.x0, z1], [BLAST_DOOR.x1, z1 + t], BLAST_DOOR.top);

  // East wall around the power room door.
  wall(b, [x1, z0], [x1 + t, POWER_DOOR.z0]);
  wall(b, [x1, POWER_DOOR.z1], [x1 + t, z1]);
  wall(b, [x1, POWER_DOOR.z0], [x1 + t, POWER_DOOR.z1], POWER_DOOR.top);

  // West wall with its two window openings.
  let from: number = z0;
  for (const win of WINDOWS) {
    wall(b, [x0 - t, from], [x0, win.z - WINDOW.halfWidth]);
    wall(b, [x0 - t, win.z - WINDOW.halfWidth], [x0, win.z + WINDOW.halfWidth], 0, WINDOW.sill);
    wall(b, [x0 - t, win.z - WINDOW.halfWidth], [x0, win.z + WINDOW.halfWidth], WINDOW.head);
    from = win.z + WINDOW.halfWidth;
  }
  // ... and, south of them, the goods door to the loading dock.
  wall(b, [x0 - t, from], [x0, GOODS_DOOR.z0]);
  wall(b, [x0 - t, GOODS_DOOR.z0], [x0, GOODS_DOOR.z1], GOODS_DOOR.top);
  wall(b, [x0 - t, GOODS_DOOR.z1], [x0, z1]);

  // A concrete ring beam runs round the top of the walls, and shallow piers
  // stand under it between the signs and openings. Together with the rail
  // below they divide each long wall into bays, the way a real frame does.
  const beamY = h - RING_BEAM.depth;
  b.box('concreteDark', [x0, beamY, z0], [x1, h, z0 + RING_BEAM.proud], { collide: false, cast: false });
  b.box('concreteDark', [x0, beamY, z1 - RING_BEAM.proud], [x1, h, z1], { collide: false, cast: false });
  b.box('concreteDark', [x0, beamY, z0 + RING_BEAM.proud], [x0 + RING_BEAM.proud, h, z1 - RING_BEAM.proud], { collide: false, cast: false });
  b.box('concreteDark', [x1 - RING_BEAM.proud, beamY, z0 + RING_BEAM.proud], [x1, h, z1 - RING_BEAM.proud], { collide: false, cast: false });
  const pier = (side: 'n' | 's' | 'e' | 'w', at: number) => {
    const half = PIER.width / 2;
    const d = PIER.proud;
    const [min, max]: [[number, number], [number, number]] =
      side === 'n'
        ? [[at - half, z0], [at + half, z0 + d]]
        : side === 's'
          ? [[at - half, z1 - d], [at + half, z1]]
          : side === 'w'
            ? [[x0, at - half], [x0 + d, at + half]]
            : [[x1 - d, at - half], [x1, at + half]];
    b.box('wallPaint', [min[0], 0, min[1]], [max[0], line, max[1]], { collide: false, cast: false });
    b.box('wall', [min[0], line, min[1]], [max[0], beamY, max[1]], { collide: false, cast: false });
  };
  for (const x of PIERS.north) pier('n', x);
  for (const x of PIERS.south) pier('s', x);
  for (const z of PIERS.east) pier('e', z);
  for (const z of PIERS.west) pier('w', z);

  // A steel rail caps the painted band, and a kick plate runs along the floor.
  const rail = (min: Vec3, max: Vec3) => b.box('darkSteel', min, max, { collide: false, cast: false });
  const kick = (min: Vec3, max: Vec3) => b.box('steelPlate', min, max, { collide: false, cast: false });
  const runs: Array<{ axis: 'x' | 'z'; at: number; from: number; to: number; inward: 1 | -1 }> = [
    { axis: 'x', at: z0, from: x0, to: BREACH.x0 - 0.3, inward: 1 },
    { axis: 'x', at: z0, from: BREACH.x1 + 0.3, to: x1, inward: 1 },
    { axis: 'x', at: z1, from: x0, to: BLAST_DOOR.x0 - 0.35, inward: -1 },
    { axis: 'x', at: z1, from: BLAST_DOOR.x1 + 0.35, to: x1, inward: -1 },
    { axis: 'z', at: x1, from: z0, to: POWER_DOOR.z0 - 0.12, inward: -1 },
    { axis: 'z', at: x1, from: POWER_DOOR.z1 + 0.12, to: z1, inward: -1 },
    { axis: 'z', at: x0, from: z0, to: GOODS_DOOR.z0 - 0.3, inward: 1 },
    { axis: 'z', at: x0, from: GOODS_DOOR.z1 + 0.3, to: z1, inward: 1 },
  ];
  for (const run of runs) {
    const a = run.at;
    const b0 = Math.min(a, a + run.inward * 0.03);
    const b1 = Math.max(a, a + run.inward * 0.03);
    const k0 = Math.min(a, a + run.inward * 0.025);
    const k1 = Math.max(a, a + run.inward * 0.025);
    if (run.axis === 'x') {
      rail([run.from, line - 0.03, b0], [run.to, line + 0.03, b1]);
      kick([run.from, 0, k0], [run.to, 0.16, k1]);
    } else {
      rail([b0, line - 0.03, run.from], [b1, line + 0.03, run.to]);
      kick([k0, 0, run.from], [k1, 0.16, run.to]);
    }
  }

  // Columns: concrete, with a hazard-striped steel sleeve at the base and a
  // steel collar where they meet the girders.
  const half = COLUMN_SIZE / 2;
  for (const [cx, cz] of COLUMNS) {
    b.box('concreteDark', [cx - half, 0, cz - half], [cx + half, h - 0.5, cz + half]);
    b.box('hazard', [cx - half - 0.02, 0, cz - half - 0.02], [cx + half + 0.02, 1.0, cz + half + 0.02], { collide: false });
    b.box('darkSteel', [cx - half - 0.03, 1.0, cz - half - 0.03], [cx + half + 0.03, 1.05, cz + half + 0.03], { collide: false });
    b.box('rustedSteel', [cx - half - 0.04, h - 0.62, cz - half - 0.04], [cx + half + 0.04, h - 0.5, cz + half + 0.04], { collide: false });
  }

  // Main girders run north-south over the column lines; lighter joists
  // cross them east-west.
  beam(b, 'z', z0, z1, -4.5, h, 0.5, 0.3);
  beam(b, 'z', z0, z1, 4.5, h, 0.5, 0.3);
  for (const z of [-5.25, -1.75, 1.75, 5.25]) beam(b, 'x', x0, x1, z, h, 0.3, 0.18);
}
