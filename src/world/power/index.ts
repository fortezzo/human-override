// The power room: two dead generators, a bank of transformers and the main
// breaker panel, lit only by emergency lamps because the power is out. The
// east wall is breached to the transformer yard, and a door in the
// south-east corner leads to the robotics lab.

import type { Assets } from '../../core/assets';
import { createConeShaft, type DustBeam } from '../../render/atmosphere';
import type { LightDef } from '../../render/lighting';
import type { MaterialLibrary } from '../../render/materials';
import { LevelBuilder } from '../build/LevelBuilder';
import { approach, drum, ibeam, vent, wall, type AreaBuild, type Haze } from '../build/room';
import { PAINT, SignAtlas, type Sign } from '../build/SignAtlas';
import { ScreenBank } from '../lobby/ScreenBank';
import { DOOR_PLANS, EAST_BREACH, ENTRY_PLANS, LOBBY, POWER, WALL } from '../plan';

type Vec3 = [number, number, number];

const AMBER = 0xff9a2e;
const RED = 0xff2a12;
const SODIUM = 0xffb463;
/** The emergency lamps: warm, but white enough to show what colour things are. */
const LAMP = 0xffc888;
const HALF_PI = Math.PI / 2;
/** Thickness of the facing laid over the back of a neighbouring room's wall. */
const SKIN = 0.03;

/** One generator: a ribbed drum on a steel skid, with an exhaust stack and a control panel. */
function generator(b: LevelBuilder, screens: ScreenBank, x: number, z: number, ceiling: number, number: string, atlas: SignAtlas): void {
  const length = 3.6;
  const radius = 0.82;
  const y = 0.32 + radius;
  // Skid: two rails and three cross-members.
  for (const dx of [-0.55, 0.55]) b.box('rustedSteel', [x + dx - 0.07, 0, z - length / 2 - 0.2], [x + dx + 0.07, 0.3, z + length / 2 + 0.2], { collide: false });
  for (const dz of [-1.5, 0, 1.5]) b.box('darkSteel', [x - 0.75, 0.1, z + dz - 0.06], [x + 0.75, 0.32, z + dz + 0.06], { collide: false });
  // The drum, with flanges at each end and cooling ribs along its body.
  drum(b, 'paintedMetal', [x, y, z], radius, length, 'z');
  for (const dz of [-length / 2, length / 2]) drum(b, 'darkSteel', [x, y, z + dz], radius + 0.07, 0.1, 'z');
  for (let i = -5; i <= 5; i++) drum(b, 'rustedSteel', [x, y, z + i * 0.27], radius + 0.035, 0.035, 'z', 24, false);
  // Terminal housing on top and the exhaust stack up to the ceiling.
  b.box('darkSteel', [x - 0.3, y + radius - 0.08, z - 0.5], [x + 0.3, y + radius + 0.22, z + 0.1], { collide: false });
  b.tube('rustedSteel', [x, y + radius - 0.05, z + 1.1], [x, ceiling, z + 1.1], 0.13);
  b.tube('darkSteel', [x, ceiling - 0.9, z + 1.1], [x, ceiling - 0.8, z + 1.1], 0.17, false);
  // Control panel at the south end, facing the room.
  const pz = z + length / 2 + 0.34;
  b.box('steelPlate', [x - 0.45, 0, pz - 0.14], [x + 0.45, 1.5, pz + 0.14]);
  screens.add([x, 1.14, pz + 0.146], [0, 0, 1], 0.5, 0.38, 'lockdown');
  for (const dx of [-0.26, 0, 0.26]) b.box('hazard', [x + dx - 0.07, 0.66, pz + 0.14], [x + dx + 0.07, 0.8, pz + 0.17], { collide: false, cast: false });
  b.blocker([x - 0.9, 0, z - length / 2 - 0.2], [x + 0.9, 2.0, z + length / 2 + 0.2]);
  const label = atlas.text(`GEN ${number}`, { size: 110, color: PAINT.yellow, wear: 0.5 });
  b.decal(atlas.texture, [x, 0, z + length / 2 + 1.25], [0, 1, 0], 1.5, 1.5 / label.aspect, { uvRect: label.uv, opacity: 0.75 });
  // What makes it read as a machine and not a dark drum: a name plate on
  // each flank, a pale guard over the coupling at the near end, lifting
  // eyes along the top, and a row of status lamps on the control panel.
  const plate = atlas.text(`GEN ${number}`, { size: 90, color: PAINT.yellow, plate: '#14171a', wear: 0.25 });
  for (const side of [-1, 1]) {
    b.box('steelPlate', [x + side * (radius + 0.02) - 0.015, y - 0.2, z - 0.55], [x + side * (radius + 0.02) + 0.015, y + 0.2, z + 0.55], { collide: false, cast: false });
    b.decal(atlas.texture, [x + side * (radius + 0.037), y, z], [side, 0, 0], 1.0, 1.0 / plate.aspect, { uvRect: plate.uv, opacity: 0.95, emissive: 0.5, tint: 0xffc070 });
  }
  b.box('steelPlate', [x - 0.5, 0.32, z + length / 2 + 0.02], [x + 0.5, y + 0.25, z + length / 2 + 0.2], { collide: false });
  for (const dz of [-1.2, 1.2]) {
    b.tube('steelPlate', [x - 0.09, y + radius + 0.06, z + dz], [x + 0.09, y + radius + 0.06, z + dz], 0.022, false);
    for (const dx of [-0.09, 0.09]) b.tube('steelPlate', [x + dx, y + radius - 0.02, z + dz], [x + dx, y + radius + 0.06, z + dz], 0.022, false);
  }
  b.box('hazard', [x - 0.45, 1.5, pz - 0.14], [x + 0.45, 1.56, pz + 0.14], { collide: false, cast: false });
  // A task lamp on a bent arm over the panel: up from its back corner and
  // out over the front, with a lit shade at the end. (Its light is added
  // with the room's other lights.)
  const ax = x + 0.36;
  b.tube('darkSteel', [ax, 1.56, pz - 0.08], [ax, 2.06, pz - 0.08], 0.018, false);
  b.tube('darkSteel', [ax, 2.06, pz - 0.08], [x, 2.02, pz + 0.4], 0.018, false);
  b.box('darkSteel', [x - 0.2, 1.96, pz + 0.26], [x + 0.2, 2.03, pz + 0.54], { collide: false, cast: false });
  const shade = atlas.text('I', { size: 40, color: PAINT.white, plate: PAINT.white, wear: 0 });
  b.decal(atlas.texture, [x, 1.958, pz + 0.4], [0, -1, 0], 0.34, 0.22, { uvRect: shade.uv, emissive: 3.2, tint: 0xffd8a8 });
}

