// Turns the Mixamo downloads in assets-source/robot into one game file,
// public/assets/models/robot.glb, holding only:
//
//   - the skeleton (22 bones; the thirty finger bones are dropped because
//     robot hands are rigid claws)
//   - every animation clip, merged onto that one skeleton
//
// The Mixamo character's own body is not shipped. The game builds an
// original robot body on this skeleton from code (src/entities/robot), so
// nothing of the mannequin's appearance remains; only how it moves.
//
// The raw FBX files are never copied into the repo; only this converted,
// compressed result ships with the game.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, resample } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const SRC_DIR = 'assets-source/robot';
const WORK_DIR = 'assets-source/_work/robot-glb';
const OUT_FILE = 'public/assets/models/robot.glb';

// Which downloaded animation becomes which game clip. Mixamo lets you tick
// "In Place" and "Without Skin" per download; where several copies of one
// animation exist, `pick` chooses the right one from what it finds.
const CLIPS = [
  { name: 'idle', file: /^Zombie Idle/ },
  { name: 'walk', file: /^Zombie Walk/, inPlace: true },
  { name: 'run', file: /^Zombie Running/, inPlace: true },
  { name: 'attack', file: /^Zombie Punching/, pick: 'shortest' },
  { name: 'attackHeavy', file: /^Zombie Punching/, pick: 'longest' },
  { name: 'hit', file: /^Zombie Reaction Hit/, lockHips: true },
  { name: 'deathBack', file: /^Death( \(\d+\))?\.fbx$/ },
  { name: 'deathFront', file: /^Death From The Front/ },
];

const require = createRequire(import.meta.url);
const platformDir = process.platform === 'win32' ? 'Windows_NT' : process.platform === 'darwin' ? 'Darwin' : 'Linux';
const fbx2gltf = path.join(path.dirname(require.resolve('fbx2gltf/package.json')), 'bin', platformDir, process.platform === 'win32' ? 'FBX2glTF.exe' : 'FBX2glTF');

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});

if (!fs.existsSync(SRC_DIR)) {
  console.error(`Missing ${SRC_DIR}. Put the Mixamo character and animation FBX files there.`);
  process.exit(1);
}
fs.mkdirSync(WORK_DIR, { recursive: true });
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

/** Convert one FBX to GLB (cached) and load it. */
async function loadFbx(file) {
  const glb = path.join(WORK_DIR, file.replace(/\.fbx$/i, '').replace(/[^a-zA-Z0-9]/g, '_') + '.glb');
  if (!fs.existsSync(glb)) {
    execFileSync(fbx2gltf, ['--binary', '--input', path.join(SRC_DIR, file), '--output', glb.replace(/\.glb$/, '')], { stdio: 'pipe' });
  }
  return io.read(glb);
}

const boneName = (name) => name.replace(/^mixamorig:/, '');
const isFinger = (name) => /Hand(Thumb|Index|Middle|Ring|Pinky)/.test(name);

/** Duration and forward hip travel of a clip, used to choose between copies. */
function describeClip(doc) {
  const anim = doc.getRoot().listAnimations()[0];
  if (!anim) return null;
  let duration = 0;
  let travel = 0;
  for (const ch of anim.listChannels()) {
    const sampler = ch.getSampler();
    duration = Math.max(duration, sampler.getInput().getMax([])[0]);
    if (boneName(ch.getTargetNode().getName()) === 'Hips' && ch.getTargetPath() === 'translation') {
      const out = sampler.getOutput();
      const first = out.getElement(0, []);
      const last = out.getElement(out.getCount() - 1, []);
      travel = Math.hypot(last[0] - first[0], last[2] - first[2]);
    }
  }
  return { anim, duration, travel, skinned: doc.getRoot().listMeshes().length > 0 };
}

// ---------------------------------------------------------------------------
// 1. Skeleton
// ---------------------------------------------------------------------------
const files = fs.readdirSync(SRC_DIR).filter((f) => /\.fbx$/i.test(f));
const characterFile = files.find((f) => /^character\.fbx$/i.test(f)) ?? files.find((f) => /^character/i.test(f));
if (!characterFile) {
  console.error('No character.fbx found in assets-source/robot.');
  process.exit(1);
}
const doc = await loadFbx(characterFile);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
for (const anim of root.listAnimations()) anim.dispose();
for (const node of root.listNodes()) node.setName(boneName(node.getName()));

