import { describe, expect, it } from 'vitest';
import { COACH } from '../src/config';
import { HINTS, createCoach, updateCoach, type Coach, type CoachSeen } from '../src/sim/coach';

const nothing: CoachSeen = { walked: 0, fired: false, aiming: false, jumped: false, bought: false, canBuy: false, markerDistance: 20, round: 1 };
/** Let time pass, with the player doing `seen` the whole while. */
const pass = (coach: Coach, seconds: number, seen: Partial<CoachSeen> = {}) => {
  const learned = [];
  for (let t = 0; t < seconds; t += 0.05) learned.push(...updateCoach(coach, COACH, { ...nothing, ...seen }, 0.05));
  return learned;
};
/** Wait for the hint on screen to go and the next to arrive. */
const next = (coach: Coach, seen: Partial<CoachSeen> = {}) => pass(coach, COACH.linger + COACH.gap + 0.2, seen);

describe('the first-minute hints', () => {
  it('offers them one at a time, in order, each going once the player has done it', () => {
    const coach = createCoach(COACH);
    expect(coach.showing).toBeNull();
    pass(coach, COACH.gap + 0.1);
    expect(coach.showing).toBe('move');

    // A step is not enough; walking a few metres is.
    updateCoach(coach, COACH, { ...nothing, walked: 0.5 }, 0.05);
    expect(coach.done).toBe(false);
    expect(updateCoach(coach, COACH, { ...nothing, walked: COACH.moveDistance }, 0.05)).toEqual(['move']);
    // It stays a moment, marked as done, then goes; and after a pause the next one comes.
    expect(coach.showing).toBe('move');
    expect(coach.done).toBe(true);
    next(coach);
    expect(coach.showing).toBe('fire');

    updateCoach(coach, COACH, { ...nothing, fired: true }, 0.05);
    next(coach);
    expect(coach.showing).toBe('aim');

    // A flick of the sights is not aiming; holding them up is.
    pass(coach, COACH.aimSeconds * 0.5, { aiming: true });
    pass(coach, 0.1, { aiming: false });
    expect(coach.learned.aim).toBe(false);
    pass(coach, COACH.aimSeconds + 0.1, { aiming: true });
    expect(coach.learned.aim).toBe(true);
    next(coach);
    expect(coach.showing).toBe('jump');

    updateCoach(coach, COACH, { ...nothing, jumped: true }, 0.05);
    next(coach);
    expect(coach.showing).toBe('marker');
  });

  it('never shows a hint for something the player has already done', () => {
    const coach = createCoach(COACH);
    // Firing and jumping straight away, before "move" has even appeared.
    updateCoach(coach, COACH, { ...nothing, fired: true, jumped: true }, 0.05);
    pass(coach, COACH.gap + 0.1);
    expect(coach.showing).toBe('move');
    updateCoach(coach, COACH, { ...nothing, walked: COACH.moveDistance }, 0.05);
    next(coach);
    // Straight to aiming: firing was done long ago.
    expect(coach.showing).toBe('aim');
    pass(coach, COACH.aimSeconds + 0.1, { aiming: true });
    next(coach);
    expect(coach.showing).toBe('marker');
  });

  it('counts the marker as followed once the player is well on the way to it, measured from where the hint found them', () => {
    const coach = createCoach(COACH, ['move', 'fire', 'aim', 'jump']);
    // Already nearer than they started the run: that is not following it yet.
    pass(coach, COACH.gap + 0.1, { markerDistance: 12 });
    expect(coach.showing).toBe('marker');
    pass(coach, 0.2, { markerDistance: 12 - COACH.markerMetres + 1 });
    expect(coach.learned.marker).toBe(false);
    expect(pass(coach, 0.1, { markerDistance: 12 - COACH.markerMetres - 0.1 })).toEqual(['marker']);
  });

  it('holds the buying hint back until there is scrap to buy with, and takes it away again if the scrap goes', () => {
    const coach = createCoach(COACH, ['move', 'fire', 'aim', 'jump', 'marker']);
    pass(coach, 3, { canBuy: false });
    expect(coach.showing).toBeNull();
    pass(coach, 0.2, { canBuy: true });
    expect(coach.showing).toBe('buy');
    pass(coach, 0.2, { canBuy: false });
    expect(coach.showing).toBeNull();
    expect(coach.learned.buy).toBe(false);
    pass(coach, COACH.gap + 0.1, { canBuy: true });
    expect(coach.showing).toBe('buy');
    expect(updateCoach(coach, COACH, { ...nothing, canBuy: true, bought: true }, 0.05)).toEqual(['buy']);
    next(coach);
    expect(coach.showing).toBeNull();
  });

  it('skips the marker hint while there is no marker, without getting stuck on it', () => {
    const coach = createCoach(COACH, ['move', 'fire', 'aim', 'jump']);
    pass(coach, 2, { markerDistance: null, canBuy: true });
    expect(coach.showing).toBe('buy');
  });

  it('says nothing to someone who has learned everything, and nothing new once the early rounds are over', () => {
    const veteran = createCoach(COACH, HINTS);
    pass(veteran, 10);
    expect(veteran.showing).toBeNull();

    const late = createCoach(COACH);
    pass(late, 5, { round: COACH.lastRound + 1 });
    expect(late.showing).toBeNull();
    // And a hint that was up when the rounds moved on is taken down, unlearned.
    const caught = createCoach(COACH);
    pass(caught, COACH.gap + 0.1);
    expect(caught.showing).toBe('move');
    pass(caught, 0.1, { round: COACH.lastRound + 1 });
    expect(caught.showing).toBeNull();
    expect(caught.learned.move).toBe(false);
  });

  it('reports each thing learned exactly once', () => {
    const coach = createCoach(COACH);
    const first = updateCoach(coach, COACH, { ...nothing, fired: true }, 0.05);
    const again = updateCoach(coach, COACH, { ...nothing, fired: true }, 0.05);
    expect(first).toEqual(['fire']);
    expect(again).toEqual([]);
  });
});
