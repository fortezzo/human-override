// Turns a list of light descriptions into real lights.
//
// A level describes its lights as plain data (LightDef), dozens of them
// across the whole map. The graphics card pays for every light that is
// switched on, for every pixel, so only the lights near the player can be
// live at once. This rig keeps a small fixed pool of real lights and hands
// them, moment to moment, to whichever descriptions matter most: the ones
// in the area the player is in and in areas seen through open doors,
// nearest first. A light that drops out fades down before its slot is
// reused, and one that comes in fades up, so nothing pops.
//
// The pool never changes size while playing, which matters: adding or
// removing a real light would make the graphics card rebuild every shader
// in the game, and the picture would freeze for a moment.
//
// Every light is available at every quality level, so the rooms are equally
// bright on all of them; quality only decides how many of the pool's lights
// cast shadows.

import * as THREE from 'three';
import type { QualityPreset } from '../config';

type Vec3 = THREE.Vector3Tuple;

export interface LightDef {
  name: string;
  /** Which area the light belongs to (lights in areas that cannot be seen are off). */
  area: string;
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
   * walls), so it is only ever given a shadow-casting slot.
   */
  needsShadow?: boolean;
  flicker?: 'faulty' | 'pulse' | 'beacon';
  /**
   * When the light is lit at all: only while the main power is out, only
   * once it is back on, only while ARGUS is still running (it dims as
   * ARGUS dies), or only once ARGUS is off (it comes up as ARGUS dies).
   * Left out, it is always lit.
   */
  when?: 'powerOut' | 'powerOn' | 'argusAwake' | 'argusOff';
  /** Parts of a lamp model that should glow with this light. */
  glow?: { materials: THREE.MeshStandardMaterial[]; color: number; intensity: number };
}

/** How many real lights exist at once. */
export const LIGHT_POOL = { spots: 8, points: 14 };

/** Seconds a light takes to fade in or out when its slot changes hands. */
const FADE = 0.3;

interface Live {
  def: LightDef;
  /** Current flicker multiplier, 0..1. */
  level: number;
  /** State for the 'faulty' pattern. */
  nextEvent: number;
  burstUntil: number;
  /** Where the light does its work: what distance to the player is measured to. */
  focus: THREE.Vector3;
}

interface Slot {
  light: THREE.SpotLight | THREE.PointLight;
  shadowed: boolean;
  live: Live | null;
  /** 0..1 fade for slot hand-overs. */
  fade: number;
  /** The slot is giving its light up and will be free when the fade reaches 0. */
  leaving: boolean;
}

export class LightRig {
  readonly group = new THREE.Group();
  /** Hold every lamp at full brightness (for repeatable screenshots and measurements). */
  steady = false;
  /**
   * The main power is on, and how awake ARGUS is (1 = running, 0 = off):
   * some lights depend on one or the other (see LightDef.when). ARGUS's
   * own lights dim with it as it dies, instead of being switched off.
   */
  power = false;
  argusLevel = 1;
  private readonly lives: Live[];
  private slots: Slot[] = [];
  private lastTime = 0;

  constructor(defs: LightDef[]) {
    this.group.name = 'lights';
    this.lives = defs.map((def) => ({
      def,
      level: 1,
      nextEvent: 2 + Math.random() * 4,
      burstUntil: 0,
      focus: new THREE.Vector3(...(def.kind === 'spot' && def.target ? def.target : def.position)),
    }));
    for (const { def } of this.lives) {
      if (def.glow) for (const material of def.glow.materials) material.emissive.set(def.glow.color);
    }
  }

