// Building services hung from the lobby ceiling and run along its walls:
// the ventilation duct, pipe runs, the cable tray and the light fixtures.

import type * as THREE from 'three';
import type { LevelBuilder } from '../build/LevelBuilder';
import { ROOM } from './plan';

const HALF_PI = Math.PI / 2;

/** Materials of the fixtures that carry lights, so the lighting code can make them glow. */
export interface Fixtures {
  /** Pendant lamps over the central aisle, north to south. */
  pendants: Array<{ z: number; materials: THREE.MeshStandardMaterial[] }>;
  /** Caged strip lights: [x, y, z] of the tube and the fixture's materials. */
  strips: Array<{ at: [number, number, number]; materials: THREE.MeshStandardMaterial[] }>;
}

function buildDuct(b: LevelBuilder): void {
  const { z0, z1, height: h } = ROOM;
  const x = -2.7;
  const y = 4.0;
  // Twelve sections end to end, north to south.
  let z = z0 + 0.1;
  while (z + 1.2 <= z1 - 0.1) {
    b.prop('modular_airduct_rectangular_01', { part: 'double_01', at: [x, y, z], collide: false });
    z += 1.2;
  }
  b.prop('modular_airduct_rectangular_01', { part: 'single_01', at: [x, y, z], collide: false });
  // Grilles blowing out of the duct's flanks.
  for (const [gz, side] of [
    [-4.2, 1],
    [0.6, -1],
    [4.4, 1],
  ] as const) {
    b.prop('modular_airduct_rectangular_01', { part: 'vent_01', at: [x + side * 0.31, y, gz], rotY: side * HALF_PI, collide: false, cast: false });
  }
  // Drop rods and a strap under the duct every few metres.
  for (let hz = z0 + 1.3; hz < z1; hz += 2.4) {
    for (const dx of [-0.37, 0.37]) b.tube('darkSteel', [x + dx, y - 0.3, hz], [x + dx, h, hz], 0.008, false);
    b.box('darkSteel', [x - 0.39, y - 0.32, hz - 0.02], [x + 0.39, y - 0.29, hz + 0.02], { collide: false, cast: false });
  }
}

function buildPipes(b: LevelBuilder): void {
  const { x0, x1, z0, z1, height: h } = ROOM;

  // Three pipes running the length of the east side on trapeze hangers.
  const runs = [
    { x: 7.15, radius: 0.11, key: 'rustedSteel' },
    { x: 7.5, radius: 0.06, key: 'paintedMetal' },
    { x: 7.72, radius: 0.04, key: 'darkSteel' },
  ] as const;
  const y = 4.12;
  for (const run of runs) {
    b.tube(run.key, [run.x, y, z0], [run.x, y, z1], run.radius);
    for (let fz = z0 + 1.6; fz < z1; fz += 3.1) {
      b.tube('darkSteel', [run.x, y, fz - 0.035], [run.x, y, fz + 0.035], run.radius * 1.42);
    }
  }
  for (let hz = z0 + 0.9; hz < z1; hz += 2.9) {
    b.box('darkSteel', [6.95, y - 0.15, hz - 0.025], [7.86, y - 0.115, hz + 0.025], { collide: false, cast: false });
    for (const hx of [6.98, 7.83]) b.tube('darkSteel', [hx, y - 0.13, hz], [hx, h, hz], 0.008, false);
  }

  // Two pipes along the north wall, crossing above the breach.
  b.tube('rustedSteel', [x0, 3.86, z0 + 0.28], [x1, 3.86, z0 + 0.28], 0.075);
  b.tube('paintedMetal', [x0, 3.62, z0 + 0.2], [x1, 3.62, z0 + 0.2], 0.04);
  for (let fx = x0 + 1.2; fx < x1; fx += 2.6) {
    b.tube('darkSteel', [fx - 0.03, 3.86, z0 + 0.28], [fx + 0.03, 3.86, z0 + 0.28], 0.105);
    b.box('darkSteel', [fx + 0.4, 3.55, z0], [fx + 0.44, 3.98, z0 + 0.38], { collide: false, cast: false });
  }

  // Valve stations on the walls, from the pipe kit.
  const kit = 'modular_industrial_pipes_01';
  b.prop(kit, { part: 'pipe02', at: [8.86, 2.1, -1.9], rotY: -HALF_PI, collide: false });
  b.prop(kit, { part: 'pipe03', at: [8.86, 1.5, -0.7], rotY: -HALF_PI, collide: false });
  b.prop(kit, { part: 'pipe08', at: [8.86, 0.9, 0.35], rotY: -HALF_PI, collide: false });
  b.prop(kit, { part: 'pipe02', at: [8.86, 3.4, -1.9], rotY: -HALF_PI, collide: false });
  b.prop(kit, { part: 'pipe02', at: [-8.86, 2.3, -0.9], rotY: HALF_PI, collide: false });
  b.prop(kit, { part: 'pipe05', at: [-8.86, 1.1, -1.0], rotY: HALF_PI, collide: false });
  b.prop(kit, { part: 'pipe02', at: [-8.86, 3.9, -0.9], rotY: HALF_PI, collide: false });
  b.prop(kit, { part: 'pipe03', at: [-5.6, 1.6, 6.86], rotY: Math.PI, collide: false });
  b.blocker([8.7, 0, -2.1], [9, 2.2, 0.6]);
  b.blocker([-9, 0, -1.4], [-8.7, 2.2, -0.5]);
}

