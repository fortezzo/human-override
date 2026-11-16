// The loading dock: the biggest room on the map. A tall freight bay under
// sodium lamps, with three truck bays in its west wall (two of them open
// to the yards the robots cross, one shut with a truck backed up to it),
// shipping containers standing in islands on the floor, a goods passage to
// the security lobby in one corner and a shutter to the server hall.
//
// Its mood is its own: deep orange pools from the high lamps, with a wall
// of cold fog at each open bay and a truck's headlamps cutting across the
// middle of the floor.

import * as THREE from 'three';
import type { Assets } from '../../core/assets';
import { createConeShaft, type DustBeam } from '../../render/atmosphere';
import type { LightDef } from '../../render/lighting';
import type { MaterialKey, MaterialLibrary } from '../../render/materials';
import { LevelBuilder } from '../build/LevelBuilder';
import { approach, column, drum, ibeam, vent, wall, weaponRack, type AreaBuild, type Haze } from '../build/room';
import { PAINT, SignAtlas, type Sign } from '../build/SignAtlas';
import { DOCK, DOCK_BAYS, DOCK_COLUMNS, DOCK_PASSAGE, DOOR_PLANS, ENTRY_PLANS, HALL, LOBBY, RACK_PLANS, WALL } from '../plan';

type Vec3 = [number, number, number];

/** The high lamps: low-pressure sodium, a deep orange. */
const SODIUM = 0xffa245;
const AMBER = 0xff9a2e;
const RED = 0xff2a12;
const HEADLAMP = 0xfff0d2;
const HALF_PI = Math.PI / 2;
/** Thickness of the facing laid over the back of the server hall's wall. */
const SKIN = 0.03;

/** A standard shipping container's width and height. */
const BOX = { width: 2.44, height: 2.59 };

/**
 * A shipping container: corrugated sides between corner posts and rails,
 * doors with their lock rods at one end, and its number stencilled on the
 * side. `at` is its lowest corner; it lies along `along` for `length`
 * metres. One standing on the floor is solid; one stacked on another is
 * out of anybody's reach and is not.
 */
function container(b: LevelBuilder, atlas: SignAtlas, key: MaterialKey, at: Vec3, along: 'x' | 'z', length: number, code: string, doorsAt: 'near' | 'far' = 'far'): void {
  const [x, y, z] = at;
  const sx = along === 'x' ? length : BOX.width;
  const sz = along === 'x' ? BOX.width : length;
  const top = y + BOX.height;
  const grounded = y < 0.1;
  b.box(key, [x + 0.04, y + 0.12, z + 0.04], [x + sx - 0.04, top - 0.1, z + sz - 0.04], { collide: false });
  if (grounded) b.blocker([x, 0, z], [x + sx, top, z + sz]);
  // Corner posts, and the rails along the top and bottom edges.
  for (const px of [x, x + sx - 0.12]) for (const pz of [z, z + sz - 0.12]) b.box('darkSteel', [px, y, pz], [px + 0.12, top, pz + 0.12], { collide: false });
  for (const [y0, y1] of [
    [y, y + 0.14],
    [top - 0.12, top],
  ] as const) {
    b.box('darkSteel', [x, y0, z], [x + sx, y1, z + 0.1], { collide: false, cast: false });
    b.box('darkSteel', [x, y0, z + sz - 0.1], [x + sx, y1, z + sz], { collide: false, cast: false });
    b.box('darkSteel', [x, y0, z], [x + 0.1, y1, z + sz], { collide: false, cast: false });
    b.box('darkSteel', [x + sx - 0.1, y0, z], [x + sx, y1, z + sz], { collide: false, cast: false });
  }
  // The door end: a seam down the middle, four lock rods and their handles.
  const far = doorsAt === 'far';
  const rods = [-0.86, -0.3, 0.3, 0.86];
  if (along === 'x') {
    const fx = far ? x + sx : x;
    const out = far ? 1 : -1;
    const mid = z + sz / 2;
    b.box('darkSteel', [Math.min(fx, fx + out * 0.03), y + 0.16, mid - 0.015], [Math.max(fx, fx + out * 0.03), top - 0.14, mid + 0.015], { collide: false, cast: false });
    for (const d of rods) {
      b.tube('steelPlate', [fx + out * 0.04, y + 0.18, mid + d], [fx + out * 0.04, top - 0.16, mid + d], 0.018, false);
      b.box('steelPlate', [Math.min(fx, fx + out * 0.07), y + 1.05, mid + d - 0.12], [Math.max(fx, fx + out * 0.07), y + 1.13, mid + d + 0.02], { collide: false, cast: false });
    }
  } else {
    const fz = far ? z + sz : z;
    const out = far ? 1 : -1;
    const mid = x + sx / 2;
    b.box('darkSteel', [mid - 0.015, y + 0.16, Math.min(fz, fz + out * 0.03)], [mid + 0.015, top - 0.14, Math.max(fz, fz + out * 0.03)], { collide: false, cast: false });
    for (const d of rods) {
      b.tube('steelPlate', [mid + d, y + 0.18, fz + out * 0.04], [mid + d, top - 0.16, fz + out * 0.04], 0.018, false);
      b.box('steelPlate', [mid + d - 0.12, y + 1.05, Math.min(fz, fz + out * 0.07)], [mid + d + 0.02, y + 1.13, Math.max(fz, fz + out * 0.07)], { collide: false, cast: false });
    }
  }
  // Its number, on both long sides.
  const label = atlas.text(code, { size: 64, color: PAINT.white, wear: 0.5 });
  const lw = 1.5;
  if (along === 'x') {
    b.decal(atlas.texture, [x + sx - 1.2, top - 0.5, z + 0.035], [0, 0, -1], lw, lw / label.aspect, { uvRect: label.uv, opacity: 0.8 });
    b.decal(atlas.texture, [x + 1.2, top - 0.5, z + sz - 0.035], [0, 0, 1], lw, lw / label.aspect, { uvRect: label.uv, opacity: 0.8 });
  } else {
    b.decal(atlas.texture, [x + 0.035, top - 0.5, z + 1.2], [-1, 0, 0], lw, lw / label.aspect, { uvRect: label.uv, opacity: 0.8 });
    b.decal(atlas.texture, [x + sx - 0.035, top - 0.5, z + sz - 1.2], [1, 0, 0], lw, lw / label.aspect, { uvRect: label.uv, opacity: 0.8 });
  }
}

