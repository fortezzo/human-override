// The robotics lab: where ARGUS builds and mends its machines. A fenced
// assembly cell in the middle of the floor, with three arms working on a
// unit that is not finished yet; torsos travelling in on an overhead line
// from the hatch in the east wall; limbs hanging in rows on the walls;
// benches under screens; and, in the corner, the parts cage that holds one
// of the override keys.
//
// Its mood is its own: clean, cold, green-white strip lighting with nobody
// under it, the arc of a welder flashing in the cell, and the hard light of
// the assembly line beyond the hatch.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Assets } from '../../core/assets';
import type { RobotModel } from '../../entities/robot/RobotModel';
import { type DustBeam } from '../../render/atmosphere';
import type { LightDef } from '../../render/lighting';
import type { MaterialKey, MaterialLibrary } from '../../render/materials';
import { LevelBuilder } from '../build/LevelBuilder';
import { approach, drum, ibeam, vent, wall, weaponRack, type AreaBuild, type Haze } from '../build/room';
import { PAINT, SignAtlas, type Sign } from '../build/SignAtlas';
import { ScreenBank } from '../lobby/ScreenBank';
import { DOOR_PLANS, ENTRY_PLANS, HALL, KEY_CAGE, LAB, LAB_LINE, RACK_PLANS, WALL } from '../plan';

type Vec3 = [number, number, number];

/** The robots whose parts are lying about the lab. */
export interface RobotParts {
  drudge: RobotModel;
  heavy: RobotModel;
}

/** The strip lights: a cold white with green in it. */
const STRIP = 0xc8fff0;
const ARC = 0x9fd4ff;
const AMBER = 0xff9a2e;
const RED = 0xff2a12;
const HALF_PI = Math.PI / 2;
/** Thickness of the facing laid over the back of a neighbouring room's wall. */
const SKIN = 0.03;

/** The fenced assembly cell in the middle of the floor: its rectangle, and the middle of it. */
export const CELL = { x0: 13.2, x1: 18.4, z0: 19.2, z1: 24.4 } as const;

const ARM_BONES = ['Shoulder', 'Arm', 'ForeArm', 'Hand'];
const LEG_BONES = ['UpLeg', 'Leg', 'Foot', 'ToeBase'];
const TORSO_BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head'];

/**
 * Robot parts as scenery. Each robot type is taken apart into the rigid
 * pieces it breaks into when destroyed, standing in the pose it was built
 * in; `take` gives back some of those pieces as one shape, centred on the
 * floor under the middle of the robot.
 */
class Parts {
  private readonly shapes: THREE.BufferGeometry[] = [];
  private readonly pieces: ReturnType<RobotModel['restPieces']>;

  constructor(private readonly model: RobotModel) {
    this.pieces = model.restPieces();
  }

  /** The pieces riding on these bones (a name with no side, like 'Arm', needs `side`). */
  take(bones: string[], side?: 'Left' | 'Right'): THREE.BufferGeometry {
    const wanted = new Set(bones.map((bone) => (side ? side + bone : bone)));
    const found = this.pieces.filter((piece) => wanted.has(piece.bone)).map((piece) => piece.geometry.clone().applyMatrix4(piece.matrix));
    return found.length ? mergeGeometries(found)! : new THREE.BufferGeometry();
  }

