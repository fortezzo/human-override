import { describe, expect, it } from 'vitest';
import { ARGUS } from '../src/config';
import {
  REMARKS,
  adaptationName,
  adaptationsUsed,
  addNotes,
  analyse,
  createArgus,
  createNotes,
  createTracker,
  favouriteWeapon,
  noteHit,
  noteMovement,
  profile,
  readNotes,
  remark,
  type ArgusRules,
  type Notes,
} from '../src/sim/argus';

const rules: ArgusRules = ARGUS;
const names = (weapon: string): string => ({ pistol: 'sidearm', shotgun: 'breacher', carbine: 'carbine' })[weapon] ?? weapon;
const STEP = 1 / 60;

/** Walk a path at walking pace: `points` are corners, visited in order. */
function walk(notes: Notes, points: Array<[number, number]>, speed = 4.3, tracker = createTracker()): ReturnType<typeof createTracker> {
  let [x, z] = points[0]!;
  for (const [tx, tz] of points.slice(1)) {
    for (;;) {
      const dx = tx - x;
      const dz = tz - z;
      const left = Math.hypot(dx, dz);
      const stride = speed * STEP;
      if (left <= stride) {
        x = tx;
        z = tz;
        noteMovement(tracker, notes, rules, STEP, x, z);
        break;
      }
      x += (dx / left) * stride;
      z += (dz / left) * stride;
      noteMovement(tracker, notes, rules, STEP, x, z);
    }
  }
  return tracker;
}

/** Stand at one spot for so many seconds. */
function stand(notes: Notes, seconds: number, x = 0, z = 0, tracker = createTracker()): ReturnType<typeof createTracker> {
  for (let t = 0; t < seconds; t += STEP) noteMovement(tracker, notes, rules, STEP, x, z);
  return tracker;
}

/** A round's notes with damage dealt by weapon: [weapon, hits, of which on a weak point, damage per hit]. */
function fought(...dealt: Array<[string, number, number, number]>): Notes {
  const notes = createNotes();
  notes.seconds = 60;
  for (const [weapon, hits, weak, damage] of dealt) for (let i = 0; i < hits; i++) noteHit(notes, weapon, damage, i < weak);
  return notes;
}

describe('what ARGUS writes down', () => {
  it('adds up damage by weapon, and counts hits and weak-point hits', () => {
    const notes = fought(['carbine', 20, 5, 34], ['shotgun', 4, 0, 100]);
    expect(notes.damage.carbine).toBe(680);
    expect(notes.damage.shotgun).toBe(400);
    expect(notes.hits).toBe(24);
    expect(notes.weakHits).toBe(5);
    expect(favouriteWeapon(notes)).toEqual({ weapon: 'carbine', share: 680 / 1080, total: 1080 });
    expect(favouriteWeapon(createNotes())).toBeNull();
  });

  it('counts a long stay in one spot as holding it, from its first second', () => {
    const notes = createNotes();
    stand(notes, 30);
    expect(notes.seconds).toBeCloseTo(30, 0);
    expect(notes.held).toBeCloseTo(30, 0);
    expect(notes.longestHold).toBeCloseTo(30, 0);
    expect(notes.laps).toBe(0);
  });

  it('does not count a short stop, or shuffling about inside the same few metres as moving on', () => {
    const brief = createNotes();
    stand(brief, rules.holdAfter - 1);
    expect(brief.held).toBe(0);

    const shuffling = createNotes();
    const tracker = createTracker();
    for (let i = 0; i < 60; i++) walk(shuffling, i % 2 ? [[0, 0], [2, 0]] : [[2, 0], [0, 0]], 4.3, tracker);
    expect(shuffling.held).toBeGreaterThan(shuffling.seconds * 0.9);
    expect(shuffling.laps).toBe(0);
  });

  it('counts laps of a loop, and does not call a walk in a straight line one', () => {
    const square: Array<[number, number]> = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const notes = createNotes();
    const tracker = createTracker();
    for (let lap = 0; lap < 4; lap++) walk(notes, square, 4.3, tracker);
    expect(notes.laps).toBeGreaterThanOrEqual(3);
    expect(notes.laps).toBeLessThanOrEqual(4);
    expect(notes.held).toBe(0);
    expect(notes.distance).toBeCloseTo(160, 0);

    const straight = createNotes();
    walk(straight, [[0, 0], [120, 0]]);
    expect(straight.laps).toBe(0);
    expect(straight.held).toBe(0);
  });

  it('does not call pacing up and down a short corridor a lap', () => {
    const notes = createNotes();
    const tracker = createTracker();
    for (let i = 0; i < 10; i++) walk(notes, i % 2 ? [[0, 0], [6, 0]] : [[6, 0], [0, 0]], 4.3, tracker);
    expect(notes.distance).toBeGreaterThan(rules.lapDistance * 2);
    expect(notes.laps).toBe(0);
  });

  it('ignores a jump across the map (the debug tools place the player anywhere)', () => {
    const notes = createNotes();
    const tracker = stand(notes, 2, 0, 0);
    noteMovement(tracker, notes, rules, STEP, 40, 40);
    expect(notes.distance).toBe(0);
  });

  it('adds a round to the run', () => {
    const total = createNotes();
    const a = fought(['carbine', 10, 4, 34]);
    a.held = 12;
    a.longestHold = 12;
    a.laps = 2;
    const b = fought(['carbine', 5, 1, 34], ['melee', 2, 0, 150]);
    b.longestHold = 20;
    addNotes(total, a);
    addNotes(total, b);
    expect(total.seconds).toBe(120);
    expect(total.damage).toEqual({ carbine: 510, melee: 300 });
    expect(total.hits).toBe(17);
    expect(total.weakHits).toBe(5);
    expect(total.laps).toBe(2);
    expect(total.longestHold).toBe(20);
  });
});

