// Prints, for each GLB given, every animation clip with its duration and how
// far the hips travel (to tell "in place" clips from root-motion clips).
//
//   node tools/dev/inspect-anim.mjs a.glb b.glb ...

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  const skinned = root.listMeshes().length > 0;
  for (const anim of root.listAnimations()) {
    let duration = 0;
    let hips = '';
    let keys = 0;
    for (const ch of anim.listChannels()) {
      const s = ch.getSampler();
      const input = s.getInput();
      duration = Math.max(duration, input.getMax([])[0]);
      keys = Math.max(keys, input.getCount());
      const node = ch.getTargetNode();
      if (node && node.getName() === 'mixamorig:Hips' && ch.getTargetPath() === 'translation') {
        const out = s.getOutput();
        const min = out.getMin([]);
        const max = out.getMax([]);
        const first = out.getElement(0, []);
        const last = out.getElement(out.getCount() - 1, []);
        hips = `hips x[${min[0].toFixed(2)},${max[0].toFixed(2)}] y[${min[1].toFixed(2)},${max[1].toFixed(2)}] z[${min[2].toFixed(2)},${max[2].toFixed(2)}] first(${first.map((v) => v.toFixed(2))}) last(${last.map((v) => v.toFixed(2))})`;
      }
    }
    console.log(`${file.split('/').pop().padEnd(34)} ${skinned ? 'skin' : '    '} "${anim.getName()}" ch ${anim.listChannels().length} keys ${keys} dur ${duration.toFixed(2)}s ${hips}`);
  }
}
