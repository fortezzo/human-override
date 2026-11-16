// The palette of physically based surface materials the level is built from.
//
// Each entry pairs a downloaded texture set with how large one repeat of it
// is in the world (`tile`, metres), so every surface in the game has the
// same texel density no matter how big the wall or beam it sits on.

import * as THREE from 'three';
import type { SurfaceId } from '../assetList';
import type { Assets } from '../core/assets';

/** What a bullet does when it hits this surface. */
export type SurfaceKind = 'concrete' | 'metal' | 'wood' | 'soft' | 'glass';

interface MaterialDef {
  surface: SurfaceId;
  tile: number;
  kind: SurfaceKind;
  tint?: number;
  roughness?: number;
  metalness?: number;
  normalScale?: number;
  envIntensity?: number;
  /** Brightens the texture beyond its photographed value (1 = as is). */
  gain?: number;
  /** Adds darker, shinier damp patches driven by world-space noise. */
  wetPatches?: boolean;
  /** Adds stains, water runs and grime that never repeat (heights in metres). */
  weathering?: { rail: number; ceiling: number };
}

// Tints are multiplied into the texture. They are kept close to white: the
// downloaded textures already have realistic brightness, and the mood comes
// from the lighting rather than from darkened surfaces.
const DEFS = {
  floor: { surface: 'concrete_floor_worn_001', tile: 3.2, kind: 'concrete', tint: 0xf2f3f4, gain: 1.7, roughness: 0.95, normalScale: 1.1, wetPatches: true },
  wall: { surface: 'painted_plaster_wall', tile: 2.6, kind: 'concrete', tint: 0xded6c2, roughness: 0.82, normalScale: 0.9, weathering: { rail: 1.25, ceiling: 4.3 } },
  wallPaint: { surface: 'painted_concrete', tile: 2.4, kind: 'concrete', tint: 0xbfcbc6, roughness: 0.9 },
  concreteDark: { surface: 'dirty_concrete', tile: 2.2, kind: 'concrete', tint: 0xd2d5d6, roughness: 1.0 },
  ceilingDeck: { surface: 'corrugated_iron_02', tile: 1.6, kind: 'metal', tint: 0xb9bec3, roughness: 0.9 },
  steelPlate: { surface: 'metal_plate_02', tile: 1.8, kind: 'metal', tint: 0xe2e5e8, roughness: 0.95, normalScale: 1.2 },
  paintedMetal: { surface: 'green_metal_rust', tile: 1.5, kind: 'metal', tint: 0xcfdbd4, roughness: 1.0 },
  rustedSteel: { surface: 'rusty_metal_04', tile: 1.4, kind: 'metal', tint: 0xd6d1cd, roughness: 1.0 },
  treadPlate: { surface: 'metal_plate', tile: 1.0, kind: 'metal', tint: 0xdcdfe3, roughness: 0.9 },
  hazard: { surface: 'PaintedMetal016', tile: 1.3, kind: 'metal', tint: 0xece6d6, roughness: 1.0 },
  darkSteel: { surface: 'Metal046B', tile: 1.0, kind: 'metal', tint: 0xcfd4d9, roughness: 1.0 },
  cable: { surface: 'Metal046B', tile: 0.5, kind: 'soft', tint: 0x3a3d42, roughness: 1.0, metalness: 0.1 },
  // The same plaster in the taller rooms, with the stains reaching down from their own ceilings.
  wallHall: { surface: 'painted_plaster_wall', tile: 2.6, kind: 'concrete', tint: 0xd2d6d6, roughness: 0.82, normalScale: 0.9, weathering: { rail: 1.25, ceiling: 5.1 } },
  wallPower: { surface: 'painted_plaster_wall', tile: 2.6, kind: 'concrete', tint: 0xd8cfbe, roughness: 0.82, normalScale: 0.9, weathering: { rail: 1.25, ceiling: 4.7 } },
  rackSteel: { surface: 'Metal046B', tile: 1.3, kind: 'metal', tint: 0x9aa1aa, roughness: 1.0 },
  coreSteel: { surface: 'metal_plate_02', tile: 2.4, kind: 'metal', tint: 0x8b929b, roughness: 0.9, normalScale: 1.2 },
  // The loading dock: corrugated cladding above a concrete plinth, the
  // faded paint of its containers, and the truck's cab and glass. (The
  // containers are the one place the tints are strong: they are painted.)
  wallDock: { surface: 'corrugated_iron_02', tile: 2.2, kind: 'metal', tint: 0xc6cbc8, roughness: 0.9 },
  containerRust: { surface: 'corrugated_iron_02', tile: 1.3, kind: 'metal', tint: 0xb9583a, roughness: 0.95 },
  containerBlue: { surface: 'corrugated_iron_02', tile: 1.3, kind: 'metal', tint: 0x547a9e, roughness: 0.95 },
  containerGreen: { surface: 'corrugated_iron_02', tile: 1.3, kind: 'metal', tint: 0x628569, roughness: 0.95 },
  containerOchre: { surface: 'corrugated_iron_02', tile: 1.3, kind: 'metal', tint: 0xc7a54c, roughness: 0.95 },
  truckPaint: { surface: 'Metal046B', tile: 1.6, kind: 'metal', tint: 0xdfe3e6, roughness: 0.55, metalness: 0.25 },
  darkGlass: { surface: 'Metal046B', tile: 1.0, kind: 'glass', tint: 0x1c232a, roughness: 0.22, metalness: 0.7, envIntensity: 1.5 },
  // The stations. Painted, not bare: bare steel in a dark room is a black
  // shape, and paint takes the light of the station's own lamp.
  stationPaint: { surface: 'Metal046B', tile: 1.3, kind: 'metal', tint: 0xb4bcc2, gain: 1.35, roughness: 0.62, metalness: 0.2 },
  cratePaint: { surface: 'Metal046B', tile: 1.3, kind: 'metal', tint: 0x8c9a70, gain: 1.45, roughness: 0.7, metalness: 0.2 },
  // The robotics lab: pale panels and a cleaner floor.
  wallLab: { surface: 'painted_plaster_wall', tile: 2.6, kind: 'concrete', tint: 0xdfeae6, roughness: 0.8, normalScale: 0.8 },
  labPanel: { surface: 'metal_plate_02', tile: 2.0, kind: 'metal', tint: 0xe6ecee, gain: 1.9, roughness: 0.75, normalScale: 1.0 },
  labFloor: { surface: 'concrete_floor_worn_001', tile: 3.2, kind: 'concrete', tint: 0xe8f0ee, gain: 1.9, roughness: 0.8, normalScale: 0.8 },
} satisfies Record<string, MaterialDef>;

