// The Heavy: a labor frame built up into a walking wall.
//
// It is the Drudge's skeleton and the Drudge's own body underneath (see
// drudge.ts): the same chest barrel, power pack, limbs and claws, a third
// bigger and much broader. Over that it wears armour that was made for it,
// not slabs: a breastplate in two halves that close on the reactor's
// housing, lames down the belly that slide over one another as it bends,
// pauldrons in two layers worked by a strut from the yoke, shaped plates
// down the thighs and shins with a hinged cap over each knee.
//
// Its head is the Drudge's head, visor and all, inside a helm: a hood over
// the brow, a guard round the jaw and a crest over the crown. Stood beside
// a Drudge it is plainly the same make of machine, built heavier.
//
// The armour has one opening: the reactor in the middle of its chest,
// which could not be plated over and still be cooled. It burns pale and
// hot, and it is the weak point.
//
// Built from the same model with a different size, proportions, fittings
// and eye colour, so it needs no assets of its own.

import * as THREE from 'three';
import { PAINT, type RobotDesign } from '../kit/design';
import type { Paint, PartOptions, RobotBuilder } from '../kit/RobotBuilder';
import type { Rig } from '../kit/Rig';
import { ball, box, cable, hull, rect, row, tube, vec, type Vec } from '../../../render/shapes';
import { DRUDGE, HEAD_SIZE, head, hingeCaps, leftArm, leftLeg, piston, torso } from './drudge';

/** Thick rolled plate: paler and barer than the Drudge's paint, edges worn bright. */
const PLATE: Paint = { color: [0.075, 0.078, 0.085], metal: 0.85, rough: 0.04, grime: 0.2 };
const PLATE_WORN: Paint = { color: [0.06, 0.06, 0.064], metal: 0.8, rough: 0.1, grime: 0.34 };
/** The plate at the edges of the armour, where one piece laps another: a shade darker, so the seams read. */
const PLATE_DARK: Paint = { color: [0.046, 0.048, 0.053], metal: 0.8, rough: 0.08, grime: 0.28 };

const FINISH = new Map<Paint, Paint>([
  [PAINT.armor, PLATE],
  [PAINT.armorWorn, PLATE_WORN],
]);

const UP = vec(0, 1, 0);
const FRONT = vec(0, 0, 1);
const BACK = vec(0, 0, -1);
const OUT = vec(1, 0, 0);
const tilt = (x: number, y = 0, z = 0) => new THREE.Euler(x, y, z);

/** Where the reactor sits, relative to the upper-spine joint: the middle of the chest, standing proud of the plate. */
export const CORE: [number, number, number] = [0, 0.045, 0.205];
const CORE_RADIUS = 0.078;

const from =
  (origin: Vec) =>
  (x: number, y: number, z: number): Vec =>
    origin.clone().add(vec(x, y, z));

/** A bolt head: a short hexagon standing off a surface along `normal`. */
function bolt(b: RobotBuilder, at: Vec, normal: Vec, bone: string, radius = 0.011, mirror = false): void {
  b.add(tube(at, at.clone().addScaledVector(normal, radius * 0.7), radius, radius * 0.82, 6), { bone, paint: PAINT.joint, mirror, crease: 20 });
}

