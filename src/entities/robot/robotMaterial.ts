// The robot's surface: dark gunmetal that rusts.
//
// One material covers the whole machine. Each part of the body carries its
// own paint in its vertices (base color, how metallic it is, how rough, and
// how prone to rust), and this shader combines that with two downloaded
// texture sets: worn steel for fine scratches, and a rust texture that
// creeps in wherever a part's "grime" value lets it.

import * as THREE from 'three';
import type { Assets } from '../../core/assets';

/** Average brightness of the steel texture, so paint colors come out as specified. */
const STEEL_MEAN = 0.05;
/** Average of the rust texture's green channel, which doubles as the rust mask. */
const RUST_MEAN = 0.067;

export function createRobotMaterial(assets: Assets): THREE.MeshStandardMaterial {
  const steel = assets.surface('Metal046B');
  const rust = assets.surface('rusty_metal_04');

  const material = new THREE.MeshStandardMaterial({
    name: 'robot',
    map: steel.color,
    normalMap: steel.normal,
    roughnessMap: steel.orm,
    metalnessMap: steel.orm,
    vertexColors: true,
    roughness: 1,
    metalness: 1,
    envMapIntensity: 0.7,
  });
  // The texture supplies the fine variation; the vertex paint supplies the color.
  material.color.setScalar(1 / STEEL_MEAN);
  material.normalScale.setScalar(1.3);

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRustMap = { value: rust.color };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aSurface;\nvarying vec3 vSurface;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurface = aSurface;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uRustMap;\nvarying vec3 vSurface;')
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        // Keep most of the paint's own color; the steel texture only adds
        // scratches and unevenness on top.
        diffuseColor.rgb = mix(vColor.rgb, diffuseColor.rgb, 0.6);
        // Where rust has taken hold: broad blotches read from the rust
        // texture at a large scale, broken up by its fine grain, and pushed
        // further by each part's grime value.
        float rustGrain = texture2D(uRustMap, vMapUv * 1.35).g / ${RUST_MEAN.toFixed(3)};
        float rustSeed = texture2D(uRustMap, vMapUv * 0.53 + 0.37).g / ${RUST_MEAN.toFixed(3)} * (0.72 + 0.28 * rustGrain);
        float rustAmount = smoothstep(1.55 - vSurface.z * 1.15, 2.1 - vSurface.z * 1.15, rustSeed);
        vec3 rustColor = vec3(0.07, 0.031, 0.015) * clamp(0.5 + 0.5 * rustGrain, 0.45, 1.2);
        diffuseColor.rgb = mix(diffuseColor.rgb, rustColor, rustAmount * 0.92);
        // Grime: soot and oil darken the paint in uneven patches.
        float soot = texture2D(uRustMap, vMapUv * 0.61 + 0.11).r / 0.1;
        diffuseColor.rgb *= mix(1.0, clamp(soot, 0.45, 1.1), 0.3 + vSurface.z * 0.3);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + 0.44 + vSurface.y, 0.12, 1.0);
        roughnessFactor = mix(roughnessFactor, 0.95, rustAmount);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        /* glsl */ `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor * vSurface.x, 0.12, rustAmount);`,
      );
  };
  material.customProgramCacheKey = () => 'robot-surface';
  return material;
}

/** The bright parts: visor, sensor lenses, status lights. Each robot gets its own copy so it can flicker. */
export function createGlowMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ name: 'robot-glow', vertexColors: true, toneMapped: false, fog: false });
}
