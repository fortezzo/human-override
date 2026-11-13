// The rifle as the player sees it: held at the hip or raised to the eye,
// swaying with movement, kicking when fired and dropping out of view to
// reload. Purely visual; the rules live in sim/weapon.ts.
//
// Two tricks keep it looking right:
//
// 1. The model is drawn at a quarter of its real size, a quarter of the
//    distance from the camera. On screen that looks identical, but it keeps
//    the gun inside the player's own collision radius so it can never poke
//    through a wall.
// 2. It is drawn through its own, narrower lens (field of view). The world
//    uses a wide lens, which would stretch anything this close to the eye;
//    a separate lens is how shooters keep the gun's proportions natural.

import * as THREE from 'three';
import { FX, RIFLE } from '../../config';
import type { Assets } from '../../core/assets';
import { clamp, damp, lerp, rand, smoothstep } from '../../core/math';
import { settings } from '../../core/settings';
import type { Player } from '../Player';

const SCALE = 0.25;
/** The gun's own lens, in degrees (the world camera is wider). */
const VIEW_FOV = 48;
/** While aiming, the gun fades to shadow between these distances from the eye (real metres). */
const SHADE_FROM = 0.1 * SCALE;
const SHADE_TO = 0.3 * SCALE;

/** Where the gun sits relative to the eye, in real metres (before SCALE). */
const HIP = { x: 0.2, y: -0.25, z: -0.7, yaw: 0.075, pitch: 0.02, roll: 0 };
const AIM = { x: 0, y: -0.1735, z: -0.23, yaw: 0, pitch: 0.004, roll: 0 };
const SPRINT = { x: 0.12, y: -0.27, z: -0.5, yaw: 0.6, pitch: -0.14, roll: 0.14 };

/** Points on the rifle model, in its own coordinates. */
const MUZZLE = new THREE.Vector3(0, 0.094, -0.475);
const EJECTION_PORT = new THREE.Vector3(0.03, 0.1, 0.0);

