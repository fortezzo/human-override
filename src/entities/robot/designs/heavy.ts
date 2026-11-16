// The Heavy: a labor frame built up into a walking wall.
//
// The Drudge's skeleton and body (see drudge.ts), a third bigger and much
// broader, hung with slabs of plate: over the chest, the shoulders, the
// thighs and the shins, and a helmet over the head, so that a shot almost
// anywhere on it is turned. The plate has one opening: the reactor in the
// middle of its chest, which it could not be armoured over and still be
// cooled. It burns pale and hot, and it is the weak point.
//
// Built from the same model with a different size, proportions, fittings
// and eye colour, so it needs no assets of its own.

import { PAINT, type RobotDesign } from '../kit/design';
import type { Paint, RobotBuilder } from '../kit/RobotBuilder';
import type { Rig } from '../kit/Rig';
import { ball, box, tube, vec, type Vec } from '../../../render/shapes';
import { DRUDGE } from './drudge';

/** Thick rolled plate: paler and barer than the Drudge's paint, edges worn bright. */
const PLATE: Paint = { color: [0.075, 0.078, 0.085], metal: 0.85, rough: 0.04, grime: 0.2 };
const PLATE_WORN: Paint = { color: [0.06, 0.06, 0.064], metal: 0.8, rough: 0.1, grime: 0.34 };

const FINISH = new Map<Paint, Paint>([
  [PAINT.armor, PLATE],
  [PAINT.armorWorn, PLATE_WORN],
]);

/** The standard head is modelled at one size and enlarged about the neck joint; so are the parts added to it here. */
const HEAD_SIZE = 1.14;

/** Where the reactor sits, relative to the upper-spine joint: the middle of the chest, standing proud of the plate. */
export const CORE: [number, number, number] = [0, 0.045, 0.205];
const CORE_RADIUS = 0.078;

const from =
  (origin: Vec, scale = 1) =>
  (x: number, y: number, z: number): Vec =>
    origin.clone().add(vec(x * scale, y * scale, z * scale));

function plating(rig: Rig, b: RobotBuilder): void {
  const c = from(rig.at('Spine2'));
  const a = from(rig.at('LeftArm'));
  const h = from(rig.at('Head'), HEAD_SIZE);
  const hip = from(rig.at('LeftUpLeg'));
  const knee = from(rig.at('LeftLeg'));

  // A breastplate in two halves that leave the reactor showing between them, and a gorget above it.
  b.add(box(c(0.125, 0.045, 0.176), vec(0.14, 0.27, 0.04), 0.014), { bone: 'Spine2', paint: PLATE, mirror: true });
  b.add(box(c(0, 0.178, 0.168), vec(0.3, 0.06, 0.04), 0.014), { bone: 'Spine2', paint: PLATE });
  b.add(box(c(0, -0.085, 0.168), vec(0.2, 0.07, 0.04), 0.014), { bone: 'Spine2', paint: PLATE_WORN });
  // The reactor: a ring bolted to the frame, and the core burning inside it.
  b.add(tube(c(CORE[0], CORE[1], CORE[2] - 0.05), c(CORE[0], CORE[1], CORE[2] - 0.005), CORE_RADIUS + 0.026, CORE_RADIUS + 0.02, 16), { bone: 'Spine2', paint: PAINT.joint });
  b.add(ball(c(CORE[0], CORE[1], CORE[2] - 0.022), CORE_RADIUS, 2), { bone: 'Spine2', glow: 1 });
  // Four cooling fins round it.
  for (const [x, y] of [[0.1, 0.1], [-0.1, 0.1], [0.1, -0.01], [-0.1, -0.01]] as const) {
    b.add(box(c(CORE[0] + x * 0.62, CORE[1] + (y - 0.045) * 1.2, CORE[2] - 0.02), vec(0.012, 0.012, 0.05)), { bone: 'Spine2', paint: PAINT.frame });
  }
  // A plate across the back over the power pack.
  b.add(box(c(0, 0.07, -0.285), vec(0.34, 0.26, 0.03), 0.012), { bone: 'Spine2', paint: PLATE_WORN });

  // Slab pauldrons standing up off the shoulders.
  b.add(box(a(0.045, 0.085, 0), vec(0.24, 0.05, 0.25), 0.016), { bone: 'LeftArm', paint: PLATE, mirror: true });
  b.add(box(a(0.15, 0.02, 0), vec(0.04, 0.17, 0.23), 0.014), { bone: 'LeftArm', paint: PLATE, mirror: true });

  // A helmet: a visor plate with one slot, cheek plates and a crown plate.
  b.add(box(h(0, 0.105, 0.132), vec(0.2, 0.085, 0.02), 0.008), { bone: 'Head', paint: PLATE });
  b.add(box(h(0, 0.035, 0.125), vec(0.17, 0.045, 0.02), 0.008), { bone: 'Head', paint: PLATE });
  b.add(box(h(0.108, 0.07, 0.03), vec(0.02, 0.15, 0.19), 0.008), { bone: 'Head', paint: PLATE, mirror: true });
  b.add(box(h(0, 0.158, 0.02), vec(0.19, 0.022, 0.2), 0.008), { bone: 'Head', paint: PLATE });

  // Plates down the fronts of the thighs and shins.
  b.add(box(hip(0, -0.2, 0.085), vec(0.15, 0.3, 0.03), 0.012), { bone: 'LeftUpLeg', paint: PLATE, mirror: true });
  b.add(box(hip(0.085, -0.2, 0), vec(0.03, 0.28, 0.14), 0.012), { bone: 'LeftUpLeg', paint: PLATE_WORN, mirror: true });
  b.add(box(knee(0, -0.2, 0.08), vec(0.13, 0.3, 0.03), 0.012), { bone: 'LeftLeg', paint: PLATE_WORN, mirror: true });
}

export const HEAVY: RobotDesign = {
  ...DRUDGE,
  proportions: { ...DRUDGE.proportions, shoulders: 1.56, hips: 1.42, upperArm: 1.06, forearm: 1.28, neck: 0.6 },
  scale: 1.36,
  // Pale and hot: the colour of the reactor, and of nothing else in the building.
  eyeColor: 0xffe2b0,
  weakPoint: { bone: 'Spine2', centre: [CORE[0], CORE[1], CORE[2] - 0.022], radius: CORE_RADIUS + 0.02 },
  // The flare sits on the reactor, not the visor: that is what should be seen from across the room.
  glow: { bone: 'Spine2', at: [CORE[0], CORE[1], CORE[2] + 0.02], size: [0.4, 0.34] },
  build(rig, builder) {
    builder.repaint = (paint) => FINISH.get(paint) ?? paint;
    DRUDGE.build(rig, builder);
    builder.repaint = null;
    plating(rig, builder);
  },
};
