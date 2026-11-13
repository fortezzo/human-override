// Debug hooks, only installed when the page is opened with ?debug=1.
//
// The automated tests and the screenshot script cannot hold a mouse, so
// they drive the game through this small API on window.__HO instead.

import * as THREE from 'three';
import type { QualityLevel } from '../config';
import type { Action } from '../core/input';
import type { Game } from '../game/Game';
import type { SurfaceKind } from '../render/materials';

export interface DebugApi {
  ready: boolean;
  game: Game;
  /** Start playing without capturing the mouse. */
  play(): void;
  /** Park the camera somewhere and look in a direction (degrees). */
  view(x: number, y: number, z: number, yawDeg: number, pitchDeg: number, fov?: number): void;
  /** Hand the camera back to the player. */
  releaseView(): void;
  /** Put the player somewhere, facing a direction (degrees). */
  place(x: number, z: number, yawDeg: number, pitchDeg?: number): void;
  /** Turn the player to look at the nearest robot's head or chest. Returns false if there is none. */
  aimAtRobot(part: 'head' | 'chest'): boolean;
  /** Hold or release a control, as if a key or button were pressed. */
  press(action: Action, down: boolean): void;
  /** Advance the game by `frames` steps of `dt` seconds, drawing each. */
  step(dt: number, frames?: number): void;
  /** Stop or resume the automatic frame loop. */
  freeze(frozen: boolean): void;
  /** Remove every robot (the game sends a new one after its usual delay), or add one at a spot facing `headingDeg`. */
  clearRobots(): void;
  spawnRobot(x: number, z: number, headingDeg?: number, hold?: boolean): void;
  setQuality(level: QualityLevel): void;
  god(on: boolean): void;
  /** Hide the rifle and HUD for clean photographs of the room. */
  photoMode(on: boolean): void;
  /** Hold every lamp at full brightness, so pictures can be compared. */
  steadyLights(on: boolean): void;
  /** Leave a bullet scar and sparks on a surface. */
  scar(x: number, y: number, z: number, nx: number, ny: number, nz: number, kind: SurfaceKind): void;
  stats(): { fps: number; calls: number; triangles: number; quality: string; gpu: string; robots: number; particles: number; gibs: number; state: string; health: number; ammo: number; aim: number; reticle: number; flash: boolean };
}

declare global {
  interface Window {
    __HO?: DebugApi;
  }
}

export function installDebugApi(game: Game): void {
  window.__HO = {
    ready: false,
    game,
    play() {
      game.input.locked = true;
      game.setState('playing');
    },
    view(x, y, z, yawDeg, pitchDeg, fov) {
      game.debugCamera = { position: new THREE.Vector3(x, y, z), yaw: THREE.MathUtils.degToRad(yawDeg), pitch: THREE.MathUtils.degToRad(pitchDeg), fov };
    },
    releaseView() {
      game.debugCamera = null;
    },
    place(x, z, yawDeg, pitchDeg = 0) {
      game.player.position.set(x, 0, z);
      game.player.velocity.set(0, 0, 0);
      game.player.yaw = THREE.MathUtils.degToRad(yawDeg);
      game.player.pitch = THREE.MathUtils.degToRad(pitchDeg);
    },
    aimAtRobot(part) {
      const eye = game.camera.position;
      let best: THREE.Vector3 | null = null;
      let bestDistance = Infinity;
      for (const robot of game.robots) {
        if (!robot.alive) continue;
        const bone = robot.bones.get(part === 'head' ? 'Head' : 'Spine1');
        if (!bone) continue;
        const point = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
        if (part === 'head') point.y += 0.08;
        const distance = point.distanceTo(eye);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = point;
        }
      }
      if (!best) return false;
      const dx = best.x - eye.x;
      const dy = best.y - eye.y;
      const dz = best.z - eye.z;
      game.player.yaw = Math.atan2(-dx, -dz);
      game.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      return true;
    },
    press(action, down) {
      if (down) game.input.press(action);
      else game.input.release(action);
    },
    step(dt, frames = 1) {
      for (let i = 0; i < frames; i++) game.frame(dt);
    },
    freeze(frozen) {
      if (frozen) game.stop();
      else game.start();
    },
    clearRobots() {
      game.clearRobots();
    },
    spawnRobot(x, z, headingDeg = 0, hold = false) {
      const robot = game.spawnRobot(x, z, hold);
      robot.root.rotation.y = THREE.MathUtils.degToRad(headingDeg);
    },
    setQuality(level) {
      game.setQuality(level, false);
    },
    god(on) {
      game.godMode = on;
    },
    photoMode(on) {
      game.hideWeapon = on;
      document.querySelector('.hud')?.classList.toggle('photo', on);
    },
    steadyLights(on) {
      game.lights.steady = on;
    },
    scar(x, y, z, nx, ny, nz, kind) {
      game.debugScar(new THREE.Vector3(x, y, z), new THREE.Vector3(nx, ny, nz).normalize(), kind);
    },
    stats() {
      const { calls, triangles } = game.renderer.stats;
      return {
        fps: Math.round(game.fps),
        calls,
        triangles,
        quality: game.qualityLevel,
        gpu: game.renderer.gpuName,
        ...game.counts,
        state: game.state,
        health: Math.round(game.player.health),
        ammo: game.rifle.state.ammo,
      };
    },
  };
}