/** The armour over the trunk: breastplate, reactor housing, belly lames, flanks, and the cowl over the power pack. */
function trunk(rig: Rig, b: RobotBuilder): void {
  const c = from(rig.at('Spine2'));
  const p = from(rig.at('Hips'));
  const core = c(CORE[0], CORE[1], CORE[2]);

  // The breastplate: two halves, each leaning back from a ridge at its own
  // middle, their inner edges tucked behind the reactor's housing.
  b.add(
    hull(
      [
        { at: c(0.122, -0.052, 0.16), section: rect(0.135, 0.05, 0.016) },
        { at: c(0.15, 0.04, 0.186), section: rect(0.2, 0.06, 0.02) },
        { at: c(0.156, 0.13, 0.182), section: rect(0.215, 0.058, 0.02) },
        { at: c(0.138, 0.192, 0.152), section: rect(0.17, 0.046, 0.016) },
      ],
      vec(0.3, 0, 0.954),
    ),
    { bone: 'Spine2', paint: PLATE, mirror: true },
  );
  // A raised rib along the outer edge of each half, and the bolts that hold it down.
  b.add(
    hull(
      [
        { at: c(0.226, -0.03, 0.178), section: rect(0.03, 0.022, 0.006) },
        { at: c(0.247, 0.05, 0.19), section: rect(0.034, 0.024, 0.006) },
        { at: c(0.25, 0.14, 0.184), section: rect(0.03, 0.022, 0.006) },
      ],
      vec(0.3, 0, 0.954),
    ),
    { bone: 'Spine2', paint: PLATE_DARK, mirror: true },
  );
  for (const [x, y, z] of [[0.19, 0.165, 0.2], [0.21, -0.02, 0.2], [0.2, 0.075, 0.214]] as const) bolt(b, c(x, y, z), vec(0.3, 0, 0.954), 'Spine2', 0.012, true);

  // The gorget: a bar across the top of the chest, and a guard standing up either side of the neck.
  b.add(box(c(0, 0.208, 0.118), vec(0.36, 0.062, 0.052), 0.018, tilt(-0.5)), { bone: 'Spine2', paint: PLATE });
  b.add(box(c(0, 0.2, 0.146), vec(0.1, 0.03, 0.02), 0.006, tilt(-0.5)), { bone: 'Spine2', paint: PAINT.hazard });
  b.add(
    hull(
      [
        { at: c(0.118, 0.205, -0.1), section: rect(0.036, 0.07, 0.01) },
        { at: c(0.14, 0.24, 0.0), section: rect(0.04, 0.13, 0.012) },
        { at: c(0.128, 0.215, 0.1), section: rect(0.036, 0.075, 0.01) },
      ],
      UP,
    ),
    { bone: 'Spine2', paint: PLATE, mirror: true },
  );

  // The reactor's housing: an eight-sided collar the breastplate closes on,
  // a machined ring inside it, and the core burning inside that.
  b.add(tube(c(CORE[0], CORE[1], 0.148), c(CORE[0], CORE[1], 0.212), 0.134, 0.116, 8), { bone: 'Spine2', paint: PLATE_DARK, crease: 20 });
  b.add(tube(c(CORE[0], CORE[1], 0.196), c(CORE[0], CORE[1], 0.221), CORE_RADIUS + 0.024, CORE_RADIUS + 0.014, 16, 'none'), { bone: 'Spine2', paint: PAINT.joint });
  b.add(ball(c(CORE[0], CORE[1], CORE[2] - 0.022), CORE_RADIUS, 2), { bone: 'Spine2', glow: 1 });
  // Eight bolts round the collar's face, and three claws gripping the core's rim.
  for (let i = 0; i < 8; i++) {
    const angle = ((i + 0.5) / 8) * Math.PI * 2;
    bolt(b, core.clone().add(vec(Math.cos(angle) * 0.113, Math.sin(angle) * 0.113, 0.006)), FRONT, 'Spine2', 0.0085);
  }
  for (let i = 0; i < 3; i++) {
    const angle = Math.PI / 2 + (i / 3) * Math.PI * 2;
    const at = core.clone().add(vec(Math.cos(angle) * 0.079, Math.sin(angle) * 0.079, 0.013));
    b.add(box(at, vec(0.05, 0.016, 0.014), 0.004, tilt(0, 0, angle)), { bone: 'Spine2', paint: PAINT.frame });
  }
  // Cooling: a bank of fins under the housing, and a hose from each side of it round to the power pack.
  b.add(
    row(7, (i) => box(c(-0.06 + i * 0.02, -0.068, 0.168), vec(0.007, 0.05, 0.04))),
    { bone: 'Spine2', paint: PAINT.frame },
  );
  const hose = [c(0.118, 0.0, 0.152), c(0.25, -0.04, 0.07), c(0.246, -0.045, -0.09), c(0.13, -0.02, -0.21)];
  b.add(cable(hose, 0.019, 8), { bone: 'Spine2', paint: PAINT.rubber, mirror: true });
  b.add(tube(hose[0]!, hose[0]!.clone().add(vec(0.03, -0.006, -0.012)), 0.025, 0.023, 8), { bone: 'Spine2', paint: PAINT.joint, mirror: true });

  // Lames down the belly: three strips, each lapping the one below, on the three joints of its spine.
  b.add(box(c(0, -0.112, 0.156), vec(0.26, 0.058, 0.036), 0.014, tilt(0.2)), { bone: 'Spine2', paint: PLATE });
  b.add(box(rig.at('Spine1').add(vec(0, 0.022, 0.126)), vec(0.23, 0.06, 0.034), 0.014, tilt(0.16)), { bone: 'Spine1', paint: PLATE_WORN });
  b.add(box(rig.at('Spine').add(vec(0, 0.026, 0.112)), vec(0.2, 0.06, 0.032), 0.014, tilt(0.12)), { bone: 'Spine', paint: PLATE });
  for (const side of [-1, 1]) bolt(b, c(side * 0.1, -0.11, 0.176), FRONT, 'Spine2', 0.009);

  // Flank plates under the arms.
  b.add(
    hull(
      [
        { at: c(0.212, -0.07, 0.0), section: rect(0.15, 0.032, 0.01) },
        { at: c(0.232, 0.03, -0.005), section: rect(0.2, 0.036, 0.012) },
        { at: c(0.226, 0.11, -0.01), section: rect(0.17, 0.032, 0.01) },
      ],
      OUT,
    ),
    { bone: 'Spine2', paint: PLATE_WORN, mirror: true },
  );

  // A cowl over the power pack, and a slatted vent let into it.
  b.add(
    hull(
      [
        { at: c(0, -0.06, -0.275), section: rect(0.3, 0.04, 0.014) },
        { at: c(0, 0.05, -0.296), section: rect(0.37, 0.046, 0.016) },
        { at: c(0, 0.15, -0.29), section: rect(0.36, 0.044, 0.016) },
        { at: c(0, 0.215, -0.262), section: rect(0.27, 0.036, 0.012) },
      ],
      BACK,
    ),
    { bone: 'Spine2', paint: PLATE_WORN },
  );
  b.add(
    row(5, (i) => box(c(0, 0.045 + i * 0.026, -0.322), vec(0.2, 0.01, 0.012))),
    { bone: 'Spine2', paint: PAINT.frame },
  );
  for (const side of [-1, 1]) for (const y of [-0.035, 0.185]) bolt(b, c(side * 0.15, y, -0.3), BACK, 'Spine2', 0.011);

  // Skirt plates over the hips, each hung from a hinge on the pelvis.
  b.add(
    hull(
      [
        { at: p(0.196, 0.0, 0.0), section: rect(0.17, 0.034, 0.012) },
        { at: p(0.214, -0.085, 0.0), section: rect(0.2, 0.038, 0.014) },
        { at: p(0.208, -0.16, 0.0), section: rect(0.15, 0.03, 0.01) },
      ],
      OUT,
    ),
    { bone: 'Hips', paint: PLATE, mirror: true },
  );
  b.add(tube(p(0.184, 0.012, -0.07), p(0.184, 0.012, 0.07), 0.017, 0.017, 8), { bone: 'Hips', paint: PAINT.joint, mirror: true });
  hingeCaps(b, p(0.184, 0.012, -0.07), p(0.184, 0.012, 0.07), 'Hips', 0.012);
  // A codpiece plate under the lowest lame.
  b.add(
    hull(
      [
        { at: p(0, 0.02, 0.105), section: rect(0.17, 0.034, 0.012) },
        { at: p(0, -0.06, 0.118), section: rect(0.15, 0.04, 0.014) },
        { at: p(0, -0.125, 0.098), section: rect(0.09, 0.03, 0.01) },
      ],
      FRONT,
    ),
    { bone: 'Hips', paint: PLATE_WORN },
  );
}