  /** Stand a shape somewhere: turned (x, then y, then z), then moved. */
  place(shape: THREE.BufferGeometry, at: Vec3, rot: Vec3 = [0, 0, 0]): void {
    if (!shape.getAttribute('position')) return;
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), new THREE.Vector3(1, 1, 1));
    this.shapes.push(shape.clone().applyMatrix4(matrix));
  }

  /**
   * Turn a shape, then put it where its own outline says: the middle of it
   * over (x, z), and either its lowest point ('on') or its highest
   * ('under') at height y. For resting a part on a stand, or hanging one
   * from a hook, whatever size the part is.
   */
  set(shape: THREE.BufferGeometry, how: 'on' | 'under', at: Vec3, rot: Vec3 = [0, 0, 0]): void {
    if (!shape.getAttribute('position')) return;
    const turned = shape.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')));
    turned.computeBoundingBox();
    const box = turned.boundingBox!;
    turned.translate(at[0] - (box.min.x + box.max.x) / 2, at[1] - (how === 'on' ? box.min.y : box.max.y), at[2] - (box.min.z + box.max.z) / 2);
    this.shapes.push(turned);
  }

  /** How far a shape's lowest point is below the floor of the pose it was taken in (so that parts taken together can be moved together). */
  static low(shape: THREE.BufferGeometry): number {
    shape.computeBoundingBox();
    return shape.boundingBox ? shape.boundingBox.min.y : 0;
  }

  /** Everything placed, as one mesh in the robot's own finish. */
  build(name: string): THREE.Mesh | null {
    if (!this.shapes.length) return null;
    const mesh = new THREE.Mesh(mergeGeometries(this.shapes)!, this.model.chunkMaterial);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

/** A ball joint. */
function ball(b: LevelBuilder, key: MaterialKey, at: Vec3, radius: number): void {
  const geometry = new THREE.SphereGeometry(radius, 14, 10);
  geometry.translate(at[0], at[1], at[2]);
  b.mesh(key, geometry, true, false);
}

/**
 * An assembly arm: a pedestal bolted to the floor, a turret on it, and
 * three sections ending in a two-fingered grip. `joints` are the positions
 * of its shoulder, elbow, wrist and tip; it is drawn through them.
 */
function assemblyArm(b: LevelBuilder, base: [number, number], joints: [Vec3, Vec3, Vec3, Vec3]): void {
  const [bx, bz] = base;
  const [shoulder, elbow, wrist, tip] = joints;
  // Pedestal and turret.
  b.box('darkSteel', [bx - 0.42, 0, bz - 0.42], [bx + 0.42, 0.06, bz + 0.42], { collide: false, cast: false });
  drum(b, 'hazard', [bx, 0.38, bz], 0.3, 0.64, 'y', 20);
  drum(b, 'darkSteel', [bx, 0.74, bz], 0.36, 0.08, 'y', 20, false);
  drum(b, 'steelPlate', [bx, 0.95, bz], 0.26, 0.34, 'y', 18);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.tube('steelPlate', [bx + Math.cos(a) * 0.35, 0.06, bz + Math.sin(a) * 0.35], [bx + Math.cos(a) * 0.35, 0.1, bz + Math.sin(a) * 0.35], 0.03, false);
  }
  // Up from the turret to the shoulder, then the three sections.
  b.tube('hazard', [bx, 1.1, bz], shoulder, 0.13);
  ball(b, 'darkSteel', shoulder, 0.16);
  b.tube('hazard', shoulder, elbow, 0.115);
  ball(b, 'darkSteel', elbow, 0.135);
  b.tube('steelPlate', elbow, wrist, 0.085);
  ball(b, 'darkSteel', wrist, 0.095);
  b.tube('darkSteel', wrist, tip, 0.05);
  // A piston alongside the first section, and a hose slung along the second.
  const lift = (p: Vec3, dy: number): Vec3 => [p[0], p[1] + dy, p[2]];
  b.tube('steelPlate', lift(shoulder, -0.26), lift([(shoulder[0] + elbow[0]) / 2, (shoulder[1] + elbow[1]) / 2, (shoulder[2] + elbow[2]) / 2], -0.2), 0.035, false);
  b.tube('rustedSteel', lift([(shoulder[0] + elbow[0]) / 2, (shoulder[1] + elbow[1]) / 2, (shoulder[2] + elbow[2]) / 2], -0.2), lift(elbow, -0.14), 0.022, false);
  b.cable('cable', lift(elbow, 0.16), lift(wrist, 0.12), 0.12, 0.016);
  // The grip: two fingers either side of the tip.
  const along = new THREE.Vector3(tip[0] - wrist[0], tip[1] - wrist[1], tip[2] - wrist[2]).normalize();
  const side = new THREE.Vector3().crossVectors(along, new THREE.Vector3(0, 1, 0));
  if (side.lengthSq() < 0.01) side.set(1, 0, 0);
  side.normalize().multiplyScalar(0.07);
  for (const s of [-1, 1]) {
    const root: Vec3 = [tip[0] + side.x * s, tip[1] + side.y * s, tip[2] + side.z * s];
    const end: Vec3 = [root[0] + along.x * 0.16, root[1] + along.y * 0.16, root[2] + along.z * 0.16];
    b.tube('steelPlate', root, end, 0.016, false);
  }
}

