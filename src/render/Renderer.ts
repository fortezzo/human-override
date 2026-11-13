// Owns the WebGL renderer and the post-processing chain:
//
//   scene (HDR) -> ambient occlusion -> chromatic aberration + bloom + grade
//               -> anti-aliasing -> screen
//
// Which of those steps run, and at what resolution, comes from the quality
// preset, so the same scene scales from integrated graphics to a gaming GPU.

import * as THREE from 'three';
import {
  BloomEffect,
  ChromaticAberrationEffect,
  EdgeDetectionMode,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  type Effect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { LOOKDEV, type QualityPreset } from '../config';
import { GradeEffect } from './post/GradeEffect';

export class Renderer {
  readonly three: THREE.WebGLRenderer;
  readonly grade = new GradeEffect();
  private composer!: EffectComposer;
  private preset!: QualityPreset;
  private width = 1;
  private height = 1;
  /** Extra resolution reduction applied on top of the preset (1 = none). */
  private extraScale = 1;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    container: HTMLElement,
  ) {
    this.three = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: false,
      stencil: false,
      depth: false,
      alpha: false,
    });
    this.three.outputColorSpace = THREE.SRGBColorSpace;
    this.three.toneMapping = THREE.NoToneMapping; // handled by GradeEffect
    this.three.shadowMap.enabled = true;
    this.three.shadowMap.type = THREE.PCFShadowMap;
    this.three.info.autoReset = false;
    this.three.domElement.id = 'game-canvas';
    container.appendChild(this.three.domElement);
  }

  /** The GPU's name, used to guess a starting quality level. */
  get gpuName(): string {
    const gl = this.three.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  }

  get maxAnisotropy(): number {
    return this.three.capabilities.getMaxAnisotropy();
  }

  /** (Re)build the post-processing chain for a quality preset. */
  applyQuality(preset: QualityPreset): void {
    this.preset = preset;
    this.composer?.dispose();

    const composer = new EffectComposer(this.three, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    composer.addPass(new RenderPass(this.scene, this.camera));

    if (preset.ambientOcclusion !== 'off') {
      const ao = new N8AOPostPass(this.scene, this.camera, this.width, this.height);
      ao.configuration.aoRadius = LOOKDEV.aoRadius;
      ao.configuration.distanceFalloff = LOOKDEV.aoFalloff;
      ao.configuration.intensity = LOOKDEV.aoIntensity;
      ao.configuration.halfRes = preset.ambientOcclusion === 'half';
      ao.configuration.depthAwareUpsampling = true;
      ao.configuration.gammaCorrection = false;
      ao.setQualityMode(preset.aoQuality);
      composer.addPass(ao);
    }

    const effects: Effect[] = [];
    if (preset.chromaticAberration > 0) {
      effects.push(
        new ChromaticAberrationEffect({
          offset: new THREE.Vector2(preset.chromaticAberration, preset.chromaticAberration),
          radialModulation: true,
          modulationOffset: 0.28,
        }),
      );
    }
    if (preset.bloom) {
      effects.push(
        new BloomEffect({
          mipmapBlur: true,
          luminanceThreshold: LOOKDEV.bloomThreshold,
          luminanceSmoothing: 0.22,
          intensity: LOOKDEV.bloomIntensity,
          radius: LOOKDEV.bloomRadius,
          levels: 7,
        }),
      );
    }
    this.grade.grain = preset.filmGrain;
    // Ambient occlusion darkens creases and corners. Without it the same
    // room comes out a touch brighter, so the exposure is trimmed to match:
    // the picture should be equally bright whatever the quality level.
    this.grade.exposure = LOOKDEV.exposure * (preset.ambientOcclusion === 'off' ? LOOKDEV.exposureWithoutAo : 1);
    effects.push(this.grade);
    composer.addPass(new EffectPass(this.camera, ...effects));

    if (preset.antialias !== 'off') {
      composer.addPass(
        new EffectPass(
          this.camera,
          new SMAAEffect({
            preset: preset.antialias === 'smaa-high' ? SMAAPreset.HIGH : SMAAPreset.LOW,
            edgeDetectionMode: EdgeDetectionMode.COLOR,
          }),
        ),
      );
    }

    this.composer = composer;
    this.resize(this.width, this.height);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const ratio = Math.min(window.devicePixelRatio || 1, this.preset?.pixelRatioCap ?? 1) * (this.preset?.renderScale ?? 1) * this.extraScale;
    this.three.setPixelRatio(ratio);
    this.three.setSize(this.width, this.height);
    this.composer?.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  /** The player's brightness setting (1 = as designed). */
  set brightness(value: number) {
    this.grade.brightness = value;
  }

  /** Render fewer pixels (the browser stretches them to fit) to gain speed. */
  setExtraScale(scale: number): void {
    if (scale === this.extraScale) return;
    this.extraScale = scale;
    this.resize(this.width, this.height);
  }

  get resolutionScale(): number {
    return this.extraScale;
  }

  render(dt: number, time: number): void {
    this.three.info.reset();
    this.grade.time = time;
    this.composer.render(dt);
  }

  /** Draw calls and triangles in the last frame (all passes included). */
  get stats(): { calls: number; triangles: number } {
    return { calls: this.three.info.render.calls, triangles: this.three.info.render.triangles };
  }
}
