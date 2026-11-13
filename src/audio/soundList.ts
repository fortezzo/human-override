// Every sound the game plays. `files` are recorded variations, picked at
// random so repeated sounds (gunshots, footsteps) never sound identical.
// Paths are relative to public/assets/audio.

export interface SoundDef {
  files: string[];
  /** Relative loudness of this sound before bus and master volume. */
  gain: number;
  /** Random pitch variation, as a fraction (0.05 = plus or minus 5%). */
  pitchJitter?: number;
}

export const SOUNDS: Record<string, SoundDef> = {};

export type SoundId = keyof typeof SOUNDS;
