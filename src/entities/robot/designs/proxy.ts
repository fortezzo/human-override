// The Proxy: the body ARGUS keeps for itself, sent in for the final stand.
//
// The labor frame's skeleton and body (see drudge.ts) built half as big
// again, wider across the shoulders, and finished in black: no hazard
// paint, no rust, nothing left of the machine it was copied from.
//
// It has to read as the boss from across the core, against a red room and
// among a crowd. So it is lit from inside: broad seams down its chest and
// back, bands round its forearms and shins, lit shoulder plates, a row of
// eyes over a wide visor, all in the white-hot orange of ARGUS's own iris.
// And from a distance its edges glow pale whatever light it stands in and
// a light travels with it, so its shape and the floor round it are lit.
// Both of those fade as it closes in: at arm's length it is the black
// machine it was built as, with only its own seams burning.
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

  // A row of eyes across the brow, over the visor.
  for (let i = 0; i < 5; i++) {
    b.add(box(h(-0.064 + i * 0.032, 0.129, 0.118), vec(0.02 * HEAD_SIZE, 0.016 * HEAD_SIZE, 0.004)), { bone: 'Head', glow: 1 });
  }
  // A light on each side of the head, so it reads from the flank as well.
  b.add(box(h(0.101, 0.07, 0.02), vec(0.004, 0.05, 0.09)), { bone: 'Head', glow: 0.9, mirror: true });

  // Seams lit from inside: a broad one down each chest plate, the gap
  // between them, the flanks, and the spine of the power pack.
  b.add(box(c(0.05, 0.045, 0.168), vec(0.018, 0.2, 0.005)), { bone: 'Spine2', glow: 0.9, mirror: true });
  b.add(box(c(0, 0.05, 0.162), vec(0.012, 0.22, 0.005)), { bone: 'Spine2', glow: 1 });
  b.add(box(c(0, 0.075, -0.274), vec(0.05, 0.22, 0.005)), { bone: 'Spine2', glow: 0.9 });
  b.add(box(c(0.146, 0.0, 0.03), vec(0.005, 0.16, 0.03)), { bone: 'Spine2', glow: 0.8, mirror: true });

  // Lit plates on top of the shoulders, and bands round the forearms and shins.
  b.add(box(a(0.02, 0.112, 0), vec(0.15, 0.006, 0.07)), { bone: 'LeftArm', glow: 0.9, mirror: true });
  const e = from(rig.at('LeftForeArm'));
  const w = from(rig.at('LeftHand'));
  for (const t of [0.3, 0.72]) {
    const at = e(0, 0, 0).lerp(w(0, 0, 0), t);
    b.add(box(at, vec(0.012, 0.15, 0.16), 0.004), { bone: 'LeftForeArm', glow: 0.85, mirror: true });
  }
  const knee = from(rig.at('LeftLeg'));
  const ankle = from(rig.at('LeftFoot'));
  for (const t of [0.25, 0.6]) {
    const at = knee(0, 0, 0).lerp(ankle(0, 0, 0), t);
    b.add(box(at, vec(0.15, 0.014, 0.17), 0.004), { bone: 'LeftLeg', glow: 0.85, mirror: true });
  }
  const hip = from(rig.at('LeftUpLeg'));
  b.add(box(hip(0.075, -0.2, 0.0), vec(0.006, 0.22, 0.03)), { bone: 'LeftUpLeg', glow: 0.7, mirror: true });

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
  // The white-hot orange of ARGUS's own iris.
  eyeColor: 0xff5a26,
  glow: { at: DRUDGE.glow.at, size: [0.95, 0.34] },
  // From across a room its edges glow pale and hot whatever light it
  // stands in (the usual edge light is a faint cold sheen, and only on
  // what is nearly black), and it carries a light. Within a few metres
  // both are mostly gone.
  edge: { color: [1.0, 0.56, 0.42], strength: 0.85, lift: 0.03, power: 1.7, fadeBy: 3.0, ramp: [2.5, 6.5, 0.2] },
  lamp: { color: 0xff8a5c, intensity: 16, distance: 6.5, ramp: [2.5, 6.5, 0.12] },
  build(rig, builder) {
    builder.repaint = (paint) => FINISH.get(paint) ?? paint;
    DRUDGE.build(rig, builder);
    builder.repaint = null;
    fittings(rig, builder);
  },
};
