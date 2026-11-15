// The server hall: rows of server racks either side of a central aisle,
// under cold light, with the loading dock on the west side, the service
// door to the power room on the east, and the sealed core door at the far
// end. ARGUS lives in these machines: most racks blink a calm green and
// blue, and clusters of red mark the ones it has taken.

import type { Assets } from '../../core/assets';
import { createConeShaft, type DustBeam } from '../../render/atmosphere';
import type { LightDef } from '../../render/lighting';
import type { MaterialLibrary } from '../../render/materials';
import { LedBank } from '../build/LedBank';
import { LevelBuilder } from '../build/LevelBuilder';
import { approach, column, ibeam, portal, vent, wall, weaponRack, type AreaBuild, type Haze } from '../build/room';
import { PAINT, SignAtlas, type Sign } from '../build/SignAtlas';
import { ScreenBank } from '../lobby/ScreenBank';
import { DOCK, DOOR_PLANS, ENTRY_PLANS, HALL, HALL_COLUMNS, LOBBY, RACK_PLANS, WALL } from '../plan';

type Vec3 = [number, number, number];

const COLD = 0xcfe0ff;
const RED = 0xff2a12;
const AMBER = 0xff9a2e;
const HALF_PI = Math.PI / 2;

/** Size of one server rack: width along the row, depth across it, height. */
const RACK = { width: 0.62, depth: 1.0, height: 2.15 };

/** Rows of racks: [first rack's west edge, row centre z, number of racks, label]. */
const ROWS: Array<[number, number, number, string]> = [
  [-10.2, 9.7, 9, 'A'],
  [-10.2, 13.1, 9, 'B'],
  [-7.72, 16.5, 5, 'C'],
  [-10.2, 19.9, 9, 'D'],
  [-10.2, 23.3, 9, 'E'],
  [2.62, 9.5, 7, 'F'],
  [2.62, 13.9, 9, 'G'],
  [2.62, 17.3, 9, 'H'],
  [2.62, 20.7, 9, 'J'],
];

