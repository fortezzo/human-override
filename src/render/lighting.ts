// Turns a list of light descriptions into real lights.
//
// A level describes its lights as plain data (LightDef). Every light is
// switched on at every quality level, so the room is equally bright on all
// of them; the rig only decides, from the quality preset, which lights get
// shadow maps. It also runs the flicker animations and keeps each lamp
// model's glow in step with the light it carries.

import * as THREE from 'three';
import type { QualityPreset } from '../config';

type Vec3 = THREE.Vector3Tuple;

export interface LightDef {
  name: string;
  kind: 'spot' | 'point';
  color: number;
  /** Brightness in candela. */
  intensity: number;
  position: Vec3;
  /** Spot lights only: where it points, and its cone. */
  target?: Vec3;
  angle?: number;
  penumbra?: number;
  /** Beyond this distance the light has no effect. */
  distance: number;
  /** Shadow priority: 1 gets a shadow map first. Leave out for no shadow. */
  shadow?: number;
  /**
   * The light only looks right with a shadow (it would shine through
   * walls). Give these the first shadow priorities: every quality level
   * has at least as many shadow maps as there are lights like this.
   */
  needsShadow?: boolean;
  flicker?: 'faulty' | 'pulse' | 'beacon';
  /** Parts of a lamp model that should glow with this light. */
  glow?: { materials: THREE.MeshStandardMaterial[]; color: number; intensity: number };
}

interface LiveLight {
  def: LightDef;
  light: THREE.SpotLight | THREE.PointLight | null;
  /** Current flicker multiplier, 0..1. */
  level: number;
  /** State for the 'faulty' pattern. */
  nextEvent: number;
  burstUntil: number;
}

export class LightRig {
  readonly group = new THREE.Group();
  /** Hold every lamp at full brightness (for repeatable screenshots and measurements). */
  steady = false;
  private live: LiveLight[] = [];

  constructor(private readonly defs: LightDef[]) {
    this.group.name = 'lights';
  }

  applyQuality(preset: QualityPreset): void {
    for (const entry of this.live) {
      if (entry.light) {
        entry.light.shadow?.dispose();
        entry.light.dispose();
      }
    }
    this.group.clear();

    // Hand out shadow maps in priority order.
    const shadowed = new Set(
      this.defs
        .filter((d) => d.shadow !== undefined)
        .sort((a, b) => a.shadow! - b.shadow!)
        .slice(0, preset.shadowLights),
    );

    this.live = this.defs.map((def) => {
      const hasShadow = shadowed.has(def);
      const skip = def.needsShadow && !hasShadow;
      let light: THREE.SpotLight | THREE.PointLight | null = null;

      if (!skip) {
        if (def.kind === 'spot') {
          const spot = new THREE.SpotLight(def.color, def.intensity, def.distance, def.angle ?? 0.6, def.penumbra ?? 0.5, 2);
          spot.target.position.set(...(def.target ?? [0, 0, 0]));
          this.group.add(spot.target);
          light = spot;
        } else {
          light = new THREE.PointLight(def.color, def.intensity, def.distance, 2);
        }
        light.name = def.name;
        light.position.set(...def.position);
        if (hasShadow && def.kind === 'spot') {
          light.castShadow = true;
          light.shadow.mapSize.setScalar(preset.shadowMapSize);
          light.shadow.bias = -0.0004;
          light.shadow.normalBias = 0.025;
          light.shadow.radius = preset.softShadows ? 2.5 : 1;
          const camera = light.shadow.camera as THREE.PerspectiveCamera;
          camera.near = 0.4;
          camera.far = def.distance;
        }
        this.group.add(light);
      }
      if (def.glow) {
        for (const material of def.glow.materials) material.emissive.set(def.glow.color);
      }
      return { def, light, level: 1, nextEvent: 2 + Math.random() * 4, burstUntil: 0 };
    });
    this.update(0);
  }

  update(time: number): void {
    for (const entry of this.live) {
      const { def } = entry;
      let level = 1;
      if (this.steady) {
        // Leave every lamp fully on.
      } else if (def.flicker === 'pulse') {
        level = 0.6 + 0.4 * Math.sin(time * 2.1);
      } else if (def.flicker === 'beacon') {
        // A rotating beacon: a sharp flash once per turn.
        level = 0.12 + 0.88 * Math.pow(Math.max(0, Math.sin(time * 2.7)), 8);
      } else if (def.flicker === 'faulty') {
        if (time > entry.nextEvent) {
          entry.burstUntil = time + 0.25 + Math.random() * 0.9;
          entry.nextEvent = entry.burstUntil + 1.5 + Math.random() * 6;
        }
        if (time < entry.burstUntil) {
          // Rapid stutter while the fault lasts.
          level = Math.sin(time * 71) * Math.sin(time * 43) > 0.05 ? 1 : 0.08;
        } else {
          level = 0.94 + 0.06 * Math.sin(time * 23);
        }
      }
      entry.level = level;
      if (entry.light) entry.light.intensity = def.intensity * level;
      if (def.glow) {
        for (const material of def.glow.materials) material.emissiveIntensity = def.glow.intensity * level;
      }
    }
  }

  /** Current brightness (0..1) of a named light, for effects that follow it. */
  levelOf(name: string): number {
    return this.live.find((entry) => entry.def.name === name)?.level ?? 1;
  }
}
