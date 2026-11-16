// Runs the mission: connects its rules (sim/mission.ts) to the map, the
// robots, what F does, and what the HUD is told.
//
// The rules say what is allowed and what comes next. This class listens for
// what the player does (throws the breaker, takes a key, starts the uplink,
// pulls the switch), moves the parts of the map that go with it, and sends
// in the robots the mission has of its own: the Custodian, the wave that
// comes at the uplink, and ARGUS's Proxy and its horde for the final stand.

import * as THREE from 'three';
import { MISSION, ROBOT } from '../config';
import type { AudioEngine } from '../audio/AudioEngine';
import type { Player } from '../entities/Player';
import type { Robot } from '../entities/robot/Robot';
import { settings } from '../core/settings';
import type { LightRig } from '../render/lighting';
import {
  armSwitch,
  bossDestroyed,
  bossSent,
  collectKey,
  coreReady,
  createMission,
  custodianDestroyed,
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
  uplinkWave,
  KEY_IDS,
  type KeyId,
  type MissionPhase,
  type MissionState,
  type MissionTarget,
  type Objective,
} from '../sim/mission';
import { setArgusGlow } from '../world/build/LedBank';
import { setArgusOnline } from '../world/lobby/ScreenBank';
import { MISSION_PLACES, UPLINK, type MissionPlace } from '../world/plan';
import type { World } from '../world/World';
import type { Director } from './Director';
import type { Prompt } from './Interactions';

/** How close the player must be to something of the mission's to use it (metres). */
const REACH = 2.5;
/** Seconds between the switch being pulled and the ending being shown: long enough to watch them fall. */
const ENDING_DELAY = 3.0;

/**
 * How ARGUS dies when the switch is pulled: how brightly its eye, the red
 * light it throws on the core and the red lights on its machines burn, so
 * many seconds after the pull. It gutters twice and is out in a little
 * over a second: bright, almost out, bright again, almost out, a last
 * half-glow, gone. (Two flashes in a second is inside what is safe to show;
 * with "reduce screen shake and flashing" on it simply fades.)
 */
const DYING: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.05, 0.12],
  [0.17, 0.12],
  [0.22, 0.9],
  [0.38, 0.9],
  [0.43, 0.06],
  [0.6, 0.06],
  [0.66, 0.5],
  [0.82, 0.45],
  [1.2, 0],
];
function dying(seconds: number, calm: boolean): number {
  if (calm) return Math.max(0, 1 - seconds / 1.2);
  for (let i = 1; i < DYING.length; i++) {
    const [t1, v1] = DYING[i]!;
    if (seconds <= t1) {
      const [t0, v0] = DYING[i - 1]!;
      return v0 + ((v1 - v0) * (seconds - t0)) / (t1 - t0);
    }
  }
  return 0;
}

/** A step the debug tools can jump the mission to. */
export type MissionStep = 'power' | 'keys' | 'core' | 'arming' | 'armed' | 'saved';

const _forward = new THREE.Vector3();

/** What makes an elite what it is, from the numbers in the config. */
const elite = (role: 'custodian' | 'proxy') => {
  const spec = MISSION[role];
  return { role, health: spec.health, speed: spec.speed, attackDamage: spec.damage, staggerDamage: ROBOT.staggerDamage * spec.stagger, flinchTime: spec.flinch };
};

export class Mission {
  state: MissionState = createMission();
  /** Something in the mission has just happened: a line for the HUD. */
  onNotice: (title: string, detail: string) => void = () => {};
  /** The switch has been pulled and the robots have gone down: show the ending. */
  onSaved: () => void = () => {};
  /** Every robot on the map is to power down (the switch has been pulled). */
  onPowerDown: () => void = () => {};

