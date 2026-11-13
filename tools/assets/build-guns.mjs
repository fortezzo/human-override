// Converts the Sketchfab gun downloads in assets-source/guns into game files.
//
// Stage 0 ships the rifle only:
//   public/assets/models/rifle.glb
//
// The source is an OBJ in arbitrary units sitting far from the origin, so it
// is re-centred, scaled to real-world size and turned to point down -Z (the
// direction the player looks). Its separate AO / roughness / metalness
// images are packed into one texture.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const WORK = 'assets-source/_work/guns';
const OUT_DIR = 'public/assets/models';
fs.mkdirSync(OUT_DIR, { recursive: true });

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});

/** Minimal Wavefront OBJ reader: one mesh, triangles or polygons. */
function readObj(file) {
  const v = [];
  const vt = [];
  const vn = [];
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const lookup = new Map();

  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v') v.push(parts.slice(1, 4).map(Number));
    else if (parts[0] === 'vt') vt.push(parts.slice(1, 3).map(Number));
    else if (parts[0] === 'vn') vn.push(parts.slice(1, 4).map(Number));
    else if (parts[0] === 'f') {
      const corners = parts.slice(1).map((corner) => {
        let index = lookup.get(corner);
        if (index === undefined) {
          const [pi, ti, ni] = corner.split('/').map((n) => (n ? parseInt(n, 10) - 1 : -1));
          index = positions.length / 3;
          positions.push(...v[pi]);
          uvs.push(...(ti >= 0 ? [vt[ti][0], 1 - vt[ti][1]] : [0, 0]));
          normals.push(...(ni >= 0 ? vn[ni] : [0, 1, 0]));
          lookup.set(corner, index);
        }
        return index;
      });
      for (let i = 1; i < corners.length - 1; i++) indices.push(corners[0], corners[i], corners[i + 1]);
    }
  }
  return { positions, normals, uvs, indices };
}

/**
 * Removes whole pieces of a model. A downloaded model is usually made of
 * many separate shells (the body, each screw, each lever ...); this finds
 * them by following shared corners, and drops every shell whose bounding
 * box passes `unwanted(min, max)`. Returns how many triangles went.
 */
function removeShells(mesh, unwanted) {
  const { positions, indices } = mesh;
  // Corners at the same place count as one, even where the texture splits them.
  const welded = new Map();
  const point = new Uint32Array(positions.length / 3);
  for (let i = 0; i < point.length; i++) {
    const key = `${positions[i * 3].toFixed(5)},${positions[i * 3 + 1].toFixed(5)},${positions[i * 3 + 2].toFixed(5)}`;
    let id = welded.get(key);
    if (id === undefined) welded.set(key, (id = welded.size));
    point[i] = id;
  }
  const parent = Uint32Array.from({ length: welded.size }, (_, i) => i);
  const find = (n) => {
    while (parent[n] !== n) n = parent[n] = parent[parent[n]];
    return n;
  };
  for (let i = 0; i < indices.length; i += 3) {
    const root = find(point[indices[i]]);
    parent[find(point[indices[i + 1]])] = root;
    parent[find(point[indices[i + 2]])] = root;
  }
  const boxes = new Map();
  for (const index of indices) {
    const root = find(point[index]);
    let box = boxes.get(root);
    if (!box) boxes.set(root, (box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
    for (let k = 0; k < 3; k++) {
      box.min[k] = Math.min(box.min[k], positions[index * 3 + k]);
      box.max[k] = Math.max(box.max[k], positions[index * 3 + k]);
    }
  }
  const kept = [];
  for (let i = 0; i < indices.length; i += 3) {
    const box = boxes.get(find(point[indices[i]]));
    if (!unwanted(box.min, box.max)) kept.push(indices[i], indices[i + 1], indices[i + 2]);
  }
  const removed = (indices.length - kept.length) / 3;
  mesh.indices = kept;
  return removed;
}

/**
 * Re-centre, scale and orient a gun so that it is `length` metres long,
 * centred on the origin, pointing down -Z with +Y up.
 * `forward` names the source axis that the muzzle points along.
 */
function normalise(mesh, { length, forward }) {
  const { positions, normals } = mesh;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }
  const centre = min.map((m, k) => (m + max[k]) / 2);
  const scale = length / (max[2] - min[2]);
  // Source +Z forward needs a half turn about Y; source -Z forward needs none.
  const flip = forward === '+z' ? -1 : 1;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] - centre[0]) * scale * flip;
    positions[i + 1] = (positions[i + 1] - centre[1]) * scale;
    positions[i + 2] = (positions[i + 2] - centre[2]) * scale * flip;
    normals[i] *= flip;
    normals[i + 2] *= flip;
  }
}

