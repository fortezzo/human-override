// The timed pickups lying on the floor: what each looks like, how long it
// stays, and when the player has walked into one.
//
// Each is a badge turning in the air in its own colour, under a thin shaft
// of light that can be seen across a room, so that one dropped behind a
// rack is still found. What a pickup does is the game's business; this
// only shows them and says when one has been taken.

import * as THREE from 'three';
import { PICKUPS } from '../config';
import { addsLightOnly } from '../render/glow';
import type { PickupId } from '../sim/pickups';

export const PICKUP_COLOR: Record<PickupId, number> = {
  resupply: 0xffc247,
  overload: 0xff4a3a,
  emp: 0x8fe9ff,
  doubleScrap: 0xffe14a,
  lockdown: 0x7fb2ff,
};

/** The mark on each badge, drawn on a 128-pixel square. */
const MARKS: Record<PickupId, (g: CanvasRenderingContext2D) => void> = {
  // Three rounds standing in a row.
  resupply: (g) => {
    for (const x of [38, 64, 90]) {
      g.beginPath();
      g.moveTo(x - 9, 96);
      g.lineTo(x - 9, 52);
      g.quadraticCurveTo(x, 28, x + 9, 52);
      g.lineTo(x + 9, 96);
      g.closePath();
      g.fill();
    }
  },
  // A bolt.
  overload: (g) => {
    g.beginPath();
    g.moveTo(74, 22);
    g.lineTo(38, 70);
    g.lineTo(62, 70);
    g.lineTo(50, 106);
    g.lineTo(92, 54);
    g.lineTo(68, 54);
    g.closePath();
    g.fill();
  },
  // Rings spreading from a point.
  emp: (g) => {
    g.lineWidth = 8;
    for (const r of [16, 30, 44]) {
      g.beginPath();
      g.arc(64, 64, r, 0, Math.PI * 2);
      g.stroke();
    }
  },
  doubleScrap: (g) => {
    g.font = '700 74px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('×2', 64, 68);
  },
  // A shutter: slats in a frame.
  lockdown: (g) => {
    g.lineWidth = 8;
    g.strokeRect(30, 26, 68, 78);
    for (const y of [44, 60, 76, 92]) g.fillRect(38, y - 4, 52, 8);
  },
};

function badgeTexture(id: PickupId): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.strokeStyle = g.fillStyle = '#ffffff';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 0.16;
  g.fill();
  g.globalAlpha = 1;
  MARKS[id](g);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface Lying {
  id: PickupId;
  object: THREE.Group;
  badge: THREE.SpriteMaterial;
  beam: THREE.MeshBasicMaterial;
  /** Seconds it has left. */
  left: number;
}

export class FloorPickups {
  readonly group = new THREE.Group();
  private readonly lying: Lying[] = [];
  private readonly textures = new Map<PickupId, THREE.Texture>();

  constructor() {
    this.group.name = 'pickups';
  }

  /** How many are lying about, and of which kinds (for the tests). */
  get list(): Array<{ id: PickupId; x: number; z: number; left: number }> {
    return this.lying.map((item) => ({ id: item.id, x: item.object.position.x, z: item.object.position.z, left: item.left }));
  }

  /** Leave one on the floor at (x, z), to lie there for `life` seconds. */
  drop(id: PickupId, x: number, z: number, life: number = PICKUPS.lifetime): void {
    let texture = this.textures.get(id);
    if (!texture) this.textures.set(id, (texture = badgeTexture(id)));
    const color = new THREE.Color(PICKUP_COLOR[id]);
    const badge = new THREE.SpriteMaterial({ map: texture, color: color.clone().multiplyScalar(2.6), transparent: true, depthWrite: false, fog: false, toneMapped: false });
    const sprite = new THREE.Sprite(badge);
    sprite.scale.setScalar(0.62);
    sprite.position.y = 1.05;
    sprite.renderOrder = 7;
    const beam = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.9), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.12, 3.4, 10, 1, true), beam);
    shaft.position.y = 1.7;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.44, 28), beam);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    addsLightOnly(shaft);
    addsLightOnly(ring);
    addsLightOnly(sprite);
    const object = new THREE.Group();
    object.add(sprite, shaft, ring);
    object.position.set(x, 0, z);
    this.group.add(object);
    this.lying.push({ id, object, badge, beam, left: life });
  }

  /**
   * Age them, and hand back the kinds the player has just walked into
   * (px, pz is where the player stands; pass `take` false while they
   * cannot pick anything up).
   */
  update(dt: number, time: number, px: number, pz: number, take: boolean): PickupId[] {
    const taken: PickupId[] = [];
    for (let i = this.lying.length - 1; i >= 0; i--) {
      const item = this.lying[i]!;
      item.left -= dt;
      const p = item.object.position;
      const reached = take && Math.hypot(p.x - px, p.z - pz) < PICKUPS.reach;
      if (reached || item.left <= 0) {
        if (reached) taken.push(item.id);
        this.remove(i);
        continue;
      }
      // Rising and falling; blinking in its last seconds.
      const blink = item.left < PICKUPS.blink ? (Math.sin(time * (item.left < 2 ? 26 : 13)) > 0 ? 1 : 0.2) : 1;
      item.object.children[0]!.position.y = 1.05 + Math.sin(time * 2.4 + p.x) * 0.07;
      item.badge.opacity = blink;
      item.beam.opacity = (0.24 + 0.08 * Math.sin(time * 3.1 + p.z)) * blink;
    }
    return taken;
  }

  private remove(index: number): void {
    const item = this.lying[index]!;
    item.object.removeFromParent();
    item.badge.dispose();
    item.beam.dispose();
    for (const child of item.object.children) (child as THREE.Mesh).geometry?.dispose();
    this.lying.splice(index, 1);
  }

  clear(): void {
    for (let i = this.lying.length - 1; i >= 0; i--) this.remove(i);
  }
}
