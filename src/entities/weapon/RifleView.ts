// The rifle as the player sees it: held at the hip or raised to the eye,
// swaying with movement, kicking when fired and dropping out of view to
// reload. Purely visual; the rules live in sim/weapon.ts.
//
// Three tricks keep it looking right:
//
// 1. The model is drawn at a quarter of its real size, a quarter of the
//    distance from the camera. On screen that looks identical, but it keeps
//    the gun inside the player's own collision radius so it can never poke
//    through a wall.
// 2. It is drawn through its own, narrower lens (field of view). The world
//    uses a wide lens, which would stretch anything this close to the eye;
//    a separate lens is how shooters keep the gun's proportions natural.
// 3. It carries its own soft light. The room is dark on purpose, and a gun
//    lit only by the room turns into a black shape in front of the player,
//    so a small fill light travels with it. Raised to the eye, the gun is
//    also shaded from the room's lamps, as it would be by the shooter's own
//    head and shoulders, so it stays darker than whatever is being aimed at.

import * as THREE from 'three';
import { FX, RIFLE } from '../../config';
import type { Assets } from '../../core/assets';
import { clamp, damp, lerp, rand, smoothstep } from '../../core/math';
import { settings } from '../../core/settings';
import type { Player } from '../Player';
import { MuzzleFlash } from './MuzzleFlash';
import { ReflexSight, SIGHT_HEIGHT } from './ReflexSight';

const SCALE = 0.25;
/** The gun's own lens, in degrees (the world camera is wider). */
const VIEW_FOV = 48;
/** Strength of the gun's own fill light at the hip and when aiming. */
const FILL_HIP = 1.6;
const FILL_AIM = 1.9;
/** The rifle's paint is close to black; this lifts it to a dark gunmetal that can hold light. */
const PAINT_LIFT = 1.9;

/** Where the gun sits relative to the eye, in real metres (before SCALE). */
const HIP = { x: 0.2, y: -0.25, z: -0.7, yaw: 0.075, pitch: 0.02, roll: 0 };
// Aiming puts the eye exactly on the sight's line, a hand's width behind it.
const AIM = { x: 0, y: -SIGHT_HEIGHT, z: -0.23, yaw: 0, pitch: 0, roll: 0 };
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

/** Uniforms shared by every lit part of the gun. */
interface GunLight {
  /** Strength of the gun's own fill light. */
  fill: { value: number };
  /** 0 at the hip, 1 with the rifle raised to the eye. */
  raised: { value: number };
}

/**
 * How the gun is lit, on top of the room's own lamps. Worked out in the
 * shader so that it touches nothing else in the room.
 *
 * 1. Its own shadow. Raised to the eye, the back half of a rifle sits in
 *    the shade of the shooter's head and shoulders, which are between it
 *    and every lamp. Without this, a lamp behind the player glares off the
 *    top of the gun and the sight, and the eye goes there instead of to
 *    the target.
 * 2. Its own fill light, which only tops up what is left dark: a soft lamp
 *    above and a little behind the left shoulder, and a pale glow overhead
 *    that flat surfaces mirror when seen at a shallow angle (which is what
 *    makes dark metal look like metal instead of a hole in the picture).
 */
const GUN_LIGHT = /* glsl */ `
{
  float ownShade = uWeaponRaised * (1.0 - 0.25 * smoothstep(${(0.26 * SCALE).toFixed(4)}, ${(0.75 * SCALE).toFixed(4)}, vViewPosition.z));
  reflectedLight.directDiffuse *= 1.0 - 0.6 * ownShade;
  reflectedLight.directSpecular *= 1.0 - 0.86 * ownShade;
  reflectedLight.indirectSpecular *= 1.0 - 0.4 * ownShade;

  vec3 fillToEye = normalize(vViewPosition);
  vec3 fillToLamp = normalize(vec3(-0.3, 0.8, 0.52));
  float fillWrap = saturate(dot(normal, fillToLamp) * 0.55 + 0.45);
  // Mirror image of the glow overhead: brightest where the reflection points up.
  vec3 fillBounce = reflect(-fillToEye, normal);
  float fillSky = smoothstep(-0.25, 0.9, fillBounce.y);
  float fillGraze = pow(1.0 - saturate(dot(normal, fillToEye)), 4.0);
  vec3 fillMirror = mix(vec3(0.04), diffuseColor.rgb, metalnessFactor);
  // Rough metal does not turn into a mirror at shallow angles, so the
  // grazing boost is scaled back by roughness (else the top of the rifle,
  // seen end-on when aiming, washes out to pale grey).
  vec3 fillShine = (fillMirror + (1.0 - fillMirror) * fillGraze * (1.0 - roughnessFactor)) * fillSky * (1.0 - roughnessFactor * 0.72);
  vec3 fillLight = vec3(0.8, 0.88, 1.0) * uWeaponFill * (diffuseColor.rgb * fillWrap * 0.6 + fillShine * 0.5);
  // Where a lamp already lights this part of the gun well, the fill adds
  // little or nothing, so the rifle is never black in a dark corner and
  // never bleached under a lamp.
  vec3 fillAlready = reflectedLight.directDiffuse + reflectedLight.directSpecular;
  float fillNeed = clamp(1.0 - dot(fillAlready, vec3(0.3333)) / (dot(fillLight, vec3(0.3333)) * 1.6 + 0.0001), 0.0, 1.0);
  reflectedLight.indirectDiffuse += fillLight * fillNeed;
}
`;

