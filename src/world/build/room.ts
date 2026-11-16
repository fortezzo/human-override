// Parts that every room is made of: walls with doorways in them, columns,
// steel beams, the torn-open ceiling vents robots drop from, the fenced-in
// approaches they walk in along, and the wall racks that weapons hang on.

import * as THREE from 'three';
import { LOADOUT, WEAPONS, type WeaponId } from '../../config';
import type { Assets } from '../../core/assets';
import { createFogCard, type ConeShaft, type DustBeam, type FogCard } from '../../render/atmosphere';
import type { LightDef } from '../../render/lighting';
import type { MaterialKey } from '../../render/materials';
import type { Collider } from '../../sim/collision';
import { VIEW_MODELS, dressGun } from '../../entities/weapon/viewModels';
import type { AreaId, RackPlan } from '../plan';
import { COLUMN, VENT_SIZE, WALL } from '../plan';
import { boxBetween } from './geometry';
import type { LevelBuilder } from './LevelBuilder';
import { PAINT, type SignAtlas } from './SignAtlas';

type Vec3 = THREE.Vector3Tuple;

export type Haze = { effect: ConeShaft | FogCard; follows?: string };

/** Everything one area contributes to the world. */
export interface AreaBuild {
  id: AreaId;
  group: THREE.Group;
  colliders: Collider[];
  /** Meshes that stop bullets. */
  solids: THREE.Mesh[];
  lights: LightDef[];
  haze: Haze[];
  dustBeams: DustBeam[];
  /** Called every frame while the area can be seen (animated screens and the like). */
  tick?: (time: number) => void;
  /** The core only: how awake ARGUS is, 1 to 0. Its eye on the wall follows this. */
  argus?: { awake: number };
}

/**
 * Something else to be built into a room with the room's own builder, so
 * that it is merged into the room's few large shapes instead of adding
 * shapes of its own to draw (the stations: see world/Stations.ts).
 */
export type Fixtures = (b: LevelBuilder) => void;

export interface Opening {
  from: number;
  to: number;
  top: number;
}

export interface WallSpec {
  /** The wall runs along this axis ... */
  along: 'x' | 'z';
  /** ... with its thickness between these two positions on the other axis ... */
  near: number;
  far: number;
  /** ... from here to here. */
  from: number;
  to: number;
  height: number;
  /** Lower band up to `paintLine`, and the wall above it. */
  lower: MaterialKey;
  upper: MaterialKey;
  paintLine: number;
  openings?: Opening[];
  /**
   * False for a "skin": a thin facing laid over the back of a neighbouring
   * room's wall. It can be seen and stops bullets, but the wall behind it
   * is what stops people. Each room is drawn only while it can be seen, so
   * each has to be closed off by surfaces of its own: where one borrowed
   * the back of a neighbour's wall, that stretch vanished whenever the
   * neighbour was not being drawn, and the night sky showed through.
   */
  solid?: boolean;
}

/** A straight wall, two-tone like the lobby's, with doorways cut in it. */
export function wall(b: LevelBuilder, spec: WallSpec): void {
  const { along, near, far, height, lower, upper, paintLine } = spec;
  const piece = (key: MaterialKey, u0: number, u1: number, y0: number, y1: number) => {
    if (u1 - u0 < 0.001 || y1 - y0 < 0.001) return;
    const min: Vec3 = along === 'x' ? [u0, y0, near] : [near, y0, u0];
    const max: Vec3 = along === 'x' ? [u1, y1, far] : [far, y1, u1];
    b.box(key, min, max, { cast: false, collide: spec.solid ?? true });
  };
  const solid = (u0: number, u1: number, y0 = 0) => {
    if (y0 < paintLine) piece(lower, u0, u1, y0, paintLine);
    piece(upper, u0, u1, Math.max(y0, paintLine), height);
  };
  let cursor = spec.from;
  for (const opening of [...(spec.openings ?? [])].sort((a, c) => a.from - c.from)) {
    solid(cursor, opening.from);
    solid(opening.from, opening.to, opening.top);
    cursor = opening.to;
  }
  solid(cursor, spec.to);
}

