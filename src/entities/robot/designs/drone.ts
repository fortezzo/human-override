// The Drone: a small flying unit, fast and fragile.
//
// It is hung on the same skeleton as every other robot, which is what
// lets it share their animation, their hit testing and the way they break
// apart; but nothing is built on the limbs. The whole of it rides on the
// upper spine: a flat hull with a single eye, four rotors on short booms,
// and a stinger slung underneath. The game holds it in the air.
//
// Measurements are metres in the rest pose, +X to its left, +Y up, +Z the
// way it faces, given from the upper-spine joint.
//
// Built from the same model, so it needs no assets of its own.

import { PAINT, type RobotDesign } from '../kit/design';
import type { RobotBuilder } from '../kit/RobotBuilder';
import type { Rig } from '../kit/Rig';
import { box, hull, rect, tube, vec, type Vec } from '../../../render/shapes';
import { DRUDGE } from './drudge';

const UP = vec(0, 1, 0);
const FRONT = vec(0, 0, 1);

const from =
  (origin: Vec) =>
  (x: number, y: number, z: number): Vec =>
    origin.clone().add(vec(x, y, z));

/** How far out the rotors sit from the middle of the hull, sideways and fore-and-aft. */
const ARM = { x: 0.3, z: 0.27 };
const ROTOR = 0.165;

function body(rig: Rig, b: RobotBuilder): void {
  const c = from(rig.at('Spine2'));
  const bone = 'Spine2';

  // Hull: a flat wedge, deeper at the back where the cells are.
  b.add(
    hull(
      [
        { at: c(0, 0, -0.2), section: rect(0.2, 0.11, 0.03) },
        { at: c(0, 0.005, -0.06), section: rect(0.3, 0.13, 0.04) },
        { at: c(0, 0, 0.1), section: rect(0.26, 0.1, 0.035) },
        { at: c(0, -0.01, 0.21), section: rect(0.13, 0.06, 0.02) },
      ],
      FRONT,
    ),
    { bone, paint: PAINT.armor },
  );
  // A spine plate along the top and a cell pack under the back.
  b.add(box(c(0, 0.07, -0.05), vec(0.1, 0.02, 0.26), 0.008), { bone, paint: PAINT.frame });
  b.add(box(c(0, -0.07, -0.1), vec(0.16, 0.05, 0.16), 0.012), { bone, paint: PAINT.armorWorn });
  b.add(box(c(0, -0.1, -0.1), vec(0.11, 0.012, 0.11), 0.004), { bone, paint: PAINT.hazard });

  // The eye: a dark lens in the nose with a slit of light across it, and a small lamp on each cheek.
  b.add(box(c(0, -0.005, 0.2), vec(0.11, 0.05, 0.03), 0.008), { bone, paint: PAINT.lens });
  b.add(box(c(0, -0.003, 0.217), vec(0.085, 0.013, 0.004)), { bone, glow: 1 });
  b.add(box(c(0.1, 0.0, 0.14), vec(0.008, 0.012, 0.03)), { bone, glow: 0.8, mirror: true });

  // Four booms out to the rotors (the left pair; the builder mirrors them).
  for (const z of [ARM.z, -ARM.z]) {
    const hub = c(ARM.x, 0.035, z);
    b.add(tube(c(0.09, 0.01, z * 0.45), hub, 0.017, 0.013, 8), { bone, paint: PAINT.frame, mirror: true });
    // Motor, and a guard ring round the rotor's sweep, held on three spokes.
    b.add(tube(hub.clone().addScaledVector(UP, -0.03), hub.clone().addScaledVector(UP, 0.02), 0.03, 0.026, 10), { bone, paint: PAINT.joint, mirror: true });
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2;
      const a1 = ((i + 1) / 12) * Math.PI * 2;
      const p0 = hub.clone().add(vec(Math.cos(a0) * ROTOR, 0.005, Math.sin(a0) * ROTOR));
      const p1 = hub.clone().add(vec(Math.cos(a1) * ROTOR, 0.005, Math.sin(a1) * ROTOR));
      b.add(tube(p0, p1, 0.008, 0.008, 5), { bone, paint: PAINT.frame, mirror: true });
    }
    // The rotor itself, turning too fast to see: a disc of dark glass, and a lit hub.
    b.add(tube(hub.clone().addScaledVector(UP, 0.024), hub.clone().addScaledVector(UP, 0.028), ROTOR - 0.012, ROTOR - 0.012, 18), { bone, paint: PAINT.lens, mirror: true });
    b.add(tube(hub.clone().addScaledVector(UP, 0.029), hub.clone().addScaledVector(UP, 0.034), 0.016, 0.016, 8), { bone, glow: 0.7, mirror: true });
  }

  // The stinger: a prod slung under the nose with a lit tip, and two whip aerials at the back.
  b.add(tube(c(0, -0.05, 0.08), c(0, -0.11, 0.26), 0.014, 0.008, 8), { bone, paint: PAINT.joint });
  b.add(tube(c(0, -0.11, 0.26), c(0, -0.118, 0.285), 0.01, 0.004, 8), { bone, glow: 1 });
  b.add(tube(c(0.05, 0.06, -0.17), c(0.08, 0.22, -0.25), 0.004, 0.002, 5), { bone, paint: PAINT.rod, mirror: true });
}

export const DRONE: RobotDesign = {
  proportions: DRUDGE.proportions,
  posture: [],
  scale: 0.9,
  flies: true,
  // Nothing on it is tougher than the rest: it has no weak point, and one sphere to hit.
  weakPoint: { centre: [0, 0, 0], radius: 0 },
  hitShape: { bone: 'Spine2', centre: [0, 0, 0], radius: 0.3 },
  glow: { bone: 'Spine2', at: [0, -0.003, 0.24], size: [0.34, 0.12] },
  build(rig, builder) {
    body(rig, builder);
  },
};
