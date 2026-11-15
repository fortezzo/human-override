// The power room: two dead generators, a bank of transformers, the main
// breaker panel and a locked key cage, lit only by emergency lamps because
// the power is out. The east wall is breached to the transformer yard.

import type { Assets } from '../../core/assets';
import type { DustBeam } from '../../render/atmosphere';
import type { LightDef } from '../../render/lighting';
import type { MaterialLibrary } from '../../render/materials';
import { LevelBuilder } from '../build/LevelBuilder';
import { approach, drum, ibeam, portal, vent, wall, type AreaBuild, type Haze } from '../build/room';
import { PAINT, SignAtlas, type Sign } from '../build/SignAtlas';
import { ScreenBank } from '../lobby/ScreenBank';
import { DOOR_PLANS, EAST_BREACH, ENTRY_PLANS, HALL, LOBBY, POWER, WALL } from '../plan';

type Vec3 = [number, number, number];

const AMBER = 0xff9a2e;
const RED = 0xff2a12;
const SODIUM = 0xffb463;
const HALF_PI = Math.PI / 2;

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

  // ---- Structure
  b.box('floor', [x0, -0.4, z0 - t], [x1 + t, 0, z1 + t], { collide: false, cast: false });
  b.box('ceilingDeck', [x0 - t, h, z0 - t], [x1 + t, h + 0.25, z1 + t], { collide: false, cast: false });
  const walls = { height: h, lower: 'wallPaint', upper: 'wallPower', paintLine } as const;
  wall(b, { ...walls, along: 'x', near: z0 - t, far: z0, from: x0, to: x1 + t });
  wall(b, { ...walls, along: 'x', near: z1, far: z1 + t, from: x0, to: x1 + t });
  wall(b, { ...walls, along: 'z', near: x1, far: x1 + t, from: z0, to: z1, openings: [{ from: EAST_BREACH.z0, to: EAST_BREACH.z1, top: EAST_BREACH.top }] });
  // West: the lobby's and the server hall's walls already stand here; fill in above the lobby's.
  b.box('wallPower', [x0 - t, LOBBY.height, z0 - t], [x0, h, LOBBY.z1 + t], { collide: false, cast: false });
  b.box('wallPower', [x0 - t, 0, z0 - t], [x0, h, z0], { cast: false });
  b.box('wallPower', [x0 - t, 0, HALL.z1 + t], [x0, h, z1 + t], { cast: false });
  portal(b, 'z', x0 - t, x0, service);
  // Rail capping the painted band.
  b.box('darkSteel', [x0, paintLine - 0.03, z0], [x1, paintLine + 0.03, z0 + 0.03], { collide: false, cast: false });
  b.box('darkSteel', [x0, paintLine - 0.03, z1 - 0.03], [x1, paintLine + 0.03, z1], { collide: false, cast: false });
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
  // The breaker itself: a red lever in a hazard-striped housing.
  b.box('hazard', [bx + 1.02, 0.75, z1 - 0.6], [bx + 1.5, 2.15, z1 - 0.53], { collide: false, cast: false });
  b.box('darkSteel', [bx + 1.2, 1.0, z1 - 0.64], [bx + 1.32, 1.9, z1 - 0.6], { collide: false, cast: false });
  b.tube('rustedSteel', [bx + 1.26, 1.2, z1 - 0.6], [bx + 1.26, 1.2, z1 - 0.84], 0.028, false);
  b.tube('hazard', [bx + 1.14, 1.2, z1 - 0.84], [bx + 1.38, 1.2, z1 - 0.84], 0.035, false);
  screens.add([bx - 1.05, 0.72, z1 - 0.535], [0, 0, -1], 0.62, 0.46, 'log');
  screens.add([bx - 0.25, 0.72, z1 - 0.535], [0, 0, -1], 0.62, 0.46, 'static');
  for (const dx of [-0.8, 0.9]) b.cable('cable', [bx + dx, 2.4, z1 - 0.2], [bx + dx * 1.3, h - 0.3, z1 - 0.25], 0.15, 0.03);

  // The key cage in the south-east corner: steel bars, a locked gate, a pedestal inside.
  const cx0 = 19.3;
  const cz0 = 10.7;
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
  bars('x', cx0, x1, cz0);
  bars('z', cz0, z1, cx0);
  for (const [px, pz] of [
    [cx0, cz0],
    [x1 - 0.05, cz0],
    [cx0, z1 - 0.05],
    [cx0, 12.0],
    [cx0, 13.0],
  ] as const) {
    b.box('rustedSteel', [px - 0.04, 0, pz - 0.04], [px + 0.04, 2.7, pz + 0.04], { collide: false });
  }
  b.box('hazard', [cx0 - 0.03, 0.95, 12.3], [cx0 + 0.03, 1.25, 12.7], { collide: false, cast: false });
  b.blocker([cx0 - 0.05, 0, cz0 - 0.05], [x1, 2.7, cz0 + 0.05]);
  b.blocker([cx0 - 0.05, 0, cz0], [cx0 + 0.05, 2.7, z1]);
  b.box('steelPlate', [20.7, 0, 12.2], [21.3, 0.95, 12.8], { collide: false });
  b.box('darkSteel', [20.62, 0.95, 12.12], [21.38, 1.0, 12.88], { collide: false });
  b.prop('ammo_box', { at: [21.0, 1.0, 12.5], rotY: 0.6, collide: false });
  b.prop('steel_frame_shelves_03', { at: [21.1, 0, z1 - 0.4], rotY: Math.PI, collide: false });

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
  put(breaker, [bx, 2.75, z1 - 0.002], S, 2.2, { emissive: 2.4, tint: 0xffb060 });
  put(atlas.text(['DANGER', 'HIGH VOLTAGE'], { size: 60, color: PAINT.red, box: true, plate: PAINT.white, wear: 0.4 }), [bx - 3.1, 2.0, z1], S, 1.2, { opacity: 0.9 });
  put(atlas.text(['KEY STORAGE', 'AUTHORISED STAFF ONLY'], { size: 46, box: true, wear: 0.45 }), [x1, 3.1, 12.4], E, 1.7, { opacity: 0.75 });
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

  // ---- Lighting: the power is out. Amber beacons, one dying strip, red at the breaker.
  const stripAt: Array<[number, number, boolean]> = [
    [13.6, 4.4, false],
    [18.6, 7.4, true],
    [13.2, -1.6, false],
    [16.6, 11.6, false],
  ];
  stripAt.forEach(([sx, sz, faulty], i) => {
    const fixture = b.prop('caged_hanging_light', { at: [sx, h, sz], rotY: i === 1 ? HALF_PI : 0, collide: false, unique: true });
    lights.push({
      name: `powerStrip${i}`,
      area: 'power',
      kind: 'point',
      color: SODIUM,
      intensity: i === 2 ? 12 : i === 3 ? 16 : 20,
      position: [sx, h - 0.68, sz],
      distance: 11,
      flicker: faulty ? 'faulty' : undefined,
      glow: { materials: fixture.filter((m) => m.emissiveMap || /glass|light$/i.test(m.name)), color: 0xffd9a8, intensity: 4.5 },
    });
  });
  const beacons: Array<[Vec3, number]> = [
    [[x0 + 0.002, 3.2, 6.2], HALF_PI],
    [[16.8, 3.3, z0 + 0.002], 0],
    [[x1 - 0.002, 3.3, 10.4], -HALF_PI],
  ];
  beacons.forEach(([at, rotY], i) => {
    const fixture = b.prop('industrial_wall_lamp', { at, rotY, collide: false, cast: false, unique: true });
    const out: Vec3 = [at[0] + Math.sin(rotY) * 0.35, at[1], at[2] + Math.cos(rotY) * 0.35];
    lights.push({ name: `powerBeacon${i}`, area: 'power', kind: 'point', color: AMBER, intensity: 12, position: out, distance: 9, flicker: i === 1 ? 'pulse' : 'beacon', glow: { materials: fixture, color: AMBER, intensity: 9 } });
  });
  // Small lamps over the two doors on the west side.
  lights.push({ name: 'powerLobbyDoor', area: 'power', kind: 'point', color: SODIUM, intensity: 4, position: [x0 + 0.7, 2.75, 3.6], distance: 4.5 });
  lights.push({ name: 'powerServiceDoor', area: 'power', kind: 'point', color: SODIUM, intensity: 4, position: [x0 + 0.7, 2.8, (service.from + service.to) / 2], distance: 4.5 });
  lights.push({ name: 'breakerLamp', area: 'power', kind: 'point', color: RED, intensity: 5, position: [bx + 1.26, 2.5, z1 - 1.0], distance: 5.5, flicker: 'pulse' });
  lights.push({ name: 'cageLamp', area: 'power', kind: 'point', color: AMBER, intensity: 3.5, position: [21.0, 1.9, 12.5], distance: 4.5 });
  lights.push({ name: 'powerBounce', area: 'power', kind: 'point', color: 0xffc890, intensity: 15, position: [16, 2.4, 8.4], distance: 13 });
  lights.push({ name: 'powerBounceN', area: 'power', kind: 'point', color: 0xffc890, intensity: 12, position: [16, 2.6, 0.2], distance: 12 });
  dustBeams.push({ position: [13.6, h - 0.68, 4.4], target: [13.6, 0, 4.4], angle: 0.8, color: SODIUM, strength: 0.4 });

  const built = b.build();
  return { id: 'power', ...built, lights, haze, dustBeams, tick: (time) => screens.update(time) };
}
