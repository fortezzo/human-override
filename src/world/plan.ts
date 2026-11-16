// Floor plan of the whole facility, in metres.
//
// Compass: north is -Z, south is +Z, east is +X, west is -X.
//
//                                      yard (robots arrive)
//                                           |
//   truck yards        goods door     [ SECURITY LOBBY ] --- power door --- [ POWER ROOM ] -- breach -- transformer yard
//       |           +-----------------+     |                                |          |
//   bays 1 and 3    |                  blast door                      service door    lab door
//       |           |                       |                                |          |
//  [ LOADING DOCK ]-+-- dock shutter --[ SERVER HALL ]------------------------+          |
//                                           |        \                                   |
//                                       core door     +------ lab shutter ------[ ROBOTICS LAB ] -- assembly line
//                                           |
//                                        [ CORE ]   (sealed until the override keys are found)
//
// Six areas. Every one but the core has at least two ways out, so the
// doors make three loops: lobby - hall - power, lobby - dock - hall, and
// hall - lab - power.
//
// The lobby's own detailed measurements are in lobby/plan.ts. Everything
// that spans areas lives here: the rooms' outlines, the doors between them,
// where robots get in, where weapons hang, and where anything may walk.

import type { WeaponId } from '../config';
import { DOORS } from '../config';
import { BLAST_DOOR, GOODS_DOOR, POWER_DOOR, ROBOT_SPAWN, ROOM } from './lobby/plan';

export type AreaId = 'lobby' | 'hall' | 'power' | 'core' | 'dock' | 'lab';
export const AREA_IDS: AreaId[] = ['lobby', 'hall', 'power', 'core', 'dock', 'lab'];

