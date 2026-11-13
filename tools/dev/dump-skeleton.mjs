// Dev helper: prints every bone of a GLB in its rest pose: where it is in
// the world, and which way its local axes point. Used when designing parts
// that attach to the robot's skeleton.
//
//   node tools/dev/dump-skeleton.mjs public/assets/models/robot.glb

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
const skin = doc.getRoot().listSkins()[0];
const joints = skin ? skin.listJoints() : doc.getRoot().listNodes();

const f = (n) => (Math.abs(n) < 0.0005 ? 0 : n).toFixed(3).padStart(7);
const axis = (m, c) => {
  const v = [m[c * 4], m[c * 4 + 1], m[c * 4 + 2]];
  const len = Math.hypot(...v) || 1;
  // Name the world axis this local axis mostly points along.
  const i = v.map(Math.abs).indexOf(Math.max(...v.map(Math.abs)));
  return `${v[i] < 0 ? '-' : '+'}${'XYZ'[i]}${Math.abs(v[i] / len) < 0.97 ? '~' : ' '}`;
};

console.log('bone'.padEnd(20), '   world x      y      z   | local X,Y,Z point along | parent');
for (const joint of joints) {
  if (/Hand(Thumb|Index|Middle|Ring|Pinky)[234]/.test(joint.getName())) continue;
  const m = joint.getWorldMatrix();
  const parent = joint.getParentNode();
  console.log(joint.getName().padEnd(20), f(m[12]), f(m[13]), f(m[14]), ' |', axis(m, 0), axis(m, 1), axis(m, 2), ' |', parent ? parent.getName() : '-');
}