export function buildLab(assets: Assets, materials: MaterialLibrary, robots?: RobotParts): AreaBuild {
  const b = new LevelBuilder(assets, materials);
  const atlas = new SignAtlas(2048, 2048);
  const screens = new ScreenBank();
  const lights: LightDef[] = [];
  const haze: Haze[] = [];
  const dustBeams: DustBeam[] = [];
  const { x0, x1, z0, z1, height: h } = LAB;
  const t = WALL;
  const door = (id: string) => DOOR_PLANS.find((d) => d.id === id)!;
  const hallDoor = door('hallLab');
  const powerDoor = door('powerLab');
  /** Height of the steel panelling on the walls. */
  const panel = 2.7;
  const hallEnd = HALL.z1 + t;

  // ---- Structure
  b.box('labFloor', [x0, -0.4, z0], [x1 + t, 0, z1 + t], { collide: false, cast: false });
  b.box('labFloor', [x0 - t, -0.4, hallEnd], [x0, 0, z1 + t], { collide: false, cast: false });
  b.box('ceilingDeck', [x0 - t, h, z0 - t], [x1 + t, h + 0.25, z1 + t], { collide: false, cast: false });
  const walls = { height: h, lower: 'labPanel', upper: 'wallLab', paintLine: panel } as const;
  // North: the power room's wall stands here. West: the server hall's, as
  // far as the hall goes. Face both with a skin of this room's own, so the
  // lab is closed whether or not those rooms are being drawn.
  wall(b, { ...walls, along: 'x', near: z0, far: z0 + SKIN, from: x0, to: x1, solid: false, openings: [{ from: powerDoor.from, to: powerDoor.to, top: powerDoor.top }] });
  wall(b, { ...walls, along: 'z', near: x0, far: x0 + SKIN, from: z0, to: hallEnd, solid: false, openings: [{ from: hallDoor.from, to: hallDoor.to, top: hallDoor.top }] });
  wall(b, { ...walls, along: 'z', near: x0 - t, far: x0, from: hallEnd, to: z1 + t });
  wall(b, { ...walls, along: 'x', near: z1, far: z1 + t, from: x0, to: x1 + t });
  wall(b, { ...walls, along: 'z', near: x1, far: x1 + t, from: z0 - t, to: z1, openings: [{ from: LAB_LINE.z0, to: LAB_LINE.z1, top: LAB_LINE.top }] });
  // A dark rail caps the panelling, and a kick strip runs along the floor.
  const trim = (along: 'x' | 'z', at: number, inward: 1 | -1, from: number, to: number, gaps: Array<[number, number]> = []) => {
    let cursor = from;
    for (const [g0, g1] of [...gaps, [to, to] as [number, number]]) {
      if (g0 - cursor > 0.001) {
        const a = Math.min(at, at + inward * 0.035);
        const c = Math.max(at, at + inward * 0.035);
        for (const [y0, y1] of [
          [panel - 0.03, panel + 0.03],
          [0, 0.14],
          [1.32, 1.36],
        ] as const) {
          const min: Vec3 = along === 'x' ? [cursor, y0, a] : [a, y0, cursor];
          const max: Vec3 = along === 'x' ? [g0, y1, c] : [c, y1, g0];
          b.box('darkSteel', min, max, { collide: false, cast: false });
        }
      }
      cursor = g1;
    }
  };
  trim('x', z0 + SKIN, 1, x0, x1, [[powerDoor.from - 0.32, powerDoor.to + 0.32]]);
  trim('x', z1, -1, x0, x1);
  trim('z', x0 + SKIN, 1, z0, z1, [[hallDoor.from - 0.32, hallDoor.to + 0.32]]);
  trim('z', x1, -1, z0, z1, [[LAB_LINE.z0 - 0.32, LAB_LINE.z1 + 0.32]]);
  // Girders, and joists across them.
  for (const x of [13.2, 18.4]) ibeam(b, 'z', z0, z1, x, h, 0.45, 0.28);
  for (const z of [16.6, 20.2, 23.8, 27.4]) ibeam(b, 'x', x0, x1, z, h, 0.28, 0.18);

  // ---- The assembly line: a hatch in the east wall, the yard beyond it
  // that the robots cross, and an overhead rail that brings torsos in from
  // it on hangers.
  const lineZ = (LAB_LINE.z0 + LAB_LINE.z1) / 2;
  approach(b, { area: 'lab', out: 1, wallX: x1 + t, ...LAB_LINE, name: 'labLine' }, lights, haze, dustBeams);
  b.prop('rollershutter_door', { at: [x1 + 0.3, LAB_LINE.top - 0.7, lineZ], scale: [2.75, 1.05, 1], rot: [0, HALF_PI, 0.04], collide: false });
  const railY = 4.25;
  const railZ = LAB_LINE.z0 - 0.75;
  ibeam(b, 'x', CELL.x1 - 0.6, x1, railZ, railY + 0.2, 0.2, 0.16);
  for (let hx = CELL.x1; hx < x1; hx += 1.5) b.tube('darkSteel', [hx, railY + 0.2, railZ], [hx, h, railZ], 0.015, false);
  const hangers = [19.4, 20.9, 22.3];
  for (const hx of hangers) {
    b.box('darkSteel', [hx - 0.12, railY - 0.12, railZ - 0.08], [hx + 0.12, railY, railZ + 0.08], { collide: false, cast: false });
    b.tube('darkSteel', [hx, railY - 0.12, railZ], [hx, railY - 0.62, railZ], 0.014, false);
    b.box('hazard', [hx - 0.2, railY - 0.68, railZ - 0.035], [hx + 0.2, railY - 0.62, railZ + 0.035], { collide: false, cast: false });
  }

  // ---- The assembly cell: fenced, so nothing walks into it.
  const { x0: cx0, x1: cx1, z0: cz0, z1: cz1 } = CELL;
  const cmx = (cx0 + cx1) / 2;
  const cmz = (cz0 + cz1) / 2;
  b.blocker([cx0, 0, cz0], [cx1, 2.4, cz1]);
  // Hazard paint on the floor inside the fence, and a steel plate under the jig.
  const stripes = atlas.stripes(512, 64, PAINT.yellow, PAINT.black, 0.5);
  const hatch = (centre: Vec3, width: number, roll = 0) => b.decal(atlas.texture, centre, [0, 1, 0], width, 0.3, { uvRect: stripes.uv, roll, opacity: 0.85 });
  hatch([cmx, 0, cz0 + 0.2], cx1 - cx0 - 0.1);
  hatch([cmx, 0, cz1 - 0.2], cx1 - cx0 - 0.1);
  hatch([cx0 + 0.2, 0, cmz], cz1 - cz0 - 0.1, HALF_PI);
  hatch([cx1 - 0.2, 0, cmz], cz1 - cz0 - 0.1, HALF_PI);
  b.box('treadPlate', [cmx - 1.0, 0, cmz - 1.0], [cmx + 1.0, 0.02, cmz + 1.0], { collide: false, cast: false });
  // The fence: posts at the corners and along each side, two rails between them.
  const posts: Array<[number, number]> = [];
  for (const px of [cx0, cx0 + (cx1 - cx0) / 3, cx0 + ((cx1 - cx0) * 2) / 3, cx1]) {
    posts.push([px, cz0], [px, cz1]);
  }
  for (const pz of [cz0 + (cz1 - cz0) / 3, cz0 + ((cz1 - cz0) * 2) / 3]) {
    posts.push([cx0, pz], [cx1, pz]);
  }
  for (const [px, pz] of posts) {
    b.box('hazard', [px - 0.04, 0, pz - 0.04], [px + 0.04, 1.2, pz + 0.04], { collide: false });
    b.box('darkSteel', [px - 0.07, 0, pz - 0.07], [px + 0.07, 0.03, pz + 0.07], { collide: false, cast: false });
  }
  for (const y of [0.55, 1.15]) {
    b.tube('hazard', [cx0, y, cz0], [cx1, y, cz0], 0.025, false);
    b.tube('hazard', [cx0, y, cz1], [cx1, y, cz1], 0.025, false);
    b.tube('hazard', [cx0, y, cz0], [cx0, y, cz1], 0.025, false);
    b.tube('hazard', [cx1, y, cz0], [cx1, y, cz1], 0.025, false);
  }
  // The jig: a column with a clamp at hip height, holding the unit being built.
  drum(b, 'darkSteel', [cmx, 0.05, cmz], 0.5, 0.1, 'y', 20, false);
  b.tube('steelPlate', [cmx, 0.1, cmz - 0.32], [cmx, 1.22, cmz - 0.32], 0.07);
  b.box('darkSteel', [cmx - 0.26, 1.1, cmz - 0.4], [cmx + 0.26, 1.24, cmz - 0.12], { collide: false });
  for (const s of [-1, 1]) b.box('hazard', [cmx + s * 0.3 - 0.03, 1.0, cmz - 0.3], [cmx + s * 0.3 + 0.03, 1.34, cmz - 0.02], { collide: false, cast: false });
  // Three arms round it: one welding at its shoulder, one holding its other
  // arm ready, one folded back and waiting.
  const chest: Vec3 = [cmx, 1.62, cmz];
  assemblyArm(b, [cx0 + 0.75, cz0 + 0.8], [
    [cx0 + 0.75, 1.75, cz0 + 0.8],
    [cx0 + 1.5, 2.55, cz0 + 1.45],
    [chest[0] - 0.62, 2.05, chest[2] - 0.5],
    [chest[0] - 0.36, 1.78, chest[2] - 0.26],
  ]);
  assemblyArm(b, [cx1 - 0.75, cz0 + 0.9], [
    [cx1 - 0.75, 1.7, cz0 + 0.9],
    [cx1 - 1.2, 2.35, cz0 + 1.75],
    [chest[0] + 1.02, 1.82, chest[2] - 0.12],
    [chest[0] + 0.86, 1.66, chest[2] - 0.04],
  ]);
  assemblyArm(b, [cmx + 0.3, cz1 - 0.75], [
    [cmx + 0.3, 1.7, cz1 - 0.75],
    [cmx + 0.75, 2.75, cz1 - 1.05],
    [cmx + 0.5, 2.9, cz1 - 1.85],
    [cmx + 0.42, 2.62, cz1 - 2.0],
  ]);
  // A control post outside the fence, with a screen on it.
  b.box('steelPlate', [cx0 - 0.34, 0, cz1 - 1.2], [cx0 - 0.08, 1.25, cz1 - 0.5]);
  b.box('darkSteel', [cx0 - 0.36, 1.25, cz1 - 1.22], [cx0 - 0.06, 1.3, cz1 - 0.48], { collide: false, cast: false });
  screens.add([cx0 - 0.345, 0.95, cz1 - 0.85], [-1, 0, 0], 0.46, 0.36, 'log');

  // ---- Robot parts: the unit on the jig, torsos on the line's hangers,
  // limbs hanging in rows on the south wall, and two finished units
  // standing dark in the recharging bays by the west wall.
  if (robots) {
    const drudge = new Parts(robots.drudge);
    const torso = drudge.take(TORSO_BONES);
    const leftArm = drudge.take(ARM_BONES, 'Left');
    const rightArm = drudge.take(ARM_BONES, 'Right');
    const leftLeg = drudge.take(LEG_BONES, 'Left');
    const rightLeg = drudge.take(LEG_BONES, 'Right');
    // On the jig: a torso clamped at the hips, with one arm fitted, facing the room's west door.
    const jigY = 1.16 - Parts.low(torso);
    drudge.place(torso, [cmx, jigY, cmz], [0, -HALF_PI, 0]);
    drudge.place(leftArm, [cmx, jigY, cmz], [0, -HALF_PI, 0]);
    // Its other arm, in the second assembly arm's grip (roughly: it is on its way in).
    drudge.place(rightArm, [cmx + 0.3, jigY + 0.06, cmz + 0.4], [0, -HALF_PI, 0.16]);
    // Its legs, on a trolley inside the fence.
    b.box('steelPlate', [cx1 - 1.5, 0.34, cz1 - 2.2], [cx1 - 0.5, 0.4, cz1 - 0.6], { collide: false });
    for (const [tx, tz] of [
      [cx1 - 1.44, cz1 - 2.14],
      [cx1 - 0.56, cz1 - 2.14],
      [cx1 - 1.44, cz1 - 0.66],
      [cx1 - 0.56, cz1 - 0.66],
    ] as const) {
      b.tube('darkSteel', [tx, 0, tz], [tx, 0.34, tz], 0.02, false);
    }
    drudge.set(leftLeg, 'on', [cx1 - 1.2, 0.4, cz1 - 1.4], [HALF_PI, 0.2, 0]);
    drudge.set(rightLeg, 'on', [cx1 - 0.8, 0.4, cz1 - 1.4], [HALF_PI, -0.15, 0]);
    // Torsos coming in on the line, hanging from their hangers.
    hangers.forEach((hx, i) => drudge.set(torso, 'under', [hx, railY - 0.66, railZ], [0, HALF_PI + (i - 1) * 0.12, 0]));
    // Limbs on the south wall: arms hang from the rail by the shoulder, legs stand in a rack further along.
    for (let i = 0; i < 5; i++) drudge.set(i % 2 === 0 ? leftArm : rightArm, 'under', [16.6 + i * 0.6, 3.6, z1 - 0.2], [0, 0, i % 2 === 0 ? HALF_PI : -HALF_PI]);
    for (let i = 0; i < 4; i++) drudge.set(i % 2 === 0 ? leftLeg : rightLeg, 'on', [10.5 + i * 0.52, 0.06, z1 - 0.32], [0, Math.PI, 0]);
    // The two units in the recharging bays, whole and switched off.
    const whole = mergeGeometries([torso, leftArm, rightArm, leftLeg, rightLeg])!;
    for (const bz of [22.6, 24.6]) drudge.set(whole, 'on', [x0 + SKIN + 0.42, 0.02, bz], [0, HALF_PI, 0]);
    const built = drudge.build('lab-parts');
    if (built) b.addObject(built);

    // A heavy's plated torso on a stand by the south wall: the next thing off the line.
    const heavy = new Parts(robots.heavy);
    heavy.set(heavy.take(TORSO_BONES), 'on', [14.9, 0.5, z1 - 0.95], [0, Math.PI, 0]);
    const heavyBuilt = heavy.build('lab-heavy-parts');
    if (heavyBuilt) b.addObject(heavyBuilt);
  }
  // The racks and bays those parts are in.
  // Arm rail on the south wall: a bar with hooks, and a backing plate.
  b.box('labPanel', [16.2, 2.4, z1 - 0.05], [19.5, 3.8, z1], { collide: false, cast: false });
  b.tube('darkSteel', [16.25, 3.62, z1 - 0.2], [19.45, 3.62, z1 - 0.2], 0.022, false);
  for (let ax = 16.4; ax < 19.5; ax += 0.56) b.tube('darkSteel', [ax, 3.62, z1 - 0.2], [ax, 3.62, z1], 0.014, false);
  // Leg rack on the south wall, further west: a low frame the legs stand in.
  b.box('darkSteel', [10.1, 0, z1 - 0.62], [12.5, 0.06, z1], { collide: false, cast: false });
  for (const y of [0.5, 1.0]) b.tube('darkSteel', [10.1, y, z1 - 0.6], [12.5, y, z1 - 0.6], 0.02, false);
  for (const px of [10.1, 12.5]) b.tube('darkSteel', [px, 0, z1 - 0.6], [px, 1.05, z1 - 0.6], 0.025, false);
  b.blocker([10.0, 0, z1 - 0.7], [12.6, 1.9, z1]);
  // The heavy's stand.
  b.box('steelPlate', [14.3, 0, z1 - 1.5], [15.5, 0.5, z1 - 0.4]);
  b.box('hazard', [14.28, 0.44, z1 - 1.52], [15.52, 0.5, z1 - 0.38], { collide: false, cast: false });
  b.blocker([14.2, 0, z1 - 1.6], [15.6, 2.4, z1]);
  // Recharging bays on the west wall: a steel back plate, side cheeks, a lamp bar and a cable each.
  for (const bz of [22.6, 24.6]) {
    b.box('labPanel', [x0 + SKIN, 0, bz - 0.62], [x0 + SKIN + 0.06, 2.5, bz + 0.62], { collide: false, cast: false });
    for (const s of [-1, 1]) b.box('darkSteel', [x0 + SKIN, 0, bz + s * 0.62 - 0.03], [x0 + SKIN + 0.8, 2.5, bz + s * 0.62 + 0.03], { collide: false });
    b.box('darkSteel', [x0 + SKIN, 2.44, bz - 0.65], [x0 + SKIN + 0.84, 2.52, bz + 0.65], { collide: false, cast: false });
    b.cable('cable', [x0 + SKIN + 0.1, 2.44, bz + 0.3], [x0 + SKIN + 0.4, 1.5, bz + 0.12], 0.25, 0.02);
    b.box('hazard', [x0 + SKIN + 0.78, 0, bz - 0.62], [x0 + SKIN + 0.84, 0.05, bz + 0.62], { collide: false, cast: false });
  }
  b.blocker([x0, 0, 21.9], [x0 + 0.95, 2.5, 25.3]);

  // ---- The parts cage in the south-east corner: steel bars, and a stand
  // just inside the gate for the override key. (The gate, its lock and the
  // key are moving parts: see world/MissionSet.ts.)
  const kx0 = KEY_CAGE.x0;
  const kz0 = KEY_CAGE.z0;
  const gate = KEY_CAGE.gate;
  const bars = (along: 'x' | 'z', from: number, to: number, at: number) => {
    for (let u = from; u <= to + 0.001; u += 0.13) {
      const p: Vec3 = along === 'x' ? [u, 0, at] : [at, 0, u];
      b.tube('darkSteel', p, [p[0], 2.6, p[2]], 0.012, false);
    }
    for (const y of [0.08, 1.3, 2.6]) {
      const a: Vec3 = along === 'x' ? [from, y, at] : [at, y, from];
      const c: Vec3 = along === 'x' ? [to, y, at] : [at, y, to];
      b.tube('rustedSteel', a, c, 0.022, false);
    }
  };
  bars('x', kx0, x1, kz0);
  bars('z', kz0, gate.z0, kx0);
  bars('z', gate.z1, z1, kx0);
  for (const [px, pz] of [
    [kx0, kz0],
    [x1 - 0.05, kz0],
    [kx0, z1 - 0.05],
    [kx0, gate.z0],
    [kx0, gate.z1],
  ] as const) {
    b.box('rustedSteel', [px - 0.04, 0, pz - 0.04], [px + 0.04, 2.7, pz + 0.04], { collide: false });
  }
  // Nobody gets into the cage, open or shut: the key is taken through the gateway.
  b.blocker([kx0 - 0.05, 0, kz0 - 0.05], [x1, 2.7, kz0 + 0.05]);
  b.blocker([kx0 - 0.05, 0, kz0], [kx0 + 0.05, 2.7, z1]);
  const stand = KEY_CAGE.stand;
  b.box('steelPlate', [stand.x - 0.26, 0, stand.z - 0.26], [stand.x + 0.26, stand.top - 0.05, stand.z + 0.26], { collide: false });
  b.box('darkSteel', [stand.x - 0.32, stand.top - 0.05, stand.z - 0.32], [stand.x + 0.32, stand.top, stand.z + 0.32], { collide: false });
  b.prop('ammo_box', { at: [22.0, 0, 27.9], rotY: 0.6, collide: false });
  b.prop('steel_frame_shelves_03', { at: [21.6, 0, z1 - 0.4], rotY: Math.PI, collide: false });
  b.prop('metal_tool_chest', { at: [x1 - 0.36, 0, 28.3], rotY: -HALF_PI, collide: false });

  // ---- Benches along the north wall, under a bank of screens
  b.prop('metal_office_desk', { at: [11.2, 0, z0 + 0.5], rotY: 0 });
  b.prop('metal_office_desk', { at: [13.3, 0, z0 + 0.5], rotY: 0 });
  b.prop('metal_tool_chest', { at: [15.0, 0, z0 + 0.4], rotY: 0 });
  b.blocker([x0, 0, z0], [15.7, 1.1, z0 + 1.05]);
  b.prop('classic_laptop', { at: [11.0, 0.76, z0 + 0.5], rotY: 0.25, collide: false });
  b.prop('desk_lamp_arm_01', { at: [12.0, 0.76, z0 + 0.3], rotY: 0.6, collide: false });
  b.prop('clipboard', { at: [13.1, 0.77, z0 + 0.62], rotY: -0.4, collide: false });
  b.prop('metal_stool_02', { at: [12.6, 0, z0 + 1.6], rotY: 0.5, collide: false });
  b.box('rackSteel', [10.4, 1.5, z0 + SKIN], [14.4, 2.62, z0 + SKIN + 0.1], { collide: false, cast: false });
  (['log', 'eye', 'lockdown', 'static'] as const).forEach((feed, i) => screens.add([10.95 + i * 0.97, 2.06, z0 + SKIN + 0.105], [0, 0, 1], 0.84, 0.62, feed));
  // Clutter that belongs here, all of it tight against a wall.
  b.prop('utility_box_01', { at: [x1 - 0.26, 0, 17.0], rotY: -HALF_PI });
  b.prop('power_box_01', { at: [x1 - 0.08, 1.55, 19.2], rotY: -HALF_PI, collide: false });
  b.prop('korean_fire_extinguisher_01', { at: [x1 - 0.22, 0, 20.6], rotY: -HALF_PI });
  b.prop('security_camera_01', { at: [x1 - 0.3, 4.2, z0 + 0.3], rotY: -Math.PI / 4, collide: false });
  b.prop('security_camera_01', { at: [x0 + 0.3, 4.2, z1 - 0.3], rotY: (Math.PI * 3) / 4, collide: false });
  for (let dz = z0 + 0.3; dz + 1.2 <= z1 - 0.2; dz += 1.2) b.prop('modular_airduct_rectangular_01', { part: 'double_01', at: [21.4, h - 0.62, dz], collide: false });
  screens.finish();
  b.addObject(screens.object);

  // ---- Ceiling vent, and the shotgun's rack
  for (const entry of ENTRY_PLANS) if (entry.area === 'lab' && entry.kind === 'drop') vent(b, entry.at[0], entry.at[1], h);
  for (const rack of RACK_PLANS) if (rack.area === 'lab') weaponRack(b, atlas, assets, rack, lights);

  // ---- Signs and floor markings
  const put = (sign: Sign, centre: Vec3, normal: Vec3, width: number, options: { roll?: number; opacity?: number; emissive?: number; tint?: number } = {}) => {
    b.decal(atlas.texture, centre, normal, width, width / sign.aspect, { ...options, uvRect: sign.uv });
  };
  const N: Vec3 = [0, 0, 1];
  const S: Vec3 = [0, 0, -1];
  const E: Vec3 = [-1, 0, 0];
  const W: Vec3 = [1, 0, 0];
  const FLOOR: Vec3 = [0, 1, 0];
  put(atlas.text('SECTOR E', { size: 120, wear: 0.4 }), [12.4, 3.9, z1], S, 2.1, { opacity: 0.7 });
  put(atlas.text('ROBOTICS LAB', { size: 60, wear: 0.4 }), [12.4, 3.45, z1], S, 2.1, { opacity: 0.7 });
  put(atlas.eye(300, PAINT.white, 0.35), [x0 + SKIN, 3.7, 28.2], W, 1.3, { opacity: 0.65 });
  put(atlas.text(['NO HUMAN OPERATORS', 'BEYOND THIS LINE'], { size: 54, color: PAINT.red, box: true, plate: PAINT.white, wear: 0.3 }), [x0 + SKIN, 3.3, 16.2], W, 2.0, { opacity: 0.9 });
  put(atlas.text('ASSEMBLY LINE', { size: 70, color: PAINT.yellow, wear: 0.4 }), [x1, LAB_LINE.top + 0.5, lineZ], E, 1.9, { opacity: 0.9 });
  put(atlas.text('SERVER HALL', { size: 70, color: PAINT.yellow, wear: 0.4 }), [x0 + SKIN, hallDoor.top + 0.5, (hallDoor.from + hallDoor.to) / 2], W, 1.7, { opacity: 0.9 });
  put(atlas.text('POWER ROOM', { size: 70, color: PAINT.yellow, wear: 0.4 }), [(powerDoor.from + powerDoor.to) / 2, powerDoor.top + 0.5, z0 + SKIN], N, 1.7, { opacity: 0.9 });
  put(atlas.text(['KEY STORAGE', 'AUTHORISED UNITS ONLY'], { size: 46, box: true, wear: 0.4 }), [x1, 3.2, 28.9], E, 1.8, { opacity: 0.8 });
  const cell = atlas.text('CELL 01', { size: 110, color: PAINT.amber, plate: '#0d0f11', wear: 0 });
  b.box('darkSteel', [cx0 - 0.35, 1.36, cz1 - 1.2], [cx0 - 0.3, 1.72, cz1 - 0.5], { collide: false, cast: false });
  put(cell, [cx0 - 0.352, 1.54, cz1 - 0.85], E, 0.62, { emissive: 2.2, tint: 0xffb060 });
  put(atlas.text('RECHARGE', { size: 60, wear: 0.4 }), [x0 + SKIN, 2.9, 23.6], W, 1.5, { opacity: 0.75 });
  // A lane line from each door round the cell, and hatching in front of the doors and the hatch.
  const guide = atlas.line(900, 36, PAINT.yellow, 0.7);
  put(guide, [11.5, 0, 22.0], FLOOR, 5.6, { roll: HALF_PI, opacity: 0.55 });
  put(guide, [20.6, 0, 18.0], FLOOR, 5.6, { roll: HALF_PI, opacity: 0.55 });
  put(guide, [16.2, 0, 26.2], FLOOR, 6.4, { opacity: 0.55 });
  b.decalImage('RoadLines022A', [x0 + 1.0, 0, (hallDoor.from + hallDoor.to) / 2], FLOOR, 1.7, 2.4, { opacity: 0.5 });
  b.decalImage('RoadLines022A', [(powerDoor.from + powerDoor.to) / 2, 0, z0 + 1.0], FLOOR, 2.4, 1.7, { opacity: 0.5 });
  b.decalImage('RoadLines022A', [x1 - 1.2, 0, lineZ], FLOOR, 2.0, 3.2, { opacity: 0.55 });
  const stain = (id: 'Leaking003' | 'Leaking004', centre: Vec3, normal: Vec3, w: number, hgt: number, opacity = 0.5) => b.decalImage(id, centre, normal, w, hgt, { opacity, tint: 0x5b5a52 });
  stain('Leaking004', [x1, 3.9, 17.8], E, 2.6, 2.2);
  stain('Leaking003', [19.0, 3.9, z1], S, 2.8, 2.2, 0.4);

  // ---- Lighting. Strip lights in two rows give a flat, cold, green-white
  // light with no warmth in it anywhere but the bench lamp; the cell has
  // two work lamps of its own and the blue-white arc of the welder, which
  // comes and goes; a red lamp turns inside the fence; the cage's own lamp
  // is amber, like everything else the mission wants found.
  const strips: Array<[number, number, boolean]> = [
    [11.6, 17.4, false],
    [11.6, 22.4, true],
    [11.6, 27.6, false],
    [20.6, 17.6, false],
    [20.4, 21.2, false],
    [16.0, 28.2, false],
  ];
  strips.forEach(([sx, sz, faulty], i) => {
    const fixture = b.prop('caged_hanging_light', { at: [sx, h, sz], rotY: i % 2 ? HALF_PI : 0, collide: false, unique: true });
    lights.push({
      name: `labStrip${i}`,
      area: 'lab',
      kind: 'point',
      color: STRIP,
      intensity: 26,
      position: [sx, h - 0.68, sz],
      distance: 10,
      flicker: faulty ? 'faulty' : undefined,
      glow: { materials: fixture.filter((m) => m.emissiveMap || /glass|light$/i.test(m.name)), color: 0xd6fff4, intensity: 5.5 },
    });
  });
  // Work lamps over the cell, hung from the girders either side of it.
  const work: Array<{ from: Vec3; shadow?: number }> = [
    { from: [cx0 + 0.2, 4.2, cz0 + 0.3], shadow: 1 },
    { from: [cx1 - 0.2, 4.2, cz1 - 0.3], shadow: 3 },
  ];
  work.forEach((lamp, i) => {
    const fixture = b.prop('hanging_industrial_lamp', { at: [lamp.from[0], lamp.from[1] + 0.55, lamp.from[2]], rotY: i * 1.3, collide: false, unique: true, scale: 0.7 });
    b.tube('darkSteel', [lamp.from[0], lamp.from[1] + 0.55, lamp.from[2]], [lamp.from[0], h, lamp.from[2]], 0.016, false);
    lights.push({
      name: `labWork${i}`,
      area: 'lab',
      kind: 'spot',
      color: 0xe6fff8,
      intensity: 170,
      position: lamp.from,
      target: [cmx, 1.2, cmz],
      angle: 0.62,
      penumbra: 0.7,
      distance: 9,
      shadow: lamp.shadow,
      glow: { materials: fixture.filter((m) => m.emissiveMap || /glass|light$/i.test(m.name)), color: 0xe6fff8, intensity: 5 },
    });
    dustBeams.push({ position: lamp.from, target: [cmx, 1.2, cmz], angle: 0.5, color: 0xe6fff8, strength: 0.35 });
  });
  // The welder's arc at the unit's shoulder, and a red lamp turning inside the fence.
  lights.push({ name: 'labArc', area: 'lab', kind: 'point', color: ARC, intensity: 30, position: [chest[0] - 0.4, 1.9, chest[2] - 0.3], distance: 7, flicker: 'faulty' });
  lights.push({ name: 'labCellBeacon', area: 'lab', kind: 'point', color: RED, intensity: 5, position: [cmx + 0.3, 2.9, cz1 - 0.9], distance: 6, flicker: 'beacon' });
  // The bench lamp, the two doors, the cage.
  lights.push({ name: 'labBench', area: 'lab', kind: 'point', color: 0xffd8a8, intensity: 6, position: [12.2, 1.4, z0 + 0.7], distance: 4 });
  lights.push({ name: 'labHallDoor', area: 'lab', kind: 'point', color: 0xd6e4ff, intensity: 4, position: [x0 + 0.7, 2.9, (hallDoor.from + hallDoor.to) / 2], distance: 4.5 });
  lights.push({ name: 'labPowerDoor', area: 'lab', kind: 'point', color: 0xffe2b8, intensity: 4, position: [(powerDoor.from + powerDoor.to) / 2, 2.9, z0 + 0.7], distance: 4.5 });
  lights.push({ name: 'cageLamp', area: 'lab', kind: 'point', color: AMBER, intensity: 9, position: [21.4, 2.1, 28.9], distance: 5.5 });
  // Bounce: the strips off the pale floor.
  lights.push({ name: 'labBounceN', area: 'lab', kind: 'point', color: 0xcffff2, intensity: 9, position: [16.2, 2.3, 17.2], distance: 12 });
  lights.push({ name: 'labBounceS', area: 'lab', kind: 'point', color: 0xcffff2, intensity: 9, position: [15.6, 2.3, 27.2], distance: 12 });

  const built = b.build();
  return { id: 'lab', ...built, lights, haze, dustBeams, tick: (time) => screens.update(time) };
}
