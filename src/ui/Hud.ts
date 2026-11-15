// The heads-up display: crosshair and hit markers, health, the weapon and
// its ammunition, scrap, the round, purchase prompts, markers on the last
// few robots, and the damage direction indicator. Plain HTML laid over the
// 3D canvas, so it stays crisp at any resolution.

import type { QualityLevel } from '../config';
import { QUALITY } from '../config';

function el(tag: string, className: string, parent: HTMLElement, text = ''): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  parent.appendChild(node);
  return node;
}

export interface HudPrompt {
  text: string;
  cost: number | null;
  usable: boolean;
  note: string;
}

export interface HudMarker {
  x: number;
  y: number;
  onScreen: boolean;
  distance: number;
}

export interface HudState {
  health: number;
  maxHealth: number;
  weapon: string;
  ammo: number;
  reserve: number;
  lowAmmo: number;
  reloading: boolean;
  /** Names of the weapons carried, and which is in hand. */
  slots: Array<string | null>;
  current: number;
  scrap: number;
  round: number;
  /** Robots left this round. */
  remaining: number;
  area: string;
  prompt: HudPrompt | null;
  markers: HudMarker[];
  /** Cone of fire in radians, and the camera's vertical field of view in degrees. */
  spread: number;
  fov: number;
  aim: number;
  sprinting: boolean;
  fps: number;
  quality: QualityLevel;
  /** Lines for the debug overlay, or null when debug mode is off. */
  debug: string[] | null;
}

const MAX_MARKERS = 3;

export class Hud {
  readonly root: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly hitMarker: HTMLElement;
  private readonly damageArc: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly healthBlock: HTMLElement;
  private readonly weaponName: HTMLElement;
  private readonly ammo: HTMLElement;
  private readonly reserve: HTMLElement;
  private readonly ammoBlock: HTMLElement;
  private readonly slots: HTMLElement;
  private readonly scrap: HTMLElement;
  private readonly scrapPops: HTMLElement;
  private readonly round: HTMLElement;
  private readonly roundSub: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly bannerTitle: HTMLElement;
  private readonly bannerSub: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly promptText: HTMLElement;
  private readonly promptCost: HTMLElement;
  private readonly promptNote: HTMLElement;
  private readonly markers: HTMLElement[] = [];
  private readonly fps: HTMLElement;
  private readonly debug: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly toast: HTMLElement;

  private hitTimer = 0;
  private damageTimer = 0;
  private damageAngle = 0;
  private toastTimer = 0;
  private bannerTimer = 0;
  private hintTimer = 16;
  private shownScrap = -1;
  private last = { ammo: -1, reserve: -1, weapon: '', round: -1, sub: '', slots: '', fps: '', prompt: '', debug: '' };

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud', parent);

    const brand = el('div', 'hud-brand', this.root);
    el('div', 'hud-brand-title', brand, 'HUMAN OVERRIDE');
    const roundRow = el('div', 'hud-round', brand);
    el('span', 'hud-label', roundRow, 'ROUND');
    this.round = el('span', 'hud-round-number', roundRow, '1');
    this.roundSub = el('div', 'hud-brand-sub', brand);

    this.fps = el('div', 'hud-fps', this.root);
    this.debug = el('div', 'hud-debug hidden', this.root);

    this.crosshair = el('div', 'crosshair', this.root);
    for (const side of ['t', 'b', 'l', 'r', 'dot']) el('i', side, this.crosshair);
    this.hitMarker = el('div', 'hitmarker', this.root);
    for (let i = 0; i < 4; i++) el('i', '', this.hitMarker);
    this.scrapPops = el('div', 'scrap-pops', this.root);

    const ring = el('div', 'damage-ring', this.root);
    this.damageArc = el('div', 'damage-arc', ring);

    for (let i = 0; i < MAX_MARKERS; i++) {
      const marker = el('div', 'robot-marker hidden', this.root);
      el('i', '', marker);
      el('span', '', marker);
      this.markers.push(marker);
    }

    this.banner = el('div', 'hud-banner', this.root);
    this.bannerSub = el('div', 'hud-banner-sub', this.banner);
    this.bannerTitle = el('div', 'hud-banner-title', this.banner);

