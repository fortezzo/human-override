// Debug hooks, only installed when the page is opened with ?debug=1.
//
// The automated tests and the screenshot script cannot hold a mouse, so
// they drive the game through this small API on window.__HO instead.

import * as THREE from 'three';
import type { Game } from '../game/Game';

export interface DebugApi {
  ready: boolean;
  game: Game;
  /** Park the camera somewhere and look in a direction (degrees). */
  view(x: number, y: number, z: number, yawDeg: number, pitchDeg: number, fov?: number): void;
  /** Advance the game by `frames` steps of `dt` seconds, drawing each. */
  step(dt: number, frames?: number): void;
  /** Stop or resume the automatic frame loop. */
  freeze(frozen: boolean): void;
  stats(): { fps: number; calls: number; triangles: number; quality: string; gpu: string };
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
    view(x, y, z, yawDeg, pitchDeg, fov) {
      game.debugCamera = { position: new THREE.Vector3(x, y, z), yaw: THREE.MathUtils.degToRad(yawDeg), pitch: THREE.MathUtils.degToRad(pitchDeg), fov };
    },
    step(dt, frames = 1) {
      for (let i = 0; i < frames; i++) game.frame(dt);
    },
    freeze(frozen) {
      if (frozen) game.stop();
      else game.start();
    },
    stats() {
      const { calls, triangles } = game.renderer.stats;
      return { fps: Math.round(game.fps), calls, triangles, quality: game.qualityLevel, gpu: game.renderer.gpuName };
    },
  };
}
