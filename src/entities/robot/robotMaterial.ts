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

/**
 * Edge light. A dark machine in a dark room is invisible, and being hit by
 * something that could not be seen is unfair. So wherever a robot's own
 * surface is close to black, its edges (the faces turned away from the
 * viewer) pick up a faint cold sheen, as bare steel does from whatever
 * stray light there is, and the rest of it lifts a shade off pure black.
 * Its outline then reads against anything dark behind it. Where real light
 * falls on the robot this fades out, so in a lit room it looks as it always
 * did.
 */
export const EDGE_LIGHT = {
  color: new THREE.Color(0.68, 0.77, 0.95),
  /** Brightness at a face seen edge-on. */
  strength: 0.2,
  /** Brightness of the lift given to the whole body. */
  lift: 0.012,
  /**
   * How tightly it hugs the outline (higher = thinner). Across a room a
   * thin outline is finer than a pixel and all but disappears, so with
   * distance it spreads over more of each face and the lift grows.
   */
  power: 2.2,
  /** Surface brightness at which it has faded away completely. */
  fadeBy: 0.09,
};

/** An edge light's settings: its colour, and how it behaves (see EDGE_LIGHT). */
export interface EdgeLight {
  color: THREE.Color;
  strength: number;
  lift: number;
  power: number;
  fadeBy: number;
}

/** Every robot type's edge light as its shader sees it (strength, lift, power, fade), with what it is set to. */
const edges: Array<{ uniform: { value: THREE.Vector4 }; light: EdgeLight }> = [];

/** Switch the edge lights off and on (so a check can show what they are worth). */
export function setEdgeLight(on: boolean): void {
  for (const { uniform, light } of edges) {
    uniform.value.x = on ? light.strength : 0;
    uniform.value.y = on ? light.lift : 0;
  }
}

/**
 * @param edge this robot type's own edge light, where it differs from the
 * usual one (ARGUS's Proxy glows at its edges whatever light it is in)
 */
export function createRobotMaterial(assets: Assets, edge: Partial<EdgeLight> = {}): THREE.MeshStandardMaterial {
  const light: EdgeLight = { ...EDGE_LIGHT, ...edge };
  const edgeUniform = { value: new THREE.Vector4(light.strength, light.lift, light.power, light.fadeBy) };
  edges.push({ uniform: edgeUniform, light });
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
    shader.uniforms.uEdgeColor = { value: light.color };
    shader.uniforms.uEdge = edgeUniform;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aSurface;\nvarying vec3 vSurface;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurface = aSurface;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uRustMap;\nuniform vec3 uEdgeColor;\nuniform vec4 uEdge;\nvarying vec3 vSurface;')
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
        '#include <opaque_fragment>',
        /* glsl */ `
        // Edge light (see EDGE_LIGHT above): strongest on faces seen
        // edge-on, and only where the surface is otherwise near black.
        float edgeFacing = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        float edgeDark = 1.0 - smoothstep(0.0, uEdge.w, dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)));
        float edgeFar = clamp((length(vViewPosition) - 3.0) / 9.0, 0.0, 1.0);
        float edgeShape = pow(edgeFacing, mix(uEdge.z, uEdge.z * 0.5, edgeFar));
        outgoingLight += uEdgeColor * (uEdge.y * (1.0 + 2.5 * edgeFar) + uEdge.x * edgeShape) * edgeDark;
        #include <opaque_fragment>`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        /* glsl */ `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor * vSurface.x, 0.12, rustAmount);`,
      );
  };
  material.customProgramCacheKey = () => 'robot-surface';
  material.name = 'robot';
  return material;
}

/** The bright parts: visor, sensor lenses, status lights. Each robot gets its own copy so it can flicker. */
export function createGlowMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ name: 'robot-glow', vertexColors: true, toneMapped: false, fog: false });
}