describe('what ARGUS makes of it', () => {
  it('notices a player who leans on one weapon, and names the weapon', () => {
    const found = readNotes(fought(['carbine', 30, 0, 34], ['shotgun', 3, 0, 100]), rules);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ counter: 'shielding', weapon: 'carbine', figure: 77 });
  });

  it('does not when the damage is shared out', () => {
    expect(readNotes(fought(['carbine', 15, 0, 34], ['shotgun', 5, 0, 100]), rules)).toEqual([]);
  });

  it('notices a player who holds one spot', () => {
    const notes = createNotes();
    stand(notes, 40);
    walk(notes, [[0, 0], [60, 0]]);
    const found = readNotes(notes, rules);
    expect(found.map((f) => f.counter)).toEqual(['flush']);
    expect(found[0]!.figure).toBeGreaterThan(60);
  });

  it('notices a player who runs the horde in circles', () => {
    const notes = createNotes();
    const tracker = createTracker();
    for (let lap = 0; lap < 5; lap++) walk(notes, [[0, 0], [12, 0], [12, 12], [0, 12], [0, 0]], 4.3, tracker);
    const found = readNotes(notes, rules);
    expect(found.map((f) => f.counter)).toEqual(['intercept']);
    expect(found[0]!.figure).toBe(notes.laps);
  });

  it('notices a player who lands many weak-point hits', () => {
    const found = readNotes(fought(['carbine', 12, 8, 34], ['shotgun', 8, 4, 60]), rules);
    expect(found.map((f) => f.counter)).toEqual(['guard']);
    expect(found[0]!.figure).toBe(60);
  });

  it('does not judge a round with too little to go on', () => {
    // Three shots, all from one gun, all on the weak point: not a habit yet.
    const notes = fought(['pistol', 3, 3, 28]);
    notes.seconds = 5;
    notes.held = 5;
    expect(readNotes(notes, rules)).toEqual([]);
  });

  it('puts the strongest evidence first', () => {
    // Everything from one gun (far past its bar), and weak-point hits only just past theirs.
    const notes = fought(['carbine', 40, 17, 34]);
    const found = readNotes(notes, rules);
    expect(found.map((f) => f.counter)).toEqual(['shielding', 'guard']);
    expect(found[0]!.weight).toBeGreaterThan(found[1]!.weight);
  });
});

