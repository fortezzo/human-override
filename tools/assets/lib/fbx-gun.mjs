// Turns a gun that was downloaded as an FBX scene into one small game file.
//
// An FBX scene holds whatever its author left in it: the gun in its own
// units, facing its own way, often with display props beside it. This keeps
// only the gun, bakes every part's position into its geometry, re-centres
// it, scales it to real-world size, turns the muzzle to -Z (the direction
// the player looks), packs its texture images, and compresses the result.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { getBounds, join, meshopt, prune, simplify, transformMesh, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { addBoxUvs } from './box-uv.mjs';

const require = createRequire(import.meta.url);
const platformDir = process.platform === 'win32' ? 'Windows_NT' : process.platform === 'darwin' ? 'Darwin' : 'Linux';
const fbx2gltf = path.join(path.dirname(require.resolve('fbx2gltf/package.json')), 'bin', platformDir, process.platform === 'win32' ? 'FBX2glTF.exe' : 'FBX2glTF');

/** One 8-bit greyscale channel of an image, at `size` pixels square. `pick` is 'grey' or a channel number. */
async function channel(file, size, pick) {
  let img = sharp(file).resize(size, size);
  img = pick === 'grey' ? img.removeAlpha().greyscale() : img.extractChannel(pick);
  return img.toColourspace('b-w').raw({ depth: 'uchar' }).toBuffer();
}

/** Rotations about the vertical axis that send each source direction to -Z (row-major 3x3). */
const TURN = {
  '+z': [-1, 0, 0, 0, 1, 0, 0, 0, -1],
  '-z': [1, 0, 0, 0, 1, 0, 0, 0, 1],
  '+x': [0, 0, 1, 0, 1, 0, -1, 0, 0],
  '-x': [0, 0, -1, 0, 1, 0, 1, 0, 0],
};

/**
 * @param io       a gltf-transform NodeIO with the meshopt codecs registered
 * @param options.name     output name (public/assets/models/<name>.glb)
 * @param options.src      folder holding the extracted download
 * @param options.fbx      the scene file, relative to `src`
 * @param options.keep     (materialName, nodeName) => true for parts of the gun itself
 * @param options.length   real length in metres, muzzle to the back of the gun
 * @param options.forward  the source axis the muzzle points along: '+z', '-z', '+x' or '-x'
 * @param options.level    degrees to tip the gun back so its barrel is level (for guns posed at an angle)
 * @param options.maps     texture file names: color, normal, ao, metal, and either
 *                         rough or (Unity style) smoothness in the metal image's alpha; optional emissive
 * @param options.parts    instead of `maps`, for a gun whose own images are not used: the name each of
 *                         the source's materials is to have in the game file ({ sourceName: partName }).
 *                         The parts come out untextured, with box-projected UVs (one repeat every
 *                         `options.boxUv` metres), and the game paints them itself.
 * @param options.simplifyTo  for a model far heavier than it needs to be: the number of triangles to keep
 * @returns a one-line description, or null if the download is missing
 */
