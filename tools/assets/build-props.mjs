// Converts the downloaded Poly Haven models into small game-ready GLB files:
//
//   - unwanted variants are dropped and kit pieces are re-centred
//   - triangle counts are reduced to the budget in the manifest
//   - textures are resized and stored as WebP
//   - geometry is compressed with Meshopt
//
//   node tools/assets/build-props.mjs            all props
//   node tools/assets/build-props.mjs Barrel_01  just the ones named

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { DOWNLOAD_DIR, POLYHAVEN_MODELS } from './manifest.mjs';

const OUT_DIR = 'public/assets/models/props';
fs.mkdirSync(OUT_DIR, { recursive: true });

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});

// Material extensions that would force three.js onto its slowest shader path.
const HEAVY_EXTENSIONS = ['KHR_materials_transmission', 'KHR_materials_specular', 'KHR_materials_ior', 'KHR_materials_volume'];

function triangleCount(doc) {
  let total = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      total += (indices ? indices.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
    }
  }
  return total;
}

async function build(entry) {
  const { id, tex, tris, keep, kit, groups } = entry;
  const doc = await io.read(path.join(DOWNLOAD_DIR, 'polyhaven', 'models', id, `${id}.gltf`));
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const original = triangleCount(doc);

  // 1. Drop variants we do not ship (for example the graffiti shutters).
  if (keep) {
    for (const node of scene.listChildren()) {
      if (!keep.test(node.getName())) node.dispose();
    }
  }

  // 2. Bundle multi-node props into one named group, centred on a chosen part.
  if (groups) {
    const claimed = new Set();
    for (const group of groups) {
      const members = scene.listChildren().filter((n) => group.match.test(n.getName()));
      const originNode = members.find((n) => n.getName() === group.origin);
      if (!originNode) throw new Error(`${id}: group origin "${group.origin}" not found`);
      const origin = originNode.getTranslation();
      const parent = doc.createNode(group.name);
      scene.addChild(parent);
      for (const node of members) {
        const t = node.getTranslation();
        node.setTranslation([t[0] - origin[0], t[1] - origin[1], t[2] - origin[2]]);
        parent.addChild(node);
        claimed.add(node);
      }
    }
    for (const node of scene.listChildren()) {
      if (!claimed.has(node) && !groups.some((g) => g.name === node.getName())) node.dispose();
    }
  }

  // 3. Kits: each piece sits at the origin so the game can place it anywhere.
  if (kit) {
    for (const node of scene.listChildren()) node.setTranslation([0, 0, 0]);
  }

  // Remove the geometry of dropped nodes before measuring what is left.
  await doc.transform(prune());
  const before = triangleCount(doc);

  for (const material of root.listMaterials()) {
    for (const ext of material.listExtensions()) {
      if (HEAVY_EXTENSIONS.includes(ext.extensionName)) material.setExtension(ext.extensionName, null);
    }
  }

  const transforms = [dedup()];
  // Single props collapse into one mesh per material; kits keep their pieces.
  if (!kit && !groups) transforms.push(flatten());
  if (!kit) transforms.push(join({ keepNamed: false }));
  transforms.push(weld());
  if (tris && before > tris) {
    transforms.push(simplify({ simplifier: MeshoptSimplifier, ratio: tris / before, error: 0.01, lockBorder: false }));
  }
  transforms.push(
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 80, effort: 6 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await doc.transform(...transforms);

  // Name top-level nodes predictably: kit pieces lose the "<id>_" prefix.
  for (const node of scene.listChildren()) {
    const name = node.getName();
    if (name.startsWith(`${id}_`)) node.setName(name.slice(id.length + 1));
  }

  const out = path.join(OUT_DIR, `${id}.glb`);
  await io.write(out, doc);
  const after = triangleCount(doc);
  const parts = scene.listChildren().map((n) => n.getName());
  console.log(
    `  ${id.padEnd(32)} ${String(original).padStart(6)} -> ${String(after).padStart(5)} tris  ${(fs.statSync(out).size / 1024).toFixed(0).padStart(5)} KB` +
      (parts.length > 1 ? `  parts: ${parts.join(', ')}` : ''),
  );
}

const only = process.argv.slice(2);
let failed = 0;
for (const entry of POLYHAVEN_MODELS) {
  if (only.length && !only.includes(entry.id)) continue;
  try {
    await build(entry);
  } catch (err) {
    failed++;
    console.error(`  ! ${entry.id}: ${err.message}`);
  }
}

const total = fs.readdirSync(OUT_DIR).reduce((sum, f) => sum + fs.statSync(path.join(OUT_DIR, f)).size, 0);
console.log(`Props total: ${(total / 1024 / 1024).toFixed(2)} MB${failed ? `, ${failed} FAILED` : ''}`);
process.exit(failed ? 1 : 0);
