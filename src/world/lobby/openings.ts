// Everything that fills a hole in the lobby's walls: the breached main
// entrance with its entry corridor and the yard outside, and the two west
// windows. The frames of the blast door to the server hall and of the power
// room door are drawn here too, but they are built with the doors
// themselves (see world/doorFrames.ts), so that they are there from
// whichever side a door is seen.

import * as THREE from 'three';
import type { LevelBuilder } from '../build/LevelBuilder';
import { DOCK } from '../plan';
import { BLAST_DOOR, BREACH, POWER_DOOR, ROOM, VESTIBULE, WINDOW, WINDOWS, YARD_CONTAINER } from './plan';

const HALF_PI = Math.PI / 2;

/** The main entrance: a steel portal with its roller shutter jammed half open. */
function buildBreach(b: LevelBuilder): void {
  const { z0, wall: t } = ROOM;
  const { x0, x1, top } = BREACH;
  const front = z0 + 0.07; // how far the frame stands proud of the wall
  const back = z0 - t - 0.07;

  // Portal frame. It overlaps the opening slightly so no two surfaces are
  // ever exactly flush (which would shimmer).
  b.box('steelPlate', [x0 - 0.3, 0, back], [x0 + 0.07, top, front]);
  b.box('steelPlate', [x1 - 0.07, 0, back], [x1 + 0.3, top, front]);
  b.box('steelPlate', [x0 - 0.3, top - 0.07, back], [x1 + 0.3, top + 0.34, front], { collide: false });
  // Hazard-striped guards on the room side of each jamb.
  b.box('hazard', [x0 - 0.3, 0, front], [x0 + 0.07, 2.1, front + 0.015], { collide: false, cast: false });
  b.box('hazard', [x1 - 0.07, 0, front], [x1 + 0.3, 2.1, front + 0.015], { collide: false, cast: false });
  // Tread-plate threshold.
  b.box('treadPlate', [x0 + 0.07, 0, z0 - t - 0.05], [x1 - 0.07, 0.012, z0 + 0.05], { collide: false, cast: false });

  // (The shutter itself is a moving part: see world/Shutters.ts.)
  // Guide rails the shutter runs in.
  b.box('darkSteel', [x0 + 0.07, 0, z0 - 0.4], [x0 + 0.13, top, z0 - 0.14], { collide: false });
  b.box('darkSteel', [x1 - 0.13, 0, z0 - 0.4], [x1 - 0.07, top, z0 - 0.14], { collide: false });
}

