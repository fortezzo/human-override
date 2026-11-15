import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/config';
import { accelerate, applyFriction, groundStep, type Velocity } from '../src/sim/movement';

const RULES = { friction: PLAYER.groundFriction, accel: PLAYER.groundAccel };

/** Hold "forward" for a while at a given frame rate and report the speed reached. */
function run(seconds: number, maxSpeed: number, fps: number, v: Velocity = { x: 0, z: 0 }): number {
  const dt = 1 / fps;
  for (let t = 0; t < seconds; t += dt) groundStep(v, 0, -1, maxSpeed, RULES, dt);
  return Math.hypot(v.x, v.z);
}

describe('player movement', () => {
  it('reaches walking speed, and sprinting really is faster', () => {
    // This is the test that would have caught sprinting doing nothing: with
    // one fixed push for every target speed, both of these came out at 4.2.
    expect(run(1, PLAYER.walkSpeed, 60)).toBeCloseTo(PLAYER.walkSpeed, 1);
    expect(run(1, PLAYER.sprintSpeed, 60)).toBeCloseTo(PLAYER.sprintSpeed, 1);
    expect(PLAYER.sprintSpeed).toBeGreaterThan(PLAYER.walkSpeed * 1.3);
  });

  it('has a push stronger than friction, or the top speed could never be reached', () => {
    expect(PLAYER.groundAccel).toBeGreaterThan(PLAYER.groundFriction);
  });

  it('moves the same at 30, 60, 144 and 240 frames a second', () => {
    for (const fps of [30, 60, 144, 240]) {
      expect(run(1, PLAYER.walkSpeed, fps)).toBeCloseTo(PLAYER.walkSpeed, 1);
      expect(run(1, PLAYER.sprintSpeed, fps)).toBeCloseTo(PLAYER.sprintSpeed, 1);
    }
    // Getting up to speed takes about as long whatever the frame rate.
    const at = (fps: number) => run(0.1, PLAYER.walkSpeed, fps);
    expect(Math.abs(at(30) - at(240))).toBeLessThan(0.45);
  });

  it('is up to speed within a quarter of a second, and stopped within half a second', () => {
    expect(run(0.25, PLAYER.walkSpeed, 60)).toBeGreaterThan(PLAYER.walkSpeed * 0.95);
    const v = { x: 0, z: -PLAYER.sprintSpeed };
    for (let t = 0; t < 0.5; t += 1 / 60) groundStep(v, 0, 0, PLAYER.walkSpeed, RULES, 1 / 60);
    expect(Math.hypot(v.x, v.z)).toBeLessThan(0.1);
  });

  it('never exceeds the target speed, straight or diagonal', () => {
    const diagonal = Math.SQRT1_2;
    const v = { x: 0, z: 0 };
    for (let i = 0; i < 120; i++) {
      groundStep(v, diagonal, -diagonal, PLAYER.walkSpeed, RULES, 1 / 60);
      expect(Math.hypot(v.x, v.z)).toBeLessThanOrEqual(PLAYER.walkSpeed + 1e-9);
    }
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(PLAYER.walkSpeed, 1);
  });

  it('slows to walking pace when the sprint key is let go, without a jolt', () => {
    const v = { x: 0, z: -PLAYER.sprintSpeed };
    let last = PLAYER.sprintSpeed;
    for (let i = 0; i < 60; i++) {
      groundStep(v, 0, -1, PLAYER.walkSpeed, RULES, 1 / 60);
      const speed = Math.hypot(v.x, v.z);
      // Each frame gives up a little speed, never a large chunk at once.
      expect(last - speed).toBeLessThan(1.3);
      expect(speed).toBeLessThanOrEqual(last + 1e-9);
      last = speed;
    }
    expect(last).toBeCloseTo(PLAYER.walkSpeed, 1);
  });

  it('turns without losing the speed already built up along the new direction', () => {
    const v = { x: 0, z: -PLAYER.walkSpeed };
    // Swing the wished direction a quarter turn: speed along the old one
    // bleeds away through friction, the new one builds up.
    for (let i = 0; i < 60; i++) groundStep(v, 1, 0, PLAYER.walkSpeed, RULES, 1 / 60);
    expect(v.x).toBeCloseTo(PLAYER.walkSpeed, 1);
    expect(Math.abs(v.z)).toBeLessThan(0.05);
  });

  it('leaves a standing player standing, and steers gently in mid-air', () => {
    const still = { x: 0, z: 0 };
    applyFriction(still, PLAYER.groundFriction, 1 / 60);
    groundStep(still, 0, 0, PLAYER.walkSpeed, RULES, 1 / 60);
    expect(still).toEqual({ x: 0, z: 0 });

    const jumping = { x: 0, z: 0 };
    for (let i = 0; i < 30; i++) accelerate(jumping, 1, 0, PLAYER.walkSpeed, PLAYER.airAccel, 1 / 60);
    // Half a second of steering in the air adds some sideways speed, but well short of a full stride.
    expect(jumping.x).toBeGreaterThan(1);
    expect(jumping.x).toBeLessThanOrEqual(PLAYER.walkSpeed);
  });
});