    this.healthBlock = el('div', 'hud-health', this.root);
    el('div', 'hud-label', this.healthBlock, 'VITALS');
    const bar = el('div', 'hud-bar', this.healthBlock);
    this.healthFill = el('div', 'hud-bar-fill', bar);

    this.ammoBlock = el('div', 'hud-ammo', this.root);
    const scrapRow = el('div', 'hud-scrap', this.ammoBlock);
    el('span', 'hud-label', scrapRow, 'SCRAP');
    this.scrap = el('span', 'hud-scrap-count', scrapRow, '0');
    this.weaponName = el('div', 'hud-label', this.ammoBlock);
    const row = el('div', 'hud-ammo-row', this.ammoBlock);
    this.ammo = el('span', 'hud-ammo-count', row, '0');
    this.reserve = el('span', 'hud-ammo-reserve', row, '/ 0');
    this.slots = el('div', 'hud-slots', this.ammoBlock);

    this.prompt = el('div', 'hud-prompt', this.root);
    const line = el('div', 'hud-prompt-line', this.prompt);
    el('kbd', '', line, 'F');
    this.promptText = el('span', 'hud-prompt-text', line);
    this.promptCost = el('span', 'hud-prompt-cost', line);
    this.promptNote = el('div', 'hud-prompt-note', this.prompt);

    this.hint = el('div', 'hud-hint', this.root);
    this.hint.innerHTML =
      '<b>WASD</b> move <i>·</i> <b>CLICK</b> fire <i>·</i> <b>RIGHT CLICK</b> aim <i>·</i> <b>R</b> reload <i>·</i> <b>V</b> melee <i>·</i> <b>F</b> buy <i>·</i> <b>1 2</b> weapons <i>·</i> <b>SHIFT</b> sprint <i>·</i> <b>ESC</b> pause';
    this.toast = el('div', 'hud-toast', this.root);
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  /** A new run: clear everything left over from the last one. */
  reset(): void {
    this.hintTimer = 16;
    this.hint.classList.remove('faded');
    this.bannerTimer = 0;
    this.banner.classList.remove('show');
    this.scrapPops.textContent = '';
    this.shownScrap = -1;
    this.damageTimer = 0;
    this.hitTimer = 0;
    this.hitMarker.className = 'hitmarker';
  }

  /** A shot landed. `weak` = weak-point hit, `kill` = it destroyed the robot. */
  hit(weak: boolean, kill: boolean): void {
    this.hitTimer = kill ? 0.32 : 0.16;
    this.hitMarker.className = `hitmarker show${weak ? ' weak' : ''}${kill ? ' kill' : ''}`;
    // Restart the pop animation.
    void this.hitMarker.offsetWidth;
    this.hitMarker.classList.add('pop');
  }

  /** Scrap was earned (positive) or spent (negative): a number floats up beside the crosshair. */
  scrapChange(amount: number): void {
    const pop = el('div', `scrap-pop${amount < 0 ? ' spent' : amount >= 100 ? ' big' : ''}`, this.scrapPops, `${amount > 0 ? '+' : '−'}${Math.abs(amount)}`);
    pop.style.setProperty('--drift', `${Math.round(Math.random() * 26 - 13)}px`);
    pop.addEventListener('animationend', () => pop.remove());
    // Never let a burst of hits pile up more than a handful of numbers.
    while (this.scrapPops.childElementCount > 6) this.scrapPops.firstElementChild!.remove();
  }

  /**
   * The player was hurt. `angle` is the direction to the attacker relative
   * to where the player is looking (0 = ahead, positive = to the right).
   */
  damage(angle: number): void {
    this.damageAngle = angle;
    this.damageTimer = 1.4;
  }

  /** A large announcement across the top of the view: a round starting or ending. */
  announce(title: string, sub: string, seconds = 3.2): void {
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    this.bannerTimer = seconds;
  }

  showToast(text: string, seconds = 4): void {
    this.toast.textContent = text;
    this.toast.classList.add('show');
    this.toastTimer = seconds;
  }

  showFps(visible: boolean): void {
    this.fps.classList.toggle('hidden', !visible);
  }