  /** The Custodian, while it is on the map. */
  private custodian: Robot | null = null;
  /** ARGUS's Proxy, while it is on the map. */
  private proxy: Robot | null = null;
  /** Each is due but has not yet found somewhere to come in unseen. */
  private custodianPending = false;
  private proxyPending = false;
  /** Seconds until the next robot of the uplink's wave, and of the final stand's. */
  private waveClock = 0;
  private standClock = 0;
  /** Counting down to the ending after the switch is pulled (-1 when not). */
  private ending = -1;
  /** Seconds since the switch was pulled (-1 before). */
  private sincePull = -1;
  /** Debug: part of this run's mission was skipped, so its time is not a record. */
  skipped = false;

  constructor(
    private readonly world: World,
    private readonly director: Director,
    private readonly lights: LightRig,
    private readonly audio: AudioEngine,
    private readonly player: Player,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly robots: readonly Robot[],
  ) {}

  /** A new run. */
  reset(): void {
    this.state = createMission();
    this.custodian = null;
    this.proxy = null;
    this.custodianPending = false;
    this.proxyPending = false;
    this.waveClock = 0;
    this.standClock = 0;
    this.ending = -1;
    this.sincePull = -1;
    this.skipped = false;
    this.director.suspended = false;
    this.world.mission.reset();
    this.lights.power = false;
    this.setArgus(1);
  }

  /** How awake ARGUS is, 1 to 0: its eye, its red light in the core, the red lights on its machines, its face on the monitors. */
  private setArgus(level: number): void {
    const argus = this.world.areas.get('core')!.argus;
    if (argus) argus.awake = level;
    this.lights.argusLevel = level;
    setArgusGlow(level);
    setArgusOnline(level > 0.5);
  }

  // ------------------------------------------------------------- the clock

  /** True while the player is in the core: the kill switch only arms while they are. */
  get holdingCore(): boolean {
    return this.world.playerArea === 'core';
  }

  /** True while the player is standing on the ground round the uplink. */
  get holdingUplink(): boolean {
    // (In the server hall: the circle reaches a little way past its walls.)
    return this.world.playerArea === 'hall' && Math.hypot(this.player.position.x - UPLINK.zone.x, this.player.position.z - UPLINK.zone.z) <= MISSION.uplinkRadius;
  }

  update(dt: number): void {
    const state = this.state;
    const set = this.world.mission;
    const tick = updateMission(state, MISSION, dt, this.holdingUplink, this.holdingCore);

    if (tick.uplinkDone) this.keyTaken('uplink');
    if (tick.sendBoss) {
      bossSent(state);
      this.proxyPending = true;
    }
    if (tick.armedNow) {
      this.audio.play('missionNotice');
      this.onNotice('KILL SWITCH ARMED', 'PULL IT');
    }

    // An elite that has left the map without being destroyed, by whatever
    // route, is sent in again: the mission must never be left waiting for a
    // robot that is not there.
    if (this.custodian?.removed) this.robotLost(this.custodian);
    if (this.proxy?.removed) this.robotLost(this.proxy);

    // Robots of the mission's own that are due go in as soon as there is somewhere unseen.
    if (this.custodianPending) this.sendCustodian();
    if (this.proxyPending) this.sendProxy();

    // While the uplink is being defended, more robots come for it than the round sends.
    if (state.uplink === 'running') {
      this.waveClock -= dt;
      if (this.waveClock <= 0 && this.director.room && this.extras() < uplinkWave(MISSION, this.director.rounds.round)) {
        this.waveClock = this.director.sendExtra(['hall']) ? MISSION.uplinkWaveInterval : 0.4;
      }
    }
    // The final stand: the rounds stand aside and ARGUS sends everything at the core.
    if (state.phase === 'arming' || state.phase === 'armed') {
      this.standClock -= dt;
      if (this.standClock <= 0 && this.director.room && this.extras() < MISSION.standMax) {
        const plan = this.director.rounds.plan;
        const speed = Math.random() < MISSION.standRunners ? plan.runSpeed : plan.walkSpeed;
        this.standClock = this.director.sendExtra(['core', 'hall'], { speed }) ? MISSION.standInterval : 0.4;
      }
    }

    // After the switch: ARGUS gutters and goes out, and then the ending.
    if (state.phase === 'saved') {
      if (this.sincePull >= 0 && this.sincePull < 2) {
        this.sincePull += dt;
        this.setArgus(dying(this.sincePull, settings.value.reducedMotion));
      }
      if (this.ending >= 0) {
        this.ending -= dt;
        if (this.ending < 0) this.onSaved();
      }
    }

    set.setUplink(state.uplink, state.uplinkHeld / MISSION.uplinkSeconds);
    set.setSwitch(state.phase === 'arming' || state.phase === 'armed' || state.phase === 'saved', state.armed / MISSION.armSeconds, state.phase === 'armed', state.phase === 'saved', state.phase === 'arming' && !this.holdingCore);
  }

