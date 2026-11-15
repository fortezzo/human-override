// Floor plan of the whole facility, in metres.
//
// Compass: north is -Z, south is +Z, east is +X, west is -X.
//
//                    yard (robots arrive)
//                         |
//                   [ SECURITY LOBBY ] --- power door --- [ POWER ROOM ] -- breach -- transformer yard
//                         |                                    |
//                    blast door                           service door
//                         |                                    |
//   loading dock ---[ SERVER HALL ]----------------------------+
//                         |
//                     core door (sealed until the override keys are found)
//                         |
//                      [ CORE ]
//
// The lobby's own detailed measurements are in lobby/plan.ts. Everything
// that spans areas lives here: the rooms' outlines, the doors between them,
// where robots get in, where weapons hang, and where anything may walk.

import type { WeaponId } from '../config';
import { DOORS } from '../config';
import { BLAST_DOOR, POWER_DOOR, ROBOT_SPAWN, ROOM } from './lobby/plan';

export type AreaId = 'lobby' | 'hall' | 'power' | 'core';
export const AREA_IDS: AreaId[] = ['lobby', 'hall', 'power', 'core'];

export const AREA_NAMES: Record<AreaId, string> = {
  lobby: 'Security Lobby',
  hall: 'Server Hall',
  power: 'Power Room',
  core: 'Core',
};

/** A rectangle on the ground: [x0, z0, x1, z1]. */
export type Rect = readonly [number, number, number, number];

/** Wall thickness everywhere. */
export const WALL = 0.5;

export const LOBBY = { x0: ROOM.x0, x1: ROOM.x1, z0: ROOM.z0, z1: ROOM.z1, height: ROOM.height } as const;
/** South of the lobby. Taller, with rows of server racks either side of a central aisle. */
export const HALL = { x0: -11, x1: 9, z0: 7.5, z1: 25.5, height: 5.6, paintLine: 1.25 } as const;
/** East of the lobby, wrapping round the corner of the server hall. */
export const POWER = { x0: 9.5, x1: 22.5, z0: -4, z1: 14, height: 5.2, paintLine: 1.25 } as const;
/** South of the server hall: the chamber that holds the kill switch. */
export const CORE = { x0: -7, x1: 5, z0: 26, z1: 38, height: 7 } as const;

/** Inside floor of each area, used to tell which one the player is in. */
export const AREA_RECTS: Record<AreaId, Rect> = {
  lobby: [LOBBY.x0, LOBBY.z0 - 6, LOBBY.x1, LOBBY.z1 + 0.25],
  hall: [HALL.x0 - 0.25, HALL.z0 - 0.25, HALL.x1 + 0.25, HALL.z1 + 0.25],
  power: [POWER.x0 - 0.25, POWER.z0, POWER.x1 + 0.25, POWER.z1],
  core: [CORE.x0, CORE.z0 - 0.25, CORE.x1, CORE.z1],
};

/** The rooms themselves, wall to wall (the lobby's rectangle above also takes in its entry corridor). */
export const ROOM_RECTS: Record<AreaId, Rect> = {
  lobby: [LOBBY.x0, LOBBY.z0, LOBBY.x1, LOBBY.z1],
  hall: [HALL.x0, HALL.z0, HALL.x1, HALL.z1],
  power: [POWER.x0, POWER.z0, POWER.x1, POWER.z1],
  core: [CORE.x0, CORE.z0, CORE.x1, CORE.z1],
};

/** Where reflections are photographed from, and the box dust drifts in, per area. */
export const AREA_CENTRES: Record<AreaId, [number, number, number]> = {
  lobby: [0, 1.7, 0.5],
  hall: [-1, 1.8, 16.5],
  power: [16, 1.8, 5],
  core: [-1, 2.2, 32],
};

// ------------------------------------------------------------------ doors

export interface DoorPlan {
  id: 'lobbyHall' | 'lobbyPower' | 'hallPower' | 'hallCore';
  /** The two areas it joins. */
  a: AreaId;
  b: AreaId;
  /** Scrap to open it, or null if it cannot be bought (the core is opened by the mission). */
  cost: number | null;
  /** The wall the door is in: it runs along this axis ... */
  along: 'x' | 'z';
  /** ... at this position on the other axis (the middle of the wall) ... */
  at: number;
  /** ... between these two positions, up to this height. */
  from: number;
  to: number;
  top: number;
  label: string;
}