export const AREA_NAMES: Record<AreaId, string> = {
  lobby: 'Security Lobby',
  hall: 'Server Hall',
  power: 'Power Room',
  core: 'Core',
  dock: 'Loading Dock',
  lab: 'Robotics Lab',
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
/**
 * West of the server hall: the loading dock, the biggest room on the map.
 * A short passage in its north-east corner leads through to the lobby.
 */
export const DOCK = { x0: -33.5, x1: -11.5, z0: 3.5, z1: 26, height: 7.5, paintLine: 1.25 } as const;
/** East of the server hall and south of the power room: where ARGUS builds and mends its machines. */
export const LAB = { x0: 9.5, x1: 23, z0: 14.5, z1: 30.5, height: 5.0, paintLine: 1.25 } as const;

/** The passage from the lobby's goods door through to the loading dock. */
export const DOCK_PASSAGE = { x0: DOCK.x1, x1: LOBBY.x0 - WALL, z0: GOODS_DOOR.z0, z1: GOODS_DOOR.z1, top: GOODS_DOOR.top } as const;

/** Inside floor of each area, used to tell which one the player is in. */
export const AREA_RECTS: Record<AreaId, Rect> = {
  lobby: [LOBBY.x0, LOBBY.z0 - 6, LOBBY.x1, LOBBY.z1 + 0.25],
  hall: [HALL.x0 - 0.25, HALL.z0 - 0.25, HALL.x1 + 0.25, HALL.z1 + 0.25],
  power: [POWER.x0 - 0.25, POWER.z0, POWER.x1 + 0.25, POWER.z1],
  core: [CORE.x0, CORE.z0 - 0.25, CORE.x1, CORE.z1],
  // (The dock's rectangle takes in its passage to the lobby. It overlaps the
  // hall's west wall on the map; the hall comes first in the list, so a
  // point in both is in the hall.)
  dock: [DOCK.x0, DOCK.z0, DOCK_PASSAGE.x1, DOCK.z1],
  lab: [LAB.x0 - 0.25, LAB.z0 - 0.25, LAB.x1, LAB.z1],
};

/** The rooms themselves, wall to wall (the lobby's rectangle above also takes in its entry corridor). */
export const ROOM_RECTS: Record<AreaId, Rect> = {
  lobby: [LOBBY.x0, LOBBY.z0, LOBBY.x1, LOBBY.z1],
  hall: [HALL.x0, HALL.z0, HALL.x1, HALL.z1],
  power: [POWER.x0, POWER.z0, POWER.x1, POWER.z1],
  core: [CORE.x0, CORE.z0, CORE.x1, CORE.z1],
  dock: [DOCK.x0, DOCK.z0, DOCK.x1, DOCK.z1],
  lab: [LAB.x0, LAB.z0, LAB.x1, LAB.z1],
};

/** Where reflections are photographed from, and the box dust drifts in, per area. */
export const AREA_CENTRES: Record<AreaId, [number, number, number]> = {
  lobby: [0, 1.7, 0.5],
  hall: [-1, 1.8, 16.5],
  power: [16, 1.8, 5],
  core: [-1, 2.2, 32],
  dock: [-22.5, 2.2, 14],
  lab: [16, 1.8, 21],
};

/** Each room's box: its floor and the underside of its ceiling. */
export const AREA_BOXES: Record<AreaId, { x0: number; x1: number; z0: number; z1: number; height: number }> = {
  lobby: { ...LOBBY, z0: LOBBY.z0 - 6 },
  hall: HALL,
  power: POWER,
  core: CORE,
  dock: DOCK,
  lab: LAB,
};

// ------------------------------------------------------------------ doors

export interface DoorPlan {
  id: 'lobbyHall' | 'lobbyPower' | 'hallPower' | 'hallCore' | 'lobbyDock' | 'hallDock' | 'hallLab' | 'powerLab';
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
  /** A single leaf slides toward the far end of the wall unless this says otherwise. */
  slides?: 1 | -1;
}

/** The server hall's service door to the power room. (Widened from 2 m when the map grew.) */
const SERVICE_DOOR = { from: 10.2, to: 12.6, top: 2.5 } as const;

export const DOOR_PLANS: DoorPlan[] = [
  { id: 'lobbyHall', a: 'lobby', b: 'hall', cost: DOORS.lobbyHall, along: 'x', at: LOBBY.z1 + WALL / 2, from: BLAST_DOOR.x0, to: BLAST_DOOR.x1, top: BLAST_DOOR.top, label: 'Server Hall' },
  { id: 'lobbyPower', a: 'lobby', b: 'power', cost: DOORS.lobbyPower, along: 'z', at: LOBBY.x1 + WALL / 2, from: POWER_DOOR.z0, to: POWER_DOOR.z1, top: POWER_DOOR.top, label: 'Power Room' },
  { id: 'hallPower', a: 'hall', b: 'power', cost: DOORS.hallPower, along: 'z', at: HALL.x1 + WALL / 2, ...SERVICE_DOOR, label: 'Service Door' },
  { id: 'hallCore', a: 'hall', b: 'core', cost: null, along: 'x', at: HALL.z1 + WALL / 2, from: -2.7, to: 0.7, top: 3.4, label: 'Core' },
  // The goods door in the lobby's west wall, at the head of the passage to the dock.
  { id: 'lobbyDock', a: 'lobby', b: 'dock', cost: DOORS.lobbyDock, along: 'z', at: LOBBY.x0 - WALL / 2, from: DOCK_PASSAGE.z0, to: DOCK_PASSAGE.z1, top: DOCK_PASSAGE.top, label: 'Loading Dock' },
  // The shutter between the server hall and the dock, where the hall's own dock opening used to be.
  { id: 'hallDock', a: 'hall', b: 'dock', cost: DOORS.hallDock, along: 'z', at: HALL.x0 - WALL / 2, from: 15, to: 18, top: 3.0, label: 'Loading Dock' },
  // The lab's two doors: from the south end of the hall's east aisles, and from the corner of the power room.
  { id: 'hallLab', a: 'hall', b: 'lab', cost: DOORS.hallLab, along: 'z', at: HALL.x1 + WALL / 2, from: 17.9, to: 20.1, top: 2.6, label: 'Robotics Lab' },
  { id: 'powerLab', a: 'power', b: 'lab', cost: DOORS.powerLab, along: 'x', at: POWER.z1 + WALL / 2, from: 19.5, to: 21.7, top: 2.6, label: 'Robotics Lab', slides: -1 },
];

/** The way through the wall at a door: the rectangle of floor in the doorway. */
export function doorway(id: DoorPlan['id']): Rect {
  const door = DOOR_PLANS.find((plan) => plan.id === id)!;
  return door.along === 'x' ? [door.from, door.at - WALL / 2, door.to, door.at + WALL / 2] : [door.at - WALL / 2, door.from, door.at + WALL / 2, door.to];
}

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

/** An opening in an east or west wall with a walled yard outside it, which robots cross to get in. */
export interface YardPlan {
  z0: number;
  z1: number;
  top: number;
  depth: number;
}

/** The loading dock's two open truck bays, in its west wall. (The bay between them is shut.) */
export const DOCK_BAYS = {
  north: { z0: 5.8, z1: 9.2, top: 3.4, depth: 7.5 },
  shut: { z0: 12.4, z1: 15.8, top: 3.4, depth: 0 },
  south: { z0: 19.4, z1: 22.8, top: 3.4, depth: 7.5 },
} as const satisfies Record<string, YardPlan>;
/** The breach in the power room's east wall. */
export const EAST_BREACH = { z0: 2.8, z1: 6.2, top: 3.1, depth: 7.5 } as const;
/** The hatch in the lab's east wall where the assembly line delivers what it has built. */
export const LAB_LINE = { z0: 22.6, z1: 25.6, top: 2.9, depth: 7.5 } as const;
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
  { id: 'hallVent', area: 'hall', kind: 'drop', at: [5.4, 21.9], spread: 0.25, height: HALL.height, fromRound: 1 },
  { id: 'hallVentWest', area: 'hall', kind: 'drop', at: [-7.4, 18.2], spread: 0.25, height: HALL.height, fromRound: 1 },
  { id: 'eastBreach', area: 'power', kind: 'walk', at: pocket(POWER.x1 + WALL, 1, EAST_BREACH.depth, EAST_BREACH.z0, EAST_BREACH.z1), spread: 0.3, fromRound: 1 },
  { id: 'powerVent', area: 'power', kind: 'drop', at: [13.4, 10.9], spread: 0.25, height: POWER.height, fromRound: 1 },
  { id: 'coreVentWest', area: 'core', kind: 'drop', at: [-4.4, 30.5], spread: 0.25, height: CORE.height, fromRound: 1 },
  { id: 'coreVentEast', area: 'core', kind: 'drop', at: [2.4, 33.5], spread: 0.25, height: CORE.height, fromRound: 1 },
  { id: 'dockBayNorth', area: 'dock', kind: 'walk', at: pocket(DOCK.x0 - WALL, -1, DOCK_BAYS.north.depth, DOCK_BAYS.north.z0, DOCK_BAYS.north.z1), spread: 0.3, fromRound: 1 },
  { id: 'dockBaySouth', area: 'dock', kind: 'walk', at: pocket(DOCK.x0 - WALL, -1, DOCK_BAYS.south.depth, DOCK_BAYS.south.z0, DOCK_BAYS.south.z1), spread: 0.3, fromRound: 1 },
  { id: 'dockVent', area: 'dock', kind: 'drop', at: [-14.6, 21.2], spread: 0.25, height: DOCK.height, fromRound: 1 },
  { id: 'labLine', area: 'lab', kind: 'walk', at: pocket(LAB.x1 + WALL, 1, LAB_LINE.depth, LAB_LINE.z0, LAB_LINE.z1), spread: 0.3, fromRound: 1 },
  { id: 'labVent', area: 'lab', kind: 'drop', at: [12.3, 27.6], spread: 0.25, height: LAB.height, fromRound: 1 },
];

