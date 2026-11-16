// The parts of the map the mission moves: the main breaker's lever, the
// key cage's gate, the override keys, the uplink's progress lights and the
// ring that marks the ground to hold, and the kill switch with its keys
// and the lights round its dais.
//
// Everything here only shows what it is told to show. What the mission's
// state is, and what the player is allowed to do, is decided in
// sim/mission.ts and game/Mission.ts.

import * as THREE from 'three';
import { MISSION } from '../config';
import type { Assets } from '../core/assets';
import { damp } from '../core/math';
import { addsLightOnly } from '../render/glow';
import type { LightDef } from '../render/lighting';
import type { MaterialLibrary } from '../render/materials';
import { LevelBuilder } from './build/LevelBuilder';
import { BREAKER, HALL, KEY_CAGE, KILL_SWITCH, UPLINK, type AreaId } from './plan';

/** The colour of everything that belongs to the mission: keys, progress lights, markers. */
export const MISSION_COLOR = 0x4fe6ff;

const UPLINK_SEGMENTS = 12;
const DAIS_SEGMENTS = 24;
const LEVER_DOWN = -0.72;
const LEVER_UP = 0.72;
const SWITCH_READY = 0;
const SWITCH_PULLED = 1.25;
/** How far the cage's gate slides when it opens (it goes behind the fixed bars beside it). */
const GATE_TRAVEL = 0.97;

/** A soft round glow, for the keys. */
function glowTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  const fade = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  fade.addColorStop(0, 'rgba(255,255,255,1)');
  fade.addColorStop(0.3, 'rgba(255,255,255,0.4)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

/** One override key: a short steel cartridge with a lit band and a ring to carry it by. */
class OverrideKey {
  readonly object = new THREE.Group();
  private readonly band: THREE.MeshBasicMaterial;
  private readonly glow: THREE.SpriteMaterial;

  constructor(shared: { steel: THREE.Material; glow: THREE.Texture }) {
    const color = new THREE.Color(MISSION_COLOR);
    this.band = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(3.4), toneMapped: false, fog: false });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.18, 6), shared.steel);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0375, 0.0375, 0.055, 6), this.band);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.034, 0.02, 6), shared.steel);
    cap.position.y = 0.1;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 14), shared.steel);
    ring.position.y = 0.128;
    this.glow = new THREE.SpriteMaterial({ map: shared.glow, color: color.clone().multiplyScalar(0.55), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, toneMapped: false });
    const halo = new THREE.Sprite(this.glow);
    halo.scale.setScalar(0.5);
    addsLightOnly(halo);
    for (const mesh of [body, cap, ring]) mesh.castShadow = true;
    this.object.add(body, band, cap, ring, halo);
  }

  /** How brightly it is lit, 0..1 (a key that cannot be taken yet is dim). */
  set level(level: number) {
    this.band.color.set(MISSION_COLOR).multiplyScalar(0.25 + 3.15 * level);
    this.glow.color.set(MISSION_COLOR).multiplyScalar(0.55 * level);
  }
}

export class MissionSet {
  /** The pieces that stand in each area, to be drawn with it. */
  readonly groups: Record<AreaId, THREE.Group> = { lobby: new THREE.Group(), hall: new THREE.Group(), power: new THREE.Group(), core: new THREE.Group(), dock: new THREE.Group(), lab: new THREE.Group() };
  /** Pieces that can be anywhere (a key dropped on the floor): always drawn. */
  readonly loose = new THREE.Group();
  /** The lights that go with them. */
  readonly lights: LightDef[] = [];
  /** Where the Custodian's key lies, if it is lying anywhere. */
  droppedAt: THREE.Vector3 | null = null;

  private readonly shared: { steel: THREE.Material; glow: THREE.Texture };
  private readonly breakerLever: THREE.Group;
  private readonly gate: THREE.Group;
  private readonly lockLamp: THREE.MeshBasicMaterial;
  private readonly cageKey: OverrideKey;
  private readonly cageKeyLight: LightDef;
  private readonly dropped: OverrideKey;
  private readonly beam: THREE.Mesh;
  private readonly uplinkLights: THREE.MeshBasicMaterial[] = [];
  private readonly ring: THREE.Mesh;
  private readonly switchLever: THREE.Group;
  private readonly slotKeys: OverrideKey[] = [];
  private readonly daisLights: THREE.MeshBasicMaterial[] = [];

