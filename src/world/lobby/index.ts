// Assembles the security lobby from its parts.

import type { Assets } from '../../core/assets';
import type { LightDef } from '../../render/lighting';
import type { MaterialLibrary } from '../../render/materials';
import { LevelBuilder } from '../build/LevelBuilder';
import { vent, weaponRack, type AreaBuild, type Fixtures } from '../build/room';
import { SignAtlas } from '../build/SignAtlas';
import { ENTRY_PLANS, RACK_PLANS } from '../plan';
import { buildFurnishing } from './furnishing';
import { buildLights } from './lights';
import { buildMarkings } from './markings';
import { buildOpenings } from './openings';
import { GOODS_DOOR, POWER_DOOR, ROOM } from './plan';
import { ScreenBank } from './ScreenBank';
import { buildServices } from './services';
import { buildShell } from './shell';

export function buildLobby(assets: Assets, materials: MaterialLibrary, stations?: Fixtures): AreaBuild {
  const builder = new LevelBuilder(assets, materials);
  const screens = new ScreenBank();
  const signs = new SignAtlas();

  buildShell(builder);
  buildOpenings(builder);
  const fixtures = buildServices(builder);
  const work = buildFurnishing(builder, screens);
  buildMarkings(builder, signs);
  const lighting = buildLights(builder, fixtures, work);
  const lights: LightDef[] = lighting.lights.map((light) => ({ ...light, area: 'lobby' }));

  // The shotgun's rack, and the ceiling vent robots start dropping from in later rounds.
  for (const rack of RACK_PLANS) if (rack.area === 'lobby') weaponRack(builder, signs, assets, rack, lights);
  for (const entry of ENTRY_PLANS) if (entry.area === 'lobby' && entry.kind === 'drop') vent(builder, entry.at[0], entry.at[1], ROOM.height);

  // A small lamp over the power room door, so it can be found and read.
  lights.push({ name: 'powerDoorLamp', area: 'lobby', kind: 'point', color: 0xffe2b8, intensity: 4, position: [ROOM.x1 - 0.7, 2.75, (POWER_DOOR.z0 + POWER_DOOR.z1) / 2], distance: 4.5 });

  // And one over the goods door to the loading dock, in the sodium colour of the dock beyond it.
  lights.push({ name: 'goodsDoorLamp', area: 'lobby', kind: 'point', color: 0xffb463, intensity: 4, position: [ROOM.x0 + 0.7, 2.9, (GOODS_DOOR.z0 + GOODS_DOOR.z1) / 2], distance: 4.5 });

  screens.finish();
  builder.addObject(screens.object);

  stations?.(builder);
  const built = builder.build();
  return { id: 'lobby', ...built, lights, haze: lighting.haze, dustBeams: lighting.dustBeams, tick: (time) => screens.update(time) };
}