/** A steel I-beam built from two flanges and a web. `along` is its long axis. */
export function ibeam(b: LevelBuilder, along: 'x' | 'z', from: number, to: number, at: number, top: number, depth: number, width: number): void {
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

/** A concrete column with a hazard-striped steel sleeve at its foot and a collar under the girders. */
export function column(b: LevelBuilder, cx: number, cz: number, height: number): void {
  const half = COLUMN / 2;
  b.box('concreteDark', [cx - half, 0, cz - half], [cx + half, height - 0.5, cz + half]);
  b.box('hazard', [cx - half - 0.02, 0, cz - half - 0.02], [cx + half + 0.02, 1.0, cz + half + 0.02], { collide: false });
  b.box('darkSteel', [cx - half - 0.03, 1.0, cz - half - 0.03], [cx + half + 0.03, 1.05, cz + half + 0.03], { collide: false });
  b.box('rustedSteel', [cx - half - 0.04, height - 0.62, cz - half - 0.04], [cx + half + 0.04, height - 0.5, cz + half + 0.04], { collide: false });
}

/** A steel portal frame around a doorway in a wall (jambs and a lintel standing proud of both faces). */
export function portal(b: LevelBuilder, along: 'x' | 'z', near: number, far: number, opening: Opening, key: MaterialKey = 'steelPlate'): void {
  const proud = 0.08;
  const lip = 0.3;
  const box = (u0: number, u1: number, y0: number, y1: number, collide: boolean) => {
    const min: Vec3 = along === 'x' ? [u0, y0, near - proud] : [near - proud, y0, u0];
    const max: Vec3 = along === 'x' ? [u1, y1, far + proud] : [far + proud, y1, u1];
    b.box(key, min, max, { collide });
  };
  box(opening.from - lip, opening.from + 0.05, 0, opening.top, true);
  box(opening.to - 0.05, opening.to + lip, 0, opening.top, true);
  box(opening.from - lip, opening.to + lip, opening.top - 0.05, opening.top + 0.3, false);
}

/**
 * A ceiling vent with its grille torn off: a short steel shaft hanging
 * below the ceiling, dark inside, with the grille dangling from one edge.
 * Robots drop out of it.
 */
export function vent(b: LevelBuilder, x: number, z: number, ceiling: number): void {
  const half = VENT_SIZE / 2;
  const drop = 0.7;
  const t = 0.04;
  const y0 = ceiling - drop;
  b.box('darkSteel', [x - half - t, y0, z - half - t], [x + half + t, ceiling, z - half], { collide: false });
  b.box('darkSteel', [x - half - t, y0, z + half], [x + half + t, ceiling, z + half + t], { collide: false });
  b.box('darkSteel', [x - half - t, y0, z - half], [x - half, ceiling, z + half], { collide: false });
  b.box('darkSteel', [x + half, y0, z - half], [x + half + t, ceiling, z + half], { collide: false });
  // A dark lining, so the shaft reads as a hole rather than a box.
  b.box('cable', [x - half, ceiling - 0.03, z - half], [x + half, ceiling - 0.005, z + half], { collide: false, cast: false });
  // Bent flange round the bottom edge.
  b.box('rustedSteel', [x - half - 0.1, y0 - 0.03, z - half - 0.1], [x + half + 0.1, y0, z - half + 0.02], { collide: false });
  b.box('rustedSteel', [x - half - 0.1, y0 - 0.03, z + half - 0.02], [x + half + 0.1, y0, z + half + 0.1], { collide: false });
  b.box('rustedSteel', [x - half - 0.1, y0 - 0.03, z - half], [x - half + 0.02, y0, z + half], { collide: false });
  b.box('rustedSteel', [x + half - 0.02, y0 - 0.03, z - half], [x + half + 0.1, y0, z + half], { collide: false });
  // The grille, hanging by one edge.
  const grille = boxBetween([x - half, y0 - 0.03, z - half], [x + half, y0, z + half]);
  grille.translate(-(x + half), -y0, 0).rotateZ(-1.25).translate(x + half, y0, 0);
  b.mesh('treadPlate', grille);
}

export interface ApproachSpec {
  area: AreaId;
  /** Which way is "out" from the building. */
  out: 1 | -1;
  /** Outer face of the building wall (an x position), and the opening in it. */
  wallX: number;
  z0: number;
  z1: number;
  top: number;
  depth: number;
  name: string;
}

/**
 * The walled yard outside an opening in an east or west wall, which robots
 * cross to get in: concrete walls and a slab roof, a hard cold light at the
 * far end so they arrive as silhouettes, glowing fog, and a steel container
 * they come out from behind.
 */
export function approach(b: LevelBuilder, spec: ApproachSpec, lights: LightDef[], haze: Haze[], dustBeams: DustBeam[]): void {
  const { out, wallX, z0, z1, top, depth, area, name } = spec;
  const side = 1.6;
  const height = top + 0.7;
  const far = wallX + out * depth;
  const xs = (a: number, c: number): [number, number] => (a < c ? [a, c] : [c, a]);
  const [xa, xb] = xs(wallX, far);
  const mid = (z0 + z1) / 2;

  b.box('floor', [xa - 0.5, -0.4, z0 - side - 0.5], [xb + 0.5, 0, z1 + side + 0.5], { collide: false, cast: false });
  b.box('concreteDark', [xa, 0, z0 - side - 0.5], [xb, height, z0 - side]);
  b.box('concreteDark', [xa, 0, z1 + side], [xb, height, z1 + side + 0.5]);
  const [ea, eb] = xs(far, far + out * 0.5);
  b.box('concreteDark', [ea, 0, z0 - side - 0.5], [eb, height, z1 + side + 0.5]);
  b.box('concreteDark', [xa - 0.5, height, z0 - side - 0.5], [xb + 0.5, height + 0.3, z1 + side + 0.5], { collide: false });

  // A steel container near the far end. Robots appear in the gap between
  // it and the end wall (the entry's position in plan.ts is the middle of
  // that gap), where they cannot be seen from indoors, and walk out round
  // the end of it.
  const cx = wallX + out * (depth - 2.3);
  b.box('rustedSteel', [cx - 0.75, 0, mid - 0.15], [cx + 0.75, 2.5, z1 + side - 0.25]);
  b.box('darkSteel', [cx - 0.79, 0.3, mid - 0.19], [cx + 0.79, 0.42, z1 + side - 0.2], { collide: false, cast: false });
  b.box('darkSteel', [cx - 0.79, 2.1, mid - 0.19], [cx + 0.79, 2.22, z1 + side - 0.2], { collide: false, cast: false });

  // Portal frame in the building wall, and a tread-plate sill.
  const [wa, wb] = xs(wallX, wallX - out * WALL);
  b.box('steelPlate', [wa - 0.07, 0, z0 - 0.28], [wb + 0.07, top, z0 + 0.06]);
  b.box('steelPlate', [wa - 0.07, 0, z1 - 0.06], [wb + 0.07, top, z1 + 0.28]);
  b.box('steelPlate', [wa - 0.07, top - 0.06, z0 - 0.28], [wb + 0.07, top + 0.32, z1 + 0.28], { collide: false });
  b.box('hazard', [wa - 0.085, 0, z0 - 0.28], [wb + 0.085, 2.0, z0 - 0.02], { collide: false, cast: false });
  b.box('hazard', [wa - 0.085, 0, z1 + 0.02], [wb + 0.085, 2.0, z1 + 0.28], { collide: false, cast: false });
  b.box('treadPlate', [wa - 0.1, 0, z0], [wb + 0.1, 0.012, z1], { collide: false, cast: false });

  // A hard cold flood at the far end, pointing in through the opening.
  const lamp: Vec3 = [far - out * 0.5, height - 0.5, mid - 0.9];
  const aim: Vec3 = [wallX - out * 3.5, 0.6, mid];
  lights.push({ name: `${name}Flood`, area, kind: 'spot', color: 0xbcd6ff, intensity: 620, position: lamp, target: aim, angle: 0.42, penumbra: 0.5, distance: 26, shadow: 1, needsShadow: true });
  dustBeams.push({ position: lamp, target: aim, angle: 0.3, color: 0xbcd6ff, strength: 1.0 });
  const facing: Vec3 = [-out, 0, 0];
  haze.push({ effect: createFogCard([far - out * 0.9, 1.7, mid], facing, z1 - z0 + 2 * side, height + 0.6, 0xbcd6ff, 0.3, [1, 1.2]) });
  haze.push({ effect: createFogCard([wallX + out * depth * 0.45, 1.5, mid], facing, z1 - z0 + 2 * side - 0.4, height, 0xbcd6ff, 0.13, [1, 1.1]) });
}

/**
 * A weapon hanging on a steel board, with its name stencilled above and
 * its price below, under a small amber lamp. The board can face north,
 * south, east or west.
 */
export function weaponRack(b: LevelBuilder, atlas: SignAtlas, assets: Assets, plan: RackPlan, lights: LightDef[]): void {
  const def = WEAPONS[plan.weapon as WeaponId];
  const [x, y, z] = plan.at;
  const [nx, , nz] = plan.normal;
  // The board's own frame: `out` from the wall, `along` across the board, up.
  const point = (out: number, up: number, along: number): Vec3 => [x + nx * out - nz * along, y + up, z + nz * out + nx * along];
  /** An axis-aligned box given two opposite corners in the board's frame. */
  const box = (key: MaterialKey, o0: number, u0: number, a0: number, o1: number, u1: number, a1: number) => {
    const p = point(o0, u0, a0);
    const q = point(o1, u1, a1);
    b.box(key, [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2])], [Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])], { collide: false, cast: false });
  };

  box('darkSteel', 0, -0.57, -0.25, 0.035, 0.57, 0.25);
  box('steelPlate', 0.035, -0.57, -0.25, 0.05, -0.545, 0.25);
  box('steelPlate', 0.035, 0.545, -0.25, 0.05, 0.57, 0.25);
  // Two pegs the weapon rests on.
  for (const dy of [-0.2, 0.16]) b.tube('rustedSteel', point(0.03, dy, 0.06), point(0.13, dy, 0.06), 0.012, false);

  // The weapon itself, muzzle up, flat against the board.
  const view = VIEW_MODELS[plan.weapon as WeaponId];
  const gun = assets.model(view.model).scene.clone(true);
  dressGun(gun, view, assets, { paint: 1.2, glow: 0.83 });
  gun.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) node.castShadow = false;
  });
  const holder = new THREE.Group();
  holder.add(gun);
  // Models point down -Z with their left side toward -X: stand them on end,
  // then turn that side to face the room.
  gun.rotation.x = Math.PI / 2;
  holder.rotation.y = Math.atan2(nx, nz) + Math.PI / 2;
  holder.scale.setScalar(Math.min(1, 0.8 / view.length));
  holder.position.set(...point(0.1, 0.04, 0));
  holder.name = `rack-${plan.weapon}`;
  b.addObject(holder);

  // Name above, price on the foot of the board.
  const normal: Vec3 = [nx, 0, nz];
  const label = atlas.text(def.name.toUpperCase(), { size: 64, color: PAINT.white, wear: 0.25 });
  b.decal(atlas.texture, point(0, 0.7, 0), normal, 0.62, 0.62 / label.aspect, { uvRect: label.uv, opacity: 0.9 });
  // The player starts with the sidearm, so its rack is where its
  // ammunition is bought: the board says so above the price.
  const starting = plan.weapon === LOADOUT.starting;
  if (starting) {
    const note = atlas.text('AMMUNITION', { size: 44, color: PAINT.white, wear: 0.2 });
    b.decal(atlas.texture, point(0.036, -0.4, 0), normal, 0.34, 0.34 / note.aspect, { uvRect: note.uv, opacity: 0.85 });
  }
  const price = atlas.text(String(starting ? def.ammoPrice : def.price), { size: 90, color: PAINT.yellow, wear: 0.15 });
  b.decal(atlas.texture, point(0.036, -0.495, 0), normal, 0.24, 0.24 / price.aspect, { uvRect: price.uv, opacity: 0.95 });

  // A small amber lamp over the board, so the rack can be found in the dark.
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xffa53a, emissiveIntensity: 5, roughness: 0.5 });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(nx) > 0.5 ? 0.05 : 0.34, 0.03, Math.abs(nx) > 0.5 ? 0.34 : 0.05), lampMaterial);
  lamp.position.set(...point(0.07, 0.6, 0));
  b.addObject(lamp);
  lights.push({ name: `rack-${plan.area}-${plan.weapon}`, area: plan.area, kind: 'point', color: 0xffa53a, intensity: 5, position: point(0.42, 0.3, 0), distance: 4 });
}