/**
 * Make a material draw through the gun's lens instead of the world
 * camera's. With `light`, it is also lit the way the gun is (only for
 * materials that react to light).
 */
function useViewLens(material: THREE.Material, lens: { value: THREE.Matrix4 }, light?: GunLight): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uViewLens = lens;
    const header = 'uniform mat4 uViewLens;\n';
    const project = '#include <project_vertex>\ngl_Position = uViewLens * mvPosition;';
    shader.vertexShader = header + shader.vertexShader.replace('#include <project_vertex>', project);
    if (light) {
      shader.uniforms.uWeaponFill = light.fill;
      shader.uniforms.uWeaponRaised = light.raised;
      shader.fragmentShader =
        'uniform float uWeaponFill;\nuniform float uWeaponRaised;\n' + shader.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + GUN_LIGHT);
    }
  };
  material.customProgramCacheKey = () => (light ? 'view-lens-lit' : 'view-lens');
}

export class RifleView {
  /** Attach this to the camera. */
  readonly root = new THREE.Group();
  private readonly gun = new THREE.Group();
  private readonly flash: MuzzleFlash;
  private readonly sight: ReflexSight;
  /** Lights the room for an instant on every shot. Add to the scene. */
  readonly muzzleLight = new THREE.PointLight(0xffb060, 0, 14, 2);

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
  private readonly light: GunLight = { fill: { value: FILL_HIP }, raised: { value: 0 } };
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
      material.color.setScalar(PAINT_LIFT);
      material.roughness = 0.86;
      useViewLens(material, this.lens, this.light);
    });
    this.gun.add(model);

    this.sight = new ReflexSight(assets, this.lens, (material) => useViewLens(material, this.lens, this.light));
    this.gun.add(this.sight.group);

    this.flash = new MuzzleFlash((material) => useViewLens(material, this.lens));
    this.flash.group.position.copy(MUZZLE);
    this.gun.add(this.flash.group);

    this.root.add(this.gun);
    this.root.scale.setScalar(SCALE);
    this.root.name = 'rifle-view';
  }

  /** How brightly the sight's reticle is showing (0..1), and whether the muzzle flash is on screen. */
  get status(): { reticle: number; flash: boolean } {
    return { reticle: this.sight.level, flash: this.flash.showing };
  }

  /** Call when a shot is fired. */
  kick(aim: number): void {
    const calm = 1 - aim * 0.45;
    this.kickBack += RIFLE.kickBack * calm;
    this.kickUp += RIFLE.kickUp * calm;
    this.kickTilt += RIFLE.kickTilt * calm;
    this.kickRoll += rand(-0.03, 0.03);
    this.flash.fire(aim);
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
    this.light.fill.value = lerp(FILL_HIP, FILL_AIM, aim);
    // In the shade of the shooter while raised; back in the open during a reload.
    this.light.raised.value = aim * (1 - Math.min(1, reload * 6));

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

    // The reticle shows only with the rifle raised and roughly level.
    this.sight.update(aim, Math.hypot(gun.rotation.x, gun.rotation.y, gun.rotation.z));

    // Flash and its light last only a frame or two.
    this.flash.update(dt);
    this.muzzleLight.intensity = damp(this.muzzleLight.intensity, 0, FX.muzzleLightFade, dt);
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