/** A lit lens: a small box that glows whatever light falls on it. */
function lens(b: LevelBuilder, min: Vec3, max: Vec3, color: number, strength: number): void {
  const material = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: strength, roughness: 0.4 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), material);
  mesh.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  b.addObject(mesh);
}

/**
 * A box truck backed up to the shut bay, its nose pointing east into the
 * room: cab, cargo box, six wheels, and its headlamps left on. `rear` is
 * the x of its back end, `z` its centre line.
 */
function truck(b: LevelBuilder, atlas: SignAtlas, rear: number, z: number, lights: LightDef[], haze: Haze[], dustBeams: DustBeam[]): void {
  const nose = rear + 8.3;
  const half = 1.22;
  // Chassis rails, and the cross-members between them.
  for (const dz of [-0.45, 0.45]) b.box('darkSteel', [rear + 0.25, 0.62, z + dz - 0.06], [nose - 0.3, 0.86, z + dz + 0.06], { collide: false });
  for (let x = rear + 0.6; x < nose - 0.6; x += 1.5) b.box('darkSteel', [x - 0.05, 0.66, z - 0.45], [x + 0.05, 0.8, z + 0.45], { collide: false, cast: false });
  // Wheels: one axle under the cab, two under the box (doubled).
  const wheel = (x: number, dz: number, wide: number) => {
    drum(b, 'cable', [x, 0.5, z + dz], 0.5, wide, 'z', 20);
    drum(b, 'steelPlate', [x, 0.5, z + dz + Math.sign(dz) * (wide / 2 + 0.005)], 0.27, 0.02, 'z', 16, false);
    drum(b, 'darkSteel', [x, 0.5, z + dz + Math.sign(dz) * (wide / 2 + 0.012)], 0.1, 0.03, 'z', 10, false);
  };
  for (const side of [-1, 1]) {
    wheel(nose - 1.35, side * (half - 0.17), 0.3);
    wheel(rear + 1.25, side * (half - 0.3), 0.56);
    wheel(rear + 2.4, side * (half - 0.3), 0.56);
    // Mudguards over the rear pair, and a flap behind them.
    b.box('darkSteel', [rear + 0.6, 1.06, z + side * (half - 0.6) - 0.3], [rear + 3.05, 1.1, z + side * (half - 0.6) + 0.3], { collide: false, cast: false });
    b.box('cable', [rear + 0.56, 0.3, z + side * (half - 0.3) - 0.28], [rear + 0.6, 1.0, z + side * (half - 0.3) + 0.28], { collide: false, cast: false });
  }
  // The cargo box: pale panels in a steel frame, a roller door at the back.
  const bx0 = rear + 0.08;
  const bx1 = nose - 2.45;
  const by0 = 1.12;
  const by1 = 3.62;
  b.box('wallDock', [bx0 + 0.03, by0 + 0.08, z - half + 0.03], [bx1 - 0.03, by1 - 0.06, z + half - 0.03], { collide: false });
  for (const [y0, y1] of [
    [by0, by0 + 0.12],
    [by1 - 0.1, by1],
  ] as const) {
    b.box('steelPlate', [bx0, y0, z - half], [bx1, y1, z - half + 0.08], { collide: false, cast: false });
    b.box('steelPlate', [bx0, y0, z + half - 0.08], [bx1, y1, z + half], { collide: false, cast: false });
    b.box('steelPlate', [bx1 - 0.08, y0, z - half], [bx1, y1, z + half], { collide: false, cast: false });
  }
  for (const px of [bx0, bx1 - 0.1]) for (const pz of [z - half, z + half - 0.1]) b.box('steelPlate', [px, by0, pz], [px + 0.1, by1, pz + 0.1], { collide: false });
  for (let x = bx0 + 1.1; x < bx1 - 0.5; x += 1.1) {
    b.box('steelPlate', [x - 0.02, by0 + 0.12, z - half - 0.012], [x + 0.02, by1 - 0.1, z - half + 0.03], { collide: false, cast: false });
    b.box('steelPlate', [x - 0.02, by0 + 0.12, z + half - 0.03], [x + 0.02, by1 - 0.1, z + half + 0.012], { collide: false, cast: false });
  }
  // Rear: the door, its handle, an underride bar and the tail lamps.
  b.box('ceilingDeck', [bx0 - 0.02, by0 + 0.14, z - half + 0.12], [bx0 + 0.03, by1 - 0.12, z + half - 0.12], { collide: false, cast: false });
  b.tube('darkSteel', [rear + 0.02, 0.62, z - half + 0.1], [rear + 0.02, 0.62, z + half - 0.1], 0.04, false);
  for (const side of [-1, 1]) {
    b.tube('darkSteel', [rear + 0.05, 0.62, z + side * 0.7], [rear + 0.3, 0.86, z + side * 0.7], 0.03, false);
    lens(b, [rear + 0.03, 0.92, z + side * (half - 0.32) - 0.09], [rear + 0.07, 1.06, z + side * (half - 0.32) + 0.09], RED, 2.2);
  }
  // Under the box: a fuel tank on one side and a tool locker on the other.
  drum(b, 'steelPlate', [rear + 4.3, 0.72, z - half + 0.32], 0.3, 1.3, 'x', 18);
  for (const dx of [-0.45, 0.45]) drum(b, 'darkSteel', [rear + 4.3 + dx, 0.72, z - half + 0.32], 0.31, 0.05, 'x', 18, false);
  b.box('darkSteel', [rear + 3.7, 0.42, z + half - 0.62], [rear + 4.9, 1.02, z + half - 0.04], { collide: false });
  b.box('steelPlate', [rear + 3.76, 0.5, z + half - 0.045], [rear + 4.84, 0.94, z + half - 0.03], { collide: false, cast: false });

  // The cab: a tall flat-fronted box with a raked top, glass in front and at the sides.
  const cx0 = nose - 2.25;
  const cy0 = 0.86;
  const cy1 = 3.0;
  b.box('truckPaint', [cx0, cy0, z - half + 0.06], [nose, cy1 - 0.25, z + half - 0.06], { collide: false });
  b.box('truckPaint', [cx0, cy1 - 0.25, z - half + 0.1], [nose - 0.22, cy1, z + half - 0.1], { collide: false });
  // Air deflector on the roof, sloping up to the height of the box.
  const fairing = new THREE.BoxGeometry(1.5, 0.05, 2.1);
  fairing.rotateZ(0.42).translate(cx0 + 0.75, cy1 + 0.3, z);
  b.mesh('truckPaint', fairing, true, false);
  for (const side of [-1, 1]) b.box('truckPaint', [cx0 + 0.1, cy1, z + side * 1.03 - 0.02], [cx0 + 1.3, cy1 + 0.34, z + side * 1.03 + 0.02], { collide: false, cast: false });
  // Windscreen, side windows, a visor over the screen and two wipers.
  b.box('darkGlass', [nose - 0.01, 1.85, z - half + 0.2], [nose + 0.02, 2.66, z + half - 0.2], { collide: false, cast: false });
  b.box('darkSteel', [nose - 0.02, 2.66, z - half + 0.14], [nose + 0.16, 2.74, z + half - 0.14], { collide: false, cast: false });
  b.box('darkSteel', [nose + 0.02, 1.83, z - 0.02], [nose + 0.04, 2.66, z + 0.02], { collide: false, cast: false });
  for (const side of [-1, 1]) {
    b.box('darkGlass', [nose - 1.25, 1.9, z + side * (half - 0.06) - 0.012], [nose - 0.22, 2.6, z + side * (half - 0.06) + 0.012], { collide: false, cast: false });
    b.tube('darkSteel', [nose + 0.03, 1.86, z + side * 0.5], [nose + 0.035, 2.3, z + side * 0.2], 0.012, false);
    // Door seam, handle, a step and a grab rail.
    b.box('darkSteel', [nose - 1.4, 1.0, z + side * (half - 0.055) - 0.008], [nose - 1.37, 2.7, z + side * (half - 0.055) + 0.008], { collide: false, cast: false });
    b.box('steelPlate', [nose - 1.3, 1.7, z + side * (half - 0.04) - 0.012], [nose - 1.1, 1.75, z + side * (half - 0.04) + 0.012], { collide: false, cast: false });
    b.box('treadPlate', [nose - 1.25, 0.5, z + side * (half - 0.1) - 0.14], [nose - 0.55, 0.55, z + side * (half - 0.1) + 0.14], { collide: false, cast: false });
    b.tube('steelPlate', [nose - 1.48, 1.2, z + side * (half - 0.02)], [nose - 1.48, 2.5, z + side * (half - 0.02)], 0.018, false);
    // Mirror on two arms.
    b.tube('darkSteel', [nose - 0.12, 2.5, z + side * (half - 0.05)], [nose + 0.1, 2.55, z + side * (half + 0.32)], 0.014, false);
    b.tube('darkSteel', [nose - 0.12, 1.95, z + side * (half - 0.05)], [nose + 0.1, 2.0, z + side * (half + 0.32)], 0.014, false);
    b.box('darkSteel', [nose + 0.06, 1.92, z + side * (half + 0.32) - 0.05], [nose + 0.13, 2.6, z + side * (half + 0.32) + 0.05], { collide: false, cast: false });
    // Front mudguard.
    b.box('darkSteel', [nose - 1.95, 1.04, z + side * (half - 0.17) - 0.2], [nose - 0.75, 1.08, z + side * (half - 0.17) + 0.2], { collide: false, cast: false });
    // Amber marker lamps on the roof corners.
    lens(b, [nose - 0.3, cy1 - 0.01, z + side * 0.85 - 0.05], [nose - 0.22, cy1 + 0.04, z + side * 0.85 + 0.05], AMBER, 2.5);
  }
  // Front: a ribbed grille between the headlamps, and a steel bumper.
  b.box('darkSteel', [nose, 0.98, z - 0.62], [nose + 0.03, 1.68, z + 0.62], { collide: false, cast: false });
  for (let y = 1.05; y < 1.66; y += 0.1) b.box('steelPlate', [nose + 0.03, y, z - 0.58], [nose + 0.045, y + 0.035, z + 0.58], { collide: false, cast: false });
  b.box('steelPlate', [nose - 0.05, 0.5, z - half + 0.02], [nose + 0.16, 0.86, z + half - 0.02], { collide: false });
  b.box('hazard', [nose + 0.16, 0.54, z - half + 0.06], [nose + 0.172, 0.82, z + half - 0.06], { collide: false, cast: false });
  const plate = atlas.text('S4 0417', { size: 60, color: PAINT.black, plate: PAINT.white, wear: 0.3 });
  b.decal(atlas.texture, [nose + 0.175, 0.68, z], [1, 0, 0], 0.5, 0.5 / plate.aspect, { uvRect: plate.uv, opacity: 0.95 });
  const name = atlas.text(['SITE 04', 'LOGISTICS'], { size: 90, color: PAINT.black, wear: 0.45 });
  for (const side of [-1, 1]) b.decal(atlas.texture, [(bx0 + bx1) / 2, 2.5, z + side * (half + 0.014)], [0, 0, side], 2.6, 2.6 / name.aspect, { uvRect: name.uv, opacity: 0.75 });
  // Nothing walks through it, or under it.
  b.blocker([rear, 0, z - half], [nose + 0.16, by1, z + half]);

  // Its headlamps, left on: two beams across the floor toward the server hall's shutter.
  for (const side of [-1, 1]) {
    const from: Vec3 = [nose + 0.06, 1.22, z + side * 0.86];
    const to: Vec3 = [nose + 9.5, 0.3, z + side * 1.5];
    lens(b, [nose + 0.02, 1.08, from[2] - 0.15], [nose + 0.06, 1.36, from[2] + 0.15], HEADLAMP, 9);
    lights.push({ name: `truckLamp${side}`, area: 'dock', kind: 'spot', color: HEADLAMP, intensity: 150, position: from, target: to, angle: 0.5, penumbra: 0.7, distance: 17, shadow: side === 1 ? 2 : undefined });
    haze.push({ effect: createConeShaft([from[0] + 0.1, from[1], from[2]], [from[0] + 7.5, 0.7, to[2] - side * 0.3], 0.12, 1.5, HEADLAMP, 0.1) });
    dustBeams.push({ position: from, target: to, angle: 0.42, color: HEADLAMP, strength: 0.6 });
  }
}