/** Pauldrons in two layers, worked by a strut from the yoke; a cop over the elbow and a plate down the forearm. */
function shoulderAndArm(rig: Rig, b: RobotBuilder): void {
  const c = from(rig.at('Spine2'));
  const a = from(rig.at('LeftArm'));
  const e = from(rig.at('LeftForeArm'));
  const w = from(rig.at('LeftHand'));
  const mirror = true;

  // The upper layer: a deep dome over the joint.
  b.add(
    hull(
      [
        { at: a(-0.105, 0.045, 0), section: rect(0.21, 0.11, [0.05, 0.05, 0.012, 0.012]) },
        { at: a(-0.01, 0.078, 0), section: rect(0.3, 0.165, [0.07, 0.07, 0.016, 0.016]) },
        { at: a(0.1, 0.07, 0), section: rect(0.285, 0.15, [0.062, 0.062, 0.014, 0.014]) },
        { at: a(0.16, 0.048, 0), section: rect(0.24, 0.11, [0.04, 0.04, 0.01, 0.01]) },
      ],
      UP,
    ),
    { bone: 'LeftArm', paint: PLATE, mirror },
  );
  // The lower layer: a lame lapped under it, further down the arm.
  b.add(
    hull(
      [
        { at: a(0.13, 0.012, 0), section: rect(0.262, 0.12, [0.045, 0.045, 0.012, 0.012]) },
        { at: a(0.21, 0.0, 0), section: rect(0.25, 0.112, [0.04, 0.04, 0.012, 0.012]) },
        { at: a(0.275, -0.014, 0), section: rect(0.19, 0.08, [0.028, 0.028, 0.008, 0.008]) },
      ],
      UP,
    ),
    { bone: 'LeftArm', paint: PLATE_WORN, mirror },
  );
  // A rolled edge where the two meet, a guard standing up along the inner edge, and rivets fore and aft.
  b.add(
    hull(
      [
        { at: a(0.152, 0.05, 0), section: rect(0.252, 0.122, [0.045, 0.045, 0.012, 0.012]) },
        { at: a(0.172, 0.044, 0), section: rect(0.246, 0.116, [0.042, 0.042, 0.012, 0.012]) },
      ],
      UP,
      'none',
    ),
    { bone: 'LeftArm', paint: PLATE_DARK, mirror },
  );
  b.add(
    hull(
      [
        { at: a(-0.07, 0.13, -0.11), section: rect(0.034, 0.05, 0.01) },
        { at: a(-0.085, 0.172, 0.0), section: rect(0.038, 0.1, 0.012) },
        { at: a(-0.07, 0.13, 0.11), section: rect(0.034, 0.05, 0.01) },
      ],
      UP,
    ),
    { bone: 'LeftArm', paint: PLATE, mirror },
  );
  for (const z of [-0.118, 0.118]) for (const x of [-0.02, 0.09]) bolt(b, a(x, 0.045, z), vec(0, 0.3, Math.sign(z)), 'LeftArm', 0.012, mirror);

  // The strut that carries the pauldron's weight, from the yoke behind the neck.
  piston(b, c(0.13, 0.19, -0.115), a(-0.02, 0.105, -0.1), 'Spine2', 'LeftArm', 0.017);

  // Elbow: a cop over the hinge.
  b.add(
    hull(
      [
        { at: e(-0.062, 0.03, 0), section: rect(0.13, 0.05, [0.02, 0.02, 0.006, 0.006]) },
        { at: e(0.0, 0.062, 0), section: rect(0.15, 0.075, [0.03, 0.03, 0.008, 0.008]) },
        { at: e(0.06, 0.036, 0), section: rect(0.13, 0.05, [0.02, 0.02, 0.006, 0.006]) },
      ],
      UP,
    ),
    { bone: 'LeftForeArm', paint: PLATE, mirror },
  );
  // Forearm: a plate over the back of the gauntlet with a rib down it, and a guard over the knuckles.
  b.add(
    hull(
      [
        { at: e(0.085, 0.074, 0), section: rect(0.128, 0.034, 0.012) },
        { at: w(-0.12, 0.082, 0), section: rect(0.14, 0.038, 0.012) },
        { at: w(-0.04, 0.066, 0), section: rect(0.1, 0.03, 0.01) },
      ],
      UP,
    ),
    { bone: 'LeftForeArm', paint: PLATE_WORN, mirror },
  );
  b.add(
    hull(
      [
        { at: e(0.1, 0.098, 0), section: rect(0.03, 0.016, 0.004) },
        { at: w(-0.06, 0.098, 0), section: rect(0.026, 0.014, 0.004) },
      ],
      UP,
    ),
    { bone: 'LeftForeArm', paint: PLATE_DARK, mirror },
  );
  b.add(box(w(0.058, 0.03, 0), vec(0.085, 0.022, 0.118), 0.008, tilt(0, 0, -0.1)), { bone: 'LeftHand', paint: PLATE, mirror });
}

