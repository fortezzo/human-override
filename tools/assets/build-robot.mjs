// Turns the Mixamo downloads in assets-source/robot into one game file,
// public/assets/models/robot.glb:
//
//   - the "Y Bot" character mesh, reduced to a game-friendly triangle count
//   - every animation clip merged onto that one skeleton, with finger tracks
//     removed (robot hands stay rigid, and it halves the animation cost)
//   - Meshopt-compressed
//
// The raw FBX files are never copied into the repo; only this converted,
// compressed result ships with the game.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, simplifyPrimitive, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { addBoxUvs } from './lib/box-uv.mjs';

const SRC_DIR = 'assets-source/robot';
const WORK_DIR = 'assets-source/_work/robot-glb';
const OUT_FILE = 'public/assets/models/robot.glb';

// Triangle budgets for the two body meshes (the source is about 55,000).
const SHELL_TRIS = 9500;
const JOINT_TRIS = 4500;

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
const fbx2gltf = path.join(path.dirname(require.resolve('fbx2gltf/package.json')), 'bin', process.platform === 'win32' ? 'Windows_NT' : process.platform === 'darwin' ? 'Darwin' : 'Linux', process.platform === 'win32' ? 'FBX2glTF.exe' : 'FBX2glTF');

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
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
// 1. Character mesh
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

const meshes = root.listMeshes();
const shell = meshes.find((m) => /Surface/i.test(m.getName()));
const joints = meshes.find((m) => /Joints/i.test(m.getName()));
if (!shell || !joints) {
  console.error(`Expected the Mixamo "Y Bot" (meshes named *_Surface and *_Joints); found: ${meshes.map((m) => m.getName())}`);
  process.exit(1);
}
shell.setName('shell');
joints.setName('joints');
for (const node of root.listNodes()) {
  if (node.getMesh() === shell) node.setName('shell');
  if (node.getMesh() === joints) node.setName('joints');
}

const tris = (mesh) => mesh.listPrimitives().reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
const sourceTris = tris(shell) + tris(joints);

await doc.transform(dedup(), weld());
for (const [mesh, budget] of [
  [shell, SHELL_TRIS],
  [joints, JOINT_TRIS],
]) {
  const ratio = Math.min(1, budget / tris(mesh));
  for (const prim of mesh.listPrimitives()) {
    simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error: 0.004, lockBorder: false });
  }
}

// The Mixamo mannequin has no usable texture layout, so give both meshes
// box-projected UVs for the tiling worn-metal textures.
addBoxUvs(doc, shell, 0.55);
addBoxUvs(doc, joints, 0.4);

// One simple material per part; the game replaces these with its own.
for (const mesh of root.listMeshes()) {
  const material = doc.createMaterial(mesh.getName()).setRoughnessFactor(0.6).setMetallicFactor(0.8);
  for (const prim of mesh.listPrimitives()) prim.setMaterial(material);
}

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
await doc.transform(resample({ tolerance: 0.0005 }), prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(OUT_FILE, doc);

console.log(`Robot: ${sourceTris} -> shell ${tris(shell)} + joints ${tris(joints)} tris, ${root.listSkins()[0].listJoints().length} bones`);
for (const line of clipReport) console.log(`  clip ${line}`);
console.log(`  ${OUT_FILE} ${(fs.statSync(OUT_FILE).size / 1024).toFixed(0)} KB`);
