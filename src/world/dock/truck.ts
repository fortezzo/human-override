// The truck backed up to the loading dock's shut bay.
//
// A cab-over box truck in faded green, its nose pointing into the room and
// its headlamps left on. It is built here from shaped parts, not from a
// downloaded model (there is no free one that fits), so the work is in the
// things that make a truck look like a truck and not like boxes: every
// corner of the cab rounded, a raked windscreen set into it, real tyres on
// steel rims under arched guards, a grille and lamp housings with depth to
// them, and the dirt of a working vehicle.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createConeShaft, type DustBeam } from '../../render/atmosphere';
import type { LightDef } from '../../render/lighting';
import type { MaterialKey } from '../../render/materials';
import type { LevelBuilder } from '../build/LevelBuilder';
import { drum, type Haze } from '../build/room';
import { PAINT, type SignAtlas } from '../build/SignAtlas';

type Vec3 = [number, number, number];

const AMBER = 0xff9a2e;
const RED = 0xff2a12;
const HEADLAMP = 0xfff0d2;
const HALF_PI = Math.PI / 2;

/** A lit lens: a small shape that glows whatever light falls on it. */
function lens(b: LevelBuilder, geometry: THREE.BufferGeometry, at: Vec3, color: number, strength: number): void {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: strength, roughness: 0.4 }));
  mesh.position.set(...at);
  b.addObject(mesh);
}

/** A box with every edge rounded, between two corners. */
function rounded(b: LevelBuilder, key: MaterialKey, min: Vec3, max: Vec3, radius: number, cast = true): void {
  const geometry = new RoundedBoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2], 3, radius);
  geometry.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  b.mesh(key, geometry, true, cast);
}

/**
 * `rear` is the x of its back end (against the bay), `z` its centre line.
 * It points east, into the room.
 */
