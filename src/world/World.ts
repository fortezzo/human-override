// The whole facility: six areas, the doors between them, and the things
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
import { buildDock } from './dock';
import { Door } from './Door';
import { buildHall } from './hall';
import { buildLab, type RobotParts } from './lab';
import { buildLobby } from './lobby';
import { MissionSet } from './MissionSet';
import { ShutterSet, type ShutterGate } from './Shutters';
import { StationSet } from './Stations';
import { AREA_BOXES, AREA_IDS, AREA_RECTS, DOOR_PLANS, ENTRY_PLANS, NAV_BOUNDS, WALKABLE, areaAt, type AreaId, type DoorPlan } from './plan';
import { buildPower } from './power';

export class World {
  readonly group = new THREE.Group();
  readonly areas = new Map<AreaId, AreaBuild>();
  readonly doors: Door[] = [];
  /** Every light on the map; the light rig decides which are live. */
  readonly lights: LightDef[] = [];
  /** Drifting dust, one cloud per area. */
  readonly dust = new Map<AreaId, DustMotes>();
  /** The parts of the map the mission moves: levers, the cage's gate, the keys. */
  readonly mission: MissionSet;
  /** The stations: the four boosts, the crate and the bench. */
  readonly stations: StationSet;
  /** The roller shutters over the openings robots walk in through. */
  readonly shutters: ShutterSet;
  /** Meshes that stop bullets (rooms, doors, shutters). */
  readonly solids: THREE.Mesh[] = [];
  /** Everything solid right now: the rooms, every door that is still shut, and every shutter that is down. */
  colliders: Collider[] = [];
  /**
   * The same without the shutters. Robots find their way as if every
   * shutter were open (their way in is through one, and when it is down
   * they walk up to it and batter it), so their map is made from this.
   */
  private navColliders: Collider[] = [];
  readonly nav: NavGrid;
  /** The area the player is in (the last one they were in, while crossing a doorway). */
  playerArea: AreaId = 'lobby';
  /** Called when a door has opened far enough to walk through. */
  onDoorPassable: (door: Door) => void = () => {};

  private readonly fixed: Collider[] = [];

  /** @param robots the robot types whose parts furnish the lab (left out, the lab's racks and jigs stand empty) */
  constructor(assets: Assets, materials: MaterialLibrary, robots?: RobotParts) {
    this.group.name = 'world';
    for (const area of [buildLobby(assets, materials), buildHall(assets, materials), buildPower(assets, materials), buildCore(assets, materials), buildDock(assets, materials), buildLab(assets, materials, robots)]) {
      this.areas.set(area.id, area);
      this.group.add(area.group);
      this.fixed.push(...area.colliders);
      this.solids.push(...area.solids);
      this.lights.push(...area.lights);
      for (const { effect } of area.haze) area.group.add(effect.mesh);
    }
    this.mission = new MissionSet(assets, materials);
    for (const id of AREA_IDS) this.areas.get(id)!.group.add(this.mission.groups[id]);
    this.group.add(this.mission.loose);
    this.lights.push(...this.mission.lights);
    this.stations = new StationSet(assets, materials);
    this.shutters = new ShutterSet(assets);
    for (const id of AREA_IDS) this.areas.get(id)!.group.add(this.stations.groups[id], this.shutters.groups[id]);
    this.fixed.push(...this.stations.colliders);
    this.solids.push(...this.stations.solids);
    this.lights.push(...this.stations.lights);
    for (const gate of this.shutters.gates) this.solids.push(...gate.solids);
    for (const plan of DOOR_PLANS) {
      const door = new Door(plan, assets, materials);
      this.doors.push(door);
      this.group.add(door.group);
      this.solids.push(...door.solids);
      this.fixed.push(...door.frame);
    }
    this.group.updateMatrixWorld(true);

    for (const id of AREA_IDS) {
      const box = AREA_BOXES[id];
      const motes = new DustMotes([box.x0, 0.1, box.z0], [box.x1, box.height - 0.4, box.z1], this.areas.get(id)!.dustBeams);
      this.dust.set(id, motes);
      this.areas.get(id)!.group.add(motes.points);
    }

    this.rebuildColliders();
    this.nav = createNavGrid(
      NAV_BOUNDS,
      0.3,
      this.navColliders,
      ROBOT.radius + 0.06,
      0.3,
      1.8,
      WALKABLE,
      ENTRY_PLANS.map((entry) => entry.at),
    );
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

  /** The map with every door open (for checks that ask what could ever be walked to). */
  get openColliders(): readonly Collider[] {
    return this.fixed;
  }

  private rebuildColliders(): void {
    this.navColliders = this.fixed.concat(this.doors.filter((d) => !d.passable).map((d) => d.collider));
    this.colliders = this.navColliders.concat(this.shutters.colliders);
  }

  // --------------------------------------------------------------- shutters

  /** A shutter has been forced or run back down: what is solid has changed. */
  shuttersChanged(): void {
    this.rebuildColliders();
  }

  /**
   * The shutter the player could repair from where they stand: one in
   * their own area, within `range` metres, that they are indoors of (and
   * clear of the opening itself, so that it cannot come down on them).
   */
  shutterInReach(position: THREE.Vector3, range: number): ShutterGate | null {
    let best: ShutterGate | null = null;
    let nearest = range;
    for (const gate of this.shutters.gates) {
      if (gate.plan.area !== this.playerArea) continue;
      const { inside, along } = gate.where(position.x, position.z);
      const half = (gate.plan.to - gate.plan.from) / 2;
      const distance = Math.hypot(inside, Math.max(0, Math.abs(along) - half));
      if (inside > 0.75 && distance < nearest) {
        nearest = distance;
        best = gate;
      }
    }
    return best;
  }

  /** True if someone at (x, z) is outside a shutter or under it: running it down now would shut them out. */
  wouldShutOut(gate: ShutterGate, x: number, z: number): boolean {
    const { inside, along } = gate.where(x, z);
    const half = (gate.plan.to - gate.plan.from) / 2;
    return inside < 0.75 && inside > -30 && Math.abs(along) < half + 9;
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
        refreshRegion(this.nav, door.rect, this.navColliders);
        this.onDoorPassable(door);
      }
    }
    for (const area of this.areas.values()) if (area.group.visible) area.tick?.(time);
    this.mission.update(dt, time);
    this.stations.update(dt, time);
    this.shutters.update(dt);
  }

  /** Shut every door and put the player back in the lobby (a new run). */
  reset(): void {
    for (const door of this.doors) door.reset();
    this.shutters.reset();
    this.stations.reset();
    this.rebuildColliders();
    for (const door of this.doors) refreshRegion(this.nav, door.rect, this.navColliders);
    this.playerArea = 'lobby';
    this.refreshVisibility();
    this.mission.reset();
  }
}
