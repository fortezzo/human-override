// What people left behind: the security desk and its wall of monitors, the
// barricade and work lights the last defenders set up, and the storage
// clutter around the edges of the room.

import type * as THREE from 'three';
import type { LevelBuilder } from '../build/LevelBuilder';
import { ROOM } from './plan';
import type { ScreenBank, ScreenFeed } from './ScreenBank';

const HALF_PI = Math.PI / 2;

export interface WorkLights {
  /** Tripod flood light aimed at the breach. */
  flood: { at: [number, number, number]; aim: [number, number, number]; materials: THREE.MeshStandardMaterial[] };
  deskLamp: { at: [number, number, number]; materials: THREE.MeshStandardMaterial[] };
}

/** The security desk in the north-east corner and the monitor wall behind it. */
function buildDesk(b: LevelBuilder, screens: ScreenBank): WorkLights['deskLamp'] {
  const wallX = ROOM.x1;

  // Six CRT monitors on steel wall shelves, facing the room.
  const feeds: ScreenFeed[][] = [
    ['eye', 'static', 'log'],
    ['lockdown', 'eye', 'static'],
  ];
  const columns = [-5.35, -4.8, -4.25];
  const rows = [1.95, 1.38];
  rows.forEach((y, r) => {
    columns.forEach((z, c) => {
      b.box('darkSteel', [wallX - 0.46, y - 0.035, z - 0.24], [wallX, y, z + 0.24], { collide: false });
      b.prop('television_02', { at: [wallX - 0.25, y, z], rotY: -HALF_PI, collide: false });
      screens.add([wallX - 0.25 - 0.128, y + 0.245, z], [-1, 0, 0], 0.3, 0.225, feeds[r]![c]!);
    });
  });
  b.blocker([wallX - 0.5, 0, -5.65], [wallX, 2.4, -3.95]);
  // Cable loom dropping from the monitors to the floor.
  b.cable('cable', [wallX - 0.05, 1.36, -4.0], [wallX - 0.08, 0.03, -3.75], 0.05, 0.018);
  b.cable('cable', [wallX - 0.05, 1.36, -5.6], [wallX - 0.1, 0.03, -5.9], 0.05, 0.014);

  // The desk: the guard sat on the east side, facing the room.
  b.prop('metal_office_desk', { at: [6.9, 0, -4.6], rotY: HALF_PI });
  b.prop('classic_laptop', { at: [6.98, 0.79, -5.05], rotY: HALF_PI + 0.25, collide: false });
  screens.add([6.98 + 0.2, 0.79 + 0.33, -5.05 + 0.06], [0.97, 0, -0.25], 0.4, 0.3, 'log');
  const deskLamp = b.prop('desk_lamp_arm_01', { at: [6.62, 0.88, -3.85], rotY: -2.2, collide: false, unique: true });
  b.prop('clipboard', { at: [6.75, 0.795, -4.45], rotY: 0.6, collide: false, cast: false });
  b.prop('portable_searchlight', { at: [7.1, 0.87, -4.05], rotY: -2.6, collide: false });
  b.prop('SchoolChair_01', { at: [7.95, 0.29, -3.3], rot: [0.05, 1.0, HALF_PI], kind: 'metal' });
  b.prop('metal_trash_can', { part: 'can', at: [5.75, 0, -6.35], rotY: 0.4 });

  // Electrical cabinets along the east wall, south of the monitors.
  b.prop('utility_box_02', { at: [wallX - 0.24, 0, -2.95], rotY: -HALF_PI });
  b.prop('utility_box_01', { at: [wallX - 0.24, 0, 1.25], rotY: -HALF_PI });
  b.prop('power_box_01', { at: [wallX - 0.07, 1.55, 2.05], rotY: -HALF_PI, collide: false });
  b.prop('korean_fire_extinguisher_01', { at: [wallX - 0.2, 0, 5.1], rotY: -HALF_PI });

  return { at: [6.5, 1.5, -4.05], materials: deskLamp };
}

/** The defenders' position: barriers, work lights, ammunition. */
function buildDefences(b: LevelBuilder): WorkLights['flood'] {
  // Road barriers dragged into a staggered line in front of the breach.
  b.prop('concrete_road_barrier', { at: [-1.75, 0, -3.35], rotY: 0.07, kind: 'concrete' });
  b.prop('concrete_road_barrier', { at: [2.05, 0, -4.55], rotY: -0.22, kind: 'concrete' });

  // Tripod flood light pointed at the breach, fed from the cable tray.
  const floodAt: [number, number, number] = [-3.25, 0, 1.3];
  const aim: [number, number, number] = [0, 1.2, -7];
  const yaw = Math.atan2(aim[0] - floodAt[0], aim[2] - floodAt[2]);
  const flood = b.prop('flood_lights', { part: 'standing', at: floodAt, rotY: yaw, collide: false, unique: true });
  b.blocker([floodAt[0] - 0.22, 0, floodAt[2] - 0.22], [floodAt[0] + 0.22, 1.8, floodAt[2] + 0.22]);

  // Ammunition on a crate by the player's starting spot. The two cans on
  // top sit well inside the lid, one along the crate and one across it.
  b.prop('wooden_military_crate', { at: [1.75, 0, 3.2], rotY: 0.45, kind: 'wood' });
  b.prop('ammo_box', { at: [1.47, 0.46, 3.27], rotY: 1.9, collide: false });
  b.prop('ammo_box', { at: [1.97, 0.46, 3.15], rotY: 0.6, collide: false });
  b.prop('ammo_box', { at: [2.5, 0, 2.55], rotY: -0.5, collide: false });
  b.prop('medical_box', { at: [1.25, 0, 4.05], rotY: -0.3, collide: false });
  // The tool chest stands open against the wall by the blast door, lid
  // toward the wall, clear of the crate so the two never read as one heap.
  b.prop('metal_tool_chest', { at: [3.45, 0, ROOM.z1 - 0.32], rotY: Math.PI + 0.06 });
  b.prop('WetFloorSign_01', { at: [3.3, 0, -0.9], rotY: 0.5, collide: false, kind: 'soft' });

  return { at: [floodAt[0] + Math.sin(yaw) * 0.15, 1.62, floodAt[2] + Math.cos(yaw) * 0.15], aim, materials: flood };
}

