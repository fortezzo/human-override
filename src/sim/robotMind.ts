// What a melee robot decides to do, moment to moment.
//
// This is a small state machine with no rendering in it: it only knows how
// far away its target is and how much time has passed. The 3D robot asks it
// what to do and plays the matching animation, which keeps the behaviour
// rules easy to read and unit-test.

export type RobotState = 'chase' | 'attack' | 'stagger' | 'dead';

/** Which part of the robot a shot landed on. */
export type HitZone = 'head' | 'torso' | 'limb';

export interface RobotSpec {
  health: number;
  attackRange: number;
  attackDamage: number;
  /** Seconds into the swing when the blow lands, and the swing's length. */
  attackHitTime: number;
  attackDuration: number;
  attackCooldown: number;
  /** Damage in one hit that knocks the robot off balance. */
  staggerDamage: number;
  staggerTime: number;
  flinchTime: number;
}

export interface RobotMind {
  state: RobotState;
  health: number;
  /** Seconds spent in the current state. */
  timer: number;
  /** Seconds before another attack may start. */
  cooldown: number;
  /** The current swing has already dealt (or missed) its blow. */
  swung: boolean;
  /** Seconds of flinch remaining (a brief slow-down that does not interrupt). */
  flinch: number;
}

export interface RobotEvents {
  /** An attack swing started this update. */
  attackStarted: boolean;
  /** The swing connected this update: apply this much damage to the target. */
  hit: number;
}

export function createRobotMind(spec: RobotSpec): RobotMind {
  return { state: 'chase', health: spec.health, timer: 0, cooldown: 0, swung: false, flinch: 0 };
}

/** Advance the robot's decisions by `dt` seconds. */
export function thinkRobot(mind: RobotMind, spec: RobotSpec, dt: number, distanceToTarget: number, targetAlive: boolean): RobotEvents {
  const events: RobotEvents = { attackStarted: false, hit: 0 };
  if (mind.state === 'dead') return events;

  mind.timer += dt;
  mind.cooldown = Math.max(0, mind.cooldown - dt);
  mind.flinch = Math.max(0, mind.flinch - dt);

  switch (mind.state) {
    case 'chase':
      if (targetAlive && distanceToTarget <= spec.attackRange && mind.cooldown <= 0) {
        mind.state = 'attack';
        mind.timer = 0;
        mind.swung = false;
        events.attackStarted = true;
      }
      break;

    case 'attack':
      if (!mind.swung && mind.timer >= spec.attackHitTime) {
        mind.swung = true;
        // The blow only lands if the target is still within reach, so a
        // player who backs away in time is not hit.
        if (targetAlive && distanceToTarget <= spec.attackRange * 1.2) events.hit = spec.attackDamage;
      }
      if (mind.timer >= spec.attackDuration) {
        mind.state = 'chase';
        mind.timer = 0;
        mind.cooldown = spec.attackCooldown;
      }
      break;

    case 'stagger':
      if (mind.timer >= spec.staggerTime) {
        mind.state = 'chase';
        mind.timer = 0;
      }
      break;
  }
  return events;
}

export interface DamageResult {
  killed: boolean;
  staggered: boolean;
  flinched: boolean;
}

/** Apply damage. A hard enough hit interrupts whatever the robot was doing. */
export function damageRobot(mind: RobotMind, spec: RobotSpec, amount: number): DamageResult {
  const result: DamageResult = { killed: false, staggered: false, flinched: false };
  if (mind.state === 'dead' || amount <= 0) return result;

  mind.health -= amount;
  if (mind.health <= 0) {
    mind.health = 0;
    mind.state = 'dead';
    mind.timer = 0;
    result.killed = true;
    return result;
  }
  if (amount >= spec.staggerDamage) {
    mind.state = 'stagger';
    mind.timer = 0;
    result.staggered = true;
  } else {
    mind.flinch = spec.flinchTime;
    result.flinched = true;
  }
  return result;
}

/** How fast the robot may move right now, as a fraction of its full speed. */
export function moveFactor(mind: RobotMind): number {
  if (mind.state !== 'chase') return 0;
  return mind.flinch > 0 ? 0.35 : 1;
}

export interface DamageSpec {
  damage: number;
  weakPointMultiplier: number;
  limbMultiplier: number;
}

/** Damage for a shot landing on a given body part. The head is the weak point. */
export function damageForZone(spec: DamageSpec, zone: HitZone): number {
  if (zone === 'head') return spec.damage * spec.weakPointMultiplier;
  if (zone === 'limb') return spec.damage * spec.limbMultiplier;
  return spec.damage;
}
