// The game itself: owns the scene and every system, and runs the frame loop.
//
// Stage 0 is a look test: one room, one robot at a time, one rifle. Rounds,
// scrap and the mission arrive in later stages and plug in here.

import * as THREE from 'three';
import { acceleratedRaycast } from 'three-mesh-bvh';
import { AudioEngine } from '../audio/AudioEngine';
import { GOVERNOR, LOOK, LOOKDEV, QUALITY, QUALITY_ORDER, RIFLE, ROBOT, type QualityLevel } from '../config';
import { Assets } from '../core/assets';
import { Input } from '../core/input';
import { damp, rand } from '../core/math';
import { settings } from '../core/settings';
import { Player } from '../entities/Player';
import { Gibs } from '../entities/robot/Gibs';
import { DRUDGE } from '../entities/robot/designs/drudge';
import { Robot } from '../entities/robot/Robot';
import { RobotModel } from '../entities/robot/RobotModel';
import { RifleController, type ShotEvent } from '../entities/weapon/RifleController';
import { RifleView } from '../entities/weapon/RifleView';
import { BulletDecals } from '../fx/BulletDecals';
import { Casings } from '../fx/Casings';
import { Effects } from '../fx/Effects';
import { Particles } from '../fx/Particles';
import { DustMotes, updateShaftTime } from '../render/atmosphere';
import { LightRig } from '../render/lighting';
import { MaterialLibrary, type SurfaceKind } from '../render/materials';
import { bakeReflectionProbe, blankEnvironment } from '../render/reflectionProbe';
import { Renderer } from '../render/Renderer';
import { createNavGrid, floodFrom, type NavGrid } from '../sim/navGrid';
import { damageForZone } from '../sim/robotMind';
import { buildLobby, type Lobby } from '../world/lobby';
import { NAV_BOUNDS, PLAYER_START, ROBOT_SPAWN, ROOM } from '../world/lobby/plan';

