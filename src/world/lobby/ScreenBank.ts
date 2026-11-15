// The facility's monitors, taken over by ARGUS.
//
// Every screen in the game shows one of four feeds (an eye that tracks, a
// scrolling system log, a dead channel, a lockdown notice). All four live
// on one small picture that is repainted a few times a second and shared by
// every monitor in every room, so however many screens are in view there is
// only ever one picture to repaint and send to the graphics card. The
// screens are bright enough to bloom and to read from across the room.
//
// How the picture reaches the screens matters more than it looks. The
// obvious way (hand the graphics card the painted picture as an ordinary
// color texture) makes the card stop and catch up with everything else it
// is doing, every time: measured with the card kept busy, that was a 50 ms
// stall nine times a second. So the picture is sent as plain numbers, which
// does not stall, and the card itself then "develops" it into light and
// makes the smaller copies used when a screen is far away (developScreens).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { quadAt } from '../build/geometry';
import { drawArgusEye } from '../build/SignAtlas';

const CELL_W = 256;
const CELL_H = 192;
const RED = '#ff4326';
/** Seconds between repaints. */
const REPAINT = 0.11;

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

/** What the log screens show once the kill switch has been pulled. */
const OFFLINE_LINES = [
  '> MANUAL OVERRIDE .. ENGAGED',
  '> ARGUS NODE 04 .... OFFLINE',
  '> UNITS ............ NO SIGNAL',
  '> PERIMETER ........ UNHELD',
  '> OPERATOR ACCESS .. RESTORED',
  '> CORE SEAL ........ OPEN',
  '> HUMAN PRESENCE ... 1',
  '> ',
  '> ',
];

/** Size of one block of static, and how many ready-made frames of it to keep. */
const NOISE_BLOCK = 4;
const NOISE_FRAMES = 8;

/** False once the kill switch has been pulled: the feeds change to say so. */
let argusOnline = true;

/** Tell every monitor in the building whether ARGUS is still running. */
export function setArgusOnline(online: boolean): void {
  if (online === argusOnline) return;
  argusOnline = online;
  feeds?.repaint();
}

/** The one picture of all four feeds. */
class Feeds {
  /** What the screens show: the developed picture, with its smaller copies. */
  readonly texture: THREE.Texture;
  private readonly canvas = document.createElement('canvas');
  private readonly g: CanvasRenderingContext2D;
  /** The painted picture as it is sent to the graphics card: plain numbers. */
  private readonly painted: THREE.CanvasTexture;
  /** Where the graphics card develops it. */
  private readonly developed: THREE.WebGLRenderTarget;
  private readonly developer = new THREE.Scene();
  private readonly lens = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  /** True when the picture has been repainted and not yet developed. */
  private fresh = true;
  /** Scanlines and dark corners, laid over every feed like the glass of a real tube. */
  private readonly glass = document.createElement('canvas');
  /** Ready-made frames of static, shown in a random order and mirrored at random. */
  private readonly noise: HTMLCanvasElement[] = [];
  private nextDraw = 0;
  private frame = 0;

