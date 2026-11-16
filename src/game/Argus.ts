// ARGUS in the game: it is told what the player does, takes its notes,
// and in the lull after each round decides what to send next and says so.
// The rules are all in sim/argus.ts; this class only connects them to the
// game (what was hit and with what, where the player is standing, when a
// round ends) and to the screen (the analysis banner, the remarks, the
// end-of-run profile).
//
// This is rule-based game AI, not machine learning: a handful of counts
// compared with fixed thresholds.

import { ARGUS, WEAPONS, type WeaponId } from '../config';
import type { Player } from '../entities/Player';
import type { Robot } from '../entities/robot/Robot';
import {
  adaptationName,
  adaptationsUsed,
  analyse,
  createArgus,
  createNotes,
  createTracker,
  favouriteWeapon,
  noteHit,
  noteMovement,
  profile,
  remark,
  type Adaptation,
  type Analysis,
  type ArgusState,
  type Notes,
  type Profile,
  type RemarkCue,
  type Tracker,
  type WeaponKey,
} from '../sim/argus';
import type { HitResult } from './Combat';
import type { Director } from './Director';

/** Seconds into the lull before the analysis is shown: after the "round cleared" announcement has gone. */
const BANNER_DELAY = 3.2;
/** Seconds in one spot before it remarks on it; laps in one round before it remarks on those. */
const HOLDING_REMARK = 20;
const LAPS_REMARK = 2;

/** What each weapon is called in ARGUS's sentences. */
export function weaponName(weapon: WeaponKey): string {
  if (weapon === 'melee') return 'melee strike';
  return WEAPONS[weapon as WeaponId]?.kind.toLowerCase() ?? weapon;
}

/** ARGUS's profile of the player, for the end-of-run card. */
export interface ArgusReport {
  profile: Profile;
  /** The weapon that did most of the damage, and its share (0..1); null if none was done. */
  favourite: { name: string; share: number } | null;
  /** Share of hits that landed on a weak point, share of the fighting spent holding one spot, laps run, metres moved. */
  weakShare: number;
  heldShare: number;
  laps: number;
  distance: number;
  /** Every counter it used, in the order it first used them, with the rounds each was in force. */
  adaptations: Array<{ name: string; rounds: number[] }>;
}

export class Argus {
  /** The analysis is ready: show the banner. */
  onAnalysis: (analysis: Analysis) => void = () => {};
  /** ARGUS has a remark to make. */
  onRemark: (line: string) => void = () => {};
  /** The kill switch has been pulled: ARGUS is off, and neither watches nor adapts any more. */
  offline = false;

  private state: ArgusState = createArgus();
  private notes: Notes = createNotes();
  private tracker: Tracker = createTracker();
  private clock = 0;
  private pending: { analysis: Analysis; in: number } | null = null;
  /** For the remarks: kills so far, weak-point kills in a row, strikes that destroyed a robot this round. */
  private kills = 0;
  private weakStreak = 0;
  private strikeKills = 0;
  private remarkedHold = false;
  private remarkedLaps = false;
  private brokeCounter = false;
  /** The last round that began while it was watching. (A counter chosen for a round that never came was never used.) */
  private round = 0;

  constructor(
    private readonly director: Director,
    private readonly player: Player,
    private readonly robots: readonly Robot[],
  ) {}

  /** A new run. */
  reset(): void {
    this.state = createArgus();
    this.notes = createNotes();
    this.tracker = createTracker();
    this.clock = 0;
    this.pending = null;
    this.offline = false;
    this.kills = 0;
    this.weakStreak = 0;
    this.strikeKills = 0;
    this.remarkedHold = false;
    this.remarkedLaps = false;
    this.brokeCounter = false;
    this.round = 0;
    this.director.counters = [];
  }

  /** The counters in force for the round being played. */
  get active(): readonly Adaptation[] {
    return this.state.active;
  }

  /** What it has written down about the round being played (for the debug tools and tests). */
  get roundNotes(): Notes {
    return this.notes;
  }

  /** Every analysis so far. */
  get history(): readonly Analysis[] {
    return this.state.history;
  }