/** The entry corridor behind the breach and the open yard beyond it. */
function buildVestibule(b: LevelBuilder): void {
  const { z0, wall: t, x0: rx0, x1: rx1 } = ROOM;
  const v = VESTIBULE;
  const zIn = z0 - t; // where the corridor meets the lobby wall

  b.box('floor', [v.x0 - 0.5, -0.4, v.z0 - 0.5], [v.x1 + 0.5, 0, zIn], { collide: false, cast: false });
  b.box('concreteDark', [v.x0 - 0.5, 0, v.z0], [v.x0, v.height, zIn]);
  b.box('concreteDark', [v.x1, 0, v.z0], [v.x1 + 0.5, v.height, zIn]);
  b.box('concreteDark', [v.x0 - 0.5, v.height, v.z0 - 0.5], [v.x1 + 0.5, v.height + 0.4, zIn], { collide: false });

  // Outer wall with the doorway to the yard.
  b.box('concreteDark', [v.x0 - 0.5, 0, v.z0 - 0.5], [BREACH.x0, v.height, v.z0]);
  b.box('concreteDark', [BREACH.x1, 0, v.z0 - 0.5], [v.x1 + 0.5, v.height, v.z0]);
  b.box('concreteDark', [BREACH.x0, v.doorTop, v.z0 - 0.5], [BREACH.x1, v.height, v.z0], { collide: false });
  b.box('steelPlate', [BREACH.x0 - 0.05, 0, v.z0 - 0.56], [BREACH.x0 + 0.12, v.doorTop, v.z0 + 0.06], { collide: false });
  b.box('steelPlate', [BREACH.x1 - 0.12, 0, v.z0 - 0.56], [BREACH.x1 + 0.05, v.doorTop, v.z0 + 0.06], { collide: false });
  b.box('steelPlate', [BREACH.x0 - 0.05, v.doorTop - 0.1, v.z0 - 0.56], [BREACH.x1 + 0.05, v.doorTop + 0.08, v.z0 + 0.06], { collide: false });

  // Conduits and a dead strip light along the corridor.
  b.tube('darkSteel', [v.x0 + 0.06, 2.9, v.z0], [v.x0 + 0.06, 2.9, zIn], 0.03, false);
  b.tube('darkSteel', [v.x0 + 0.06, 2.78, v.z0], [v.x0 + 0.06, 2.78, zIn], 0.02, false);
  b.tube('rustedSteel', [v.x1 - 0.1, 3.1, v.z0], [v.x1 - 0.1, 3.1, zIn], 0.07, false);
  b.prop('mounted_fluorescent_lights', { part: 'd', at: [0, v.height, -10.1], collide: false, cast: false });

  // The building's outer face either side of the corridor, and the yard.
  // (To the west it runs on past the end of the loading dock, which stands
  // out beyond the lobby on that side: nothing behind this face is drawn
  // unless its own doors are open, and from the far end of the yard the
  // gap where the dock should be could be seen round a shorter one.)
  b.box('wall', [DOCK.x0 - 3, 0, v.z0 - 0.5], [v.x0 - 0.5, 8.4, zIn], { cast: false });
  b.box('wall', [v.x1 + 0.5, 0, v.z0 - 0.5], [rx1 + 8, 8, zIn], { cast: false });
  b.box('floor', [rx0 - 8, -0.4, -40], [rx1 + 8, 0, v.z0 - 0.5], { collide: false, cast: false });
  // West yard, seen through the windows.
  b.box('floor', [rx0 - 26, -0.4, zIn], [rx0 - 0.5, -0.02, ROOM.z1 + 8], { collide: false, cast: false });
  // And across the south side of it, the north face of the loading dock:
  // its plinth of bare concrete and the steel cladding above. The dock is
  // a room of its own and is only drawn while its doors are open, and then
  // only from inside (its walls face inward); without this, someone at the
  // open window looked either at open country where a building should
  // be, or straight into the dock through its missing outside wall.
  const face = DOCK.z0 - 0.06;
  b.box('concreteDark', [DOCK.x0 - 3, 0, face - 0.3], [rx0 - t, 2.3, face], { collide: false, cast: false });
  b.box('wallDock', [DOCK.x0 - 3, 2.3, face - 0.24], [rx0 - t, DOCK.height + 0.9, face], { collide: false, cast: false });
  b.box('darkSteel', [DOCK.x0 - 3, 2.24, face - 0.34], [rx0 - t, 2.36, face], { collide: false, cast: false });
  // Two bulkhead lamps on it, the colour of the dock's own. (When the dock
  // is open its lamps reach through to the ground out here, there being no
  // shadow to stop them, and these are what that light appears to come from.)
  for (const x of [-15.5, -23.5]) {
    b.box('darkSteel', [x - 0.34, 4.0, face - 0.42], [x + 0.34, 4.3, face - 0.3], { collide: false, cast: false });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffa24a, emissiveIntensity: 5, roughness: 0.4 }));
    lamp.position.set(x, 4.02, face - 0.46);
    b.addObject(lamp);
  }

  // The yard is fenced in with road barriers (and sealed behind them), so
  // nobody wanders off into the dark: robots arrive across it, and the
  // player can step out a little way but no further.
  for (let x = -5; x <= 5; x += 2) b.prop('concrete_road_barrier', { at: [x, 0, -19.7], rotY: 0, kind: 'concrete' });
  for (const z of [-18.2, -15.9, -13.7]) {
    b.prop('concrete_road_barrier', { at: [-6.2, 0, z], rotY: HALF_PI, kind: 'concrete' });
    b.prop('concrete_road_barrier', { at: [6.2, 0, z], rotY: HALF_PI, kind: 'concrete' });
  }
  b.blocker([-6.6, 0, -20.6], [-6, 3, -12.6]);
  b.blocker([6, 0, -20.6], [6.6, 3, -12.6]);
  b.blocker([-6.6, 0, -20.6], [6.6, 3, -20]);

  // A shipping container against the east side of the yard. Robots appear
  // in the gap behind it and come out round its near end (see plan.ts).
  const c = YARD_CONTAINER;
  b.box('rustedSteel', [c.x0, 0, c.z0], [c.x1, c.height, c.z1]);
  for (const y of [0.3, c.height - 0.42]) b.box('darkSteel', [c.x0 - 0.04, y, c.z0 - 0.04], [c.x1 + 0.04, y + 0.12, c.z1 + 0.04], { collide: false, cast: false });
  // Its doors, at the end facing the building: two leaves and their lock rods.
  const cx = (c.x0 + c.x1) / 2;
  b.box('darkSteel', [cx - 0.015, 0.1, c.z1], [cx + 0.015, c.height - 0.1, c.z1 + 0.03], { collide: false, cast: false });
  for (const dx of [-0.42, -0.2, 0.2, 0.42]) b.tube('darkSteel', [cx + dx, 0.12, c.z1 + 0.035], [cx + dx, c.height - 0.12, c.z1 + 0.035], 0.018, false);

  // Wreckage in the entry.
  b.prop('concrete_road_barrier', { at: [1.25, 0, -10.6], rotY: 1.15, kind: 'concrete' });
  b.prop('concrete_road_barrier', { at: [-3.4, 0, -15.2], rotY: 0.3, kind: 'concrete' });
  b.prop('concrete_road_barrier', { at: [1.5, 0, -17.3], rotY: -0.5, kind: 'concrete' });
  b.prop('Barrel_01', { at: [-2.2, 0.29, -9.1], rot: [HALF_PI, 0.7, 0] });
}

