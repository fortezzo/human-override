// Bullet holes, dents and scorch marks left on the level.
//
// Each kind of mark is one instanced mesh holding a fixed number of quads.
// New marks overwrite the oldest, so the room scars up as the fight goes on
// without ever growing the amount of work the GPU does.

import * as THREE from 'three';
import { FX } from '../config';
import { seededRandom } from '../core/math';

export type DecalKind = 'concrete' | 'metal' | 'scorch';

function canvasTexture(size: number, paint: (g: CanvasRenderingContext2D, size: number) => void): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d')!, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A chipped crater in concrete: pale broken rim, dark hole, a few cracks. */
function paintConcreteHole(g: CanvasRenderingContext2D, size: number): void {
  const random = seededRandom(11);
  const c = size / 2;
  // Pale spall around the hole, with a ragged edge.
  g.fillStyle = 'rgba(178,172,160,0.85)';
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const radius = size * (0.2 + random() * 0.14);
    g.lineTo(c + Math.cos(angle) * radius, c + Math.sin(angle) * radius);
  }
  g.fill();
  // Hairline cracks running out.
  g.strokeStyle = 'rgba(20,18,16,0.7)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    let angle = random() * Math.PI * 2;
    let x = c;
    let y = c;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      angle += (random() - 0.5) * 0.7;
      x += Math.cos(angle) * size * 0.075;
      y += Math.sin(angle) * size * 0.075;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // The hole itself.
  const hole = g.createRadialGradient(c, c, 0, c, c, size * 0.15);
  hole.addColorStop(0, 'rgba(6,5,5,1)');
  hole.addColorStop(0.7, 'rgba(18,16,14,0.95)');
  hole.addColorStop(1, 'rgba(40,36,32,0)');
  g.fillStyle = hole;
  g.fillRect(0, 0, size, size);
}

/** A dent punched into steel: bright scraped ring around a dark pit. */
function paintMetalDent(g: CanvasRenderingContext2D, size: number): void {
  const c = size / 2;
  const scorch = g.createRadialGradient(c, c, size * 0.08, c, c, size * 0.42);
  scorch.addColorStop(0, 'rgba(12,11,10,0.75)');
  scorch.addColorStop(1, 'rgba(12,11,10,0)');
  g.fillStyle = scorch;
  g.fillRect(0, 0, size, size);
  const ring = g.createRadialGradient(c, c, size * 0.07, c, c, size * 0.19);
  ring.addColorStop(0, 'rgba(225,228,232,0)');
  ring.addColorStop(0.45, 'rgba(225,228,232,0.95)');
  ring.addColorStop(1, 'rgba(160,165,170,0)');
  g.fillStyle = ring;
  g.fillRect(0, 0, size, size);
  const pit = g.createRadialGradient(c, c, 0, c, c, size * 0.1);
  pit.addColorStop(0, 'rgba(4,4,5,1)');
  pit.addColorStop(1, 'rgba(10,10,12,0.2)');
  g.fillStyle = pit;
  g.fillRect(0, 0, size, size);
}

/** A soot mark, for explosions and destroyed robots. */
function paintScorch(g: CanvasRenderingContext2D, size: number): void {
  const random = seededRandom(29);
  const c = size / 2;
  for (let i = 0; i < 40; i++) {
    const angle = random() * Math.PI * 2;
    const distance = random() * size * 0.22;
    const x = c + Math.cos(angle) * distance;
    const y = c + Math.sin(angle) * distance;
    const radius = size * (0.08 + random() * 0.2);
    const blot = g.createRadialGradient(x, y, 0, x, y, radius);
    blot.addColorStop(0, 'rgba(8,7,6,0.22)');
    blot.addColorStop(1, 'rgba(8,7,6,0)');
    g.fillStyle = blot;
    g.fillRect(0, 0, size, size);
  }
}

class DecalPool {
  readonly mesh: THREE.InstancedMesh;
  private next = 0;
  private used = 0;

  constructor(
    map: THREE.Texture,
    private readonly capacity: number,
    metalness: number,
    roughness: number,
  ) {
    const material = new THREE.MeshStandardMaterial({
      map,
      transparent: true,
      depthWrite: false,
      roughness,
      metalness,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 3;
  }

  add(matrix: THREE.Matrix4): void {
    this.mesh.setMatrixAt(this.next, matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.next = (this.next + 1) % this.capacity;
    this.used = Math.min(this.capacity, this.used + 1);
    this.mesh.count = this.used;
  }

  clear(): void {
    this.next = 0;
    this.used = 0;
    this.mesh.count = 0;
  }
}

export class BulletDecals {
  readonly group = new THREE.Group();
  private readonly pools: Record<DecalKind, DecalPool>;
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly spin = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly position = new THREE.Vector3();
  private readonly zAxis = new THREE.Vector3(0, 0, 1);

  constructor() {
    const share = Math.floor(FX.maxDecals / 2);
    this.pools = {
      concrete: new DecalPool(canvasTexture(128, paintConcreteHole), share, 0, 0.95),
      metal: new DecalPool(canvasTexture(128, paintMetalDent), Math.floor(share * 0.7), 0.6, 0.45),
      scorch: new DecalPool(canvasTexture(128, paintScorch), Math.floor(share * 0.3), 0, 1),
    };
    this.group.name = 'bullet-decals';
    for (const pool of Object.values(this.pools)) this.group.add(pool.mesh);
  }

  /** Stamp a mark at `point` on a surface facing `normal`. */
  add(kind: DecalKind, point: THREE.Vector3, normal: THREE.Vector3, size: number): void {
    this.quaternion.setFromUnitVectors(this.zAxis, normal);
    this.spin.setFromAxisAngle(this.zAxis, Math.random() * Math.PI * 2);
    this.quaternion.multiply(this.spin);
    this.position.copy(point).addScaledVector(normal, 0.006);
    this.scale.set(size, size, 1);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.pools[kind].add(this.matrix);
  }

  clear(): void {
    for (const pool of Object.values(this.pools)) pool.clear();
  }
}