export function buildDock(assets: Assets, materials: MaterialLibrary): AreaBuild {
  const b = new LevelBuilder(assets, materials);
  const atlas = new SignAtlas(2048, 2048);
  const lights: LightDef[] = [];
  const haze: Haze[] = [];
  const dustBeams: DustBeam[] = [];
  const { x0, x1, z0, z1, height: h } = DOCK;
  const t = WALL;
  const door = (id: string) => DOOR_PLANS.find((d) => d.id === id)!;
  const hallDoor = door('hallDock');
  const P = DOCK_PASSAGE;
  /** Where the concrete plinth stops and the corrugated cladding starts. */
  const plinth = 2.3;

  // ---- Structure
  b.box('floor', [x0 - t, -0.4, z0 - t], [x1, 0, z1 + t], { collide: false, cast: false });
  b.box('ceilingDeck', [x0 - t, h, z0 - t], [x1 + t, h + 0.25, z1 + t], { collide: false, cast: false });
  const walls = { height: h, lower: 'concreteDark', upper: 'wallDock', paintLine: plinth } as const;
  // North and south walls, and the west wall with its three truck bays.
  wall(b, { ...walls, along: 'x', near: z0 - t, far: z0, from: x0 - t, to: x1 + t });
  wall(b, { ...walls, along: 'x', near: z1, far: z1 + t, from: x0 - t, to: x1 });
  const bays = [DOCK_BAYS.north, DOCK_BAYS.shut, DOCK_BAYS.south];
  wall(b, { ...walls, along: 'z', near: x0 - t, far: x0, from: z0, to: z1, openings: bays.map((bay) => ({ from: bay.z0, to: bay.z1, top: bay.top })) });
  // East: north of the server hall the wall is the dock's own, with the
  // passage to the lobby through it. From there south the hall's wall
  // already stands here: face it with a skin of this room's own, and carry
  // on above it, since the hall is the lower of the two.
  wall(b, { ...walls, along: 'z', near: x1, far: x1 + t, from: z0, to: HALL.z0 - t, openings: [{ from: P.z0, to: P.z1, top: P.top }] });
  wall(b, { ...walls, along: 'z', near: x1 - SKIN, far: x1, from: HALL.z0 - t, to: z1, solid: false, openings: [{ from: hallDoor.from, to: hallDoor.to, top: hallDoor.top }] });
  b.box('wallDock', [x1, HALL.height, HALL.z0 - t], [x1 + t, h, z1 + t], { collide: false, cast: false });
  // A steel rail caps the plinth all the way round, stopping at each opening.
  const rail = (along: 'x' | 'z', at: number, inward: 1 | -1, from: number, to: number, gaps: Array<[number, number]> = []) => {
    let cursor = from;
    for (const [g0, g1] of [...gaps, [to, to] as [number, number]]) {
      if (g0 - cursor > 0.001) {
        const a = Math.min(at, at + inward * 0.04);
        const c = Math.max(at, at + inward * 0.04);
        const min: Vec3 = along === 'x' ? [cursor, plinth - 0.04, a] : [a, plinth - 0.04, cursor];
        const max: Vec3 = along === 'x' ? [g0, plinth + 0.04, c] : [c, plinth + 0.04, g0];
        b.box('darkSteel', min, max, { collide: false, cast: false });
      }
      cursor = g1;
    }
  };
  rail('x', z0, 1, x0, x1);
  rail('x', z1, -1, x0, x1);
  rail('z', x0, 1, z0, z1, bays.map((bay) => [bay.z0 - 0.32, bay.z1 + 0.32]));
  rail('z', x1 - SKIN, -1, z0, z1, [
    [P.z0 - 0.32, P.z1 + 0.32],
    [hallDoor.from - 0.32, hallDoor.to + 0.32],
  ]);

  // The passage to the lobby's goods door: concrete walls and a low slab roof.
  b.box('floor', [x1, -0.4, P.z0 - t], [P.x1, 0, P.z1 + t], { collide: false, cast: false });
  b.box('concreteDark', [x1 + t, 0, P.z0 - t], [P.x1, P.top + 0.3, P.z0]);
  b.box('concreteDark', [x1 + t, 0, P.z1], [P.x1, P.top + 0.3, P.z1 + t]);
  b.box('concreteDark', [x1, P.top, P.z0 - t], [P.x1, P.top + 0.3, P.z1 + t], { collide: false, cast: false });
  b.box('hazard', [x1 - 0.012, 0, P.z0 - 0.3], [x1, 2.1, P.z0 - 0.02], { collide: false, cast: false });
  b.box('hazard', [x1 - 0.012, 0, P.z1 + 0.02], [x1, 2.1, P.z1 + 0.3], { collide: false, cast: false });
  b.box('treadPlate', [x1, 0, P.z0], [P.x1, 0.012, P.z1], { collide: false, cast: false });
  b.tube('darkSteel', [x1 + t, P.top - 0.12, P.z0 + 0.12], [P.x1, P.top - 0.12, P.z0 + 0.12], 0.03, false);
  b.tube('rustedSteel', [x1 + t, P.top - 0.14, P.z1 - 0.14], [P.x1, P.top - 0.14, P.z1 - 0.14], 0.045, false);
  // (The lobby's own wall and the door in it stand at the passage's east end.)
  // The building beyond the passage's north side, seen through nothing: closed off all the same.
  b.box('concreteDark', [x1 + t, 0, z0 - t], [LOBBY.x0 - t, P.top + 0.3, P.z0 - t], { cast: false });
  b.box('concreteDark', [x1 + t, 0, P.z1 + t], [LOBBY.x0 - t, P.top + 0.3, HALL.z0 - t], { cast: false });

  // Columns under two main girders, and joists across them.
  for (const [cx, cz] of DOCK_COLUMNS) column(b, cx, cz, h);
  for (const cx of [...new Set(DOCK_COLUMNS.map((c) => c[0]))]) ibeam(b, 'z', z0, z1, cx, h, 0.7, 0.36);
  for (const z of [5.4, 9.2, 13.0, 16.8, 20.6, 24.4]) ibeam(b, 'x', x0, x1, z, h, 0.34, 0.2);
  // A travelling crane across the bay: two rails on the girders, a bridge
  // between them, and its hook block hanging over the middle of the floor.
  const craneZ = 12.6;
  const [railA, railB] = [...new Set(DOCK_COLUMNS.map((c) => c[0]))].sort((p, q) => p - q) as [number, number];
  for (const cx of [railA, railB]) b.box('rustedSteel', [cx - 0.09, h - 0.82, z0 + 0.4], [cx + 0.09, h - 0.7, z1 - 0.4], { collide: false, cast: false });
  for (const dz of [-0.32, 0.32]) ibeam(b, 'x', railA - 0.5, railB + 0.5, craneZ + dz, h - 0.82, 0.42, 0.22);
  for (const cx of [railA, railB]) b.box('hazard', [cx - 0.3, h - 1.3, craneZ - 0.55], [cx + 0.3, h - 0.82, craneZ + 0.55], { collide: false });
  const hookX = -21.4;
  b.box('paintedMetal', [hookX - 0.45, h - 1.5, craneZ - 0.45], [hookX + 0.45, h - 0.95, craneZ + 0.45], { collide: false });
  for (const dx of [-0.08, 0.08]) b.tube('darkSteel', [hookX + dx, h - 1.5, craneZ], [hookX + dx, 4.25, craneZ], 0.012, false);
  b.box('hazard', [hookX - 0.2, 3.85, craneZ - 0.14], [hookX + 0.2, 4.25, craneZ + 0.14], { collide: false });
  b.tube('darkSteel', [hookX, 3.85, craneZ], [hookX, 3.6, craneZ], 0.035, false);
  const hook = new THREE.TorusGeometry(0.13, 0.035, 8, 14, Math.PI * 1.35);
  hook.rotateZ(Math.PI * 0.85).translate(hookX, 3.48, craneZ);
  b.mesh('darkSteel', hook, true, false);

  // ---- The truck bays. North and south stand open on the yards the robots
  // cross; the middle one is shut, with a truck backed up to it.
  const bayMid = (bay: { z0: number; z1: number }) => (bay.z0 + bay.z1) / 2;
  approach(b, { area: 'dock', out: -1, wallX: x0 - t, ...DOCK_BAYS.north, name: 'dockNorth' }, lights, haze, dustBeams);
  approach(b, { area: 'dock', out: -1, wallX: x0 - t, ...DOCK_BAYS.south, name: 'dockSouth' }, lights, haze, dustBeams);
  for (const bay of [DOCK_BAYS.north, DOCK_BAYS.south]) {
    // The shutter, jammed most of the way up.
    b.prop('rollershutter_door', { at: [x0 - 0.3, bay.top - 0.72, bayMid(bay)], scale: [3.12, 1.05, 1], rot: [0, HALF_PI, -0.035], collide: false });
  }
  const shut = DOCK_BAYS.shut;
  // The shut bay: a ribbed steel door down to the floor, in a hazard-striped frame.
  b.box('ceilingDeck', [x0 - 0.34, 0, shut.z0], [x0 - 0.28, shut.top, shut.z1], { collide: false, cast: false });
  for (let y = 0.3; y < shut.top; y += 0.42) b.box('darkSteel', [x0 - 0.29, y, shut.z0], [x0 - 0.265, y + 0.035, shut.z1], { collide: false, cast: false });
  b.box('steelPlate', [x0 - 0.3, 0, shut.z0], [x0 - 0.24, 0.16, shut.z1], { collide: false, cast: false });
  b.blocker([x0 - t, 0, shut.z0], [x0 - 0.2, shut.top, shut.z1]);
  b.box('steelPlate', [x0 - t - 0.07, 0, shut.z0 - 0.28], [x0 + 0.07, shut.top, shut.z0 + 0.06]);
  b.box('steelPlate', [x0 - t - 0.07, 0, shut.z1 - 0.06], [x0 + 0.07, shut.top, shut.z1 + 0.28]);
  b.box('steelPlate', [x0 - t - 0.07, shut.top - 0.06, shut.z0 - 0.28], [x0 + 0.07, shut.top + 0.32, shut.z1 + 0.28], { collide: false });
  b.box('hazard', [x0 + 0.07, 0, shut.z0 - 0.28], [x0 + 0.085, 2.0, shut.z0 - 0.02], { collide: false, cast: false });
  b.box('hazard', [x0 + 0.07, 0, shut.z1 + 0.02], [x0 + 0.085, 2.0, shut.z1 + 0.28], { collide: false, cast: false });
  // Rubber bumpers either side of every bay, and a signal lamp over each.
  for (const bay of bays) {
    for (const z of [bay.z0 - 0.75, bay.z1 + 0.75]) b.box('cable', [x0, 0.5, z - 0.22], [x0 + 0.14, 1.3, z + 0.22], { collide: false, cast: false });
  }
  truck(b, atlas, x0 + 0.35, bayMid(shut), lights, haze, dustBeams);

  // ---- Containers, standing in islands with lanes all round them. (None
  // is close enough to a wall or to another to leave a gap that a person
  // fits through and a robot does not: against a wall means touching it.)
  container(b, atlas, 'containerRust', [-26.2, 0, z0], 'x', 6.06, 'ARGU 482913 0');
  container(b, atlas, 'containerBlue', [-25.6, BOX.height, z0 + 0.02], 'x', 6.06, 'SITU 204417 6', 'near');
  // (This one's west end meets the barrels in the corner. It once stopped
  // 80 cm short of them, which made a slot between the two that the player
  // fitted into and a robot did not: the check that stands the player
  // everywhere on the map found it.)
  container(b, atlas, 'containerGreen', [x0 + 1.8, 0, z1 - BOX.width], 'x', 6.06, 'OVRD 771302 4', 'far');
  container(b, atlas, 'containerOchre', [-16.6, 0, 7.4], 'z', 6.06, 'ARGU 105586 2', 'near');
  container(b, atlas, 'containerBlue', [-24.2, 0, 19.9], 'x', 6.06, 'SITU 330951 8', 'near');
  container(b, atlas, 'containerRust', [-23.7, BOX.height, 19.92], 'x', 6.06, 'KEYS 000004 1', 'far');

  // ---- Freight left where it was dropped: all of it tight against a wall.
  // (One unbroken strip down the east wall, south of the hall's shutter.)
  b.prop('cardboard_box_01', { at: [x1 - 0.45, 0, 20.4], rotY: 0.2, kind: 'soft' });
  b.prop('cardboard_box_01', { at: [x1 - 0.5, 0.34, 20.45], rotY: -0.3, kind: 'soft', collide: false });
  b.prop('hand_truck', { at: [x1 - 0.4, 0, 21.3], rotY: -HALF_PI - 0.1 });
  b.prop('wooden_military_crate', { at: [x1 - 0.55, 0, 22.5], rotY: HALF_PI, kind: 'wood' });
  b.prop('wooden_military_crate', { at: [x1 - 0.55, 0, 23.65], rotY: HALF_PI, kind: 'wood' });
  b.prop('wooden_military_crate', { at: [x1 - 0.57, 0.46, 23.1], rotY: HALF_PI + 0.08, kind: 'wood', collide: false });
  b.prop('industrial_storage_cart', { at: [x1 - 0.6, 0, 25.1], rotY: HALF_PI });
  b.blocker([x1 - 1.1, 0, 19.8], [x1, 1.2, z1]);
  b.prop('Barrel_01', { at: [x0 + 0.5, 0, z1 - 0.5], rotY: 0.6 });
  b.prop('barrel_03', { at: [x0 + 1.3, 0, z1 - 0.48], rotY: 1.9 });
  b.prop('Barrel_01', { at: [x0 + 0.52, 0, z1 - 1.3], rotY: 2.4 });
  // (The corner they stand in is solid as far as the container's end.)
  b.blocker([x0, 0, z1 - 1.8], [x0 + 1.8, 1.1, z1]);
  b.prop('metal_tool_chest', { at: [x0 + 0.38, 0, 11.0], rotY: HALF_PI });
  b.prop('utility_box_01', { at: [-20.4, 0, z1 - 0.26], rotY: Math.PI });
  b.prop('utility_box_02', { at: [-14.0, 0, z0 + 0.26], rotY: 0 });
  b.prop('power_box_01', { at: [-12.6, 1.55, z0 + 0.08], rotY: 0, collide: false });
  b.prop('korean_fire_extinguisher_01', { at: [x1 - 0.22, 0, 14.2], rotY: -HALF_PI });
  b.prop('security_camera_01', { at: [x1 - 0.3, 5.2, z0 + 0.3], rotY: -Math.PI / 4, collide: false });
  b.prop('security_camera_01', { at: [x0 + 0.3, 5.2, z1 - 0.3], rotY: (Math.PI * 3) / 4, collide: false });
  // Pipes along the south wall, high up.
  for (const [py, r, key] of [
    [5.4, 0.12, 'rustedSteel'],
    [5.05, 0.06, 'paintedMetal'],
  ] as const) {
    b.tube(key, [x0, py, z1 - 0.2], [x1, py, z1 - 0.2], r);
    for (let fx = x0 + 1.6; fx < x1; fx += 3.4) b.tube('darkSteel', [fx - 0.04, py, z1 - 0.2], [fx + 0.04, py, z1 - 0.2], r * 1.4, false);
  }

  // ---- Ceiling vent, and the carbine's rack
  for (const entry of ENTRY_PLANS) if (entry.area === 'dock' && entry.kind === 'drop') vent(b, entry.at[0], entry.at[1], h);
  for (const rack of RACK_PLANS) if (rack.area === 'dock') weaponRack(b, atlas, assets, rack, lights);

  // ---- Signs and floor markings
  const put = (sign: Sign, centre: Vec3, normal: Vec3, width: number, options: { roll?: number; opacity?: number; emissive?: number; tint?: number } = {}) => {
    b.decal(atlas.texture, centre, normal, width, width / sign.aspect, { ...options, uvRect: sign.uv });
  };
  const N: Vec3 = [0, 0, 1];
  const S: Vec3 = [0, 0, -1];
  const E: Vec3 = [-1, 0, 0];
  const W: Vec3 = [1, 0, 0];
  const FLOOR: Vec3 = [0, 1, 0];
  put(atlas.text('SECTOR D', { size: 120, wear: 0.45 }), [-15.6, 4.6, z0], N, 2.6, { opacity: 0.75 });
  put(atlas.text('LOADING DOCK', { size: 60, wear: 0.45 }), [-15.6, 4.05, z0], N, 2.6, { opacity: 0.75 });
  put(atlas.eye(300, PAINT.white, 0.45), [-30.6, 4.6, z0], N, 1.6, { opacity: 0.6 });
  put(atlas.text(['ALL FREIGHT TO BE SCANNED', 'NO UNLOGGED HARDWARE'], { size: 50, box: true, wear: 0.45 }), [-30.6, 3.3, z0], N, 2.4, { opacity: 0.75 });
  put(atlas.text('SERVER HALL', { size: 70, color: PAINT.yellow, wear: 0.4 }), [x1 - SKIN, hallDoor.top + 0.55, (hallDoor.from + hallDoor.to) / 2], E, 1.9, { opacity: 0.9 });
  put(atlas.text('SECURITY LOBBY', { size: 70, color: PAINT.yellow, wear: 0.4 }), [x1, P.top + 0.55, (P.z0 + P.z1) / 2], E, 2.1, { opacity: 0.9 });
  ['01', '02', '03'].forEach((number, i) => {
    const bay = bays[i]!;
    const sign = atlas.text(`BAY ${number}`, { size: 110, color: PAINT.amber, plate: '#0d0f11', wear: 0 });
    put(sign, [x0 + 0.09, bay.top + 0.72, bayMid(bay)], W, 1.7, { emissive: 2.4, tint: 0xffb060 });
    b.box('darkSteel', [x0, bay.top + 0.42, bayMid(bay) - 0.95], [x0 + 0.08, bay.top + 1.02, bayMid(bay) + 0.95], { collide: false, cast: false });
    // Its number on the floor in front of it, and a hatched keep-clear zone.
    put(atlas.text(number, { size: 220, color: PAINT.yellow, wear: 0.55 }), [x0 + 4.4, 0, bayMid(bay)], FLOOR, 1.5, { roll: -HALF_PI, opacity: 0.7 });
    if (bay !== shut) b.decalImage('RoadLines022A', [x0 + 1.7, 0, bayMid(bay)], FLOOR, 2.6, 3.4, { opacity: 0.55 });
  });
  put(atlas.text(['SHUT', 'VEHICLE ON DOCK'], { size: 54, color: PAINT.red, box: true, plate: PAINT.white, wear: 0.35 }), [x0, 2.9, shut.z1 + 1.35], W, 1.5, { opacity: 0.9 });
  // Lane lines: one down from the passage, one across from the hall's shutter to the bays.
  const guide = atlas.line(900, 36, PAINT.yellow, 0.75);
  for (const [xa, xb] of [
    [-31.5, -27.6],
    [-24.0, -19.2],
    [-17.9, -12.4],
  ] as const) {
    put(guide, [(xa + xb) / 2, 0, 17.4], FLOOR, xb - xa, { opacity: 0.6 });
  }
  for (const [za, zb] of [
    [7.0, 11.4],
    [12.0, 16.6],
  ] as const) {
    put(guide, [-13.3, 0, (za + zb) / 2], FLOOR, zb - za, { roll: HALF_PI, opacity: 0.6 });
  }
  b.decalImage('RoadLines022A', [x1 - 1.1, 0, (hallDoor.from + hallDoor.to) / 2], FLOOR, 1.9, 3.2, { opacity: 0.5 });
  b.decalImage('RoadLines022A', [x1 - 1.0, 0, (P.z0 + P.z1) / 2], FLOOR, 1.7, 2.4, { opacity: 0.5 });
  const stain = (id: 'Leaking003' | 'Leaking004', centre: Vec3, normal: Vec3, w: number, hgt: number, opacity = 0.7) => b.decalImage(id, centre, normal, w, hgt, { opacity, tint: 0x5b5a52 });
  stain('Leaking003', [-21.0, 5.4, z0], N, 3.6, 3.4);
  stain('Leaking004', [x0, 5.5, 17.6], W, 3.4, 3.2);
  stain('Leaking003', [-27.5, 5.4, z1], S, 3.6, 3.4, 0.6);
  stain('Leaking004', [-15.0, 5.5, z1], S, 3.4, 3.2);

  // ---- Lighting. Six high sodium lamps on long rods throw separate pools
  // of orange on the floor, and it is dark between them and darker up in
  // the roof. The two open bays are walls of cold light, a lamp over each
  // bay turns amber or burns red, and the truck's headlamps cross the
  // middle of the floor.
  // (Two of them are spot lamps with shadows, for the pools in the middle
  // of the floor; the rest shine all round, which is what lights the walls,
  // the containers' sides and the underside of the roof.)
  const pools: Array<{ at: [number, number]; intensity: number; shadow?: number; faulty?: boolean }> = [
    { at: [-29.6, 11.0], intensity: 150 },
    { at: [-29.6, 17.6], intensity: 150, faulty: true },
    { at: [-21.6, 7.9], intensity: 150 },
    { at: [-21.6, 15.2], intensity: 520, shadow: 1 },
    { at: [-21.6, 23.4], intensity: 150 },
    { at: [-13.6, 11.2], intensity: 480, shadow: 3 },
    { at: [-13.8, 18.6], intensity: 150 },
  ];
  const lampY = 4.9;
  pools.forEach((pool, i) => {
    const [sx, sz] = pool.at;
    const name = `dockLamp${i}`;
    const fixture = b.prop('hanging_industrial_lamp', { at: [sx, lampY + 1.25, sz], rotY: i * 0.9, collide: false, unique: true });
    b.tube('darkSteel', [sx, lampY + 1.25, sz], [sx, h, sz], 0.02, false);
    const glow = { materials: fixture.filter((m) => m.emissiveMap || /glass|light$/i.test(m.name)), color: 0xffc27a, intensity: 6 };
    if (pool.shadow !== undefined) {
      lights.push({ name, area: 'dock', kind: 'spot', color: SODIUM, intensity: pool.intensity, position: [sx, lampY, sz], target: [sx, 0, sz], angle: 1.05, penumbra: 0.8, distance: 14, shadow: pool.shadow, glow });
      // (What a real lamp of this kind throws sideways and up.)
      lights.push({ name: `${name}Spill`, area: 'dock', kind: 'point', color: SODIUM, intensity: 60, position: [sx, lampY + 0.2, sz], distance: 15 });
    } else {
      lights.push({ name, area: 'dock', kind: 'point', color: SODIUM, intensity: pool.intensity, position: [sx, lampY, sz], distance: 17, flicker: pool.faulty ? 'faulty' : undefined, glow });
    }
    haze.push({ effect: createConeShaft([sx, lampY - 0.05, sz], [sx, 0.1, sz], 0.25, 3.6, SODIUM, 0.1), follows: pool.faulty ? name : undefined });
    dustBeams.push({ position: [sx, lampY, sz], target: [sx, 0, sz], angle: 0.75, color: SODIUM, strength: 0.5 });
  });
  // A lamp over each bay: amber and turning over the open ones, red over the shut one.
  bays.forEach((bay, i) => {
    const at: Vec3 = [x0 + 0.002, bay.top + 1.5, bayMid(bay)];
    const fixture = b.prop('industrial_wall_lamp', { at, rotY: HALF_PI, collide: false, cast: false, unique: true });
    const color = bay === shut ? RED : AMBER;
    lights.push({ name: `bayLamp${i}`, area: 'dock', kind: 'point', color, intensity: 9, position: [at[0] + 0.4, at[1], at[2]], distance: 8, flicker: bay === shut ? 'pulse' : 'beacon', glow: { materials: fixture, color, intensity: 9 } });
  });
  // In the passage, and over the server hall's shutter.
  lights.push({ name: 'dockPassage', area: 'dock', kind: 'point', color: 0xffe2b8, intensity: 5, position: [(x1 + t + P.x1) / 2, P.top - 0.35, (P.z0 + P.z1) / 2], distance: 5 });
  lights.push({ name: 'dockHallDoor', area: 'dock', kind: 'point', color: 0xd6e4ff, intensity: 6, position: [x1 - 0.8, 3.3, (hallDoor.from + hallDoor.to) / 2], distance: 6 });
  // Bounce: what the pools throw back up off the floor, and a little into the roof.
  lights.push({ name: 'dockBounceW', area: 'dock', kind: 'point', color: 0xffb070, intensity: 26, position: [-28, 2.4, 14.5], distance: 16 });
  lights.push({ name: 'dockBounceE', area: 'dock', kind: 'point', color: 0xffb070, intensity: 26, position: [-16, 2.4, 15], distance: 16 });

  const built = b.build();
  return { id: 'dock', ...built, lights, haze, dustBeams };
}