/** Shaped plates down the thigh and shin, a hinged cap over the knee, and a cap over the toe. */
function legArmour(rig: Rig, b: RobotBuilder): void {
  const hip = from(rig.at('LeftUpLeg'));
  const knee = from(rig.at('LeftLeg'));
  const ankleAt = rig.at('LeftFoot');
  const ankle = from(ankleAt);
  const toeAt = rig.at('LeftToeBase');
  const mirror = true;

  // Thigh: a plate down the front with a rib along it, and another down the outside.
  b.add(
    hull(
      [
        { at: hip(0.008, -0.06, 0.086), section: rect(0.135, 0.036, 0.012) },
        { at: hip(0.01, -0.18, 0.108), section: rect(0.17, 0.042, 0.016) },
        { at: knee(0.006, 0.105, 0.088), section: rect(0.125, 0.034, 0.012) },
      ],
      FRONT,
    ),
    { bone: 'LeftUpLeg', paint: PLATE, mirror },
  );
  b.add(
    hull(
      [
        { at: hip(0.009, -0.09, 0.11), section: rect(0.04, 0.02, 0.006) },
        { at: hip(0.01, -0.18, 0.132), section: rect(0.046, 0.022, 0.006) },
        { at: knee(0.006, 0.13, 0.11), section: rect(0.036, 0.018, 0.005) },
      ],
      FRONT,
    ),
    { bone: 'LeftUpLeg', paint: PLATE_DARK, mirror },
  );
  b.add(
    hull(
      [
        { at: hip(0.092, -0.07, 0.004), section: rect(0.15, 0.034, 0.012) },
        { at: hip(0.1, -0.19, 0.008), section: rect(0.17, 0.038, 0.014) },
        { at: knee(0.082, 0.1, 0.004), section: rect(0.12, 0.03, 0.01) },
      ],
      OUT,
    ),
    { bone: 'LeftUpLeg', paint: PLATE_WORN, mirror },
  );
  for (const y of [-0.085, -0.28]) bolt(b, hip(0.058, y, 0.112), FRONT, 'LeftUpLeg', 0.011, mirror);

  // Knee: a cap in three facets, on a hinge pin through the joint.
  b.add(
    hull(
      [
        { at: knee(0, 0.082, 0.082), section: rect(0.118, 0.03, 0.01) },
        { at: knee(0, 0.006, 0.112), section: rect(0.142, 0.046, 0.016) },
        { at: knee(0, -0.07, 0.09), section: rect(0.112, 0.03, 0.01) },
      ],
      FRONT,
    ),
    { bone: 'LeftLeg', paint: PLATE, mirror },
  );
  b.add(tube(knee(-0.082, 0, 0.03), knee(0.082, 0, 0.03), 0.02, 0.02, 8), { bone: 'LeftLeg', paint: PAINT.joint, mirror });
  hingeCaps(b, knee(-0.082, 0, 0.03), knee(0.082, 0, 0.03), 'LeftLeg', 0.013);

  // Shin: a greave with a rib down the front and a wing either side of the calf.
  b.add(
    hull(
      [
        { at: knee(0, -0.105, 0.082), section: rect(0.12, 0.034, 0.012) },
        { at: knee(-0.001, -0.22, 0.09), section: rect(0.146, 0.04, 0.014) },
        { at: ankle(0, 0.085, 0.06), section: rect(0.1, 0.03, 0.01) },
      ],
      FRONT,
    ),
    { bone: 'LeftLeg', paint: PLATE_WORN, mirror },
  );
  b.add(
    hull(
      [
        { at: knee(0, -0.12, 0.105), section: rect(0.036, 0.018, 0.005) },
        { at: knee(0, -0.22, 0.114), section: rect(0.04, 0.02, 0.006) },
        { at: ankle(0, 0.1, 0.08), section: rect(0.03, 0.016, 0.005) },
      ],
      FRONT,
    ),
    { bone: 'LeftLeg', paint: PLATE_DARK, mirror },
  );
  b.add(
    hull(
      [
        { at: knee(0.078, -0.1, -0.004), section: rect(0.13, 0.028, 0.01) },
        { at: knee(0.086, -0.2, -0.008), section: rect(0.15, 0.03, 0.01) },
        { at: ankle(0.066, 0.1, -0.004), section: rect(0.1, 0.024, 0.008) },
      ],
      OUT,
    ),
    { bone: 'LeftLeg', paint: PLATE, mirror },
  );
  // A hazard band round the top of the left greave only.
  b.add(box(knee(0, -0.13, 0.102), vec(0.124, 0.03, 0.012), 0.004, tilt(0.06)), { bone: 'LeftLeg', paint: PAINT.hazard });

  // Foot: a cap over the toe, and a guard over the ankle.
  b.add(
    hull(
      [
        { at: vec(toeAt.x, 0.062, toeAt.z - 0.03), section: rect(0.15, 0.05, [0.02, 0.02, 0.006, 0.006]) },
        { at: vec(toeAt.x, 0.05, toeAt.z + 0.07), section: rect(0.132, 0.05, [0.022, 0.022, 0.006, 0.006]) },
        { at: vec(toeAt.x, 0.036, toeAt.z + 0.125), section: rect(0.1, 0.03, [0.012, 0.012, 0.004, 0.004]) },
      ],
      UP,
    ),
    { bone: 'LeftToeBase', paint: PLATE_WORN, mirror },
  );
  b.add(box(ankle(0, 0.03, 0.062), vec(0.105, 0.085, 0.03), 0.012, tilt(-0.25)), { bone: 'LeftFoot', paint: PLATE, mirror });
}

