import { describe, expect, it } from 'vitest';
import { MISSION } from '../src/config';
import {
  armSwitch,
  bossDestroyed,
  bossSent,
  collectKey,
  coreReady,
  createMission,
  custodianDestroyed,
  custodianArrives,
  custodianDue,
  custodianSent,
  keyAvailable,
  keysHeld,
  objective,
  openCore,
  powerOn,
  pullSwitch,
  restorePower,
  startUplink,
  updateMission,
  uplinkReady,
  type MissionRules,
  type MissionState,
} from '../src/sim/mission';

const rules: MissionRules = { custodianFromRound: 6, uplinkSeconds: 60, armSeconds: 75, bossAfter: 10 };

/**
 * Run the clock on for `seconds`, in sixtieths, and say what happened
 * along the way. `holding` says whether the player is where they have to
 * be for a clock to run (by the uplink, or in the core).
 */
function run(state: MissionState, seconds: number, holding = true) {
  const seen = { uplinkDone: 0, sendBoss: 0, armedNow: 0 };
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const tick = updateMission(state, rules, 1 / 60, holding, holding);
    if (tick.uplinkDone) seen.uplinkDone++;
    if (tick.armedNow) seen.armedNow++;
    if (tick.sendBoss) {
      seen.sendBoss++;
      bossSent(state);
    }
  }
  return seen;
}

/** A mission with the power on and all three keys in hand. */
function withKeys(): MissionState {
  const m = createMission();
  restorePower(m);
  collectKey(m, 'cage');
  custodianSent(m);
  custodianDestroyed(m);
  collectKey(m, 'custodian');
  startUplink(m);
  run(m, rules.uplinkSeconds + 1);
  return m;
}

describe('the mission: power', () => {
  it('starts with the power out and nothing else possible', () => {
    const m = createMission();
    expect(m.phase).toBe('power');
    expect(powerOn(m)).toBe(false);
    expect(keyAvailable(m, 'cage')).toBe(false);
    expect(collectKey(m, 'cage')).toBe(false);
    expect(uplinkReady(m)).toBe(false);
    expect(startUplink(m)).toBe(false);
    expect(custodianDue(m, rules, 20)).toBe(false);
    expect(openCore(m)).toBe(false);
    expect(armSwitch(m)).toBe(false);
    expect(pullSwitch(m)).toBe(false);
    expect(objective(m, rules, false, false).target).toBe('breaker');
  });

  it('is restored once, at the breaker', () => {
    const m = createMission();
    expect(restorePower(m)).toBe(true);
    expect(powerOn(m)).toBe(true);
    expect(m.phase).toBe('keys');
    expect(restorePower(m)).toBe(false);
  });
});

