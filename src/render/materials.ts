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
}

// Tints are multiplied into the texture. They are kept close to white: the
// downloaded textures already have realistic brightness, and the mood comes
// from the lighting rather than from darkened surfaces.
const DEFS = {
  floor: { surface: 'concrete_floor_worn_001', tile: 3.2, kind: 'concrete', tint: 0xf2f3f4, gain: 1.7, roughness: 0.95, normalScale: 1.1, wetPatches: true },
  wall: { surface: 'preconcrete_wall_001', tile: 3.0, kind: 'concrete', tint: 0xd4d8d8, roughness: 1.0, normalScale: 0.8 },
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
  robotShell: { surface: 'PaintedMetal013', tile: 1.0, kind: 'metal', tint: 0xe4e6e2, roughness: 1.0, normalScale: 1.2, envIntensity: 1.2 },
  robotJoints: { surface: 'Metal046B', tile: 1.0, kind: 'metal', tint: 0xa9afb6, roughness: 0.9, envIntensity: 1.2 },
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
