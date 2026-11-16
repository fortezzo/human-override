// The first minute, taught without anything to read.
//
// Most people will never open How to Play. So during the first rounds the
// game shows one short hint at a time (move, fire, aim, jump, follow the
// marker, buy) and takes each one away the moment the player has done what
// it says. Something the player does before its hint comes up is never
// hinted at all, and what a player has done once is remembered, so someone
// on their second run is not taught again.
//
// Pure logic: this decides which hint is showing. The words and the keys
// are the HUD's (ui/Hud.ts).

/** The hints, in the order they are offered. */
export const HINTS = ['move', 'fire', 'aim', 'jump', 'marker', 'buy'] as const;
export type HintId = (typeof HINTS)[number];

export interface CoachRules {
  /** Metres to walk before "move" counts as done. */
  moveDistance: number;
  /** Seconds of aiming down the sights before "aim" counts as done. */
  aimSeconds: number;
  /** Metres nearer the marker's place the player must get, from where they were when the hint appeared. */
  markerMetres: number;
  /** Seconds before the first hint, and between one hint going and the next arriving. */
  gap: number;
  /** Seconds a hint stays, shown as done, once the player has done it. */
  linger: number;
  /** No hint appears after this round: by then the player is too busy to read one. */
  lastRound: number;
}

export interface Coach {
  /** What the player has done, in this run or an earlier one. */
  learned: Record<HintId, boolean>;
  /** The hint on screen, or null. */
  showing: HintId | null;
  /** The hint on screen has just been done, and is on its way out. */
  done: boolean;
  /** Seconds until the hint on screen goes, or until the next may appear. */
  wait: number;
  /** Metres walked so far, and seconds spent aiming. */
  walked: number;
  aimed: number;
  /** How far the marker's place was when its hint appeared (null while it is not showing). */
  markerFrom: number | null;
}

/** What the player did since the last look. */
export interface CoachSeen {
  /** Metres walked. */
  walked: number;
  fired: boolean;
  aiming: boolean;
  jumped: boolean;
  bought: boolean;
  /** They have the scrap for the first thing a new player would buy. */
  canBuy: boolean;
  /** How far away the place the marker points to is, in metres, or null if there is no marker. */
  markerDistance: number | null;
  /** The round being played (0 before the first begins). */
  round: number;
}

/** A coach for a new run. `learned` is what earlier runs taught (every hint, to have it say nothing at all). */
export function createCoach(rules: CoachRules, learned: readonly HintId[] = []): Coach {
  const known = {} as Record<HintId, boolean>;
  for (const id of HINTS) known[id] = learned.includes(id);
  return { learned: known, showing: null, done: false, wait: rules.gap, walked: 0, aimed: 0, markerFrom: null };
}

/**
 * Advance by `dt` seconds. Returns the hints the player has just learned
 * (to be remembered for their next run).
 */
export function updateCoach(coach: Coach, rules: CoachRules, seen: CoachSeen, dt: number): HintId[] {
  const fresh: HintId[] = [];
  const learn = (id: HintId, did: boolean): void => {
    if (!did || coach.learned[id]) return;
    coach.learned[id] = true;
    fresh.push(id);
  };

  // Whatever the player does counts, whether or not its hint is the one showing.
  coach.walked += seen.walked;
  coach.aimed = seen.aiming ? coach.aimed + dt : 0;
  learn('move', coach.walked >= rules.moveDistance);
  learn('fire', seen.fired);
  learn('aim', coach.aimed >= rules.aimSeconds);
  learn('jump', seen.jumped);
  learn('buy', seen.bought);
  // (Following the marker is only judged while its hint is up: anyone walks toward it by chance.)
  if (coach.showing === 'marker' && coach.markerFrom !== null && seen.markerDistance !== null) {
    learn('marker', seen.markerDistance <= coach.markerFrom - rules.markerMetres || seen.markerDistance < 3);
  }

  coach.wait = Math.max(0, coach.wait - dt);
  if (coach.showing) {
    if (!coach.done && coach.learned[coach.showing]) {
      // Done: it stays a moment, marked as done, and then goes.
      coach.done = true;
      coach.wait = rules.linger;
    } else if (coach.done && coach.wait <= 0) {
      coach.showing = null;
      coach.done = false;
      coach.markerFrom = null;
      coach.wait = rules.gap;
    } else if (!coach.done && (seen.round > rules.lastRound || (coach.showing === 'marker' && seen.markerDistance === null) || (coach.showing === 'buy' && !seen.canBuy))) {
      // No longer the moment for it (the rounds have moved on, the marker has gone, the scrap is spent): it goes unlearned.
      coach.showing = null;
      coach.markerFrom = null;
      coach.wait = rules.gap;
    }
    return fresh;
  }

  if (coach.wait > 0 || seen.round > rules.lastRound) return fresh;
  for (const id of HINTS) {
    if (coach.learned[id]) continue;
    // Some hints wait for their moment: the marker for there to be one, buying for the scrap to buy with.
    if (id === 'marker' && seen.markerDistance === null) continue;
    if (id === 'buy' && !seen.canBuy) continue;
    coach.showing = id;
    coach.done = false;
    coach.markerFrom = id === 'marker' ? seen.markerDistance : null;
    break;
  }
  return fresh;
}
