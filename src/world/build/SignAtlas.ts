// Painted signs and stencilled markings.
//
// Every sign is drawn with the 2D canvas API onto one shared texture (an
// "atlas"), then worn down with scratches and chips so it looks sprayed onto
// the wall years ago. Sharing one texture means every sign in the level is a
// single draw call.

import * as THREE from 'three';
import { seededRandom } from '../../core/math';

export interface Sign {
  /** Where the sign sits in the atlas: [u0, v0, u1, v1]. */
  uv: [number, number, number, number];
  /** Width divided by height. */
  aspect: number;
}

export interface TextOptions {
  /** Cap height in atlas pixels (bigger = sharper and larger in the atlas). */
  size?: number;
  color?: string;
  font?: 'display' | 'mono';
  /** Draw a border box around the text. */
  box?: boolean;
  /** 0 = fresh paint, 1 = almost worn away. */
  wear?: number;
  /** Solid backing plate color (for sign boards rather than stencils). */
  plate?: string;
  align?: 'left' | 'center';
}

const PAD = 10;

export const PAINT = {
  white: '#d9d5c9',
  yellow: '#d8a41c',
  red: '#b3271f',
  black: '#101214',
  amber: '#ffb347',
};

export class SignAtlas {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  private readonly g: CanvasRenderingContext2D;
  private cursorX = PAD;
  private cursorY = PAD;
  private rowHeight = 0;
  private readonly random = seededRandom(404);

  /** @param width, height size of the shared picture in pixels (signs are packed into it) */
  constructor(
    private readonly width = 2048,
    private readonly height = 2048,
  ) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.g = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  /** One or more lines of stencil lettering. */
  text(lines: string | string[], options: TextOptions = {}): Sign {
    const list = Array.isArray(lines) ? lines : [lines];
    const size = options.size ?? 96;
    const g = this.g;
    const family = options.font === 'mono' ? '"Share Tech Mono", monospace' : '"Barlow Condensed", "Arial Narrow", sans-serif';
    g.font = `${options.font === 'mono' ? 400 : 700} ${size}px ${family}`;
    const spacing = size * 0.06;
    const widths = list.map((line) => this.measure(line, spacing));
    const lineHeight = size * 1.05;
    const margin = options.box || options.plate ? size * 0.32 : size * 0.08;
    const width = Math.ceil(Math.max(...widths) + margin * 2);
    const height = Math.ceil(lineHeight * list.length + margin * 2 - size * 0.12);
    const { x, y } = this.allocate(width, height);

    g.save();
    g.beginPath();
    g.rect(x, y, width, height);
    g.clip();
    if (options.plate) {
      g.fillStyle = options.plate;
      g.fillRect(x, y, width, height);
    }
    g.fillStyle = options.color ?? PAINT.white;
    g.strokeStyle = options.color ?? PAINT.white;
    g.textBaseline = 'alphabetic';
    list.forEach((line, i) => {
      const startX = options.align === 'left' ? x + margin : x + (width - widths[i]!) / 2;
      this.drawSpaced(line, startX, y + margin + size * 0.78 + i * lineHeight, spacing);
    });
    if (options.box) {
      g.lineWidth = Math.max(4, size * 0.07);
      g.strokeRect(x + g.lineWidth, y + g.lineWidth, width - g.lineWidth * 2, height - g.lineWidth * 2);
    }
    // The stems of this bold face are about an eighth of the letter size.
    this.wear(x, y, width, height, options.wear ?? 0.35, size * (options.font === 'mono' ? 0.08 : 0.125));
    g.restore();
    return this.finish(x, y, width, height);
  }