/** The helm round the Drudge's own head: a hood over the brow, a guard round the jaw, and a crest. */
function helm(rig: Rig, b: RobotBuilder): void {
  const joint = rig.at('Head');
  const h = from(joint);
  /** Adds a part of the head, enlarged about the neck joint as the head itself is. */
  const part = (shape: THREE.BufferGeometry, options: PartOptions) => {
    shape.translate(-joint.x, -joint.y, -joint.z).scale(HEAD_SIZE, HEAD_SIZE, HEAD_SIZE).translate(joint.x, joint.y, joint.z);
    b.add(shape, options);
  };

  // A hood standing out over the visor, deep at the middle and swept back at the ends.
  part(
    hull(
      [
        { at: h(-0.12, 0.118, 0.04), section: rect(0.11, 0.03, 0.008) },
        { at: h(0, 0.126, 0.086), section: rect(0.14, 0.036, 0.01) },
        { at: h(0.12, 0.118, 0.04), section: rect(0.11, 0.03, 0.008) },
      ],
      UP,
    ),
    { bone: 'Head', paint: PLATE },
  );
  // The jaw guard: a prow under the visor that leaves the slit and the vents above it clear.
  part(
    hull(
      [
        { at: h(-0.118, 0.022, 0.05), section: rect(0.09, 0.062, 0.014) },
        { at: h(0, 0.004, 0.128), section: rect(0.07, 0.07, 0.016) },
        { at: h(0.118, 0.022, 0.05), section: rect(0.09, 0.062, 0.014) },
      ],
      UP,
    ),
    { bone: 'Head', paint: PLATE },
  );
  part(
    row(3, (i) => box(h(-0.022 + i * 0.022, 0.004, 0.166), vec(0.007, 0.034, 0.008))),
    { bone: 'Head', paint: PAINT.lens },
  );
  // A cheek guard on its left; its right cheek keeps the Drudge's sensor cluster, with a bar over it.
  part(
    hull(
      [
        { at: h(0.118, 0.07, -0.085), section: rect(0.028, 0.1, 0.008) },
        { at: h(0.126, 0.07, 0.0), section: rect(0.03, 0.14, 0.01) },
        { at: h(0.118, 0.07, 0.075), section: rect(0.026, 0.1, 0.008) },
      ],
      UP,
    ),
    { bone: 'Head', paint: PLATE_WORN },
  );
  part(box(h(-0.134, 0.108, 0.05), vec(0.016, 0.014, 0.1), 0.004), { bone: 'Head', paint: PLATE });
  // The crest: a keel from the brow back over the crown, and a ridge either side of it.
  part(
    hull(
      [
        { at: h(0, 0.15, 0.07), section: rect(0.05, 0.022, 0.007) },
        { at: h(0, 0.16, -0.02), section: rect(0.066, 0.03, 0.009) },
        { at: h(0, 0.15, -0.115), section: rect(0.05, 0.022, 0.007) },
      ],
      UP,
    ),
    { bone: 'Head', paint: PLATE },
  );
  part(box(h(0.07, 0.147, -0.03), vec(0.02, 0.01, 0.14), 0.004), { bone: 'Head', paint: PLATE_DARK, mirror: true });
  for (const side of [-1, 1]) {
    const at = h(side * 0.06, 0.142, 0.062);
    at.sub(joint).multiplyScalar(HEAD_SIZE).add(joint);
    bolt(b, at, UP, 'Head', 0.009);
  }
}

