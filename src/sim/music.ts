// How loud and how bright the music bed is, moment to moment.
//
// The bed is one long loop. On its own it is the same at the first robot
// of a round as at the last, so this shapes it: low and muffled in the lull
// between rounds, opening up and rising as a round goes on, and fully open
// when the player is in the thick of it. It never goes above the level the
// bed was mixed at, so "building" means starting lower, not ending louder.
//
// Pure logic: the audio engine does what this says.

export interface MusicRules {
  /** How loud the bed is in the lull between rounds, and at the first moment of a round (1 = as mixed). */
  lull: number;
  roundStart: number;
  /** How open its tone is at those two moments (0 = muffled to a low rumble, 1 = all of it). */
  lullTone: number;
  roundStartTone: number;
  /** This many robots on the map at once count as the thick of it, however far the round has gone. */
  crowd: number;
}

export interface MusicMoment {
  /** A round is being fought (not the lull between two). */
  fighting: boolean;
  /** Share of the round's robots destroyed so far, 0..1. */
  progress: number;
  /** Robots on the map now. */
  active: number;
  /** The final stand, or ARGUS's own machine on the map: everything, at once. */
  climax: boolean;
}

export interface MusicLevel {
  /** Loudness, 0..1 of the level the bed was mixed at. */
  gain: number;
  /** Tone, 0 (muffled) to 1 (open). */
  tone: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** How far into its build the music is, 0 (a round just begun) to 1 (the thick of it). */
export function intensity(rules: MusicRules, moment: MusicMoment): number {
  if (!moment.fighting) return 0;
  if (moment.climax) return 1;
  // Whichever says more: how much of the round is done, or how many of them are on the player now.
  return clamp01(Math.max(moment.progress, moment.active / rules.crowd));
}

export function musicLevel(rules: MusicRules, moment: MusicMoment): MusicLevel {
  if (!moment.fighting) return { gain: rules.lull, tone: rules.lullTone };
  const build = intensity(rules, moment);
  // (Eased, so that most of the rise comes in the second half of a round.)
  const eased = build * build * (3 - 2 * build);
  return {
    gain: rules.roundStart + (1 - rules.roundStart) * eased,
    tone: rules.roundStartTone + (1 - rules.roundStartTone) * eased,
  };
}
