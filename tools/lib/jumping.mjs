// Trials of the jump, played inside the game's page by the end-to-end test
// and by tools/hop.mjs. Each function here is handed whole to the page (it
// can use nothing from this file but its own arguments).

/**
 * What a jump does and does not get the player over. Runs at a barrier, a
 * drum and a fence from a standstill and with run-ups of several lengths,
 * walking and sprinting; then at seven things that are too tall; then from
 * the top of a crate at the cart beside it.
 */
export function jumpTrials() {
  const ho = window.__HO;
  const game = ho.game;
  ho.autopilot(false);
  ho.restart();
  ho.god(true);
  ho.holdRounds(true);
  ho.clearRobots();
  for (const door of game.world.doors) ho.openDoor(door.plan.id);
  ho.step(1 / 60, 130);
  const p = game.player.position;
  /**
   * Stand at `from`, face `toward`, and go: `lead` frames of running first
   * (none = from a standstill, pressed against whatever is there), then a
   * jump, then keep going. Reports where it ended and what it stood on.
   */
  const run = (from, toward, { lead = 0, sprint = false, frames = 90, jumps = 1, every = 40 } = {}) => {
    const yaw = (Math.atan2(-(toward[0] - from[0]), -(toward[1] - from[1])) * 180) / Math.PI;
    ho.place(from[0], from[1], yaw, 0);
    ho.step(1 / 60, 2);
    ho.press('forward', true);
    if (sprint) ho.press('sprint', true);
    ho.step(1 / 60, lead);
    let stood = 0;
    for (let frame = 0; frame < frames; frame++) {
      if (frame % every === 0 && frame / every < jumps) ho.tap('jump');
      ho.step(1 / 60, 1);
      if (game.player.onGround && p.y > 0.05) stood = Math.max(stood, p.y);
    }
    ho.press('forward', false);
    ho.press('sprint', false);
    ho.step(1 / 60, 30);
    const length = Math.hypot(toward[0] - from[0], toward[1] - from[1]);
    return { x: p.x, y: p.y, z: p.z, went: ((p.x - from[0]) * (toward[0] - from[0]) + (p.z - from[1]) * (toward[1] - from[1])) / length, stood };
  };
  const out = { barrier: [], noJump: null, drum: [], fenceIn: [], fenceOut: null, tall: {}, fromCrate: null, highest: 0 };
  const note = (trial) => {
    out.highest = Math.max(out.highest, trial.stood, game.player.onGround ? trial.y : 0);
    return trial;
  };
  // The concrete barrier in the lobby, 0.82 m high: from the south side, heading north across it.
  for (const lead of [0, 6, 12, 18, 24, 30, 36]) out.barrier.push(note(run([-1.75, -3.35 + 0.7 + lead * 0.07], [-1.75, -6.5], { lead })));
  for (const lead of [0, 10, 20, 30]) out.barrier.push(note(run([-1.75, -3.35 + 0.7 + lead * 0.1], [-1.75, -6.5], { lead, sprint: true })));
  out.noJump = run([-1.75, -1.8], [-1.75, -6.5], { jumps: 0 });
  // A drum against the power room's west wall, 0.93 m: there is nowhere to go but onto it.
  for (const lead of [0, 10, 20]) out.drum.push(note(run([10.2 + 0.7 + lead * 0.07, -1.4], [9.6, -1.4], { lead })));
  // The fence round the lab's assembly cell, 1.0 m: in over its north side, and out again.
  for (const lead of [0, 6, 12, 18, 24, 30]) out.fenceIn.push(note(run([15.8, 19.2 - 0.45 - lead * 0.07], [15.8, 21.0], { lead, frames: 70 })));
  for (const lead of [0, 12, 24]) out.fenceIn.push(note(run([15.8, 19.2 - 0.45 - lead * 0.1], [15.8, 21.0], { lead, sprint: true, frames: 70 })));
  out.fenceOut = note(run([15.8, 19.2 + 0.45], [15.8, 17.0], { frames: 70 }));
  // Too tall: three jumps at each, from a standstill and from three run-ups.
  const tall = {
    'a server rack': [[1.4, 9.5], [3.2, 9.5]],
    'a wall cabinet': [[7.6, -2.2], [8.9, -2.95]],
    "the control post by the lab's cell": [[12.2, 23.55], [13.1, 23.55]],
    'a shipping container': [[-17.9, 10.4], [-16.0, 10.4]],
    'the truck': [[-23.5, 14.1], [-27, 14.1]],
    'the uplink console': [[5.6, 23.3], [5.6, 25.2]],
    'the Overclock Bench': [[21.2, 18.8], [22.8, 18.8]],
    'the stacked drums in the lobby corner': [[-7.4, -4.9], [-8.6, -6.6]],
  };
  for (const [name, [from, toward]] of Object.entries(tall)) {
    let stood = 0;
    for (const lead of [0, 8, 16, 24]) {
      const length = Math.hypot(toward[0] - from[0], toward[1] - from[1]);
      const start = [from[0] - ((toward[0] - from[0]) / length) * lead * 0.07, from[1] - ((toward[1] - from[1]) / length) * lead * 0.07];
      stood = Math.max(stood, note(run(start, toward, { lead, jumps: 3, every: 35, frames: 120 })).stood);
    }
    out.tall[name] = stood;
  }
  // From the top of the stacked crates by the dock's east wall (0.92 m), jumping at the cart beside them (1.38 m).
  ho.place(-12.07, 23.1, 180, 0, 0.92);
  ho.step(1 / 60, 10);
  const startedAt = p.y;
  ho.press('forward', true);
  let high = 0;
  for (let frame = 0; frame < 200; frame++) {
    if (frame % 30 === 0) ho.tap('jump');
    ho.step(1 / 60, 1);
    if (game.player.onGround) high = Math.max(high, p.y);
  }
  ho.press('forward', false);
  ho.step(1 / 60, 40);
  out.fromCrate = { startedAt, high };
  out.highest = Math.max(out.highest, high, startedAt);
  out.climb = ho.economy().rules.climb;
  return out;
}