  /** Robots of the mission's own that are on the map and working. */
  private extras(): number {
    let count = 0;
    for (const robot of this.robots) if (robot.alive && robot.extra) count++;
    return count;
  }

  // ---------------------------------------------------------- the robots

  /** A round is starting: is the Custodian due? */
  roundStarted(round: number): void {
    if (custodianDue(this.state, MISSION, round)) this.custodianPending = true;
  }

  private sendCustodian(): void {
    const robot = this.director.sendExtra(['lobby', 'hall', 'power'], elite('custodian'));
    if (!robot) return;
    this.custodianPending = false;
    this.custodian = robot;
    custodianSent(this.state);
    robot.carry(this.world.mission.carriedKey());
    this.audio.play('missionAlarm');
    this.onNotice('A CUSTODIAN HAS ENTERED THE FACILITY', 'IT CARRIES AN OVERRIDE KEY');
  }

  private sendProxy(): void {
    const robot = this.director.sendExtra(['hall'], elite('proxy'), MISSION.proxyEntries);
    if (!robot) return;
    this.proxyPending = false;
    this.proxy = robot;
    this.audio.play('missionAlarm');
    this.onNotice('ARGUS HAS SENT ITS PROXY', 'HOLD THE CORE');
  }

  /**
   * A robot has been destroyed by the player. Returns the extra scrap it
   * was worth, over the usual award (the elites pay a bounty).
   */
  robotDestroyed(robot: Robot): number {
    if (robot === this.custodian) {
      this.custodian = null;
      if (custodianDestroyed(this.state)) {
        this.world.mission.dropKey(robot.position.x, robot.position.z);
        this.audio.play('missionNotice');
        this.onNotice('CUSTODIAN DESTROYED', 'PICK UP ITS KEY');
      }
      return MISSION.custodian.scrap;
    }
    if (robot === this.proxy) {
      this.proxy = null;
      bossDestroyed(this.state);
      this.audio.play('missionNotice');
      this.onNotice('PROXY DESTROYED', this.state.phase === 'armed' ? 'PULL THE SWITCH' : 'HOLD UNTIL THE SWITCH ARMS');
      return MISSION.proxy.scrap;
    }
    return 0;
  }

  /**
   * A robot has been taken off the map without being destroyed (it had
   * wedged itself somewhere). The elites come round again.
   */
  robotLost(robot: Robot): void {
    if (robot === this.custodian) {
      this.custodian = null;
      if (this.state.custodian === 'active') {
        this.state.custodian = 'waiting';
        this.custodianPending = true;
      }
    } else if (robot === this.proxy) {
      this.proxy = null;
      // (Not once the switch has been pulled: it is over.)
      if (this.state.phase === 'arming' || this.state.phase === 'armed') this.proxyPending = true;
    }
  }

  /** ARGUS's Proxy, while it is on the map: its name and how much of it is left (0..1). */
  get boss(): { name: string; health: number } | null {
    return this.proxy && this.proxy.alive ? { name: 'ARGUS PROXY', health: this.proxy.healthLeft } : null;
  }

  // ------------------------------------------------------ what F does here

