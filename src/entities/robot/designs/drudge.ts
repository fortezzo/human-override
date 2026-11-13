// The Drudge: the facility's labor frame, and ARGUS's standard foot soldier.
//
// Built to haul and clamp, not to fight, which is what makes it unsettling:
// wide load-bearing shoulders, heavy forearms ending in claws, a power pack
// that hunches its back, and a small armored sensor head sunk between the
// shoulders with one narrow visor.
//
// All measurements are metres in the rest pose: arms straight out to the
// sides, +X to the robot's left, +Y up, +Z the way it faces. Parts are
// placed relative to the skeleton's joints, so the body follows if the
// proportions are changed. Only the left arm and leg are described; the
// builder mirrors them.

import * as THREE from 'three';
import { PAINT, type RobotDesign } from '../kit/design';
import type { PartOptions, RobotBuilder } from '../kit/RobotBuilder';
import type { Rig } from '../kit/Rig';
import { ball, beam, box, cable, hull, rect, ribbed, row, tube, vec, type Vec } from '../../../render/shapes';

const UP = vec(0, 1, 0);
const FRONT = vec(0, 0, 1);
const BACK = vec(0, 0, -1);
const OUT = vec(1, 0, 0);
const tilt = (x: number, y = 0, z = 0) => new THREE.Euler(x, y, z);

/** The head is modelled at a convenient size and then enlarged by this much about the neck joint. */
const HEAD_SIZE = 1.14;

/** A point given relative to a joint. */
type From = (x: number, y: number, z: number) => Vec;
const from =
  (origin: Vec): From =>
  (x, y, z) =>
    origin.clone().add(vec(x, y, z));

/** A hydraulic strut between two bones: a sleeve with a thinner rod sliding out of it. */
function piston(b: RobotBuilder, start: Vec, end: Vec, boneStart: string, boneEnd: string, radius: number, mirror = true): void {
  const mid = start.clone().lerp(end, 0.56);
  const anchors = [
    { bone: boneStart, at: start },
    { bone: boneEnd, at: end },
  ];
  b.add(tube(start, mid, radius, radius, 8), { bone: anchors, paint: PAINT.frame, mirror });
  b.add(tube(mid, end, radius * 0.55, radius * 0.55, 8), { bone: anchors, paint: PAINT.rod, mirror });
  b.add(ball(start, radius * 1.25, 0), { bone: boneStart, paint: PAINT.joint, mirror });
  b.add(ball(end, radius * 1.1, 0), { bone: boneEnd, paint: PAINT.joint, mirror });
}

/** A hex bolt head on each end of a hinge. */
function hingeCaps(b: RobotBuilder, a: Vec, c: Vec, bone: string, radius: number): void {
  const axis = c.clone().sub(a).normalize();
  for (const [end, sign] of [
    [a, -1],
    [c, 1],
  ] as const) {
    b.add(tube(end, end.clone().addScaledVector(axis, sign * 0.012), radius, radius * 0.85, 6), { bone, paint: PAINT.frame, mirror: true, crease: 20 });
  }
}