export function truck(b: LevelBuilder, atlas: SignAtlas, rear: number, z: number, lights: LightDef[], haze: Haze[], dustBeams: DustBeam[]): void {
  const nose = rear + 8.3;
  const half = 1.22;
  const W: Vec3 = [1, 0, 0];

  // ---- Chassis: two rails, the cross-members between them, a fuel tank and an air tank slung under the box.
  for (const dz of [-0.45, 0.45]) b.box('darkSteel', [rear + 0.25, 0.62, z + dz - 0.06], [nose - 0.5, 0.86, z + dz + 0.06], { collide: false });
  for (let x = rear + 0.6; x < nose - 0.8; x += 1.5) b.box('darkSteel', [x - 0.05, 0.66, z - 0.45], [x + 0.05, 0.8, z + 0.45], { collide: false, cast: false });
  drum(b, 'steelPlate', [rear + 4.3, 0.72, z - half + 0.34], 0.3, 1.3, 'x', 18);
  for (const dx of [-0.45, 0.45]) drum(b, 'darkSteel', [rear + 4.3 + dx, 0.72, z - half + 0.34], 0.315, 0.05, 'x', 18, false);
  drum(b, 'rustedSteel', [rear + 4.4, 0.66, z + half - 0.36], 0.16, 1.0, 'x', 14);
  b.box('darkSteel', [rear + 3.3, 0.42, z + half - 0.62], [rear + 3.9, 1.0, z + half - 0.06], { collide: false });

  // ---- Wheels: real tyres on steel rims. One axle under the cab, two under the box (doubled).
  const TYRE = 0.5;
  const wheel = (x: number, side: number, inner: boolean): void => {
    const offset = inner ? half - 0.5 : half - 0.17;
    const at: Vec3 = [x, TYRE, z + side * offset];
    b.prop('old_tyre', { at, scale: [TYRE / 0.3, TYRE / 0.3, 1.85], collide: false, kind: 'soft' });
    // The rim: a dished steel disc with its hub and a ring of nuts, on the side that shows.
    drum(b, 'steelPlate', at, 0.31, 0.24, 'z', 18, false);
    if (inner) return;
    const face = at[2] + side * 0.125;
    drum(b, 'darkSteel', [x, TYRE, face], 0.13, 0.05, 'z', 12, false);
    drum(b, 'rustedSteel', [x, TYRE, face + side * 0.03], 0.07, 0.03, 'z', 10, false);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.tube('darkSteel', [x + Math.cos(a) * 0.2, TYRE + Math.sin(a) * 0.2, face - side * 0.01], [x + Math.cos(a) * 0.2, TYRE + Math.sin(a) * 0.2, face + side * 0.022], 0.018, false);
    }
  };
  /** A curved guard over a wheel, or over a pair of them. */
  const guard = (x0: number, x1: number, side: number, width: number): void => {
    const mid = (x0 + x1) / 2;
    const arch = new THREE.CylinderGeometry(TYRE + 0.1, TYRE + 0.1, width, 14, 1, true, -HALF_PI, Math.PI);
    // (Stretched along the truck so that one arch covers both wheels of a pair.)
    arch.rotateX(HALF_PI).scale((x1 - x0 + 2 * (TYRE + 0.1)) / (2 * (TYRE + 0.1)), 1, 1).translate(mid, TYRE + 0.02, z + side * (half - width / 2 - 0.02));
    b.mesh('darkSteel', arch, true, false);
  };
  for (const side of [-1, 1]) {
    wheel(nose - 1.35, side, false);
    for (const x of [rear + 1.25, rear + 2.4]) {
      wheel(x, side, false);
      wheel(x, side, true);
    }
    guard(rear + 1.25, rear + 2.4, side, 0.66);
    // A mud flap behind the rear pair.
    b.box('cable', [rear + 0.5, 0.26, z + side * (half - 0.33) - 0.3], [rear + 0.54, 0.98, z + side * (half - 0.33) + 0.3], { collide: false, cast: false });
  }

  // ---- The cargo box: pale panels in a steel frame, ribbed, with a roller door at the back.
  const bx0 = rear + 0.08;
  const bx1 = nose - 2.5;
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
  // Rear: the door, an underride bar and the tail lamps.
  b.box('ceilingDeck', [bx0 - 0.02, by0 + 0.14, z - half + 0.12], [bx0 + 0.03, by1 - 0.12, z + half - 0.12], { collide: false, cast: false });
  b.tube('darkSteel', [rear + 0.02, 0.62, z - half + 0.1], [rear + 0.02, 0.62, z + half - 0.1], 0.04, false);
  for (const side of [-1, 1]) {
    b.tube('darkSteel', [rear + 0.05, 0.62, z + side * 0.7], [rear + 0.3, 0.86, z + side * 0.7], 0.03, false);
    lens(b, new THREE.BoxGeometry(0.04, 0.14, 0.18), [rear + 0.05, 0.99, z + side * (half - 0.32)], RED, 2.2);
  }
  // Its name on both sides of the box, and what years of road have left under it.
  const name = atlas.text(['SITE 04', 'LOGISTICS'], { size: 90, color: PAINT.black, wear: 0.45 });
  for (const side of [-1, 1]) {
    const N: Vec3 = [0, 0, side];
    b.decal(atlas.texture, [(bx0 + bx1) / 2, 2.5, z + side * (half + 0.014)], N, 2.6, 2.6 / name.aspect, { uvRect: name.uv, opacity: 0.75 });
    b.decalImage('Leaking004', [bx0 + 1.4, 2.2, z + side * (half + 0.016)], N, 2.2, 2.6, { opacity: 0.45, tint: 0x4a4740 });
    b.decalImage('Leaking003', [bx1 - 1.3, 2.3, z + side * (half + 0.016)], N, 2.0, 2.4, { opacity: 0.4, tint: 0x4a4740 });
  }

  // ---- The cab. A lower body with rounded corners, a narrower glazed top set on it, and a roof cap.
  const cx0 = nose - 2.3;
  const sill = 1.95;
  const roof = 3.0;
  rounded(b, 'truckPaint', [cx0, 0.82, z - half + 0.05], [nose, sill + 0.06, z + half - 0.05], 0.1);
  rounded(b, 'truckPaint', [cx0 + 0.04, sill - 0.08, z - half + 0.11], [nose - 0.2, roof - 0.04, z + half - 0.11], 0.14);
  rounded(b, 'truckPaint', [cx0, roof - 0.16, z - half + 0.07], [nose - 0.12, roof + 0.04, z + half - 0.07], 0.07);
  // The windscreen: one raked pane with a dark rubber surround and a post down the middle, set into the front of the top.
  const pane = (min: Vec3, max: Vec3, tilt: number, key: MaterialKey = 'darkGlass'): void => {
    const geometry = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    geometry.rotateZ(tilt).translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    b.mesh(key, geometry, true, false);
  };
  const rake = 0.2;
  pane([nose - 0.2, sill + 0.04, z - half + 0.2], [nose - 0.11, roof - 0.2, z + half - 0.2], rake, 'cable');
  pane([nose - 0.17, sill + 0.09, z - half + 0.25], [nose - 0.075, roof - 0.25, z + half - 0.25], rake);
  pane([nose - 0.13, sill + 0.06, z - 0.025], [nose - 0.06, roof - 0.22, z + 0.025], rake, 'cable');
  // A visor over it, and two wipers parked across it.
  b.box('darkSteel', [nose - 0.34, roof - 0.19, z - half + 0.16], [nose - 0.02, roof - 0.14, z + half - 0.16], { collide: false, cast: false });
  for (const side of [-1, 1]) b.tube('darkSteel', [nose - 0.04, sill + 0.1, z + side * 0.62], [nose - 0.1, sill + 0.5, z + side * 0.16], 0.012, false);
  // Amber marker lamps along the front of the roof, and the dish of an aerial behind them.
  for (const dz of [-0.9, -0.45, 0, 0.45, 0.9]) lens(b, new THREE.BoxGeometry(0.06, 0.045, 0.1), [nose - 0.2, roof + 0.05, z + dz], AMBER, Math.abs(dz) > 0.8 ? 2.6 : 1.4);
  b.tube('darkSteel', [cx0 + 0.3, roof + 0.02, z - 0.8], [cx0 + 0.22, roof + 1.0, z - 0.8], 0.008, false);
  // An air deflector on the roof, sloping up to the height of the box.
  const fairing = new RoundedBoxGeometry(1.55, 0.07, 2.12, 2, 0.03);
  fairing.rotateZ(0.42).translate(cx0 + 0.78, roof + 0.36, z);
  b.mesh('truckPaint', fairing, true, false);
  for (const side of [-1, 1]) {
    const cheek = new THREE.BoxGeometry(1.3, 0.5, 0.04);
    cheek.translate(cx0 + 0.72, roof + 0.2, z + side * 1.04);
    b.mesh('truckPaint', cheek, true, false);
  }

  // ---- The sides of the cab: a door with its window, handle, steps and grab rail; a mirror on two arms; the arch over the front wheel.
  for (const side of [-1, 1]) {
    const face = z + side * (half - 0.05);
    const out = (d: number) => face + side * d;
    const N: Vec3 = [0, 0, side];
    // Window, in its rubber.
    b.box('cable', [nose - 1.42, sill + 0.03, Math.min(out(-0.07), out(-0.045))], [nose - 0.3, roof - 0.22, Math.max(out(-0.07), out(-0.045))], { collide: false, cast: false });
    b.box('darkGlass', [nose - 1.37, sill + 0.08, Math.min(out(-0.075), out(-0.035))], [nose - 0.35, roof - 0.27, Math.max(out(-0.075), out(-0.035))], { collide: false, cast: false });
    // The door: its seams, a handle, and the hinges.
    for (const x of [nose - 1.52, nose - 0.24]) b.box('cable', [x, 0.98, Math.min(out(0), out(0.006))], [x + 0.016, sill, Math.max(out(0), out(0.006))], { collide: false, cast: false });
    b.box('cable', [nose - 1.52, 0.98, Math.min(out(0), out(0.006))], [nose - 0.24, 0.996, Math.max(out(0), out(0.006))], { collide: false, cast: false });
    b.box('steelPlate', [nose - 1.44, 1.62, Math.min(out(0.004), out(0.03))], [nose - 1.24, 1.67, Math.max(out(0.004), out(0.03))], { collide: false, cast: false });
    for (const y of [1.2, 1.8]) b.box('darkSteel', [nose - 0.27, y, Math.min(out(0.004), out(0.022))], [nose - 0.22, y + 0.1, Math.max(out(0.004), out(0.022))], { collide: false, cast: false });
    // Steps, and a grab rail behind the door.
    for (const y of [0.42, 0.74]) b.box('treadPlate', [nose - 1.5, y, Math.min(out(-0.12), out(0.1))], [nose - 0.95, y + 0.045, Math.max(out(-0.12), out(0.1))], { collide: false, cast: false });
    b.tube('steelPlate', [nose - 1.6, 1.15, out(0.035)], [nose - 1.6, 2.55, out(0.035)], 0.017, false);
    for (const y of [1.15, 2.55]) b.tube('steelPlate', [nose - 1.6, y, out(0)], [nose - 1.6, y, out(0.035)], 0.014, false);
    // Mirror, on two arms.
    b.tube('darkSteel', [nose - 0.14, 2.52, out(0)], [nose + 0.06, 2.56, out(0.36)], 0.014, false);
    b.tube('darkSteel', [nose - 0.14, 2.0, out(0)], [nose + 0.06, 2.04, out(0.36)], 0.014, false);
    rounded(b, 'darkSteel', [nose + 0.02, 1.96, Math.min(out(0.31), out(0.41))], [nose + 0.1, 2.62, Math.max(out(0.31), out(0.41))], 0.03, false);
    // The arch over the front wheel, standing a little proud of the cab's side.
    const flare = new THREE.RingGeometry(TYRE + 0.04, TYRE + 0.2, 18, 1, 0, Math.PI);
    if (side < 0) flare.rotateY(Math.PI);
    flare.translate(nose - 1.35, TYRE + 0.02, out(0.004));
    b.mesh('darkSteel', flare, true, false);
    // Its name on the door, and its number behind it.
    const door = atlas.text('SITE 04', { size: 60, color: PAINT.white, wear: 0.5 });
    b.decal(atlas.texture, [nose - 0.88, 1.36, out(0.008)], N, 0.86, 0.86 / door.aspect, { uvRect: door.uv, opacity: 0.8 });
    b.decalImage('Leaking003', [nose - 1.2, 1.3, out(0.01)], N, 1.6, 1.3, { opacity: 0.5, tint: 0x3d3a33 });
  }

  // ---- The front. A grille set into the cab, a lamp housing either side of it, and a steel bumper below.
  b.box('cable', [nose - 0.02, 1.0, z - 0.66], [nose + 0.01, 1.72, z + 0.66], { collide: false, cast: false });
  for (let y = 1.07; y < 1.68; y += 0.092) b.box('steelPlate', [nose + 0.01, y, z - 0.6], [nose + 0.04, y + 0.03, z + 0.6], { collide: false, cast: false });
  for (const dz of [-0.62, 0, 0.62]) b.box('darkSteel', [nose + 0.012, 1.02, z + dz - 0.022], [nose + 0.05, 1.7, z + dz + 0.022], { collide: false, cast: false });
  rounded(b, 'darkSteel', [nose - 0.02, 0.98, z - 0.7], [nose + 0.03, 1.74, z - 0.64], 0.02, false);
  rounded(b, 'darkSteel', [nose - 0.02, 0.98, z + 0.64], [nose + 0.03, 1.74, z + 0.7], 0.02, false);
  // A plate where a maker's badge would be: this one carries the truck's number.
  b.box('steelPlate', [nose + 0.04, 1.78, z - 0.2], [nose + 0.052, 1.9, z + 0.2], { collide: false, cast: false });
  const unit = atlas.text('UNIT 17', { size: 50, color: PAINT.black, wear: 0.35 });
  b.decal(atlas.texture, [nose + 0.053, 1.84, z], W, 0.34, 0.34 / unit.aspect, { uvRect: unit.uv, opacity: 0.9 });
  b.decalImage('Leaking004', [nose + 0.012, 1.55, z + 0.5], W, 1.3, 1.4, { opacity: 0.45, tint: 0x3d3a33 });
  // Bumper: a rounded steel beam, with a towing eye and the number plate.
  rounded(b, 'darkSteel', [nose - 0.06, 0.5, z - half + 0.01], [nose + 0.17, 0.84, z + half - 0.01], 0.07);
  b.box('steelPlate', [nose + 0.17, 0.57, z - half + 0.2], [nose + 0.178, 0.6, z + half - 0.2], { collide: false, cast: false });
  b.tube('rustedSteel', [nose + 0.17, 0.6, z + 0.55], [nose + 0.26, 0.6, z + 0.55], 0.04, false);
  const plate = atlas.text('S4 0417', { size: 60, color: PAINT.black, plate: PAINT.white, wear: 0.3 });
  b.decal(atlas.texture, [nose + 0.172, 0.7, z], W, 0.5, 0.5 / plate.aspect, { uvRect: plate.uv, opacity: 0.95 });

  // ---- Nothing walks through it, or under it.
  b.blocker([rear, 0, z - half], [nose + 0.17, by1, z + half]);

  // ---- Its headlamps, left on: a round lamp in a housing each side, an amber
  // indicator beside it, and two beams across the floor toward the server hall's shutter.
  for (const side of [-1, 1]) {
    const lampZ = z + side * 0.9;
    rounded(b, 'darkSteel', [nose - 0.02, 1.02, lampZ - 0.21], [nose + 0.06, 1.42, lampZ + 0.21], 0.05, false);
    lens(b, new THREE.CylinderGeometry(0.115, 0.115, 0.03, 20).rotateZ(HALF_PI), [nose + 0.07, 1.22, lampZ - side * 0.045], HEADLAMP, 9);
    drum(b, 'steelPlate', [nose + 0.06, 1.22, lampZ - side * 0.045], 0.135, 0.03, 'x', 20, false);
    lens(b, new THREE.BoxGeometry(0.03, 0.12, 0.07), [nose + 0.065, 1.22, lampZ + side * 0.14], AMBER, 0.9);
    const from: Vec3 = [nose + 0.09, 1.22, lampZ - side * 0.045];
    const to: Vec3 = [nose + 9.5, 0.3, z + side * 1.5];
    lights.push({ name: `truckLamp${side}`, area: 'dock', kind: 'spot', color: HEADLAMP, intensity: 150, position: from, target: to, angle: 0.5, penumbra: 0.7, distance: 17, shadow: side === 1 ? 2 : undefined });
    haze.push({ effect: createConeShaft([from[0] + 0.1, from[1], from[2]], [from[0] + 7.5, 0.7, to[2] - side * 0.3], 0.12, 1.5, HEADLAMP, 0.1) });
    dustBeams.push({ position: from, target: to, angle: 0.42, color: HEADLAMP, strength: 0.6 });
  }
}
