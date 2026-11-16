// How each gun is held in the player's view: where it sits at the hip, when
// aiming and when sprinting, and where its muzzle and ejection port are.
//
// Positions are relative to the eye, in real metres. Points on a gun are in
// that gun model's own coordinates (it points down -Z, +Y is up).

import * as THREE from 'three';
import { FX, type WeaponId } from '../../config';
import type { ModelId, SurfaceId } from '../../assetList';
import type { Assets } from '../../core/assets';
import type { FlashLook } from './MuzzleFlash';
import { SIGHT_HEIGHT } from './ReflexSight';

export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
}

/** How one named part of a gun that comes with no images of its own is painted. */
export interface PartPaint {
  color: number;
  metalness: number;
  roughness: number;
  /** One of the game's own tiling surfaces, laid over it. */
  surface?: SurfaceId;
  /** It glows this colour, this strongly. */
  emissive?: number;
  glow?: number;
}

export interface ViewModelDef {
  model: ModelId;
  /** For a gun whose model has no images of its own: how each of its named parts is painted. */
  parts?: Record<string, PartPaint>;
  /** How long the gun is, muzzle to the back of it, in metres. */
  length: number;
  /** Multiplies the model's paint: lifts near-black guns to a dark gunmetal that can hold light. */
  paint: number;
  /** Multiplies the model's own roughness. */
  roughness: number;
  hip: Pose;
  aim: Pose;
  sprint: Pose;
  /** End of each barrel. Guns with two barrels fire them in turn. */
  muzzles: Array<[number, number, number]>;
  /** Where spent casings leave, or null for guns that keep them. */
  ejectionPort: [number, number, number] | null;
  /** The carbine carries the game's own reflex sight. */
  reflexSight: boolean;
  /** The muzzle flash: its size relative to the carbine's, how long it is drawn, and its shape. */
  flash: FlashLook;
  /** How far the gun drops and tips during a reload, relative to the carbine. */
  reloadMotion: number;
}