// ------------------------------------------------------------ the mission

/** One place the mission sends the player. */
export interface MissionPlace {
  area: AreaId;
  /** The thing itself: where the HUD's marker points. */
  at: readonly [number, number, number];
  /** Where to stand to use it (on the floor). */
  stand: readonly [number, number];
}

/** The main breaker's lever, on the power room's south wall. */
export const BREAKER = { x: 15.4 + 1.26, y: 1.45, z: POWER.z1 - 0.6 } as const;
/**
 * The parts cage in the lab's south-east corner, its gate, and the stand
 * the key sits on just inside it. (It was in the power room, a few steps
 * from the breaker, until the map grew: now the mission's first two errands
 * are in different rooms.)
 */
export const KEY_CAGE = { area: 'lab', x0: 19.7, z0: 27.2, gate: { z0: 28.4, z1: 29.4 }, stand: { x: 20.4, z: 28.9, top: 1.0 } } as const;
/** The uplink station in the server hall, and the ground round it that has to be held. */
export const UPLINK = { x: 5.6, z: HALL.z1 - 0.55, zone: { x: 5.2, z: 22.9 } } as const;
/** The kill-switch console, in the middle of the core. */
export const KILL_SWITCH = { x: (CORE.x0 + CORE.x1) / 2, z: (CORE.z0 + CORE.z1) / 2 } as const;

