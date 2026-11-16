// The Bomber: a labor frame with a demolition charge strapped to it.
//
// It is the Drudge's skeleton and body (see drudge.ts), a little smaller,
// with a yellow charge slung across its chest, a second on its back, and a
// detonator between them. Its lights are amber, and they pulse faster and
// faster once it has primed. It runs at the player and goes off; shot
// first, it goes off where it stands, among its own.
//
// Built from the same model with a different size, fittings and eye
// colour, so it needs no assets of its own.

import { PAINT, type RobotDesign } from '../kit/design';
import type { Paint, RobotBuilder } from '../kit/RobotBuilder';
import type { Rig } from '../kit/Rig';
import { box, tube, vec, type Vec } from '../../../render/shapes';
import { DRUDGE } from './drudge';

/** The charge's casing: demolition yellow, scuffed. */
const CASING: Paint = { color: [0.42, 0.29, 0.02], metal: 0.15, rough: 0.12, grime: 0.22 };
/** Its plating is the plant's own, dulled: nobody repainted it for this job. */
const DULL: Paint = { color: [0.05, 0.047, 0.04], metal: 0.4, rough: 0.12, grime: 0.3 };

const FINISH = new Map<Paint, Paint>([[PAINT.armor, DULL]]);

const from =
  (origin: Vec) =>
  (x: number, y: number, z: number): Vec =>
    origin.clone().add(vec(x, y, z));

function charge(rig: Rig, b: RobotBuilder): void {
  const c = from(rig.at('Spine2'));

  // The main charge: a drum across the chest, capped at both ends, held by two straps.
  b.add(tube(c(-0.17, 0.035, 0.215), c(0.17, 0.035, 0.215), 0.082, 0.082, 14), { bone: 'Spine2', paint: CASING });
  b.add(tube(c(0.17, 0.035, 0.215), c(0.195, 0.035, 0.215), 0.082, 0.06, 14), { bone: 'Spine2', paint: PAINT.frame, mirror: true });
  for (const x of [-0.09, 0.09]) b.add(box(c(x, 0.035, 0.2), vec(0.028, 0.19, 0.2), 0.008), { bone: 'Spine2', paint: PAINT.frame });
  // A lit band round the middle of it, and black hazard bars either side.
  b.add(tube(c(-0.012, 0.035, 0.215), c(0.012, 0.035, 0.215), 0.086, 0.086, 14, 'none'), { bone: 'Spine2', glow: 1 });
  for (const x of [-0.14, -0.05, 0.05, 0.14]) b.add(tube(c(x - 0.012, 0.035, 0.215), c(x + 0.012, 0.035, 0.215), 0.0835, 0.0835, 14, 'none'), { bone: 'Spine2', paint: PAINT.rubber });

  // The detonator on top of the drum: a box with a lamp and a whip aerial.
  b.add(box(c(0, 0.135, 0.2), vec(0.09, 0.05, 0.07), 0.008), { bone: 'Spine2', paint: PAINT.frame });
  b.add(box(c(0, 0.166, 0.2), vec(0.04, 0.014, 0.04), 0.004), { bone: 'Spine2', glow: 1 });
  b.add(tube(c(0.03, 0.16, 0.185), c(0.05, 0.36, 0.15), 0.004, 0.002, 6), { bone: 'Spine2', paint: PAINT.rod });

  // Two smaller cylinders upright on the back, outboard of the power pack, each with a lit cap.
  for (const x of [-0.19, 0.19]) {
    b.add(tube(c(x, -0.05, -0.17), c(x, 0.2, -0.17), 0.048, 0.048, 12), { bone: 'Spine2', paint: CASING });
    b.add(tube(c(x, 0.2, -0.17), c(x, 0.222, -0.17), 0.048, 0.03, 12), { bone: 'Spine2', paint: PAINT.frame });
    b.add(tube(c(x, 0.07, -0.17), c(x, 0.09, -0.17), 0.051, 0.051, 12, 'none'), { bone: 'Spine2', glow: 0.9 });
  }
  // The wire from the detonator over the shoulder to the back.
  b.add(tube(c(0.04, 0.15, 0.17), c(0.15, 0.22, -0.02), 0.007, 0.007, 6), { bone: 'Spine2', paint: PAINT.rubber });
  b.add(tube(c(0.15, 0.22, -0.02), c(0.19, 0.2, -0.16), 0.007, 0.007, 6), { bone: 'Spine2', paint: PAINT.rubber });
}

export const BOMBER: RobotDesign = {
  ...DRUDGE,
  // It runs bent well forward, the charge leading.
  posture: [
    { bone: 'Spine1', forward: 9 },
    { bone: 'Spine2', forward: 9 },
    { bone: 'Neck', forward: -10 },
    { bone: 'Head', forward: -12 },
  ],
  scale: 0.98,
  eyeColor: 0xffc21f,
  build(rig, builder) {
    builder.repaint = (paint) => FINISH.get(paint) ?? paint;
    DRUDGE.build(rig, builder);
    builder.repaint = null;
    charge(rig, builder);
  },
};
