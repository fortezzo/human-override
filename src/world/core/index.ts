// The core: a tall steel chamber with the kill switch on a round dais under
// a single shaft of cold light, watched by ARGUS's eye, a ring of machinery
// on the far wall with a burning red iris. Sealed until the mission opens it.

import * as THREE from 'three';
import type { Assets } from '../../core/assets';
import { createConeShaft, type DustBeam } from '../../render/atmosphere';
import { addsLightOnly } from '../../render/glow';
import type { LightDef } from '../../render/lighting';
import type { MaterialLibrary } from '../../render/materials';
import { LedBank } from '../build/LedBank';
import { LevelBuilder } from '../build/LevelBuilder';
import { drum, vent, wall, type AreaBuild, type Haze } from '../build/room';
import { PAINT, SignAtlas, type Sign } from '../build/SignAtlas';
import { ScreenBank } from '../lobby/ScreenBank';
import { CORE, DOOR_PLANS, ENTRY_PLANS, HALL, WALL } from '../plan';

type Vec3 = [number, number, number];

const RED = 0xff2a12;
const COLD = 0xcfe0ff;

/** ARGUS's eye: a broken outer ring, an almond outline and an iris, all glowing. */
function buildEye(centre: Vec3): { object: THREE.Group; iris: THREE.Group; material: THREE.MeshStandardMaterial } {
  const object = new THREE.Group();
  object.position.set(...centre);
  // It hangs on the south wall, facing north into the room.
  object.rotation.y = Math.PI;
  const material = new THREE.MeshStandardMaterial({ color: 0x140402, emissive: RED, emissiveIntensity: 2.6, roughness: 0.6, metalness: 0.2 });

  // Outer ring in three arcs, like the mark painted around the facility.
  for (let i = 0; i < 3; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.1, 8, 40, (Math.PI * 2) / 3 - 0.32), material);
    arc.rotation.z = Math.PI / 2 + (i * Math.PI * 2) / 3 + 0.16;
    object.add(arc);
  }
  // The almond: two arcs of a circle chosen to meet at the eye's corners.
  const halfWidth = 1.5;
  const halfHeight = 0.72;
  const radius = (halfWidth * halfWidth + halfHeight * halfHeight) / (2 * halfHeight);
  const sweep = 2 * Math.asin(halfWidth / radius);
  for (const side of [1, -1]) {
    const lid = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.07, 8, 36, sweep), material);
    lid.position.y = side * (halfHeight - radius);
    lid.rotation.z = (side > 0 ? 0 : Math.PI) + (Math.PI - sweep) / 2;
    object.add(lid);
  }
  // The iris: a ring and a pupil hot enough to bloom, on their own group so they can move.
  const iris = new THREE.Group();
  const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.9, 0.35), toneMapped: false, fog: false });
  iris.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 32), hot));
  iris.add(new THREE.Mesh(new THREE.CircleGeometry(0.3, 28), hot));
  iris.position.z = 0.04;
  object.add(iris);
  // A soft halo behind it all: brightest at the iris, fading to nothing.
  const glow = document.createElement('canvas');
  glow.width = glow.height = 128;
  const g = glow.getContext('2d')!;
  const fade = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  fade.addColorStop(0, 'rgba(255,255,255,1)');
  fade.addColorStop(0.35, 'rgba(255,255,255,0.42)');
  fade.addColorStop(0.7, 'rgba(255,255,255,0.12)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 128, 128);
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(7.4, 7.4),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glow), color: new THREE.Color(0.75, 0.07, 0.03), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  );
  halo.position.z = -0.05;
  addsLightOnly(halo);
  object.add(halo);
  object.traverse((o) => {
    o.castShadow = false;
  });
  return { object, iris, material };
}

