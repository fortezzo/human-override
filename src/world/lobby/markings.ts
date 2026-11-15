// Paint and grime: stencilled signs, floor markings, hazard zones and the
// leak stains running down the walls.

import type { LevelBuilder } from '../build/LevelBuilder';
import { PAINT, SignAtlas, type Sign } from '../build/SignAtlas';
import { BLAST_DOOR, BREACH, COLUMNS, COLUMN_SIZE, POWER_DOOR, ROOM, VESTIBULE, WINDOWS } from './plan';

type Vec3 = [number, number, number];

export function buildMarkings(b: LevelBuilder, atlas: SignAtlas): void {
  const { x0, x1, z0, z1 } = ROOM;
  const N: Vec3 = [0, 0, 1]; // on the north wall, facing south into the room
  const S: Vec3 = [0, 0, -1];
  const E: Vec3 = [-1, 0, 0];
  const W: Vec3 = [1, 0, 0];
  const FLOOR: Vec3 = [0, 1, 0];

  /** Place a sign by its width; the height follows from its shape. */
  const put = (sign: Sign, centre: Vec3, normal: Vec3, width: number, options: { roll?: number; opacity?: number; emissive?: number; tint?: number } = {}) => {
    b.decal(atlas.texture, centre, normal, width, width / sign.aspect, { ...options, uvRect: sign.uv });
  };

  // ---- North wall: who built this place, and the way out.
  put(atlas.eye(360, PAINT.white, 0.45), [-5.6, 3.05, z0], N, 1.5, { opacity: 0.8 });
  put(atlas.text('SITE 04', { size: 150, wear: 0.4 }), [-5.6, 1.95, z0], N, 2.3, { opacity: 0.85 });
  put(atlas.text('MANUAL OVERRIDE FACILITY', { size: 54, wear: 0.4 }), [-5.6, 1.5, z0], N, 2.6, { opacity: 0.8 });
  put(atlas.text('MAIN ENTRANCE', { size: 70, color: PAINT.yellow, wear: 0.5 }), [0, 3.63, z0 + 0.075], N, 1.9, { opacity: 0.9 });
  put(atlas.text(['ALL VISITORS', 'REPORT TO SECURITY'], { size: 56, box: true, wear: 0.5 }), [4.3, 2.2, z0], N, 1.9, { opacity: 0.8 });
  put(atlas.arrow('right', PAINT.white, 150, 0.5), [5.75, 2.2, z0], N, 0.5, { opacity: 0.8 });

  // ---- South wall: the way deeper in.
  const serverHall = atlas.text('SERVER HALL', { size: 110, color: PAINT.amber, plate: '#0d0f11', wear: 0 });
  put(serverHall, [0, BLAST_DOOR.top + 0.18, z1 - 0.165], S, 2.2, { emissive: 2.6, tint: 0xffb060 });
  // Red paint is darker than the wall in this light, so the two warning
  // signs are painted on a pale panel, the way real hazard signs are.
  put(atlas.text(['NO NETWORKED DEVICES', 'BEYOND THIS POINT'], { size: 58, color: PAINT.red, box: true, plate: PAINT.white, wear: 0.35 }), [4.15, 2.25, z1], S, 2.3, { opacity: 0.9 });
  put(atlas.text(['AIR-GAPPED ZONE', 'AUTHORITY: SITE DIRECTOR'], { size: 40, wear: 0.5 }), [4.15, 1.7, z1], S, 1.9, { opacity: 0.75 });
  put(atlas.text('SECTOR A', { size: 120, wear: 0.5 }), [-4.6, 3.3, z1], S, 2.0, { opacity: 0.7 });
  put(atlas.text('SECURITY LOBBY', { size: 60, wear: 0.5 }), [-4.6, 2.85, z1], S, 2.0, { opacity: 0.7 });

  // ---- East wall: power room.
  const doorZ = (POWER_DOOR.z0 + POWER_DOOR.z1) / 2;
  put(atlas.text('POWER', { size: 120, color: PAINT.yellow, wear: 0.4 }), [x1, POWER_DOOR.top + 0.5, doorZ], E, 1.35, { opacity: 0.9 });
  put(atlas.text(['DANGER', 'HIGH VOLTAGE'], { size: 60, color: PAINT.red, box: true, plate: PAINT.white, wear: 0.4 }), [x1, 2.0, 5.75], E, 1.2, { opacity: 0.9 });
  put(atlas.text('CCTV 01-06', { size: 46, wear: 0.5 }), [x1, 2.75, -4.8], E, 1.1, { opacity: 0.7 });

  // ---- West wall, between the windows.
  put(atlas.text(['KEEP SHUTTERS CLOSED', 'AFTER 2200'], { size: 50, box: true, wear: 0.55 }), [x0, 2.35, -1.0], W, 1.7, { opacity: 0.75 });
  put(atlas.text('A-01', { size: 190, wear: 0.55 }), [x0, 3.6, WINDOWS[1].z + 2.9], W, 1.5, { opacity: 0.6 });

  // ---- Columns carry grid numbers on the faces toward the aisle.
  const half = COLUMN_SIZE / 2 + 0.001;
  COLUMNS.forEach(([cx, cz], i) => {
    const sign = atlas.text(`C${i + 1}`, { size: 120, wear: 0.5 });
    put(sign, [cx + (cx < 0 ? half : -half), 2.3, cz], cx < 0 ? W : E, 0.42, { opacity: 0.75 });
  });

  // ---- Floor paint.
  // Hazard hatching across both big doorways.
  b.decalImage('RoadLines022A', [0, 0, z0 + 0.95], FLOOR, 5.2, 1.7, { opacity: 0.8 });
  b.decalImage('RoadLines022A', [0, 0, z1 - 0.95], FLOOR, 5.0, 1.7, { opacity: 0.5 });
  b.decalImage('RoadLines022A', [x1 - 0.8, 0, doorZ], FLOOR, 1.4, 2.4, { opacity: 0.45 });
  // Centre guide line from the entrance to the blast door, broken by wear.
  const guide = atlas.line(900, 36, PAINT.yellow, 0.75);
  for (const [za, zb] of [
    [-5.1, -2.6],
    [-2.3, 0.9],
    [1.3, 5.1],
  ] as const) {
    put(guide, [0, 0, (za + zb) / 2], FLOOR, zb - za, { roll: Math.PI / 2, opacity: 0.75 });
  }
  put(atlas.text('STOP', { size: 220, color: PAINT.yellow, wear: 0.65 }), [0, 0, -1.55], FLOOR, 1.9, { opacity: 0.8 });
  put(atlas.text(['ID CHECK', 'AHEAD'], { size: 90, color: PAINT.white, wear: 0.7 }), [0, 0, -0.55], FLOOR, 1.5, { opacity: 0.6 });
  put(atlas.arrow('right', PAINT.yellow, 200, 0.6), [5.4, 0, doorZ], FLOOR, 0.9, { opacity: 0.7 });
  put(atlas.eye(300, PAINT.white, 0.75), [0, 0, 3.0], FLOOR, 2.6, { opacity: 0.32 });

  // ---- Corridor outside.
  put(atlas.text('SITE 04', { size: 150, wear: 0.6 }), [VESTIBULE.x1, 2.0, -10.0], E, 2.2, { opacity: 0.6 });

  // ---- Stains: water running down from the pipes, sills and wall heads.
  const stain = (id: 'Leaking003' | 'Leaking004', centre: Vec3, normal: Vec3, w: number, h: number, opacity = 0.75) =>
    b.decalImage(id, centre, normal, w, h, { opacity, tint: 0x5b5a52 });
  stain('Leaking003', [-6.9, 3.0, z0], N, 3.4, 3.4);
  stain('Leaking004', [6.4, 3.3, z0], N, 3.0, 2.9);
  stain('Leaking004', [BREACH.x0 - 1.4, 3.4, z0], N, 2.2, 2.6, 0.6);
  stain('Leaking003', [x1, 3.2, -0.6], E, 3.2, 3.0);
  stain('Leaking004', [x1, 3.4, 6.0], E, 2.0, 2.6, 0.6);
  stain('Leaking004', [-6.8, 3.3, z1], S, 3.2, 2.9);
  stain('Leaking003', [6.9, 3.4, z1], S, 2.8, 2.6, 0.6);
  for (const win of WINDOWS) {
    stain('Leaking003', [x0, 0.62, win.z], W, 2.3, 1.2, 0.85);
  }
  stain('Leaking004', [x0, 3.5, 4.6], W, 3.0, 2.6);
  COLUMNS.forEach(([cx, cz], i) => {
    stain(i % 2 ? 'Leaking003' : 'Leaking004', [cx, 3.2, cz + half], N, 0.7, 2.0, 0.7);
  });
}