function torso(rig: Rig, b: RobotBuilder): void {
  const c = from(rig.at('Spine2'));
  const p = from(rig.at('Hips'));
  const h = from(rig.at('Head'));

  // Chest: a deep barrel that narrows to the waist.
  b.add(
    hull(
      [
        { at: c(0, -0.097, 0.013), section: rect(0.24, 0.19, 0.035) },
        { at: c(0, -0.012, 0.005), section: rect(0.36, 0.26, 0.05) },
        { at: c(0, 0.103, -0.005), section: rect(0.41, 0.28, 0.06) },
        { at: c(0, 0.175, -0.007), section: rect(0.31, 0.21, 0.06) },
      ],
      FRONT,
    ),
    { bone: 'Spine2', paint: PAINT.frame },
  );

  // Two armor plates over the chest, angled apart from a centre ridge.
  b.add(
    hull(
      [
        { at: c(0.07, -0.07, 0.118), section: rect(0.105, 0.03, 0.01) },
        { at: c(0.092, 0.03, 0.146), section: rect(0.165, 0.036, 0.012) },
        { at: c(0.098, 0.125, 0.141), section: rect(0.185, 0.036, 0.012) },
        { at: c(0.088, 0.168, 0.118), section: rect(0.15, 0.03, 0.012) },
      ],
      vec(0.26, 0, 0.966),
    ),
    { bone: 'Spine2', paint: PAINT.armor, mirror: true },
  );
  b.add(box(c(0, 0.04, 0.148), vec(0.03, 0.2, 0.02), 0.006), { bone: 'Spine2', paint: PAINT.joint });
  b.add(box(c(0, 0.105, 0.159), vec(0.013, 0.022, 0.004)), { bone: 'Spine2', glow: 0.35 });
  // Unit plate, low on its left breast.
  b.add(box(c(0.105, -0.005, 0.164), vec(0.06, 0.024, 0.005), 0.002, tilt(0.24, 0.26)), { bone: 'Spine2', paint: PAINT.hazard });

  // A collar that the head sinks into.
  b.add(box(c(0, 0.2, -0.09), vec(0.25, 0.08, 0.04), 0.012, tilt(0.28)), { bone: 'Spine2', paint: PAINT.armor });
  b.add(box(c(0.132, 0.188, -0.02), vec(0.04, 0.062, 0.135), 0.012, tilt(0, 0, -0.22)), { bone: 'Spine2', paint: PAINT.armor, mirror: true });

  // Yokes carrying the shoulder joints out wide.
  b.add(beam(c(0.14, 0.092, -0.018), rig.at('LeftArm'), 0.088, 0.088, 0.02, UP), { bone: 'LeftShoulder', paint: PAINT.frame, mirror: true });

  // Power pack on its back: the reason it hunches.
  b.add(
    hull(
      [
        { at: c(0, -0.075, -0.185), section: rect(0.2, 0.085, 0.02) },
        { at: c(0, 0.01, -0.2), section: rect(0.27, 0.125, 0.03) },
        { at: c(0, 0.135, -0.2), section: rect(0.27, 0.125, 0.03) },
        { at: c(0, 0.19, -0.18), section: rect(0.2, 0.08, 0.025) },
      ],
      BACK,
    ),
    { bone: 'Spine2', paint: PAINT.armor },
  );
  b.add(
    row(5, (i) => box(c(0, 0.03 + i * 0.022, -0.266), vec(0.17, 0.009, 0.012))),
    { bone: 'Spine2', paint: PAINT.frame },
  );
  // Exhaust stacks, one taller than the other.
  b.add(tube(c(0.085, 0.16, -0.215), c(0.092, 0.31, -0.24), 0.024, 0.027, 10), { bone: 'Spine2', paint: PAINT.joint });
  b.add(tube(c(0.092, 0.305, -0.239), c(0.0923, 0.312, -0.2402), 0.02, 0.02, 10), { bone: 'Spine2', paint: PAINT.lens });
  b.add(tube(c(-0.085, 0.16, -0.215), c(-0.09, 0.245, -0.228), 0.022, 0.025, 10), { bone: 'Spine2', paint: PAINT.joint });
  b.add(tube(c(-0.09, 0.24, -0.2272), c(-0.0903, 0.247, -0.2284), 0.018, 0.018, 10), { bone: 'Spine2', paint: PAINT.lens });
  b.add(
    row(4, (i) => box(c(-0.03 + i * 0.02, 0.205, -0.2), vec(0.006, 0.05, 0.09))),
    { bone: 'Spine2', paint: PAINT.frame },
  );
  // Fuel cell slung across the bottom of the pack.
  b.add(tube(c(-0.085, -0.045, -0.262), c(0.085, -0.045, -0.262), 0.03, 0.03, 10), { bone: 'Spine2', paint: PAINT.hazard });
  b.add(tube(c(0.085, -0.045, -0.262), c(0.1, -0.045, -0.262), 0.03, 0.022, 10), { bone: 'Spine2', paint: PAINT.frame, mirror: true });

  // Feed cables from the pack up into the head and out to the shoulders.
  const headCable = [c(0.062, 0.17, -0.15), c(0.08, 0.25, -0.135), h(0.072, 0.075, -0.1)];
  b.add(cable(headCable, 0.011), {
    bone: [
      { bone: 'Spine2', at: headCable[0]! },
      { bone: 'Head', at: headCable[2]! },
    ],
    paint: PAINT.rubber,
    mirror: true,
  });
  const arm = rig.at('LeftArm');
  const shoulderCable = [c(0.12, 0.12, -0.172), c(0.2, 0.15, -0.13), arm.clone().add(vec(0.02, 0.035, -0.078))];
  b.add(cable(shoulderCable, 0.012), {
    bone: [
      { bone: 'Spine2', at: shoulderCable[0]! },
      { bone: 'LeftArm', at: shoulderCable[2]! },
    ],
    paint: PAINT.rubber,
    mirror: true,
  });

  // Waist: a flexible spine in a rubber bellows, braced by two pistons.
  const spine = [
    { bone: 'Hips', at: rig.at('Hips') },
    { bone: 'Spine', at: rig.at('Spine') },
    { bone: 'Spine1', at: rig.at('Spine1') },
    { bone: 'Spine2', at: rig.at('Spine2') },
  ];
  b.add(ribbed(p(0, 0.03, -0.01), c(0, -0.085, 0.01), 0.062, 0.012, 8, 12), { bone: spine, paint: PAINT.rubber });
  piston(b, p(0.105, 0.03, -0.03), c(0.115, -0.08, -0.02), 'Hips', 'Spine2', 0.018);
  b.add(box(rig.at('Spine').add(vec(0, 0.02, 0.08)), vec(0.14, 0.07, 0.03), 0.01), { bone: 'Spine', paint: PAINT.armor });
  b.add(box(rig.at('Spine1').add(vec(0, 0.012, 0.092)), vec(0.16, 0.075, 0.03), 0.01), { bone: 'Spine1', paint: PAINT.armor });

  // Pelvis block with front, rear and side plates.
  b.add(
    hull(
      [
        { at: p(0, -0.1, 0), section: rect(0.19, 0.125, 0.03) },
        { at: p(0, -0.045, 0), section: rect(0.3, 0.17, 0.035) },
        { at: p(0, 0.012, -0.005), section: rect(0.29, 0.165, 0.035) },
        { at: p(0, 0.045, -0.008), section: rect(0.2, 0.13, 0.03) },
      ],
      FRONT,
    ),
    { bone: 'Hips', paint: PAINT.frame },
  );
  b.add(box(p(0, -0.045, 0.094), vec(0.15, 0.13, 0.025), 0.01, tilt(-0.12)), { bone: 'Hips', paint: PAINT.armor });
  b.add(box(p(0, -0.03, -0.094), vec(0.19, 0.11, 0.025), 0.01, tilt(0.1)), { bone: 'Hips', paint: PAINT.armor });
  b.add(box(p(0.168, -0.04, 0), vec(0.028, 0.14, 0.135), 0.01, tilt(0, 0, 0.1)), { bone: 'Hips', paint: PAINT.armor, mirror: true });
}

