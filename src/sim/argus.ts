// ARGUS studies the player: what it writes down during a round, how it
// reads what it wrote, which counters it picks for the next round, what it
// says about it, and the profile it draws up at the end.
//
// This is rule-based game AI, not machine learning. Nothing here learns:
// it keeps a handful of counts (damage by weapon, time spent holding one
// spot, laps run, weak-point hits), compares each with a fixed threshold
// from the config, and picks at most two of four fixed counters. Every
// rule is in this file and every rule is unit-tested (tests/argus.test.ts).
//
// Pure logic: no rendering, no browser APIs. The game feeds it what the
// player did, and asks it what to do about it.

/** A weapon's id, or 'melee' for the strike. */
export type WeaponKey = string;

export interface ArgusRules {
  /** The first round ARGUS adapts for. Its analysis is shown in the lull before that round. */
  fromRound: number;
  /** The most counters in force at once. */
  maxCounters: number;
  /** Staying within this many metres of one spot is holding it ... */
  holdRadius: number;
  /** ... once it has gone on for this many seconds. */
  holdAfter: number;
  /** How often the player's trail is sampled, in seconds, and how many seconds of it are kept. */
  sampleEvery: number;
  trailSeconds: number;
  /**
   * A lap: coming back within `lapReturn` metres of where the player was at
   * least `lapSeconds` ago, having walked at least `lapDistance` metres
   * since and been at least `lapSpan` metres away in between.
   */
  lapReturn: number;
  lapSeconds: number;
  lapDistance: number;
  lapSpan: number;
  /** What it takes for each pattern to count: a share of the round's damage from one weapon ... */
  weaponShare: number;
  /** ... a share of the round spent holding one spot ... */
  holdShare: number;
  /** ... laps run in the round ... */
  laps: number;
  /** ... a share of hits landed on weak points. */
  weakShare: number;
  /** A round with less than this to go on is not judged: damage dealt, hits landed, seconds fought. */
  minDamage: number;
  minHits: number;
  minSeconds: number;
  /** Seconds between ARGUS's remarks, at the least. */
  remarkGap: number;
}

// ------------------------------------------------------------ the notes

/** What ARGUS writes down during one round (or, added up, over a whole run). */
export interface Notes {
  /** Seconds with robots on the map. */
  seconds: number;
  /** Damage dealt, by weapon. */
  damage: Record<WeaponKey, number>;
  /** Shots and strikes that landed, and how many of those landed on a weak point. */
  hits: number;
  weakHits: number;
  /** Seconds spent holding one spot, counting only stays long enough to be called that. */
  held: number;
  /** The longest single stay in one spot, in seconds. */
  longestHold: number;
  /** Times the player came back round to where they had been. */
  laps: number;
  /** Metres moved. */
  distance: number;
}

export function createNotes(): Notes {
  return { seconds: 0, damage: {}, hits: 0, weakHits: 0, held: 0, longestHold: 0, laps: 0, distance: 0 };
}

/** Add one set of notes to another (a round's to the run's). */
export function addNotes(total: Notes, notes: Notes): void {
  total.seconds += notes.seconds;
  for (const [weapon, amount] of Object.entries(notes.damage)) total.damage[weapon] = (total.damage[weapon] ?? 0) + amount;
  total.hits += notes.hits;
  total.weakHits += notes.weakHits;
  total.held += notes.held;
  total.longestHold = Math.max(total.longestHold, notes.longestHold);
  total.laps += notes.laps;
  total.distance += notes.distance;
}

/** A shot or strike landed. */
export function noteHit(notes: Notes, weapon: WeaponKey, damage: number, weakPoint: boolean): void {
  notes.damage[weapon] = (notes.damage[weapon] ?? 0) + damage;
  notes.hits += 1;
  if (weakPoint) notes.weakHits += 1;
}

/** Where the player has been lately, for telling a stand from a circuit. */
export interface Tracker {
  started: boolean;
  /** The spot being held, and how long the player has been within reach of it. */
  anchorX: number;
  anchorZ: number;
  stay: number;
  lastX: number;
  lastZ: number;
  clock: number;
  walked: number;
  sampleIn: number;
  /** The trail walked lately, oldest first: where, when, and how far the player had walked by then. */
  trail: Array<{ x: number; z: number; t: number; walked: number }>;
}

export function createTracker(): Tracker {
  return { started: false, anchorX: 0, anchorZ: 0, stay: 0, lastX: 0, lastZ: 0, clock: 0, walked: 0, sampleIn: 0, trail: [] };
}

/**
 * The player is at (x, z), `dt` seconds after the last call. Call this
 * only while there are robots to fight: standing still in an empty room is
 * not holding a position.
 */