// Drop the character's body and everything that belongs to it: the nodes
// that carry the meshes, the mesh data, materials and skin bindings. What is
// left is a plain tree of named bones.
for (const node of root.listNodes()) if (node.getMesh()) node.dispose();
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    for (const attribute of prim.listAttributes()) attribute.dispose();
    prim.getIndices()?.dispose();
  }
  mesh.dispose();
}
for (const material of root.listMaterials()) material.dispose();
for (const skin of root.listSkins()) {
  skin.getInverseBindMatrices()?.dispose();
  skin.dispose();
}

// Robot hands are rigid claws, so the finger bones (and Mixamo's unused
// "_End" marker bones) are dropped.
let dropped = 0;
for (const node of root.listNodes()) {
  if (isFinger(node.getName()) || /_End$/.test(node.getName())) {
    node.dispose();
    dropped++;
  }
}
const bones = root.listNodes().filter((n) => n.getName() !== 'RootNode');

// ---------------------------------------------------------------------------
// 2. Animation clips
// ---------------------------------------------------------------------------
const nodesByName = new Map(root.listNodes().map((n) => [n.getName(), n]));
const clipReport = [];

for (const clip of CLIPS) {
  const candidates = [];
  for (const file of files.filter((f) => clip.file.test(f))) {
    const info = describeClip(await loadFbx(file));
    if (info) candidates.push({ file, ...info });
  }
  if (!candidates.length) {
    console.error(`  ! no animation file matches ${clip.file} (clip "${clip.name}")`);
    continue;
  }
  let pool = candidates;
  if (clip.inPlace) {
    const still = pool.filter((c) => c.travel < 0.3);
    if (still.length) pool = still;
    else console.warn(`  ? "${clip.name}": no "In Place" copy found, removing forward motion in code`);
  }
  if (clip.pick === 'shortest') pool = [...pool].sort((a, b) => a.duration - b.duration);
  if (clip.pick === 'longest') pool = [...pool].sort((a, b) => b.duration - a.duration);
  const chosen = pool.find((c) => !c.skinned) ?? pool[0];

  const anim = doc.createAnimation(clip.name);
  let channels = 0;
  for (const ch of chosen.anim.listChannels()) {
    const name = boneName(ch.getTargetNode().getName());
    const target = nodesByName.get(name);
    const targetPath = ch.getTargetPath();
    if (!target || isFinger(name) || targetPath === 'scale') continue;
    if (targetPath === 'translation' && name !== 'Hips') continue;

    const srcSampler = ch.getSampler();
    const times = new Float32Array(srcSampler.getInput().getArray());
    const t0 = times[0];
    for (let i = 0; i < times.length; i++) times[i] -= t0;
    const values = new Float32Array(srcSampler.getOutput().getArray());

    if (targetPath === 'translation') {
      // Keep the hips' bob and sway, but never let a looping or reaction
      // clip carry the body away from where the game says the robot is.
      const lock = clip.lockHips || (clip.inPlace && chosen.travel >= 0.3);
      if (lock) {
        for (let i = 0; i < values.length; i += 3) {
          values[i] = values[0];
          values[i + 2] = values[2];
        }
      }
    }

    const input = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
    const output = doc
      .createAccessor()
      .setType(targetPath === 'rotation' ? 'VEC4' : 'VEC3')
      .setArray(values)
      .setBuffer(buffer);
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(srcSampler.getInterpolation());
    anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(targetPath).setSampler(sampler));
    channels++;
  }
  clipReport.push(`${clip.name} ${chosen.duration.toFixed(2)}s (${chosen.file}, ${channels} tracks)`);
}

// ---------------------------------------------------------------------------
// 3. Compress and write
// ---------------------------------------------------------------------------
// Prune only leftover data. Bones must survive even though nothing in the
// file is attached to them.
const leftovers = [PropertyType.ACCESSOR, PropertyType.TEXTURE, PropertyType.MATERIAL, PropertyType.MESH];
await doc.transform(resample({ tolerance: 0.0005 }), prune({ propertyTypes: leftovers }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(OUT_FILE, doc);

console.log(`Robot: skeleton of ${bones.length} bones (${dropped} finger and marker bones dropped), no character mesh`);
for (const line of clipReport) console.log(`  clip ${line}`);
console.log(`  ${OUT_FILE} ${(fs.statSync(OUT_FILE).size / 1024).toFixed(0)} KB`);