  private near(place: MissionPlace): boolean {
    const p = this.player.position;
    const dx = place.at[0] - p.x;
    const dz = place.at[2] - p.z;
    const distance = Math.hypot(dx, dz);
    if (distance > REACH) return false;
    if (distance < 0.7) return true;
    this.camera.getWorldDirection(_forward);
    const flat = Math.hypot(_forward.x, _forward.z) || 1;
    return (dx * _forward.x + dz * _forward.z) / (distance * flat) > 0.4;
  }

  /**
   * What F would do where the player is standing, if it is something of
   * the mission's: the prompt to show, and what to do if it is pressed.
   */
  interaction(): { prompt: Prompt; use: (() => void) | null } | null {
    const state = this.state;
    const set = this.world.mission;
    const say = (text: string, note: string, use: (() => void) | null): { prompt: Prompt; use: (() => void) | null } => ({ prompt: { text, cost: null, usable: use !== null, note }, use });

    // A key lying on the floor comes first: it may be lying anywhere.
    if (set.droppedAt && state.custodian === 'dropped') {
      const distance = Math.hypot(set.droppedAt.x - this.player.position.x, set.droppedAt.z - this.player.position.z);
      if (distance <= MISSION.keyReach) return say('Pick up the override key', '', () => this.take('custodian'));
    }

    if (state.phase === 'power' && this.near(MISSION_PLACES.breaker)) return say('Restore power', 'Main breaker', () => this.throwBreaker());
    if (this.near(MISSION_PLACES.cage) && !state.keys.cage) {
      if (!powerOn(state)) return say('Key cage: locked', 'The lock needs power', null);
      if (keyAvailable(state, 'cage')) return say('Take the override key', '', () => this.take('cage'));
    }
    if (this.near(MISSION_PLACES.uplink) && !state.keys.uplink) {
      if (!powerOn(state)) return say('Uplink: no power', 'Restore power at the main breaker', null);
      if (uplinkReady(state)) return say('Start the uplink', `Then hold the ground round it for ${MISSION.uplinkSeconds} seconds`, () => this.engageUplink());
    }
    if (this.near(MISSION_PLACES.killSwitch)) {
      if (state.phase === 'core' && state.coreOpen) return say('Arm the kill switch', 'ARGUS will send everything it has', () => this.arm());
      if (state.phase === 'arming') return say('Kill switch: arming', 'Hold the core until it is armed', null);
      if (state.phase === 'armed') return say('PULL THE KILL SWITCH', '', () => this.pull());
    }
    return null;
  }

  /**
   * The core's door, which no amount of scrap opens: the prompt for it,
   * and what F does there.
   */
  coreDoor(): { prompt: Prompt; use: (() => void) | null } {
    const held = keysHeld(this.state);
    if (coreReady(this.state)) return { prompt: { text: 'Unseal the core', cost: null, usable: true, note: 'Three override keys' }, use: () => this.unseal() };
    return { prompt: { text: 'The Core: sealed', cost: null, usable: false, note: `Three override keys required (you have ${held})` }, use: null };
  }

  private throwBreaker(): void {
    if (!restorePower(this.state)) return;
    this.world.mission.setPower(true);
    this.lights.power = true;
    this.audio.play('missionPower', { position: new THREE.Vector3(...MISSION_PLACES.breaker.at) });
    this.player.addShake(0.2);
    this.onNotice('POWER RESTORED', 'THE KEY CAGE IS UNLOCKED');
  }

  private take(id: KeyId): void {
    if (!collectKey(this.state, id)) return;
    this.keyTaken(id);
  }

  /** A key has come into the player's hands, by whichever route. */
  private keyTaken(id: KeyId): void {
    const set = this.world.mission;
    if (id === 'cage') set.setCageKey(false);
    if (id === 'custodian') set.clearDroppedKey();
    this.audio.play('missionKey');
    const held = keysHeld(this.state);
    if (held === KEY_IDS.length) this.onNotice('ALL THREE KEYS RECOVERED', 'UNSEAL THE CORE');
    else this.onNotice('OVERRIDE KEY RECOVERED', `${held} OF ${KEY_IDS.length}`);
  }

