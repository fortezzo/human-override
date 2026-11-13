// The flash at the end of the barrel.
//
// Real muzzle flash is over in a few hundredths of a second and has hard,
// ragged edges, not a soft glow. This draws it as a spiky star seen
// end-on plus two crossed tongues of flame seen from the side, shows it
// for about two frames, and gives every shot a different size and twist.

import * as THREE from 'three';
import { FX } from '../../config';
import { rand } from '../../core/math';
import { settings } from '../../core/settings';
import { addsLightOnly } from '../../render/glow';

/** The star seen from behind the gun: thin, sharp spikes of uneven length. */
function starTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const c = size / 2;
  g.translate(c, c);
  const spikes = [1, 0.55, 0.82, 0.48, 0.95, 0.6, 0.74];
  spikes.forEach((length, i) => {
    g.save();
    g.rotate((i / spikes.length) * Math.PI * 2 + (i % 2) * 0.22);
    const reach = c * 0.96 * length;
    // Orange at the tip, white-hot toward the middle.
    const heat = g.createLinearGradient(0, 0, 0, -reach);
    heat.addColorStop(0, 'rgba(255,255,255,1)');
    heat.addColorStop(0.45, 'rgba(255,214,150,0.95)');
    heat.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = heat;
    g.beginPath();
    g.moveTo(-c * 0.085, 0);
    g.lineTo(0, -reach);
    g.lineTo(c * 0.085, 0);
    g.closePath();
    g.fill();
    g.restore();
  });
  // A small hard core, no wide halo.
  const core = g.createRadialGradient(0, 0, 0, 0, 0, c * 0.2);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.7, 'rgba(255,240,210,0.9)');
  core.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = core;
  g.fillRect(-c, -c, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A tongue of flame seen from the side, pointing along +X of the image. */
function tongueTexture(): THREE.Texture {
  const width = 256;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d')!;
  const mid = height / 2;
  const heat = g.createLinearGradient(0, 0, width, 0);
  heat.addColorStop(0, 'rgba(255,255,255,1)');
  heat.addColorStop(0.3, 'rgba(255,225,170,0.95)');
  heat.addColorStop(0.75, 'rgba(255,140,50,0.6)');
  heat.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = heat;
  // A ragged dart: wide near the muzzle, forked at the far end.
  g.beginPath();
  g.moveTo(0, mid - 10);
  g.lineTo(46, mid - 40);
  g.lineTo(96, mid - 18);
  g.lineTo(150, mid - 30);
  g.lineTo(250, mid - 6);
  g.lineTo(176, mid + 4);
  g.lineTo(232, mid + 20);
  g.lineTo(120, mid + 16);
  g.lineTo(60, mid + 38);
  g.lineTo(0, mid + 10);
  g.closePath();
  g.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class MuzzleFlash {
  /** Add to the gun, positioned at the end of the barrel. */
  readonly group = new THREE.Group();
  private readonly star: THREE.Mesh;
  private readonly tongues = new THREE.Group();
  private timer = 0;

  constructor(prepare: (material: THREE.Material) => void) {
    const make = (map: THREE.Texture) => {
      const material = new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
        side: THREE.DoubleSide,
      });
      // Bright enough to bloom a little, not enough to wash into a ball.
      material.color.setRGB(3.2, 2.6, 1.9);
      prepare(material);
      return material;
    };

    this.star = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), make(starTexture()));
    // Two crossed cards along the barrel, each starting at the muzzle.
    const card = new THREE.PlaneGeometry(1, 0.5);
    card.translate(0.5, 0, 0);
    const tongueMaterial = make(tongueTexture());
    for (const roll of [0, Math.PI / 2]) {
      const tongue = new THREE.Mesh(card, tongueMaterial);
      // The image's +X runs down the barrel, which points along -Z.
      tongue.rotation.set(roll, Math.PI / 2, 0, 'ZYX');
      this.tongues.add(tongue);
    }
    for (const mesh of [this.star, ...this.tongues.children]) addsLightOnly(mesh).frustumCulled = false;
    this.group.add(this.star, this.tongues);
    this.group.visible = false;
  }

  /** Show a new flash. `aim` (0..1) shrinks it a little when sighted. */
  fire(aim: number): void {
    const calm = settings.value.reducedMotion ? 0.55 : 1;
    const size = rand(0.17, 0.25) * (1 - aim * 0.3) * calm;
    this.star.scale.setScalar(size);
    this.star.rotation.z = rand(0, Math.PI * 2);
    this.tongues.scale.set(size * rand(0.8, 1.15), size * rand(0.8, 1.15), size * rand(1.3, 2.1));
    this.tongues.rotation.z = rand(0, Math.PI);
    this.group.visible = true;
    this.timer = FX.muzzleFlashTime;
  }

  /** True while the flash is being drawn. */
  get showing(): boolean {
    return this.group.visible;
  }

  update(dt: number): void {
    if (this.timer <= 0) return;
    this.timer -= dt;
    if (this.timer <= 0) this.group.visible = false;
  }
}
