// Rows of status lights on the fronts of server racks.
//
// Like the security monitors, every rack shares one small picture that is
// redrawn a few times a second: columns of rack units, each with a handful
// of lights that blink on their own schedule. Most are the calm green and
// blue of healthy machines; clusters of red mark the ones ARGUS has taken.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seededRandom } from '../../core/math';
import { quadAt } from './geometry';

const COLUMNS = 6;
const UNITS = 22;
const CELL_W = 128;
const UNIT_H = 44;

const CALM = ['#35f27a', '#35f27a', '#49a6ff', '#49a6ff', '#ffb42e'];
const TAKEN = '#ff3a1e';

interface Led {
  x: number;
  y: number;
  color: string;
  /** Blinks per second, and where in its cycle it starts. */
  rate: number;
  phase: number;
  /** Fraction of each cycle it is lit. */
  duty: number;
}

export class LedBank {
  readonly object = new THREE.Group();
  private readonly canvas = document.createElement('canvas');
  private readonly g: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly quads: THREE.BufferGeometry[] = [];
  private readonly leds: Led[] = [];
  private readonly random = seededRandom(77);
  private nextDraw = 0;

  constructor() {
    this.canvas.width = COLUMNS * CELL_W;
    this.canvas.height = UNITS * UNIT_H;
    this.g = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.object.name = 'rack-lights';

    const r = this.random;
    for (let column = 0; column < COLUMNS; column++) {
      // The last two columns are racks ARGUS has taken over.
      const taken = column >= COLUMNS - 2;
      for (let unit = 0; unit < UNITS; unit++) {
        if (r() < 0.14) continue; // an empty slot
        const count = 2 + Math.floor(r() * 5);
        const red = taken && r() < 0.75;
        for (let i = 0; i < count; i++) {
          this.leds.push({
            x: column * CELL_W + 16 + i * 11 + (r() < 0.3 ? 30 : 0),
            y: unit * UNIT_H + 18,
            color: red ? TAKEN : CALM[Math.floor(r() * CALM.length)]!,
            rate: red ? 1.2 + r() * 3 : 0.15 + r() * 2.2,
            phase: r(),
            duty: r() < 0.35 ? 1 : 0.25 + r() * 0.6,
          });
        }
      }
    }
  }

  /** Add the light panel of one rack face. Call finish() after the last one. */
  add(centre: THREE.Vector3Tuple, normal: THREE.Vector3Tuple, width: number, height: number): void {
    const column = Math.floor(this.random() * COLUMNS);
    const u = column / COLUMNS;
    this.quads.push(quadAt(centre, normal, width, height, 0, [u + 0.004, 0, u + 1 / COLUMNS - 0.004, 1]));
  }

  finish(): void {
    if (!this.quads.length) return;
    const material = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false, fog: true });
    // Above 1.0 so the lights glow through the bloom pass.
    material.color.setScalar(2.2);
    const mesh = new THREE.Mesh(mergeGeometries(this.quads)!, material);
    mesh.matrixAutoUpdate = false;
    this.object.add(mesh);
    this.draw(0);
  }

  update(time: number): void {
    if (time < this.nextDraw) return;
    this.nextDraw = time + 0.12;
    this.draw(time);
  }

  private draw(time: number): void {
    const g = this.g;
    g.fillStyle = '#030405';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // The faint outline of each rack unit, so the panel reads as equipment.
    for (let column = 0; column < COLUMNS; column++) {
      for (let unit = 0; unit < UNITS; unit++) {
        const x = column * CELL_W + 8;
        const y = unit * UNIT_H + 4;
        g.fillStyle = '#10141a';
        g.fillRect(x, y, CELL_W - 16, UNIT_H - 8);
        // A lit top edge and a row of vent slots give each unit some shape.
        g.fillStyle = '#1b222b';
        g.fillRect(x, y, CELL_W - 16, 2);
        g.fillStyle = '#07090c';
        for (let slot = 0; slot < 6; slot++) g.fillRect(x + CELL_W - 62 + slot * 7, y + 8, 4, UNIT_H - 22);
      }
    }
    for (const led of this.leds) {
      const cycle = (time * led.rate + led.phase) % 1;
      if (cycle > led.duty) continue;
      g.fillStyle = led.color;
      g.fillRect(led.x, led.y, 6, 6);
    }
    this.texture.needsUpdate = true;
  }
}
