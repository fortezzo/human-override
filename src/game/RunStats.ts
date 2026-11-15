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
}

export function createRunStats(): RunStats {
  return { time: 0, round: 0, kills: 0, weakPointKills: 0, meleeKills: 0, shots: 0, shotsHit: 0, scrapEarned: 0, scrapSpent: 0, doorsOpened: 0 };
}

/** Fraction of shots that hit, 0..1. */
export function accuracy(stats: RunStats): number {
  return stats.shots > 0 ? stats.shotsHit / stats.shots : 0;
}

const BEST_KEY = 'human-override.best.v1';

export interface BestRun {
  round: number;
}

export function readBest(): BestRun {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<BestRun>) : {};
    return { round: Number(parsed.round) || 0 };
  } catch {
    return { round: 0 };
  }
}

/** Record a finished run. Returns true if it beat the best so far. */
export function saveBest(stats: RunStats): boolean {
  const best = readBest();
  if (stats.round <= best.round) return false;
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify({ round: stats.round }));
  } catch {
    // Private browsing: the record just will not be kept.
  }
  return true;
}