/**
 * One try at dodging the horde by hopping: a player who never fires and
 * does nothing but stand beside something low until the robots are nearly
 * on them, jump it, and wait on the far side to do it again (`policy`
 * 'hop'), or who just stands there ('stand'). Timed from the first robot
 * coming near until the player goes down, or `cap` seconds have passed.
 */
export function hopTrial({ place, policy, round, cap }) {
  const ho = window.__HO;
  const game = ho.game;
  ho.autopilot(false);
  ho.restart();
  ho.god(true);
  ho.holdRounds(false);
  for (let i = 0; i < 9000 && game.stats.round < round; i++) {
    ho.simulate(1 / 60, 20);
    if (game.director.rounds.phase === 'active' && game.stats.round < round) {
      ho.clearRobots();
      ho.skipRound();
    }
  }
  for (const door of game.world.doors) ho.openDoor(door.plan.id);
  ho.clearRobots();
  ho.place(place.a[0], place.a[1], 0, 0);
  ho.simulate(1 / 60, 5);
  ho.god(false);
  game.player.health = game.player.maxHealth;
  const p = game.player.position;
  const away = (point) => {
    let nearest = Infinity;
    for (const robot of game.robots) if (robot.alive) nearest = Math.min(nearest, Math.hypot(robot.position.x - point[0], robot.position.z - point[1]));
    return nearest;
  };
  let side = 'a';
  let hops = 0;
  let blows = 0;
  let last = game.player.health;
  let began = -1;
  let frames = 0;
  let mostRobots = 0;
  let highest = 0;
  for (; frames < 60 * (cap + 90); frames++) {
    const here = away([p.x, p.z]);
    if (began < 0 && here < 9) began = frames;
    if (began >= 0 && frames - began >= cap * 60) break;
    const stand = side === 'a' ? place.a : place.b;
    const other = side === 'a' ? place.b : place.a;
    if (policy === 'hop') {
      if (Math.hypot(stand[0] - p.x, stand[1] - p.z) < 0.4) {
        ho.press('forward', false);
        ho.press('sprint', false);
        // Robots nearly within reach: over it, unless they are already waiting on the far side.
        if (here < 2.5 && away(other) > Math.min(here, 1.7)) {
          side = side === 'a' ? 'b' : 'a';
          hops++;
        }
      } else {
        game.player.yaw = Math.atan2(-(stand[0] - p.x), -(stand[1] - p.z));
        ho.press('forward', true);
        ho.press('sprint', true);
        // (Jump is pressed all the way across: the game keeps a press for a moment, so this is a jump at every chance.)
        if (frames % 4 === 0) ho.tap('jump');
      }
    }
    ho.simulate(1 / 60, 1);
    if (game.player.onGround) highest = Math.max(highest, p.y);
    mostRobots = Math.max(mostRobots, game.robots.filter((robot) => robot.alive).length);
    if (game.player.health < last) blows++;
    last = game.player.health;
    if (ho.run().state !== 'playing') break;
  }
  ho.press('forward', false);
  ho.press('sprint', false);
  const down = ho.run().state !== 'playing';
  return { seconds: began < 0 ? -1 : (frames - began) / 60, down, hops, blows, mostRobots, highest };
}

/**
 * The places the hopper is tried: `a` and `b` are where it stands on either
 * side, and the straight line between them crosses the thing to be jumped
 * (or ends on top of it).
 */
export const HOP_SITES = [
  { name: 'the concrete barrier in the lobby', a: [-1.85, -1.75], b: [-1.6, -5.0] },
  { name: "the fence round the lab's assembly cell", a: [15.8, 17.9], b: [15.8, 20.3] },
  { name: 'a desk in the lab (onto it and off again)', a: [12.2, 16.9], b: [11.2, 15.0] },
  { name: 'the drums in the dock corner (onto them and off)', a: [-30.9, 23.4], b: [-33.08, 24.86] },
];