export type MaterialKey = keyof typeof DEFS;

export interface LevelMaterial {
  material: THREE.MeshStandardMaterial;
  tile: number;
  kind: SurfaceKind;
}

export class MaterialLibrary {
  private readonly cache = new Map<MaterialKey, LevelMaterial>();
  private readonly textures: THREE.Texture[] = [];

  constructor(private readonly assets: Assets) {}

  get(key: MaterialKey): LevelMaterial {
    let entry = this.cache.get(key);
    if (!entry) {
      const def: MaterialDef = DEFS[key];
      const maps = this.assets.surface(def.surface);
      const material = new THREE.MeshStandardMaterial({
        name: key,
        map: maps.color,
        normalMap: maps.normal,
        roughnessMap: maps.orm,
        metalnessMap: maps.orm,
        aoMap: maps.orm,
        color: def.tint ?? 0xffffff,
        roughness: def.roughness ?? 1,
        metalness: def.metalness ?? 1,
        envMapIntensity: def.envIntensity ?? 1,
      });
      if (def.gain) material.color.multiplyScalar(def.gain);
      if (def.normalScale) material.normalScale.setScalar(def.normalScale);
      if (def.wetPatches) addWetPatches(material);
      if (def.weathering) addWallWeathering(material, def.weathering.rail, def.weathering.ceiling);
      this.textures.push(maps.color, maps.normal, maps.orm);
      entry = { material, tile: def.tile, kind: def.kind };
      this.cache.set(key, entry);
    }
    return entry;
  }

  /** Sharper textures at glancing angles; costs a little GPU time. */
  setAnisotropy(level: number): void {
    for (const texture of new Set(this.textures)) {
      if (texture.anisotropy !== level) {
        texture.anisotropy = level;
        texture.needsUpdate = true;
      }
    }
  }
}

/**
 * Patches a standard material so broad, irregular patches of the surface
 * read as damp: darker and far glossier, which is what catches the
 * reflections of the lamps on the floor.
 */