export function noteMovement(tracker: Tracker, notes: Notes, rules: ArgusRules, dt: number, x: number, z: number): void {
  if (!tracker.started) {
    tracker.started = true;
    tracker.anchorX = tracker.lastX = x;
    tracker.anchorZ = tracker.lastZ = z;
  }
  notes.seconds += dt;
  tracker.clock += dt;
  const step = Math.hypot(x - tracker.lastX, z - tracker.lastZ);
  tracker.lastX = x;
  tracker.lastZ = z;
  // (A jump of metres in one step is not walking: the debug tools can place the player anywhere.)
  if (step < 2) {
    tracker.walked += step;
    notes.distance += step;
  } else {
    tracker.trail.length = 0;
  }

  // Holding a spot: still within reach of where this stay began.
  if (Math.hypot(x - tracker.anchorX, z - tracker.anchorZ) <= rules.holdRadius) {
    const before = tracker.stay;
    tracker.stay += dt;
    // A stay counts from its first second, once it has lasted long enough to be one.
    if (tracker.stay >= rules.holdAfter) notes.held += before < rules.holdAfter ? tracker.stay : dt;
    notes.longestHold = Math.max(notes.longestHold, tracker.stay);
  } else {
    tracker.anchorX = x;
    tracker.anchorZ = z;
    tracker.stay = 0;
  }

  // Laps: back where they were a while ago, having been a long way round since.
  tracker.sampleIn -= dt;
  if (tracker.sampleIn > 0) return;
  tracker.sampleIn = rules.sampleEvery;
  const trail = tracker.trail;
  for (let i = 0; i < trail.length; i++) {
    const point = trail[i]!;
    // (Oldest first: once one is too recent, or too few metres ago, so are all the rest.)
    if (tracker.clock - point.t < rules.lapSeconds || tracker.walked - point.walked < rules.lapDistance) break;
    if (Math.hypot(x - point.x, z - point.z) > rules.lapReturn) continue;
    let span = 0;
    for (let j = i + 1; j < trail.length; j++) span = Math.max(span, Math.hypot(trail[j]!.x - point.x, trail[j]!.z - point.z));
    if (span < rules.lapSpan) continue;
    notes.laps += 1;
    trail.length = 0;
    break;
  }
  trail.push({ x, z, t: tracker.clock, walked: tracker.walked });
  while (trail.length && tracker.clock - trail[0]!.t > rules.trailSeconds) trail.shift();
}

// ------------------------------------------------------- reading the notes

/**
 * The four things ARGUS can do about what it sees:
 *   shielding  the player leans on one weapon: some robots carry shielding that halves its damage
 *   flush      the player holds one spot: bombers are sent, and robots breach from behind
 *   intercept  the player runs the horde in circles: interceptors cut across the loop
 *   guard      the player lands many weak-point hits: robots armour their weak points
 */
export type CounterId = 'shielding' | 'flush' | 'intercept' | 'guard';

/** A pattern ARGUS found in a round's notes. */
export interface Finding {
  counter: CounterId;
  /** For shielding: the weapon it is against. */
  weapon?: WeaponKey;
  /** The number ARGUS quotes: a percentage, or a count of laps. */
  figure: number;
  /** How far past its threshold the evidence is (1 is just enough). The strongest findings are acted on. */
  weight: number;
}

/** The weapon that did most of the damage, and its share of the whole (0..1), or null if none was done. */
export function favouriteWeapon(notes: Notes): { weapon: WeaponKey; share: number; total: number } | null {
  let total = 0;
  let weapon: WeaponKey | null = null;
  let most = 0;
  for (const [key, amount] of Object.entries(notes.damage)) {
    total += amount;
    if (amount > most) {
      most = amount;
      weapon = key;
    }
  }
  return weapon === null || total <= 0 ? null : { weapon, share: most / total, total };
}

/** Every pattern in a round's notes that passes its threshold, strongest first. */
export function readNotes(notes: Notes, rules: ArgusRules): Finding[] {
  const found: Finding[] = [];
  const favourite = favouriteWeapon(notes);
  if (favourite && favourite.total >= rules.minDamage && favourite.share >= rules.weaponShare) {
    found.push({ counter: 'shielding', weapon: favourite.weapon, figure: Math.round(favourite.share * 100), weight: favourite.share / rules.weaponShare });
  }
  if (notes.seconds >= rules.minSeconds) {
    const share = notes.held / notes.seconds;
    if (share >= rules.holdShare) found.push({ counter: 'flush', figure: Math.round(share * 100), weight: share / rules.holdShare });
    if (notes.laps >= rules.laps) found.push({ counter: 'intercept', figure: notes.laps, weight: notes.laps / rules.laps });
  }
  if (notes.hits >= rules.minHits) {
    const share = notes.weakHits / notes.hits;
    if (share >= rules.weakShare) found.push({ counter: 'guard', figure: Math.round(share * 100), weight: share / rules.weakShare });
  }
  return found.sort((a, b) => b.weight - a.weight);
}

