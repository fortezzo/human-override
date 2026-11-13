// Prints a short summary of one or more GLB files: meshes, materials,
// textures, skeleton and animation clips. Used while building the asset
// pipeline to see what a downloaded model actually contains.
//
//   node tools/dev/inspect-glb.mjs path/to/a.glb [path/to/b.glb ...]

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

const verbose = process.argv.includes('--bones');

for (const file of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  console.log(`\n=== ${file}`);

  const scene = root.listScenes()[0];
  if (scene) {
    const b = getBounds(scene);
    const size = b.max.map((v, i) => (v - b.min[i]).toFixed(3));
    console.log(`bounds min ${b.min.map((v) => v.toFixed(3))} max ${b.max.map((v) => v.toFixed(3))} size ${size}`);
  }

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      const tris = (idx ? idx.getCount() : pos.getCount()) / 3;
      const attrs = prim.listSemantics().join(',');
      const mat = prim.getMaterial();
      console.log(`mesh "${mesh.getName()}" verts ${pos.getCount()} tris ${tris} attrs [${attrs}] material "${mat ? mat.getName() : '-'}"`);
    }
  }

  for (const mat of root.listMaterials()) {
    const tex = (t) => (t ? `${t.getName() || t.getURI() || 'tex'} ${t.getSize()?.join('x')} ${t.getMimeType()}` : '-');
    console.log(
      `material "${mat.getName()}" base ${mat.getBaseColorFactor().map((v) => v.toFixed(2))} metal ${mat.getMetallicFactor()} rough ${mat.getRoughnessFactor()}` +
        `\n   baseColor: ${tex(mat.getBaseColorTexture())}\n   normal: ${tex(mat.getNormalTexture())}\n   orm: ${tex(mat.getMetallicRoughnessTexture())}\n   ao: ${tex(mat.getOcclusionTexture())}\n   emissive: ${tex(mat.getEmissiveTexture())}`,
    );
  }

  for (const skin of root.listSkins()) {
    const joints = skin.listJoints();
    console.log(`skin "${skin.getName()}" joints ${joints.length}`);
    if (verbose) console.log('   ' + joints.map((j) => j.getName()).join(', '));
  }

  for (const anim of root.listAnimations()) {
    let duration = 0;
    for (const s of anim.listSamplers()) {
      const input = s.getInput();
      if (input) duration = Math.max(duration, input.getMax([])[0]);
    }
    console.log(`animation "${anim.getName()}" channels ${anim.listChannels().length} duration ${duration.toFixed(2)}s`);
  }

  if (verbose) {
    const walk = (node, depth) => {
      const t = node.getTranslation().map((v) => v.toFixed(3));
      const s = node.getScale().map((v) => v.toFixed(3));
      console.log(`${'  '.repeat(depth)}- ${node.getName()} t[${t}] s[${s}]${node.getMesh() ? ' <mesh>' : ''}${node.getSkin() ? ' <skin>' : ''}`);
      if (depth < 3) for (const c of node.listChildren()) walk(c, depth + 1);
    };
    for (const n of scene.listChildren()) walk(n, 0);
  }
}
