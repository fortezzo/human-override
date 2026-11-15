// What a robot design has to provide. Each robot type is one of these:
// the same skeleton and motion, a different body.

import type { Paint, RobotBuilder } from './RobotBuilder';
import type { PostureLean, Proportions, Rig } from './Rig';

export interface RobotDesign {
  /** How the skeleton is reshaped before the body is built on it. */
  proportions: Proportions;
  /** Constant leans added on top of every animation (the hunch). */
  posture: PostureLean[];
  /** Overall size multiplier. */
  scale: number;
  /** The weak point: a sphere given relative to the head joint in the rest pose. */
  weakPoint: { centre: [number, number, number]; radius: number };
  /** Centre of the visor's glow relative to the head joint, and its width and height. */
  glow: { at: [number, number, number]; size: [number, number] };
  /** Colour of everything on it that glows (the standard red if left out). */
  eyeColor?: number;
  /** Somewhere on the body an object can be hung: relative to a joint, riding on that joint's bone. */
  carry?: { bone: string; at: [number, number, number] };
  /** Adds every part of the body to the builder. */
  build(rig: Rig, builder: RobotBuilder): void;
}

/** The finishes shared by every design. Colors are linear base colors. */
export const PAINT = {
  /** Dark gunmetal plating: painted, so only partly metallic. */
  armor: { color: [0.034, 0.037, 0.043], metal: 0.5, rough: 0.05, grime: 0.14 },
  /** The same plating low on the body, where rust gets a hold. */
  armorWorn: { color: [0.032, 0.034, 0.038], metal: 0.5, rough: 0.1, grime: 0.24 },
  /** Bare structural steel, almost black. */
  frame: { color: [0.019, 0.02, 0.022], metal: 1, rough: 0, grime: 0.22 },
  /** Machined joints and claws: paler and a little shinier. */
  joint: { color: [0.07, 0.069, 0.067], metal: 1, rough: -0.14, grime: 0.1 },
  /** Thin polished rods (piston shafts, antennas), kept clean so they read as moving parts. */
  rod: { color: [0.13, 0.13, 0.128], metal: 1, rough: -0.24, grime: 0 },
  /** Hoses, bellows and cable sheathing. */
  rubber: { color: [0.011, 0.011, 0.012], metal: 0, rough: 0.35, grime: 0.05 },
  /** Worn hazard paint: the one warm accent on the machine. */
  hazard: { color: [0.3, 0.17, 0.026], metal: 0.15, rough: 0.1, grime: 0.26 },
  /** Dark glass over sensors. */
  lens: { color: [0.008, 0.008, 0.01], metal: 0.3, rough: -0.3, grime: 0 },
} satisfies Record<string, Paint>;