  private engageUplink(): void {
    if (!startUplink(this.state)) return;
    this.waveClock = 2;
    this.audio.play('missionAlarm');
    this.onNotice('UPLINK ENGAGED', `HOLD THIS GROUND FOR ${MISSION.uplinkSeconds} SECONDS`);
  }

  private unseal(): void {
    if (!openCore(this.state)) return;
    this.world.openDoor('hallCore');
    this.audio.play('doorOpen', { position: new THREE.Vector3(...MISSION_PLACES.coreDoor.at) });
    this.player.addShake(0.15);
    this.onNotice('THE CORE IS UNSEALED', 'ARM THE KILL SWITCH');
  }

  private arm(): void {
    if (!armSwitch(this.state)) return;
    this.director.suspended = true;
    this.standClock = 1;
    this.audio.play('missionAlarm');
    const seconds = MISSION.armSeconds;
    this.onNotice('KILL SWITCH ARMING', `HOLD THE CORE FOR ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
  }

  private pull(): void {
    if (!pullSwitch(this.state)) return;
    this.custodianPending = false;
    this.proxyPending = false;
    this.custodian = null;
    this.proxy = null;
    this.sincePull = 0;
    this.audio.play('missionSwitch');
    this.player.addShake(0.35);
    // Whatever was left of the round is over, and so is everything on the map.
    this.director.endRound();
    this.onPowerDown();
    this.ending = ENDING_DELAY;
  }

  /** The player has chosen to fight on after the ending: the rounds pick up again. */
  resume(): void {
    this.director.suspended = false;
  }

  // ------------------------------------------------- what to tell the player

  get objective(): Objective {
    return objective(this.state, MISSION, this.holdingUplink, this.holdingCore);
  }

  /** Where the HUD's marker should point right now (false if nowhere). */
  target(out: THREE.Vector3): boolean {
    const target: MissionTarget | null = this.objective.target;
    if (!target) return false;
    if (target === 'custodian') {
      if (!this.custodian) return false;
      this.custodian.chest(out).y += 0.9;
      return true;
    }
    if (target === 'custodianKey') {
      const at = this.world.mission.droppedAt;
      if (!at) return false;
      out.set(at.x, 1.2, at.z);
      return true;
    }
    const at: readonly [number, number, number] = MISSION_PLACES[target].at;
    out.set(at[0], at[1], at[2]);
    return true;
  }

  // -------------------------------------------------------------- debugging

  /**
   * Debug: put the mission at the start of a step, as if everything before
   * it had been done. 'keys': the power is on. 'core': all three keys are
   * in hand and the core is still sealed. 'arming': the core is open and
   * the switch has just begun to arm (the final stand). 'armed': it is
   * ready to pull. 'saved': it has been pulled.
   */
  jump(step: MissionStep): void {
    const order: MissionPhase[] = ['power', 'keys', 'core', 'arming', 'armed', 'saved'];
    const want = order.indexOf(step);
    this.reset();
    const state = this.state;
    // The steps passed through on the way are not news: only the last
    // thing that happens is announced.
    const announce = this.onNotice;
    let last: [string, string] | null = null;
    this.onNotice = (title, detail) => (last = [title, detail]);
    if (want >= 1) this.throwBreaker();
    this.world.mission.setPower(want >= 1, true);
    if (want >= 2) {
      state.custodian = 'collected';
      state.uplink = 'done';
      state.uplinkHeld = MISSION.uplinkSeconds;
      for (const id of KEY_IDS) state.keys[id] = true;
      state.phase = 'core';
      this.world.mission.setCageKey(false);
    }
    if (want >= 3) {
      this.unseal();
      this.arm();
    }
    if (want >= 4) {
      state.armed = MISSION.armSeconds;
      state.phase = 'armed';
      state.bossSent = true;
    }
    if (want >= 5) this.pull();
    this.onNotice = announce;
    this.skipped = true;
    const said = last as [string, string] | null;
    if (said) announce(said[0], said[1]);
  }
}