export function buildHall(assets: Assets, materials: MaterialLibrary): AreaBuild {
  const b = new LevelBuilder(assets, materials);
  const atlas = new SignAtlas(2048, 2048);
  const leds = new LedBank();
  const screens = new ScreenBank();
  const lights: LightDef[] = [];
  const haze: Haze[] = [];
  const dustBeams: DustBeam[] = [];
  const { x0, x1, z0, z1, height: h, paintLine } = HALL;
  const t = WALL;
  const door = (id: string) => DOOR_PLANS.find((d) => d.id === id)!;
  const servicePlan = door('hallPower');
  const corePlan = door('hallCore');

  // ---- Structure
  b.box('floor', [x0 - t, -0.4, z0], [x1 + t, 0, z1 + t], { collide: false, cast: false });
  b.box('ceilingDeck', [x0 - t, h, z0 - t], [x1 + t, h + 0.25, z1 + t], { collide: false, cast: false });
  const walls = { height: h, lower: 'steelPlate', upper: 'wallHall', paintLine } as const;
  // North: the lobby's own wall covers most of it; fill in beside and above it.
  wall(b, { ...walls, along: 'x', near: z0 - t, far: z0, from: x0 - t, to: LOBBY.x0 - t });
  b.box('wallHall', [LOBBY.x0 - t, LOBBY.height, z0 - t], [LOBBY.x1 + t, h, z0], { collide: false, cast: false });
  // Steel cladding over the lobby wall's lower band on this side.
  b.box('steelPlate', [LOBBY.x0 - t, 0, z0], [-2.2, paintLine, z0 + 0.03], { collide: false, cast: false });
  b.box('steelPlate', [2.2, 0, z0], [x1, paintLine, z0 + 0.03], { collide: false, cast: false });
  wall(b, { ...walls, along: 'z', near: x0 - t, far: x0, from: z0 - t, to: z1 + t, openings: [{ from: DOCK.z0, to: DOCK.z1, top: DOCK.top }] });
  wall(b, { ...walls, along: 'z', near: x1, far: x1 + t, from: z0, to: z1 + t, openings: [{ from: servicePlan.from, to: servicePlan.to, top: servicePlan.top }] });
  wall(b, { ...walls, along: 'x', near: z1, far: z1 + t, from: x0, to: x1, openings: [{ from: corePlan.from, to: corePlan.to, top: corePlan.top }] });
  // A steel rail caps the cladding.
  for (const [min, max] of [
    [[x0, paintLine - 0.03, z0 + 0.03], [x1, paintLine + 0.03, z0 + 0.06]],
    [[x0, paintLine - 0.03, z1 - 0.03], [x1, paintLine + 0.03, z1]],
    [[x0, paintLine - 0.03, z0], [x0 + 0.03, paintLine + 0.03, z1]],
    [[x1 - 0.03, paintLine - 0.03, z0], [x1, paintLine + 0.03, z1]],
  ] as Array<[Vec3, Vec3]>) {
    b.box('darkSteel', min, max, { collide: false, cast: false });
  }

  for (const [cx, cz] of HALL_COLUMNS) column(b, cx, cz, h);
  ibeam(b, 'z', z0, z1, -3.6, h, 0.55, 0.32);
  ibeam(b, 'z', z0, z1, 1.6, h, 0.55, 0.32);
  for (const z of [9.6, 13.2, 16.8, 20.4, 24.0]) ibeam(b, 'x', x0, x1, z, h, 0.3, 0.18);

  portal(b, 'z', x1, x1 + t, servicePlan);
  portal(b, 'x', z1, z1 + t, corePlan, 'steelPlate');
  // The lobby's blast door frame, continued on this side of the wall.
  b.box('hazard', [-2.14, 0, z0 + 0.08], [-1.74, 2.1, z0 + 0.095], { collide: false, cast: false });
  b.box('hazard', [1.74, 0, z0 + 0.08], [2.14, 2.1, z0 + 0.095], { collide: false, cast: false });

  // ---- Server racks
  const put = (sign: Sign, centre: Vec3, normal: Vec3, width: number, options: { roll?: number; opacity?: number; emissive?: number; tint?: number } = {}) => {
    b.decal(atlas.texture, centre, normal, width, width / sign.aspect, { ...options, uvRect: sign.uv });
  };
  for (const [startX, z, count, label] of ROWS) {
    const { width, depth, height } = RACK;
    const endX = startX + count * width;
    for (let i = 0; i < count; i++) {
      const rx = startX + i * width;
      b.box('rackSteel', [rx + 0.012, 0, z - depth / 2], [rx + width - 0.012, height, z + depth / 2], { collide: false });
      // Door frames stand a little proud of the light panels.
      for (const side of [-1, 1]) {
        const face = z + side * (depth / 2);
        const a = Math.min(face, face + side * 0.02);
        const c = Math.max(face, face + side * 0.02);
        b.box('darkSteel', [rx + 0.012, height - 0.1, a], [rx + width - 0.012, height, c], { collide: false, cast: false });
        b.box('darkSteel', [rx + 0.012, 0, a], [rx + width - 0.012, 0.12, c], { collide: false, cast: false });
        leds.add([rx + width / 2, 1.07, face + side * 0.006], [0, 0, side], width - 0.09, 1.86);
      }
    }
    // One solid box for the whole row, and steel end caps with the row's letter.
    b.blocker([startX, 0, z - depth / 2], [endX, height, z + depth / 2]);
    b.box('steelPlate', [startX - 0.03, 0, z - depth / 2 - 0.02], [startX + 0.012, height + 0.03, z + depth / 2 + 0.02], { collide: false });
    b.box('steelPlate', [endX - 0.012, 0, z - depth / 2 - 0.02], [endX + 0.03, height + 0.03, z + depth / 2 + 0.02], { collide: false });
    const letter = atlas.text(`ROW ${label}`, { size: 80, color: PAINT.white, wear: 0.3 });
    const aisleEnd = startX < 0 ? endX + 0.03 : startX - 0.03;
    put(letter, [aisleEnd, 1.55, z], [startX < 0 ? 1 : -1, 0, 0], 0.62, { opacity: 0.85 });

    // A cable tray over the row, with drops up to the ceiling at both ends.
    const ty = height + 0.32;
    b.box('darkSteel', [startX, ty, z - 0.16], [endX, ty + 0.012, z + 0.16], { collide: false });
    for (const [dz, radius] of [
      [-0.09, 0.022],
      [-0.02, 0.03],
      [0.06, 0.02],
      [0.11, 0.016],
    ] as const) {
      b.tube('cable', [startX, ty + 0.014 + radius, z + dz], [endX, ty + 0.014 + radius, z + dz], radius, false);
    }
    for (const hx of [startX + 0.3, endX - 0.3]) {
      b.tube('darkSteel', [hx, ty, z - 0.17], [hx, h, z - 0.17], 0.008, false);
      b.tube('darkSteel', [hx, ty, z + 0.17], [hx, h, z + 0.17], 0.008, false);
      b.cable('cable', [hx, height, z], [hx + 0.05, ty + 0.03, z + 0.02], 0.02, 0.02);
    }
  }
  leds.finish();
  b.addObject(leds.object);

  // ---- Services overhead
  for (let z = z0 + 0.3; z + 1.2 <= z1 - 0.2; z += 1.2) {
    b.prop('modular_airduct_rectangular_01', { part: 'double_01', at: [-7.4, h - 0.75, z], collide: false });
  }
  for (const gz of [11.4, 18.2, 24.6]) {
    b.prop('modular_airduct_rectangular_01', { part: 'vent_01', at: [-7.4 + 0.31, h - 0.75, gz], rotY: HALF_PI, collide: false, cast: false });
  }
  b.tube('rustedSteel', [6.6, h - 0.5, z0], [6.6, h - 0.5, z1], 0.09);
  b.tube('paintedMetal', [6.95, h - 0.52, z0], [6.95, h - 0.52, z1], 0.05);
  for (let hz = z0 + 1.2; hz < z1; hz += 3.2) {
    b.box('darkSteel', [6.4, h - 0.64, hz - 0.025], [7.15, h - 0.61, hz + 0.025], { collide: false, cast: false });
    for (const hx of [6.43, 7.12]) b.tube('darkSteel', [hx, h - 0.62, hz], [hx, h, hz], 0.008, false);
  }

  // ---- The uplink station, in the open corner by the core door
  const ux = 5.6;
  const uz = z1 - 0.55;
  b.box('steelPlate', [ux - 1.5, 0, uz - 0.35], [ux + 1.5, 0.95, uz + 0.35]);
  b.box('darkSteel', [ux - 1.56, 0.95, uz - 0.42], [ux + 1.56, 1.0, uz + 0.4], { collide: false });
  b.box('rackSteel', [ux - 1.3, 1.0, uz + 0.05], [ux + 1.3, 2.3, uz + 0.4], { collide: false });
  const feeds = ['eye', 'log', 'lockdown'] as const;
  feeds.forEach((feed, i) => screens.add([ux - 0.86 + i * 0.86, 1.68, uz + 0.04], [0, 0, -1], 0.74, 0.55, feed));
  b.tube('rustedSteel', [ux + 1.9, 0, uz + 0.1], [ux + 1.9, 4.4, uz + 0.1], 0.05);
  b.box('darkSteel', [ux + 1.6, 4.2, uz - 0.1], [ux + 2.2, 4.3, uz + 0.3], { collide: false });
  b.cable('cable', [ux + 1.9, 4.2, uz + 0.1], [ux + 1.2, 2.3, uz + 0.2], 0.4, 0.02);
  b.prop('utility_box_01', { at: [ux - 2.4, 0, uz + 0.16], rotY: Math.PI });
  b.prop('metal_stool_02', { at: [ux - 0.3, 0, uz - 1.0], rotY: 0.4 });
  b.prop('wooden_military_crate', { at: [2.9, 0, 24.6], rotY: 0.2, kind: 'wood' });
  b.prop('ammo_box', { at: [2.8, 0.46, 24.55], rotY: 1.1, collide: false });
  screens.finish();
  b.addObject(screens.object);

  // ---- Clutter along the walls
  b.prop('utility_box_02', { at: [-6.2, 0, z0 + 0.26], rotY: 0 });
  b.prop('utility_box_02', { at: [4.6, 0, z0 + 0.26], rotY: 0 });
  b.prop('power_box_01', { at: [6.2, 1.55, z0 + 0.08], rotY: 0, collide: false });
  b.prop('korean_fire_extinguisher_01', { at: [-2.6, 0, z0 + 0.22], rotY: 0 });
  b.prop('industrial_storage_cart', { at: [-9.6, 0, 16.2], rotY: 1.2 });
  b.prop('cardboard_box_01', { at: [-9.9, 0, 18.4], rotY: 0.5, kind: 'soft' });
  b.prop('Barrel_01', { at: [-10.3, 0, 14.3], rotY: 0.8 });
  b.prop('hand_truck', { at: [8.5, 0, 14.6], rotY: -HALF_PI });
  b.prop('security_camera_01', { at: [x1 - 0.3, 4.6, z0 + 0.3], rotY: -Math.PI / 4, collide: false });
  b.prop('security_camera_01', { at: [x0 + 0.3, 4.6, z1 - 0.3], rotY: (Math.PI * 3) / 4, collide: false });

  // ---- Loading dock: the opening, its jammed shutter, and the yard outside
  b.prop('rollershutter_door', { at: [x0 - 0.3, 2.3, (DOCK.z0 + DOCK.z1) / 2], scale: [2.75, 1.05, 1], rot: [0, HALF_PI, -0.04], collide: false });
  approach(b, { area: 'hall', out: -1, wallX: x0 - t, z0: DOCK.z0, z1: DOCK.z1, top: DOCK.top, depth: DOCK.depth, name: 'dock' }, lights, haze, dustBeams);

  // ---- Ceiling vent the robots drop from
  for (const entry of ENTRY_PLANS) if (entry.area === 'hall' && entry.kind === 'drop') vent(b, entry.at[0], entry.at[1], h);

  // ---- The carbine's rack
  for (const rack of RACK_PLANS) if (rack.area === 'hall') weaponRack(b, atlas, assets, rack, lights);

  // ---- Signs
  const N: Vec3 = [0, 0, 1];
  const S: Vec3 = [0, 0, -1];
  const E: Vec3 = [-1, 0, 0];
  const W: Vec3 = [1, 0, 0];
  const FLOOR: Vec3 = [0, 1, 0];
  put(atlas.text('SECTOR B', { size: 120, wear: 0.45 }), [5.6, 3.5, z0], N, 2.1, { opacity: 0.7 });
  put(atlas.text('SERVER HALL', { size: 60, wear: 0.45 }), [5.6, 3.02, z0], N, 2.1, { opacity: 0.7 });
  put(atlas.eye(300, PAINT.white, 0.45), [-6.3, 3.3, z0], N, 1.3, { opacity: 0.7 });
  put(atlas.text(['ANTI-STATIC ZONE', 'NO OPEN FLAME'], { size: 50, box: true, wear: 0.45 }), [-6.3, 2.2, z0], N, 1.8, { opacity: 0.75 });
  put(atlas.text('LOADING DOCK', { size: 70, color: PAINT.yellow, wear: 0.45 }), [x0, DOCK.top + 0.55, (DOCK.z0 + DOCK.z1) / 2], W, 1.9, { opacity: 0.9 });
  put(atlas.text('POWER ROOM', { size: 70, color: PAINT.yellow, wear: 0.4 }), [x1, servicePlan.top + 0.5, (servicePlan.from + servicePlan.to) / 2], E, 1.6, { opacity: 0.9 });
  const coreMid = (corePlan.from + corePlan.to) / 2;
  const coreSign = atlas.text('CORE', { size: 130, color: PAINT.amber, plate: '#0d0f11', wear: 0 });
  put(coreSign, [coreMid, corePlan.top + 0.62, z1 - 0.09], S, 1.5, { emissive: 2.6, tint: 0xff5a3a });
  put(atlas.text(['SEALED', 'THREE OVERRIDE KEYS REQUIRED'], { size: 54, color: PAINT.red, box: true, plate: PAINT.white, wear: 0.3 }), [coreMid + 3.5, 2.1, z1], S, 2.3, { opacity: 0.9 });
  put(atlas.eye(300, PAINT.white, 0.35), [coreMid - 3.4, 2.4, z1], S, 1.5, { opacity: 0.75 });
  put(atlas.text('UPLINK', { size: 110, wear: 0.4 }), [5.6, 3.2, z1], S, 1.9, { opacity: 0.75 });
  // Guide line down the aisle, and a hazard zone before the core door.
  const guide = atlas.line(900, 36, PAINT.yellow, 0.75);
  for (const [za, zb] of [
    [8.4, 12.6],
    [13.0, 17.8],
    [18.2, 23.6],
  ] as const) {
    put(guide, [-1, 0, (za + zb) / 2], FLOOR, zb - za, { roll: HALF_PI, opacity: 0.7 });
  }
  b.decalImage('RoadLines022A', [coreMid, 0, z1 - 1.0], FLOOR, 4.6, 1.7, { opacity: 0.6 });
  b.decalImage('RoadLines022A', [x0 + 1.0, 0, (DOCK.z0 + DOCK.z1) / 2], FLOOR, 1.8, 3.2, { opacity: 0.5 });
  put(atlas.arrow('down', PAINT.yellow, 200, 0.6), [-1, 0, 21.8], FLOOR, 0.9, { opacity: 0.7 });
  // Stains.
  const stain = (id: 'Leaking003' | 'Leaking004', centre: Vec3, normal: Vec3, w: number, hgt: number, opacity = 0.7) => b.decalImage(id, centre, normal, w, hgt, { opacity, tint: 0x5b5a52 });
  stain('Leaking003', [-8.3, 3.9, z0], N, 3.2, 3.2);
  stain('Leaking004', [x0, 3.9, 11.2], W, 3.0, 3.0);
  stain('Leaking003', [x0, 4.0, 22.4], W, 3.2, 3.0, 0.6);
  stain('Leaking004', [x1, 4.0, 18.8], E, 3.2, 3.0);
  stain('Leaking004', [6.9, 4.0, z1], S, 3.0, 2.8, 0.6);

  // ---- Lighting: cold pools down the aisle, the racks' own glow, red at the core door
  const lampY = h - 0.3 - 1.25;
  [9.8, 14.4, 19.0, 23.6].forEach((z, i) => {
    const name = `hallPendant${i}`;
    const fixture = b.prop('hanging_industrial_lamp', { at: [-1, h - 0.3, z], rotY: i * 1.1, collide: false, unique: true });
    const faulty = i === 1;
    lights.push({
      name,
      area: 'hall',
      kind: 'spot',
      color: COLD,
      intensity: 170,
      position: [-1, lampY, z],
      target: [-1, 0, z],
      angle: 0.9,
      penumbra: 0.85,
      distance: 11,
      shadow: i === 2 ? 2 : i === 0 ? 3 : undefined,
      flicker: faulty ? 'faulty' : undefined,
      glow: { materials: fixture.filter((m) => m.emissiveMap || /glass|light$/i.test(m.name)), color: 0xdce8ff, intensity: 5.5 },
    });
    haze.push({ effect: createConeShaft([-1, lampY - 0.05, z], [-1, 0.1, z], 0.22, 2.6, COLD, 0.1), follows: faulty ? name : undefined });
    dustBeams.push({ position: [-1, lampY, z], target: [-1, 0, z], angle: 0.72, color: COLD, strength: 0.5 });
  });
  // Soft bounce off the aisle floor, and the glow of the machines in each block.
  lights.push({ name: 'hallBounceN', area: 'hall', kind: 'point', color: 0xd4e2ff, intensity: 15, position: [-1, 2.3, 12.5], distance: 14 });
  lights.push({ name: 'hallBounceS', area: 'hall', kind: 'point', color: 0xd4e2ff, intensity: 15, position: [-1, 2.3, 21], distance: 14 });
  // Caged strip lights over the rack blocks: cold, and one of them failing.
  const strips: Array<[number, number, boolean]> = [
    [-7.0, 11.4, false],
    [-7.0, 21.6, true],
    [5.3, 11.7, false],
    [5.3, 19.0, false],
  ];
  strips.forEach(([sx, sz, faulty], i) => {
    const fixture = b.prop('caged_hanging_light', { at: [sx, h, sz], rotY: 0, collide: false, unique: true });
    lights.push({
      name: `hallStrip${i}`,
      area: 'hall',
      kind: 'point',
      color: 0xd6e4ff,
      intensity: 20,
      position: [sx, h - 0.68, sz],
      distance: 11,
      flicker: faulty ? 'faulty' : undefined,
      glow: { materials: fixture.filter((m) => m.emissiveMap || /glass|light$/i.test(m.name)), color: 0xdce8ff, intensity: 5 },
    });
  });
  // By the loading dock, so its frame and sign can be read from inside.
  lights.push({ name: 'hallDockSide', area: 'hall', kind: 'point', color: 0xd6e4ff, intensity: 8, position: [-9.2, 2.7, 16.5], distance: 8 });
  lights.push({ name: 'hallRacksSW', area: 'hall', kind: 'point', color: 0xff5a3a, intensity: 3, position: [-7.4, 1.3, 21.6], distance: 7 });
  lights.push({ name: 'hallServiceDoor', area: 'hall', kind: 'point', color: 0xffe2b8, intensity: 4, position: [x1 - 0.7, 2.8, (servicePlan.from + servicePlan.to) / 2], distance: 4.5 });
  // The uplink corner: warm light from the console, cold from above.
  lights.push({ name: 'hallUplink', area: 'hall', kind: 'point', color: AMBER, intensity: 4.5, position: [ux, 1.9, uz - 1.0], distance: 6 });
  // Red lamps either side of the core door and of the dock.
  for (const side of [-1, 1]) {
    const at: Vec3 = [coreMid + side * 2.55, 2.9, z1 - 0.002];
    const fixture = b.prop('industrial_wall_lamp', { at, rotY: Math.PI, collide: false, cast: false, unique: true });
    lights.push({ name: `coreLamp${side}`, area: 'hall', kind: 'point', color: RED, intensity: 7, position: [at[0], at[1], at[2] - 0.35], distance: 6, flicker: 'pulse', glow: { materials: fixture, color: RED, intensity: 9 } });
  }
  const dockLamp: Vec3 = [x0 + 0.002, 3.5, DOCK.z1 + 0.8];
  const dockFixture = b.prop('industrial_wall_lamp', { at: dockLamp, rotY: HALF_PI, collide: false, cast: false, unique: true });
  lights.push({ name: 'dockLamp', area: 'hall', kind: 'point', color: RED, intensity: 6, position: [dockLamp[0] + 0.35, dockLamp[1], dockLamp[2]], distance: 6, flicker: 'beacon', glow: { materials: dockFixture, color: RED, intensity: 9 } });

  const built = b.build();
  return {
    id: 'hall',
    ...built,
    lights,
    haze,
    dustBeams,
    tick: (time) => {
      leds.update(time);
      screens.update(time);
    },
  };
}
