// The mission: what has to be done to switch ARGUS off, in what order, and
// what the player should be told to do next. Pure logic, no rendering: the
// game tells it what the player did, and asks it what is allowed.
//
//   1. Restore power at the main breaker.
//   2. Recover three override keys, in any order:
//        - one in the key cage in the power room (its lock needs power)
//        - one carried by the Custodian, an elite robot that arrives once
//          the power is on and the rounds have reached a set number
//        - one issued by the uplink in the server hall, to whoever holds
//          the ground around it for a minute
//   3. Unseal the core with the keys, arm the kill switch, and hold the
//      core while it arms: the final stand. The switch only arms while the
//      player is in the core, as the uplink only counts while they stand
//      by it, so the stand cannot be won by running laps of the map.
//   4. Pull the switch.
//
// After that the mission is over and the rounds go on for as long as the
// player wants to keep fighting.

export type KeyId = 'cage' | 'custodian' | 'uplink';
export const KEY_IDS: readonly KeyId[] = ['cage', 'custodian', 'uplink'];

export type MissionPhase =
  /** The power is out. */
  | 'power'
  /** Power is on; keys are being recovered. */
  | 'keys'
  /** All three keys in hand: unseal the core and arm the switch. */
  | 'core'
  /** The switch is arming: the final stand. */
  | 'arming'
  /** Armed. Pull it. */
  | 'armed'
  /** ARGUS is off. */
  | 'saved';

export interface MissionRules {
  /** The Custodian arrives with the first round numbered this or higher that starts with the power on. */
  custodianFromRound: number;
  /** Seconds the ground round the uplink has to be held. */
  uplinkSeconds: number;
  /** Seconds the kill switch takes to arm, counted only while the player is in the core. */
  armSeconds: number;
  /** How far into the final stand ARGUS's own unit arrives, in seconds. */
  bossAfter: number;
}

export interface MissionState {
  phase: MissionPhase;
  /** Seconds played this run. */
  time: number;
  keys: Record<KeyId, boolean>;
  /**
   * The Custodian: not yet due, on the map, destroyed with its key lying
   * where it fell, or its key picked up.
   */
  custodian: 'waiting' | 'active' | 'dropped' | 'collected';
  uplink: 'idle' | 'running' | 'done';
  /** Seconds the uplink has been held so far. */
  uplinkHeld: number;
  /** The core's door has been unsealed. */
  coreOpen: boolean;
  /** Seconds the kill switch has been arming. */
  armed: number;
  /** ARGUS's own unit has been sent in, and has been destroyed. */
  bossSent: boolean;
  bossDestroyed: boolean;
  /** How long the run had lasted when the switch was pulled, or null. */
  savedAt: number | null;
}

export function createMission(): MissionState {
  return {
    phase: 'power',
    time: 0,
    keys: { cage: false, custodian: false, uplink: false },
    custodian: 'waiting',
    uplink: 'idle',
    uplinkHeld: 0,
    coreOpen: false,
    armed: 0,
    bossSent: false,
    bossDestroyed: false,
    savedAt: null,
  };
}

export const keysHeld = (state: MissionState): number => KEY_IDS.reduce((count, id) => count + (state.keys[id] ? 1 : 0), 0);
export const powerOn = (state: MissionState): boolean => state.phase !== 'power';

// ------------------------------------------------------- what the player does

/** Throw the main breaker. True if that restored the power. */
export function restorePower(state: MissionState): boolean {
  if (state.phase !== 'power') return false;
  state.phase = 'keys';
  return true;
}

/** Can this key be picked up right now? */
export function keyAvailable(state: MissionState, id: KeyId): boolean {
  if (state.keys[id] || !powerOn(state)) return false;
  // The cage's lock releases when the power comes back.
  if (id === 'cage') return true;
  if (id === 'custodian') return state.custodian === 'dropped';
  // The uplink hands its key over itself, the moment it has been held long enough.
  return false;
}

