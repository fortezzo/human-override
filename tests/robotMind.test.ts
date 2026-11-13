import { describe, expect, it } from 'vitest';
import { createRobotMind, damageForZone, damageRobot, moveFactor, thinkRobot, type RobotSpec } from '../src/sim/robotMind';

const spec: RobotSpec = {
  health: 100,
  attackRange: 1.5,
  attackDamage: 30,
  attackHitTime: 0.4,
  attackDuration: 1.0,
  attackCooldown: 0.5,
  staggerDamage: 60,
  staggerTime: 0.75,
  flinchTime: 0.2,
};

/** Run the mind for `seconds` in small steps, collecting what happened. */
function run(mind: ReturnType<typeof createRobotMind>, seconds: number, distance: number, alive = true) {
  let attacks = 0;
  let damage = 0;
  for (let t = 0; t < seconds; t += 1 / 60) {
    const e = thinkRobot(mind, spec, 1 / 60, distance, alive);
    if (e.attackStarted) attacks++;
    damage += e.hit;
  }
  return { attacks, damage };
}

describe('robot behaviour', () => {
  it('chases while the target is out of reach', () => {
    const mind = createRobotMind(spec);
    const result = run(mind, 3, 8);
    expect(mind.state).toBe('chase');
    expect(result.attacks).toBe(0);
    expect(moveFactor(mind)).toBe(1);
  });

  it('attacks when in range and lands the blow part-way through the swing', () => {
    const mind = createRobotMind(spec);
    const first = thinkRobot(mind, spec, 1 / 60, 1.2, true);
    expect(first.attackStarted).toBe(true);
    expect(mind.state).toBe('attack');
    expect(moveFactor(mind)).toBe(0);
    expect(run(mind, 0.3, 1.2).damage).toBe(0); // still winding up
    expect(run(mind, 0.2, 1.2).damage).toBe(30); // connects once
    expect(run(mind, 0.4, 1.2).damage).toBe(0); // and only once
  });

  it('misses if the target backs away during the wind-up', () => {
    const mind = createRobotMind(spec);
    thinkRobot(mind, spec, 1 / 60, 1.2, true);
    expect(run(mind, 1.2, 4).damage).toBe(0);
    expect(mind.state).toBe('chase');
  });

  it('waits out a cooldown between attacks', () => {
    const mind = createRobotMind(spec);
    // 1.0 s swing + 0.5 s cooldown = one attack every 1.5 s.
    const result = run(mind, 6, 1.0);
    expect(result.attacks).toBe(4);
    expect(result.damage).toBe(120);
  });

  it('does not attack a target that is already down', () => {
    const mind = createRobotMind(spec);
    expect(run(mind, 3, 1.0, false).attacks).toBe(0);
  });

  it('flinches from light hits without losing its place', () => {
    const mind = createRobotMind(spec);
    const result = damageRobot(mind, spec, 20);
    expect(result).toEqual({ killed: false, staggered: false, flinched: true });
    expect(mind.state).toBe('chase');
    expect(moveFactor(mind)).toBeLessThan(1);
    run(mind, 0.3, 8);
    expect(moveFactor(mind)).toBe(1);
  });

  it('staggers from a heavy hit, then recovers', () => {
    const mind = createRobotMind(spec);
    thinkRobot(mind, spec, 1 / 60, 1.0, true); // mid-attack
    const result = damageRobot(mind, spec, 70);
    expect(result.staggered).toBe(true);
    expect(mind.state).toBe('stagger');
    expect(run(mind, 0.5, 1.0).damage).toBe(0); // the interrupted swing never lands
    run(mind, 0.4, 8);
    expect(mind.state).toBe('chase');
  });

  it('dies when health runs out and stays dead', () => {
    const mind = createRobotMind(spec);
    damageRobot(mind, spec, 50);
    const result = damageRobot(mind, spec, 55);
    expect(result.killed).toBe(true);
    expect(mind.health).toBe(0);
    expect(mind.state).toBe('dead');
    expect(damageRobot(mind, spec, 10).killed).toBe(false);
    expect(run(mind, 2, 1.0).attacks).toBe(0);
  });

  it('scales damage by where the shot lands', () => {
    const gun = { damage: 30, weakPointMultiplier: 2.5, limbMultiplier: 0.8 };
    expect(damageForZone(gun, 'torso')).toBe(30);
    expect(damageForZone(gun, 'head')).toBe(75);
    expect(damageForZone(gun, 'limb')).toBe(24);
  });
});
