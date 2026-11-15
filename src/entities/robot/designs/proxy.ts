// The Proxy: the body ARGUS keeps for itself, sent in for the final stand.
//
// The labor frame's skeleton and body (see drudge.ts) built half as big
// again, wider across the shoulders, and finished in black: no hazard
// paint, no rust, nothing left of the machine it was copied from. Its
// seams are lit red from inside, a row of small red eyes sits over the
// visor, and two masts rise from its shoulders.
//
// Built from the same model with different scale, plating, accents and eye
// colour, so it needs no assets of its own.

import { PAINT, type RobotDesign } from '../kit/design';
import type { Paint, RobotBuilder } from '../kit/RobotBuilder';
import type { Rig } from '../kit/Rig';
import { box, tube, vec, type Vec } from '../../../render/shapes';
import { DRUDGE } from './drudge';

/** Black plating, cleaner and a little glossier than anything else in the building. */
const BLACK: Paint = { color: [0.0105, 0.0105, 0.012], metal: 0.75, rough: -0.06, grime: 0.04 };
const BLACK_WORN: Paint = { color: [0.011, 0.011, 0.0125], metal: 0.75, rough: -0.02, grime: 0.07 };
/** Where the labor frame wears hazard paint, this one wears oxblood. */
const OXBLOOD: Paint = { color: [0.13, 0.011, 0.008], metal: 0.3, rough: 0.05, grime: 0.06 };

const FINISH = new Map<Paint, Paint>([
  [PAINT.armor, BLACK],
  [PAINT.armorWorn, BLACK_WORN],
  [PAINT.hazard, OXBLOOD],
]);

/** The standard head is modelled at one size and enlarged about the neck joint; so are the parts added to it here. */
const HEAD_SIZE = 1.14;

const from =
  (origin: Vec, scale = 1) =>
  (x: number, y: number, z: number): Vec =>
    origin.clone().add(vec(x * scale, y * scale, z * scale));

function fittings(rig: Rig, b: RobotBuilder): void {
  const c = from(rig.at('Spine2'));
  const a = from(rig.at('LeftArm'));
  const h = from(rig.at('Head'), HEAD_SIZE);

  // A row of small eyes across the brow, over the visor.
  for (let i = 0; i < 5; i++) {
    b.add(box(h(-0.06 + i * 0.03, 0.127, 0.118), vec(0.012 * HEAD_SIZE, 0.012 * HEAD_SIZE, 0.004)), { bone: 'Head', glow: 1 });
  }

  // Seams lit from inside: down each chest plate, and down the spine of the power pack.
  b.add(box(c(0.045, 0.045, 0.166), vec(0.006, 0.17, 0.004)), { bone: 'Spine2', glow: 0.75, mirror: true });
  b.add(box(c(0, 0.075, -0.272), vec(0.016, 0.19, 0.004)), { bone: 'Spine2', glow: 0.8 });
  b.add(box(c(0.142, 0.0, 0.03), vec(0.004, 0.12, 0.006)), { bone: 'Spine2', glow: 0.5, mirror: true });

  // A mast on each shoulder, raked back.
  const foot = a(0.03, 0.105, -0.02);
  const tip = a(0.0, 0.34, -0.11);
  b.add(box(foot, vec(0.06, 0.03, 0.06), 0.008), { bone: 'LeftArm', paint: PAINT.frame, mirror: true });
  b.add(tube(foot, tip, 0.02, 0.005, 8), { bone: 'LeftArm', paint: PAINT.frame, mirror: true });
  b.add(box(tip, vec(0.012, 0.012, 0.012), 0.003), { bone: 'LeftArm', glow: 0.9, mirror: true });
}

export const PROXY: RobotDesign = {
  ...DRUDGE,
  proportions: { ...DRUDGE.proportions, shoulders: 1.5, hips: 1.3, upperArm: 1.08, forearm: 1.3, neck: 0.62 },
  scale: 1.48,
  eyeColor: 0xff1e0c,
  build(rig, builder) {
    builder.repaint = (paint) => FINISH.get(paint) ?? paint;
    DRUDGE.build(rig, builder);
    builder.repaint = null;
    fittings(rig, builder);
  },
};
