// The whole facility: four areas, the doors between them, and the things
// that depend on which doors are open: what is solid, where robots can
// walk, which areas can be seen, and where robots are let in.

import * as THREE from 'three';
import { ROBOT } from '../config';
import type { Assets } from '../core/assets';
import { DustMotes } from '../render/atmosphere';
import type { LightDef } from '../render/lighting';
import type { MaterialLibrary } from '../render/materials';
import type { Collider } from '../sim/collision';
import { neighbours, reachableAreas, type DoorLink } from '../sim/facility';
import { createNavGrid, refreshRegion, type NavGrid } from '../sim/navGrid';
import type { AreaBuild } from './build/room';
import { buildCore } from './core';
import { Door } from './Door';
import { buildHall } from './hall';
import { buildLobby } from './lobby';
import { AREA_IDS, AREA_RECTS, CORE, DOOR_PLANS, HALL, LOBBY, NAV_BOUNDS, POWER, WALKABLE, areaAt, type AreaId, type DoorPlan } from './plan';
import { buildPower } from './power';

export class World {
  readonly group = new THREE.Group();
  readonly areas = new Map<AreaId, AreaBuild>();
  readonly doors: Door[] = [];
  /** Every light on the map; the light rig decides which are live. */
  readonly lights: LightDef[] = [];
  /** Drifting dust, one cloud per area. */
  readonly dust = new Map<AreaId, DustMotes>();
  /** Meshes that stop bullets (rooms and doors). */
  readonly solids: THREE.Mesh[] = [];
  /** Everything solid right now: the rooms, plus every door that is still shut. */
  colliders: Collider[] = [];
  readonly nav: NavGrid;
  /** The area the player is in (the last one they were in, while crossing a doorway). */
  playerArea: AreaId = 'lobby';
  /** Called when a door has opened far enough to walk through. */
  onDoorPassable: (door: Door) => void = () => {};

  private readonly fixed: Collider[] = [];

  constructor(assets: Assets, materials: MaterialLibrary) {
    this.group.name = 'world';
    for (const area of [buildLobby(assets, materials), buildHall(assets, materials), buildPower(assets, materials), buildCore(assets, materials)]) {
      this.areas.set(area.id, area);
      this.group.add(area.group);
      this.fixed.push(...area.colliders);
      this.solids.push(...area.solids);
      this.lights.push(...area.lights);
      for (const { effect } of area.haze) area.group.add(effect.mesh);
    }
    for (const plan of DOOR_PLANS) {
      const door = new Door(plan, assets, materials);
      this.doors.push(door);
      this.group.add(door.group);
      this.solids.push(...door.solids);
    }
    this.group.updateMatrixWorld(true);

    const boxes: Record<AreaId, { x0: number; x1: number; z0: number; z1: number; height: number }> = { lobby: { ...LOBBY, z0: LOBBY.z0 - 6 }, hall: HALL, power: POWER, core: CORE };
    for (const id of AREA_IDS) {
      const box = boxes[id];
      const motes = new DustMotes([box.x0, 0.1, box.z0], [box.x1, box.height - 0.4, box.z1], this.areas.get(id)!.dustBeams);
      this.dust.set(id, motes);
      this.areas.get(id)!.group.add(motes.points);
    }

    this.rebuildColliders();
    this.nav = createNavGrid(NAV_BOUNDS, 0.3, this.colliders, ROBOT.radius + 0.06, 0.3, 1.8, WALKABLE);
    this.refreshVisibility();
  }

  // ------------------------------------------------------------------ doors

  door(id: DoorPlan['id']): Door {
    return this.doors.find((d) => d.plan.id === id)!;
  }

  /** The doors as the rules see them: which two areas each joins, and whether it is open. */
  get links(): Array<DoorLink<AreaId>> {
    return this.doors.map((d) => ({ id: d.plan.id, a: d.plan.a, b: d.plan.b, open: d.open }));
  }

  /** Areas the player can be reached from on foot. */
  get reachable(): Set<AreaId> {
    return reachableAreas(this.playerArea, this.links);
  }

  /** Start a door sliding open. */
  openDoor(id: DoorPlan['id']): void {
    const door = this.door(id);
    if (door.open) return;
    door.unlock();
    this.refreshVisibility();
  }

  /** The closest shut door within `range` of a point, or null. */
  nearestShutDoor(position: THREE.Vector3, range: number): Door | null {
    let best: Door | null = null;
    let bestDistance = range;
    for (const door of this.doors) {
      if (door.open) continue;
      const distance = Math.hypot(position.x - door.centre.x, position.z - door.centre.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = door;
      }
    }
    return best;
  }

  private rebuildColliders(): void {
    this.colliders = this.fixed.concat(this.doors.filter((d) => !d.passable).map((d) => d.collider));
  }

  // ------------------------------------------------------------- visibility

  /**
   * How much each area matters to what the player can see: 1 for the area
   * they are in, less for areas through an open door. Areas not listed
   * cannot be seen at all.
   */
  get visible(): Map<AreaId, number> {
    const weights = new Map<AreaId, number>([[this.playerArea, 1]]);
    const links = this.links;
    for (const door of links) {
      if (!door.open) continue;
      const other = door.a === this.playerArea ? door.b : door.b === this.playerArea ? door.a : null;
      if (other) weights.set(other, 0.55);
    }
    // Two doors in a line can be seen through: keep those areas drawn, faintly lit.
    for (const [area] of [...weights]) {
      if (area === this.playerArea) continue;
      for (const next of neighbours(area, links.filter((d) => d.open))) if (!weights.has(next)) weights.set(next, 0.2);
    }
    return weights;
  }

  private refreshVisibility(): void {
    const visible = this.visible;
    for (const [id, area] of this.areas) area.group.visible = visible.has(id);
  }

  /** Tell the world where the player is. Returns true if they have entered a different area. */
  track(x: number, z: number): boolean {
    const area = areaAt(x, z);
    if (!area || area === this.playerArea) return false;
    this.playerArea = area;
    this.refreshVisibility();
    return true;
  }

  /** Which area a point belongs to, falling back to the nearest one by rectangle. */
  areaOf(x: number, z: number): AreaId {
    const exact = areaAt(x, z);
    if (exact) return exact;
    let best: AreaId = 'lobby';
    let bestDistance = Infinity;
    for (const id of AREA_IDS) {
      const [x0, z0, x1, z1] = AREA_RECTS[id];
      const dx = Math.max(x0 - x, 0, x - x1);
      const dz = Math.max(z0 - z, 0, z - z1);
      const distance = Math.hypot(dx, dz);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = id;
      }
    }
    return best;
  }

  // ----------------------------------------------------------------- update

  update(dt: number, time: number): void {
    for (const door of this.doors) {
      if (door.update(dt)) {
        this.rebuildColliders();
        refreshRegion(this.nav, door.rect, this.colliders);
        this.onDoorPassable(door);
      }
    }
    for (const area of this.areas.values()) if (area.group.visible) area.tick?.(time);
  }

  /** Shut every door and put the player back in the lobby (a new run). */
  reset(): void {
    for (const door of this.doors) door.reset();
    this.rebuildColliders();
    for (const door of this.doors) refreshRegion(this.nav, door.rect, this.colliders);
    this.playerArea = 'lobby';
    this.refreshVisibility();
  }
}
