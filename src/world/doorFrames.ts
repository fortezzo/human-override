// The fixed frame each door slides in.
//
// A doorway is seen from both of the rooms it joins, but a room is drawn
// only while it can be seen. While a door's frame belonged to one of its
// two rooms, the other room saw a shut door with no frame round it: the
// frame popped into place as the door began to open, and looking at the
// shut door from an angle showed the night sky round its edges. So the
// frames belong to the doors, which are always drawn.

import type { LevelBuilder } from './build/LevelBuilder';
import { portal } from './build/room';
import { buildBlastDoorFrame, buildPowerDoorFrame } from './lobby/openings';
import { DOOR_PLANS, HALL, LOBBY, POWER, WALL, type DoorPlan } from './plan';

const plan = (id: DoorPlan['id']): DoorPlan => DOOR_PLANS.find((door) => door.id === id)!;

export const DOOR_FRAMES: Record<DoorPlan['id'], (b: LevelBuilder) => void> = {
  lobbyHall: buildBlastDoorFrame,
  lobbyPower: buildPowerDoorFrame,
  hallPower: (b) => portal(b, 'z', HALL.x1, HALL.x1 + WALL, plan('hallPower')),
  hallCore: (b) => portal(b, 'x', HALL.z1, HALL.z1 + WALL, plan('hallCore')),
  lobbyDock: (b) => portal(b, 'z', LOBBY.x0 - WALL, LOBBY.x0, plan('lobbyDock')),
  hallDock: (b) => portal(b, 'z', HALL.x0 - WALL, HALL.x0, plan('hallDock')),
  hallLab: (b) => portal(b, 'z', HALL.x1, HALL.x1 + WALL, plan('hallLab')),
  powerLab: (b) => portal(b, 'x', POWER.z1, POWER.z1 + WALL, plan('powerLab')),
};