  private power = false;
  private leverAngle = LEVER_DOWN;
  private gateSlide = 0;
  private uplink: 'idle' | 'running' | 'done' = 'idle';
  private uplinkProgress = 0;
  private armed = 0;
  private ready = false;
  private pulled = false;
  private stalled = false;
  private switchAngle = SWITCH_READY;

  constructor(assets: Assets, materials: MaterialLibrary) {
    this.shared = { steel: new THREE.MeshStandardMaterial({ color: 0x1b1e22, metalness: 0.9, roughness: 0.4 }), glow: glowTexture() };
    for (const [id, group] of Object.entries(this.groups)) group.name = `mission-${id}`;
    this.loose.name = 'mission-loose';

    /** A small moving piece built from the same kit as the rooms, around its own origin. */
    const piece = (build: (b: LevelBuilder) => void, at: [number, number, number], parent: THREE.Group): THREE.Group => {
      const b = new LevelBuilder(assets, materials);
      build(b);
      const built = b.build().group;
      built.traverse((o) => (o.matrixAutoUpdate = true));
      built.position.set(...at);
      parent.add(built);
      return built;
    };

    // ---- The main breaker's lever: an arm out of the slot with a bar across its end.
    this.breakerLever = piece(
      (b) => {
        b.tube('rustedSteel', [0, 0, 0], [0, 0, -0.26], 0.028, false);
        b.tube('hazard', [-0.12, 0, -0.26], [0.12, 0, -0.26], 0.035, false);
      },
      [BREAKER.x, BREAKER.y, BREAKER.z],
      this.groups.power,
    );

    // ---- The key cage's gate: a section of bars with a lock plate, which
    // slides aside behind the fixed bars when the lock lets go.
    const { x0, gate, stand } = KEY_CAGE;
    this.gate = piece(
      (b) => {
        const width = gate.z1 - gate.z0;
        for (let z = 0.04; z <= width - 0.03; z += 0.13) b.tube('darkSteel', [0, 0, z], [0, 2.6, z], 0.012, false);
        for (const y of [0.08, 1.3, 2.6]) b.tube('rustedSteel', [0, y, 0], [0, y, width], 0.022, false);
        b.box('hazard', [-0.03, 0.95, 0.3], [0.03, 1.25, 0.7], { collide: false, cast: false });
      },
      [x0 + 0.05, 0, gate.z0],
      this.groups[KEY_CAGE.area],
    );
    // Its lock: a lamp on the post, red while it holds and green once it has let go.
    this.lockLamp = new THREE.MeshBasicMaterial({ color: 0xff2a12, toneMapped: false, fog: false });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.035, 0.035), this.lockLamp);
    lamp.position.set(x0 - 0.05, 1.5, gate.z0 - 0.04);
    this.groups[KEY_CAGE.area].add(lamp);

    // ---- The key in the cage, on its stand just inside the gate.
    this.cageKey = new OverrideKey(this.shared);
    this.cageKey.object.position.set(stand.x, stand.top + 0.17, stand.z);
    this.groups[KEY_CAGE.area].add(this.cageKey.object);
    this.cageKeyLight = { name: 'cageKey', area: KEY_CAGE.area, kind: 'point', color: MISSION_COLOR, intensity: 4, position: [stand.x - 0.3, stand.top + 0.5, stand.z], distance: 3.4, when: 'powerOn' };
    this.lights.push(this.cageKeyLight);

    // ---- The Custodian's key, where it fell: turning in the air under a thin shaft of light.
    this.dropped = new OverrideKey(this.shared);
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.05, 3.2, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(MISSION_COLOR).multiplyScalar(0.9), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }),
    );
    this.beam.position.y = 1.4;
    addsLightOnly(this.beam);
    this.dropped.object.add(this.beam);
    this.dropped.object.visible = false;
    this.loose.add(this.dropped.object);

    // ---- The uplink: a row of lights along the top of its rack that fill as
    // the ground is held, and a ring on the floor marking that ground.
    for (let i = 0; i < UPLINK_SEGMENTS; i++) {
      const material = new THREE.MeshBasicMaterial({ color: 0x06090a, toneMapped: false, fog: false });
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.05), material);
      // Filling from left to right as seen by someone standing in front of it (who faces south).
      light.position.set(UPLINK.x + 1.1 - (i + 0.5) * (2.2 / UPLINK_SEGMENTS), 2.345, UPLINK.z + 0.08);
      this.groups.hall.add(light);
      this.uplinkLights.push(material);
    }
    this.ring = new THREE.Mesh(
      ringInside(UPLINK.zone.x, UPLINK.zone.z, MISSION.uplinkRadius, [HALL.x0 + 0.05, HALL.z0 + 0.05, HALL.x1 - 0.05, HALL.z1 - 0.05]),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(MISSION_COLOR), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }),
    );
    this.ring.position.y = 0.03;
    this.ring.visible = false;
    addsLightOnly(this.ring);
    this.groups.hall.add(this.ring);

    // ---- The kill switch: the lever on the console, the three keys in
    // their slots, and a ring of lights round the dais that fills as it arms.
    const { x: kx, z: kz } = KILL_SWITCH;
    this.switchLever = piece(
      (b) => {
        b.tube('rustedSteel', [0, 0, 0], [0, 0.27, -0.03], 0.022, false);
        b.tube('hazard', [0, 0.27, -0.03], [0, 0.33, -0.036], 0.036, false);
      },
      [kx, 1.2, kz - 0.035],
      this.groups.core,
    );
    for (const dx of [-0.42, 0, 0.42]) {
      const key = new OverrideKey(this.shared);
      key.object.position.set(kx + dx, 1.2, kz + 0.11);
      key.object.visible = false;
      this.groups.core.add(key.object);
      this.slotKeys.push(key);
    }
    for (let i = 0; i < DAIS_SEGMENTS; i++) {
      const angle = (i / DAIS_SEGMENTS) * Math.PI * 2;
      const material = new THREE.MeshBasicMaterial({ color: 0x0a0605, toneMapped: false, fog: false });
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.014, 0.09), material);
      // Starting at the front of the dais (the side the door is on) and running clockwise.
      light.position.set(kx - Math.sin(angle) * 2.07, 0.267, kz - Math.cos(angle) * 2.07);
      light.rotation.y = angle;
      this.groups.core.add(light);
      this.daisLights.push(material);
    }
    this.reset();
  }

  // ----------------------------------------------------------- what to show

  /** The main power: the breaker's lever, the cage's lock and gate. */
  setPower(on: boolean, instant = false): void {
    this.power = on;
    this.lockLamp.color.set(on ? 0x35ff6a : 0xff2a12).multiplyScalar(on ? 1.5 : 2.0);
    if (instant) {
      this.leverAngle = on ? LEVER_UP : LEVER_DOWN;
      this.gateSlide = on ? GATE_TRAVEL : 0;
    }
    this.refreshCageKey();
  }

  /** Whether the key is still on its stand in the cage. */
  setCageKey(present: boolean): void {
    this.cageKey.object.visible = present;
    this.refreshCageKey();
  }

  private refreshCageKey(): void {
    this.cageKey.level = this.power ? 1 : 0.12;
    this.cageKeyLight.intensity = this.cageKey.object.visible ? 4 : 0;
  }

  /** A key to hang on the Custodian. */
  carriedKey(): THREE.Object3D {
    const key = new OverrideKey(this.shared);
    return key.object;
  }

  /** The Custodian's key falls where it stood. */
  dropKey(x: number, z: number): void {
    this.droppedAt = new THREE.Vector3(x, 0, z);
    this.dropped.object.position.set(x, 0.95, z);
    this.dropped.object.visible = true;
  }

  /** The dropped key has been picked up (or there is none). */
  clearDroppedKey(): void {
    this.droppedAt = null;
    this.dropped.object.visible = false;
  }

  /** The uplink: waiting, being held (how far through, 0..1), or done. */
  setUplink(state: 'idle' | 'running' | 'done', progress: number): void {
    this.uplink = state;
    this.uplinkProgress = progress;
    this.ring.visible = state === 'running';
  }

  /**
   * The kill switch: whether the keys are in their slots, how far it has
   * armed (0..1), whether it is armed and waiting, whether it has been
   * pulled, and whether the arming is stalled (the player has left the core).
   */
  setSwitch(keysIn: boolean, armed: number, ready: boolean, pulled: boolean, stalled = false): void {
    for (const key of this.slotKeys) key.object.visible = keysIn;
    this.armed = armed;
    this.ready = ready;
    this.pulled = pulled;
    this.stalled = stalled;
  }

  /** A new run: the power out, the cage shut with its key in it, nothing started. */
  reset(): void {
    this.setPower(false, true);
    this.setCageKey(true);
    this.clearDroppedKey();
    this.setUplink('idle', 0);
    this.setSwitch(false, 0, false, false);
    this.switchAngle = SWITCH_READY;
    this.place(0);
  }

  // ----------------------------------------------------------------- motion

  update(dt: number, time: number): void {
    // The breaker's lever is thrown in a quarter of a second; the gate grinds aside.
    this.leverAngle = damp(this.leverAngle, this.power ? LEVER_UP : LEVER_DOWN, 14, dt);
    const gateTarget = this.power ? GATE_TRAVEL : 0;
    this.gateSlide += Math.sign(gateTarget - this.gateSlide) * Math.min(Math.abs(gateTarget - this.gateSlide), dt * 0.7);
    this.switchAngle = damp(this.switchAngle, this.pulled ? SWITCH_PULLED : SWITCH_READY, 12, dt);
    this.place(time);
  }

  private place(time: number): void {
    this.breakerLever.rotation.x = this.leverAngle;
    this.gate.position.z = KEY_CAGE.gate.z0 + this.gateSlide;
    this.switchLever.rotation.x = -this.switchAngle;

    // Keys that are free to take turn slowly and rise and fall.
    const bob = Math.sin(time * 2.1) * 0.025;
    this.cageKey.object.position.y = KEY_CAGE.stand.top + 0.17 + (this.power ? bob : 0);
    this.cageKey.object.rotation.y = this.power ? time * 0.9 : 0.4;
    if (this.dropped.object.visible) {
      this.dropped.object.position.y = 0.95 + bob * 2;
      this.dropped.object.rotation.y = time * 1.4;
      (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.26 + 0.1 * Math.sin(time * 3.2);
    }

    // The uplink's lights: dark without power, a faint row once it is on,
    // filling from the left while the ground is held (the next one
    // blinking), and all lit once it is done.
    const lit = this.uplink === 'done' ? UPLINK_SEGMENTS : this.uplink === 'running' ? Math.floor(this.uplinkProgress * UPLINK_SEGMENTS) : 0;
    this.uplinkLights.forEach((material, i) => {
      let level = this.power ? 0.1 : 0.0;
      if (i < lit) level = 1.5;
      else if (i === lit && this.uplink === 'running') level = Math.sin(time * 9) > 0 ? 1.0 : 0.1;
      material.color.set(MISSION_COLOR).multiplyScalar(level);
      if (level === 0) material.color.set(0x06090a);
    });
    if (this.ring.visible) (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.34 + 0.16 * Math.sin(time * 2.6);

    // The dais: its lights fill round the ring as the switch arms, then all pulse together.
    const filled = Math.floor(this.armed * DAIS_SEGMENTS);
    this.daisLights.forEach((material, i) => {
      if (this.pulled) material.color.set(MISSION_COLOR).multiplyScalar(0.5);
      else if (this.ready) material.color.set(MISSION_COLOR).multiplyScalar(1.8 + 1.4 * Math.sin(time * 6));
      // Stalled (the player has left the core): what has been armed so far dims and waits.
      else if (i < filled) material.color.set(MISSION_COLOR).multiplyScalar(this.stalled ? 0.7 + 0.3 * Math.sin(time * 3) : 2.4);
      else if (i === filled && this.armed > 0 && !this.stalled) material.color.set(MISSION_COLOR).multiplyScalar(Math.sin(time * 9) > 0 ? 1.4 : 0.1);
      else material.color.set(0x0a0605);
    });
    for (const key of this.slotKeys) key.level = this.pulled ? 0.3 : 1;
  }
}

/**
 * A flat ring on the floor about (cx, cz), with every part that would fall
 * outside a rectangle left out, so that the ring round the uplink stops at
 * the server hall's walls instead of carrying on across the floor of the
 * room next door.
 */
function ringInside(cx: number, cz: number, radius: number, bounds: [number, number, number, number]): THREE.BufferGeometry {
  const positions: number[] = [];
  const steps = 200;
  const half = 0.05;
  const point = (angle: number, r: number): [number, number] => [cx + Math.cos(angle) * r, cz + Math.sin(angle) * r];
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * Math.PI * 2;
    const a1 = ((i + 1) / steps) * Math.PI * 2;
    const [mx, mz] = point((a0 + a1) / 2, radius);
    if (mx < bounds[0] || mz < bounds[1] || mx > bounds[2] || mz > bounds[3]) continue;
    const corners = [point(a0, radius - half), point(a0, radius + half), point(a1, radius + half), point(a1, radius - half)];
    for (const k of [0, 1, 2, 0, 2, 3]) positions.push(corners[k]![0], 0, corners[k]![1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}
