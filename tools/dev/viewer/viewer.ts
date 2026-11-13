// Dev-only model viewer. Not part of the game build.
// Used by tools/dev/view.mjs to photograph converted assets from set angles.
//
//   /tools/dev/viewer/index.html?m=/assets/models/robot.glb&az=30&el=10&anim=walk&t=0.5

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const report = (data: unknown) => ((window as unknown as { __viewer: unknown }).__viewer = data);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = num('exp', 1);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(q.get('bg') ?? '#20242a');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = num('env', 0.7);
const key = new THREE.DirectionalLight(0xffffff, num('key', 2.5));
key.position.set(2, 4, 3);
scene.add(key);

const camera = new THREE.PerspectiveCamera(num('fov', 35), innerWidth / innerHeight, 0.01, 200);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

function checker(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#d8d8d8' : '#404040';
      g.fillRect(x * 64, y * 64, 64, 64);
      g.fillStyle = '#c33';
      g.font = '18px monospace';
      g.fillText(`${x}${y}`, x * 64 + 6, y * 64 + 24);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

async function main() {
  const gltf = await loader.loadAsync(q.get('m')!);
  let root: THREE.Object3D = gltf.scene;
  const part = q.get('part');
  if (part) {
    const found = gltf.scene.getObjectByName(part);
    if (found) {
      root = found;
      root.position.set(0, 0, 0);
    }
  }
  scene.add(root);

  const mode = q.get('mat');
  const tex: Record<string, THREE.Texture> = {};
  const texLoader = new THREE.TextureLoader();
  const surf = q.get('surf');
  if (surf) {
    for (const k of ['color', 'normal', 'orm']) {
      const t = await texLoader.loadAsync(`/assets/textures/${surf}_${k}.webp`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (k === 'color') t.colorSpace = THREE.SRGBColorSpace;
      tex[k] = t;
    }
  }
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    if (mode === 'checker') mesh.material = new THREE.MeshStandardMaterial({ map: checker(), roughness: 0.8 });
    if (mode === 'normal') mesh.material = new THREE.MeshNormalMaterial();
    if (mode === 'wire') mesh.material = new THREE.MeshBasicMaterial({ wireframe: true, color: 0x88ccff });
    if (surf) {
      mesh.material = new THREE.MeshStandardMaterial({
        map: tex.color,
        normalMap: tex.normal,
        roughnessMap: tex.orm,
        metalnessMap: tex.orm,
        aoMap: tex.orm,
        metalness: 1,
        roughness: 1,
      });
    }
    const std = mesh.material as THREE.MeshStandardMaterial;
    if (q.get('flipy') && std.normalScale) std.normalScale.y *= -1;
  });

  const anim = q.get('anim');
  if (anim) {
    const clip = gltf.animations.find((a) => a.name === anim);
    if (clip) {
      const mixer = new THREE.AnimationMixer(gltf.scene);
      mixer.clipAction(clip).play();
      mixer.setTime(num('t', 0));
    }
  }
  gltf.scene.updateMatrixWorld(true);

  const box = new THREE.Box3();
  if (anim || q.get('skinned')) {
    // Skinned meshes: frame a fixed human-sized box (good enough for a preview).
    box.setFromCenterAndSize(new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(1.4, 1.9, 1.4));
  } else {
    box.setFromObject(root);
  }
  const centre = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  const az = THREE.MathUtils.degToRad(num('az', 30));
  const el = THREE.MathUtils.degToRad(num('el', 15));
  const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * num('zoom', 1);
  camera.position.set(
    centre.x + num('ox', 0) + dist * Math.sin(az) * Math.cos(el),
    centre.y + num('oy', 0) + dist * Math.sin(el),
    centre.z + dist * Math.cos(az) * Math.cos(el),
  );
  camera.lookAt(centre.x + num('ox', 0), centre.y + num('oy', 0), centre.z);
  if (q.get('grid')) scene.add(new THREE.GridHelper(4, 16, 0x556677, 0x334455));
  if (q.get('axes')) scene.add(new THREE.AxesHelper(0.5));

  renderer.render(scene, camera);
  let tris = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) tris += (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3;
  });
  report({
    ready: true,
    tris,
    size: box.getSize(new THREE.Vector3()).toArray(),
    names: gltf.scene.children.map((c) => c.name),
    clips: gltf.animations.map((a) => a.name),
  });
}

main().catch((e) => report({ ready: true, error: String(e) }));