export const DOOR_PLANS: DoorPlan[] = [
  { id: 'lobbyHall', a: 'lobby', b: 'hall', cost: DOORS.lobbyHall, along: 'x', at: LOBBY.z1 + WALL / 2, from: BLAST_DOOR.x0, to: BLAST_DOOR.x1, top: BLAST_DOOR.top, label: 'Server Hall' },
  { id: 'lobbyPower', a: 'lobby', b: 'power', cost: DOORS.lobbyPower, along: 'z', at: LOBBY.x1 + WALL / 2, from: POWER_DOOR.z0, to: POWER_DOOR.z1, top: POWER_DOOR.top, label: 'Power Room' },
  { id: 'hallPower', a: 'hall', b: 'power', cost: DOORS.hallPower, along: 'z', at: HALL.x1 + WALL / 2, from: 10.4, to: 12.4, top: 2.5, label: 'Service Door' },
  { id: 'hallCore', a: 'hall', b: 'core', cost: null, along: 'x', at: HALL.z1 + WALL / 2, from: -2.7, to: 0.7, top: 3.4, label: 'Core' },
];

// ---------------------------------------------------------- robot entries

export interface EntryPlan {
  id: string;
  area: AreaId;
  /**
   * 'walk': robots appear outside, behind a shipping container where they
   *         cannot be seen from indoors, and walk in through an opening.
   * 'drop': robots drop from a torn-open vent in the ceiling.
   */
  kind: 'walk' | 'drop';
  /** Where a robot appears: on the ground outside, or the spot it lands on. */
  at: readonly [number, number];
  /** Robots appear within this distance of `at`. */
  spread: number;
  /** For drops: the height of the ceiling it comes through. */
  height?: number;
  /** The first round this entry is used in. */
  fromRound: number;
}

/** The loading dock opening in the server hall's west wall. */
export const DOCK = { z0: 15, z1: 18, top: 3.0, depth: 7 } as const;
/** The breach in the power room's east wall. */
export const EAST_BREACH = { z0: 2.8, z1: 6.2, top: 3.1, depth: 7.5 } as const;
/** Size of the hole a ceiling vent leaves. */
export const VENT_SIZE = 1.5;

/**
 * The middle of the gap behind the container in a yard built by
 * `approach` (build/room.ts): between the container and the yard's end
 * wall, at the far end from where the container stops.
 */
const pocket = (wallX: number, out: 1 | -1, depth: number, z0: number, z1: number): [number, number] => [wallX + out * (depth - 0.775), (z0 + z1) / 2 + 1.55];

export const ENTRY_PLANS: EntryPlan[] = [
  { id: 'yard', area: 'lobby', kind: 'walk', at: [ROBOT_SPAWN.x, ROBOT_SPAWN.z], spread: ROBOT_SPAWN.spread, fromRound: 1 },
  { id: 'lobbyVent', area: 'lobby', kind: 'drop', at: [-7.9, 2.75], spread: 0.25, height: LOBBY.height, fromRound: 3 },
  { id: 'dock', area: 'hall', kind: 'walk', at: pocket(HALL.x0 - WALL, -1, DOCK.depth, DOCK.z0, DOCK.z1), spread: 0.3, fromRound: 1 },
  { id: 'hallVent', area: 'hall', kind: 'drop', at: [5.4, 21.9], spread: 0.25, height: HALL.height, fromRound: 1 },
  { id: 'eastBreach', area: 'power', kind: 'walk', at: pocket(POWER.x1 + WALL, 1, EAST_BREACH.depth, EAST_BREACH.z0, EAST_BREACH.z1), spread: 0.3, fromRound: 1 },
  { id: 'powerVent', area: 'power', kind: 'drop', at: [13.4, 10.9], spread: 0.25, height: POWER.height, fromRound: 1 },
  { id: 'coreVentWest', area: 'core', kind: 'drop', at: [-4.4, 30.5], spread: 0.25, height: CORE.height, fromRound: 1 },
  { id: 'coreVentEast', area: 'core', kind: 'drop', at: [2.4, 33.5], spread: 0.25, height: CORE.height, fromRound: 1 },
];