/** Pick a key up. True if it was there to be taken. */
export function collectKey(state: MissionState, id: KeyId): boolean {
  if (!keyAvailable(state, id)) return false;
  takeKey(state, id);
  return true;
}

function takeKey(state: MissionState, id: KeyId): void {
  state.keys[id] = true;
  if (id === 'custodian') state.custodian = 'collected';
  if (state.phase === 'keys' && keysHeld(state) === KEY_IDS.length) state.phase = 'core';
}

/** Should the Custodian join the round that is starting? */
export function custodianDue(state: MissionState, rules: MissionRules, round: number): boolean {
  return powerOn(state) && state.custodian === 'waiting' && round >= rules.custodianFromRound;
}

/** The Custodian has been sent onto the map. */
export function custodianSent(state: MissionState): void {
  if (state.custodian === 'waiting') state.custodian = 'active';
}

/** The Custodian has been destroyed: its key falls where it stood. */
export function custodianDestroyed(state: MissionState): boolean {
  if (state.custodian !== 'active') return false;
  state.custodian = 'dropped';
  return true;
}

/** Can the uplink defence be started? */
export const uplinkReady = (state: MissionState): boolean => powerOn(state) && state.uplink === 'idle' && !state.keys.uplink;

/** Start the uplink defence. True if it started. */
export function startUplink(state: MissionState): boolean {
  if (!uplinkReady(state)) return false;
  state.uplink = 'running';
  state.uplinkHeld = 0;
  return true;
}

/** Can the core be unsealed? */
export const coreReady = (state: MissionState): boolean => keysHeld(state) === KEY_IDS.length && !state.coreOpen;

/** Put the keys in the core's door. True if that unsealed it. */
export function openCore(state: MissionState): boolean {
  if (!coreReady(state)) return false;
  state.coreOpen = true;
  return true;
}

/** Start arming the kill switch: the final stand begins. True if it started. */
export function armSwitch(state: MissionState): boolean {
  if (state.phase !== 'core' || !state.coreOpen) return false;
  state.phase = 'arming';
  state.armed = 0;
  return true;
}

/** Pull the kill switch. True if that ended it. */
export function pullSwitch(state: MissionState): boolean {
  if (state.phase !== 'armed') return false;
  state.phase = 'saved';
  state.savedAt = state.time;
  return true;
}

/** ARGUS's own unit has been sent in, or destroyed. */
export function bossSent(state: MissionState): void {
  state.bossSent = true;
}
export function bossDestroyed(state: MissionState): void {
  if (state.bossSent) state.bossDestroyed = true;
}

// ------------------------------------------------------------------- time

export interface MissionTick {
  /** The uplink has just been held for long enough: its key is handed over. */
  uplinkDone: boolean;
  /** ARGUS's own unit is due on this update. */
  sendBoss: boolean;
  /** The kill switch has just finished arming. */
  armedNow: boolean;
}

/**
 * Advance the mission by `dt` seconds. `holdingUplink` says whether the
 * player is standing on the ground round the uplink, and `holdingCore`
 * whether they are in the core: the uplink's clock and the kill switch's
 * only run while they are, and each keeps what it has when they leave.
 */
export function updateMission(state: MissionState, rules: MissionRules, dt: number, holdingUplink: boolean, holdingCore: boolean): MissionTick {
  const tick: MissionTick = { uplinkDone: false, sendBoss: false, armedNow: false };
  state.time += dt;

  if (state.uplink === 'running' && holdingUplink) {
    state.uplinkHeld = Math.min(rules.uplinkSeconds, state.uplinkHeld + dt);
    if (state.uplinkHeld >= rules.uplinkSeconds) {
      state.uplink = 'done';
      takeKey(state, 'uplink');
      tick.uplinkDone = true;
    }
  }

  if (state.phase === 'arming' && holdingCore) {
    state.armed = Math.min(rules.armSeconds, state.armed + dt);
    if (!state.bossSent && state.armed >= rules.bossAfter) tick.sendBoss = true;
    if (state.armed >= rules.armSeconds) {
      state.phase = 'armed';
      tick.armedNow = true;
    }
  }
  return tick;
}

