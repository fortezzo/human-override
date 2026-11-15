// The game itself: owns the scene and every system, and runs the frame loop.
//
// A run goes: title screen -> playing (rounds of robots, scrap, purchases)
// -> the player goes down -> game over -> play again, all without reloading
// the page. The rules live in src/sim; the pieces that connect them to the
// 3D world live beside this file (Director, Combat, Interactions).

import * as THREE from 'three';
import { acceleratedRaycast } from 'three-mesh-bvh';
import { CUSTODIAN } from '../entities/robot/designs/custodian';
import { PROXY } from '../entities/robot/designs/proxy';
import { Mission } from './Mission';
import { Sight } from './Sight';
import { AudioEngine } from '../audio/AudioEngine';
import { GOVERNOR, LOOK, LOOKDEV, QUALITY, QUALITY_ORDER, ROUNDS, SCRAP, type QualityLevel } from '../config';
import { Assets } from '../core/assets';
import { Input } from '../core/input';
import { damp, rand } from '../core/math';
import { settings } from '../core/settings';
import { Player } from '../entities/Player';
import { Gibs } from '../entities/robot/Gibs';
import { DRUDGE } from '../entities/robot/designs/drudge';
import { Robot, type RobotTraits } from '../entities/robot/Robot';
import { RobotModel } from '../entities/robot/RobotModel';
import { WeaponController } from '../entities/weapon/WeaponController';
import { WeaponView } from '../entities/weapon/WeaponView';
import { BulletDecals } from '../fx/BulletDecals';
import { Casings } from '../fx/Casings';
import { Effects } from '../fx/Effects';
import { Particles } from '../fx/Particles';
import { updateShaftTime } from '../render/atmosphere';
import { LightRig } from '../render/lighting';
import { MaterialLibrary, type SurfaceKind } from '../render/materials';
import { bakeReflectionProbe, blankEnvironment, countBrokenPixels } from '../render/reflectionProbe';
import { Renderer } from '../render/Renderer';
import { createWallet, earn, type Wallet } from '../sim/economy';
import { floodFrom } from '../sim/navGrid';
import { ROOM, PLAYER_START } from '../world/lobby/plan';
import { developScreens } from '../world/lobby/ScreenBank';
import { AREA_CENTRES, AREA_IDS, type AreaId, type EntryPlan } from '../world/plan';
import { World } from '../world/World';
import { Combat, type HitResult } from './Combat';
import { Director } from './Director';
import { Interactions, type Purchase } from './Interactions';
import { createRunStats, saveBest, type RunStats } from './RunStats';

// Fast ray tests against the level for bullets.
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/**
 * 'saved' is the ending: the kill switch has been pulled and the HUMANITY
 * SAVED screen is up. The run is not over; the player may carry on from it.
 */
export type GameState = 'title' | 'playing' | 'paused' | 'over' | 'saved';