/** A transformer against the north wall: a finned tank with three insulators on top. */
function transformer(b: LevelBuilder, x: number, z: number): void {
  b.box('paintedMetal', [x - 0.65, 0.15, z - 0.5], [x + 0.65, 1.75, z + 0.5]);
  b.box('darkSteel', [x - 0.72, 0, z - 0.56], [x + 0.72, 0.15, z + 0.56], { collide: false });
  b.box('darkSteel', [x - 0.69, 1.75, z - 0.53], [x + 0.69, 1.83, z + 0.53], { collide: false });
  // Cooling fins down the front.
  for (let i = -5; i <= 5; i++) b.box('rustedSteel', [x + i * 0.11 - 0.012, 0.35, z + 0.5], [x + i * 0.11 + 0.012, 1.6, z + 0.68], { collide: false, cast: false });
  for (const dx of [-0.4, 0, 0.4]) {
    b.tube('rustedSteel', [x + dx, 1.83, z], [x + dx, 2.3, z], 0.05, false);
    for (const dy of [0.12, 0.24, 0.36]) b.tube('steelPlate', [x + dx, 1.83 + dy, z], [x + dx, 1.86 + dy, z], 0.085, false);
    b.cable('cable', [x + dx, 2.3, z], [x + dx, 3.4, z - 0.48], 0.12, 0.018);
  }
}

