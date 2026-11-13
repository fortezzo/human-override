// Dev helper: prints the node tree (names, mesh triangle counts, materials)
// of every downloaded Poly Haven model so kits and variants can be identified.
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const root = 'assets-source/_downloads/polyhaven/models';
const only = process.argv.slice(2);
for (const id of fs.readdirSync(root)) {
  if (only.length && !only.includes(id)) continue;
  const doc = await io.read(path.join(root, id, `${id}.gltf`));
  const r = doc.getRoot();
  const scene = r.listScenes()[0];
  const b = getBounds(scene);
  let total = 0;
  const lines = [];
  const walk = (node, depth) => {
    const mesh = node.getMesh();
    let info = '';
    if (mesh) {
      let tris = 0;
      const mats = new Set();
      for (const p of mesh.listPrimitives()) {
        tris += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;
        mats.add(p.getMaterial()?.getName());
      }
      total += tris;
      info = ` tris ${tris} mat [${[...mats].join(',')}]`;
    }
    const t = node.getTranslation().map((v) => v.toFixed(2)).join(',');
    lines.push(`${'  '.repeat(depth + 1)}${node.getName()} @(${t})${info}`);
    for (const c of node.listChildren()) walk(c, depth + 1);
  };
  for (const n of scene.listChildren()) walk(n, 0);
  const size = b.max.map((v, i) => (v - b.min[i]).toFixed(2)).join(' x ');
  console.log(`\n${id}: ${total} tris, size ${size}, min.y ${b.min[1].toFixed(2)}, materials: ${r.listMaterials().map((m) => m.getName()).join(', ')}`);
  console.log(lines.slice(0, 40).join('\n') + (lines.length > 40 ? `\n   ... ${lines.length - 40} more nodes` : ''));
}
