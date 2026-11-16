// What happened in one run, for the game-over screen (and, later, for
// ARGUS's profile of the player).

export interface RunStats {
  /** Seconds played. */
  time: number;
  /** The round the player is in (the one they reached when they go down). */
  round: number;
  kills: number;
  weakPointKills: number;
  meleeKills: number;
  shots: number;
  /** Shots that hit at least one robot. */
  shotsHit: number;
  scrapEarned: number;
  scrapSpent: number;
  doorsOpened: number;
  /** Times the fail-safe brought the player back. */
  revives: number;
  /** How long the run had lasted when the kill switch was pulled (seconds), or null if it never was. */
  missionTime: number | null;
  /** Part of the mission was skipped with the debug tools, so its time is not a record. */
  missionSkipped: boolean;
}

export function createRunStats(): RunStats {
  return { time: 0, round: 0, kills: 0, weakPointKills: 0, meleeKills: 0, shots: 0, shotsHit: 0, scrapEarned: 0, scrapSpent: 0, doorsOpened: 0, revives: 0, missionTime: null, missionSkipped: false };
}

/** Fraction of shots that hit, 0..1. */
export function accuracy(stats: RunStats): number {
  return stats.shots > 0 ? stats.shotsHit / stats.shots : 0;
}

const BEST_KEY = 'human-override.best.v1';

export interface BestRun {
  round: number;
  /** The fastest the mission has been finished, in seconds, or null if it never has been. */
  missionTime: number | null;
}

export function readBest(): BestRun {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<BestRun>) : {};
    const time = Number(parsed.missionTime);
    return { round: Number(parsed.round) || 0, missionTime: time > 0 ? time : null };
  } catch {
    return { round: 0, missionTime: null };
  }
}

/**
 * Record a run: the round it reached and, if the mission was finished, how
 * long that took. Each is kept only if it beats the best so far. Returns
 * which of the two records it set.
 */
export function saveBest(stats: RunStats): { round: boolean; mission: boolean } {
  const best = readBest();
  const round = stats.round > best.round;
  const mission = stats.missionTime !== null && !stats.missionSkipped && (best.missionTime === null || stats.missionTime < best.missionTime);
  if (!round && !mission) return { round, mission };
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify({ round: round ? stats.round : best.round, missionTime: mission ? stats.missionTime : best.missionTime }));
  } catch {
    // Private browsing: the record just will not be kept.
  }
  return { round, mission };
}

/** A length of time as minutes and seconds: 754 -> "12:34". */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