// ------------------------------------------------------------ the analysis

/** A counter in force. */
export interface Adaptation {
  counter: CounterId;
  weapon?: WeaponKey;
}

/** One line of the banner: what ARGUS saw, and what it is doing about it. */
export interface AnalysisLine {
  observed: string;
  adapting: string;
}

/** What ARGUS decided in one lull. */
export interface Analysis {
  /** The round the counters are for. */
  round: number;
  adaptations: Adaptation[];
  /** Counters that were in force for the round before and have been dropped: the player stopped doing what they answered. */
  withdrawn: Adaptation[];
  lines: AnalysisLine[];
}

export interface ArgusState {
  /** The counters in force for the round being played. */
  active: Adaptation[];
  /** Every analysis so far, in order. */
  history: Analysis[];
  /** The notes of every round so far, added up. */
  totals: Notes;
  /** ARGUS's remarks: when the last one was made, and which have been used. */
  lastRemark: number;
  said: string[];
}

export function createArgus(): ArgusState {
  return { active: [], history: [], totals: createNotes(), lastRemark: -Infinity, said: [] };
}

/** What each weapon is called in ARGUS's sentences ("the carbine"). */
export type WeaponNames = (weapon: WeaponKey) => string;

const same = (a: Adaptation, b: Adaptation): boolean => a.counter === b.counter && a.weapon === b.weapon;

/** What a counter is called on the banner and in the end-of-run report. */
export function adaptationName(adaptation: Adaptation, name: WeaponNames): string {
  switch (adaptation.counter) {
    case 'shielding':
      return adaptation.weapon === 'melee' ? 'strike-resistant plating' : `${name(adaptation.weapon ?? '')}-resistant plating`;
    case 'flush':
      return 'bombers, and a breach behind you';
    case 'intercept':
      return 'interceptors across your route';
    case 'guard':
      return 'armoured weak points';
  }
}

function observed(finding: Finding, name: WeaponNames): string {
  switch (finding.counter) {
    case 'shielding':
      return finding.weapon === 'melee' ? `${finding.figure}% of damage from melee strikes` : `${finding.figure}% of damage from the ${name(finding.weapon ?? '')}`;
    case 'flush':
      return `${finding.figure}% of the round spent holding one position`;
    case 'intercept':
      return `${finding.figure} laps run with the horde in tow`;
    case 'guard':
      return `${finding.figure}% of hits on weak points`;
  }
}

/**
 * The lull after a round: add its notes to the run's, read them, and
 * choose the counters for `nextRound`. Returns the analysis to show, or
 * null while ARGUS is still only watching (before `fromRound`).
 */
export function analyse(state: ArgusState, notes: Notes, rules: ArgusRules, nextRound: number, name: WeaponNames): Analysis | null {
  addNotes(state.totals, notes);
  if (nextRound < rules.fromRound) return null;

  const findings = readNotes(notes, rules).slice(0, rules.maxCounters);
  const adaptations: Adaptation[] = findings.map((finding) => (finding.weapon === undefined ? { counter: finding.counter } : { counter: finding.counter, weapon: finding.weapon }));
  const withdrawn = state.active.filter((old) => !adaptations.some((now) => same(old, now)));

  const lines: AnalysisLine[] = findings.map((finding, i) => ({
    observed: `${observed(finding, name)}.`,
    adapting: `${state.active.some((old) => same(old, adaptations[i]!)) ? 'Maintaining' : 'Adapting'}: ${adaptationName(adaptations[i]!, name)}.`,
  }));
  if (withdrawn.length) {
    // The player changed what they were doing: say so, and say what is being taken away.
    lines.push({ observed: 'You changed your approach.', adapting: `Withdrawing: ${withdrawn.map((old) => adaptationName(old, name)).join('; ')}.` });
  }
  if (!lines.length) lines.push({ observed: 'No dominant pattern.', adapting: 'Adapting: nothing. Yet.' });

  const analysis: Analysis = { round: nextRound, adaptations, withdrawn, lines };
  state.active = adaptations;
  state.history.push(analysis);
  return analysis;
}

/** Every different counter ARGUS used in the run, in the order it first used them, with the rounds it was in force. */
export function adaptationsUsed(state: ArgusState): Array<{ adaptation: Adaptation; rounds: number[] }> {
  const used: Array<{ adaptation: Adaptation; rounds: number[] }> = [];
  for (const analysis of state.history) {
    for (const adaptation of analysis.adaptations) {
      const entry = used.find((u) => same(u.adaptation, adaptation));
      if (entry) entry.rounds.push(analysis.round);
      else used.push({ adaptation, rounds: [analysis.round] });
    }
  }
  return used;
}

// ---------------------------------------------------------------- remarks