describe('the mission: three keys, in any order', () => {
  it('releases the cage key as soon as the power is on', () => {
    const m = createMission();
    restorePower(m);
    expect(keyAvailable(m, 'cage')).toBe(true);
    expect(objective(m, rules, false, false).target).toBe('cage');
    expect(collectKey(m, 'cage')).toBe(true);
    expect(keysHeld(m)).toBe(1);
    // It cannot be taken twice.
    expect(collectKey(m, 'cage')).toBe(false);
    expect(keysHeld(m)).toBe(1);
  });

  it('sends the Custodian in with the first round to start once the other two keys are held, and never before its earliest round', () => {
    const m = createMission();
    const from = rules.custodianFromRound;
    expect(custodianDue(m, rules, from + 3)).toBe(false);
    restorePower(m);
    // Power alone does not bring it, however late the round: it comes for the last key.
    expect(custodianDue(m, rules, from)).toBe(false);
    expect(custodianDue(m, rules, from + 9)).toBe(false);
    collectKey(m, 'cage');
    expect(custodianDue(m, rules, from + 9)).toBe(false);
    startUplink(m);
    run(m, rules.uplinkSeconds + 0.5);
    collectKey(m, 'uplink');
    expect(keysHeld(m)).toBe(2);
    // Both keys early: it waits for its earliest round.
    expect(custodianDue(m, rules, from - 1)).toBe(false);
    expect(custodianDue(m, rules, from)).toBe(true);
    // Both keys late: it comes with the very next round to start.
    expect(custodianDue(m, rules, from + 4)).toBe(true);
    custodianSent(m);
    expect(custodianDue(m, rules, from + 5)).toBe(false);
  });

  it('says which round the Custodian will come with: the next one, or its earliest', () => {
    const from = rules.custodianFromRound;
    expect(custodianArrives(rules, 1)).toBe(from);
    expect(custodianArrives(rules, from - 1)).toBe(from);
    expect(custodianArrives(rules, from)).toBe(from + 1);
    expect(custodianArrives(rules, from + 6)).toBe(from + 7);
  });

  it('does not matter which of the other two keys is taken first', () => {
    const m = createMission();
    restorePower(m);
    startUplink(m);
    run(m, rules.uplinkSeconds + 0.5);
    collectKey(m, 'uplink');
    expect(custodianDue(m, rules, rules.custodianFromRound + 2)).toBe(false);
    collectKey(m, 'cage');
    expect(custodianDue(m, rules, rules.custodianFromRound + 2)).toBe(true);
  });

  it("gives up the Custodian's key only when it is destroyed, and then only once", () => {
    const m = createMission();
    restorePower(m);
    expect(custodianDestroyed(m)).toBe(false); // not on the map yet
    custodianSent(m);
    expect(objective({ ...m, keys: { ...m.keys, cage: true } }, rules, false, false).target).toBe('custodian');
    expect(keyAvailable(m, 'custodian')).toBe(false);
    expect(custodianDestroyed(m)).toBe(true);
    expect(objective(m, rules, false, false).target).toBe('custodianKey');
    expect(collectKey(m, 'custodian')).toBe(true);
    expect(collectKey(m, 'custodian')).toBe(false);
    expect(custodianDestroyed(m)).toBe(false);
    expect(m.custodian).toBe('collected');
  });

  it('hands over the uplink key after the uplink has been held for a full minute', () => {
    const m = createMission();
    restorePower(m);
    expect(uplinkReady(m)).toBe(true);
    expect(startUplink(m)).toBe(true);
    expect(startUplink(m)).toBe(false); // already running
    expect(run(m, rules.uplinkSeconds - 1).uplinkDone).toBe(0);
    expect(m.keys.uplink).toBe(false);
    expect(run(m, 1.1).uplinkDone).toBe(1);
    expect(m.keys.uplink).toBe(true);
    expect(m.uplink).toBe('done');
    expect(uplinkReady(m)).toBe(false);
    // And only once.
    expect(run(m, 5).uplinkDone).toBe(0);
  });

  it("stops the uplink's clock while the player is away from it, and keeps what was earned", () => {
    const m = createMission();
    restorePower(m);
    startUplink(m);
    run(m, 20);
    run(m, 300, false);
    expect(m.uplinkHeld).toBeCloseTo(20, 1);
    expect(m.keys.uplink).toBe(false);
    expect(objective(m, rules, false, false).title).toContain('GET BACK');
    expect(objective(m, rules, true, false).title).toBe('HOLD THE UPLINK');
    run(m, 40.1);
    expect(m.keys.uplink).toBe(true);
  });

  it('accepts the keys in every order, and moves on only when all three are held', () => {
    const steps: Record<string, (m: MissionState) => void> = {
      cage: (m) => void collectKey(m, 'cage'),
      custodian: (m) => {
        custodianSent(m);
        custodianDestroyed(m);
        collectKey(m, 'custodian');
      },
      uplink: (m) => {
        startUplink(m);
        run(m, rules.uplinkSeconds + 0.5);
      },
    };
    for (const order of [
      ['cage', 'custodian', 'uplink'],
      ['cage', 'uplink', 'custodian'],
      ['custodian', 'cage', 'uplink'],
      ['custodian', 'uplink', 'cage'],
      ['uplink', 'cage', 'custodian'],
      ['uplink', 'custodian', 'cage'],
    ]) {
      const m = createMission();
      restorePower(m);
      order.forEach((key, i) => {
        expect(m.phase, order.join()).toBe('keys');
        expect(coreReady(m)).toBe(false);
        steps[key]!(m);
        expect(keysHeld(m)).toBe(i + 1);
      });
      expect(m.phase, order.join()).toBe('core');
      expect(coreReady(m)).toBe(true);
    }
  });

  it('always has something to tell the player to do', () => {
    const m = createMission();
    restorePower(m);
    collectKey(m, 'cage');
    // Before the Custodian is due: the uplink.
    expect(objective(m, rules, false, false).target).toBe('uplink');
    startUplink(m);
    run(m, rules.uplinkSeconds + 0.5);
    collectKey(m, 'uplink');
    // Two keys, the Custodian not here yet: nowhere to go, but it says why, and when.
    const early = objective(m, rules, false, false, 2);
    expect(early.target).toBeNull();
    expect(early.title).toContain('CUSTODIAN');
    expect(early.detail).toContain(`ROUND ${rules.custodianFromRound}`);
    expect(early.detail).toContain('2 / 3');
    const late = objective(m, rules, false, false, rules.custodianFromRound + 3);
    expect(late.detail).toContain(`ROUND ${rules.custodianFromRound + 4}`);
  });
});