function addWetPatches(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWetPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWetPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying vec3 vWetPos;
        float wetHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float wetNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(wetHash(i), wetHash(i + vec2(1.0, 0.0)), f.x),
                     mix(wetHash(i + vec2(0.0, 1.0)), wetHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float wetMask(vec2 p) {
          float n = wetNoise(p * 0.42) * 0.6 + wetNoise(p * 1.1 + 7.3) * 0.28 + wetNoise(p * 3.7 + 2.1) * 0.12;
          return smoothstep(0.56, 0.7, n);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        float wet = wetMask(vWetPos.xz);
        diffuseColor.rgb *= mix(1.0, 0.68, wet);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.3, wet * 0.9);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, wet * 0.85));`,
      );
  };
  material.customProgramCacheKey = () => 'wet-patches';
}

/**
 * Patches a wall material so that no two metres of it look the same.
 *
 * The plaster texture itself is calm and repeats every few metres. On top
 * of it, worked out from each point's position in the room so that it
 * never repeats: broad patches of old damp, streaks where water has run
 * down from the ceiling, soot under the ceiling and scuffed grime along
 * the rail at the bottom.
 *
 * @param rail height of the bottom of the wall (top of the painted band)
 * @param ceiling height the streaks run down from
 */
function addWallWeathering(material: THREE.MeshStandardMaterial, rail: number, ceiling: number): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWallPos;\nvarying vec3 vWallFacing;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWallPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWallFacing = mat3(modelMatrix) * objectNormal;',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying vec3 vWallPos;
        varying vec3 vWallFacing;
        float wallHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float wallNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(wallHash(i), wallHash(i + vec2(1.0, 0.0)), f.x),
                     mix(wallHash(i + vec2(0.0, 1.0)), wallHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float wallClouds(vec2 p) {
          return wallNoise(p) * 0.52 + wallNoise(p * 2.13 + 11.7) * 0.3 + wallNoise(p * 4.7 + 3.1) * 0.18;
        }`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        // Distance along the wall, whichever way it faces, shifted so that
        // every wall gets its own stretch of the pattern.
        vec3 wallSide = abs(vWallFacing);
        float wallAlong = wallSide.z > wallSide.x ? vWallPos.x + vWallPos.z * 3.7 : vWallPos.z + vWallPos.x * 5.3;
        float wallUp = vWallPos.y;
        // Old damp: broad, soft patches.
        float wallDamp = smoothstep(0.46, 0.74, wallClouds(vec2(wallAlong * 0.31, wallUp * 0.4)));
        // Water runs: where they are across the wall, and how far each one reaches down it.
        float wallRun = wallNoise(vec2(wallAlong * 1.7, 3.7)) * 0.62 + wallNoise(vec2(wallAlong * 4.9, 9.1)) * 0.38;
        float wallReach = 0.5 + 2.9 * wallNoise(vec2(wallAlong * 1.7 + 40.0, 1.3));
        float wallFall = (${ceiling.toFixed(2)} - wallUp) / wallReach;
        float wallStreak = smoothstep(0.5, 0.72, wallRun) * (1.0 - smoothstep(0.3, 1.0, wallFall));
        wallStreak *= 0.55 + 0.45 * wallNoise(vec2(wallAlong * 11.0, wallUp * 1.3));
        // Soot under the ceiling, scuffs and dust above the rail.
        float wallSoot = smoothstep(${(ceiling - 0.9).toFixed(2)}, ${ceiling.toFixed(2)}, wallUp) * (0.55 + 0.45 * wallNoise(vec2(wallAlong * 0.9, 5.5)));
        float wallScuff = (1.0 - smoothstep(0.0, 0.55, wallUp - ${rail.toFixed(2)})) * (0.35 + 0.65 * wallClouds(vec2(wallAlong * 1.3, wallUp * 2.0)));
        float wallDirt = clamp(wallDamp * 0.42 + wallStreak * 0.7 + wallSoot * 0.4 + wallScuff * 0.4, 0.0, 1.0);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.47, 0.45, 0.41), wallDirt);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.62, wallStreak * 0.6);`,
      );
  };
  material.customProgramCacheKey = () => `wall-weathering-${rail}-${ceiling}`;
}

/**
 * Three.js draws a see-through, two-sided surface in two goes (its backs,
 * then its fronts), and marks the material as changed for each. A changed
 * material has its shader chosen afresh and every light handed to the
 * graphics card again, so a dozen small panes of glass in view cost a
 * megabyte of throw-away memory a frame, and the pauses to clear it up.
 * For glass on a lamp, and for anything that only adds light, one go
 * looks the same. Call this on everything built, before the shaders are.
 * Returns how many materials it set.
 */
export function drawSeeThroughOnce(root: THREE.Object3D): number {
  let set = 0;
  root.traverse((node) => {
    const material = (node as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    for (const one of Array.isArray(material) ? material : [material]) {
      if (one.transparent && one.side === THREE.DoubleSide && !one.forceSinglePass) {
        one.forceSinglePass = true;
        set++;
      }
    }
  });
  return set;
}
