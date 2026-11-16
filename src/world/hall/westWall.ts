// The server hall's west wall, beside the walkway that runs past the ends
// of rows A to E.
//
// It was a long blank wall. What is on it now is what a wall like that has
// in a room full of machines that must be kept cold: cooling units up out
// of reach, fed from two header pipes that run the length of it; conduit
// and junction boxes at shoulder height; the notices such a room is
// required to carry; a temperature display; and two lamps that put a pool
// of cold light on the wall and the floor under it.
//
// Nothing here is solid, and nothing below head height stands more than a
// hand's width off the wall: the walkway is kept clear on purpose (it is
// one of the ways round the racks, for the player and for the horde).

import type { LightDef } from '../../render/lighting';
import type { LevelBuilder } from '../build/LevelBuilder';
import { PAINT, type Sign, type SignAtlas } from '../build/SignAtlas';
import { DOOR_PLANS, HALL } from '../plan';

type Vec3 = [number, number, number];

const HALF_PI = Math.PI / 2;
const COLD = 0xd6e4ff;

export function buildWestWall(b: LevelBuilder, atlas: SignAtlas, lights: LightDef[]): void {
  const { x0, z0, z1 } = HALL;
  const dock = DOOR_PLANS.find((d) => d.id === 'hallDock')!;
  /** Facing into the room from this wall. */
  const W: Vec3 = [1, 0, 0];
  const put = (sign: Sign, centre: Vec3, width: number, options: { opacity?: number; emissive?: number; tint?: number } = {}) => {
    b.decal(atlas.texture, centre, W, width, width / sign.aspect, { ...options, uvRect: sign.uv });
  };
  /** The two stretches of wall, north and south of the shutter to the loading dock. */
  const runs: Array<[number, number]> = [
    [z0 + 0.25, dock.from - 0.55],
    [dock.to + 0.55, z1 - 0.25],
  ];

  // ---- Two header pipes the length of the wall, high up, on brackets.
  b.tube('rustedSteel', [x0 + 0.17, 4.36, z0 + 0.1], [x0 + 0.17, 4.36, z1 - 0.1], 0.07);
  b.tube('paintedMetal', [x0 + 0.13, 4.64, z0 + 0.1], [x0 + 0.13, 4.64, z1 - 0.1], 0.045);
  for (let z = z0 + 1.1; z < z1; z += 2.4) {
    b.box('darkSteel', [x0, 4.24, z - 0.03], [x0 + 0.27, 4.28, z + 0.03], { collide: false, cast: false });
    b.box('darkSteel', [x0 + 0.02, 4.0, z - 0.02], [x0 + 0.05, 4.24, z + 0.02], { collide: false, cast: false });
    for (const y of [4.36, 4.64]) b.tube('darkSteel', [x0 + 0.15, y, z - 0.03], [x0 + 0.15, y, z + 0.03], y > 4.5 ? 0.062 : 0.09, false);
  }

  // ---- Cooling units, one opposite the end of each row that reaches this
  // side, on brackets above head height; each with its two pipes up to the
  // headers, a drain line down the wall, and a lamp to say it is running.
  const running = atlas.text('I', { size: 40, color: PAINT.white, plate: PAINT.white, wear: 0 });
  const units: Array<{ z: number; ok: boolean }> = [
    { z: 9.7, ok: true },
    { z: 13.1, ok: true },
    { z: 19.9, ok: false },
    { z: 23.3, ok: true },
  ];
  for (const { z, ok } of units) {
    const base = 2.62;
    b.prop('exterior_aircon_unit', { part: 'unit', at: [x0 + 0.24, base + 0.32, z], rotY: HALF_PI, collide: false, kind: 'metal' });
    // Flow and return, up to the headers.
    b.tube('rustedSteel', [x0 + 0.12, base + 0.9, z - 0.27], [x0 + 0.17, 4.36, z - 0.27], 0.032);
    b.tube('paintedMetal', [x0 + 0.1, base + 0.9, z + 0.25], [x0 + 0.13, 4.64, z + 0.25], 0.024);
    // The drain line, and what has run down the wall from where it leaks.
    b.tube('paintedMetal', [x0 + 0.045, base + 0.1, z + 0.46], [x0 + 0.045, 1.3, z + 0.46], 0.014, false);
    for (const y of [1.6, 2.2]) b.box('darkSteel', [x0, y - 0.015, z + 0.435], [x0 + 0.065, y + 0.015, z + 0.485], { collide: false, cast: false });
    b.decalImage('Leaking003', [x0, 1.95, z + 0.46], W, 0.7, 1.5, { opacity: ok ? 0.35 : 0.6, tint: 0x5b5a52 });
    // Its lamp: green for running, amber for the one that is not keeping up.
    b.box('darkSteel', [x0, base - 0.14, z - 0.06], [x0 + 0.05, base - 0.04, z + 0.06], { collide: false, cast: false });
    b.decal(atlas.texture, [x0 + 0.052, base - 0.09, z], W, 0.07, 0.045, { uvRect: running.uv, emissive: 3.4, tint: ok ? 0x6dffa8 : 0xffb347 });
  }

  // ---- Conduit at shoulder height, with a junction box every few metres.
  for (const [from, to] of runs) {
    for (const [y, radius] of [
      [1.62, 0.016],
      [1.7, 0.012],
      [1.77, 0.012],
    ] as const) {
      b.tube('darkSteel', [x0 + 0.03, y, from], [x0 + 0.03, y, to], radius, false);
    }
    for (let z = from + 0.6; z < to; z += 1.5) b.box('steelPlate', [x0, 1.585, z - 0.02], [x0 + 0.05, 1.8, z + 0.02], { collide: false, cast: false });
    for (const z of [from + 1.0, (from + to) / 2, to - 1.0]) {
      b.box('steelPlate', [x0, 1.48, z - 0.17], [x0 + 0.075, 1.94, z + 0.17], { collide: false, cast: false });
      b.box('darkSteel', [x0 + 0.075, 1.5, z - 0.15], [x0 + 0.082, 1.92, z + 0.15], { collide: false, cast: false });
      b.tube('darkSteel', [x0 + 0.04, 1.94, z], [x0 + 0.04, 2.5, z], 0.014, false);
    }
  }

  // ---- What the wall says.
  // (Each in the clear stretch between two cooling units, under that stretch's lamp.)
  const bayNorth = (units[0]!.z + units[1]!.z) / 2;
  const baySouth = (units[2]!.z + units[3]!.z) / 2;
  put(atlas.text('COOLING LOOP 02', { size: 96, wear: 0.5 }), [x0, 3.3, bayNorth], 2.3, { opacity: 0.62 });
  put(atlas.text('ROWS A - E', { size: 80, color: PAINT.yellow, wear: 0.45 }), [x0, 2.3, bayNorth - 0.45], 1.5, { opacity: 0.8 });
  put(atlas.arrow('right', PAINT.yellow, 160, 0.45), [x0, 2.3, bayNorth + 0.75], 0.42, { opacity: 0.8 });
  put(atlas.text(['GAS SUPPRESSION ZONE', 'LEAVE THE HALL ON ALARM'], { size: 50, color: PAINT.red, box: true, plate: PAINT.white, wear: 0.4 }), [x0, 2.2, baySouth], 1.9, { opacity: 0.9 });
  // An emergency power-off point by the dock's shutter: a striped plate, and the button on it.
  const epo = dock.from - 0.95;
  b.box('hazard', [x0, 1.98, epo - 0.16], [x0 + 0.06, 2.4, epo + 0.16], { collide: false, cast: false });
  put(atlas.text(['EMERGENCY', 'POWER OFF'], { size: 40, color: PAINT.black, plate: PAINT.yellow, wear: 0.25 }), [x0 + 0.061, 2.3, epo], 0.27, { opacity: 0.95 });
  b.tube('rustedSteel', [x0 + 0.06, 2.1, epo], [x0 + 0.1, 2.1, epo], 0.05, false);
  b.decal(atlas.texture, [x0 + 0.101, 2.1, epo], W, 0.085, 0.085, { uvRect: running.uv, emissive: 1.6, tint: 0xff2a12 });
  // The hall's temperature, on a lit panel: it is warmer in here than it should be.
  b.box('darkSteel', [x0, 2.86, baySouth - 0.56], [x0 + 0.06, 3.24, baySouth + 0.56], { collide: false, cast: false });
  put(atlas.text('HALL B   31.4 C', { size: 90, color: PAINT.amber, plate: '#0d0f11', wear: 0 }), [x0 + 0.061, 3.05, baySouth], 1.04, { emissive: 2.2, tint: 0xffb060 });

  // ---- Two lamps on the wall, cold like the rest of the hall's.
  [bayNorth, baySouth].forEach((z, i) => {
    const at: Vec3 = [x0 + 0.002, 4.02, z];
    const fixture = b.prop('industrial_wall_lamp', { at, rotY: HALF_PI, collide: false, cast: false, unique: true });
    lights.push({ name: `hallWestWall${i}`, area: 'hall', kind: 'point', color: COLD, intensity: 11, position: [x0 + 0.55, 3.55, z], distance: 7, glow: { materials: fixture, color: 0xdce8ff, intensity: 7 } });
  });
}