/**
 * Two steel drums, one standing on the other: taller than anyone can jump,
 * which is the point. Low things can be jumped onto, so the back of a heap
 * of them in a corner would be somewhere a robot's arm does not reach. The
 * drums at the back of each such heap are stacked like this, and the ones
 * in front, which can be climbed, are all within a robot's reach of the
 * open floor.
 */
export function stackedDrums(b: LevelBuilder, x: number, z: number, turn = 0): void {
  const height = 0.93;
  b.prop('Barrel_01', { at: [x, 0, z], rotY: turn, collide: false });
  b.prop('Barrel_01', { at: [x + 0.02, height, z - 0.015], rotY: turn + 2.2, collide: false });
  b.blocker([x - 0.32, 0, z - 0.32], [x + 0.34, height * 2, z + 0.32]);
}

/** A round drum, tank or disc of any size, lying along the given axis. */
export function drum(b: LevelBuilder, key: MaterialKey, centre: Vec3, radius: number, length: number, axis: 'x' | 'y' | 'z', sides = 24, cast = true): void {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, sides);
  if (axis === 'z') geometry.rotateX(Math.PI / 2);
  else if (axis === 'x') geometry.rotateZ(Math.PI / 2);
  geometry.translate(centre[0], centre[1], centre[2]);
  b.mesh(key, geometry, true, cast);
}