export const VIEW_MODELS: Record<WeaponId, ViewModelDef> = {
  pistol: {
    model: 'pistol',
    paint: 1.15,
    roughness: 1,
    hip: { x: 0.17, y: -0.165, z: -0.47, yaw: 0.07, pitch: 0.03, roll: 0 },
    // The front post on the point of aim, the muzzle tipped up a touch so
    // the back of the slide drops out of the way of the target.
    aim: { x: 0, y: -0.0625, z: -0.43, yaw: 0, pitch: 0.022, roll: 0 },
    sprint: { x: 0.14, y: -0.2, z: -0.4, yaw: 0.35, pitch: 0.55, roll: 0.1 },
    length: 0.2,
    muzzles: [[0, 0.04, -0.104]],
    ejectionPort: [0.014, 0.05, -0.02],
    reflexSight: false,
    flash: { size: 0.62, seconds: FX.muzzleFlashTime, shape: 'star' },
    reloadMotion: 0.75,
  },
  shotgun: {
    model: 'shotgun',
    paint: 1.9,
    roughness: 1,
    hip: { x: 0.19, y: -0.2, z: -0.56, yaw: 0.08, pitch: 0.03, roll: 0 },
    // The bead on the point of aim, looking down the rib from a little
    // above it so the receiver sits low in the view.
    aim: { x: 0, y: -0.0862, z: -0.53, yaw: 0, pitch: 0.036, roll: 0 },
    sprint: { x: 0.12, y: -0.24, z: -0.45, yaw: 0.6, pitch: -0.12, roll: 0.16 },
    length: 0.66,
    muzzles: [
      [-0.017, 0.04, -0.334],
      [0.017, 0.04, -0.334],
    ],
    ejectionPort: null,
    reflexSight: false,
    // Small, and drawn for a single frame: a big, lingering star looked
    // like a cartoon. The shot's weight comes from the light it throws on
    // the room, the kick and the sound.
    flash: { size: 0.78, seconds: 0.012, shape: 'burst' },
    reloadMotion: 1,
  },
  carbine: {
    model: 'rifle',
    paint: 1.9,
    roughness: 0.86,
    hip: { x: 0.2, y: -0.25, z: -0.7, yaw: 0.075, pitch: 0.02, roll: 0 },
    // The eye exactly on the reflex sight's line, a hand's width behind it.
    aim: { x: 0, y: -SIGHT_HEIGHT, z: -0.23, yaw: 0, pitch: 0, roll: 0 },
    sprint: { x: 0.12, y: -0.27, z: -0.5, yaw: 0.6, pitch: -0.14, roll: 0.14 },
    length: 0.92,
    muzzles: [[0, 0.094, -0.475]],
    ejectionPort: [0.03, 0.1, 0.0],
    reflexSight: true,
    flash: { size: 1, seconds: FX.muzzleFlashTime, shape: 'star' },
    reloadMotion: 1,
  },
  // The Prototype Crate's special weapon. Its model comes with no images
  // that can be used, so each of its three kinds of part is painted here:
  // the body in the game's own dark steel, the rings round the barrel and
  // the grip in worn brass, and the cell on top lit the colour of
  // everything that is on the player's side.
  turncoat: {
    model: 'turncoat',
    paint: 1,
    roughness: 1,
    parts: {
      body: { color: 0x9aa3ad, metalness: 1, roughness: 0.8, surface: 'Metal046B' },
      coil: { color: 0xc9a25a, metalness: 1, roughness: 0.42 },
      cell: { color: 0x0a1418, metalness: 0.2, roughness: 0.3, emissive: 0x4fe6ff, glow: 3.2 },
    },
    hip: { x: 0.18, y: -0.2, z: -0.52, yaw: 0.07, pitch: 0.03, roll: 0 },
    // No sights on it: held up under the eye, the cell on top just below the point of aim.
    aim: { x: 0, y: -0.139, z: -0.46, yaw: 0, pitch: 0, roll: 0 },
    sprint: { x: 0.14, y: -0.24, z: -0.42, yaw: 0.4, pitch: 0.5, roll: 0.1 },
    length: 0.44,
    muzzles: [[0, 0.037, -0.224]],
    ejectionPort: null,
    reflexSight: false,
    flash: { size: 0.8, seconds: 0.05, shape: 'burst', tint: [0.9, 2.8, 3.4] },
    reloadMotion: 0.8,
  },
};

/**
 * Give a copy of a gun's model its own materials, painted as that gun is:
 * the model's own images lifted by `paint`, or each named part painted from
 * the list. Returns the materials, for whoever needs to change them further.
 */
export function dressGun(model: THREE.Object3D, def: ViewModelDef, assets: Assets, look: { paint?: number; env?: number; glow?: number } = {}): THREE.MeshStandardMaterial[] {
  const made: THREE.MeshStandardMaterial[] = [];
  model.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = (mesh.material as THREE.MeshStandardMaterial).clone();
    const part = def.parts?.[material.name];
    material.envMapIntensity = look.env ?? 1.3;
    if (part) {
      material.color.setHex(part.color);
      material.metalness = part.metalness;
      material.roughness = part.roughness;
      if (part.surface) {
        const maps = assets.surface(part.surface);
        material.map = maps.color;
        material.normalMap = maps.normal;
        material.roughnessMap = maps.orm;
        material.metalnessMap = maps.orm;
      }
      if (part.emissive !== undefined) {
        material.emissive.setHex(part.emissive);
        material.emissiveIntensity = (part.glow ?? 2) * (look.glow ?? 1);
      }
    } else {
      material.color.setScalar(def.paint * (look.paint ?? 1));
      material.roughness = def.roughness;
      if (material.emissiveMap) material.emissiveIntensity = 2.4 * (look.glow ?? 1);
    }
    mesh.material = material;
    made.push(material);
  });
  return made;
}