/** A robot to point out on the HUD when only a few are left. */
export interface Marker {
  /** Position on screen, -1..1 across and up. Clamped to the edge when the robot is out of view. */
  x: number;
  y: number;
  onScreen: boolean;
  /** Metres from the player. */
  distance: number;
}

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(LOOK.fov, 1, 0.01, 140);
  readonly assets = new Assets();
  readonly audio = new AudioEngine();
  readonly renderer: Renderer;
  readonly input: Input;
  readonly player: Player;
  readonly weapons: WeaponController;
  readonly robots: Robot[] = [];

  world!: World;
  lights!: LightRig;
  director!: Director;
  /** What the player can see from where they stand (robots are never created in view). */
  sight!: Sight;
  interactions!: Interactions;
  /** The mission: power, the three keys, the core, the kill switch. */
  mission!: Mission;
  /** Scrap, and what happened this run. */
  wallet: Wallet = createWallet(SCRAP.start);
  /** Scrap earned in the run before the round now being played began. */
  private earnedBeforeRound = 0;
  stats: RunStats = createRunStats();

  state: GameState = 'title';
  onStateChange: (state: GameState) => void = () => {};
  onQualityChange: (level: QualityLevel, automatic: boolean) => void = () => {};
  /** A shot or strike landed on a robot. */
  onHit: (hit: HitResult) => void = () => {};
  /** The player was hurt; `angle` is the attacker's bearing relative to the view. */
  onPlayerHurt: (angle: number) => void = () => {};
  /** The rounds have just created a robot at an entry (`forced` = by a debug order). */
  onArrival: (robot: Robot, entry: EntryPlan, forced: boolean) => void = () => {};
  /**
   * A round has started (`amount` is how many robots it will send) or been
   * cleared (`amount` is the scrap earned during it).
   */
  onRound: (event: 'start' | 'clear', round: number, amount: number) => void = () => {};
  onPurchase: (purchase: Purchase) => void = () => {};
  onDenied: () => void = () => {};
  /** The run ended. `best` is true if it beat the best round so far. */
  onGameOver: (stats: RunStats, best: boolean) => void = () => {};
  /** Something in the mission has just happened: a line for the HUD. */
  onNotice: (title: string, detail: string) => void = () => {};
  /** The kill switch has been pulled. `best` is true if no run has finished the mission faster. */
  onSaved: (stats: RunStats, best: boolean) => void = () => {};

  /** Debug only: overrides where the camera sits and looks. */
  debugCamera: { position: THREE.Vector3; yaw: number; pitch: number; fov?: number } | null = null;
  /** Debug only: the player takes no damage. */
  godMode = false;
  /** Debug only: hide the weapon (for photographs of the room). */
  hideWeapon = false;
  /** Debug only: something that plays the game by itself, called once per frame while playing. */
  autopilot: { update(dt: number): void } | null = null;

  private materials!: MaterialLibrary;
  private view!: WeaponView;
  /** The standard robot, and the two elites built on the same skeleton. */
  private robotModel!: RobotModel;
  private custodianModel!: RobotModel;
  private proxyModel!: RobotModel;
  /** A robot that is never shown: it keeps the robots' shaders built. */
  private spare!: Robot;
  private gibs!: Gibs;
  private combat!: Combat;
  private readonly particles = new Particles();
  private readonly decals = new BulletDecals();
  private readonly casings = new Casings();
  private readonly effects = new Effects(this.particles, this.decals);
  /** The room's own reflections, photographed once per area. */
  private readonly environments = new Map<AreaId, THREE.Texture>();

  private quality: QualityLevel = 'high';
  private time = 0;
  private running = false;
  private lastFrame = 0;
  private fade = 1;
  private fadeTarget = 1;
  private bedsStarted = false;
  private soundClock = { casing: 0, scrap: 0, voice: 4, servo: 2, step: 0 };
  private nextDrip = 2;
  private nextFocus = 0;

  /** How long each part of start-up took, in milliseconds (for the performance report). */
  readonly loadTimings: Record<string, number> = {};

  /** Smoothed frames per second, for the counter and the quality governor. */
  fps = 60;
  private lowFpsTime = 0;
  private settleUntil = 0;
  /** The robots the player can bump into this frame. */
  private readonly obstacles: Array<{ x: number; z: number }> = [];

  /**
   * The light that travels with a robot whose design carries one (ARGUS's
   * Proxy). One lamp, always in the scene and dark when there is no such
   * robot, so that the count of lights never changes mid-game.
   */
  private readonly escort = new THREE.PointLight(0xffffff, 0, 6, 2);
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();

  constructor(private readonly container: HTMLElement) {
    this.renderer = new Renderer(this.scene, this.camera, container);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.input = new Input(this.renderer.three.domElement);
    this.player = new Player(this.camera, this.input);
    this.weapons = new WeaponController(this.camera, this.input);

    this.input.onLockChange = (locked) => {
      if (locked) this.setState('playing');
      else if (this.state === 'playing') this.setState('paused');
    };
    this.input.onKey('KeyM', () => settings.set({ muted: !settings.value.muted }));
    settings.onChange((s) => {
      this.audio.setVolume(s.volume);
      this.audio.setMuted(s.muted);
      this.renderer.brightness = s.brightness;
    });
    this.renderer.brightness = settings.value.brightness;
    this.audio.setVolume(settings.value.volume);
    this.audio.setMuted(settings.value.muted);
  }

  // ------------------------------------------------------------------ setup

  /** Download assets and build the world. `onProgress` gets 0..1. */
  async load(onProgress: (fraction: number) => void): Promise<void> {
    let mark = performance.now();
    const lap = (name: string) => {
      const now = performance.now();
      this.loadTimings[name] = Math.round(now - mark);
      mark = now;
    };

    await this.assets.load((data) => this.audio.decode(data), (f) => onProgress(f * 0.9));
    this.audio.attach(this.assets);
    lap('download and decode');

    this.materials = new MaterialLibrary(this.assets);
    this.world = new World(this.assets, this.materials);
    this.scene.add(this.world.group);
    this.world.onDoorPassable = () => this.refocus();

    this.scene.fog = new THREE.FogExp2(LOOKDEV.fogColor, LOOKDEV.fogDensity);
    this.scene.background = this.assets.sky;
    this.scene.backgroundIntensity = 0.22;
    this.scene.add(new THREE.HemisphereLight(LOOKDEV.ambientSky, LOOKDEV.ambientGround, LOOKDEV.ambientIntensity));

    this.lights = new LightRig(this.world.lights);
    this.scene.add(this.lights.group);
    this.scene.add(this.particles.group, this.decals.group, this.casings.mesh);

    this.robotModel = new RobotModel(this.assets, DRUDGE);
    this.custodianModel = new RobotModel(this.assets, CUSTODIAN);
    this.proxyModel = new RobotModel(this.assets, PROXY);
    this.gibs = new Gibs(this.robotModel);
    this.scene.add(this.gibs.group);
    // A spare robot that is never shown. While it exists the robots' shaders
    // stay built between rounds, and are rebuilt along with everything else
    // when the quality level changes, so the first robot of a round never
    // stalls the game.
    this.spare = new Robot(this.robotModel, 0, 0, 0);
    this.spare.root.visible = false;
    // Parked under the floor, and exempt from the "is it in view?" test so
    // that the one time it is drawn (see warmShadows) it is drawn for sure.
    this.spare.root.position.y = -40;
    this.spare.root.traverse((node) => (node.frustumCulled = false));
    this.scene.add(this.spare.root);

    this.view = new WeaponView(this.assets);
    this.camera.add(this.view.root);
    this.scene.add(this.view.muzzleLight);
    this.scene.add(this.escort);

    this.sight = new Sight(this.camera, () => this.world.solids);
    this.director = new Director(this.world, this.robots, (x, z, heading, traits) => this.addRobot(x, z, heading, traits), this.sight);
    this.combat = new Combat(this.world, this.robots, this.player, this.camera, this.view, this.effects, this.casings, this.audio);
    this.mission = new Mission(this.world, this.director, this.lights, this.audio, this.player, this.camera, this.robots);
    this.interactions = new Interactions(this.world, this.player, this.camera, this.weapons, () => this.wallet, this.mission);
    this.wireEvents();

    this.player.spawn(PLAYER_START.x, PLAYER_START.z, PLAYER_START.yaw);
    this.spawnTitleRobot();

    this.setQuality(this.pickStartingQuality(), false);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    lap('build world');

    // Compile every shader up front, in the background, so neither the first
    // frame nor the first gunshot or destroyed robot causes a stutter.
    onProgress(0.94);
    const standIn = this.useStandInEnvironment();
    await this.warmShaders();
    lap('compile shaders');

    onProgress(0.97);
    this.bakeReflections();
    standIn.dispose();
    lap('bake reflections');
    this.frame(0);
    lap('first frame');
    onProgress(1);
  }

  private wireEvents(): void {
    const { weapons, player, audio, combat, director, interactions } = this;
    weapons.onShot = (shot) => combat.shot(shot);
    weapons.onDryFire = () => audio.play('rifleDry');
    weapons.onReloadStage = (stage) => audio.play(stage === 'magOut' ? 'reloadMagOut' : stage === 'magIn' ? 'reloadMagIn' : 'reloadBolt');
    weapons.onSwitch = (weapon) => {
      this.view.show(weapon.id);
      audio.play('weaponSwitch');
    };
    weapons.onMelee = () => combat.swing();
    weapons.onMeleeLand = () => combat.strike();

    combat.onHit = (hit) => {
      let scrap = hit.scrap;
      if (hit.killed) {
        this.stats.kills++;
        if (hit.weakPoint) this.stats.weakPointKills++;
        if (hit.melee) this.stats.meleeKills++;
        // Robots the mission sent in are not the round's to count.
        if (!hit.robot.extra) director.destroyed();
        // The elites pay a bounty on top of the usual award.
        scrap += this.mission.robotDestroyed(hit.robot);
      }
      earn(this.wallet, scrap);
      this.stats.scrapEarned += scrap;
      this.onHit(scrap === hit.scrap ? hit : { ...hit, scrap });
    };
    combat.onShotFired = (hit) => {
      this.stats.shots++;
      if (hit) this.stats.shotsHit++;
    };

    director.onArrival = (robot, entry, forced) => this.onArrival(robot, entry, forced);
    // The sound and the announcement on the HUD start on the same call, so
    // the lettering lands on the sting's opening burst.
    director.onRoundStart = (round) => {
      this.stats.round = round;
      this.earnedBeforeRound = this.wallet.earned;
      audio.play('sting');
      this.onRound('start', round, director.rounds.plan.count);
      this.mission.roundStarted(round);
    };

    this.mission.onNotice = (title, detail) => this.onNotice(title, detail);
    this.mission.onPowerDown = () => {
      for (const robot of this.robots) robot.powerDown();
    };
    this.mission.onSaved = () => this.showSaved();
    director.onRoundClear = (round) => {
      audio.play('roundClear');
      this.onRound('clear', round, this.wallet.earned - this.earnedBeforeRound);
    };

    interactions.onPurchase = (purchase) => {
      this.stats.scrapSpent += purchase.cost;
      audio.play('buy');
      if (purchase.kind === 'door') {
        this.stats.doorsOpened++;
        audio.play('doorOpen', { position: purchase.door.centre });
        player.addShake(0.12);
      }
      this.onPurchase(purchase);
    };
    interactions.onDenied = () => {
      audio.play('deny');
      this.onDenied();
    };

    player.onStep = () => audio.play('step', { gain: player.sprinting ? 1.2 : 0.8 });
    player.onLand = (impact) => audio.play('land', { gain: 0.4 + impact });
    this.casings.onBounce = (position, speed) => {
      if (this.time < this.soundClock.casing) return;
      this.soundClock.casing = this.time + 0.05;
      audio.play('casing', { position, gain: Math.min(1, speed / 2.5) });
    };
    this.gibs.onImpact = (position, speed) => {
      if (this.time < this.soundClock.scrap) return;
      this.soundClock.scrap = this.time + 0.07;
      audio.play('scrap', { position, gain: Math.min(1, speed / 4) });
    };
  }

  /**
   * Put a black stand-in where the baked reflections will go. Shaders are
   * built differently with and without reflections, and for each size of
   * reflection picture (Ultra's is larger), so with this in place they are
   * built once, for the right size. The caller throws it away after the
   * real reflections have been baked.
   */
  private useStandInEnvironment(): THREE.Texture {
    const standIn = blankEnvironment(this.renderer.three, QUALITY[this.quality].reflectionProbeSize);
    this.scene.environment = standIn;
    this.scene.environmentIntensity = 0;
    return standIn;
  }

  /**
   * Shadows are drawn with small shaders of their own, which are only built
   * the first time something of that kind casts one. Draw one throwaway
   * picture with the spare robot standing in it, so that the first real
   * robot after a change of quality level does not have to wait for them.
   */
  private warmShadows(): void {
    const three = this.renderer.three;
    const throwaway = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    const before = three.getRenderTarget();
    this.spare.root.visible = true;
    three.setRenderTarget(throwaway);
    three.render(this.scene, this.camera);
    three.setRenderTarget(before);
    this.spare.root.visible = false;
    throwaway.dispose();
  }

  /**
   * Build every shader the scene can need, including those of things that
   * are hidden right now (the guns not in hand, scrap not yet on the floor,
   * the spare robot). The work is handed to the graphics driver all at once,
   * which lets it build them side by side; the promise resolves when every
   * one is ready to draw with.
   */
  private warmShaders(): Promise<unknown> {
    const three = this.renderer.three;
    const hidden = this.revealForCompile();
    // The scene is always drawn into an off-screen HDR buffer (never
    // straight to the screen), and shaders differ between the two, so
    // compile with a buffer of that kind bound.
    const offscreen = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    const before = three.getRenderTarget();
    three.setRenderTarget(offscreen);
    // Everything is started before this call returns; only the waiting is
    // left for later, so what was revealed can be hidden again straight away.
    const ready = three.compileAsync(this.scene, this.camera);
    three.setRenderTarget(before);
    offscreen.dispose();
    for (const object of hidden) object.visible = false;
    return ready;
  }

  /** Briefly show everything that starts hidden, so its shaders get compiled too. */
  private revealForCompile(): THREE.Object3D[] {
    const revealed: THREE.Object3D[] = [];
    this.scene.traverse((object) => {
      if (!object.visible) {
        object.visible = true;
        revealed.push(object);
      }
    });
    return revealed;
  }

  /**
   * Set each area up in turn the way it is photographed for its reflections
   * (that area alone drawn, its own lamps live, nothing that moves in the
   * picture) and hand it to `visit`. Everything is put back afterwards.
   */
  private eachAreaStaged(visit: (id: AreaId, centre: THREE.Vector3, hidden: THREE.Object3D[]) => void): void {
    // The monitors glow in those photographs too, so their picture must be ready.
    developScreens(this.renderer.three);
    const hidden: THREE.Object3D[] = [this.particles.group, this.gibs.group, this.casings.mesh, this.view.root, ...this.robots.map((r) => r.root)];
    for (const motes of this.world.dust.values()) hidden.push(motes.points);
    const shown = new Map<AreaId, boolean>();
    for (const [id, area] of this.world.areas) shown.set(id, area.group.visible);
    for (const id of AREA_IDS) {
      for (const [other, area] of this.world.areas) area.group.visible = other === id;
      const centre = new THREE.Vector3(...AREA_CENTRES[id]);
      this.lights.focus(centre, new Map([[id, 1]]), true);
      visit(id, centre, hidden);
    }
    for (const [id, area] of this.world.areas) area.group.visible = shown.get(id)!;
    this.refocus(true);
  }

  /** Photograph every area for its reflections and bounce light. */
  private bakeReflections(): void {
    const preset = QUALITY[this.quality];
    this.eachAreaStaged((id, centre, hidden) => {
      this.environments.get(id)?.dispose();
      // The lobby gets two passes: the second sees the first's bounce light,
      // so shadowed corners pick up a little colour from the lit parts of
      // the room. The other areas make do with one, to keep loading short.
      this.scene.environmentIntensity = 0;
      let environment = bakeReflectionProbe(this.renderer.three, this.scene, centre, preset.reflectionProbeSize, hidden);
      if (id === 'lobby') {
        const first = environment;
        this.scene.environment = first;
        this.scene.environmentIntensity = LOOKDEV.environmentIntensity;
        environment = bakeReflectionProbe(this.renderer.three, this.scene, centre, preset.reflectionProbeSize, hidden);
        // Never leave the scene pointing at a picture that has been thrown away.
        this.scene.environment = environment;
        first.dispose();
      }
      this.environments.set(id, environment);
    });
    this.scene.environment = this.environments.get(this.world.playerArea)!;
    this.scene.environmentIntensity = LOOKDEV.environmentIntensity;
  }

  /**
   * For the tests: how many broken pixels (not a number, or infinite) each
   * room's reflection photograph has, at every size a quality level uses.
   * The bake cleans such pixels away, so this is how a shader that produces
   * them is noticed. Every count should be zero.
   */
  brokenReflectionPixels(): Record<string, number> {
    const sizes = [...new Set(QUALITY_ORDER.map((level) => QUALITY[level].reflectionProbeSize))].sort((a, b) => a - b);
    const found: Record<string, number> = {};
    const intensity = this.scene.environmentIntensity;
    this.scene.environmentIntensity = 0;
    this.eachAreaStaged((id, centre, hidden) => {
      for (const size of sizes) found[`${id} at ${size}`] = countBrokenPixels(this.renderer.three, this.scene, centre, size, hidden);
    });
    this.scene.environmentIntensity = intensity;
    return found;
  }

  /** Hand the live lights to whatever can be seen from where the camera is. */
  private refocus(instant = false): void {
    this.lights.focus(this.camera.position, this.world.visible, instant);
    this.nextFocus = this.time + 0.25;
  }

  private pickStartingQuality(): QualityLevel {
    const chosen = settings.value.quality;
    return chosen === 'auto' ? this.automaticQuality() : chosen;
  }

  /**
   * The level "Auto" starts from on this computer: a guess from the
   * graphics chip's name, which the governor then corrects in play. Asking
   * for Auto again starts again from here, so a computer that was only
   * busy for a moment gets a second chance at the better picture.
   */
  automaticQuality(): QualityLevel {
    const gpu = this.renderer.gpuName.toLowerCase();
    if (/swiftshader|llvmpipe|software|basic render/.test(gpu)) return 'low';
    if (/rtx|radeon rx|geforce gtx 1[0-9]{3}|geforce gtx 9[78]0|arc\(tm\) a[57]|apple m[2-9]/.test(gpu)) return 'high';
    if (/intel|uhd|iris|mali|adreno|powervr|radeon\(tm\) graphics|vega/.test(gpu)) return 'low';
    return 'medium';
  }

  setQuality(level: QualityLevel, automatic: boolean): void {
    const changed = level !== this.quality;
    this.quality = level;
    const preset = QUALITY[level];
    this.renderer.setExtraScale(1);
    this.renderer.applyQuality(preset);
    this.materials.setAnisotropy(Math.min(preset.anisotropy, this.renderer.maxAnisotropy));
    this.lights.applyQuality(preset);
    this.refocus(true);
    for (const motes of this.world.dust.values()) motes.setCount(preset.dustMotes);
    this.particles.density = preset.particleScale;
    for (const area of this.world.areas.values()) for (const { effect } of area.haze) effect.mesh.visible = preset.lightShafts;
    this.settleUntil = this.time + GOVERNOR.settle;
    this.lowFpsTime = 0;
    if (changed && this.environments.size) {
      // How many lights cast shadows, and how soft those shadows are, is
      // built into every shader, so a change of level rebuilds them all.
      // Do it now and all together, including for what is out of sight:
      // left alone, each would stall the game the first time it was needed
      // (the next robot through the door, the next gun bought).
      const standIn = this.useStandInEnvironment();
      void this.warmShaders();
      // Lights changed, so the baked reflections are out of date too.
      this.bakeReflections();
      standIn.dispose();
      this.warmShadows();
    }
    this.onQualityChange(level, automatic);
  }

  get qualityLevel(): QualityLevel {
    return this.quality;
  }

  resize(): void {
    this.renderer.resize(this.container.clientWidth, this.container.clientHeight);
  }

  // ------------------------------------------------------------------ state

  /** Called from a button: capture the mouse, which starts or resumes play. */
  requestPlay(): void {
    this.audio.resume();
    this.input.lock();
  }

  setState(state: GameState): void {
    if (state === this.state) return;
    const from = this.state;
    this.state = state;
    if (state === 'playing') {
      this.audio.resume();
      this.startBeds();
      if (from === 'title' || from === 'over') this.beginRun();
      else if (from === 'saved') this.fightOn();
      // Throw away mouse movement that built up while not playing.
      this.input.consumeLook();
      this.lastFrame = performance.now();
    } else if (state === 'paused') {
      this.audio.suspend();
    } else if (state === 'title') {
      this.audio.resume();
      this.resetWorld();
      this.spawnTitleRobot();
      this.fadeTarget = 1;
    }
    this.onStateChange(state);
  }

  /** Put the map and everything in it back to how a run starts. */
  private resetWorld(): void {
    for (const robot of this.robots) robot.dispose();
    this.robots.length = 0;
    this.gibs.clear();
    this.decals.clear();
    this.casings.clear();
    this.particles.clear();
    this.world.reset();
    this.director.reset();
    this.director.forceEntry = null;
    this.mission.reset();
    this.weapons.reset();
    this.view.show(this.weapons.def.id);
    this.wallet = createWallet(SCRAP.start);
    this.stats = createRunStats();
    this.interactions.prompt = null;
    this.player.spawn(PLAYER_START.x, PLAYER_START.z, PLAYER_START.yaw);
    this.scene.environment = this.environments.get('lobby') ?? this.scene.environment;
  }

  /** Start a fresh run from round 1. */
  private beginRun(): void {
    this.resetWorld();
    this.fade = 0.25;
    this.fadeTarget = 1;
    this.camera.position.set(PLAYER_START.x, 1.64, PLAYER_START.z);
    this.refocus(true);
  }

  /**
   * Start a new run from round 1, from the pause menu or the game-over
   * screen. The run begins the moment the mouse is captured again.
   */
  restart(capture = true): void {
    this.state = 'over';
    if (capture) this.requestPlay();
  }

  /** Leave a finished run for the title screen. */
  toTitle(): void {
    this.setState('title');
  }

  /** The player went down: the run is over. */
  private endRun(): void {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.fadeTarget = 0.32;
    this.audio.play('gameOver');
    for (const action of ['fire', 'aim', 'sprint', 'forward', 'back', 'left', 'right'] as const) this.input.release(action);
    const best = saveBest(this.stats).round;
    this.input.unlock();
    this.onStateChange('over');
    this.onGameOver(this.stats, best);
  }

  /**
   * The kill switch has been pulled and the robots have gone down: let go
   * of the mouse and put the HUMANITY SAVED screen up. The run is not over;
   * the player may fight on from here.
   */
  private showSaved(): void {
    if (this.state !== 'playing') return;
    this.state = 'saved';
    this.stats.missionTime = this.mission.state.savedAt;
    this.stats.missionSkipped = this.mission.skipped;
    this.fadeTarget = 0.8;
    this.audio.play('missionSaved');
    for (const action of ['fire', 'aim', 'sprint', 'forward', 'back', 'left', 'right'] as const) this.input.release(action);
    const best = saveBest(this.stats).mission;
    this.input.unlock();
    this.onStateChange('saved');
    this.onSaved(this.stats, best);
  }

  /**
   * The player chose to fight on after the ending. The robots the switch
   * put out fall to pieces where they lie, and the rounds pick up again
   * with the next one.
   */
  private fightOn(): void {
    this.fadeTarget = 1;
    for (let i = this.robots.length - 1; i >= 0; i--) {
      const robot = this.robots[i]!;
      if (robot.alive) continue;
      this.gibs.burst(robot.model, robot.bones, robot.chest(this.tmpB), this.tmpA.set(0, 0, 0));
      robot.dispose();
      this.robots.splice(i, 1);
    }
    this.mission.resume();
  }

  private startBeds(): void {
    if (this.bedsStarted) return;
    this.bedsStarted = true;
    this.audio.loop('ambienceRoom', 1, 3);
    this.audio.loop('musicBed', 1, 2.4);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
      this.lastFrame = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
  }

  // ------------------------------------------------------------------ frame

  /**
   * Advance and draw one frame. Public so tools can step time exactly.
   * With `draw` false the frame is worked out but not drawn, which lets a
   * tool play whole runs several times faster than they could be watched.
   */
  frame(dt: number, draw = true): void {
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.06;
    const simulate = this.state !== 'paused';
    const step = simulate ? dt : 0;
    this.time += step;

    if (this.state === 'playing') this.updatePlay(step);
    else if (this.state === 'title') this.updateTitle();
    else if (this.state === 'over' || this.state === 'saved') this.view.root.visible = false;

    if (this.debugCamera) {
      const { position, yaw, pitch, fov } = this.debugCamera;
      this.camera.position.copy(position);
      this.camera.rotation.set(pitch, yaw, 0);
      if (fov && fov !== this.camera.fov) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
      // Draw and light whichever area the camera has been parked in.
      if (this.world.track(position.x, position.z)) this.areaChanged();
    }
    this.camera.updateMatrixWorld(true);

    if (simulate) {
      this.world.update(step, this.time);
      this.updateRobots(step);
      // The jammed shutter's torn wiring spits sparks now and then.
      if (this.time > this.nextDrip) {
        this.nextDrip = this.time + rand(1.8, 6);
        if (this.world.areas.get('lobby')!.group.visible) this.effects.drip(this.tmpA.set(rand(1.2, 1.75) * (Math.random() < 0.75 ? 1 : -1), 2.02, ROOM.z0 - 0.28));
      }
      this.gibs.update(step, this.world.colliders);
      this.casings.update(step);
      this.particles.update(step);
      if (this.time >= this.nextFocus) this.refocus();
      this.lights.update(this.time);
      const height = this.renderer.three.domElement.height;
      for (const [id, area] of this.world.areas) {
        if (!area.group.visible) continue;
        for (const { effect, follows } of area.haze) if (follows) effect.setLevel(this.lights.levelOf(follows));
        updateShaftTime(
          area.haze.map((h) => h.effect),
          this.time,
        );
        this.world.dust.get(id)!.update(this.time, height);
      }
    }

    this.audio.setListener(this.camera);
    this.fade = damp(this.fade, this.fadeTarget, 5, dt);
    developScreens(this.renderer.three);
    this.renderer.grade.fade = this.fade;
    this.renderer.grade.damage = this.state === 'title' ? 0 : Math.min(1, this.player.hurt * 1.15);
    if (draw) this.renderer.render(dt, this.time);
    // Drawing is also what works out where every bone of every robot is,
    // which hit tests depend on; without it, do that part by hand.
    else this.scene.updateMatrixWorld();
    this.input.endFrame();
    if (this.state === 'playing') this.governQuality(dt);
  }

  private updatePlay(dt: number): void {
    const { player, weapons, input } = this;
    this.autopilot?.update(dt);
    const look = input.consumeLook();
    const def = weapons.def;
    player.aimFov = def.aimFov;
    player.aimTime = def.aimTime;
    const wantAim = input.isDown('aim') && !weapons.busy;
    this.obstacles.length = 0;
    for (const robot of this.robots) if (robot.alive && robot.grounded) this.obstacles.push(robot.position);
    player.update(dt, this.world.colliders, wantAim, look, this.obstacles);
    this.camera.updateMatrixWorld(true);
    if (!this.debugCamera && this.world.track(player.position.x, player.position.z)) this.areaChanged();

    weapons.update(dt, player);
    this.view.root.visible = !this.hideWeapon;
    this.view.update(dt, player, look, { reload: weapons.reload, swap: weapons.swap, strike: weapons.strike });

    this.interactions.update(input.wasPressed('interact'));
    this.director.update(dt);
    this.mission.update(dt);
    this.stats.time += dt;
  }

  /** The player (or the debug camera) has walked into a different area. */
  private areaChanged(): void {
    this.scene.environment = this.environments.get(this.world.playerArea) ?? this.scene.environment;
    this.refocus();
  }

  /** Start screen: a slow drifting camera with a robot waiting in the doorway. */
  private updateTitle(): void {
    const t = this.time;
    this.view.root.visible = false;
    this.camera.position.set(Math.sin(t * 0.08) * 1.7 + 0.6, 1.72 + Math.sin(t * 0.13) * 0.1, 5.4 + Math.cos(t * 0.06) * 0.5);
    this.camera.rotation.set(-0.02 + Math.sin(t * 0.1) * 0.012, Math.sin(t * 0.08) * 0.12 - 0.03, 0);
    if (Math.abs(this.camera.fov - 60) > 0.01) {
      this.camera.fov = 60;
      this.camera.updateProjectionMatrix();
    }
  }

  // ----------------------------------------------------------------- robots

  /**
   * Remove every robot at once (for tests, screenshots and the debug
   * "skip round" key). The mission is told about any of its own that go
   * this way, so that an elite it still needs is sent in again.
   */
  clearRobots(): void {
    for (const robot of this.robots) {
      robot.dispose();
      if (robot.extra) this.mission.robotLost(robot);
    }
    this.robots.length = 0;
  }

  /** Add a robot to the map. */
  addRobot(x: number, z: number, heading: number, traits?: RobotTraits): Robot {
    const model = traits?.role === 'custodian' ? this.custodianModel : traits?.role === 'proxy' ? this.proxyModel : this.robotModel;
    const robot = new Robot(model, x, z, heading, traits);
    this.robots.push(robot);
    this.scene.add(robot.root);
    return robot;
  }

  /** The robot that stands in the breached doorway behind the title screen. */
  private spawnTitleRobot(): void {
    this.addRobot(0, ROOM.z0 - 1.4, 0).hold = true;
  }

  private updateRobots(dt: number): void {
    const { player, audio } = this;
    const playing = this.state === 'playing';
    const target = this.state === 'title' ? this.tmpA.set(PLAYER_START.x, 0, PLAYER_START.z) : player.position;
    floodFrom(this.world.nav, target.x, target.z);

    this.soundClock.voice -= dt;
    this.soundClock.servo -= dt;
    this.soundClock.step -= dt;

    let lit: Robot | null = null;
    for (let i = this.robots.length - 1; i >= 0; i--) {
      const robot = this.robots[i]!;
      const events = robot.update(dt, target, playing && player.alive, this.world.nav, this.world.colliders, this.robots);
      if (robot.model.lamp && robot.alive && !robot.poweredDown) lit = robot;

      // With a crowd on the map, not every footfall needs a sound.
      if (events.footstep && this.soundClock.step <= 0) {
        this.soundClock.step = 0.06;
        audio.play('robotStep', { position: robot.position });
      }
      if (events.attackStarted) audio.play('robotAttack', { position: robot.chest(this.tmpB) });
      if (events.hitPlayer > 0) this.hurtPlayer(events.hitPlayer, robot);
      if (events.landed) {
        audio.play('robotLand', { position: robot.position });
        this.effects.landing(robot.position);
        player.addShake(Math.max(0, 0.35 - robot.position.distanceTo(player.position) * 0.04));
      }

      if (robot.alive && !robot.hold) {
        if (this.soundClock.voice <= 0) {
          this.soundClock.voice = rand(4, 9);
          audio.play('robotVoice', { position: robot.chest(this.tmpB) });
        } else if (this.soundClock.servo <= 0) {
          this.soundClock.servo = rand(1.2, 3);
          audio.play('robotServo', { position: robot.chest(this.tmpB) });
        }
      }

      if (events.breakApart) {
        const centre = robot.chest(this.tmpB);
        this.gibs.burst(robot.model, robot.bones, centre, robot.killImpulse);
        this.effects.robotDestroyed(centre);
        audio.play('robotDeath', { position: centre });
        player.addShake(Math.max(0, 0.5 - centre.distanceTo(this.camera.position) * 0.05));
        robot.dispose();
        this.robots.splice(i, 1);
      } else if (events.stuck && playing) {
        // Never let a robot stay wedged somewhere: take it off and send it round again.
        robot.dispose();
        this.robots.splice(i, 1);
        if (robot.extra) this.mission.robotLost(robot);
        else this.director.recalled();
      }
    }

    // The lamp that travels with ARGUS's Proxy sits above its head and a
    // little to the player's side of it, so the side the player sees is lit
    // and so is the floor round it. It dies with the robot.
    const lamp = lit && !lit.removed ? lit.model.lamp : null;
    let wanted = 0;
    if (lit && lamp) {
      const chest = lit.chest(this.tmpB);
      const dx = this.camera.position.x - chest.x;
      const dz = this.camera.position.z - chest.z;
      const distance = Math.hypot(dx, dz);
      const reach = Math.min(1.1, distance * 0.4) / Math.max(distance, 0.001);
      this.escort.position.set(chest.x + dx * reach, chest.y + 0.9, chest.z + dz * reach);
      this.escort.color.setHex(lamp.color);
      this.escort.distance = lamp.distance;
      // Up close it is left dark, as it was built; the light comes up with distance.
      const [from, to, share] = lamp.ramp ?? [0, 1, 1];
      const t = Math.min(1, Math.max(0, (distance - from) / (to - from)));
      wanted = lamp.intensity * (share + (1 - share) * t * t * (3 - 2 * t));
    }
    this.escort.intensity = damp(this.escort.intensity, wanted, 5, dt);
    if (this.escort.intensity < 0.02) this.escort.intensity = 0;
  }

  private hurtPlayer(amount: number, robot: Robot): void {
    const { player } = this;
    if (this.godMode || !player.alive || this.state !== 'playing') return;
    if (!player.damage(amount, robot.position.x, robot.position.z)) return;
    this.audio.play('hurt');
    // Bearing of the attacker relative to where the player is looking.
    const dx = robot.position.x - player.position.x;
    const dz = robot.position.z - player.position.z;
    this.onPlayerHurt(Math.atan2(dx, -dz) + player.yaw);
    if (!player.alive) this.endRun();
  }

  /** Robots to point out on the HUD: every one left, once only a few remain. */
  markers(): Marker[] {
    const out: Marker[] = [];
    const remaining = this.director.remaining;
    if (this.state !== 'playing' || this.director.suspended || remaining <= 0 || remaining > ROUNDS.markLast) return out;
    for (const robot of this.robots) {
      // (Only the round's own: robots the mission sent in do not hold a round open.)
      if (!robot.alive || robot.extra) continue;
      const point = robot.chest(this.tmpA);
      const distance = point.distanceTo(this.camera.position);
      point.y += 0.75;
      point.project(this.camera);
      const behind = point.z > 1;
      let x = behind ? -point.x : point.x;
      let y = behind ? -point.y : point.y;
      const onScreen = !behind && Math.abs(x) < 0.94 && Math.abs(y) < 0.9;
      if (!onScreen) {
        // Slide it to the edge of the screen in the robot's direction.
        const scale = 0.9 / Math.max(Math.abs(x), Math.abs(y), 0.001);
        x *= scale;
        y *= scale;
      }
      out.push({ x, y, onScreen, distance });
    }
    return out;
  }

  /** Where the mission's next step is, for the HUD's marker (null if there is nowhere to go). */
  objectiveMarker(): Marker | null {
    if (this.state !== 'playing' || !this.mission.target(this.tmpA)) return null;
    const point = this.tmpA;
    const distance = point.distanceTo(this.camera.position);
    point.project(this.camera);
    const behind = point.z > 1;
    let x = behind ? -point.x : point.x;
    let y = behind ? -point.y : point.y;
    const onScreen = !behind && Math.abs(x) < 0.94 && Math.abs(y) < 0.86;
    if (!onScreen) {
      // Slide it to the edge of the screen in the right direction.
      const scale = 0.86 / Math.max(Math.abs(x), Math.abs(y), 0.001);
      x *= scale;
      y *= scale;
    }
    return { x, y, onScreen, distance };
  }

  /** In automatic mode, step quality down if the frame rate stays low. */
  private governQuality(dt: number): void {
    if (settings.value.quality !== 'auto' || this.time < this.settleUntil || document.hidden) return;
    this.lowFpsTime = this.fps < GOVERNOR.minFps ? this.lowFpsTime + dt : 0;
    if (this.lowFpsTime > GOVERNOR.window) {
      const index = QUALITY_ORDER.indexOf(this.quality);
      if (index > 0) {
        this.setQuality(QUALITY_ORDER[index - 1]!, true);
      } else {
        // Already on the lowest preset: render fewer pixels instead.
        const next = GOVERNOR.resolutionSteps.find((s) => s < this.renderer.resolutionScale);
        if (next) {
          this.renderer.setExtraScale(next);
          this.settleUntil = this.time + GOVERNOR.settle;
        }
      }
      this.lowFpsTime = 0;
    }
  }

  // -------------------------------------------------------------- debugging

  /** Counts used by the performance report and the tests. */
  get counts(): { robots: number; particles: number; gibs: number; aim: number; reticle: number; flash: boolean } {
    return { robots: this.robots.length, particles: this.particles.active, gibs: this.gibs.active, aim: this.player.aim, ...this.view.status };
  }

  /** Debug only: a spark shower and bullet scars, for screenshots. */
  debugScar(point: THREE.Vector3, normal: THREE.Vector3, kind: SurfaceKind): void {
    this.effects.bulletImpact(point, normal, kind);
  }

  /** Debug only: scrap from nowhere. */
  grantScrap(amount: number): void {
    earn(this.wallet, amount);
  }

  /** Debug only: end the round now. */
  skipRound(): void {
    this.clearRobots();
    this.director.skip();
  }
}
