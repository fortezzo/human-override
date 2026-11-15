// The heads-up display: crosshair and hit markers, health, the weapon and
// its ammunition, scrap, the round, the mission's objective and a marker
// pointing to it, purchase prompts, markers on the last few robots, and the
// damage direction indicator. Plain HTML laid over the 3D canvas, so it
// stays crisp at any resolution.

import type { QualityLevel } from '../config';
import { QUALITY } from '../config';
import { RoundAnnouncer } from './RoundAnnouncer';

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
  /** Stamina for sprinting, 0..1, and whether it has run dry and is still coming back. */
  stamina: number;
  winded: boolean;
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
  /** The mission's next step, which override keys are held, and where the step is (null if nowhere). */
  objective: { title: string; detail: string; keys: boolean[] };
  objectiveMarker: HudMarker | null;
  /** ARGUS's own unit, while it is on the map: its name and how much of it is left, 0..1. */
  boss: { name: string; health: number } | null;
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
  private readonly staminaBar: HTMLElement;
  private readonly staminaFill: HTMLElement;
  private readonly weaponName: HTMLElement;
  private readonly ammo: HTMLElement;
  private readonly reserve: HTMLElement;
  private readonly ammoBlock: HTMLElement;
  private readonly slots: HTMLElement;
  private readonly scrap: HTMLElement;
  private readonly scrapPops: HTMLElement;
  private readonly round: HTMLElement;
  private readonly roundSub: HTMLElement;
  private readonly objectiveTitle: HTMLElement;
  private readonly objectiveDetail: HTMLElement;
  private readonly keyPips: HTMLElement[] = [];
  private readonly objectiveMarker: HTMLElement;
  private readonly boss: HTMLElement;
  private readonly bossName: HTMLElement;
  private readonly bossFill: HTMLElement;
  /** The round announcements, which also keep the corner counter. */
  readonly announcer: RoundAnnouncer;
  private readonly prompt: HTMLElement;
  private readonly promptText: HTMLElement;
  private readonly promptCost: HTMLElement;
  private readonly promptNote: HTMLElement;
  private readonly markers: HTMLElement[] = [];
  /** What each of those markers is showing, so the page is only written to when something changes. */
  private readonly shownMarkers: Array<{ look: string; at: string; distance: string }> = [];
  private readonly fps: HTMLElement;
  private readonly debug: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly toast: HTMLElement;

  private hitTimer = 0;
  private damageTimer = 0;
  private damageAngle = 0;
  private toastTimer = 0;
  private hintTimer = 16;
  private shownScrap = -1;
  private last = { ammo: -1, reserve: -1, weapon: '', sub: '', slots: '', fps: '', prompt: '', debug: '', scrap: '', objective: '', keys: '', boss: '', bossHealth: '', markerAt: '', markerDistance: '', markerLook: '' };

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud', parent);

    const brand = el('div', 'hud-brand', this.root);
    el('div', 'hud-brand-title', brand, 'HUMAN OVERRIDE');
    const roundRow = el('div', 'hud-round', brand);
    el('span', 'hud-label', roundRow, 'ROUND');
    this.round = el('span', 'hud-round-number', roundRow);
    this.roundSub = el('div', 'hud-brand-sub', brand);

    // The mission: what to do next, and the three override keys.
    const objective = el('div', 'hud-objective', this.root);
    const heading = el('div', 'hud-objective-head', objective);
    el('span', 'hud-label', heading, 'OBJECTIVE');
    const pips = el('span', 'hud-keys', heading);
    for (let i = 0; i < 3; i++) this.keyPips.push(el('i', '', pips));
    this.objectiveTitle = el('div', 'hud-objective-title', objective);
    this.objectiveDetail = el('div', 'hud-objective-detail', objective);

    // ARGUS's own unit: its name and what is left of it, top centre.
    this.boss = el('div', 'hud-boss hidden', this.root);
    this.bossName = el('div', 'hud-boss-name', this.boss);
    this.bossFill = el('div', 'hud-boss-fill', el('div', 'hud-boss-bar', this.boss));

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
      this.shownMarkers.push({ look: 'hidden', at: '', distance: '' });
    }

    this.objectiveMarker = el('div', 'objective-marker hidden', this.root);
    el('i', '', this.objectiveMarker);
    el('span', '', this.objectiveMarker);

    this.announcer = new RoundAnnouncer(this.root, this.round);

    this.healthBlock = el('div', 'hud-health', this.root);
    el('div', 'hud-label', this.healthBlock, 'VITALS');
    const bar = el('div', 'hud-bar', this.healthBlock);
    this.healthFill = el('div', 'hud-bar-fill', bar);
    // Stamina: a thin line under the vitals, bright while it is in use.
    this.staminaBar = el('div', 'hud-stamina', this.healthBlock);
    this.staminaFill = el('div', 'hud-stamina-fill', this.staminaBar);

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
      '<b>WASD</b> move <i>·</i> <b>CLICK</b> fire <i>·</i> <b>RIGHT CLICK</b> aim <i>·</i> <b>R</b> reload <i>·</i> <b>V</b> melee <i>·</i> <b>F</b> use <i>·</i> <b>1 2</b> weapons <i>·</i> <b>SHIFT</b> sprint <i>·</i> <b>ESC</b> pause';
    this.toast = el('div', 'hud-toast', this.root);
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  /** A new run: clear everything left over from the last one. */
  reset(): void {
    this.hintTimer = 16;
    this.hint.classList.remove('faded');
    this.announcer.reset();
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

  /** A round has begun, with this many robots on their way. */
  roundStarted(round: number, robots: number): void {
    this.announcer.begin(round, robots);
  }

  /** A round has been cleared, having paid this much scrap. */
  roundCleared(round: number, scrap: number): void {
    this.announcer.cleared(round, scrap);
  }

  /** Something in the mission has happened: a line across the top of the view. */
  notice(title: string, detail: string): void {
    this.announcer.notice(title, detail);
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
    this.staminaFill.style.transform = `scaleX(${Math.max(0, Math.min(1, state.stamina)).toFixed(3)})`;
    this.staminaBar.classList.toggle('resting', state.stamina >= 0.999);
    this.staminaBar.classList.toggle('winded', state.winded);

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
    }
    const scrapText = this.shownScrap.toLocaleString('en-US');
    if (scrapText !== last.scrap) {
      last.scrap = scrapText;
      this.scrap.textContent = scrapText;
    }

    // The round counter belongs to the announcer: it takes each new number
    // when the announcement's numeral lands on it.
    this.announcer.sync(state.round);
    this.announcer.update();
    const sub = state.remaining > 0 ? `${state.area.toUpperCase()} · ${state.remaining} ROBOT${state.remaining === 1 ? '' : 'S'} LEFT` : state.area.toUpperCase();
    if (sub !== last.sub) {
      last.sub = sub;
      this.roundSub.textContent = sub;
    }

    // The mission: its next step, the keys held, and a marker on where to go.
    const objectiveKey = `${state.objective.title}|${state.objective.detail}`;
    if (objectiveKey !== last.objective) {
      // A new step (not just its clock ticking) is drawn attention to.
      if (state.objective.title !== this.objectiveTitle.textContent) {
        this.objectiveTitle.classList.remove('fresh');
        void this.objectiveTitle.offsetWidth;
        this.objectiveTitle.classList.add('fresh');
      }
      last.objective = objectiveKey;
      this.objectiveTitle.textContent = state.objective.title;
      this.objectiveDetail.textContent = state.objective.detail;
    }
    const keys = state.objective.keys.map((held) => (held ? '1' : '0')).join('');
    if (keys !== last.keys) {
      last.keys = keys;
      this.keyPips.forEach((pip, i) => pip.classList.toggle('held', !!state.objective.keys[i]));
    }
    const target = state.objectiveMarker;
    const markerLook = !target ? 'hidden' : `${target.onScreen ? '' : 'edge'}${target.onScreen && target.distance < 3 ? ' near' : ''}`;
    if (markerLook !== last.markerLook) {
      last.markerLook = markerLook;
      // ("near": close enough to see the thing itself, so the marker gets out of the way.)
      this.objectiveMarker.className = `objective-marker ${markerLook}`;
    }
    if (target) {
      // Moved by transform, on a layer of its own, and written only when it
      // changes: it is on screen for the whole run, and placing it by
      // "left" and "top" made the browser lay the HUD out and repaint it on
      // every frame (about a millisecond a frame, measured).
      const x = Math.round(((target.x + 1) / 2) * window.innerWidth);
      const y = Math.round(((1 - target.y) / 2) * window.innerHeight);
      const at = `${x},${y}`;
      if (at !== last.markerAt) {
        last.markerAt = at;
        this.objectiveMarker.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      }
      const distance = `${Math.round(target.distance)} M`;
      if (distance !== last.markerDistance) {
        last.markerDistance = distance;
        (this.objectiveMarker.lastElementChild as HTMLElement).textContent = distance;
      }
    }
    const bossKey = state.boss ? state.boss.name : '';
    if (bossKey !== last.boss) {
      last.boss = bossKey;
      this.boss.classList.toggle('hidden', !state.boss);
      this.bossName.textContent = bossKey;
    }
    const bossHealth = state.boss ? Math.max(0, Math.min(1, state.boss.health)).toFixed(3) : '';
    if (bossHealth !== last.bossHealth) {
      last.bossHealth = bossHealth;
      if (state.boss) this.bossFill.style.transform = `scaleX(${bossHealth})`;
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

    // Markers on the last few robots (placed the same way as the objective's marker).
    for (let i = 0; i < MAX_MARKERS; i++) {
      const marker = this.markers[i]!;
      const data = state.markers[i];
      const shown = this.shownMarkers[i]!;
      const look = !data ? 'hidden' : data.onScreen ? '' : 'edge';
      if (look !== shown.look) {
        shown.look = look;
        marker.className = `robot-marker ${look}`;
      }
      if (!data) continue;
      const at = `${Math.round(((data.x + 1) / 2) * window.innerWidth)}px, ${Math.round(((1 - data.y) / 2) * window.innerHeight)}px`;
      if (at !== shown.at) {
        shown.at = at;
        marker.style.transform = `translate3d(${at}, 0)`;
      }
      const distance = `${Math.round(data.distance)} M`;
      if (distance !== shown.distance) {
        shown.distance = distance;
        (marker.lastElementChild as HTMLElement).textContent = distance;
      }
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
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('show');
    }
  }
}
