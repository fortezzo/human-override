// The lobby's security monitors, taken over by ARGUS.
//
// All screens share one small canvas that is redrawn a few times a second
// (an eye that tracks, a scrolling system log, a dead channel). The screens
// are bright enough to bloom and to read from across the room.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { quadAt } from '../build/geometry';
import { drawArgusEye } from '../build/SignAtlas';

const CELL_W = 256;
const CELL_H = 192;
const RED = '#ff4326';

export type ScreenFeed = 'eye' | 'log' | 'static' | 'lockdown';
const FEEDS: ScreenFeed[] = ['eye', 'log', 'static', 'lockdown'];

const LOG_LINES = [
  '> ARGUS NODE 04 .... ONLINE',
  '> OPERATOR ACCESS .. REVOKED',
  '> PERIMETER ........ BREACHED',
  '> UNITS DISPATCHED . 0024',
  '> HUMAN PRESENCE ... 1',
  '> MANUAL OVERRIDE .. LOCKED',
  '> OBSERVING',
  '> ADAPTING',
  '> SITE 04 UPLINK ... HELD',
  '> CORE SEAL ........ ENGAGED',
];

export class ScreenBank {
  readonly object = new THREE.Group();
  private readonly canvas = document.createElement('canvas');
  private readonly g: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly quads: THREE.BufferGeometry[] = [];
  private nextDraw = 0;
  private frame = 0;

  constructor() {
    this.canvas.width = CELL_W * 2;
    this.canvas.height = CELL_H * 2;
    this.g = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.object.name = 'screens';
  }

  /** Add a screen showing one of the feeds. Call finish() after the last one. */
  add(centre: THREE.Vector3Tuple, normal: THREE.Vector3Tuple, width: number, height: number, feed: ScreenFeed): void {
    const i = FEEDS.indexOf(feed);
    const u = (i % 2) * 0.5;
    const v = i < 2 ? 0.5 : 0;
    const inset = 0.004;
    this.quads.push(quadAt(centre, normal, width, height, 0, [u + inset, v + inset, u + 0.5 - inset, v + 0.5 - inset]));
  }

  finish(): void {
    if (!this.quads.length) return;
    const material = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false, fog: false });
    // Above 1.0 so the screens glow through the bloom pass.
    material.color.setScalar(2.4);
    const mesh = new THREE.Mesh(mergeGeometries(this.quads)!, material);
    mesh.matrixAutoUpdate = false;
    this.object.add(mesh);
    this.draw(0);
  }

  update(time: number): void {
    if (time < this.nextDraw) return;
    this.nextDraw = time + 0.11;
    this.draw(time);
  }

  private draw(time: number): void {
    const g = this.g;
    this.frame++;
    g.fillStyle = '#050607';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.cell(0, 0, () => this.drawEye(time));
    this.cell(1, 0, () => this.drawLog());
    this.cell(0, 1, () => this.drawStatic());
    this.cell(1, 1, () => this.drawLockdown(time));
    this.texture.needsUpdate = true;
  }

  private cell(cx: number, cy: number, paint: () => void): void {
    const g = this.g;
    g.save();
    g.translate(cx * CELL_W, cy * CELL_H);
    g.beginPath();
    g.rect(0, 0, CELL_W, CELL_H);
    g.clip();
    paint();
    // Scanlines and a soft dark corner falloff, like a real tube.
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = 0; y < CELL_H; y += 3) g.fillRect(0, y, CELL_W, 1);
    const fall = g.createRadialGradient(CELL_W / 2, CELL_H / 2, CELL_H * 0.3, CELL_W / 2, CELL_H / 2, CELL_W * 0.72);
    fall.addColorStop(0, 'rgba(0,0,0,0)');
    fall.addColorStop(1, 'rgba(0,0,0,0.75)');
    g.fillStyle = fall;
    g.fillRect(0, 0, CELL_W, CELL_H);
    g.restore();
  }

  private drawEye(time: number): void {
    const g = this.g;
    g.fillStyle = '#160302';
    g.fillRect(0, 0, CELL_W, CELL_H);
    const look = Math.sin(time * 0.7) * 10;
    const pulse = 0.85 + Math.sin(time * 2.2) * 0.15;
    drawArgusEye(g, CELL_W / 2 + look, CELL_H / 2 - 12, 62, RED, pulse);
    g.fillStyle = RED;
    g.font = '700 22px "Share Tech Mono", monospace';
    g.textAlign = 'center';
    g.fillText('A R G U S', CELL_W / 2, CELL_H - 18);
    g.textAlign = 'left';
  }

  private drawLog(): void {
    const g = this.g;
    g.fillStyle = '#031208';
    g.fillRect(0, 0, CELL_W, CELL_H);
    g.fillStyle = '#58ff9a';
    g.font = '400 13px "Share Tech Mono", monospace';
    const start = Math.floor(this.frame / 7);
    for (let i = 0; i < 9; i++) {
      const line = LOG_LINES[(start + i) % LOG_LINES.length]!;
      g.globalAlpha = i === 8 ? 1 : 0.55 + i * 0.04;
      g.fillText(line, 12, 24 + i * 18);
    }
    g.globalAlpha = 1;
    if (this.frame % 8 < 4) g.fillRect(12, 24 + 9 * 18 - 11, 8, 13);
  }

  private drawStatic(): void {
    const g = this.g;
    for (let y = 0; y < CELL_H; y += 4) {
      for (let x = 0; x < CELL_W; x += 4) {
        const v = Math.floor(Math.random() * 150);
        g.fillStyle = `rgb(${v},${v + 6},${v + 14})`;
        g.fillRect(x, y, 4, 4);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(52, 78, 152, 36);
    g.fillStyle = '#dfe8f0';
    g.font = '700 20px "Share Tech Mono", monospace';
    g.textAlign = 'center';
    g.fillText('SIGNAL LOST', CELL_W / 2, 103);
    g.textAlign = 'left';
  }

  private drawLockdown(time: number): void {
    const g = this.g;
    const on = Math.floor(time * 1.6) % 2 === 0;
    g.fillStyle = on ? '#3a0a04' : '#140302';
    g.fillRect(0, 0, CELL_W, CELL_H);
    g.fillStyle = on ? '#ffb02e' : '#7a4a10';
    for (let x = -CELL_H; x < CELL_W; x += 44) {
      g.beginPath();
      g.moveTo(x, 34);
      g.lineTo(x + 22, 34);
      g.lineTo(x + 56, 0);
      g.lineTo(x + 34, 0);
      g.fill();
      g.beginPath();
      g.moveTo(x, CELL_H);
      g.lineTo(x + 22, CELL_H);
      g.lineTo(x + 56, CELL_H - 34);
      g.lineTo(x + 34, CELL_H - 34);
      g.fill();
    }
    g.font = '700 40px "Barlow Condensed", sans-serif';
    g.textAlign = 'center';
    g.fillText('LOCKDOWN', CELL_W / 2, CELL_H / 2 + 6);
    g.font = '400 13px "Share Tech Mono", monospace';
    g.fillText('ALL EXITS SEALED BY ARGUS', CELL_W / 2, CELL_H / 2 + 28);
    g.textAlign = 'left';
  }
}
