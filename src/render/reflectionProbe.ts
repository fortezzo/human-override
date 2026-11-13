// Bakes the room's own reflections.
//
// Instead of reflecting a stock photo, the game photographs the finished
// room in all six directions from its centre, once, at load time. Shiny
// surfaces then reflect the real lamps and walls around them, and the same
// capture doubles as soft bounce light for everything in the room.

import * as THREE from 'three';

export function bakeReflectionProbe(renderer: THREE.WebGLRenderer, scene: THREE.Scene, position: THREE.Vector3, size: number, hidden: THREE.Object3D[] = []): THREE.Texture {
  const target = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
  const camera = new THREE.CubeCamera(0.1, 80, target);
  camera.position.copy(position);

  // Leave out anything that moves (robots, the player's weapon, particles).
  const restore = hidden.filter((object) => object.visible);
  for (const object of restore) object.visible = false;
  camera.update(renderer, scene);
  for (const object of restore) object.visible = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromCubemap(target.texture).texture;
  pmrem.dispose();
  target.dispose();
  return environment;
}
