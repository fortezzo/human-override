import { describe, expect, it } from 'vitest';
import { ROBOT } from '../src/config';
import { neighbours, pickEntry, reachableAreas, type DoorLink } from '../src/sim/facility';
import { cellAt, createNavGrid, floodFrom, refreshRegion } from '../src/sim/navGrid';
import { makeCollider } from '../src/sim/collision';
import { AREA_CENTRES, AREA_IDS, DOOR_PLANS, ENTRY_PLANS, NAV_BOUNDS, RACK_PLANS, WALKABLE, areaAt, inRect, type AreaId } from '../src/world/plan';

const doors = (open: string[]): Array<DoorLink<AreaId>> => DOOR_PLANS.map((d) => ({ id: d.id, a: d.a, b: d.b, open: open.includes(d.id) }));

describe('areas and doors', () => {
  it('starts with only the lobby reachable', () => {
    expect([...reachableAreas<AreaId>('lobby', doors([]))]).toEqual(['lobby']);
  });

  it('opens up areas as doors are opened, in either direction', () => {
    expect(reachableAreas<AreaId>('lobby', doors(['lobbyHall']))).toEqual(new Set(['lobby', 'hall']));
    expect(reachableAreas<AreaId>('hall', doors(['lobbyHall']))).toEqual(new Set(['lobby', 'hall']));
    // The service door alone does not connect the lobby to anything.
    expect(reachableAreas<AreaId>('lobby', doors(['hallPower']))).toEqual(new Set(['lobby']));
    expect(reachableAreas<AreaId>('lobby', doors(['lobbyHall', 'hallPower']))).toEqual(new Set(['lobby', 'hall', 'power']));
    expect(reachableAreas<AreaId>('core', doors(['lobbyHall', 'lobbyPower', 'hallPower', 'hallCore']))).toEqual(new Set(AREA_IDS));
  });

  it('knows which areas are next to each other', () => {
    expect(neighbours<AreaId>('hall', doors([])).sort()).toEqual(['core', 'lobby', 'power']);
    expect(neighbours<AreaId>('core', doors([]))).toEqual(['hall']);
  });

  it('has a lobby-hall-power loop to run round', () => {
    expect(DOOR_PLANS.filter((d) => d.cost !== null).map((d) => [d.a, d.b].sort().join('-')).sort()).toEqual(['hall-lobby', 'hall-power', 'lobby-power']);
    // The core cannot be bought: the mission opens it.
    expect(DOOR_PLANS.find((d) => d.b === 'core')!.cost).toBeNull();
  });
});

describe('where robots come in', () => {
  const entries = ENTRY_PLANS.map((e) => ({ id: e.id, area: e.area }));

  it('only uses entries in areas the player can be reached from', () => {
    const reachable = new Set<AreaId>(['lobby']);
    for (let i = 0; i < 50; i++) {
      expect(pickEntry(entries, 'lobby', reachable, i / 50)!.area).toBe('lobby');
    }
    expect(pickEntry(entries, 'lobby', new Set<AreaId>(), 0.5)).toBeNull();
  });

  it("favours the player's own area but still uses the others", () => {
    const reachable = new Set<AreaId>(['lobby', 'hall']);
    let own = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) if (pickEntry(entries, 'hall', reachable, (i + 0.5) / n)!.area === 'hall') own++;
    expect(own / n).toBeGreaterThan(0.6);
    expect(own / n).toBeLessThan(0.95);
  });

  it('gives every area at least two ways in', () => {
    for (const area of AREA_IDS) expect(ENTRY_PLANS.filter((e) => e.area === area).length).toBeGreaterThanOrEqual(2);
  });

  it('opens round 1 with a single entry in front of the player', () => {
    expect(ENTRY_PLANS.filter((e) => e.area === 'lobby' && e.fromRound <= 1).map((e) => e.id)).toEqual(['yard']);
  });
});

describe('the floor plan', () => {
  it('puts every entry, rack and area centre somewhere robots and players can stand', () => {
    const walkable = (x: number, z: number) => WALKABLE.some((rect) => inRect(rect, x, z));
    for (const entry of ENTRY_PLANS) expect(walkable(entry.at[0], entry.at[1]), entry.id).toBe(true);
    for (const rack of RACK_PLANS) expect(walkable(rack.at[0] + rack.normal[0], rack.at[2] + rack.normal[2]), rack.weapon).toBe(true);
    for (const area of AREA_IDS) expect(areaAt(AREA_CENTRES[area][0], AREA_CENTRES[area][2])).toBe(area);
  });

  it('lets a robot walk from every entry to every area once the doors are open, and not before', () => {
    // The plan alone, with a wall-thick collider across each doorway standing in for its door.
    const doorCollider = (id: string) => {
      const d = DOOR_PLANS.find((plan) => plan.id === id)!;
      const mid = (d.from + d.to) / 2;
      return d.along === 'x' ? makeCollider(mid, d.at, (d.to - d.from) / 2, 0.13, 0, 0, d.top) : makeCollider(d.at, mid, 0.13, (d.to - d.from) / 2, 0, 0, d.top);
    };
    const shut = DOOR_PLANS.map((d) => doorCollider(d.id));
    const grid = createNavGrid(NAV_BOUNDS, 0.3, shut, ROBOT.radius + 0.06, 0.3, 1.8, WALKABLE);
    const reaches = (from: readonly [number, number]) => grid.distance[cellAt(grid, from[0], from[1])] !== Infinity;

    // Doors shut: from the lobby, only the lobby's own entries can reach the player.
    floodFrom(grid, AREA_CENTRES.lobby[0], AREA_CENTRES.lobby[2]);
    for (const entry of ENTRY_PLANS) expect(reaches(entry.at), `shut: ${entry.id}`).toBe(entry.area === 'lobby');

    // Open every door (as the game does: refresh the patch of floor each one stood on).
    for (const d of DOOR_PLANS) refreshRegion(grid, d.along === 'x' ? [d.from, d.at - 0.25, d.to, d.at + 0.25] : [d.at - 0.25, d.from, d.at + 0.25, d.to], []);
    for (const area of AREA_IDS) {
      floodFrom(grid, AREA_CENTRES[area][0], AREA_CENTRES[area][2]);
      for (const entry of ENTRY_PLANS) expect(reaches(entry.at), `${entry.id} -> ${area}`).toBe(true);
    }
  });
});
