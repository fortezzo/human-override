import { describe, expect, it } from 'vitest';
import { makeCollider, type Collider } from '../src/sim/collision';
import { createNavGrid } from '../src/sim/navGrid';
import { findSafeSpots, findStandableOutOfReach, groupSafeSpots } from '../src/sim/safeSpots';

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

describe('standing everywhere: places reached by the rules of movement that no robot can strike', () => {
  // A corner fenced off by a row of barrels 0.9 m high, wall to wall: the
  // corner the real player found. Nobody can walk into it; someone who can
  // get up onto a barrel can step down the other side.
  const barrels = [makeCollider(7, 5.5, 3.2, 0.3, 0, 0, 0.9), makeCollider(4.5, 8, 0.3, 2.2, 0, 0, 0.9)];
  const robots = createNavGrid(bounds, 0.3, barrels, robot.radius, robot.stepHeight, robot.height, walkable, entries);
  const stand = (climb: number, colliders: Collider[] = barrels, floor = robots) =>
    findStandableOutOfReach(bounds, 0.2, colliders, floor, { ...player, climb }, [0, 0], 1.3);

  it('finds nothing out of reach when the player can climb no more than a step', () => {
    const found = stand(player.stepHeight);
    expect(found.stoodOn).toBeGreaterThan(5000);
    expect(found.spots).toHaveLength(0);
  });

  it('finds the corner behind the barrels as soon as the player can jump onto them', () => {
    const found = stand(1.15);
    const patches = groupSafeSpots(found.spots, 0.2);
    expect(patches.length).toBeGreaterThan(0);
    expect(patches[0]!.x).toBeGreaterThan(5);
    expect(patches[0]!.z).toBeGreaterThan(5.5);
    expect(patches[0]!.deepest).toBeGreaterThan(2);
    // And more of the map was stood on: the tops of the barrels, and the floor behind them.
    expect(found.stoodOn).toBeGreaterThan(stand(player.stepHeight).stoodOn);
  });

  it('counts a low step as somewhere to stand, and a robot beside it as within reach', () => {
    // A plinth 0.3 m high in the middle of the floor: the player walks onto it, and so do the robots.
    const plinth = [makeCollider(3, -3, 1, 1, 0, 0, 0.3)];
    const floor = createNavGrid(bounds, 0.3, plinth, robot.radius, robot.stepHeight, robot.height, walkable, entries);
    const found = stand(player.stepHeight, plinth, floor);
    expect(found.spots).toHaveLength(0);
  });

  it('names the most awkward places still in reach, spread apart, for a robot to be sent to', () => {
    // (With jumping allowed, so that there are awkward places: up on the barrels, a robot's reach from the floor.)
    const found = stand(1.15);
    expect(found.hardest.length).toBeGreaterThan(0);
    for (const spot of found.hardest) expect(spot.gap).toBeLessThanOrEqual(1.3);
    for (const [i, a] of found.hardest.entries()) for (const b of found.hardest.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(5);
  });
});
