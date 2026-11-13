// Dev helper: prints the bounding box of every converted prop (and of each
// kit piece), so props can be placed without guessing where their origin is.
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const dir = 'public/assets/models/props';
const f = (v) => v.map((n) => n.toFixed(2).padStart(6)).join(' ');
for (const file of fs.readdirSync(dir)) {
  const doc = await io.read(`${dir}/${file}`);
  const scene = doc.getRoot().listScenes()[0];
  const children = scene.listChildren();
  const b = getBounds(scene);
  console.log(`${file.replace('.glb', '').padEnd(32)} min[${f(b.min)}] max[${f(b.max)}]`);
  if (children.length > 1) {
    for (const node of children) {
      const nb = getBounds(node);
      console.log(`    ${node.getName().padEnd(28)} min[${f(nb.min)}] max[${f(nb.max)}]`);
    }
  }
}