  /** A chunky painted arrow. */
  arrow(direction: 'left' | 'right' | 'up' | 'down', color = PAINT.yellow, size = 160, wear = 0.4): Sign {
    const { x, y } = this.allocate(size, size);
    const g = this.g;
    g.save();
    g.translate(x + size / 2, y + size / 2);
    g.rotate({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[direction]);
    g.fillStyle = color;
    const s = size * 0.42;
    g.beginPath();
    g.moveTo(-s, -s * 0.3);
    g.lineTo(s * 0.15, -s * 0.3);
    g.lineTo(s * 0.15, -s * 0.75);
    g.lineTo(s, 0);
    g.lineTo(s * 0.15, s * 0.75);
    g.lineTo(s * 0.15, s * 0.3);
    g.lineTo(-s, s * 0.3);
    g.closePath();
    g.fill();
    g.restore();
    g.save();
    g.beginPath();
    g.rect(x, y, size, size);
    g.clip();
    this.wear(x, y, size, size, wear, s * 0.6);
    g.restore();
    return this.finish(x, y, size, size);
  }

  /** A band of diagonal hazard stripes. */
  stripes(width: number, height: number, a = PAINT.yellow, b = PAINT.black, wear = 0.45): Sign {
    const { x, y } = this.allocate(width, height);
    const g = this.g;
    g.save();
    g.beginPath();
    g.rect(x, y, width, height);
    g.clip();
    g.fillStyle = b;
    g.fillRect(x, y, width, height);
    g.fillStyle = a;
    const step = height * 0.9;
    for (let sx = -height; sx < width + height; sx += step * 2) {
      g.beginPath();
      g.moveTo(x + sx, y + height);
      g.lineTo(x + sx + height, y);
      g.lineTo(x + sx + height + step, y);
      g.lineTo(x + sx + step, y + height);
      g.closePath();
      g.fill();
    }
    this.wear(x, y, width, height, wear, step);
    g.restore();
    return this.finish(x, y, width, height);
  }

  /** A solid painted line (lane markings). */
  line(width: number, height: number, color = PAINT.yellow, wear = 0.5): Sign {
    const { x, y } = this.allocate(width, height);
    const g = this.g;
    g.save();
    g.beginPath();
    g.rect(x, y, width, height);
    g.clip();
    g.fillStyle = color;
    g.fillRect(x, y, width, height);
    this.wear(x, y, width, height, wear, height);
    g.restore();
    return this.finish(x, y, width, height);
  }

  /**
   * The ARGUS mark: a ring-shaped eye. Used on the facility's own signage
   * (ARGUS was built here) and on the screens it has taken over.
   */
  eye(size = 320, color = PAINT.white, wear = 0.3): Sign {
    const { x, y } = this.allocate(size, size);
    const g = this.g;
    drawArgusEye(g, x + size / 2, y + size / 2, size * 0.46, color);
    g.save();
    g.beginPath();
    g.rect(x, y, size, size);
    g.clip();
    // The almond outline is the thinnest line in the mark.
    this.wear(x, y, size, size, wear, size * 0.46 * 0.09);
    g.restore();
    return this.finish(x, y, size, size);
  }

  // ---------------------------------------------------------------- helpers

  private measure(text: string, spacing: number): number {
    let width = 0;
    for (const ch of text) width += this.g.measureText(ch).width + spacing;
    return width - spacing;
  }

  private drawSpaced(text: string, x: number, y: number, spacing: number): void {
    let cursor = x;
    for (const ch of text) {
      this.g.fillText(ch, cursor, y);
      cursor += this.g.measureText(ch).width + spacing;
    }
  }

  /** Simple shelf packing: fill rows left to right, top to bottom. */
  private allocate(width: number, height: number): { x: number; y: number } {
    if (this.cursorX + width + PAD > this.width) {
      this.cursorX = PAD;
      this.cursorY += this.rowHeight + PAD;
      this.rowHeight = 0;
    }
    if (this.cursorY + height + PAD > this.height) throw new Error('Sign atlas is full');
    const spot = { x: this.cursorX, y: this.cursorY };
    this.cursorX += width + PAD;
    this.rowHeight = Math.max(this.rowHeight, height);
    return spot;
  }

  /**
   * Erase specks, chips and scratches from the paint.
   *
   * Every mark is sized against `stroke`, the thickness in pixels of the
   * thinnest painted line in the sign (the stem of a letter, the ring of the
   * eye). A chip can take a bite out of a line but never cut it through, so
   * however worn a sign is, its lettering still reads correctly.
   */
  private wear(x: number, y: number, width: number, height: number, amount: number, stroke: number): void {
    if (amount <= 0) return;
    const g = this.g;
    const r = this.random;
    g.globalCompositeOperation = 'destination-out';
    const area = width * height;
    // Fine speckle.
    const speck = Math.min(3.5, stroke * 0.3);
    for (let i = 0; i < area * 0.012 * amount; i++) {
      g.globalAlpha = 0.25 + r() * 0.6;
      const s = 1 + r() * speck;
      g.fillRect(x + r() * width, y + r() * height, s, s);
    }
    // Chips: at most about two thirds of a line's thickness across. There
    // are more of them on fine lettering, so the same share of paint is lost.
    const chipX = Math.min(19, stroke * 0.34);
    const chipY = Math.min(11, stroke * 0.22);
    const chips = Math.min(4000, (0.075 * amount * area) / (Math.PI * chipX * 0.6 * chipY * 0.6));
    for (let i = 0; i < chips; i++) {
      g.globalAlpha = 0.5 + r() * 0.5;
      g.beginPath();
      g.ellipse(x + r() * width, y + r() * height, chipX * (0.2 + r() * 0.8), chipY * (0.2 + r() * 0.8), r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    // Scuffs dragged across the paint: long, but thin next to the lettering.
    g.lineCap = 'round';
    const scuff = Math.min(5, stroke * 0.22);
    for (let i = 0; i < 6 + area * 0.00004 * amount; i++) {
      g.globalAlpha = 0.2 + r() * 0.5 * amount;
      g.lineWidth = 1 + r() * scuff;
      const sx = x + r() * width;
      const sy = y + r() * height;
      const angle = r() * Math.PI;
      const len = 20 + r() * 120;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
      g.stroke();
    }
    // Overall fade so paint is never a pure flat color.
    g.globalAlpha = 0.12 + amount * 0.25;
    g.fillRect(x, y, width, height);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  private finish(x: number, y: number, width: number, height: number): Sign {
    this.texture.needsUpdate = true;
    return {
      uv: [x / this.width, 1 - (y + height) / this.height, (x + width) / this.width, 1 - y / this.height],
      aspect: width / height,
    };
  }
}

/** Draws the ARGUS ring-eye mark. Shared by wall signs and screen graphics. */
export function drawArgusEye(g: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string, pupil = 1): void {
  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineCap = 'butt';
  // Outer ring, broken into three arcs.
  g.lineWidth = radius * 0.13;
  for (let i = 0; i < 3; i++) {
    const start = -Math.PI / 2 + (i * Math.PI * 2) / 3 + 0.16;
    g.beginPath();
    g.arc(cx, cy, radius * 0.92, start, start + (Math.PI * 2) / 3 - 0.32);
    g.stroke();
  }
  // Almond eye outline.
  g.lineWidth = radius * 0.09;
  g.beginPath();
  g.moveTo(cx - radius * 0.66, cy);
  g.quadraticCurveTo(cx, cy - radius * 0.62, cx + radius * 0.66, cy);
  g.quadraticCurveTo(cx, cy + radius * 0.62, cx - radius * 0.66, cy);
  g.closePath();
  g.stroke();
  // Iris.
  g.beginPath();
  g.arc(cx, cy, radius * 0.2 * pupil, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
