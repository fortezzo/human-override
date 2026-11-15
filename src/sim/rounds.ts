// Rounds: how many robots each one sends, how tough and fast they are, and
// the rhythm of a round (arrivals, the last robot, the lull, the next one).
// Pure logic with no rendering, so it can be unit-tested.

export interface RoundRules {
  firstDelay: number;
  lull: number;
  counts: readonly number[];
  countGrowth: number;
  maxActive: number;
  spawnInterval: number;
  spawnQuicken: number;
  spawnIntervalMin: number;
  health: number;
  healthStep: number;
  healthStepRounds: number;
  healthGrowth: number;
  walkSpeed: number;
  walkSpeedStep: number;
  walkSpeedMax: number;
  runFrom: number;
  runShareStep: number;
  runShareMax: number;
  runSpeed: number;
  runSpeedStep: number;
  runSpeedMax: number;
}

/** What one round consists of. */
export interface RoundPlan {
  round: number;
  /** Robots sent in over the whole round. */
  count: number;
  health: number;
  walkSpeed: number;
  runSpeed: number;
  /** Fraction of this round's robots that run instead of walk (0..1). */
  runShare: number;
  /** Seconds between arrivals. */
  spawnInterval: number;
}

export function planRound(rules: RoundRules, round: number): RoundPlan {
  const n = Math.max(1, Math.floor(round));
  const listed = rules.counts.length;
  const count = n <= listed ? rules.counts[n - 1]! : rules.counts[listed - 1]! + (n - listed) * rules.countGrowth;

  // Health climbs by a fixed step at first, then by a percentage each round.
  const steps = Math.min(n, rules.healthStepRounds) - 1;
  let health = rules.health + rules.healthStep * steps;
  if (n > rules.healthStepRounds) health *= Math.pow(rules.healthGrowth, n - rules.healthStepRounds);

  return {
    round: n,
    count,
    health: Math.round(health),
    walkSpeed: Math.min(rules.walkSpeedMax, rules.walkSpeed + rules.walkSpeedStep * (n - 1)),
    runSpeed: Math.min(rules.runSpeedMax, rules.runSpeed + rules.runSpeedStep * Math.max(0, n - rules.runFrom)),
    runShare: n < rules.runFrom ? 0 : Math.min(rules.runShareMax, rules.runShareStep * (n - rules.runFrom + 1)),
    spawnInterval: Math.max(rules.spawnIntervalMin, rules.spawnInterval - rules.spawnQuicken * (n - 1)),
  };
}

/** How fast one particular robot of this round moves. `roll` is a random number 0..1. */
export function speedFor(plan: RoundPlan, roll: number): number {
  return roll < plan.runShare ? plan.runSpeed : plan.walkSpeed;
}

export interface RoundState {
  /** 0 before the first round has started. */
  round: number;
  phase: 'waiting' | 'active';
  /** While waiting: seconds until the next round starts. */
  timer: number;
  plan: RoundPlan;
  /** Robots sent in so far this round, and how many of them are destroyed. */
  spawned: number;
  destroyed: number;
  /** Seconds until the next arrival. */
  spawnTimer: number;
}

export function createRounds(rules: RoundRules): RoundState {
  return { round: 0, phase: 'waiting', timer: rules.firstDelay, plan: planRound(rules, 1), spawned: 0, destroyed: 0, spawnTimer: 0 };
}

export interface RoundTick {
  /** A round started on this update (its number), or null. */
  started: number | null;
  /** A round was cleared on this update (its number), or null. */
  cleared: number | null;
  /** How many robots to send in right now. */
  spawn: number;
}

/**
 * Advance the round by `dt` seconds. `active` is how many robots are on the
 * map right now; arrivals pause while the map is full.
 */
export function updateRounds(state: RoundState, rules: RoundRules, dt: number, active: number): RoundTick {
  const tick: RoundTick = { started: null, cleared: null, spawn: 0 };

  if (state.phase === 'waiting') {
    state.timer -= dt;
    if (state.timer > 0) return tick;
    state.round += 1;
    state.plan = planRound(rules, state.round);
    state.phase = 'active';
    state.spawned = 0;
    state.destroyed = 0;
    state.spawnTimer = 0;
    tick.started = state.round;
    return tick;
  }

  if (state.spawned < state.plan.count) {
    state.spawnTimer -= dt;
    while (state.spawnTimer <= 0 && state.spawned < state.plan.count && active + tick.spawn < rules.maxActive) {
      tick.spawn += 1;
      state.spawned += 1;
      state.spawnTimer += state.plan.spawnInterval;
    }
    // While the map is full the timer waits at zero, so the queue does not
    // pour in all at once when a space opens.
    if (state.spawnTimer < 0) state.spawnTimer = 0;
  } else if (state.destroyed >= state.plan.count) {
    tick.cleared = state.round;
    state.phase = 'waiting';
    state.timer = rules.lull;
  }
  return tick;
}

/** Call when a robot of the current round is destroyed. */
export function robotDestroyed(state: RoundState): void {
  if (state.phase === 'active' && state.destroyed < state.spawned) state.destroyed += 1;
}

/**
 * Call when a robot is taken off the map without being destroyed (one that
 * got stuck, say). It goes back in the queue and arrives again.
 */
export function robotRecalled(state: RoundState): void {
  if (state.phase === 'active' && state.spawned > state.destroyed) state.spawned -= 1;
}

/** Robots still to be destroyed this round (on the map or yet to arrive). */
export function remaining(state: RoundState): number {
  return state.phase === 'active' ? state.plan.count - state.destroyed : 0;
}

/**
 * Debug: end the current round at once. The caller removes the robots on
 * the map; the next update reports the round as cleared.
 */
export function skipRound(state: RoundState): void {
  if (state.phase === 'waiting') {
    state.timer = 0;
    return;
  }
  state.spawned = state.plan.count;
  state.destroyed = state.plan.count;
}