  /** (Re)build the pool for a quality preset. Call `focus` afterwards. */
  applyQuality(preset: QualityPreset): void {
    for (const slot of this.slots) {
      slot.light.shadow?.dispose();
      slot.light.dispose();
    }
    this.group.clear();
    this.slots = [];

    for (let i = 0; i < LIGHT_POOL.spots; i++) {
      const light = new THREE.SpotLight(0xffffff, 0, 10, 0.6, 0.5, 2);
      const shadowed = i < preset.shadowLights;
      if (shadowed) {
        light.castShadow = true;
        light.shadow.mapSize.setScalar(preset.shadowMapSize);
        light.shadow.bias = -0.0004;
        light.shadow.normalBias = 0.025;
        light.shadow.radius = preset.softShadows ? 2.5 : 1;
        (light.shadow.camera as THREE.PerspectiveCamera).near = 0.4;
      }
      this.group.add(light, light.target);
      this.slots.push({ light, shadowed, live: null, fade: 0, leaving: false });
    }
    for (let i = 0; i < LIGHT_POOL.points; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 10, 2);
      this.group.add(light);
      this.slots.push({ light, shadowed: false, live: null, fade: 0, leaving: false });
    }
  }

  /**
   * Choose which lights are live. `areas` gives a weight to each area that
   * can be seen (1 for the one the player is in, less for those through
   * doors); lights in areas not listed are off. With `instant`, hand-overs
   * skip their fade (used when the view jumps, and before reflections are
   * photographed).
   */
  focus(position: THREE.Vector3, areas: ReadonlyMap<string, number>, instant = false): void {
    const held = new Set<Live>();
    for (const slot of this.slots) if (slot.live && !slot.leaving) held.add(slot.live);

    const score = (live: Live): number => {
      const weight = areas.get(live.def.area) ?? 0;
      if (weight <= 0 || live.def.intensity <= 0) return 0;
      const when = live.def.when;
      if ((when === 'powerOut' && this.power) || (when === 'powerOn' && !this.power) || (when === 'argusAwake' && this.argusLevel <= 0) || (when === 'argusOff' && this.argusLevel >= 1)) return 0;
      const reach = live.def.distance + 4;
      const distance = live.focus.distanceTo(position);
      // Lights already live are favoured a little, so two lights of similar
      // rank do not keep swapping places as the player moves.
      return (weight * (held.has(live) ? 1.3 : 1) * (live.def.needsShadow ? 1.5 : 1)) / (1 + (distance / reach) * (distance / reach));
    };
    const ranked = this.lives
      .map((live) => ({ live, score: score(live) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    // Hand out the three kinds of slot in turn.
    const wanted = new Map<Live, 'shadow' | 'spot' | 'point'>();
    const shadowSlots = this.slots.filter((s) => s.shadowed).length;
    const spotSlots = LIGHT_POOL.spots - shadowSlots;
    const shadowCandidates = ranked
      .filter((e) => e.live.def.kind === 'spot' && e.live.def.shadow !== undefined)
      // Lights that need a shadow come first, then by shadow priority weighted by rank.
      .sort((a, b) => Number(!!b.live.def.needsShadow) - Number(!!a.live.def.needsShadow) || b.score / b.live.def.shadow! - a.score / a.live.def.shadow!);
    for (const { live } of shadowCandidates.slice(0, shadowSlots)) wanted.set(live, 'shadow');
    let spots = 0;
    let points = 0;
    for (const { live } of ranked) {
      if (wanted.has(live)) continue;
      if (live.def.kind === 'spot') {
        if (!live.def.needsShadow && spots < spotSlots) {
          wanted.set(live, 'spot');
          spots++;
        }
      } else if (points < LIGHT_POOL.points) {
        wanted.set(live, 'point');
        points++;
      }
    }

    // Slots whose light is no longer wanted start fading out.
    for (const slot of this.slots) {
      if (!slot.live) continue;
      const kind = slot.light instanceof THREE.SpotLight ? (slot.shadowed ? 'shadow' : 'spot') : 'point';
      if (wanted.get(slot.live) === kind) {
        slot.leaving = false;
        wanted.delete(slot.live);
      } else {
        slot.leaving = true;
        if (instant) {
          slot.live = null;
          slot.fade = 0;
          slot.leaving = false;
        }
      }
    }
    // Lights that are wanted and not yet live take free slots of their kind.
    for (const [live, kind] of wanted) {
      const slot = this.slots.find((s) => !s.live && (s.light instanceof THREE.SpotLight ? (s.shadowed ? 'shadow' : 'spot') : 'point') === kind);
      if (!slot) continue; // every slot of this kind is still fading out; it will get one next time
      this.assign(slot, live);
      if (instant) slot.fade = 1;
    }
    if (instant) this.apply();
  }

  private assign(slot: Slot, live: Live): void {
    const { def } = live;
    const light = slot.light;
    slot.live = live;
    slot.fade = 0;
    slot.leaving = false;
    light.name = def.name;
    light.color.set(def.color);
    light.distance = def.distance;
    light.position.set(...def.position);
    if (light instanceof THREE.SpotLight) {
      light.angle = def.angle ?? 0.6;
      light.penumbra = def.penumbra ?? 0.5;
      light.target.position.set(...(def.target ?? [0, 0, 0]));
      light.target.updateMatrixWorld();
    }
    light.updateMatrixWorld();
  }

  update(time: number): void {
    const dt = Math.min(0.1, Math.max(0, time - this.lastTime));
    this.lastTime = time;

    for (const live of this.lives) {
      const { def } = live;
      let level = 1;
      if (this.steady) {
        // Leave every lamp fully on.
      } else if (def.flicker === 'pulse') {
        level = 0.6 + 0.4 * Math.sin(time * 2.1);
      } else if (def.flicker === 'beacon') {
        // A rotating beacon: a sharp flash once per turn.
        level = 0.12 + 0.88 * Math.pow(Math.max(0, Math.sin(time * 2.7)), 8);
      } else if (def.flicker === 'faulty') {
        if (time > live.nextEvent) {
          live.burstUntil = time + 0.25 + Math.random() * 0.9;
          live.nextEvent = live.burstUntil + 1.5 + Math.random() * 6;
        }
        if (time < live.burstUntil) {
          // Rapid stutter while the fault lasts.
          level = Math.sin(time * 71) * Math.sin(time * 43) > 0.05 ? 1 : 0.08;
        } else {
          level = 0.94 + 0.06 * Math.sin(time * 23);
        }
      }
      live.level = level;
      if (def.glow) {
        for (const material of def.glow.materials) material.emissiveIntensity = def.glow.intensity * level;
      }
    }

    for (const slot of this.slots) {
      if (!slot.live) continue;
      slot.fade = Math.min(1, Math.max(0, slot.fade + (slot.leaving ? -dt : dt) / FADE));
      if (slot.leaving && slot.fade <= 0) {
        slot.live = null;
        slot.leaving = false;
      }
    }
    this.apply();
  }

  private apply(): void {
    for (const slot of this.slots) {
      const live = slot.live;
      const share = !live ? 0 : live.def.when === 'argusAwake' ? this.argusLevel : live.def.when === 'argusOff' ? 1 - this.argusLevel : 1;
      slot.light.intensity = live ? live.def.intensity * live.level * slot.fade * share : 0;
    }
  }

  /** Current brightness (0..1) of a named light, for effects that follow it. */
  levelOf(name: string): number {
    return this.lives.find((live) => live.def.name === name)?.level ?? 1;
  }

  /** Names of the lights that are live right now (for the debug overlay and tests). */
  get liveNames(): string[] {
    return this.slots.filter((s) => s.live && !s.leaving).map((s) => s.live!.def.name);
  }
}