describe('the mission: the core and the kill switch', () => {
  it('keeps the core sealed without all three keys', () => {
    const m = createMission();
    restorePower(m);
    collectKey(m, 'cage');
    expect(coreReady(m)).toBe(false);
    expect(openCore(m)).toBe(false);
    expect(m.coreOpen).toBe(false);
  });

  it('unseals the core with the keys, then arms, then can be pulled', () => {
    const m = withKeys();
    expect(objective(m, rules, false, false).target).toBe('coreDoor');
    // The switch cannot be armed through a sealed door.
    expect(armSwitch(m)).toBe(false);
    expect(openCore(m)).toBe(true);
    expect(openCore(m)).toBe(false);
    expect(objective(m, rules, false, false).target).toBe('killSwitch');
    expect(pullSwitch(m)).toBe(false); // not armed yet
    expect(armSwitch(m)).toBe(true);
    expect(armSwitch(m)).toBe(false);
    expect(m.phase).toBe('arming');
  });

  it("sends ARGUS's own unit in part-way through the final stand, once", () => {
    const m = withKeys();
    openCore(m);
    armSwitch(m);
    expect(run(m, rules.bossAfter - 0.5).sendBoss).toBe(0);
    expect(run(m, 1).sendBoss).toBe(1);
    expect(run(m, 20).sendBoss).toBe(0);
    expect(m.bossSent).toBe(true);
    bossDestroyed(m);
    expect(m.bossDestroyed).toBe(true);
  });

  it('takes the full arming time, whatever else happens, and cannot be pulled early', () => {
    const m = withKeys();
    openCore(m);
    armSwitch(m);
    const early = run(m, rules.armSeconds - 1);
    expect(early.armedNow).toBe(0);
    expect(pullSwitch(m)).toBe(false);
    expect(objective(m, rules, false, true).detail).toBe('0:01');
    expect(run(m, 1.1).armedNow).toBe(1);
    expect(m.phase).toBe('armed');
    expect(objective(m, rules, false, true).title).toBe('PULL THE KILL SWITCH');
  });

  it('only arms while the player is in the core, and keeps what it has when they leave', () => {
    const m = withKeys();
    openCore(m);
    armSwitch(m);
    run(m, 20);
    expect(m.armed).toBeCloseTo(20, 1);
    // Ten minutes of running laps of the map: nothing.
    const away = run(m, 600, false);
    expect(m.armed).toBeCloseTo(20, 1);
    expect(away.armedNow).toBe(0);
    expect(m.phase).toBe('arming');
    expect(pullSwitch(m)).toBe(false);
    expect(objective(m, rules, false, false).title).toBe('GET BACK TO THE CORE');
    expect(objective(m, rules, false, false).detail).toContain('CLOCK STOPPED');
    expect(objective(m, rules, false, true).title).toBe('HOLD THE CORE WHILE THE SWITCH ARMS');
    // Back in the core it carries on from where it was.
    expect(run(m, rules.armSeconds - 20 + 0.1).armedNow).toBe(1);
    expect(m.phase).toBe('armed');
  });

  it("does not send ARGUS's own unit while the player is outside the core", () => {
    const m = withKeys();
    openCore(m);
    armSwitch(m);
    expect(run(m, 120, false).sendBoss).toBe(0);
    expect(run(m, rules.bossAfter + 0.1).sendBoss).toBe(1);
  });

  it('records how long the run had lasted when the switch was pulled, and then is over', () => {
    const m = withKeys();
    openCore(m);
    armSwitch(m);
    run(m, rules.armSeconds + 0.5);
    const before = m.time;
    expect(pullSwitch(m)).toBe(true);
    expect(m.phase).toBe('saved');
    expect(m.savedAt).toBeCloseTo(before, 5);
    expect(pullSwitch(m)).toBe(false);
    // The clock keeps running for the endless rounds; the record does not move.
    run(m, 30);
    expect(m.savedAt).toBeCloseTo(before, 5);
    expect(objective(m, rules, false, false).title).toBe('HUMANITY SAVED');
    expect(objective(m, rules, false, false).target).toBeNull();
  });
});

describe('the mission: the numbers in the config', () => {
  it('asks for a full minute at the uplink, and sends the boss in before the switch is armed', () => {
    expect(MISSION.uplinkSeconds).toBe(60);
    expect(MISSION.bossAfter).toBeLessThan(MISSION.armSeconds);
    // (The Custodian: never before round 6. The player asked for 8, then for 6.)
    expect(MISSION.custodianFromRound).toBe(6);
  });
});

describe('the mission: the wave at the uplink', () => {
  it('is small in the early rounds and grows with them, up to a limit', async () => {
    const { uplinkWave } = await import('../src/sim/mission');
    const sizes = [1, 3, 4, 5, 6, 8, 9, 12, 30].map((round) => uplinkWave(MISSION, round));
    expect(sizes[0]).toBe(MISSION.uplinkWaveBase);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]!).toBeGreaterThanOrEqual(sizes[i - 1]!);
    expect(uplinkWave(MISSION, 4)).toBeLessThan(uplinkWave(MISSION, 9));
    expect(sizes[sizes.length - 1]).toBe(MISSION.uplinkWaveMax);
  });
});
