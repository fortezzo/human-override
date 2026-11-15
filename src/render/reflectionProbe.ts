// Bakes the room's own reflections.
//
// Instead of reflecting a stock photo, the game photographs the finished
// room in all six directions from its centre, once, at load time. Shiny
// surfaces then reflect the real lamps and walls around them, and the same
// capture doubles as soft bounce light for everything in the room.

import * as THREE from 'three';

// One generator is kept for the life of the page so its own shaders are
// only compiled once.
let generator: THREE.PMREMGenerator | null = null;
function pmremFor(renderer: THREE.WebGLRenderer): THREE.PMREMGenerator {
  generator ??= new THREE.PMREMGenerator(renderer);
  return generator;
}

export function bakeReflectionProbe(renderer: THREE.WebGLRenderer, scene: THREE.Scene, position: THREE.Vector3, size: number, hidden: THREE.Object3D[] = []): THREE.Texture {
  const target = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
  const camera = new THREE.CubeCamera(0.1, 80, target);
  camera.position.copy(position);

  // Leave out anything that moves (robots, the player's weapon, particles).
  const restore = hidden.filter((object) => object.visible);
  for (const object of restore) object.visible = false;
  camera.update(renderer, scene);
  for (const object of restore) object.visible = true;

  const environment = pmremFor(renderer).fromCubemap(target.texture).texture;
  target.dispose();
  return environment;
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
