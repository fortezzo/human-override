import { describe, expect, it } from 'vitest';
import { MUSIC } from '../src/config';
import { intensity, musicLevel, type MusicMoment } from '../src/sim/music';

const at = (moment: Partial<MusicMoment>): MusicMoment => ({ fighting: true, progress: 0, active: 0, climax: false, ...moment });

describe('the music bed builds through a round', () => {
  it('is low and muffled in the lull between rounds', () => {
    const level = musicLevel(MUSIC, at({ fighting: false, progress: 1, active: 0 }));
    expect(level.gain).toBe(MUSIC.lull);
    expect(level.tone).toBe(MUSIC.lullTone);
    expect(level.gain).toBeLessThan(0.7);
  });

  it('starts a round a step up from the lull, and rises as the round is fought', () => {
    const start = musicLevel(MUSIC, at({ progress: 0, active: 1 }));
    expect(start.gain).toBeGreaterThan(MUSIC.lull);
    let last = start;
    for (const progress of [0.2, 0.4, 0.6, 0.8, 1]) {
      const level = musicLevel(MUSIC, at({ progress, active: 2 }));
      expect(level.gain).toBeGreaterThan(last.gain);
      expect(level.tone).toBeGreaterThan(last.tone);
      last = level;
    }
  });

  it('never goes above the level the bed was mixed at', () => {
    for (const moment of [at({ progress: 1, active: 24 }), at({ climax: true }), at({ progress: 3, active: 99 })]) {
      const level = musicLevel(MUSIC, moment);
      expect(level.gain).toBeLessThanOrEqual(1);
      expect(level.tone).toBeLessThanOrEqual(1);
    }
    expect(musicLevel(MUSIC, at({ progress: 1 })).gain).toBeCloseTo(1);
  });

  it('is at full height with a crowd on the player, however early in the round, and in the final stand', () => {
    expect(intensity(MUSIC, at({ progress: 0.05, active: MUSIC.crowd }))).toBe(1);
    expect(intensity(MUSIC, at({ progress: 0.05, active: MUSIC.crowd / 2 }))).toBeCloseTo(0.5);
    expect(musicLevel(MUSIC, at({ climax: true })).gain).toBeCloseTo(1);
  });
});