// ------------------------------------------------------------ wall racks

export interface RackPlan {
  weapon: WeaponId;
  area: AreaId;
  /** Centre of the rack's board, and the way it faces. */
  at: readonly [number, number, number];
  normal: readonly [number, number, number];
}

/** Columns either side of the server hall's central aisle. */
export const HALL_COLUMNS: ReadonlyArray<readonly [number, number]> = [
  [-3.6, 11.6],
  [1.6, 11.6],
  [-3.6, 21.4],
  [1.6, 21.4],
];
export const COLUMN = 0.7;

export const RACK_PLANS: RackPlan[] = [
  // On the lobby column ahead and to the left of where the player starts, facing them.
  { weapon: 'shotgun', area: 'lobby', at: [-4.5, 1.62, -2.5 + COLUMN / 2], normal: [0, 0, 1] },
  // On the matching column to the right: the sidearm and its ammunition, cheap.
  { weapon: 'pistol', area: 'lobby', at: [4.5, 1.62, -2.5 + COLUMN / 2], normal: [0, 0, 1] },
  // On the first column of the server hall, facing whoever comes in through the blast door.
  { weapon: 'carbine', area: 'hall', at: [1.6, 1.62, 11.6 - COLUMN / 2], normal: [0, 0, -1] },
];

// ----------------------------------------------------------- where to walk

/**
 * Everywhere a robot may set foot. Path-finding is confined to these
 * rectangles, so robots outside the building keep to the approaches that
 * were built for them instead of wandering round the outside in the dark.
 */
export const WALKABLE: Rect[] = [
  [LOBBY.x0, LOBBY.z0, LOBBY.x1, LOBBY.z1],
  // Main entrance: the breach, the entry corridor and the yard beyond.
  [-2.7, -12.6, 2.7, LOBBY.z0],
  [-6, -20, 6, -12.6],
  // Blast door, server hall, loading dock.
  [BLAST_DOOR.x0, LOBBY.z1, BLAST_DOOR.x1, HALL.z0],
  [HALL.x0, HALL.z0, HALL.x1, HALL.z1],
  [HALL.x0 - WALL, DOCK.z0, HALL.x0, DOCK.z1],
  [HALL.x0 - WALL - DOCK.depth, DOCK.z0 - 1.6, HALL.x0 - WALL, DOCK.z1 + 1.6],
  // Power door, power room, service door, east breach and the transformer yard.
  [LOBBY.x1, POWER_DOOR.z0, POWER.x0, POWER_DOOR.z1],
  [POWER.x0, POWER.z0, POWER.x1, POWER.z1],
  [HALL.x1, 10.4, POWER.x0, 12.4],
  [POWER.x1, EAST_BREACH.z0, POWER.x1 + WALL, EAST_BREACH.z1],
  [POWER.x1 + WALL, EAST_BREACH.z0 - 1.6, POWER.x1 + WALL + EAST_BREACH.depth, EAST_BREACH.z1 + 1.6],
  // Core door and the core.
  [-2.7, HALL.z1, 0.7, CORE.z0],
  [CORE.x0, CORE.z0, CORE.x1, CORE.z1],
];

export const NAV_BOUNDS = { x0: -19.5, x1: 31.5, z0: -20.5, z1: 38.5 } as const;

export function inRect(rect: Rect, x: number, z: number): boolean {
  return x >= rect[0] && x <= rect[2] && z >= rect[1] && z <= rect[3];
}

/** True if a point is inside one of the rooms proper (not a doorway, corridor or yard). */
export function insideRoom(x: number, z: number): boolean {
  for (const id of AREA_IDS) if (inRect(ROOM_RECTS[id], x, z)) return true;
  return false;
}

/** Which area a point on the ground is in, or null if it is in none (a doorway, outside). */
export function areaAt(x: number, z: number): AreaId | null {
  for (const id of AREA_IDS) if (inRect(AREA_RECTS[id], x, z)) return id;
  return null;
}