export async function buildFbxGun(io, { name, src, fbx, keep, length, forward, level, colorSize, ormSize, maps, parts: partNames, boxUv, simplifyTo, outDir, tempDir }) {
  if (!fs.existsSync(src)) return null;
  const temp = path.join(tempDir, name);
  fs.mkdirSync(tempDir, { recursive: true });
  execFileSync(fbx2gltf, ['--binary', '--input', path.join(src, fbx), '--output', temp], { stdio: 'pipe' });
  const doc = await io.read(temp + '.glb');
  const root = doc.getRoot();
  const scene = root.listScenes()[0];

  // Keep only the gun, with each part's position baked into its geometry.
  const parts = [];
  const visit = (node) => {
    for (const child of node.listChildren()) visit(child);
    const mesh = node.getMesh();
    if (mesh && mesh.listPrimitives().every((p) => keep(p.getMaterial()?.getName() ?? '', node.getName()))) {
      transformMesh(mesh, node.getWorldMatrix());
      parts.push(mesh);
    }
  };
  for (const node of scene.listChildren()) visit(node);
  for (const node of root.listNodes()) node.dispose();
  for (const mesh of root.listMeshes()) if (!parts.includes(mesh)) mesh.dispose();
  for (const mesh of parts) scene.addChild(doc.createNode(name).setMesh(mesh));

  // Turn the muzzle to -Z, level the barrel if the author left the gun
  // tipped over, then scale to real size and centre it on the origin.
  const r = TURN[forward];
  const tip = ((level ?? 0) * Math.PI) / 180;
  const c = Math.cos(tip);
  const s = Math.sin(tip);
  // Column-major 4x4 matrices.
  const turn = [r[0], r[3], r[6], 0, r[1], r[4], r[7], 0, r[2], r[5], r[8], 0, 0, 0, 0, 1];
  const tilt = [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  for (const mesh of parts) {
    transformMesh(mesh, turn);
    if (tip !== 0) transformMesh(mesh, tilt);
  }
  const bounds = getBounds(scene);
  const centre = bounds.min.map((m, k) => (m + bounds.max[k]) / 2);
  const scale = length / (bounds.max[2] - bounds.min[2]);
  const fit = [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, -centre[0] * scale, -centre[1] * scale, -centre[2] * scale, 1];
  for (const mesh of parts) transformMesh(mesh, fit);

  if (partNames) {
    // The game paints this one: each of its materials is kept as a named
    // part with no images of its own.
    for (const texture of root.listTextures()) texture.dispose();
    const made = new Map();
    let before = 0;
    for (const mesh of parts) {
      for (const prim of mesh.listPrimitives()) {
        const part = partNames[prim.getMaterial()?.getName() ?? ''] ?? Object.values(partNames)[0];
        if (!made.has(part)) made.set(part, doc.createMaterial(part).setBaseColorFactor([0.8, 0.8, 0.8, 1]).setMetallicFactor(1).setRoughnessFactor(0.5));
        prim.setMaterial(made.get(part));
        before += (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;
      }
    }
    for (const material of root.listMaterials()) if (![...made.values()].includes(material)) material.dispose();
    await doc.transform(weld(), ...(simplifyTo && simplifyTo < before ? [simplify({ simplifier: MeshoptSimplifier, ratio: simplifyTo / before, error: 0.004, lockBorder: false })] : []));
    for (const mesh of parts) addBoxUvs(doc, mesh, boxUv ?? 0.2);
    let after = 0;
    for (const mesh of parts) for (const prim of mesh.listPrimitives()) after += prim.getIndices().getCount() / 3;
    // (The UVs are kept although nothing in this file uses them: the game's own surfaces will.)
    await doc.transform(join(), prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const out = path.join(outDir, `${name}.glb`);
    await io.write(out, doc);
    const size = getBounds(doc.getRoot().listScenes()[0]);
    const dims = size.max.map((v, k) => (v - size.min[k]).toFixed(3)).join(' x ');
    return `${name}: ${after} tris (of ${before}), parts ${[...made.keys()].join(', ')}, ${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${dims} m`;
  }

  // One material from the gun's own images, with AO / roughness / metalness packed into R / G / B.
  const tex = (file) => path.join(src, 'textures', file);
  const ao = await channel(tex(maps.ao), ormSize, 'grey');
  const metal = await channel(tex(maps.metal), ormSize, 0);
  let rough;
  if (maps.rough) rough = await channel(tex(maps.rough), ormSize, 'grey');
  else rough = Buffer.from((await channel(tex(maps.metal), ormSize, 3)).map((v) => 255 - v));
  const orm = Buffer.alloc(ormSize * ormSize * 3);
  for (let i = 0; i < ormSize * ormSize; i++) {
    orm[i * 3] = ao[i];
    orm[i * 3 + 1] = rough[i];
    orm[i * 3 + 2] = metal[i];
  }
  for (const texture of root.listTextures()) texture.dispose();
  for (const material of root.listMaterials()) material.dispose();
  const image = (file, size, options) => sharp(tex(file)).removeAlpha().toColourspace('srgb').resize(size, size).webp(options).toBuffer();
  const texture = (label, data) => doc.createTexture(`${name}_${label}`).setMimeType('image/webp').setImage(data);
  const ormTex = texture('orm', await sharp(orm, { raw: { width: ormSize, height: ormSize, channels: 3 } }).webp({ quality: 80, effort: 6 }).toBuffer());
  const material = doc
    .createMaterial(name)
    .setBaseColorTexture(texture('color', await image(maps.color, colorSize, { quality: 82, effort: 6 })))
    .setNormalTexture(texture('normal', await image(maps.normal, colorSize, { quality: 86, effort: 6, smartSubsample: true })))
    .setMetallicRoughnessTexture(ormTex)
    .setOcclusionTexture(ormTex)
    .setRoughnessFactor(1)
    .setMetallicFactor(1);
  if (maps.emissive) material.setEmissiveTexture(texture('glow', await image(maps.emissive, 512, { quality: 80 }))).setEmissiveFactor([1, 1, 1]);

  let triangles = 0;
  for (const mesh of parts) {
    for (const prim of mesh.listPrimitives()) {
      prim.setMaterial(material);
      triangles += (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;
    }
  }

  await doc.transform(join(), weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = path.join(outDir, `${name}.glb`);
  await io.write(out, doc);
  const size = getBounds(doc.getRoot().listScenes()[0]);
  const dims = size.max.map((v, k) => (v - size.min[k]).toFixed(3)).join(' x ');
  return `${name}: ${triangles} tris, ${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${dims} m`;
}
