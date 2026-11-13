// Everything that fills a hole in the lobby's walls: the breached main
// entrance with its entry corridor and the yard outside, the two west
// windows, the blast door to the server hall and the power room door.

import type { LevelBuilder } from '../build/LevelBuilder';
import { BLAST_DOOR, BREACH, POWER_DOOR, ROOM, VESTIBULE, WINDOW, WINDOWS } from './plan';

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

  // The shutter: stretched to span the entrance, stuck part-way up and
  // knocked crooked. Its top half is hidden inside the wall above.
  b.prop('rollershutter_door', { at: [0, 2.08, z0 - 0.42], scale: [3.42, 1.2, 1], rot: [0, 0, 0.045], collide: false });
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
  b.box('wall', [rx0 - 8, 0, v.z0 - 0.5], [v.x0 - 0.5, 8, zIn], { cast: false });
  b.box('wall', [v.x1 + 0.5, 0, v.z0 - 0.5], [rx1 + 8, 8, zIn], { cast: false });
  b.box('floor', [rx0 - 8, -0.4, -40], [rx1 + 8, 0, v.z0 - 0.5], { collide: false, cast: false });
  // West yard, seen through the windows.
  b.box('floor', [rx0 - 26, -0.4, zIn], [rx0 - 0.5, -0.02, ROOM.z1 + 8], { collide: false, cast: false });

  // Wreckage in the entry.
  b.prop('concrete_road_barrier', { at: [1.25, 0, -10.6], rotY: 1.15, kind: 'concrete' });
  b.prop('concrete_road_barrier', { at: [-3.4, 0, -15.2], rotY: 0.3, kind: 'concrete' });
  b.prop('concrete_road_barrier', { at: [3.9, 0, -16.4], rotY: -0.5, kind: 'concrete' });
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

/** Blast door to the server hall: two heavy sliding leaves in a steel portal. */
function buildBlastDoor(b: LevelBuilder): void {
  const { z1 } = ROOM;
  const { x0, x1, top } = BLAST_DOOR;
  const face = z1 + 0.16;

  // Leaves, with a hairline gap where they meet.
  b.box('steelPlate', [x0, 0, face], [-0.012, top, face + 0.24]);
  b.box('steelPlate', [0.012, 0, face], [x1, top, face + 0.24]);
  // Hazard bands along the meeting edges and the foot of the door.
  b.box('hazard', [-0.36, 0, face - 0.012], [-0.012, top, face], { collide: false, cast: false });
  b.box('hazard', [0.012, 0, face - 0.012], [0.36, top, face], { collide: false, cast: false });
  b.box('hazard', [x0, 0, face - 0.012], [-0.36, 0.34, face], { collide: false, cast: false });
  b.box('hazard', [0.36, 0, face - 0.012], [x1, 0.34, face], { collide: false, cast: false });
  // Stiffening ribs and lock housings.
  for (const y of [1.0, 1.95, 2.75]) {
    b.box('darkSteel', [x0, y, face - 0.05], [-0.4, y + 0.09, face], { collide: false });
    b.box('darkSteel', [0.4, y, face - 0.05], [x1, y + 0.09, face], { collide: false });
  }
  b.box('darkSteel', [-0.3, 1.3, face - 0.09], [0.3, 1.72, face - 0.012], { collide: false });
  b.tube('rustedSteel', [-0.19, 1.51, face - 0.13], [-0.19, 1.51, face - 0.09], 0.085);
  b.tube('rustedSteel', [0.19, 1.51, face - 0.13], [0.19, 1.51, face - 0.09], 0.085);

  // Portal frame standing proud of the wall, and the track housing above.
  b.box('steelPlate', [x0 - 0.34, 0, z1 - 0.1], [x0 + 0.06, top, z1 + 0.5]);
  b.box('steelPlate', [x1 - 0.06, 0, z1 - 0.1], [x1 + 0.34, top, z1 + 0.5]);
  b.box('steelPlate', [x0 - 0.34, top - 0.06, z1 - 0.16], [x1 + 0.34, top + 0.42, z1 + 0.5], { collide: false });
  b.box('treadPlate', [x0, 0, z1 - 0.06], [x1, 0.012, z1 + 0.16], { collide: false, cast: false });
  // Bolt heads along the frame.
  for (let y = 0.35; y < top; y += 0.55) {
    for (const x of [x0 - 0.14, x1 + 0.14]) {
      b.tube('darkSteel', [x, y, z1 - 0.13], [x, y, z1 - 0.1], 0.03, false);
    }
  }
}

/** Personnel door to the power room. */
function buildPowerDoor(b: LevelBuilder): void {
  const { x1 } = ROOM;
  const { z0, z1, top } = POWER_DOOR;
  const face = x1 + 0.14;

  b.box('paintedMetal', [face, 0, z0], [face + 0.1, top, z1]);
  b.box('hazard', [face - 0.012, 0.9, z0], [face, 1.2, z1], { collide: false, cast: false });
  b.box('darkSteel', [face - 0.05, 0, z0], [face, 0.28, z1], { collide: false });
  // Handle and small vision slot.
  b.box('darkSteel', [face - 0.07, 1.0, z0 + 0.14], [face - 0.012, 1.1, z0 + 0.42], { collide: false });
  b.box('darkSteel', [face - 0.02, 1.55, (z0 + z1) / 2 - 0.2], [face, 1.85, (z0 + z1) / 2 + 0.2], { collide: false, cast: false });
  // Frame.
  b.box('steelPlate', [x1 - 0.07, 0, z0 - 0.14], [x1 + 0.3, top, z0 + 0.04]);
  b.box('steelPlate', [x1 - 0.07, 0, z1 - 0.04], [x1 + 0.3, top, z1 + 0.14]);
  b.box('steelPlate', [x1 - 0.07, top - 0.04, z0 - 0.14], [x1 + 0.3, top + 0.16, z1 + 0.14], { collide: false });
}

export function buildOpenings(b: LevelBuilder): void {
  buildBreach(b);
  buildVestibule(b);
  buildWindows(b);
  buildBlastDoor(b);
  buildPowerDoor(b);
}
