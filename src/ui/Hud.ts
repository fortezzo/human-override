// The heads-up display: crosshair, hit markers, health, ammunition, the
// damage direction indicator and small status text. Plain HTML laid over
// the 3D canvas, so it stays crisp at any resolution.

import type { QualityLevel } from '../config';
import { QUALITY } from '../config';

function el(tag: string, className: string, parent: HTMLElement, text = ''): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  parent.appendChild(node);
  return node;
}

export class Hud {
  readonly root: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly hitMarker: HTMLElement;
  private readonly damageArc: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly healthBlock: HTMLElement;
  private readonly ammo: HTMLElement;
  private readonly reserve: HTMLElement;
  private readonly ammoBlock: HTMLElement;
  private readonly fps: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly toast: HTMLElement;

  private hitTimer = 0;
  private damageTimer = 0;
  private damageAngle = 0;
  private toastTimer = 0;
  private hintTimer = 14;
  private lastAmmo = -1;
  private lastFpsText = '';

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud', parent);

    const brand = el('div', 'hud-brand', this.root);
    el('div', 'hud-brand-title', brand, 'HUMAN OVERRIDE');
    el('div', 'hud-brand-sub', brand, 'STAGE 0 · LOOK TEST · SECURITY LOBBY');

    this.fps = el('div', 'hud-fps', this.root);

    this.crosshair = el('div', 'crosshair', this.root);
    for (const side of ['t', 'b', 'l', 'r', 'dot']) el('i', side, this.crosshair);
    this.hitMarker = el('div', 'hitmarker', this.root);
    for (let i = 0; i < 4; i++) el('i', '', this.hitMarker);

    const ring = el('div', 'damage-ring', this.root);
    this.damageArc = el('div', 'damage-arc', ring);

    this.healthBlock = el('div', 'hud-health', this.root);
    el('div', 'hud-label', this.healthBlock, 'VITALS');
    const bar = el('div', 'hud-bar', this.healthBlock);
    this.healthFill = el('div', 'hud-bar-fill', bar);

    this.ammoBlock = el('div', 'hud-ammo', this.root);
    el('div', 'hud-label', this.ammoBlock, 'KR-7 CARBINE');
    const row = el('div', 'hud-ammo-row', this.ammoBlock);
    this.ammo = el('span', 'hud-ammo-count', row, '30');
    this.reserve = el('span', 'hud-ammo-reserve', row, '/ ∞');

    this.hint = el('div', 'hud-hint', this.root);
    this.hint.innerHTML =
      '<b>WASD</b> move <i>·</i> <b>MOUSE</b> look <i>·</i> <b>LEFT CLICK</b> fire <i>·</i> <b>RIGHT CLICK</b> aim <i>·</i> <b>R</b> reload <i>·</i> <b>SHIFT</b> sprint <i>·</i> <b>SPACE</b> jump <i>·</i> <b>ESC</b> pause';
    this.toast = el('div', 'hud-toast', this.root);
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  /** A shot landed. `weak` = weak-point hit, `kill` = it destroyed the robot. */
  hit(weak: boolean, kill: boolean): void {
    this.hitTimer = kill ? 0.32 : 0.16;
    this.hitMarker.className = `hitmarker show${weak ? ' weak' : ''}${kill ? ' kill' : ''}`;
    // Restart the pop animation.
    void this.hitMarker.offsetWidth;
    this.hitMarker.classList.add('pop');
  }

  /**
   * The player was hurt. `angle` is the direction to the attacker relative
   * to where the player is looking (0 = ahead, positive = to the right).
   */
  damage(angle: number): void {
    this.damageAngle = angle;
    this.damageTimer = 1.4;
  }

  showToast(text: string, seconds = 4): void {
    this.toast.textContent = text;
    this.toast.classList.add('show');
    this.toastTimer = seconds;
  }

  showFps(visible: boolean): void {
    this.fps.classList.toggle('hidden', !visible);
  }

  update(
    dt: number,
    state: {
      health: number;
      maxHealth: number;
      ammo: number;
      reloading: boolean;
      /** Cone of fire in radians, and the camera's vertical field of view in degrees. */
      spread: number;
      fov: number;
      aim: number;
      sprinting: boolean;
      fps: number;
      quality: QualityLevel;
    },
  ): void {
    // Crosshair gap follows the real cone of fire.
    const pixels = (Math.tan(state.spread) / Math.tan((state.fov * Math.PI) / 360)) * (window.innerHeight / 2);
    this.crosshair.style.setProperty('--gap', `${Math.max(3, pixels).toFixed(1)}px`);
    this.crosshair.style.opacity = String(Math.max(0, 1 - state.aim * 1.6) * (state.sprinting || state.reloading ? 0.35 : 1));

    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.hitMarker.className = 'hitmarker';
    }

    if (this.damageTimer > 0) {
      this.damageTimer -= dt;
      this.damageArc.style.opacity = String(Math.min(1, this.damageTimer / 0.6));
      this.damageArc.style.transform = `rotate(${this.damageAngle}rad)`;
    } else if (this.damageArc.style.opacity !== '0') {
      this.damageArc.style.opacity = '0';
    }

    const health = Math.max(0, state.health / state.maxHealth);
    this.healthFill.style.transform = `scaleX(${health.toFixed(3)})`;
    this.healthBlock.classList.toggle('low', health < 0.4);

    if (state.ammo !== this.lastAmmo) {
      this.lastAmmo = state.ammo;
      this.ammo.textContent = String(state.ammo).padStart(2, '0');
    }
    this.ammoBlock.classList.toggle('low', state.ammo <= 6 && !state.reloading);
    this.ammoBlock.classList.toggle('reloading', state.reloading);
    this.reserve.textContent = state.reloading ? 'RELOADING' : '/ ∞';

    const fpsText = `${Math.round(state.fps)} FPS · ${QUALITY[state.quality].label.toUpperCase()}`;
    if (fpsText !== this.lastFpsText) {
      this.lastFpsText = fpsText;
      this.fps.textContent = fpsText;
    }

    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hint.classList.add('faded');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('show');
    }
  }
}