describe("ARGUS's analysis", () => {
  const leaning = (): Notes => fought(['carbine', 30, 0, 34], ['shotgun', 3, 0, 100]);

  it('only watches before the round it starts adapting for', () => {
    const state = createArgus();
    expect(analyse(state, leaning(), rules, rules.fromRound - 1, names)).toBeNull();
    expect(state.active).toEqual([]);
    expect(state.history).toEqual([]);
    // (It has still been taking notes.)
    expect(state.totals.hits).toBe(33);
  });

  it('says what it saw and what it is doing about it, in one sentence each', () => {
    const state = createArgus();
    const analysis = analyse(state, leaning(), rules, 3, names)!;
    expect(analysis.round).toBe(3);
    expect(analysis.adaptations).toEqual([{ counter: 'shielding', weapon: 'carbine' }]);
    expect(analysis.lines).toEqual([{ observed: '77% of damage from the carbine.', adapting: 'Adapting: carbine-resistant plating.' }]);
    expect(state.active).toEqual(analysis.adaptations);
  });

  it('never has more counters in force than the config allows', () => {
    const notes = fought(['carbine', 40, 30, 34]);
    notes.held = 50;
    notes.laps = 9;
    const analysis = analyse(createArgus(), notes, rules, 5, names)!;
    expect(readNotes(notes, rules).length).toBe(4);
    expect(analysis.adaptations).toHaveLength(rules.maxCounters);
    expect(analysis.lines).toHaveLength(rules.maxCounters);
  });

  it('keeps a counter up while the habit goes on, and says so', () => {
    const state = createArgus();
    analyse(state, leaning(), rules, 3, names);
    const again = analyse(state, leaning(), rules, 4, names)!;
    expect(again.lines[0]!.adapting).toBe('Maintaining: carbine-resistant plating.');
    expect(again.withdrawn).toEqual([]);
  });

  it('can be beaten by changing how the player plays: the counter is withdrawn, and it says so', () => {
    const state = createArgus();
    analyse(state, leaning(), rules, 3, names);
    // The next round, the damage is shared between two guns.
    const after = analyse(state, fought(['carbine', 15, 0, 34], ['shotgun', 5, 0, 100]), rules, 4, names)!;
    expect(after.adaptations).toEqual([]);
    expect(after.withdrawn).toEqual([{ counter: 'shielding', weapon: 'carbine' }]);
    expect(after.lines).toEqual([{ observed: 'You changed your approach.', adapting: 'Withdrawing: carbine-resistant plating.' }]);
    expect(state.active).toEqual([]);
  });

  it('follows the player from one weapon to another', () => {
    const state = createArgus();
    analyse(state, leaning(), rules, 3, names);
    const after = analyse(state, fought(['shotgun', 12, 0, 100]), rules, 4, names)!;
    expect(after.adaptations).toEqual([{ counter: 'shielding', weapon: 'shotgun' }]);
    expect(after.withdrawn).toEqual([{ counter: 'shielding', weapon: 'carbine' }]);
    expect(after.lines.map((line) => line.adapting)).toEqual(['Adapting: breacher-resistant plating.', 'Withdrawing: carbine-resistant plating.']);
  });

  it('has something to say when it finds nothing', () => {
    const analysis = analyse(createArgus(), fought(['carbine', 15, 0, 34], ['shotgun', 5, 0, 100]), rules, 3, names)!;
    expect(analysis.adaptations).toEqual([]);
    expect(analysis.lines).toEqual([{ observed: 'No dominant pattern.', adapting: 'Adapting: nothing. Yet.' }]);
  });

  it('words every counter', () => {
    expect(adaptationName({ counter: 'shielding', weapon: 'pistol' }, names)).toBe('sidearm-resistant plating');
    expect(adaptationName({ counter: 'shielding', weapon: 'melee' }, names)).toBe('strike-resistant plating');
    expect(adaptationName({ counter: 'flush' }, names)).toBe('bombers, and a breach behind you');
    expect(adaptationName({ counter: 'intercept' }, names)).toBe('interceptors across your route');
    expect(adaptationName({ counter: 'guard' }, names)).toBe('armoured weak points');
  });

  it('remembers every counter it used, and in which rounds, for the report', () => {
    const state = createArgus();
    analyse(state, leaning(), rules, 3, names);
    analyse(state, leaning(), rules, 4, names);
    analyse(state, fought(['carbine', 12, 8, 34], ['shotgun', 8, 4, 60]), rules, 5, names);
    expect(adaptationsUsed(state)).toEqual([
      { adaptation: { counter: 'shielding', weapon: 'carbine' }, rounds: [3, 4] },
      { adaptation: { counter: 'guard' }, rounds: [5] },
    ]);
  });
});

describe("ARGUS's remarks", () => {
  it('are short', () => {
    for (const lines of Object.values(REMARKS)) for (const line of lines) expect(line.length).toBeLessThanOrEqual(60);
  });

  it('are spaced out: nothing more is said until the gap has passed', () => {
    const state = createArgus();
    expect(remark(state, rules, 'firstKill', 10)).toBe(REMARKS.firstKill[0]);
    expect(remark(state, rules, 'powerRestored', 10 + rules.remarkGap - 1)).toBeNull();
    expect(remark(state, rules, 'powerRestored', 10 + rules.remarkGap)).toBe(REMARKS.powerRestored[0]);
  });

  it('never repeat a line, and run out', () => {
    const state = createArgus();
    const said: Array<string | null> = [];
    for (let i = 0; i < 4; i++) said.push(remark(state, rules, 'holding', i * 100));
    expect(said).toEqual([REMARKS.holding[0], REMARKS.holding[1], null, null]);
  });
});

describe("ARGUS's profile of the player", () => {
  const run = (change: (notes: Notes) => void): Notes => {
    const notes = fought(['carbine', 60, 6, 34], ['shotgun', 20, 2, 80], ['pistol', 30, 3, 28]);
    notes.seconds = 600;
    notes.distance = 1500;
    change(notes);
    return notes;
  };

  it('calls a player with no strong habit an improviser', () => {
    expect(profile(run(() => {}), rules).label).toBe('THE IMPROVISER');
  });

  it('names the habit that stands out most', () => {
    expect(profile(run((n) => (n.weakHits = 70)), rules).style).toBe('marksman');
    expect(profile(run((n) => (n.held = 400)), rules).style).toBe('fortress');
    expect(profile(run((n) => (n.laps = 40)), rules).style).toBe('runner');
    expect(profile(run((n) => (n.damage = { carbine: 9000, pistol: 500 })), rules).style).toBe('specialist');
    expect(profile(run((n) => (n.damage = { melee: 3000, pistol: 4000 })), rules).style).toBe('brawler');
  });

  it('has a label and a verdict for every style', () => {
    for (const notes of [run(() => {}), run((n) => (n.weakHits = 70)), run((n) => (n.held = 400))]) {
      const result = profile(notes, rules);
      expect(result.label).toMatch(/^THE [A-Z]+$/);
      expect(result.verdict.length).toBeGreaterThan(10);
    }
  });

  it('makes do with a run too short to judge', () => {
    expect(profile(createNotes(), rules).style).toBe('improviser');
  });
});
