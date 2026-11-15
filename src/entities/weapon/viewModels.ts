// How each gun is held in the player's view: where it sits at the hip, when
// aiming and when sprinting, and where its muzzle and ejection port are.
//
// Positions are relative to the eye, in real metres. Points on a gun are in
// that gun model's own coordinates (it points down -Z, +Y is up).

import type { WeaponId } from '../../config';
import type { ModelId } from '../../assetList';
import { SIGHT_HEIGHT } from './ReflexSight';

export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
}

export interface ViewModelDef {
  model: ModelId;
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
  /** Size of the muzzle flash relative to the carbine's. */
  flashSize: number;
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
    muzzles: [[0, 0.04, -0.104]],
    ejectionPort: [0.014, 0.05, -0.02],
    reflexSight: false,
    flashSize: 0.62,
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
    muzzles: [
      [-0.017, 0.04, -0.334],
      [0.017, 0.04, -0.334],
    ],
    ejectionPort: null,
    reflexSight: false,
    flashSize: 1.35,
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
    muzzles: [[0, 0.094, -0.475]],
    ejectionPort: [0.03, 0.1, 0.0],
    reflexSight: true,
    flashSize: 1,
    reloadMotion: 1,
  },
};
