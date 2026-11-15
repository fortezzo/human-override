// Bakes a room's own reflections.
//
// Instead of reflecting a stock photo, the game photographs each finished
// room in all six directions from its centre, once, at load time. Shiny
// surfaces then reflect the real lamps and walls around them, and the same
// capture doubles as soft bounce light for everything in the room.
//
// The photograph is cleaned before it is used. Turning it into reflections
// means blurring it, and a blur spreads one broken pixel (a shader's "not a
// number") through the whole picture, after which every surface lit by it
// is black. One such pixel did exactly that to the server hall. Cleaning
// costs six tiny draws per room and makes the bake immune to it.

import * as THREE from 'three';
import { SAFE_COLOR } from './safeColor';

// One generator is kept for the life of the page so its own shaders are
// only compiled once.
let generator: THREE.PMREMGenerator | null = null;
function pmremFor(renderer: THREE.WebGLRenderer): THREE.PMREMGenerator {
  generator ??= new THREE.PMREMGenerator(renderer);
  return generator;
}

/**
 * Photograph the scene in all six directions from a point. Anything in
 * `hidden` (robots, the player's weapon, particles: whatever moves) is left
 * out. The caller disposes of the result.
 */
export function captureSurroundings(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  position: THREE.Vector3,
  size: number,
  hidden: THREE.Object3D[] = [],
  type: THREE.TextureDataType = THREE.HalfFloatType,
): THREE.WebGLCubeRenderTarget {
  // Read back pixel for pixel when it is cleaned or inspected: no blending
  // between neighbours, which would let a broken pixel leak into them.
  const target = new THREE.WebGLCubeRenderTarget(size, { type, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const camera = new THREE.CubeCamera(0.1, 80, target);
  camera.position.copy(position);
  const restore = hidden.filter((object) => object.visible);
  for (const object of restore) object.visible = false;
  camera.update(renderer, scene);
  for (const object of restore) object.visible = true;
  return target;
}

// The cleaner: a box seen from the inside, painted with the photograph, in
// front of a second six-way camera. Every pixel of the copy looks straight
// at the matching pixel of the original and passes it through safeColor.
let cleaner: { scene: THREE.Scene; material: THREE.ShaderMaterial } | null = null;
function cleanerFor(): { scene: THREE.Scene; material: THREE.ShaderMaterial } {
  if (cleaner) return cleaner;
  const material = new THREE.ShaderMaterial({
    uniforms: { uCapture: { value: null } },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform samplerCube uCapture;
      varying vec3 vDirection;
      ${SAFE_COLOR}
      void main() {
        gl_FragColor = vec4(safeColor(textureCube(uCapture, vDirection).rgb), 1.0);
      }`,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
  box.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(box);
  cleaner = { scene, material };
  return cleaner;
}

/** A copy of a capture with every broken pixel turned to black. The caller disposes of it. */
function cleaned(renderer: THREE.WebGLRenderer, capture: THREE.WebGLCubeRenderTarget): THREE.WebGLCubeRenderTarget {
  const { scene, material } = cleanerFor();
  const copy = new THREE.WebGLCubeRenderTarget(capture.width, { type: THREE.HalfFloatType });
  material.uniforms.uCapture!.value = capture.texture;
  new THREE.CubeCamera(0.1, 10, copy).update(renderer, scene);
  material.uniforms.uCapture!.value = null;
  return copy;
}

/** Photograph a room and turn the photograph into its reflections. */
export function bakeReflectionProbe(renderer: THREE.WebGLRenderer, scene: THREE.Scene, position: THREE.Vector3, size: number, hidden: THREE.Object3D[] = []): THREE.Texture {
  const capture = captureSurroundings(renderer, scene, position, size, hidden);
  const copy = cleaned(renderer, capture);
  const environment = pmremFor(renderer).fromCubemap(copy.texture).texture;
  capture.dispose();
  copy.dispose();
  return environment;
}

/**
 * For the tests: photograph a room at full precision and count the pixels
 * that are not a finite number. The bake would clean them away; this is how
 * a shader that produces them gets noticed and fixed at the source.
 */
export function countBrokenPixels(renderer: THREE.WebGLRenderer, scene: THREE.Scene, position: THREE.Vector3, size: number, hidden: THREE.Object3D[] = []): number {
  const capture = captureSurroundings(renderer, scene, position, size, hidden, THREE.FloatType);
  const pixels = new Float32Array(size * size * 4);
  let broken = 0;
  for (let face = 0; face < 6; face++) {
    renderer.readRenderTargetPixels(capture, 0, 0, size, size, pixels, face);
    for (let i = 0; i < pixels.length; i += 4) {
      if (!Number.isFinite(pixels[i]!) || !Number.isFinite(pixels[i + 1]!) || !Number.isFinite(pixels[i + 2]!)) broken++;
    }
  }
  capture.dispose();
  return broken;
}

/**
 * A black environment in the same format, and of the same size, as the
 * baked one will be. Shaders are built differently with and without
 * reflections, and differently again for each size of reflection picture,
 * so putting this in place before they are compiled means they are built
 * once, correctly, and never need rebuilding.
 */
export function blankEnvironment(renderer: THREE.WebGLRenderer, size: number): THREE.Texture {
  return pmremFor(renderer).fromScene(new THREE.Scene(), 0, 0.1, 100, { size }).texture;
}