async function webp(input, size, options) {
  return sharp(input).resize(size, size).webp(options).toBuffer();
}

async function buildRifle() {
  const src = path.join(WORK, 'sci-fi-rifle');
  if (!fs.existsSync(src)) {
    console.error(`Missing ${src}. Extract assets-source/guns/sci-fi-rifle.zip (and its inner .rar) there first.`);
    return false;
  }
  const mesh = readObj(path.join(src, 'source/rar/Rifle20k.OBJ'));
  normalise(mesh, { length: 0.92, forward: '+z' });
  // The model's own sight is a small folding ring that sits too low to aim
  // through comfortably. Its eight little pieces are taken off here, leaving
  // the block they stood on; the game mounts its own raised reflex sight on
  // that block (see src/entities/weapon/ReflexSight.ts).
  const removed = removeShells(mesh, (min, max) => min[1] > 0.15 && min[2] > 0.03 && max[2] < 0.09 && min[0] > -0.02 && max[0] < 0.02);

  const tex = path.join(src, 'textures');
  const SIZE = 2048;
  const ORM_SIZE = 1024;

  // Pack AO / roughness / metalness into R / G / B.
  const grey = async (file, channel) => {
    let img = sharp(path.join(tex, file)).resize(ORM_SIZE, ORM_SIZE);
    img = channel === undefined ? img.removeAlpha().greyscale() : img.extractChannel(channel);
    return img.raw().toBuffer();
  };
  const ao = await grey('T_Rifle_AO.tga.png');
  const rough = await grey('T_Rifle_Rought.tga.png');
  const metal = await grey('T_Rifle_Met&Rou(alpha).tga.png', 0);
  const orm = Buffer.alloc(ORM_SIZE * ORM_SIZE * 3);
  for (let i = 0; i < ORM_SIZE * ORM_SIZE; i++) {
    orm[i * 3] = ao[i];
    orm[i * 3 + 1] = rough[i];
    orm[i * 3 + 2] = metal[i];
  }

  const doc = new Document();
  const buffer = doc.createBuffer();
  const texture = (name, image) => doc.createTexture(name).setMimeType('image/webp').setImage(image);
  const colorTex = texture('rifle_color', await webp(await sharp(path.join(tex, 'T_Rifle_Albedo.tga.png')).removeAlpha().toBuffer(), SIZE, { quality: 82, effort: 6 }));
  const normalTex = texture('rifle_normal', await webp(await sharp(path.join(tex, 'T_Rifle_Norm.tga.png')).removeAlpha().toBuffer(), SIZE, { quality: 86, effort: 6, smartSubsample: true }));
  const ormTex = texture('rifle_orm', await sharp(orm, { raw: { width: ORM_SIZE, height: ORM_SIZE, channels: 3 } }).webp({ quality: 80, effort: 6 }).toBuffer());

  const material = doc
    .createMaterial('rifle')
    .setBaseColorTexture(colorTex)
    .setNormalTexture(normalTex)
    .setMetallicRoughnessTexture(ormTex)
    .setOcclusionTexture(ormTex)
    .setRoughnessFactor(1)
    .setMetallicFactor(1);

  const count = mesh.positions.length / 3;
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(mesh.positions)).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(mesh.normals)).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(mesh.uvs)).setBuffer(buffer))
    .setIndices(
      doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(count > 65535 ? new Uint32Array(mesh.indices) : new Uint16Array(mesh.indices))
        .setBuffer(buffer),
    )
    .setMaterial(material);
  const node = doc.createNode('rifle').setMesh(doc.createMesh('rifle').addPrimitive(prim));
  doc.createScene('rifle').addChild(node);

  await doc.transform(weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = path.join(OUT_DIR, 'rifle.glb');
  await io.write(out, doc);
  console.log(`  rifle: ${mesh.indices.length / 3} tris (${removed} removed with the old sight), ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  return true;
}

console.log('Guns');
const ok = await buildRifle();
process.exit(ok ? 0 : 1);
