// The game itself: owns the scene and every system, and runs the frame loop.
//
// Stage 0 is a look test: one room, one robot, one rifle.

import * as THREE from 'three';
import { GOVERNOR, LOOK, LOOKDEV, QUALITY, QUALITY_ORDER, type QualityLevel } from '../config';
import { Assets } from '../core/assets';
import { settings } from '../core/settings';
import { DustMotes, updateShaftTime } from '../render/atmosphere';
import { LightRig } from '../render/lighting';
import { MaterialLibrary } from '../render/materials';
import { bakeReflectionProbe } from '../render/reflectionProbe';
import { Renderer } from '../render/Renderer';
import { buildLobby, type Lobby } from '../world/lobby';
import { PLAYER_START, ROOM } from '../world/lobby/plan';

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(LOOK.fov, 1, 0.03, 120);
  readonly assets = new Assets();
  readonly renderer: Renderer;

  private materials!: MaterialLibrary;
  private lobby!: Lobby;
  private lights!: LightRig;
  private dust!: DustMotes;

  private quality: QualityLevel = 'high';
  private time = 0;
  private running = false;
  private lastFrame = 0;

  /** Smoothed frames per second, for the counter and the quality governor. */
  fps = 60;
  private lowFpsTime = 0;
  private settleUntil = 0;
  onQualityChange: (level: QualityLevel, automatic: boolean) => void = () => {};

  /** Debug only: when set, overrides where the camera sits and looks. */
  debugCamera: { position: THREE.Vector3; yaw: number; pitch: number; fov?: number } | null = null;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new Renderer(this.scene, this.camera, container);
    this.camera.rotation.order = 'YXZ';
  }

  /** Download assets and build the world. `onProgress` gets 0..1. */
  async load(onProgress: (fraction: number) => void): Promise<void> {
    const audio = new AudioContext();
    await this.assets.load((data) => audio.decodeAudioData(data), (f) => onProgress(f * 0.9));

    this.materials = new MaterialLibrary(this.assets);
    this.lobby = buildLobby(this.assets, this.materials);
    this.scene.add(this.lobby.group);

    this.scene.fog = new THREE.FogExp2(LOOKDEV.fogColor, LOOKDEV.fogDensity);
    this.scene.background = this.assets.sky;
    this.scene.backgroundIntensity = 0.22;
    this.scene.add(new THREE.HemisphereLight(LOOKDEV.ambientSky, LOOKDEV.ambientGround, LOOKDEV.ambientIntensity));

    this.lights = new LightRig(this.lobby.lights);
    this.scene.add(this.lights.group);

    this.dust = new DustMotes([ROOM.x0, 0.1, ROOM.z0 - 6], [ROOM.x1, ROOM.height - 0.4, ROOM.z1], this.lobby.dustBeams);
    this.scene.add(this.dust.points);

    this.camera.position.set(PLAYER_START.x, 1.64, PLAYER_START.z);
    this.camera.rotation.set(0, PLAYER_START.yaw, 0);

    this.setQuality(this.pickStartingQuality(), false);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Compile every shader up front so the first seconds of play are smooth.
    await this.renderer.three.compileAsync(this.scene, this.camera);
    this.bakeReflections();
    onProgress(1);
  }

  /** Re-photograph the room for reflections and bounce light. */
  private bakeReflections(): void {
    const preset = QUALITY[this.quality];
    this.scene.environment = null;
    const centre = new THREE.Vector3(0, 1.7, 0.5);
    // Two passes: the second sees the first's bounce light, so shadowed
    // corners pick up a little colour from the lit parts of the room.
    for (let pass = 0; pass < 2; pass++) {
      const previous = this.scene.environment;
      this.scene.environment = bakeReflectionProbe(this.renderer.three, this.scene, centre, preset.reflectionProbeSize, [this.dust.points]);
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
    this.quality = level;
    const preset = QUALITY[level];
    this.renderer.applyQuality(preset);
    this.materials.setAnisotropy(Math.min(preset.anisotropy, this.renderer.maxAnisotropy));
    this.lights.applyQuality(preset);
    this.dust.setCount(preset.dustMotes);
    for (const { effect } of this.lobby.haze) effect.mesh.visible = preset.lightShafts;
    this.settleUntil = this.time + GOVERNOR.settle;
    this.lowFpsTime = 0;
    this.onQualityChange(level, automatic);
  }

  get qualityLevel(): QualityLevel {
    return this.quality;
  }

  resize(): void {
    this.renderer.resize(this.container.clientWidth, this.container.clientHeight);
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

  /** Advance and draw one frame. Public so tools can step time exactly. */
  frame(dt: number): void {
    this.time += dt;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.08;

    if (this.debugCamera) {
      const { position, yaw, pitch, fov } = this.debugCamera;
      this.camera.position.copy(position);
      this.camera.rotation.set(pitch, yaw, 0);
      if (fov && fov !== this.camera.fov) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    }

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

    this.renderer.render(dt, this.time);
    this.governQuality(dt);
  }

  /** In automatic mode, step quality down if the frame rate stays low. */
  private governQuality(dt: number): void {
    if (settings.value.quality !== 'auto' || this.time < this.settleUntil || document.hidden) return;
    this.lowFpsTime = this.fps < GOVERNOR.minFps ? this.lowFpsTime + dt : 0;
    if (this.lowFpsTime > GOVERNOR.window) {
      const index = QUALITY_ORDER.indexOf(this.quality);
      if (index > 0) this.setQuality(QUALITY_ORDER[index - 1]!, true);
      this.lowFpsTime = 0;
    }
  }
}
