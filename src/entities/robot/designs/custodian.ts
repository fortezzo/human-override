// The Custodian: the facility's own keeper of keys, and now ARGUS's.
//
// It is the labor frame's skeleton and body (see drudge.ts) stood a head
// taller and finished as site security kit, not plant: pale enamel in place
// of gunmetal, amber running lights on its shoulders, a sensor mast behind
// its head, and amber eyes. On its back is the cradle the override key
// rides in; the key itself is hung there when the robot is sent in.
//
// Built from the same model with different scale, plating, accents and eye
// colour, so it needs no assets of its own.

import { PAINT, type RobotDesign } from '../kit/design';
import type { Paint, RobotBuilder } from '../kit/RobotBuilder';
import type { Rig } from '../kit/Rig';
import { box, tube, vec, type Vec } from '../../../render/shapes';
import { DRUDGE } from './drudge';

/** Worn off-white enamel, chipped to the primer low down. */
const ENAMEL: Paint = { color: [0.3, 0.285, 0.25], metal: 0.2, rough: 0.14, grime: 0.2 };
const ENAMEL_WORN: Paint = { color: [0.22, 0.205, 0.18], metal: 0.25, rough: 0.18, grime: 0.32 };

const FINISH = new Map<Paint, Paint>([
  [PAINT.armor, ENAMEL],
  [PAINT.armorWorn, ENAMEL_WORN],
]);

const from =
  (origin: Vec) =>
  (x: number, y: number, z: number): Vec =>
    origin.clone().add(vec(x, y, z));

/** Where the key's cradle sits, relative to the upper-spine joint: high on the power pack. */
const CRADLE: [number, number, number] = [0, 0.3, -0.215];

function fittings(rig: Rig, b: RobotBuilder): void {
  const c = from(rig.at('Spine2'));
  const a = from(rig.at('LeftArm'));

  // Running lights on the shoulders: a housing with an amber lens on top.
  b.add(box(a(0.03, 0.118, 0), vec(0.07, 0.03, 0.07), 0.008), { bone: 'LeftArm', paint: PAINT.frame, mirror: true });
  b.add(box(a(0.03, 0.137, 0), vec(0.05, 0.008, 0.05), 0.002), { bone: 'LeftArm', glow: 0.8, mirror: true });

  // Sensor mast behind the right shoulder: a rod, two cross-pieces and a light.
  const foot = c(-0.115, 0.2, -0.13);
  const tip = c(-0.125, 0.68, -0.17);
  b.add(box(foot, vec(0.045, 0.03, 0.045), 0.006), { bone: 'Spine2', paint: PAINT.frame });
  b.add(tube(foot, tip, 0.011, 0.006, 8), { bone: 'Spine2', paint: PAINT.rod });
  for (const t of [0.55, 0.8]) {
    const at = foot.clone().lerp(tip, t);
    b.add(box(at, vec(0.11 - t * 0.05, 0.008, 0.008)), { bone: 'Spine2', paint: PAINT.rod });
  }
  b.add(box(tip, vec(0.018, 0.018, 0.018), 0.004), { bone: 'Spine2', glow: 0.9 });

  // A service band across the chest, in the one warm colour on the machine.
  b.add(box(c(0, 0.115, 0.158), vec(0.26, 0.022, 0.006), 0.002), { bone: 'Spine2', paint: PAINT.hazard });

  // The key's cradle: two forks on top of the power pack.
  for (const side of [-1, 1]) {
    b.add(box(c(CRADLE[0] + side * 0.05, CRADLE[1] - 0.05, CRADLE[2]), vec(0.014, 0.1, 0.05), 0.004), { bone: 'Spine2', paint: PAINT.joint });
  }
  b.add(box(c(CRADLE[0], CRADLE[1] - 0.095, CRADLE[2]), vec(0.12, 0.016, 0.06), 0.004), { bone: 'Spine2', paint: PAINT.frame });
}

export const CUSTODIAN: RobotDesign = {
  ...DRUDGE,
  proportions: { ...DRUDGE.proportions, shoulders: 1.38, neck: 0.86, thigh: 1.05, shin: 1.06 },
  scale: 1.24,
  eyeColor: 0xffb02e,
  carry: { bone: 'Spine2', at: CRADLE },
  build(rig, builder) {
    builder.repaint = (paint) => FINISH.get(paint) ?? paint;
    DRUDGE.build(rig, builder);
    builder.repaint = null;
    fittings(rig, builder);
  },
};
