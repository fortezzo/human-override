// The lobby's lighting design.
//
// The idea: the room itself is lit in warm pools by its old pendant lamps,
// while everything hostile is cold. Robots arrive back-lit by a hard
// blue-white flood from the yard, so they first appear as silhouettes with
// burning eyes and long shadows, then walk forward into the warm light where
// they can be shot. Red emergency lamps mark the breach.

import type * as THREE from 'three';
import { createConeShaft, createFogCard, type ConeShaft, type DustBeam, type FogCard } from '../../render/atmosphere';
import type { LightDef } from '../../render/lighting';
import type { LevelBuilder } from '../build/LevelBuilder';
import type { WorkLights } from './furnishing';
import { BLAST_DOOR, BREACH, ROOM, VESTIBULE, WINDOWS } from './plan';
import type { Fixtures } from './services';

const WARM = 0xffd2a4;
const COLD = 0xbcd6ff;
const MOON = 0x8fb2ff;
const RED = 0xff2a12;
const AMBER = 0xff9a2e;

export interface LobbyLighting {
  lights: LightDef[];
  /** Haze effects, each tied to the light whose flicker it follows. */
  haze: Array<{ effect: ConeShaft | FogCard; follows?: string }>;
  dustBeams: DustBeam[];
}

export function buildLights(b: LevelBuilder, fixtures: Fixtures, work: WorkLights): LobbyLighting {
  const lights: LightDef[] = [];
  const haze: LobbyLighting['haze'] = [];
  const dustBeams: DustBeam[] = [];
  const { z0, z1, x0, x1 } = ROOM;

  // ---- Flood light out in the yard, blasting in through the entrance.
  const yardLamp: [number, number, number] = [0.6, 4.6, -24];
  lights.push({
    name: 'yard',
    kind: 'spot',
    color: COLD,
    intensity: 2600,
    position: yardLamp,
    target: [0, 0.9, -4],
    angle: 0.2,
    penumbra: 0.35,
    distance: 46,
    shadow: 1,
    needsShadow: true,
  });
  dustBeams.push({ position: yardLamp, target: [0, 0.9, -4], angle: 0.15, color: COLD, strength: 1.3 });
  // Fog catching that light: glowing layers down the corridor and a bright
  // core out in the yard. Robots walk between the layers.
  haze.push({ effect: createFogCard([0, 1.9, VESTIBULE.z0 - 1.4], [0, 0, 1], 9, 5.4, COLD, 0.26, [1, 1.25]) });
  haze.push({ effect: createFogCard([0, 1.7, -10.3], [0, 0, 1], 5.6, 3.6, COLD, 0.16, [1, 1.1]) });
  haze.push({ effect: createFogCard([0, 1.6, z0 - 0.9], [0, 0, 1], 4.4, 3.4, COLD, 0.1, [1.05, 1.1]) });
  haze.push({ effect: createFogCard([yardLamp[0], yardLamp[1], yardLamp[2] + 0.4], [0, 0, 1], 4.5, 4.5, COLD, 1.1, [1, 1]) });
  haze.push({ effect: createConeShaft([0, 2.4, z0 - 0.6], [0, 0.4, z0 + 5.5], 1.5, 2.6, COLD, 0.07) });

  // ---- Moonlight through the open west window.
  const open = WINDOWS.find((w) => w.open)!;
  const moonFrom: [number, number, number] = [x0 - 9, 8.2, open.z - 1.6];
  const moonTo: [number, number, number] = [x0 + 4.3, 0, open.z + 0.5];
  lights.push({
    name: 'moon',
    kind: 'spot',
    color: MOON,
    intensity: 1500,
    position: moonFrom,
    target: moonTo,
    angle: 0.2,
    penumbra: 0.3,
    distance: 30,
    shadow: 3,
    needsShadow: true,
  });
  dustBeams.push({ position: moonFrom, target: moonTo, angle: 0.11, color: MOON, strength: 1.5 });
  haze.push({ effect: createConeShaft([x0 - 0.3, 2.35, open.z], [x0 + 4.4, 0.25, open.z + 0.55], 0.75, 1.5, MOON, 0.13) });

  // ---- Pendant lamps over the aisle: the room's warm pools.
  fixtures.pendants.forEach((pendant, i) => {
    const name = `pendant${i}`;
    const lampY = ROOM.height - 0.3 - 1.25;
    const faulty = i === 2;
    lights.push({
      name,
      kind: 'spot',
      color: WARM,
      intensity: i === 0 ? 150 : 125,
      position: [0, lampY, pendant.z],
      target: [0, 0, pendant.z],
      angle: 1.02,
      penumbra: 0.75,
      distance: 10,
      shadow: i === 1 ? 2 : i === 0 ? 4 : undefined,
      flicker: faulty ? 'faulty' : undefined,
      glow: { materials: pendant.materials, color: 0xffd9a8, intensity: 5.5 },
    });
    const cone = createConeShaft([0, lampY - 0.05, pendant.z], [0, 0.1, pendant.z], 0.22, 2.5, WARM, 0.085);
    haze.push({ effect: cone, follows: faulty ? name : undefined });
    dustBeams.push({ position: [0, lampY, pendant.z], target: [0, 0, pendant.z], angle: 0.72, color: WARM, strength: 0.5 });
  });

  // ---- The defenders' tripod flood, aimed at the breach.
  lights.push({
    name: 'flood',
    kind: 'spot',
    color: 0xe4ecff,
    intensity: 260,
    position: work.flood.at,
    target: work.flood.aim,
    angle: 0.42,
    penumbra: 0.6,
    distance: 16,
    extra: true,
    glow: { materials: work.flood.materials, color: 0xdfe8ff, intensity: 7 },
  });

  // ---- Emergency lamps: red at the breach, amber over the blast door.
  for (const side of [-1, 1]) {
    const at: [number, number, number] = [side * (BREACH.x1 + 0.95), 2.75, z0 + 0.002];
    const materials = b.prop('industrial_wall_lamp', { at, collide: false, cast: false, unique: true });
    lights.push({
      name: `breachLamp${side}`,
      kind: 'point',
      color: RED,
      intensity: 9,
      position: [at[0], at[1], at[2] + 0.35],
      distance: 6.5,
      flicker: 'pulse',
      extra: side === 1,
      glow: { materials, color: RED, intensity: 9 },
    });
  }
  for (const side of [-1, 1]) {
    const at: [number, number, number] = [side * (BLAST_DOOR.x1 + 0.95), 2.75, z1 - 0.002];
    const materials = b.prop('industrial_wall_lamp', { at, rotY: Math.PI, collide: false, cast: false, unique: true });
    lights.push({
      name: `doorLamp${side}`,
      kind: 'point',
      color: AMBER,
      intensity: 5,
      position: [at[0], at[1], at[2] - 0.35],
      distance: 5.5,
      extra: true,
      glow: { materials, color: AMBER, intensity: 6 },
    });
  }

  // ---- Security desk: a warm desk lamp and the cold glow of the monitors.
  lights.push({
    name: 'deskLamp',
    kind: 'point',
    color: 0xffb070,
    intensity: 5,
    position: work.deskLamp.at,
    distance: 4.5,
    extra: true,
    glow: { materials: work.deskLamp.materials, color: 0xffc890, intensity: 4 },
  });
  lights.push({ name: 'monitors', kind: 'point', color: 0xff7a5c, intensity: 1.6, position: [x1 - 1.0, 1.75, -4.8], distance: 4, extra: true });

  // ---- Strip lights: one alive over the desk, the others dead.
  fixtures.strips.forEach((strip, i) => {
    const alive = i === 0;
    lights.push({
      name: `strip${i}`,
      kind: 'point',
      color: 0xd6e4ff,
      intensity: alive ? 14 : 0,
      position: strip.at,
      distance: alive ? 7.5 : 0.1,
      extra: true,
      flicker: alive ? 'faulty' : undefined,
      glow: { materials: strip.materials, color: 0xdce8ff, intensity: alive ? 5 : 0 },
    });
  });

  return { lights, haze, dustBeams };
}

/** For typing convenience where a module only needs the materials. */
export type LampMaterials = THREE.MeshStandardMaterial[];