function head(rig: Rig, b: RobotBuilder): void {
  const c = from(rig.at('Spine2'));
  const joint = rig.at('Head');
  const h = from(joint);
  /** Adds a part of the head itself, enlarged about the neck joint. */
  const part = (shape: THREE.BufferGeometry, options: PartOptions) => {
    shape.translate(-joint.x, -joint.y, -joint.z).scale(HEAD_SIZE, HEAD_SIZE, HEAD_SIZE).translate(joint.x, joint.y, joint.z);
    b.add(shape, options);
  };

  // Neck: bellows and two thin actuators.
  const neckBase = c(0, 0.165, 0.005);
  const neckTop = h(0, 0.025, -0.005);
  const neck = [
    { bone: 'Spine2', at: neckBase },
    { bone: 'Head', at: neckTop },
  ];
  b.add(ribbed(neckBase, neckTop, 0.046, 0.008, 4, 10), { bone: neck, paint: PAINT.rubber });
  for (const side of [-1, 1]) {
    const a = c(side * 0.055, 0.17, -0.05);
    const z = h(side * 0.066, 0.055, -0.066);
    b.add(tube(a, z, 0.008, 0.008, 6), {
      bone: [
        { bone: 'Spine2', at: a },
        { bone: 'Head', at: z },
      ],
      paint: PAINT.rod,
    });
  }

  // Skull: a low wedge that slopes down toward the face.
  part(
    hull(
      [
        { at: h(0, 0.062, -0.112), section: rect(0.125, 0.095, 0.03) },
        { at: h(0, 0.074, -0.05), section: rect(0.185, 0.15, 0.042) },
        { at: h(0, 0.07, 0.03), section: rect(0.198, 0.156, 0.046) },
        { at: h(0, 0.056, 0.092), section: rect(0.172, 0.118, 0.04) },
        { at: h(0, 0.04, 0.128), section: rect(0.118, 0.07, 0.024) },
      ],
      UP,
    ),
    { bone: 'Head', paint: PAINT.armor },
  );

  // Visor: one black bar across the face with a narrow slit of light that
  // wraps round its corners, so it reads from the side as well.
  part(box(h(0, 0.082, 0.107), vec(0.166, 0.034, 0.034), 0.006), { bone: 'Head', paint: PAINT.lens });
  part(box(h(0, 0.082, 0.1247), vec(0.134, 0.012, 0.003)), { bone: 'Head', glow: 1 });
  part(box(h(0.0838, 0.082, 0.108), vec(0.003, 0.012, 0.024)), { bone: 'Head', glow: 1, mirror: true });
  // Brow overhanging the visor, and a vented jaw under it.
  part(box(h(0, 0.109, 0.103), vec(0.19, 0.02, 0.054), 0.007, tilt(0.5)), { bone: 'Head', paint: PAINT.armor });
  part(box(h(0, 0.022, 0.108), vec(0.124, 0.042, 0.04), 0.01, tilt(-0.25)), { bone: 'Head', paint: PAINT.frame });
  part(
    row(4, (i) => box(h(-0.036 + i * 0.024, 0.02, 0.1295), vec(0.008, 0.028, 0.006), 0, tilt(-0.25))),
    { bone: 'Head', paint: PAINT.lens },
  );
  // Cheek plates and a ridge over the crown.
  part(box(h(0.101, 0.07, -0.015), vec(0.016, 0.1, 0.12), 0.006), { bone: 'Head', paint: PAINT.armor, mirror: true });
  part(box(h(0, 0.151, -0.03), vec(0.045, 0.014, 0.15), 0.004), { bone: 'Head', paint: PAINT.frame });

  // Sensor cluster bolted to its right cheek: two lenses of different sizes.
  part(box(h(-0.113, 0.062, 0.05), vec(0.03, 0.078, 0.078), 0.008), { bone: 'Head', paint: PAINT.frame });
  part(tube(h(-0.115, 0.082, 0.08), h(-0.115, 0.082, 0.103), 0.017, 0.019, 10), { bone: 'Head', paint: PAINT.lens });
  part(tube(h(-0.115, 0.082, 0.1035), h(-0.115, 0.082, 0.105), 0.0085, 0.0085, 8), { bone: 'Head', glow: 0.8 });
  part(tube(h(-0.117, 0.046, 0.078), h(-0.117, 0.046, 0.097), 0.011, 0.0125, 8), { bone: 'Head', paint: PAINT.lens });
  part(tube(h(-0.117, 0.046, 0.0975), h(-0.117, 0.046, 0.099), 0.005, 0.005, 6), { bone: 'Head', glow: 0.5 });

  // Whip antenna behind its left ear.
  part(box(h(0.07, 0.14, -0.07), vec(0.03, 0.022, 0.03), 0.005), { bone: 'Head', paint: PAINT.frame });
  part(tube(h(0.07, 0.15, -0.07), h(0.084, 0.3, -0.1), 0.0055, 0.003, 6), { bone: 'Head', paint: PAINT.rod });
}