// Fast ray tests against the level for bullets.
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export type GameState = 'title' | 'playing' | 'paused';

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(LOOK.fov, 1, 0.01, 140);
  readonly assets = new Assets();
  readonly audio = new AudioEngine();
  readonly renderer: Renderer;
  readonly input: Input;
  readonly player: Player;
  readonly rifle: RifleController;

  state: GameState = 'title';
  onStateChange: (state: GameState) => void = () => {};
  onQualityChange: (level: QualityLevel, automatic: boolean) => void = () => {};
  /** A shot landed on a robot. */
  onHit: (weakPoint: boolean, kill: boolean) => void = () => {};
  /** The player was hurt; `angle` is the attacker's bearing relative to the view. */
  onPlayerHurt: (angle: number) => void = () => {};
  onPlayerDown: () => void = () => {};

  /** Debug only: overrides where the camera sits and looks. */
  debugCamera: { position: THREE.Vector3; yaw: number; pitch: number; fov?: number } | null = null;
  /** Debug only: the player takes no damage. */
  godMode = false;
  /** Debug only: hide the rifle (for photographs of the room). */
  hideWeapon = false;

  private materials!: MaterialLibrary;
  private lobby!: Lobby;
  lights!: LightRig;
  private dust!: DustMotes;
  private nav!: NavGrid;
  private rifleView!: RifleView;
  private robotModel!: RobotModel;
  private gibs!: Gibs;
  private readonly particles = new Particles();
  private readonly decals = new BulletDecals();
  private readonly casings = new Casings();
  private readonly effects = new Effects(this.particles, this.decals);
  readonly robots: Robot[] = [];

  private readonly raycaster = new THREE.Raycaster();
  private quality: QualityLevel = 'high';
  private time = 0;
  private running = false;
  private lastFrame = 0;
  private respawnTimer = 0;
  private fade = 1;
  private fadeTarget = 1;
  private bedsStarted = false;
  private soundClock = { casing: 0, scrap: 0, voice: 4, servo: 2 };
  private nextDrip = 2;

  /** How long each part of start-up took, in milliseconds (for the performance report). */
  readonly loadTimings: Record<string, number> = {};

  /** Smoothed frames per second, for the counter and the quality governor. */
  fps = 60;
  private lowFpsTime = 0;
  private settleUntil = 0;

  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();

  constructor(private readonly container: HTMLElement) {
    this.renderer = new Renderer(this.scene, this.camera, container);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.input = new Input(this.renderer.three.domElement);
    this.player = new Player(this.camera, this.input);
    this.rifle = new RifleController(this.camera, this.input);
    this.raycaster.firstHitOnly = true;

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

    await this.assets.load((data) => this.audio.decode(data), (f) => onProgress(f * 0.92));
    this.audio.attach(this.assets);
    lap('download and decode');

    this.materials = new MaterialLibrary(this.assets);
    this.lobby = buildLobby(this.assets, this.materials);
    this.scene.add(this.lobby.group);
    for (const solid of this.lobby.solids) solid.updateMatrixWorld(true);

    this.scene.fog = new THREE.FogExp2(LOOKDEV.fogColor, LOOKDEV.fogDensity);
    this.scene.background = this.assets.sky;
    this.scene.backgroundIntensity = 0.22;
    this.scene.add(new THREE.HemisphereLight(LOOKDEV.ambientSky, LOOKDEV.ambientGround, LOOKDEV.ambientIntensity));

    this.lights = new LightRig(this.lobby.lights);
    this.scene.add(this.lights.group);

    this.dust = new DustMotes([ROOM.x0, 0.1, ROOM.z0 - 6], [ROOM.x1, ROOM.height - 0.4, ROOM.z1], this.lobby.dustBeams);
    this.scene.add(this.dust.points, this.particles.group, this.decals.group, this.casings.mesh);

    this.nav = createNavGrid(NAV_BOUNDS, 0.3, this.lobby.colliders, ROBOT.radius + 0.06, 0.3, 1.8);

    this.robotModel = new RobotModel(this.assets, DRUDGE);
    this.gibs = new Gibs(this.robotModel);
    this.scene.add(this.gibs.group);

    this.rifleView = new RifleView(this.assets);
    this.camera.add(this.rifleView.root);
    this.scene.add(this.rifleView.muzzleLight);

    this.wireEvents();
    this.player.spawn(PLAYER_START.x, PLAYER_START.z, PLAYER_START.yaw);
    this.spawnRobot(0, ROOM.z0 - 1.4, true);

    this.setQuality(this.pickStartingQuality(), false);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    lap('build world');

    // Compile every shader up front, in the background, so neither the first
    // frame nor the first gunshot or destroyed robot causes a stutter. A
    // blank stand-in environment is in place first: shaders are built
    // differently with and without reflections, and this way they are only
    // ever built once.
    onProgress(0.96);
    this.scene.environment = blankEnvironment(this.renderer.three);
    this.scene.environmentIntensity = 0;
    const hidden = this.revealForCompile();
    // The scene is always drawn into an off-screen HDR buffer (never
    // straight to the screen), and shaders differ between the two, so
    // compile with a buffer of that kind bound.
    const three = this.renderer.three;
    const offscreen = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    three.setRenderTarget(offscreen);
    await three.compileAsync(this.scene, this.camera);
    three.setRenderTarget(null);
    offscreen.dispose();
    for (const object of hidden) object.visible = false;
    lap('compile shaders');

    this.bakeReflections();
    lap('bake reflections');
    this.frame(0);
    lap('first frame');
    onProgress(1);
  }

  private wireEvents(): void {
    const { rifle, player, audio } = this;
    rifle.onShot = (shot) => this.handleShot(shot);
    rifle.onDryFire = () => audio.play('rifleDry');
    rifle.onReloadStage = (stage) => audio.play(stage === 'magOut' ? 'reloadMagOut' : stage === 'magIn' ? 'reloadMagIn' : 'reloadBolt');
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

  /** Re-photograph the room for reflections and bounce light. */
  private bakeReflections(): void {
    const preset = QUALITY[this.quality];
    const hidden = [this.dust.points, this.particles.group, this.gibs.group, this.casings.mesh, this.rifleView.root, ...this.robots.map((r) => r.root)];
    const centre = new THREE.Vector3(0, 1.7, 0.5);
    // Two passes: the first captures direct light only; the second sees the
    // first's bounce light, so shadowed corners pick up a little colour
    // from the lit parts of the room.
    this.scene.environmentIntensity = 0;
    for (let pass = 0; pass < 2; pass++) {
      const previous = this.scene.environment;
      this.scene.environment = bakeReflectionProbe(this.renderer.three, this.scene, centre, preset.reflectionProbeSize, hidden);
      this.scene.environmentIntensity = LOOKDEV.environmentIntensity;
      previous?.dispose();
    }
  }

  private pickStartingQuality(): QualityLevel {
    const chosen = settings.value.quality;
    if (chosen !== 'auto') return chosen;
    // Guess from the graphics chip's name; the governor corrects it in play.
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
    this.dust.setCount(preset.dustMotes);
    this.particles.density = preset.particleScale;
    for (const { effect } of this.lobby.haze) effect.mesh.visible = preset.lightShafts;
    this.settleUntil = this.time + GOVERNOR.settle;
    this.lowFpsTime = 0;
    // Lights changed, so the baked reflections are out of date.
    if (changed && this.scene.environment) this.bakeReflections();
    this.onQualityChange(level, automatic);
  }

  get qualityLevel(): QualityLevel {
    return this.quality;
  }

  resize(): void {
    this.renderer.resize(this.container.clientWidth, this.container.clientHeight);
  }

  // ------------------------------------------------------------------ state

  /** Called from the start button: capture the mouse and begin. */
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
      if (from === 'title') {
        for (const robot of this.robots) robot.hold = false;
        this.audio.play('sting');
      }
      // Throw away mouse movement that built up while not playing.
      this.input.consumeLook();
      this.lastFrame = performance.now();
    } else if (state === 'paused') {
      this.audio.suspend();
    }
    this.onStateChange(state);
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

  /** Advance and draw one frame. Public so tools can step time exactly. */
  frame(dt: number): void {
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.06;
    const simulate = this.state !== 'paused';
    const step = simulate ? dt : 0;
    this.time += step;

    if (this.state === 'playing') this.updatePlay(step);
    else if (this.state === 'title') this.updateTitle(step);

    if (this.debugCamera) {
      const { position, yaw, pitch, fov } = this.debugCamera;
      this.camera.position.copy(position);
      this.camera.rotation.set(pitch, yaw, 0);
      if (fov && fov !== this.camera.fov) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    }
    this.camera.updateMatrixWorld(true);

    if (simulate) {
      this.updateRobots(step);
      // The jammed shutter's torn wiring spits sparks now and then.
      if (this.time > this.nextDrip) {
        this.nextDrip = this.time + rand(1.8, 6);
        this.effects.drip(this.tmpA.set(rand(1.2, 1.75) * (Math.random() < 0.75 ? 1 : -1), 2.02, ROOM.z0 - 0.28));
      }
      this.gibs.update(step, this.lobby.colliders);
      this.casings.update(step);
      this.particles.update(step);
      this.lights.update(this.time);
      this.lobby.screens.update(this.time);
      for (const { effect, follows } of this.lobby.haze) {
        if (follows) effect.setLevel(this.lights.levelOf(follows));
      }
      updateShaftTime(
        this.lobby.haze.map((h) => h.effect),
        this.time,
      );
      this.dust.update(this.time, this.renderer.three.domElement.height);
    }

    this.audio.setListener(this.camera);
    this.fade = damp(this.fade, this.fadeTarget, 5, dt);
    this.renderer.grade.fade = this.fade;
    this.renderer.grade.damage = this.state === 'title' ? 0 : Math.min(1, this.player.hurt * 1.15);
    this.renderer.render(dt, this.time);
    this.input.endFrame();
    if (this.state === 'playing') this.governQuality(dt);
  }

  private updatePlay(dt: number): void {
    const { player, rifle, input } = this;
    const look = input.consumeLook();
    const wantAim = input.isDown('aim') && !rifle.reloading;
    player.update(dt, this.lobby.colliders, wantAim, look);
    this.camera.updateMatrixWorld(true);
    rifle.update(dt, player);
    this.rifleView.root.visible = !this.hideWeapon;
    this.rifleView.update(dt, player, look, rifle.reload);

    // Stage 0: keep one robot coming. The next is sent in a few seconds
    // after the last one has finished breaking apart.
    if (this.robots.length === 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.spawnRobot(ROBOT_SPAWN.x + rand(-1.2, 1.2), ROBOT_SPAWN.z, false);
        this.respawnTimer = ROBOT.respawnDelay;
      }
    }
  }

  /** Start screen: a slow drifting camera with a robot waiting in the doorway. */
  private updateTitle(dt: number): void {
    void dt;
    const t = this.time;
    this.rifleView.root.visible = false;
    this.camera.position.set(Math.sin(t * 0.08) * 1.7 + 0.6, 1.72 + Math.sin(t * 0.13) * 0.1, 5.4 + Math.cos(t * 0.06) * 0.5);
    this.camera.rotation.set(-0.02 + Math.sin(t * 0.1) * 0.012, Math.sin(t * 0.08) * 0.12 - 0.03, 0);
    if (Math.abs(this.camera.fov - 60) > 0.01) {
      this.camera.fov = 60;
      this.camera.updateProjectionMatrix();
    }
  }

  // ----------------------------------------------------------------- robots

  /** Remove every robot at once (for tests and screenshots). The next one is sent after the usual delay. */
  clearRobots(): void {
    for (const robot of this.robots) robot.dispose();
    this.robots.length = 0;
    this.respawnTimer = ROBOT.respawnDelay;
  }

  spawnRobot(x: number, z: number, hold: boolean): Robot {
    const robot = new Robot(this.robotModel, x, z, 0);
    robot.hold = hold;
    this.robots.push(robot);
    this.scene.add(robot.root);
    return robot;
  }

  private updateRobots(dt: number): void {
    const { player, audio } = this;
    const target = this.state === 'title' ? this.tmpA.set(PLAYER_START.x, 0, PLAYER_START.z) : player.position;
    floodFrom(this.nav, target.x, target.z);

    this.soundClock.voice -= dt;
    this.soundClock.servo -= dt;

    for (let i = this.robots.length - 1; i >= 0; i--) {
      const robot = this.robots[i]!;
      const events = robot.update(dt, target, this.state === 'playing' && player.alive, this.nav, this.lobby.colliders);

      if (events.footstep) audio.play('robotStep', { position: robot.position });
      if (events.attackStarted) audio.play('robotAttack', { position: robot.chest(this.tmpB) });
      if (events.hitPlayer > 0) this.hurtPlayer(events.hitPlayer, robot);

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
        this.gibs.burst(robot.bones, centre, robot.killImpulse);
        this.effects.robotDestroyed(centre);
        audio.play('robotDeath', { position: centre });
        const distance = centre.distanceTo(this.camera.position);
        player.addShake(Math.max(0, 0.5 - distance * 0.05));
        robot.dispose();
        this.robots.splice(i, 1);
        this.respawnTimer = ROBOT.respawnDelay;
      }
    }
  }

  private hurtPlayer(amount: number, robot: Robot): void {
    const { player } = this;
    if (this.godMode || !player.alive) return;
    player.damage(amount, robot.position.x, robot.position.z);
    this.audio.play('hurt');
    // Bearing of the attacker relative to where the player is looking.
    const dx = robot.position.x - player.position.x;
    const dz = robot.position.z - player.position.z;
    this.onPlayerHurt(Math.atan2(dx, -dz) + player.yaw);
    if (!player.alive) this.playerDown();
  }

  /** Stage 0 has no game-over screen yet: fade out and reset the test. */
  private playerDown(): void {
    this.fadeTarget = 0;
    this.onPlayerDown();
    window.setTimeout(() => {
      for (const robot of this.robots) robot.dispose();
      this.robots.length = 0;
      this.gibs.clear();
      this.player.spawn(PLAYER_START.x, PLAYER_START.z, PLAYER_START.yaw);
      this.respawnTimer = ROBOT.respawnDelay;
      this.fadeTarget = 1;
    }, 1100);
  }

  // --------------------------------------------------------------- shooting

  private handleShot(shot: ShotEvent): void {
    const { player, audio, effects } = this;
    const { origin, direction } = shot;

    // What does the bullet hit first: the level, or a robot?
    this.raycaster.set(origin, direction);
    this.raycaster.far = RIFLE.range;
    const worldHit = this.raycaster.intersectObjects(this.lobby.solids, false)[0];
    let limit = worldHit ? worldHit.distance : RIFLE.range;

    let struck: Robot | null = null;
    let zone: 'head' | 'torso' | 'limb' = 'torso';
    const point = this.tmpA;
    for (const robot of this.robots) {
      const hit = robot.hitTest(origin, direction, limit);
      if (hit) {
        limit = hit.distance;
        struck = robot;
        zone = hit.zone;
        point.copy(hit.point);
      }
    }

    const end = this.tmpC.copy(origin).addScaledVector(direction, limit);
    if (struck) {
      const weak = zone === 'head';
      const result = struck.damage(damageForZone(RIFLE, zone), direction);
      effects.robotHit(point, direction, weak);
      audio.play(weak ? 'robotHitWeak' : 'robotHit', { position: point });
      audio.play(result.killed ? 'killTick' : 'hitTick');
      this.onHit(weak, result.killed);
    } else if (worldHit) {
      const normal = this.tmpB.copy(worldHit.face!.normal);
      if (normal.dot(direction) > 0) normal.negate();
      const kind = (worldHit.object.userData.kind as SurfaceKind) ?? 'concrete';
      effects.bulletImpact(worldHit.point, normal, kind);
      audio.play(kind === 'metal' ? 'impactMetal' : kind === 'concrete' ? 'impactConcrete' : 'impactSoft', { position: worldHit.point });
    }

    // Everything the shooter sees and feels.
    const muzzle = this.rifleView.muzzleWorld();
    effects.tracer(muzzle, end);
    effects.muzzleSmoke(muzzle, direction);
    this.rifleView.kick(player.aim);
    player.addRecoil(RIFLE.recoilPitch + (RIFLE.recoilPitchAim - RIFLE.recoilPitch) * player.aim, rand(-RIFLE.recoilYaw, RIFLE.recoilYaw));
    player.addShake(RIFLE.shake * (1 - player.aim * 0.35));
    audio.play('rifleShot');
    audio.thump(0.9);

    // Spent casing out to the right.
    const right = this.tmpB.setFromMatrixColumn(this.camera.matrixWorld, 0);
    const velocity = new THREE.Vector3()
      .copy(right)
      .multiplyScalar(RIFLE.casingSpeed * rand(0.8, 1.2))
      .addScaledVector(direction, -0.4)
      .add(player.velocity);
    velocity.y += rand(1.4, 2.2);
    this.casings.eject(this.rifleView.ejectionPortWorld(), velocity);
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

  /** Counts used by the performance report. */
  get counts(): { robots: number; particles: number; gibs: number; aim: number; reticle: number; flash: boolean } {
    return { robots: this.robots.length, particles: this.particles.active, gibs: this.gibs.active, aim: this.player.aim, ...this.rifleView.status };
  }

  /** Debug only: a spark shower and bullet scars, for screenshots. */
  debugScar(point: THREE.Vector3, normal: THREE.Vector3, kind: SurfaceKind): void {
    this.effects.bulletImpact(point, normal, kind);
  }
}
