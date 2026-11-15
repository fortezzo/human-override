// The facility as a map of areas joined by doors. Pure logic, no rendering.
//
// Two things in the game need to know which areas are connected right now:
// robots are only sent in through entry points the player can actually be
// reached from, and only areas that could be seen are drawn and lit.

export interface DoorLink<Area extends string> {
  id: string;
  /** The two areas the door joins. */
  a: Area;
  b: Area;
  open: boolean;
}

/** Every area that can be walked to from `start` through open doors (including `start`). */
export function reachableAreas<Area extends string>(start: Area, doors: ReadonlyArray<DoorLink<Area>>): Set<Area> {
  const reached = new Set<Area>([start]);
  const queue: Area[] = [start];
  while (queue.length) {
    const area = queue.pop()!;
    for (const door of doors) {
      if (!door.open) continue;
      const other = door.a === area ? door.b : door.b === area ? door.a : null;
      if (other !== null && !reached.has(other)) {
        reached.add(other);
        queue.push(other);
      }
    }
  }
  return reached;
}

/** Areas next to `area` through a door, open or not. */
export function neighbours<Area extends string>(area: Area, doors: ReadonlyArray<DoorLink<Area>>): Area[] {
  const out: Area[] = [];
  for (const door of doors) {
    if (door.a === area) out.push(door.b);
    else if (door.b === area) out.push(door.a);
  }
  return out;
}

export interface EntryPoint<Area extends string> {
  id: string;
  area: Area;
}

/**
 * Choose where the next robot comes in. Only entries in areas the player
 * can be reached from are used, and entries in the player's own area are
 * favoured (`ownAreaWeight` times likelier than the others), so the fight
 * follows the player around the map. `roll` is a random number 0..1.
 */
export function pickEntry<Area extends string, E extends EntryPoint<Area>>(entries: readonly E[], playerArea: Area, reachable: ReadonlySet<Area>, roll: number, ownAreaWeight = 3): E | null {
  const usable = entries.filter((entry) => reachable.has(entry.area));
  if (!usable.length) return null;
  const weights = usable.map((entry) => (entry.area === playerArea ? ownAreaWeight : 1));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let mark = Math.min(Math.max(roll, 0), 0.999999) * total;
  for (let i = 0; i < usable.length; i++) {
    mark -= weights[i]!;
    if (mark < 0) return usable[i]!;
  }
  return usable[usable.length - 1]!;
}