/** Storage and debris around the edges of the room. */
function buildClutter(b: LevelBuilder): void {
  const { x0, z0, z1 } = ROOM;

  // North-west corner: fuel and chemical drums.
  b.prop('Barrel_01', { at: [x0 + 0.75, 0, z0 + 0.7], rotY: 0.4 });
  b.prop('Barrel_01', { at: [x0 + 1.5, 0, z0 + 0.62], rotY: 2.1 });
  b.prop('barrel_03', { at: [x0 + 0.72, 0, z0 + 1.5], rotY: 1.0 });
  b.prop('barrel_03', { at: [x0 + 2.35, 0, z0 + 0.75], rotY: 0.2 });
  b.prop('barrel_03', { at: [x0 + 1.7, 0.33, z0 + 1.9], rot: [HALF_PI, 0.5, 0] });

  // Between the windows: a hand truck and the boxes that came off it.
  b.prop('hand_truck', { at: [x0 + 0.42, 0, 0.35], rotY: HALF_PI + 0.12 });
  b.prop('cardboard_box_01', { at: [x0 + 1.25, 0, 0.1], rotY: 0.3, kind: 'soft' });
  b.prop('cardboard_box_01', { at: [x0 + 1.3, 0.34, 0.14], rotY: -0.25, kind: 'soft', collide: false });
  b.prop('cardboard_box_01', { at: [x0 + 1.95, 0, -0.55], rotY: 1.3, kind: 'soft' });
  b.prop('metal_stool_02', { at: [x0 + 1.1, 0, 2.9], rotY: 0.3 });
  b.prop('metal_stool_02', { at: [x0 + 1.9, 0.22, 2.2], rot: [HALF_PI, 0.9, 0] });

  // South-west corner: shelving, crates and a parts cart.
  b.prop('worn_metal_rack', { at: [x0 + 2.2, 0, z1 - 0.34], rotY: Math.PI });
  b.prop('worn_metal_rack', { at: [x0 + 3.15, 0, z1 - 0.34], rotY: Math.PI });
  b.prop('cardboard_box_01', { at: [x0 + 2.2, 0.48, z1 - 0.36], rotY: 3.3, kind: 'soft', collide: false, scale: 0.85 });
  b.prop('ammo_box', { at: [x0 + 3.2, 0.98, z1 - 0.34], rotY: 1.6, collide: false });
  b.prop('wooden_military_crate', { at: [x0 + 1.0, 0, z1 - 1.9], rotY: HALF_PI + 0.1, kind: 'wood' });
  b.prop('wooden_military_crate', { at: [x0 + 1.02, 0.46, z1 - 1.95], rotY: HALF_PI - 0.12, kind: 'wood', collide: false });
  b.blocker([x0 + 0.7, 0.46, z1 - 2.6], [x0 + 1.3, 0.92, z1 - 1.3]);
  b.prop('wooden_military_crate', { at: [x0 + 1.9, 0, z1 - 3.4], rotY: 0.35, kind: 'wood' });
  b.prop('industrial_storage_cart', { at: [x0 + 3.3, 0, 3.9], rotY: 0.25 });

  // South-east: steel shelving beside the blast door.
  b.prop('steel_frame_shelves_03', { at: [5.6, 0, z1 - 0.4], rotY: Math.PI });
  b.prop('cardboard_box_01', { at: [4.4, 0, z1 - 1.2], rotY: 0.8, kind: 'soft' });
  b.prop('Barrel_01', { at: [7.9, 0, z1 - 0.8], rotY: 1.2 });

  // Watching from the corners.
  b.prop('security_camera_01', { at: [8.72, 3.95, z0 + 0.3], rotY: -Math.PI / 4 - 0.25, collide: false });
  b.prop('security_camera_01', { at: [x0 + 0.3, 3.95, z1 - 0.32], rotY: (Math.PI * 3) / 4 + 0.3, collide: false });
  b.prop('fire_alarm', { at: [4.5 - 0.351, 1.5, -2.5], rotY: -HALF_PI, collide: false, cast: false });
  b.prop('fire_alarm', { at: [-4.5 + 0.351, 1.5, 2.5], rotY: HALF_PI, collide: false, cast: false });
}

export function buildFurnishing(b: LevelBuilder, screens: ScreenBank): WorkLights {
  const deskLamp = buildDesk(b, screens);
  const flood = buildDefences(b);
  buildClutter(b);
  return { flood, deskLamp };
}