export function buildPower(assets: Assets, materials: MaterialLibrary): AreaBuild {
  const b = new LevelBuilder(assets, materials);
  const atlas = new SignAtlas(2048, 2048);
  const screens = new ScreenBank();
  const lights: LightDef[] = [];
  const haze: Haze[] = [];
  const dustBeams: DustBeam[] = [];
  const { x0, x1, z0, z1, height: h, paintLine } = POWER;
  const t = WALL;
  const service = DOOR_PLANS.find((d) => d.id === 'hallPower')!;
  const labDoor = DOOR_PLANS.find((d) => d.id === 'powerLab')!;

  // ---- Structure
  b.box('floor', [x0, -0.4, z0 - t], [x1 + t, 0, z1 + t], { collide: false, cast: false });
  b.box('ceilingDeck', [x0 - t, h, z0 - t], [x1 + t, h + 0.25, z1 + t], { collide: false, cast: false });
  const walls = { height: h, lower: 'wallPaint', upper: 'wallPower', paintLine } as const;
  wall(b, { ...walls, along: 'x', near: z0 - t, far: z0, from: x0, to: x1 + t });
  wall(b, { ...walls, along: 'x', near: z1, far: z1 + t, from: x0, to: x1 + t, openings: [{ from: labDoor.from, to: labDoor.to, top: labDoor.top }] });
  wall(b, { ...walls, along: 'z', near: x1, far: x1 + t, from: z0, to: z1, openings: [{ from: EAST_BREACH.z0, to: EAST_BREACH.z1, top: EAST_BREACH.top }] });
  // West: the lobby's and the server hall's walls already stand here. Fill
  // in above the lobby's, and face the whole side with a skin of this
  // room's own, so it is closed whether or not those rooms are being drawn.
  b.box('wallPower', [x0 - t, LOBBY.height, z0 - t], [x0, h, LOBBY.z1 + t], { collide: false, cast: false });
  b.box('wallPower', [x0 - t, 0, z0 - t], [x0, h, z0], { cast: false });
  const lobbyDoor = DOOR_PLANS.find((d) => d.id === 'lobbyPower')!;
  wall(b, {
    ...walls,
    along: 'z',
    near: x0,
    far: x0 + SKIN,
    from: z0,
    to: z1,
    solid: false,
    openings: [
      { from: lobbyDoor.from, to: lobbyDoor.to, top: lobbyDoor.top },
      { from: service.from, to: service.to, top: service.top },
    ],
  });
  // Rail capping the painted band.
  b.box('darkSteel', [x0, paintLine - 0.03, z0], [x1, paintLine + 0.03, z0 + 0.03], { collide: false, cast: false });
  b.box('darkSteel', [x0, paintLine - 0.03, z1 - 0.03], [labDoor.from - 0.3, paintLine + 0.03, z1], { collide: false, cast: false });
  b.box('darkSteel', [labDoor.to + 0.3, paintLine - 0.03, z1 - 0.03], [x1, paintLine + 0.03, z1], { collide: false, cast: false });
  b.box('darkSteel', [x1 - 0.03, paintLine - 0.03, z0], [x1, paintLine + 0.03, EAST_BREACH.z0 - 0.3], { collide: false, cast: false });
  b.box('darkSteel', [x1 - 0.03, paintLine - 0.03, EAST_BREACH.z1 + 0.3], [x1, paintLine + 0.03, z1], { collide: false, cast: false });

  ibeam(b, 'x', x0, x1, 0.6, h, 0.5, 0.3);
  ibeam(b, 'x', x0, x1, 9.2, h, 0.5, 0.3);
  for (const x of [12.2, 16, 19.8]) ibeam(b, 'z', z0, z1, x, h, 0.3, 0.18);

  // ---- Machinery
  generator(b, screens, 13.6, 0.4, h, '01', atlas);
  generator(b, screens, 18.2, 0.4, h, '02', atlas);
  for (const x of [11.4, 13.4, 19.0, 21.0]) transformer(b, x, z0 + 0.62);
  // Bus bars along the north wall above the transformers.
  for (const y of [3.4, 3.6, 3.8]) b.tube('rustedSteel', [x0 + 0.4, y, z0 + 0.14], [x1 - 0.4, y, z0 + 0.14], 0.025, false);
  for (let x = x0 + 1; x < x1; x += 1.9) b.box('darkSteel', [x - 0.03, 3.3, z0], [x + 0.03, 3.9, z0 + 0.22], { collide: false, cast: false });

  // Main breaker panel on the south wall.
  const bx = 15.4;
  b.box('darkSteel', [bx - 1.7, 0, z1 - 0.5], [bx + 1.7, 2.4, z1]);
  b.box('steelPlate', [bx - 1.62, 0.2, z1 - 0.53], [bx + 1.62, 2.3, z1 - 0.5], { collide: false, cast: false });
  for (let i = 0; i < 6; i++) {
    for (const y of [1.7, 1.25]) b.box('rackSteel', [bx - 1.5 + i * 0.42, y, z1 - 0.57], [bx - 1.5 + i * 0.42 + 0.34, y + 0.34, z1 - 0.53], { collide: false, cast: false });
  }
  // The breaker itself: a hazard-striped housing with a slot down it. (The
  // lever that rides in the slot is a moving part: see world/MissionSet.ts.)
  b.box('hazard', [bx + 1.02, 0.75, z1 - 0.6], [bx + 1.5, 2.15, z1 - 0.53], { collide: false, cast: false });
  b.box('darkSteel', [bx + 1.2, 1.0, z1 - 0.64], [bx + 1.32, 1.9, z1 - 0.6], { collide: false, cast: false });
  screens.add([bx - 1.05, 0.72, z1 - 0.535], [0, 0, -1], 0.62, 0.46, 'log');
  screens.add([bx - 0.25, 0.72, z1 - 0.535], [0, 0, -1], 0.62, 0.46, 'static');
  // Feeder cables up to the ceiling, either side of the sign and behind it.
  for (const dx of [-1.48, 1.48]) b.cable('cable', [bx + dx, 2.4, z1 - 0.12], [bx + dx * 1.08, h - 0.3, z1 - 0.12], 0.1, 0.03);
  // The sign: a lit box standing proud of the wall, clear of everything.
  b.box('darkSteel', [bx - 1.26, 2.5, z1 - 0.3], [bx + 1.26, 3.0, z1 - 0.02], { collide: false });
  b.box('steelPlate', [bx - 1.3, 2.46, z1 - 0.26], [bx + 1.3, 2.5, z1 - 0.02], { collide: false, cast: false });
  b.box('steelPlate', [bx - 1.3, 3.0, z1 - 0.26], [bx + 1.3, 3.04, z1 - 0.02], { collide: false, cast: false });
  for (const dx of [-0.9, 0.9]) b.box('darkSteel', [bx + dx - 0.03, 3.04, z1 - 0.1], [bx + dx + 0.03, 3.5, z1 - 0.02], { collide: false, cast: false });

  // (The key cage that stood in the south-east corner is in the robotics
  // lab now, and the lab's door is where it was: see world/lab.)

  // ---- Pipes and clutter
  for (const [px, r, key] of [
    [10.6, 0.11, 'rustedSteel'],
    [10.95, 0.06, 'paintedMetal'],
  ] as const) {
    b.tube(key, [px, 4.35, z0], [px, 4.35, z1], r);
    for (let fz = z0 + 1.4; fz < z1; fz += 3.2) b.tube('darkSteel', [px, 4.35, fz - 0.035], [px, 4.35, fz + 0.035], r * 1.42);
  }
  for (let hz = z0 + 1.0; hz < z1; hz += 3.0) {
    b.box('darkSteel', [10.4, 4.2, hz - 0.025], [11.15, 4.235, hz + 0.025], { collide: false, cast: false });
    for (const hx of [10.43, 11.12]) b.tube('darkSteel', [hx, 4.22, hz], [hx, h, hz], 0.008, false);
  }
  const kit = 'modular_industrial_pipes_01';
  b.prop(kit, { part: 'pipe02', at: [x1 - 0.14, 2.2, -1.6], rotY: -HALF_PI, collide: false });
  b.prop(kit, { part: 'pipe03', at: [x1 - 0.14, 1.5, -0.4], rotY: -HALF_PI, collide: false });
  b.prop(kit, { part: 'pipe05', at: [x1 - 0.14, 1.1, 9.0], rotY: -HALF_PI, collide: false });
  b.blocker([x1 - 0.3, 0, -1.9], [x1, 2.2, -0.1]);
  b.prop('Barrel_01', { at: [x0 + 0.7, 0, z0 + 2.6], rotY: 0.3 });
  b.prop('barrel_03', { at: [x0 + 0.75, 0, z0 + 3.5], rotY: 1.4 });
  b.prop('Barrel_01', { at: [16.3, 0, 4.1], rotY: 2.0 });
  b.prop('barrel_03', { at: [21.6, 0.33, 8.2], rot: [HALF_PI, 0.8, 0] });
  b.prop('metal_tool_chest', { at: [x0 + 0.36, 0, 8.6], rotY: HALF_PI });
  b.prop('wooden_military_crate', { at: [11.0, 0, 12.9], rotY: 0.2, kind: 'wood' });
  b.prop('cardboard_box_01', { at: [12.2, 0, 13.2], rotY: 1.0, kind: 'soft' });
  b.prop('WetFloorSign_01', { at: [15.9, 0, 7.6], rotY: -0.4, collide: false, kind: 'soft' });
  b.prop('korean_fire_extinguisher_01', { at: [x0 + 0.2, 0, 1.6], rotY: HALF_PI });
  b.prop('utility_box_01', { at: [18.4, 0, z1 - 0.26], rotY: Math.PI });
  b.prop('power_box_01', { at: [12.6, 1.55, z1 - 0.08], rotY: Math.PI, collide: false });
  b.prop('security_camera_01', { at: [x1 - 0.3, 4.3, z0 + 0.3], rotY: -Math.PI / 4 - 0.2, collide: false });
  screens.finish();
  b.addObject(screens.object);

  // ---- The east breach and the transformer yard beyond it
  b.prop('rollershutter_door', { at: [x1 + 0.3, 2.45, (EAST_BREACH.z0 + EAST_BREACH.z1) / 2], scale: [3.1, 1.05, 1], rot: [0, HALF_PI, 0.05], collide: false });
  approach(b, { area: 'power', out: 1, wallX: x1 + t, z0: EAST_BREACH.z0, z1: EAST_BREACH.z1, top: EAST_BREACH.top, depth: EAST_BREACH.depth, name: 'breachEast' }, lights, haze, dustBeams);

  for (const entry of ENTRY_PLANS) if (entry.area === 'power' && entry.kind === 'drop') vent(b, entry.at[0], entry.at[1], h);

  // ---- Signs
  const put = (sign: Sign, centre: Vec3, normal: Vec3, width: number, options: { roll?: number; opacity?: number; emissive?: number; tint?: number } = {}) => {
    b.decal(atlas.texture, centre, normal, width, width / sign.aspect, { ...options, uvRect: sign.uv });
  };
  const N: Vec3 = [0, 0, 1];
  const S: Vec3 = [0, 0, -1];
  const E: Vec3 = [-1, 0, 0];
  const FLOOR: Vec3 = [0, 1, 0];
  put(atlas.text('SECTOR C', { size: 120, wear: 0.45 }), [16, 4.45, z0], N, 2.1, { opacity: 0.7 });
  put(atlas.text('POWER ROOM', { size: 60, wear: 0.45 }), [16, 4.0, z0], N, 2.1, { opacity: 0.7 });
  const breaker = atlas.text('MAIN BREAKER', { size: 100, color: PAINT.amber, plate: '#0d0f11', wear: 0 });
  put(breaker, [bx, 2.75, z1 - 0.302], S, 2.3, { emissive: 2.6, tint: 0xffb060 });
  put(atlas.text(['DANGER', 'HIGH VOLTAGE'], { size: 60, color: PAINT.red, box: true, plate: PAINT.white, wear: 0.4 }), [bx - 3.1, 2.0, z1], S, 1.2, { opacity: 0.9 });
  put(atlas.text('ROBOTICS LAB', { size: 70, color: PAINT.yellow, wear: 0.4 }), [(labDoor.from + labDoor.to) / 2, labDoor.top + 0.5, z1], S, 1.7, { opacity: 0.9 });
  b.decalImage('RoadLines022A', [(labDoor.from + labDoor.to) / 2, 0, z1 - 0.9], FLOOR, 2.4, 1.6, { opacity: 0.5 });
  put(atlas.text('TRANSFORMER YARD', { size: 64, color: PAINT.yellow, wear: 0.45 }), [x1, EAST_BREACH.top + 0.55, (EAST_BREACH.z0 + EAST_BREACH.z1) / 2], E, 2.4, { opacity: 0.9 });
  put(atlas.eye(300, PAINT.white, 0.5), [12.4, 3.2, z1], S, 1.4, { opacity: 0.6 });
  b.decalImage('RoadLines022A', [15.9, 0, 0.4], FLOOR, 2.0, 4.4, { opacity: 0.45 });
  b.decalImage('RoadLines022A', [x1 - 1.0, 0, (EAST_BREACH.z0 + EAST_BREACH.z1) / 2], FLOOR, 1.8, 3.6, { opacity: 0.55 });
  b.decalImage('RoadLines022A', [bx + 1.2, 0, z1 - 1.25], FLOOR, 1.6, 1.5, { opacity: 0.6 });
  const stain = (id: 'Leaking003' | 'Leaking004', centre: Vec3, normal: Vec3, w: number, hgt: number, opacity = 0.7) => b.decalImage(id, centre, normal, w, hgt, { opacity, tint: 0x5b5a52 });
  stain('Leaking003', [17.2, 3.6, z0], N, 3.2, 3.0);
  stain('Leaking004', [x1, 3.7, -2.2], E, 3.0, 2.8);
  stain('Leaking004', [11.6, 3.7, z1], S, 3.0, 2.8, 0.6);
  stain('Leaking003', [x1, 3.6, 8.6], E, 3.0, 2.8, 0.6);

  // ---- Lighting: the power is out, so the room runs on its emergency
  // lamps. Each caged lamp throws one pool of warm light straight down, and
  // it is dark between them: the breaker (where the mission starts), the
  // two aisles beside the generators, the floor between the two west
  // doors, and the front of the key cage. Amber beacons turn on the walls,
  // and the yard's cold floodlight comes in through the breach.
  //
  // The lamps hang low, on drop rods, as the lobby's do: a lamp near the
  // floor makes a small bright pool with dark round it, where the same lamp
  // up at the ceiling washes the whole room evenly. Two hang in the aisles
  // beside the generators, level with the middle of the drums, so that
  // their light falls across the machines' flanks and not just the floor.
  const beam = h - 0.3; // underside of the girders some of them hang from
  const pools: Array<{ at: [number, number]; intensity: number; angle?: number; from?: number; shadow?: number; faulty?: boolean; rotY?: number }> = [
    { at: [bx, 12.1], intensity: 200, shadow: 1 },
    { at: [16.0, 1.0], intensity: 190, angle: 1.05, from: beam, shadow: 2, rotY: HALF_PI },
    { at: [12.2, 1.2], intensity: 175, angle: 1.0, from: beam, shadow: 3, rotY: HALF_PI },
    { at: [12.2, 8.0], intensity: 160, from: beam, faulty: true, rotY: HALF_PI },
    { at: [19.8, 8.7], intensity: 160, from: beam, rotY: HALF_PI },
  ];
  const drop = 1.0;
  pools.forEach((pool, i) => {
    const [sx, sz] = pool.at;
    const top = h - drop;
    const lampY = top - 0.68;
    const name = `powerLamp${i}`;
    const fixture = b.prop('caged_hanging_light', { at: [sx, top, sz], rotY: pool.rotY ?? 0, collide: false, unique: true });
    // The rod it hangs from, and the plate its wires are tied to.
    b.tube('darkSteel', [sx, top, sz], [sx, pool.from ?? h, sz], 0.022, false);
    b.tube('darkSteel', [sx, top - 0.012, sz], [sx, top + 0.012, sz], 0.34, false);
    lights.push({
      name,
      area: 'power',
      kind: 'spot',
      color: LAMP,
      intensity: pool.intensity,
      position: [sx, lampY, sz],
      target: [sx, 0, sz],
      angle: pool.angle ?? 0.9,
      penumbra: 0.85,
      distance: 10,
      shadow: pool.shadow,
      flicker: pool.faulty ? 'faulty' : undefined,
      glow: { materials: fixture.filter((m) => m.emissiveMap || /glass|light$/i.test(m.name)), color: 0xffd9a8, intensity: 5.5 },
    });
    haze.push({ effect: createConeShaft([sx, lampY - 0.05, sz], [sx, 0.1, sz], 0.22, 2.5, LAMP, 0.11), follows: pool.faulty ? name : undefined });
    dustBeams.push({ position: [sx, lampY, sz], target: [sx, 0, sz], angle: 0.72, color: LAMP, strength: 0.45 });
  });
  // A task lamp over each generator's control panel (the fitting is built
  // with the generator), so the face of the machine is lit as well.
  for (const gx of [13.6, 18.2]) lights.push({ name: `genPanel${gx}`, area: 'power', kind: 'point', color: 0xffd8a8, intensity: 9, position: [gx, 1.86, 2.4 + 0.74], distance: 4.6 });
  const beacons: Array<[Vec3, number]> = [
    [[x0 + SKIN + 0.002, 3.2, 6.2], HALF_PI],
    [[16.8, 3.3, z0 + 0.002], 0],
    [[x1 - 0.002, 3.3, 10.4], -HALF_PI],
  ];
  beacons.forEach(([at, rotY], i) => {
    const fixture = b.prop('industrial_wall_lamp', { at, rotY, collide: false, cast: false, unique: true });
    const out: Vec3 = [at[0] + Math.sin(rotY) * 0.35, at[1], at[2] + Math.cos(rotY) * 0.35];
    lights.push({ name: `powerBeacon${i}`, area: 'power', kind: 'point', color: AMBER, intensity: 9, position: out, distance: 8, flicker: i === 1 ? 'pulse' : 'beacon', glow: { materials: fixture, color: AMBER, intensity: 9 } });
  });
  // Small lamps over the two doors on the west side.
  lights.push({ name: 'powerLobbyDoor', area: 'power', kind: 'point', color: SODIUM, intensity: 4, position: [x0 + 0.7, 2.75, 3.6], distance: 4.5 });
  lights.push({ name: 'powerServiceDoor', area: 'power', kind: 'point', color: SODIUM, intensity: 4, position: [x0 + 0.7, 2.8, (service.from + service.to) / 2], distance: 4.5 });
  // The breaker's lamp: red and pulsing while the power is out, steady green once it is back.
  lights.push({ name: 'breakerLamp', area: 'power', kind: 'point', color: RED, intensity: 6, position: [bx + 1.26, 2.2, z1 - 1.0], distance: 5, flicker: 'pulse', when: 'powerOut' });
  lights.push({ name: 'breakerLampOn', area: 'power', kind: 'point', color: 0x8dffa8, intensity: 1.8, position: [bx + 1.26, 2.3, z1 - 1.1], distance: 4, when: 'powerOn' });
  // Over the lab's door, in the lab's own colder colour.
  lights.push({ name: 'powerLabDoor', area: 'power', kind: 'point', color: 0xc8fff0, intensity: 5, position: [(labDoor.from + labDoor.to) / 2, 2.9, z1 - 0.7], distance: 5 });
  // With the power back, the room's own lighting comes up over the
  // machines: cooler than the emergency lamps, and not much of it.
  lights.push({ name: 'powerMainsNorth', area: 'power', kind: 'point', color: 0xdfe8ff, intensity: 22, position: [15.9, h - 0.9, -0.8], distance: 11, when: 'powerOn' });
  lights.push({ name: 'powerMainsSouth', area: 'power', kind: 'point', color: 0xdfe8ff, intensity: 16, position: [16.4, h - 0.9, 8.6], distance: 11, when: 'powerOn' });
  // Bounce: what the pools throw back up off the floor. Kept low, so the
  // dark between the pools stays dark without going to solid black.
  lights.push({ name: 'powerBounce', area: 'power', kind: 'point', color: 0xffc890, intensity: 6.5, position: [16, 2.4, 8.6], distance: 13 });
  lights.push({ name: 'powerBounceN', area: 'power', kind: 'point', color: 0xffc890, intensity: 5.5, position: [16, 2.6, 0.6], distance: 12 });

  const built = b.build();
  return { id: 'power', ...built, lights, haze, dustBeams, tick: (time) => screens.update(time) };
}