function leftArm(rig: Rig, b: RobotBuilder): void {
  const a = from(rig.at('LeftArm'));
  const e = from(rig.at('LeftForeArm'));
  const w = from(rig.at('LeftHand'));
  const mirror = true;

  // Shoulder: a ball joint under a heavy pauldron.
  b.add(ball(a(0, 0, 0), 0.058), { bone: 'LeftArm', paint: PAINT.joint, mirror });
  b.add(
    hull(
      [
        { at: a(-0.08, 0.03, 0), section: rect(0.16, 0.09, [0.035, 0.035, 0.01, 0.01]) },
        { at: a(0.01, 0.048, 0), section: rect(0.215, 0.12, [0.05, 0.05, 0.012, 0.012]) },
        { at: a(0.12, 0.04, 0), section: rect(0.18, 0.095, [0.04, 0.04, 0.01, 0.01]) },
        { at: a(0.17, 0.022, 0), section: rect(0.11, 0.05, [0.02, 0.02, 0.006, 0.006]) },
      ],
      UP,
    ),
    { bone: 'LeftArm', paint: PAINT.armor, mirror },
  );

  // Upper arm: a bare strut with one plate and a piston that works the elbow.
  b.add(beam(a(0.05, -0.005, 0), e(-0.045, -0.005, 0), 0.082, 0.084, 0.02, UP), { bone: 'LeftArm', paint: PAINT.frame, mirror });
  b.add(
    hull(
      [
        { at: a(0.15, 0.046, 0), section: rect(0.105, 0.028, 0.008) },
        { at: e(-0.055, 0.046, 0), section: rect(0.09, 0.028, 0.008) },
      ],
      UP,
    ),
    { bone: 'LeftArm', paint: PAINT.armor, mirror },
  );
  piston(b, a(0.05, -0.056, 0.022), e(0.045, -0.056, 0.022), 'LeftArm', 'LeftForeArm', 0.016);

  // Elbow hinge.
  b.add(tube(e(0, 0, -0.056), e(0, 0, 0.056), 0.044, 0.044, 12), { bone: 'LeftForeArm', paint: PAINT.joint, mirror });
  hingeCaps(b, e(0, 0, -0.056), e(0, 0, 0.056), 'LeftForeArm', 0.024);

  // Forearm: the heavy part. A long armored gauntlet.
  b.add(
    hull(
      [
        { at: e(0.04, 0, 0), section: rect(0.078, 0.084, 0.02) },
        { at: e(0.115, -0.004, 0), section: rect(0.118, 0.124, 0.03) },
        { at: w(-0.107, -0.004, 0), section: rect(0.122, 0.128, 0.03) },
        { at: w(-0.03, 0, 0), section: rect(0.084, 0.09, 0.022) },
      ],
      UP,
    ),
    { bone: 'LeftForeArm', paint: PAINT.armor, mirror },
  );
  b.add(
    hull(
      [
        { at: e(0.1, 0.066, 0), section: rect(0.05, 0.02, 0.006) },
        { at: w(-0.07, 0.062, 0), section: rect(0.044, 0.018, 0.006) },
      ],
      UP,
    ),
    { bone: 'LeftForeArm', paint: PAINT.frame, mirror },
  );
  b.add(
    row(4, (i) => box(e(0.135 + i * 0.03, 0.071, 0), vec(0.012, 0.012, 0.062))),
    { bone: 'LeftForeArm', paint: PAINT.lens, mirror },
  );
  b.add(cable([e(0.02, -0.05, -0.03), e(0.12, -0.078, -0.02), w(-0.06, -0.064, -0.01)], 0.011), { bone: 'LeftForeArm', paint: PAINT.rubber, mirror });
  b.add(ribbed(w(-0.032, 0, 0), w(0.012, 0, 0), 0.04, 0.007, 3, 10), { bone: 'LeftForeArm', paint: PAINT.rubber, mirror });

  // Hand: a palm block and three claws.
  b.add(
    hull(
      [
        { at: w(0.008, 0, 0), section: rect(0.07, 0.05, 0.012) },
        { at: w(0.065, -0.002, 0), section: rect(0.1, 0.046, 0.012) },
        { at: w(0.098, -0.006, 0), section: rect(0.088, 0.034, 0.01) },
      ],
      UP,
    ),
    { bone: 'LeftHand', paint: PAINT.frame, mirror },
  );
  const claw = (base: Vec, knuckle: Vec, tip: Vec, thickness: number) => {
    b.add(
      hull(
        [
          { at: base, section: rect(thickness * 1.15, thickness, thickness * 0.25) },
          { at: knuckle, section: rect(thickness, thickness * 0.85, thickness * 0.22) },
        ],
        UP,
      ),
      { bone: 'LeftHand', paint: PAINT.joint, mirror },
    );
    b.add(
      hull(
        [
          { at: knuckle, section: rect(thickness, thickness * 0.85, thickness * 0.22) },
          { at: tip, section: rect(thickness * 0.3, thickness * 0.3, 0) },
        ],
        UP,
      ),
      { bone: 'LeftHand', paint: PAINT.joint, mirror },
    );
    b.add(ball(knuckle, thickness * 0.62, 0), { bone: 'LeftHand', paint: PAINT.frame, mirror });
  };
  claw(w(0.095, -0.006, 0.034), w(0.165, -0.022, 0.04), w(0.232, -0.062, 0.04), 0.027);
  claw(w(0.095, -0.006, -0.03), w(0.165, -0.022, -0.036), w(0.232, -0.062, -0.036), 0.027);
  claw(w(0.04, -0.02, 0.042), w(0.092, -0.052, 0.078), w(0.146, -0.09, 0.072), 0.025);
}