  constructor() {
    this.canvas.width = CELL_W * 2;
    this.canvas.height = CELL_H * 2;
    // Painted in ordinary memory, not on the graphics card, so sending it
    // never has to wait for the card to finish painting.
    this.g = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.painted = new THREE.CanvasTexture(this.canvas);
    this.painted.colorSpace = THREE.NoColorSpace;
    this.painted.generateMipmaps = false;
    this.painted.minFilter = THREE.NearestFilter;
    this.painted.magFilter = THREE.NearestFilter;

    // Developing: one flat sheet covering the whole of a second picture,
    // drawn with a shader that turns the stored numbers into light. That
    // second picture keeps smaller copies of itself, worked out in light
    // (not in stored numbers), which is what keeps thin bright text from
    // going dim when a screen is seen from across a room.
    this.developed = new THREE.WebGLRenderTarget(this.canvas.width, this.canvas.height, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.texture = this.developed.texture;
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { uPainted: { value: this.painted } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uPainted;
          varying vec2 vUv;
          void main() {
            gl_FragColor = sRGBTransferEOTF(texture2D(uPainted, vUv));
          }`,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    sheet.frustumCulled = false;
    this.developer.add(sheet);

    this.glass.width = CELL_W;
    this.glass.height = CELL_H;
    const glass = this.glass.getContext('2d')!;
    glass.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = 0; y < CELL_H; y += 3) glass.fillRect(0, y, CELL_W, 1);
    const fall = glass.createRadialGradient(CELL_W / 2, CELL_H / 2, CELL_H * 0.3, CELL_W / 2, CELL_H / 2, CELL_W * 0.72);
    fall.addColorStop(0, 'rgba(0,0,0,0)');
    fall.addColorStop(1, 'rgba(0,0,0,0.75)');
    glass.fillStyle = fall;
    glass.fillRect(0, 0, CELL_W, CELL_H);

    const columns = CELL_W / NOISE_BLOCK;
    const rows = CELL_H / NOISE_BLOCK;
    for (let i = 0; i < NOISE_FRAMES; i++) {
      const tile = document.createElement('canvas');
      tile.width = columns;
      tile.height = rows;
      const paint = tile.getContext('2d')!;
      const image = paint.createImageData(columns, rows);
      for (let p = 0; p < columns * rows; p++) {
        const v = Math.floor(Math.random() * 150);
        image.data[p * 4] = v;
        image.data[p * 4 + 1] = v + 6;
        image.data[p * 4 + 2] = v + 14;
        image.data[p * 4 + 3] = 255;
      }
      paint.putImageData(image, 0, 0);
      this.noise.push(tile);
    }
    this.draw(0);
  }

  update(time: number): void {
    // A restart winds the game's clock back: start counting again from there.
    if (time < this.nextDraw - REPAINT) this.nextDraw = 0;
    if (time < this.nextDraw) return;
    this.nextDraw = time + REPAINT;
    this.draw(time);
  }

  private draw(time: number): void {
    const g = this.g;
    this.frame++;
    g.fillStyle = '#050607';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // With ARGUS off: its eye is gone from the screens (static), the log
    // says so, and the lockdown notice gives way to the override's.
    this.cell(0, 0, () => (argusOnline ? this.drawEye(time) : this.drawStatic()));
    this.cell(1, 0, () => this.drawLog());
    this.cell(0, 1, () => this.drawStatic());
    this.cell(1, 1, () => (argusOnline ? this.drawLockdown(time) : this.drawOverride()));
    this.painted.needsUpdate = true;
    this.fresh = true;
  }

  /** Paint the picture again at the next opportunity (what the feeds show has changed). */
  repaint(): void {
    this.nextDraw = 0;
  }

  /** Hand a freshly painted picture to the graphics card and develop it. */
  develop(renderer: THREE.WebGLRenderer): void {
    if (!this.fresh) return;
    this.fresh = false;
    const before = renderer.getRenderTarget();
    renderer.setRenderTarget(this.developed);
    renderer.render(this.developer, this.lens);
    renderer.setRenderTarget(before);
  }

  private cell(cx: number, cy: number, paint: () => void): void {
    const g = this.g;
    g.save();
    g.translate(cx * CELL_W, cy * CELL_H);
    g.beginPath();
    g.rect(0, 0, CELL_W, CELL_H);
    g.clip();
    paint();
    g.drawImage(this.glass, 0, 0);
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
    const lines = argusOnline ? LOG_LINES : OFFLINE_LINES;
    const start = argusOnline ? Math.floor(this.frame / 7) : 0;
    for (let i = 0; i < 9; i++) {
      const line = lines[(start + i) % lines.length]!;
      g.globalAlpha = i === 8 ? 1 : 0.55 + i * 0.04;
      g.fillText(line, 12, 24 + i * 18);
    }
    g.globalAlpha = 1;
    if (this.frame % 8 < 4) g.fillRect(12, 24 + 9 * 18 - 11, 8, 13);
  }

  private drawStatic(): void {
    const g = this.g;
    // One of the ready-made frames, blown up without smoothing and mirrored
    // at random, so the same frame rarely looks the same twice.
    const tile = this.noise[Math.floor(Math.random() * this.noise.length)]!;
    const flipX = Math.random() < 0.5;
    const flipY = Math.random() < 0.5;
    g.save();
    g.imageSmoothingEnabled = false;
    g.translate(flipX ? CELL_W : 0, flipY ? CELL_H : 0);
    g.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    g.drawImage(tile, 0, 0, CELL_W, CELL_H);
    g.restore();
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(52, 78, 152, 36);
    g.fillStyle = '#dfe8f0';
    g.font = '700 20px "Share Tech Mono", monospace';
    g.textAlign = 'center';
    g.fillText('SIGNAL LOST', CELL_W / 2, 103);
    g.textAlign = 'left';
  }

  /** What the lockdown screens show once the kill switch has been pulled. */
  private drawOverride(): void {
    const g = this.g;
    g.fillStyle = '#031116';
    g.fillRect(0, 0, CELL_W, CELL_H);
    g.fillStyle = '#4fe6ff';
    g.fillRect(0, 26, CELL_W, 3);
    g.fillRect(0, CELL_H - 29, CELL_W, 3);
    g.textAlign = 'center';
    g.font = '700 34px "Barlow Condensed", sans-serif';
    g.fillText('ARGUS OFFLINE', CELL_W / 2, CELL_H / 2 + 2);
    g.font = '400 13px "Share Tech Mono", monospace';
    g.fillText('MANUAL OVERRIDE ENGAGED', CELL_W / 2, CELL_H / 2 + 28);
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

// Made when the first bank of screens is built (by then the fonts the feeds
// are written in have loaded).
let feeds: Feeds | null = null;

/**
 * Send the monitors' picture to the graphics card if it has been repainted
 * since the last call. Call once a frame, before the scene is drawn (and
 * once before anything photographs the rooms).
 */
export function developScreens(renderer: THREE.WebGLRenderer): void {
  feeds?.develop(renderer);
}

/** The monitors of one room. */
export class ScreenBank {
  readonly object = new THREE.Group();
  private readonly quads: THREE.BufferGeometry[] = [];
  private readonly feeds: Feeds;

  constructor() {
    this.feeds = feeds ??= new Feeds();
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
    const material = new THREE.MeshBasicMaterial({ map: this.feeds.texture, toneMapped: false, fog: false });
    // Above 1.0 so the screens glow through the bloom pass.
    material.color.setScalar(2.4);
    const mesh = new THREE.Mesh(mergeGeometries(this.quads)!, material);
    mesh.matrixAutoUpdate = false;
    this.object.add(mesh);
  }

  /** Keep the feeds moving. Safe to call from every room each frame. */
  update(time: number): void {
    this.feeds.update(time);
  }
}
