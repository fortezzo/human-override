import { describe, expect, it } from 'vitest';
import { PLAYER, ROUNDS, STAMINA } from '../src/config';
import { planRound } from '../src/sim/rounds';
import { createStamina, updateStamina } from '../src/sim/stamina';

const DT = 1 / 60;

/** Hold (or let go of) the sprint key for a while. Returns the seconds actually spent sprinting. */
function hold(stamina: ReturnType<typeof createStamina>, seconds: number, wantSprint: boolean): number {
  let sprinted = 0;
  for (let t = 0; t < seconds - 1e-9; t += DT) if (updateStamina(stamina, STAMINA, wantSprint, DT)) sprinted += DT;
  return sprinted;
}

describe('stamina', () => {
  it('pays for a few seconds of sprinting, then runs dry', () => {
    const stamina = createStamina();
    const sprinted = hold(stamina, STAMINA.sprintSeconds + 0.5, true);
    expect(sprinted).toBeGreaterThan(STAMINA.sprintSeconds - 0.1);
    expect(sprinted).toBeLessThan(STAMINA.sprintSeconds + 0.1);
    expect(stamina.level).toBe(0);
    expect(stamina.winded).toBe(true);
  });

  it('does not let a held key sprint most of the time', () => {
    // Keep the key down for a minute: the legs come back in short bursts,
    // but most of that minute is spent walking.
    const stamina = createStamina();
    const sprinted = hold(stamina, 60, true);
    expect(sprinted).toBeLessThan(60 * 0.45);
    expect(sprinted).toBeGreaterThan(STAMINA.sprintSeconds);
  });

  it('leaves the player winded: sprinting does not come back the instant a sliver of the bar does', () => {
    const stamina = createStamina();
    hold(stamina, STAMINA.sprintSeconds + 0.5, true);
    expect(stamina.winded).toBe(true);
    // Let go, wait out the pause and a little of the refill: still winded.
    hold(stamina, STAMINA.recoverDelay + STAMINA.recoverSeconds * STAMINA.restartAt * 0.5, false);
    expect(stamina.winded).toBe(true);
    expect(updateStamina(stamina, STAMINA, true, DT)).toBe(false);
    // A little longer, and the legs are back.
    hold(stamina, STAMINA.recoverSeconds * STAMINA.restartAt * 0.7, false);
    expect(updateStamina(stamina, STAMINA, true, DT)).toBe(true);
  });

  it('refills only after a pause, and completely given long enough', () => {
    const stamina = createStamina();
    hold(stamina, 2, true);
    const after = stamina.level;
    hold(stamina, STAMINA.recoverDelay * 0.8, false);
    expect(stamina.level).toBeCloseTo(after, 5);
    hold(stamina, STAMINA.recoverDelay + STAMINA.recoverSeconds + 0.5, false);
    expect(stamina.level).toBe(1);
  });

  it('cannot be feathered: tapping the key does not beat holding it', () => {
    // Sprint in half-second bursts with half-second gaps for a minute.
    const tapped = createStamina();
    let burst = 0;
    for (let t = 0; t < 60; t += 1) {
      burst += hold(tapped, 0.5, true);
      hold(tapped, 0.5, false);
    }
    // Sprint until dry, rest until full, repeat, for the same minute.
    const held = createStamina();
    let steady = 0;
    for (let t = 0; t < 60; ) {
      const run = STAMINA.sprintSeconds;
      const rest = STAMINA.recoverDelay + STAMINA.recoverSeconds;
      steady += hold(held, Math.min(run, 60 - t), true);
      t += run;
      if (t >= 60) break;
      hold(held, Math.min(rest, 60 - t), false);
      t += rest;
    }
    expect(burst).toBeLessThanOrEqual(steady + 0.6);
  });

  it('is the same at any frame rate', () => {
    const at = (fps: number) => {
      const stamina = createStamina();
      const dt = 1 / fps;
      for (let t = 0; t < 2.5; t += dt) updateStamina(stamina, STAMINA, true, dt);
      return stamina.level;
    };
    expect(Math.abs(at(30) - at(240))).toBeLessThan(0.03);
  });
});

describe('running buys time, not safety', () => {
  it('lets the player out-sprint any robot, but only just in the late rounds', () => {
    for (let round = 1; round <= 30; round++) {
      const plan = planRound(ROUNDS, round);
      expect(plan.runSpeed).toBeLessThan(PLAYER.sprintSpeed);
      expect(plan.walkSpeed).toBeLessThan(PLAYER.walkSpeed);
    }
    const late = planRound(ROUNDS, 14);
    expect(late.runSpeed).toBeGreaterThan(PLAYER.sprintSpeed * 0.9);
  });

  it('means a walking player is caught by the runners of the middle rounds', () => {
    // From here on, walking away is not enough: the player must sprint,
    // and the bar does not last.
    const firstFasterThanWalking = Array.from({ length: 30 }, (_, i) => planRound(ROUNDS, i + 1)).find((plan) => plan.runShare > 0 && plan.runSpeed > PLAYER.walkSpeed);
    expect(firstFasterThanWalking).toBeDefined();
    expect(firstFasterThanWalking!.round).toBeGreaterThanOrEqual(5);
    expect(firstFasterThanWalking!.round).toBeLessThanOrEqual(8);
  });

  it('cannot be escaped by sprinting alone: over a long chase a late runner covers more ground', () => {
    const cycle = STAMINA.sprintSeconds + STAMINA.recoverDelay + STAMINA.recoverSeconds;
    const playerPerCycle = STAMINA.sprintSeconds * PLAYER.sprintSpeed + (cycle - STAMINA.sprintSeconds) * PLAYER.walkSpeed;
    const robotPerCycle = cycle * planRound(ROUNDS, 14).runSpeed;
    expect(robotPerCycle).toBeGreaterThan(playerPerCycle);
  });
});