/** Markings that only one side carries, so the machine is not symmetrical. */
function markings(rig: Rig, b: RobotBuilder): void {
  const a = from(rig.at('LeftArm'));
  const w = from(rig.at('LeftHand'));
  // A hazard band round the left pauldron and another round the left wrist.
  b.add(
    hull(
      [
        { at: a(-0.002, 0.049, 0), section: rect(0.221, 0.126, [0.052, 0.052, 0.012, 0.012]) },
        { at: a(0.04, 0.047, 0), section: rect(0.214, 0.121, [0.05, 0.05, 0.012, 0.012]) },
      ],
      UP,
      'none',
    ),
    { bone: 'LeftArm', paint: PAINT.hazard },
  );
  b.add(
    hull(
      [
        { at: w(-0.118, -0.003, 0), section: rect(0.129, 0.135, 0.032) },
        { at: w(-0.086, -0.003, 0), section: rect(0.122, 0.128, 0.031) },
      ],
      UP,
      'none',
    ),
    { bone: 'LeftForeArm', paint: PAINT.hazard },
  );
}

function leftLeg(rig: Rig, b: RobotBuilder): void {
  const hip = from(rig.at('LeftUpLeg'));
  const knee = from(rig.at('LeftLeg'));
  const ankleAt = rig.at('LeftFoot');
  const ankle = from(ankleAt);
  const toeAt = rig.at('LeftToeBase');
  const mirror = true;

  // Hip joint and an armored thigh, as heavy as the forearms.
  b.add(ball(hip(0, 0, 0), 0.066), { bone: 'LeftUpLeg', paint: PAINT.joint, mirror });
  b.add(
    hull(
      [
        { at: hip(0.004, -0.045, 0.004), section: rect(0.1, 0.112, 0.028) },
        { at: hip(0.008, -0.17, 0.012), section: rect(0.132, 0.146, 0.036) },
        { at: knee(0.004, 0.075, 0.006), section: rect(0.098, 0.108, 0.026) },
      ],
      FRONT,
    ),
    { bone: 'LeftUpLeg', paint: PAINT.armor, mirror },
  );
  b.add(
    hull(
      [
        { at: hip(0.008, -0.08, 0.072), section: rect(0.06, 0.02, 0.006) },
        { at: hip(0.009, -0.19, 0.09), section: rect(0.07, 0.022, 0.006) },
        { at: knee(0.005, 0.1, 0.066), section: rect(0.05, 0.02, 0.006) },
      ],
      FRONT,
    ),
    { bone: 'LeftUpLeg', paint: PAINT.frame, mirror },
  );
  b.add(
    hull(
      [
        { at: hip(0.074, -0.07, 0.004), section: rect(0.09, 0.024, 0.008) },
        { at: knee(0.062, 0.11, 0.004), section: rect(0.072, 0.022, 0.008) },
      ],
      OUT,
    ),
    { bone: 'LeftUpLeg', paint: PAINT.armorWorn, mirror },
  );
  piston(b, hip(0, -0.05, -0.074), knee(0, -0.035, -0.072), 'LeftUpLeg', 'LeftLeg', 0.017);

  // Knee hinge and cap.
  b.add(tube(knee(-0.068, 0, 0), knee(0.068, 0, 0), 0.052, 0.052, 12), { bone: 'LeftLeg', paint: PAINT.joint, mirror });
  hingeCaps(b, knee(-0.068, 0, 0), knee(0.068, 0, 0), 'LeftLeg', 0.028);
  b.add(box(knee(0, 0.012, 0.07), vec(0.1, 0.12, 0.034), 0.014, tilt(0.12)), { bone: 'LeftLeg', paint: PAINT.armorWorn, mirror });

  // Shin: an armored greave with a ridge down the front and a calf piston.
  b.add(
    hull(
      [
        { at: knee(0, -0.05, 0), section: rect(0.088, 0.098, 0.022) },
        { at: knee(-0.001, -0.16, -0.004), section: rect(0.128, 0.148, 0.034) },
        { at: knee(-0.002, -0.31, -0.012), section: rect(0.102, 0.118, 0.026) },
        { at: ankle(0, 0.045, 0.002), section: rect(0.072, 0.082, 0.018) },
      ],
      FRONT,
    ),
    { bone: 'LeftLeg', paint: PAINT.armorWorn, mirror },
  );
  b.add(
    hull(
      [
        { at: knee(0, -0.085, 0.07), section: rect(0.05, 0.02, 0.006) },
        { at: knee(0, -0.2, 0.074), section: rect(0.056, 0.022, 0.006) },
        { at: ankle(0, 0.09, 0.05), section: rect(0.038, 0.018, 0.005) },
      ],
      FRONT,
    ),
    { bone: 'LeftLeg', paint: PAINT.frame, mirror },
  );
  piston(b, knee(0, -0.06, -0.078), ankle(0, -0.04, -0.076), 'LeftLeg', 'LeftFoot', 0.016);

  // Ankle and a broad, plated foot with a heel spur.
  b.add(ball(ankle(0, 0, 0), 0.045), { bone: 'LeftFoot', paint: PAINT.joint, mirror });
  b.add(
    hull(
      [
        { at: vec(ankleAt.x, 0.052, ankleAt.z - 0.09), section: rect(0.085, 0.075, 0.016) },
        { at: vec(ankleAt.x, 0.06, ankleAt.z), section: rect(0.115, 0.1, 0.022) },
        { at: vec(toeAt.x, 0.045, toeAt.z - 0.015), section: rect(0.125, 0.072, 0.02) },
      ],
      UP,
    ),
    { bone: 'LeftFoot', paint: PAINT.frame, mirror },
  );
  b.add(box(vec(ankleAt.x, 0.08, ankleAt.z - 0.112), vec(0.06, 0.1, 0.032), 0.01, tilt(-0.3)), { bone: 'LeftFoot', paint: PAINT.armorWorn, mirror });
  b.add(
    hull(
      [
        { at: vec(toeAt.x, 0.04, toeAt.z - 0.012), section: rect(0.125, 0.062, 0.016) },
        { at: vec(toeAt.x, 0.028, toeAt.z + 0.105), section: rect(0.1, 0.038, 0.012) },
      ],
      UP,
    ),
    { bone: 'LeftToeBase', paint: PAINT.armorWorn, mirror },
  );
}

export const DRUDGE: RobotDesign = {
  proportions: { shoulders: 1.32, hips: 1.24, upperArm: 1.04, forearm: 1.24, neck: 0.72, thigh: 1, shin: 1 },
  // The recorded motion already stoops. This rounds the back a little more
  // and then lifts the head, so the visor stays on its target.
  posture: [
    { bone: 'Spine1', forward: 4 },
    { bone: 'Spine2', forward: 6 },
    { bone: 'Neck', forward: -8 },
    { bone: 'Head', forward: -9 },
  ],
  scale: 1.05,
  weakPoint: { centre: [0, 0.07 * HEAD_SIZE, 0.005], radius: 0.14 * HEAD_SIZE },
  glow: { at: [0, 0.082 * HEAD_SIZE, 0.13 * HEAD_SIZE], size: [0.42, 0.14] },
  build(rig, builder) {
    torso(rig, builder);
    head(rig, builder);
    leftArm(rig, builder);
    leftLeg(rig, builder);
    markings(rig, builder);
  },
};