export function buildCore(assets: Assets, materials: MaterialLibrary): AreaBuild {
  const b = new LevelBuilder(assets, materials);
  const atlas = new SignAtlas(1024, 1024);
  const leds = new LedBank();
  const screens = new ScreenBank();
  const lights: LightDef[] = [];
  const haze: Haze[] = [];
  const dustBeams: DustBeam[] = [];
  const { x0, x1, z0, z1, height: h } = CORE;
  const t = WALL;
  const door = DOOR_PLANS.find((d) => d.id === 'hallCore')!;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;

  // ---- Structure: steel-clad on every side
  b.box('floor', [x0 - t, -0.4, z0], [x1 + t, 0, z1 + t], { collide: false, cast: false });
  b.box('ceilingDeck', [x0 - t, h, z0 - t], [x1 + t, h + 0.25, z1 + t], { collide: false, cast: false });
  const walls = { height: h, lower: 'coreSteel', upper: 'coreSteel', paintLine: 1.25 } as const;
  wall(b, { ...walls, along: 'z', near: x0 - t, far: x0, from: z0 - t, to: z1 + t });
  wall(b, { ...walls, along: 'z', near: x1, far: x1 + t, from: z0 - t, to: z1 + t });
  wall(b, { ...walls, along: 'x', near: z1, far: z1 + t, from: x0, to: x1 });
  // North: the server hall's wall stands here; clad its core side and build above it.
  // (Right up to the doorway: the door's steel frame belongs to the hall
  // and hides the edges of this cladding, but only while the hall is drawn.)
  b.box('coreSteel', [x0, 0, z0], [door.from, HALL.height, z0 + 0.04], { collide: false, cast: false });
  b.box('coreSteel', [door.to, 0, z0], [x1, HALL.height, z0 + 0.04], { collide: false, cast: false });
  b.box('coreSteel', [door.from, door.top, z0], [door.to, HALL.height, z0 + 0.04], { collide: false, cast: false });
  b.box('coreSteel', [x0 - t, HALL.height, z0 - t], [x1 + t, h, z0 + 0.04], { collide: false, cast: false });
  // Cut-off corners make the room eight-sided.
  for (const [px, pz, rot] of [
    [x0 + 0.9, z0 + 0.9, Math.PI / 4],
    [x1 - 0.9, z0 + 0.9, -Math.PI / 4],
    [x0 + 0.9, z1 - 0.9, -Math.PI / 4],
    [x1 - 0.9, z1 - 0.9, Math.PI / 4],
  ] as const) {
    b.box('coreSteel', [px - 1.6, 0, pz - 0.3], [px + 1.6, h, pz + 0.3], { rotY: rot, cast: false });
  }
  // Ribs up the walls and a ring of girders overhead.
  for (const z of [29, 32, 35]) {
    b.box('darkSteel', [x0, 0, z - 0.09], [x0 + 0.14, h, z + 0.09], { collide: false });
    b.box('darkSteel', [x1 - 0.14, 0, z - 0.09], [x1, h, z + 0.09], { collide: false });
    b.box('rustedSteel', [x0, h - 0.34, z - 0.1], [x1, h, z + 0.1], { collide: false });
  }

  // ---- The dais and the kill-switch console
  drum(b, 'steelPlate', [cx, 0.06, cz], 2.9, 0.12, 'y', 32);
  drum(b, 'treadPlate', [cx, 0.185, cz], 2.2, 0.13, 'y', 32);
  drum(b, 'hazard', [cx, 0.252, cz], 2.2, 0.006, 'y', 32, false);
  drum(b, 'treadPlate', [cx, 0.257, cz], 1.95, 0.006, 'y', 32, false);
  b.blocker([cx - 0.75, 0, cz - 0.1], [cx + 0.75, 1.3, cz + 0.6]);
  b.box('darkSteel', [cx - 0.7, 0.25, cz], [cx + 0.7, 1.05, cz + 0.5], { collide: false });
  b.box('steelPlate', [cx - 0.76, 1.05, cz - 0.08], [cx + 0.76, 1.12, cz + 0.56], { collide: false });
  b.box('rackSteel', [cx - 0.6, 1.12, cz + 0.3], [cx + 0.6, 1.62, cz + 0.52], { collide: false });
  screens.add([cx, 1.37, cz + 0.296], [0, 0, -1], 0.62, 0.46, 'lockdown');
  // Three slots for the override keys, and the switch itself under a guard.
  for (const dx of [-0.42, 0, 0.42]) b.box('hazard', [cx + dx - 0.09, 1.12, cz + 0.02], [cx + dx + 0.09, 1.14, cz + 0.2], { collide: false, cast: false });
  b.box('hazard', [cx - 0.16, 1.12, cz - 0.07], [cx + 0.16, 1.2, cz + 0.0], { collide: false, cast: false });
  b.tube('rustedSteel', [cx, 1.2, cz - 0.035], [cx, 1.44, cz - 0.11], 0.022, false);
  // Thick cables from the console across the floor to the eye.
  for (const dx of [-0.5, 0.5]) b.cable('cable', [cx + dx, 0.3, cz + 0.5], [cx + dx * 2.4, 0.06, z1 - 0.4], 0.0, 0.05);

  // ---- ARGUS's eye on the south wall
  const eyeAt: Vec3 = [cx, 3.7, z1 - 0.22];
  b.box('cable', [cx - 3.2, 0.9, z1 - 0.12], [cx + 3.2, 6.5, z1 - 0.02], { collide: false, cast: false });
  const eye = buildEye(eyeAt);
  b.addObject(eye.object);
  for (const dx of [-2.6, -1.3, 1.3, 2.6]) b.cable('cable', [cx + dx, 6.4, z1 - 0.15], [cx + dx * 0.55, 3.7 + (Math.abs(dx) > 2 ? 1.7 : 2.2), z1 - 0.2], 0.25, 0.045);

  // ---- Machine pillars round the walls, with ARGUS's red lights
  const pillars: Array<[number, number, Vec3]> = [
    [x0 + 0.55, 29.6, [1, 0, 0]],
    [x0 + 0.55, 34.4, [1, 0, 0]],
    [x1 - 0.55, 29.6, [-1, 0, 0]],
    [x1 - 0.55, 34.4, [-1, 0, 0]],
  ];
  for (const [px, pz, normal] of pillars) {
    b.box('rackSteel', [px - 0.45, 0, pz - 0.55], [px + 0.45, 4.4, pz + 0.55]);
    b.box('darkSteel', [px - 0.5, 4.4, pz - 0.6], [px + 0.5, 4.5, pz + 0.6], { collide: false });
    for (const y of [1.15, 3.15]) leds.add([px + normal[0] * 0.456, y, pz], normal, 0.9, 1.86);
    b.cable('cable', [px, 4.5, pz], [px + normal[0] * 0.6, h - 0.1, pz + (pz < cz ? 0.8 : -0.8)], 0.3, 0.04);
  }
  leds.finish();
  screens.finish();
  b.addObject(leds.object);
  b.addObject(screens.object);

  for (const entry of ENTRY_PLANS) if (entry.area === 'core' && entry.kind === 'drop') vent(b, entry.at[0], entry.at[1], h);

  // ---- Signs
  const put = (sign: Sign, centre: Vec3, normal: Vec3, width: number, options: { roll?: number; opacity?: number; emissive?: number; tint?: number } = {}) => {
    b.decal(atlas.texture, centre, normal, width, width / sign.aspect, { ...options, uvRect: sign.uv });
  };
  const plate = atlas.text('KILL SWITCH', { size: 90, color: PAINT.amber, plate: '#0d0f11', wear: 0 });
  put(plate, [cx, 0.72, cz - 0.002], [0, 0, -1], 1.1, { emissive: 2.4, tint: 0xffb060 });
  put(atlas.text('MANUAL OVERRIDE', { size: 90, color: PAINT.yellow, wear: 0.5 }), [cx, 0.262, cz - 1.25], [0, 1, 0], 2.4, { opacity: 0.8, roll: Math.PI });
  put(atlas.text(['ARGUS CORE', 'NODE 04'], { size: 70, wear: 0.4 }), [x0, 2.6, 30.5], [1, 0, 0], 1.9, { opacity: 0.7 });
  put(atlas.text(['NO UNESCORTED', 'ACCESS'], { size: 60, color: PAINT.red, box: true, plate: PAINT.white, wear: 0.35 }), [x1, 2.3, 30.5], [-1, 0, 0], 1.5, { opacity: 0.9 });

  // ---- Lighting: one cold shaft on the dais, red from the eye
  const lamp: Vec3 = [cx, h - 0.4, cz];
  lights.push({ name: 'coreShaft', area: 'core', kind: 'spot', color: COLD, intensity: 760, position: lamp, target: [cx, 0, cz + 0.2], angle: 0.4, penumbra: 0.6, distance: 12, shadow: 1 });
  haze.push({ effect: createConeShaft([cx, h - 0.5, cz], [cx, 0.2, cz + 0.2], 0.3, 2.7, COLD, 0.13) });
  dustBeams.push({ position: lamp, target: [cx, 0, cz + 0.2], angle: 0.36, color: COLD, strength: 1.2 });
  lights.push({ name: 'coreEye', area: 'core', kind: 'point', color: RED, intensity: 40, position: [cx, 3.7, z1 - 1.8], distance: 14, flicker: 'pulse' });
  lights.push({ name: 'coreWest', area: 'core', kind: 'point', color: 0xff5a3a, intensity: 10, position: [x0 + 1.9, 1.8, 32], distance: 8 });
  lights.push({ name: 'coreEast', area: 'core', kind: 'point', color: 0xff5a3a, intensity: 10, position: [x1 - 1.9, 1.8, 32], distance: 8 });
  // Cold light high on the walls, so the chamber's ribs and height can be read.
  lights.push({ name: 'coreHighWest', area: 'core', kind: 'point', color: 0xcfe0ff, intensity: 20, position: [x0 + 2.2, 5.6, 30.5], distance: 12 });
  lights.push({ name: 'coreHighEast', area: 'core', kind: 'point', color: 0xcfe0ff, intensity: 20, position: [x1 - 2.2, 5.6, 33.5], distance: 12 });
  lights.push({ name: 'coreDoor', area: 'core', kind: 'point', color: 0xcfe0ff, intensity: 8, position: [(door.from + door.to) / 2, 3.0, z0 + 1.4], distance: 8 });
  lights.push({ name: 'coreConsole', area: 'core', kind: 'point', color: 0xffb060, intensity: 2.5, position: [cx, 1.5, cz - 0.6], distance: 4 });

  const built = b.build();
  return {
    id: 'core',
    ...built,
    lights,
    haze,
    dustBeams,
    tick: (time) => {
      leds.update(time);
      screens.update(time);
      // The iris drifts as if searching, and the whole eye breathes.
      eye.iris.position.x = Math.sin(time * 0.37) * 0.42;
      eye.iris.position.y = Math.sin(time * 0.53 + 1.2) * 0.14;
      eye.material.emissiveIntensity = 2.2 + 0.6 * Math.sin(time * 2.1);
    },
  };
}