  /** Once a frame while the game is being played. */
  update(dt: number): void {
    this.clock += dt;
    if (this.offline) return;
    if (this.pending) {
      this.pending.in -= dt;
      if (this.pending.in <= 0) {
        this.onAnalysis(this.pending.analysis);
        this.pending = null;
      }
    }

    // It watches where the player stands only while there is something to
    // fight: standing still in an empty room is not holding a position.
    if (!this.robots.some((robot) => robot.alive)) return;
    const { position } = this.player;
    noteMovement(this.tracker, this.notes, ARGUS, dt, position.x, position.z);

    if (!this.remarkedHold && this.tracker.stay >= HOLDING_REMARK) this.remarkedHold = this.say('holding');
    if (!this.remarkedLaps && this.notes.laps >= LAPS_REMARK) this.remarkedLaps = this.say('lapping');
    if (this.player.alive && this.player.health < 30) this.say('lowHealth');
  }

  /** A shot or strike landed on a robot. */
  hit(hit: HitResult): void {
    if (this.offline) return;
    // (A bomber's blast is nobody's weapon.)
    if (hit.weapon !== 'blast') noteHit(this.notes, hit.weapon, hit.damage, hit.weakPoint);
    if (!hit.killed) return;
    this.kills += 1;
    if (this.kills === 1) this.say('firstKill');
    this.weakStreak = hit.weakPoint ? this.weakStreak + 1 : 0;
    if (this.weakStreak >= 4) {
      this.weakStreak = 0;
      this.say('weakStreak');
    }
    if (hit.melee) {
      this.strikeKills += 1;
      if (this.strikeKills === 3) this.say('strikes');
    }
  }

  /** A round has started. */
  roundStarted(round: number): void {
    if (this.offline) return;
    this.round = round;
    this.strikeKills = 0;
    this.remarkedHold = false;
    this.remarkedLaps = false;
    if (this.brokeCounter) {
      this.brokeCounter = false;
      this.say('brokeCounter');
    } else if (round === 9) {
      this.say('lastedLong');
    }
  }

  /**
   * A round has been cleared: read the notes, choose the counters for the
   * next one, and get the analysis ready to show a moment into the lull.
   */
  roundCleared(round: number): void {
    if (this.offline) return;
    const analysis = analyse(this.state, this.notes, ARGUS, round + 1, weaponName);
    this.notes = createNotes();
    this.tracker = createTracker();
    this.director.counters = this.state.active;
    if (!analysis) return;
    this.brokeCounter = analysis.withdrawn.length > 0;
    this.pending = { analysis, in: BANNER_DELAY };
  }

  /** Something has happened that ARGUS may pass a remark on. Returns true if it did. */
  say(cue: RemarkCue): boolean {
    if (this.offline) return false;
    const line = remark(this.state, ARGUS, cue, this.clock);
    if (line) this.onRemark(line);
    return line !== null;
  }

  /** The kill switch has been pulled. */
  shutDown(): void {
    this.offline = true;
    this.pending = null;
    this.director.counters = [];
  }

  /** Its profile of the player, from everything it wrote down in the run (the round in play included). */
  report(): ArgusReport {
    const totals: Notes = createNotes();
    for (const notes of [this.state.totals, this.notes]) {
      totals.seconds += notes.seconds;
      for (const [weapon, amount] of Object.entries(notes.damage)) totals.damage[weapon] = (totals.damage[weapon] ?? 0) + amount;
      totals.hits += notes.hits;
      totals.weakHits += notes.weakHits;
      totals.held += notes.held;
      totals.longestHold = Math.max(totals.longestHold, notes.longestHold);
      totals.laps += notes.laps;
      totals.distance += notes.distance;
    }
    const favourite = favouriteWeapon(totals);
    return {
      profile: profile(totals, ARGUS),
      favourite: favourite ? { name: weaponName(favourite.weapon), share: favourite.share } : null,
      weakShare: totals.hits ? totals.weakHits / totals.hits : 0,
      heldShare: totals.seconds ? totals.held / totals.seconds : 0,
      laps: totals.laps,
      distance: totals.distance,
      // (Only the rounds that began: a run can end in the lull, or with the
      // switch pulled, after ARGUS has chosen counters for a round that never comes.)
      adaptations: adaptationsUsed(this.state)
        .map((used) => ({ name: adaptationName(used.adaptation, weaponName), rounds: used.rounds.filter((round) => round <= this.round) }))
        .filter((used) => used.rounds.length > 0),
    };
  }
}