/** West windows: steel frame, security bars and a roller shutter each. */
function buildWindows(b: LevelBuilder): void {
  const { x0, wall: t } = ROOM;
  const { halfWidth: hw, sill, head } = WINDOW;

  for (const win of WINDOWS) {
    const za = win.z - hw;
    const zb = win.z + hw;
    // Frame lining the opening.
    b.box('steelPlate', [x0 - t - 0.04, sill - 0.05, za - 0.05], [x0 + 0.05, sill + 0.03, zb + 0.05], { collide: false });
    b.box('steelPlate', [x0 - t - 0.04, head - 0.03, za - 0.05], [x0 + 0.05, head + 0.05, zb + 0.05], { collide: false });
    b.box('steelPlate', [x0 - t - 0.04, sill, za - 0.05], [x0 + 0.05, head, za + 0.03], { collide: false });
    b.box('steelPlate', [x0 - t - 0.04, sill, zb - 0.03], [x0 + 0.05, head, zb + 0.05], { collide: false });

    if (win.open) {
      // Bars torn away in the middle; shutter jammed most of the way up.
      for (const dz of [-0.92, -0.7, 0.72, 0.94]) {
        b.tube('darkSteel', [x0 - t + 0.08, sill, win.z + dz], [x0 - t + 0.08, head, win.z + dz], 0.016);
      }
      b.tube('darkSteel', [x0 - t + 0.08, head, win.z - 0.45], [x0 - t - 0.3, head - 0.75, win.z - 0.3], 0.016);
      b.tube('darkSteel', [x0 - t + 0.08, head, win.z + 0.42], [x0 - 0.1, head - 0.5, win.z + 0.3], 0.016);
      b.prop('rollershutter_window_01', { at: [x0 - 0.36, sill + 1.12, win.z], rot: [0, HALF_PI, -0.06], scale: [1.05, 1, 1], collide: false });
    } else {
      b.prop('rollershutter_window_01', { at: [x0 - 0.36, sill, win.z], rotY: HALF_PI, scale: [1.05, 1, 1], collide: false });
      b.blocker([x0 - t, sill, za], [x0, head, zb]);
    }
  }
}

/**
 * The steel portal the blast door to the server hall slides in. (The door's
 * two leaves are moving parts, built in world/Door.ts.)
 */
export function buildBlastDoorFrame(b: LevelBuilder): void {
  const { z1, wall: t } = ROOM;
  const { x0, x1, top } = BLAST_DOOR;

  // Portal frame standing proud of the wall on both sides, and the track housing above.
  b.box('steelPlate', [x0 - 0.34, 0, z1 - 0.1], [x0 + 0.06, top, z1 + t + 0.08]);
  b.box('steelPlate', [x1 - 0.06, 0, z1 - 0.1], [x1 + 0.34, top, z1 + t + 0.08]);
  b.box('steelPlate', [x0 - 0.34, top - 0.06, z1 - 0.16], [x1 + 0.34, top + 0.42, z1 + t + 0.14], { collide: false });
  b.box('treadPlate', [x0, 0, z1 - 0.06], [x1, 0.012, z1 + t + 0.06], { collide: false, cast: false });
  // Bolt heads along the frame.
  for (let y = 0.35; y < top; y += 0.55) {
    for (const x of [x0 - 0.14, x1 + 0.14]) {
      b.tube('darkSteel', [x, y, z1 - 0.13], [x, y, z1 - 0.1], 0.03, false);
    }
  }
}

/** The frame of the personnel door to the power room. (The door itself is in world/Door.ts.) */
export function buildPowerDoorFrame(b: LevelBuilder): void {
  const { x1, wall: t } = ROOM;
  const { z0, z1, top } = POWER_DOOR;
  b.box('steelPlate', [x1 - 0.07, 0, z0 - 0.14], [x1 + t + 0.07, top, z0 + 0.04]);
  b.box('steelPlate', [x1 - 0.07, 0, z1 - 0.04], [x1 + t + 0.07, top, z1 + 0.14]);
  b.box('steelPlate', [x1 - 0.07, top - 0.04, z0 - 0.14], [x1 + t + 0.07, top + 0.16, z1 + 0.14], { collide: false });
  b.box('treadPlate', [x1 - 0.05, 0, z0], [x1 + t + 0.05, 0.012, z1], { collide: false, cast: false });
}

export function buildOpenings(b: LevelBuilder): void {
  buildBreach(b);
  buildVestibule(b);
  buildWindows(b);
}
