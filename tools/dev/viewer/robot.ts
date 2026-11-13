// Dev-only studio for the robot. Not part of the game build.
//
// Builds the robot exactly as the game does and shows it under plain studio
// light, posed at a chosen moment of an animation, from a chosen angle.
// Used by tools/dev/view-robot.mjs.
//
//   /tools/dev/viewer/robot.html?az=30&el=8&anim=walk&t=1.2&zoom=1

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Assets } from '../../../src/core/assets';
import { DRUDGE } from '../../../src/entities/robot/designs/drudge';
import { RobotModel, type ClipName } from '../../../src/entities/robot/RobotModel';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const report = (data: unknown) => ((window as unknown as { __viewer: unknown }).__viewer = data);

async function main() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = num('exp', 1.25);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(q.get('bg') ?? '#3a4048');
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = num('env', 0.55);

  // Key from the front-left, and a cold rim from behind like the game's yard light.
  const key = new THREE.DirectionalLight(0xfff1e0, num('key', 2.6));
  key.position.set(2.5, 4, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -2.5;
  key.shadow.camera.right = key.shadow.camera.top = 2.5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd6ff, num('rim', 2.2));
  rim.position.set(-1.5, 2.5, -4);
  scene.add(rim);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const audio = new AudioContext();
  const assets = new Assets();
  await assets.load((data) => audio.decodeAudioData(data), () => {});

  const model = new RobotModel(assets, DRUDGE);
  const robot = model.instantiate();
  scene.add(robot);

  const anim = q.get('anim') as ClipName | null;
  if (anim && model.clips.has(anim)) {
    const mixer = new THREE.AnimationMixer(robot);
    mixer.clipAction(model.clips.get(anim)!).play();
    mixer.setTime(num('t', 0));
    if (q.get('hunch') !== '0') {
      for (const { bone, rotation } of model.posture) robot.getObjectByName(bone)!.quaternion.multiply(rotation);
    }
  }
  robot.updateMatrixWorld(true);

  const camera = new THREE.PerspectiveCamera(num('fov', 30), innerWidth / innerHeight, 0.05, 100);
  const target = new THREE.Vector3(num('ox', 0), num('oy', 0.95), num('oz', 0));
  const az = THREE.MathUtils.degToRad(num('az', 25));
  const el = THREE.MathUtils.degToRad(num('el', 8));
  const distance = num('dist', 5.2) * num('zoom', 1);
  camera.position.set(target.x + distance * Math.sin(az) * Math.cos(el), target.y + distance * Math.sin(el), target.z + distance * Math.cos(az) * Math.cos(el));
  camera.lookAt(target);

  renderer.render(scene, camera);
  report({ ready: true, triangles: model.triangles, chunks: model.chunks.length, clips: [...model.clips.keys()] });
}

main().catch((error) => {
  console.error(error);
  report({ ready: true, error: String(error?.stack ?? error) });
});
