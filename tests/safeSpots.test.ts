import { describe, expect, it } from 'vitest';
import { makeCollider, type Collider } from '../src/sim/collision';
import { findSafeSpots, groupSafeSpots } from '../src/sim/safeSpots';

const bounds = { x0: -10, x1: 10, z0: -10, z1: 10 };
const walkable = [[-10, -10, 10, 10]] as const;
const robot = { radius: 0.42, stepHeight: 0.3, height: 1.8 };
const player = { radius: 0.34, stepHeight: 0.32, height: 1.78 };
const entries: Array<[number, number]> = [[-6, -6]];
const find = (colliders: Collider[]) => findSafeSpots(bounds, 0.3, 0.15, colliders, walkable, entries, robot, player, [0, 0], 1.3);

describe('safe spots: places the player can stand that no robot can reach', () => {
  it('finds none on open ground, or behind a wall with a proper doorway', () => {
    expect(find([])).toHaveLength(0);
    // A wall across the map with a 2 m doorway: everything is reachable.
    expect(find([makeCollider(-2, 3, 8, 0.15, 0, 0, 3), makeCollider(9, 3, 1, 0.15, 0, 0, 3)])).toHaveLength(0);
  });

  it('finds a room whose only way in is too narrow for a robot', () => {
    // A room in the corner, entered through a gap 0.84 m wide: exactly a
    // robot's width, so it cannot pass, with room to spare for the player.
    const room = [makeCollider(4, 7.495, 0.15, 2.505, 0, 0, 3), makeCollider(7, 4, 3.15, 0.15, 0, 0, 3)];
    const spots = find(room);
    expect(spots.length).toBeGreaterThan(50);
    const patches = groupSafeSpots(spots, 0.15);
    expect(patches).toHaveLength(1);
    expect(patches[0]!.x).toBeGreaterThan(5);
    expect(patches[0]!.z).toBeGreaterThan(5);
    expect(patches[0]!.deepest).toBeGreaterThan(2);
  });

  it('does not count a shallow nook: a robot standing outside can still land a blow', () => {
    // The same wall, but the room behind it is only a 1 m deep strip.
    const nook = [makeCollider(4, 9.2, 0.15, 0.8, 0, 0, 3), makeCollider(7, 8.3, 3.15, 0.15, 0, 0, 3), makeCollider(4, 8.9, 0.15, 0.05, 0, 0, 3)];
    expect(groupSafeSpots(find(nook), 0.15).filter((patch) => patch.squares > 4)).toHaveLength(0);
  });

  it('does not count a sealed room the player cannot enter either', () => {
    const sealed = [makeCollider(4, 7, 0.15, 3, 0, 0, 3), makeCollider(7, 4, 3.15, 0.15, 0, 0, 3)];
    expect(find(sealed)).toHaveLength(0);
  });
});