/** Piecewise curve through [time, value] pairs with eased segments. */
function track(keys: Array<[number, number]>, t: number): number {
  if (t <= keys[0]![0]) return keys[0]![1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]!;
    if (t <= t1) {
      const [t0, v0] = keys[i - 1]!;
      return lerp(v0, v1, smoothstep(0, 1, (t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1]![1];
}

// Reload motion: tip the gun over and drop it, two tugs for the magazine
// change, bring it back up, then a sharp rack of the bolt.
const RELOAD_DROP: Array<[number, number]> = [
  [0, 0],
  [0.14, 0.11],
  [0.26, 0.2],
  [0.32, 0.17],
  [0.55, 0.2],
  [0.62, 0.15],
  [0.74, 0.05],
  [0.84, 0.02],
  [1, 0],
];
const RELOAD_ROLL: Array<[number, number]> = [
  [0, 0],
  [0.14, 0.55],
  [0.62, 0.62],
  [0.76, 0.18],
  [0.84, -0.12],
  [0.9, 0.05],
  [1, 0],
];
const RELOAD_PITCH: Array<[number, number]> = [
  [0, 0],
  [0.14, 0.3],
  [0.26, 0.38],
  [0.3, 0.3],
  [0.58, 0.36],
  [0.62, 0.26],
  [0.76, 0.06],
  [1, 0],
];
const RELOAD_BACK: Array<[number, number]> = [
  [0, 0],
  [0.8, 0],
  [0.85, 0.05],
  [0.91, -0.012],
  [1, 0],
];

/**
 * Make a material draw through the gun's lens instead of the world camera's.
 * With `shade`, the part of the gun nearest the eye also fades to shadow
 * while aiming, the way the rear of a shouldered rifle sits dark and out of
 * focus under your eye instead of filling the view.
 */
function useViewLens(material: THREE.Material, lens: { value: THREE.Matrix4 }, shade?: { value: number }): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uViewLens = lens;
    const header = 'uniform mat4 uViewLens;\n';
    const project = '#include <project_vertex>\ngl_Position = uViewLens * mvPosition;';
    shader.vertexShader = header + shader.vertexShader.replace('#include <project_vertex>', project);
    if (shade) {
      shader.uniforms.uAimShade = shade;
      const fade = `smoothstep(${SHADE_FROM.toFixed(4)}, ${SHADE_TO.toFixed(4)}, vViewPosition.z)`;
      const darken = `gl_FragColor.rgb *= mix(1.0, 0.06 + 0.94 * ${fade}, uAimShade);\n#include <dithering_fragment>`;
      shader.fragmentShader = 'uniform float uAimShade;\n' + shader.fragmentShader.replace('#include <dithering_fragment>', darken);
    }
  };
  material.customProgramCacheKey = () => (shade ? 'view-lens-shaded' : 'view-lens');
}

function flashTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const c = size / 2;
  g.translate(c, c);
  // Spiky star of hot gas.
  g.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 7; i++) {
    g.rotate((Math.PI * 2) / 7 + 0.3);
    g.beginPath();
    g.moveTo(-size * 0.045, 0);
    g.lineTo(0, -size * (0.3 + (i % 3) * 0.08));
    g.lineTo(size * 0.045, 0);
    g.fill();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const glow = g.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export class RifleView {
  /** Attach this to the camera. */
  readonly root = new THREE.Group();
  private readonly gun = new THREE.Group();
  private readonly flash = new THREE.Group();
  private readonly flashMaterial: THREE.MeshBasicMaterial;
  /** Lights the room for an instant on every shot. Add to the scene. */
  readonly muzzleLight = new THREE.PointLight(0xffb060, 0, 14, 2);

  private flashTimer = 0;
  // Recoil spring state.
  private kickBack = 0;
  private kickUp = 0;
  private kickTilt = 0;
  private kickRoll = 0;
  // Smoothed sway from turning the view.
  private swayYaw = 0;
  private swayPitch = 0;
  private sprintBlend = 0;
  private time = 0;

  private readonly lens = { value: new THREE.Matrix4() };
  private readonly aimShade = { value: 0 };
  private readonly toView = new THREE.Matrix4();
  private readonly worldMuzzle = new THREE.Vector3();
  private readonly worldPort = new THREE.Vector3();

  constructor(assets: Assets) {
    const model = assets.model('rifle').scene.clone(true);
    model.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.envMapIntensity = 1.35;
      useViewLens(material, this.lens, this.aimShade);
    });
    this.gun.add(model);

    // Muzzle flash: two crossed cards and one facing the shooter.
    this.flashMaterial = new THREE.MeshBasicMaterial({
      map: flashTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    this.flashMaterial.color.setRGB(7, 4.2, 1.6);
    useViewLens(this.flashMaterial, this.lens);
    const card = new THREE.PlaneGeometry(1, 1);
    const facing = new THREE.Mesh(card, this.flashMaterial);
    const sideA = new THREE.Mesh(card, this.flashMaterial);
    sideA.rotation.y = Math.PI / 2;
    sideA.position.z = -0.35;
    sideA.scale.set(1.5, 0.75, 1);
    const sideB = sideA.clone();
    sideB.rotation.x = Math.PI / 2;
    this.flash.add(facing, sideA, sideB);
    this.flash.position.copy(MUZZLE);
    this.flash.visible = false;
    this.gun.add(this.flash);

    this.root.add(this.gun);
    this.root.scale.setScalar(SCALE);
    this.root.name = 'rifle-view';
  }

  /** Call when a shot is fired. */
  kick(aim: number): void {
    const calm = 1 - aim * 0.45;
    this.kickBack += RIFLE.kickBack * calm;
    this.kickUp += RIFLE.kickUp * calm;
    this.kickTilt += RIFLE.kickTilt * calm;
    this.kickRoll += rand(-0.03, 0.03);
    this.flashTimer = FX.muzzleFlashTime;
    this.flash.rotation.z = rand(0, Math.PI * 2);
    const size = rand(0.16, 0.25) * (1 - aim * 0.35) * (settings.value.reducedMotion ? 0.6 : 1);
    this.flash.scale.setScalar(size);
    this.flash.visible = true;
    this.muzzleLight.intensity = FX.muzzleLightIntensity * (settings.value.reducedMotion ? 0.5 : 1);
  }

  /**
   * @param look mouse movement this frame, in pixels (for sway)
   * @param reload 0..1 through the reload, 0 when not reloading
   */
  update(dt: number, player: Player, look: { x: number; y: number }, reload: number): void {
    this.time += dt;
    const aim = player.aim;

    // Keep the gun's lens matched to the window shape and depth range.
    const camera = this.root.parent as THREE.PerspectiveCamera;
    const top = camera.near * Math.tan(THREE.MathUtils.degToRad(VIEW_FOV) / 2);
    const right = top * camera.aspect;
    this.lens.value.makePerspective(-right, right, top, -top, camera.near, camera.far, camera.coordinateSystem);
    this.aimShade.value = aim * (1 - Math.min(1, reload * 8));

    // Recoil eases back to rest.
    this.kickBack = damp(this.kickBack, 0, RIFLE.kickRecovery, dt);
    this.kickUp = damp(this.kickUp, 0, RIFLE.kickRecovery, dt);
    this.kickTilt = damp(this.kickTilt, 0, RIFLE.kickRecovery, dt);
    this.kickRoll = damp(this.kickRoll, 0, RIFLE.kickRecovery, dt);

    // The gun lags a little behind quick turns.
    const lag = 1 - aim * 0.75;
    this.swayYaw = damp(this.swayYaw, clamp(look.x * 0.0011, -0.07, 0.07) * lag, 9, dt);
    this.swayPitch = damp(this.swayPitch, clamp(look.y * 0.0011, -0.05, 0.05) * lag, 9, dt);

    this.sprintBlend = damp(this.sprintBlend, player.sprinting && reload === 0 ? 1 : 0, 9, dt);

    // Blend hip -> aim -> sprint poses.
    const s = this.sprintBlend;
    const pose = (key: keyof typeof HIP) => lerp(lerp(HIP[key], AIM[key], aim), SPRINT[key], s);

    // Walking bob and idle breathing.
    const bob = Math.min(player.speedFraction, 1.5) * (player.onGround ? 1 : 0.3) * (1 - aim * 0.85);
    const bobX = Math.cos(player.bobPhase) * 0.011 * bob;
    const bobY = -Math.abs(Math.sin(player.bobPhase)) * 0.012 * bob;
    const breathe = Math.sin(this.time * 1.5) * 0.0025 * (1 - aim * 0.6);

    const drop = track(RELOAD_DROP, reload);
    const gun = this.gun;
    gun.position.set(pose('x') + bobX + this.swayYaw * 0.25, pose('y') + bobY + breathe + this.kickUp - drop + this.swayPitch * 0.2, pose('z') + this.kickBack + track(RELOAD_BACK, reload));
    gun.rotation.set(
      pose('pitch') + this.kickTilt + track(RELOAD_PITCH, reload) + this.swayPitch,
      pose('yaw') + this.swayYaw + track(RELOAD_ROLL, reload) * 0.35,
      pose('roll') + this.kickRoll - this.swayYaw * 0.6 + track(RELOAD_ROLL, reload),
    );

    // Flash and its light last only a frame or two.
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.visible = false;
    }
    this.muzzleLight.intensity = damp(this.muzzleLight.intensity, 0, 38, dt);
    if (this.muzzleLight.intensity < 0.05) this.muzzleLight.intensity = 0;
    this.gun.updateWorldMatrix(true, false);
    this.muzzleLight.position.copy(this.muzzleWorld());
  }

  /**
   * Where the end of the barrel appears to be in the world. Because the
   * model is drawn small and close, the true point is scaled back out from
   * the camera so tracers, smoke and casings line up with what you see.
   */
  muzzleWorld(): THREE.Vector3 {
    return this.apparent(this.worldMuzzle.copy(MUZZLE));
  }

  /** Where spent casings appear to leave the gun. */
  ejectionPortWorld(): THREE.Vector3 {
    return this.apparent(this.worldPort.copy(EJECTION_PORT));
  }

  private apparent(local: THREE.Vector3): THREE.Vector3 {
    const camera = this.root.parent as THREE.PerspectiveCamera;
    // Into the camera's frame, at its true (tiny, close) position.
    this.gun.localToWorld(local).applyMatrix4(this.toView.copy(camera.matrixWorld).invert());
    // The same spot on screen, at the distance it appears to be, seen
    // through the world camera's wider lens.
    const depth = -local.z / SCALE;
    const widen = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.tan(THREE.MathUtils.degToRad(VIEW_FOV) / 2);
    local.set((local.x / -local.z) * depth * widen, (local.y / -local.z) * depth * widen, -depth);
    return local.applyMatrix4(camera.matrixWorld);
  }
}