function buildCableTray(b: LevelBuilder): void {
  const { x0, x1, height: h } = ROOM;
  const z = 3.3;
  const y = 4.2;
  b.box('darkSteel', [x0, y, z - 0.17], [x1, y + 0.012, z + 0.17], { collide: false });
  b.box('darkSteel', [x0, y, z - 0.18], [x1, y + 0.07, z - 0.165], { collide: false, cast: false });
  b.box('darkSteel', [x0, y, z + 0.165], [x1, y + 0.07, z + 0.18], { collide: false, cast: false });
  const cables: Array<[number, number]> = [
    [-0.11, 0.022],
    [-0.05, 0.03],
    [0.02, 0.018],
    [0.07, 0.024],
    [0.12, 0.016],
  ];
  for (const [dz, radius] of cables) b.tube('cable', [x0, y + 0.014 + radius, z + dz], [x1, y + 0.014 + radius, z + dz], radius, false);
  for (let hx = x0 + 1.1; hx < x1; hx += 2.5) {
    for (const dz of [-0.2, 0.2]) b.tube('darkSteel', [hx, y, z + dz], [hx, h, z + dz], 0.007, false);
  }
  // Cables spilling off the tray down to the work lights and the desk.
  b.cable('cable', [-3.1, y, z], [-3.2, 0.02, 1.45], 0.0, 0.016);
  b.cable('cable', [6.5, y, z], [7.6, 2.4, -3.0], 0.35, 0.014);
}

function buildLamps(b: LevelBuilder): Fixtures {
  const { height: h } = ROOM;
  const pendants: Fixtures['pendants'] = [];
  const strips: Fixtures['strips'] = [];

  // Pendants hang from the four joists over the central aisle.
  const joists = [-5.25, -1.75, 1.75, 5.25];
  joists.forEach((z, i) => {
    const materials = b.prop('hanging_industrial_lamp', { at: [0, h - 0.3, z], rotY: i * 1.3, collide: false, unique: true });
    pendants.push({ z, materials });
  });
  // Power cable swagged from lamp to lamp.
  for (let i = 0; i < joists.length - 1; i++) {
    b.cable('cable', [0.05, h - 0.32, joists[i]!], [0.05, h - 0.32, joists[i + 1]!], 0.22, 0.012);
  }

  // Caged strip lights over the desk and the west side.
  const stripSpots: Array<{ at: [number, number, number]; rotY: number }> = [
    { at: [6.9, h, -4.4], rotY: HALF_PI },
    { at: [-6.6, h, 3.6], rotY: HALF_PI },
    { at: [6.6, h, 4.3], rotY: 0 },
  ];
  for (const spot of stripSpots) {
    const materials = b.prop('caged_hanging_light', { at: spot.at, rotY: spot.rotY, collide: false, unique: true });
    strips.push({ at: [spot.at[0], spot.at[1] - 0.68, spot.at[2]], materials });
  }
  return { pendants, strips };
}

export function buildServices(b: LevelBuilder): Fixtures {
  buildDuct(b);
  buildPipes(b);
  buildCableTray(b);
  return buildLamps(b);
}
