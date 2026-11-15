// Floor plan of the security lobby, in metres.
//
// Compass: north is -Z (the breached main entrance), south is +Z (the blast
// door to the server hall), east is +X (security desk, power room door),
// west is -X (the windows). The player starts in the south half looking
// north. All the lobby files read their measurements from here.

export const ROOM = {
  x0: -9,
  x1: 9,
  z0: -7,
  z1: 7,
  /** Underside of the ceiling. */
  height: 4.8,
  /** Wall thickness. */
  wall: 0.5,
  /** Height of the painted band on the lower wall. */
  paintLine: 1.25,
} as const;

/** The main entrance in the north wall, forced open. */
export const BREACH = { x0: -1.9, x1: 1.9, top: 3.1 } as const;

/** The entry corridor beyond the breach, and the yard outside it. */
export const VESTIBULE = { x0: -2.7, x1: 2.7, z0: -12.6, height: 3.4, doorTop: 3.0 } as const;

/** Tall windows in the west wall. `open` ones are entry points. */
export const WINDOW = { halfWidth: 1.1, sill: 1.15, head: 3.0 } as const;
export const WINDOWS = [
  { z: -3.6, open: true },
  { z: 1.6, open: false },
] as const;

/** Blast door to the server hall, in the south wall. */
export const BLAST_DOOR = { x0: -1.8, x1: 1.8, top: 3.1 } as const;

/** Door to the power room, in the east wall. */
export const POWER_DOOR = { z0: 2.7, z1: 4.5, top: 2.45 } as const;

/** Concrete beam running round the top of the walls. */
export const RING_BEAM = { depth: 0.5, proud: 0.1 } as const;

/**
 * Shallow piers that divide the long walls into bays. Each list gives
 * positions along that wall (x for north and south, z for east and west),
 * chosen to fall between the signs, lamps and openings.
 */
export const PIER = { width: 0.3, proud: 0.07 } as const;
export const PIERS = {
  north: [-7.5, -3.75, 6.5],
  south: [-6.7, -3.25, 5.75],
  east: [-6.45, -3.6, 6.7],
  west: [-5.9, -2.2, 3.2, 5.9],
} as const;

export const COLUMNS: ReadonlyArray<readonly [number, number]> = [
  [-4.5, -2.5],
  [4.5, -2.5],
  [-4.5, 2.5],
  [4.5, 2.5],
];
export const COLUMN_SIZE = 0.7;

export const PLAYER_START = { x: 0, z: 4.6, yaw: 0 } as const;

/**
 * A shipping container standing against the east side of the yard. Robots
 * appear in the gap behind it, which cannot be seen from the entrance or
 * from most of the yard, and walk out round its near end. (They used to
 * appear in the middle of the yard, in plain view through the entrance.)
 */
export const YARD_CONTAINER = { x0: 2.9, x1: 4.4, z0: -19.95, z1: -15.5, height: 2.6 } as const;

/** Where robots appear: in the gap between that container and the yard's east side. */
export const ROBOT_SPAWN = { x: 5.2, z: -17.7, spread: 0.3 } as const;

/** Area robots are allowed to walk in (used to size the navigation grid). */
export const NAV_BOUNDS = { x0: -10, x1: 10, z0: -20, z1: 8 } as const;
