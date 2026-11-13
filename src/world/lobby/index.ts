// Assembles the security lobby from its parts.

import type * as THREE from 'three';
import type { Assets } from '../../core/assets';
import type { DustBeam } from '../../render/atmosphere';
import type { LightDef } from '../../render/lighting';
import type { MaterialLibrary } from '../../render/materials';
import type { Collider } from '../../sim/collision';
import { LevelBuilder } from '../build/LevelBuilder';
import { SignAtlas } from '../build/SignAtlas';
import { buildFurnishing } from './furnishing';
import { buildLights, type LobbyLighting } from './lights';
import { buildMarkings } from './markings';
import { buildOpenings } from './openings';
import { ScreenBank } from './ScreenBank';
import { buildServices } from './services';
import { buildShell } from './shell';

export interface Lobby {
  group: THREE.Group;
  colliders: Collider[];
  /** Meshes that stop bullets. */
  solids: THREE.Mesh[];
  lights: LightDef[];
  haze: LobbyLighting['haze'];
  dustBeams: DustBeam[];
  screens: ScreenBank;
  /** The painted signs, kept so they can be inspected as one picture. */
  signs: SignAtlas;
}

export function buildLobby(assets: Assets, materials: MaterialLibrary): Lobby {
  const builder = new LevelBuilder(assets, materials);
  const screens = new ScreenBank();
  const signs = new SignAtlas();

  buildShell(builder);
  buildOpenings(builder);
  const fixtures = buildServices(builder);
  const work = buildFurnishing(builder, screens);
  buildMarkings(builder, signs);
  const lighting = buildLights(builder, fixtures, work);

  screens.finish();
  builder.addObject(screens.object);
  for (const { effect } of lighting.haze) builder.addObject(effect.mesh);

  const built = builder.build();
  return { ...built, lights: lighting.lights, haze: lighting.haze, dustBeams: lighting.dustBeams, screens, signs };
}