export const HEAVY: RobotDesign = {
  ...DRUDGE,
  proportions: { ...DRUDGE.proportions, shoulders: 1.56, hips: 1.42, upperArm: 1.06, forearm: 1.28, neck: 0.6 },
  // (As big as will still pass under the power room's doors.)
  scale: 1.3,
  // Pale and hot: the colour of the reactor, and of nothing else in the building.
  eyeColor: 0xffe2b0,
  weakPoint: { bone: 'Spine2', centre: [CORE[0], CORE[1], CORE[2] - 0.022], radius: CORE_RADIUS + 0.02 },
  // The flare sits on the reactor, not the visor: that is what should be seen from across the room.
  glow: { bone: 'Spine2', at: [CORE[0], CORE[1], CORE[2] + 0.02], size: [0.4, 0.34] },
  build(rig, builder) {
    // The Drudge's own body and head, in bare plate (and without the Drudge's hazard bands: it has its own).
    builder.repaint = (paint) => FINISH.get(paint) ?? paint;
    torso(rig, builder);
    head(rig, builder);
    leftArm(rig, builder);
    leftLeg(rig, builder);
    builder.repaint = null;
    trunk(rig, builder);
    shoulderAndArm(rig, builder);
    legArmour(rig, builder);
    helm(rig, builder);
  },
};