  update(dt: number, state: HudState): void {
    const last = this.last;

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

    if (state.weapon !== last.weapon) {
      last.weapon = state.weapon;
      this.weaponName.textContent = state.weapon.toUpperCase();
    }
    if (state.ammo !== last.ammo) {
      last.ammo = state.ammo;
      this.ammo.textContent = String(state.ammo).padStart(2, '0');
    }
    this.ammoBlock.classList.toggle('low', state.ammo <= state.lowAmmo && !state.reloading);
    this.ammoBlock.classList.toggle('reloading', state.reloading);
    this.ammoBlock.classList.toggle('dry', state.reserve === 0 && !state.reloading);
    const reserve = state.reloading ? -1 : state.reserve;
    if (reserve !== last.reserve) {
      last.reserve = reserve;
      this.reserve.textContent = reserve < 0 ? 'RELOADING' : `/ ${reserve}`;
    }
    const slots = state.slots.map((name, i) => `${i === state.current ? '>' : ' '}${name ?? ''}`).join('|');
    if (slots !== last.slots) {
      last.slots = slots;
      this.slots.textContent = '';
      state.slots.forEach((name, i) => {
        const slot = el('span', `hud-slot${i === state.current ? ' current' : ''}${name ? '' : ' empty'}`, this.slots);
        el('b', '', slot, String(i + 1));
        slot.append(name ? name.toUpperCase() : 'EMPTY');
      });
    }

    // Scrap counts up or down to its new value instead of jumping.
    if (this.shownScrap < 0) this.shownScrap = state.scrap;
    if (this.shownScrap !== state.scrap) {
      const gap = state.scrap - this.shownScrap;
      const step = Math.sign(gap) * Math.max(1, Math.ceil(Math.abs(gap) * Math.min(1, dt * 12)));
      this.shownScrap = Math.abs(step) >= Math.abs(gap) ? state.scrap : this.shownScrap + step;
      this.scrap.textContent = this.shownScrap.toLocaleString('en-US');
    } else if (this.scrap.textContent === '') {
      this.scrap.textContent = '0';
    }

    if (state.round !== last.round) {
      last.round = state.round;
      this.round.textContent = String(Math.max(1, state.round));
    }
    const sub = state.remaining > 0 ? `${state.area.toUpperCase()} · ${state.remaining} ROBOT${state.remaining === 1 ? '' : 'S'} LEFT` : state.area.toUpperCase();
    if (sub !== last.sub) {
      last.sub = sub;
      this.roundSub.textContent = sub;
    }

    // Purchase prompt.
    const prompt = state.prompt;
    const promptKey = prompt ? `${prompt.text}|${prompt.cost}|${prompt.usable}|${prompt.note}` : '';
    if (promptKey !== last.prompt) {
      last.prompt = promptKey;
      this.prompt.classList.toggle('show', !!prompt);
      if (prompt) {
        this.prompt.classList.toggle('locked', !prompt.usable);
        this.promptText.textContent = prompt.text;
        this.promptCost.textContent = prompt.cost === null ? '' : `${prompt.cost.toLocaleString('en-US')} SCRAP`;
        const short = prompt.cost !== null && !prompt.usable;
        this.promptNote.textContent = short ? `Not enough scrap: ${(prompt.cost! - state.scrap).toLocaleString('en-US')} more needed` : prompt.note;
      }
    }
    // The control reminder gives way to a prompt.
    this.hint.classList.toggle('faded', this.hintTimer <= 0 || !!prompt);

    // Markers on the last few robots.
    for (let i = 0; i < MAX_MARKERS; i++) {
      const marker = this.markers[i]!;
      const data = state.markers[i];
      marker.classList.toggle('hidden', !data);
      if (!data) continue;
      marker.classList.toggle('edge', !data.onScreen);
      marker.style.left = `${((data.x + 1) / 2) * 100}%`;
      marker.style.top = `${((1 - data.y) / 2) * 100}%`;
      (marker.lastElementChild as HTMLElement).textContent = `${Math.round(data.distance)} M`;
    }

    const fpsText = `${Math.round(state.fps)} FPS · ${QUALITY[state.quality].label.toUpperCase()}`;
    if (fpsText !== last.fps) {
      last.fps = fpsText;
      this.fps.textContent = fpsText;
    }
    const debugText = state.debug ? state.debug.join('\n') : '';
    if (debugText !== last.debug) {
      last.debug = debugText;
      this.debug.classList.toggle('hidden', !state.debug);
      this.debug.textContent = debugText;
    }

    if (this.hintTimer > 0) this.hintTimer -= dt;
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove('show');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('show');
    }
  }
}