/** Things the player does that ARGUS may pass a remark on. */
export type RemarkCue =
  | 'firstKill'
  | 'weakStreak'
  | 'holding'
  | 'lapping'
  | 'lowHealth'
  | 'strikes'
  | 'emptyGun'
  | 'newWeapon'
  | 'brokeCounter'
  | 'powerRestored'
  | 'keyTaken'
  | 'uplinkStarted'
  | 'custodianDown'
  | 'coreOpened'
  | 'standStarted'
  | 'proxyDown'
  | 'lastedLong';

/** What it says. Each line is used once in a run; a cue with two lines can come up twice. */
export const REMARKS: Record<RemarkCue, readonly string[]> = {
  firstKill: ['One unit lost. I have others.'],
  weakStreak: ['You aim for the sensors. Noted.', 'Precise again. I am keeping count.'],
  holding: ['You have not moved in some time.', 'Still in the same place. I know where to send them.'],
  lapping: ['The same route again. You are predictable.', 'Round and round. I can see where you will be.'],
  lowHealth: ['Your vital signs are failing.', 'You are slowing down.'],
  strikes: ['Striking my units by hand. Inefficient.'],
  emptyGun: ['Empty. I counted.'],
  newWeapon: ['A new weapon. It changes nothing.', 'Another weapon. I will learn that one too.'],
  brokeCounter: ['You changed. So will I.'],
  powerRestored: ['Power will not help you.'],
  keyTaken: ['That key opens nothing you will live to see.', 'Two keys. You will not reach the third.'],
  uplinkStarted: ['You are transmitting. So am I.'],
  custodianDown: ['The Custodian can be replaced. You cannot.'],
  coreOpened: ['You should not be in here.'],
  standStarted: ['It takes time to arm. You do not have it.'],
  proxyDown: ['That body was one of many.'],
  lastedLong: ['You have lasted longer than projected.'],
};

/**
 * ARGUS may remark on something. Returns the line, or null if it has
 * spoken too recently or has nothing left to say about that.
 */
export function remark(state: ArgusState, rules: ArgusRules, cue: RemarkCue, now: number): string | null {
  if (now - state.lastRemark < rules.remarkGap) return null;
  const line = REMARKS[cue].find((candidate) => !state.said.includes(candidate));
  if (!line) return null;
  state.said.push(line);
  state.lastRemark = now;
  return line;
}

// ----------------------------------------------------------- the profile

export type PlayStyle = 'marksman' | 'fortress' | 'runner' | 'specialist' | 'brawler' | 'improviser';

export interface Profile {
  style: PlayStyle;
  /** The label on the card. */
  label: string;
  /** ARGUS's one-line verdict. */
  verdict: string;
}

const STYLES: Record<PlayStyle, { label: string; verdict: string }> = {
  marksman: { label: 'THE MARKSMAN', verdict: 'Aims for the sensors and rarely wastes a round.' },
  fortress: { label: 'THE FORTRESS', verdict: 'Chooses its ground and makes my units come to it.' },
  runner: { label: 'THE RUNNER', verdict: 'Never stops moving. Leads my units in circles.' },
  specialist: { label: 'THE SPECIALIST', verdict: 'Trusts one weapon and little else.' },
  brawler: { label: 'THE BRAWLER', verdict: 'Prefers to break my units by hand.' },
  improviser: { label: 'THE IMPROVISER', verdict: 'No fixed pattern. Difficult to prepare for.' },
};

/**
 * ARGUS's profile of the player, from the notes of the whole run: the
 * style whose evidence is furthest past its threshold, or the improviser
 * if none is.
 */
export function profile(totals: Notes, rules: ArgusRules): Profile {
  const scores: Array<[PlayStyle, number]> = [];
  const favourite = favouriteWeapon(totals);
  if (favourite && favourite.total >= rules.minDamage) {
    const strikes = (totals.damage.melee ?? 0) / favourite.total;
    // (Half the damage done by hand is a great deal: the bar for the brawler is half the bar for a weapon.)
    scores.push(['brawler', strikes / (rules.weaponShare * 0.5)]);
    if (favourite.weapon !== 'melee') scores.push(['specialist', favourite.share / (rules.weaponShare * 1.25)]);
  }
  if (totals.hits >= rules.minHits) scores.push(['marksman', totals.weakHits / totals.hits / rules.weakShare]);
  if (totals.seconds >= rules.minSeconds) {
    scores.push(['fortress', totals.held / totals.seconds / rules.holdShare]);
    // (Over a run: so many laps for every minute and a half of fighting.)
    scores.push(['runner', totals.laps / (totals.seconds / 90) / rules.laps]);
  }
  let style: PlayStyle = 'improviser';
  let best = 1;
  for (const [candidate, score] of scores) {
    if (score >= best) {
      best = score;
      style = candidate;
    }
  }
  return { style, ...STYLES[style] };
}