// ------------------------------------------------- what to tell the player

/** Places a step of the mission can send the player to. */
export type MissionTarget = 'breaker' | 'cage' | 'uplink' | 'custodian' | 'custodianKey' | 'coreDoor' | 'killSwitch';

export interface Objective {
  /** The line shown on the tracker. */
  title: string;
  /** A second, smaller line: progress, or what is holding things up. */
  detail: string;
  /** Where the marker points, or null when there is nowhere to go yet. */
  target: MissionTarget | null;
}

const clock = (seconds: number): string => {
  // (A hair less than the true figure, so that a clock counted down in
  // sixtieths of a second does not show "1:00" for an instant at 59.99999.)
  const whole = Math.max(0, Math.ceil(seconds - 1e-4));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/**
 * What the player should be doing now. With several keys still to find,
 * the one named is the nearest to hand: a key lying on the floor first,
 * then the cage, then an uplink already being held, then the Custodian if
 * it is on the map, then the uplink.
 */
export function objective(state: MissionState, rules: MissionRules, holdingUplink: boolean, holdingCore: boolean): Objective {
  const keys = `OVERRIDE KEYS ${keysHeld(state)} / ${KEY_IDS.length}`;
  switch (state.phase) {
    case 'power':
      return { title: 'RESTORE POWER AT THE MAIN BREAKER', detail: 'POWER ROOM', target: 'breaker' };
    case 'keys': {
      if (state.custodian === 'dropped') return { title: "PICK UP THE CUSTODIAN'S KEY", detail: keys, target: 'custodianKey' };
      if (state.uplink === 'running') {
        const left = clock(rules.uplinkSeconds - state.uplinkHeld);
        return holdingUplink ? { title: 'HOLD THE UPLINK', detail: `${left} · ${keys}`, target: 'uplink' } : { title: 'GET BACK TO THE UPLINK', detail: `${left} LEFT · CLOCK STOPPED`, target: 'uplink' };
      }
      if (!state.keys.cage) return { title: 'TAKE THE KEY FROM THE CAGE', detail: `POWER ROOM · ${keys}`, target: 'cage' };
      if (state.custodian === 'active') return { title: 'DESTROY THE CUSTODIAN', detail: `IT CARRIES A KEY · ${keys}`, target: 'custodian' };
      if (!state.keys.uplink) return { title: 'DEFEND THE UPLINK', detail: `SERVER HALL · ${keys}`, target: 'uplink' };
      return { title: 'A CUSTODIAN CARRIES THE LAST KEY', detail: `IT ARRIVES FROM ROUND ${rules.custodianFromRound} · ${keys}`, target: null };
    }
    case 'core':
      return state.coreOpen ? { title: 'ARM THE KILL SWITCH', detail: 'THE CORE', target: 'killSwitch' } : { title: 'UNSEAL THE CORE', detail: `${keys} · SERVER HALL, FAR END`, target: 'coreDoor' };
    case 'arming': {
      const left = clock(rules.armSeconds - state.armed);
      return holdingCore ? { title: 'HOLD THE CORE WHILE THE SWITCH ARMS', detail: left, target: 'killSwitch' } : { title: 'GET BACK TO THE CORE', detail: `${left} LEFT · CLOCK STOPPED`, target: 'killSwitch' };
    }
    case 'armed':
      return { title: 'PULL THE KILL SWITCH', detail: 'ARMED', target: 'killSwitch' };
    case 'saved':
      return { title: 'HUMANITY SAVED', detail: 'ARGUS IS OFFLINE · HOLD OUT AS LONG AS YOU CAN', target: null };
  }
}