export const MISSION_PLACES = {
  breaker: { area: 'power', at: [BREAKER.x, 1.5, BREAKER.z - 0.2], stand: [BREAKER.x - 0.5, POWER.z1 - 2.2] },
  cage: { area: 'lab', at: [KEY_CAGE.stand.x, 1.25, KEY_CAGE.stand.z], stand: [KEY_CAGE.x0 - 1.1, KEY_CAGE.stand.z] },
  uplink: { area: 'hall', at: [UPLINK.x, 1.9, UPLINK.z], stand: [UPLINK.x, UPLINK.z - 1.9] },
  coreDoor: { area: 'hall', at: [-1.0, 2.2, HALL.z1 + WALL / 2], stand: [-1.0, HALL.z1 - 1.3] },
  killSwitch: { area: 'core', at: [KILL_SWITCH.x, 1.45, KILL_SWITCH.z], stand: [KILL_SWITCH.x, KILL_SWITCH.z - 0.95] },
} as const satisfies Record<string, MissionPlace>;

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

/** The loading dock's four columns, standing between the truck bays and clear of the lanes in front of them. */
export const DOCK_COLUMNS: ReadonlyArray<readonly [number, number]> = [
  [-26.5, 10.8],
  [-26.5, 17.6],
  [-18.5, 10.8],
  [-18.5, 17.6],
];

export const RACK_PLANS: RackPlan[] = [
  // On the lobby column ahead and to the left of where the player starts, facing them.
  { weapon: 'shotgun', area: 'lobby', at: [-4.5, 1.62, -2.5 + COLUMN / 2], normal: [0, 0, 1] },
  // On the matching column to the right: the sidearm and its ammunition, cheap.
  { weapon: 'pistol', area: 'lobby', at: [4.5, 1.62, -2.5 + COLUMN / 2], normal: [0, 0, 1] },
  // On the first column of the server hall, facing whoever comes in through the blast door.
  { weapon: 'carbine', area: 'hall', at: [1.6, 1.62, 11.6 - COLUMN / 2], normal: [0, 0, -1] },
  // In the loading dock, on the column nearest the hall's shutter, facing it: a second carbine, and its ammunition.
  { weapon: 'carbine', area: 'dock', at: [-18.5 + COLUMN / 2, 1.62, 17.6], normal: [1, 0, 0] },
  // In the lab, on the north wall beside the door from the power room: a second shotgun for close work.
  { weapon: 'shotgun', area: 'lab', at: [17.6, 1.62, LAB.z0], normal: [0, 0, 1] },
];

// ----------------------------------------------------------- where to walk

/** The yard outside an opening in an east or west wall, as `approach` builds it: the opening itself and the ground beyond. */
const yard = (wallX: number, out: 1 | -1, plan: YardPlan): Rect[] => {
  const far = wallX + out * plan.depth;
  const inner = wallX - out * WALL;
  return [
    [Math.min(wallX, inner), plan.z0, Math.max(wallX, inner), plan.z1],
    [Math.min(wallX, far), plan.z0 - 1.6, Math.max(wallX, far), plan.z1 + 1.6],
  ];
};

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
  // Blast door and the server hall.
  doorway('lobbyHall'),
  [HALL.x0, HALL.z0, HALL.x1, HALL.z1],
  // Power door, power room, service door, east breach and the transformer yard.
  doorway('lobbyPower'),
  [POWER.x0, POWER.z0, POWER.x1, POWER.z1],
  doorway('hallPower'),
  ...yard(POWER.x1 + WALL, 1, EAST_BREACH),
  // Core door and the core.
  doorway('hallCore'),
  [CORE.x0, CORE.z0, CORE.x1, CORE.z1],
  // The loading dock, its passage and goods door to the lobby, its shutter to the hall, and its two truck yards.
  [DOCK.x0, DOCK.z0, DOCK.x1, DOCK.z1],
  [DOCK_PASSAGE.x0, DOCK_PASSAGE.z0, LOBBY.x0, DOCK_PASSAGE.z1],
  doorway('hallDock'),
  ...yard(DOCK.x0 - WALL, -1, DOCK_BAYS.north),
  ...yard(DOCK.x0 - WALL, -1, DOCK_BAYS.south),
  // The lab, its doors from the hall and the power room, and the assembly line's yard.
  [LAB.x0, LAB.z0, LAB.x1, LAB.z1],
  doorway('hallLab'),
  doorway('powerLab'),
  ...yard(LAB.x1 + WALL, 1, LAB_LINE),
];

export const NAV_BOUNDS = { x0: -43, x1: 31.5, z0: -20.5, z1: 38.5 } as const;

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
