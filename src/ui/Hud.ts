// The heads-up display: crosshair and hit markers, health, the weapon and
// its ammunition, scrap, the round, the mission's objective and a marker
// pointing to it, purchase prompts, markers on the last few robots, and the
// damage direction indicator. Plain HTML laid over the 3D canvas, so it
// stays crisp at any resolution.

import type { QualityLevel } from '../config';
import { ARGUS, QUALITY } from '../config';
import { settings } from '../core/settings';
import type { HintId } from '../sim/coach';
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
  /** Grenades in the pouch, and the most it holds. */
  grenades: number;
  grenadeMax: number;
  /** The boosts the player has: each one's name and its colour. */
  boosts: Array<{ name: string; color: string }>;
  /** Timed pickups in force: each one's name, its colour, and how much of its time is left (seconds, and of how many). */
  effects: Array<{ name: string; color: string; left: number; total: number }>;
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
  /** The first-minute hint to show, and whether the player has just done it; null for none. */
  coach: { hint: HintId; done: boolean } | null;
}

/** The first-minute hints as they are shown: the key or keys, and what they do, in as few words as will do. */
const COACH_TEXT: Record<HintId, { keys: string[]; text: string }> = {
  move: { keys: ['W', 'A', 'S', 'D'], text: 'MOVE' },
  fire: { keys: ['LEFT CLICK'], text: 'FIRE' },
  aim: { keys: ['HOLD RIGHT CLICK'], text: 'AIM' },
  jump: { keys: ['SPACE'], text: 'JUMP OVER LOW THINGS' },
  marker: { keys: ['\u25c6'], text: 'FOLLOW THE MARKER TO YOUR OBJECTIVE' },
  buy: { keys: ['F'], text: 'BUY: WALK UP TO A WEAPON ON THE WALL' },
};

/** What ARGUS's banner shows: the round the counters are for, and what it saw and is doing about it. */
export interface HudAnalysis {
  round: number;
  lines: Array<{ observed: string; adapting: string }>;
}

/** Why a hit did less than it might have: the word shown under the crosshair. */
export type HitNote = 'resisted' | 'plated' | 'guarded' | 'guardBroke' | 'turned' | 'immune';
const HIT_NOTES: Record<HitNote, string> = { resisted: 'RESISTED', plated: 'ARMOUR', guarded: 'PLATE', guardBroke: 'PLATE OFF', turned: 'TURNED', immune: 'CANNOT BE TURNED' };

/**
 * ARGUS's mark, as it is painted on the facility's walls: an almond eye in
 * a ring broken into three arcs. (The same drawing as drawArgusEye in
 * world/build/SignAtlas.ts, as a vector so that it is sharp at any size.)
 */
const EYE_MARK =
  '<svg class="moment-eye" viewBox="-50 -50 100 100" aria-hidden="true">' +
  '<circle class="ring" r="46" stroke-dasharray="81.63 14.72" transform="rotate(-80.83)"/>' +
  '<path class="lid" d="M-33 0Q0-31 33 0Q0 31-33 0Z"/>' +
  '<circle class="iris" r="10"/>' +
  '</svg>';

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
  private readonly grenadePips: HTMLElement;
  private readonly boostRow: HTMLElement;
  private readonly effectRow: HTMLElement;
  /** The draining bar of each timed pickup on show, in the order they are listed. */
  private effectBars: HTMLElement[] = [];
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
  private readonly failsafePanel: HTMLElement;
  private readonly failsafeTitle: HTMLElement;
  private readonly failsafeSub: HTMLElement;
  /** When the fail-safe's words come down again (real time, in milliseconds; 0 = they are not up). */
  private failsafeUntil = 0;
  private readonly coach: HTMLElement;
  private readonly coachKeys: HTMLElement;
  private readonly coachText: HTMLElement;
  private coachShown = '';
  private readonly debug: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly hitNote: HTMLElement;
  private readonly analysisPanel: HTMLElement;
  private readonly analysisRound: HTMLElement;
  private readonly analysisLines: HTMLElement;
  private readonly remarkLine: HTMLElement;
  private readonly remarkText: HTMLElement;
  // When each of these comes down, by the clock on the wall (the game's own
  // clock can be stopped or stepped by the debug tools; what is on screen
  // for a person to read should not be).
  private analysisUntil = 0;
  /** The analysis as it arrives: large, near the top centre. */
  private readonly momentPanel: HTMLElement;
  private readonly momentRound: HTMLElement;
  private readonly momentLines: HTMLElement;
  /** When the large analysis is due to shrink into the corner (0 = it is not up). */
  private momentUntil = 0;
  /** An analysis that arrived while a round or mission announcement was on screen: shown when that has gone. */
  private waitingAnalysis: HudAnalysis | null = null;
  /** Mission notices that arrived while the large analysis was up: shown when it has shrunk. */
  private readonly heldNotices: Array<[string, string]> = [];
  /** A stage of the analysis held on screen (for screenshots), or null when it runs to its own clock. */
  private heldStage: 'moment' | 'corner' | null = null;
  /** Whether the HUD is meant to be on screen, and whether it is being drawn once ahead of time (see prewarm). */
  private visible = true;
  private warming = false;
  private remarkUntil = 0;
  private hitNoteUntil = 0;

  private hitTimer = 0;
  private damageTimer = 0;
  private damageAngle = 0;
  private toastTimer = 0;
  private hintTimer = 16;
  private shownScrap = -1;
  private last = { ammo: -1, reserve: -1, weapon: '', sub: '', slots: '', fps: '', prompt: '', debug: '', scrap: '', objective: '', keys: '', boss: '', bossHealth: '', markerAt: '', markerDistance: '', markerLook: '', grenades: '', boosts: '', effects: '' };

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

    // Timed pickups in force, each with a bar that drains; and under them the boosts the player has.
    this.effectRow = el('div', 'hud-effects', this.root);
    this.healthBlock = el('div', 'hud-health', this.root);
    this.boostRow = el('div', 'hud-boosts', this.healthBlock);
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
    const grenades = el('div', 'hud-grenades', this.ammoBlock);
    el('b', '', grenades, 'G');
    el('span', '', grenades, 'GRENADES');
    this.grenadePips = el('span', 'hud-grenade-pips', grenades);

    this.prompt = el('div', 'hud-prompt', this.root);
    const line = el('div', 'hud-prompt-line', this.prompt);
    el('kbd', '', line, 'F');
    this.promptText = el('span', 'hud-prompt-text', line);
    this.promptCost = el('span', 'hud-prompt-cost', line);
    this.promptNote = el('div', 'hud-prompt-note', this.prompt);

    this.hint = el('div', 'hud-hint', this.root);
    this.hint.innerHTML =
      '<b>WASD</b> move <i>·</i> <b>CLICK</b> fire <i>·</i> <b>RIGHT CLICK</b> aim <i>·</i> <b>SPACE</b> jump <i>·</i> <b>R</b> reload <i>·</i> <b>V</b> melee <i>·</i> <b>G</b> grenade <i>·</i> <b>F</b> use <i>·</i> <b>1 2</b> weapons <i>·</i> <b>SHIFT</b> sprint <i>·</i> <b>ESC</b> pause';
    // The first-minute hints: one at a time, larger, above where a price appears.
    this.coach = el('div', 'hud-coach', this.root);
    this.coachKeys = el('span', 'hud-coach-keys', this.coach);
    this.coachText = el('span', 'hud-coach-text', this.coach);
    el('span', 'hud-coach-tick', this.coach, '\u2713');
    this.toast = el('div', 'hud-toast', this.root);

    // The fail-safe's moment, across the middle of the view: a pulse line
    // that goes flat when the player goes down and beats again when it
    // brings them back, with the word for each over it.
    this.failsafePanel = el('div', 'hud-failsafe', this.root);
    this.failsafePanel.innerHTML =
      '<svg class="fs-pulse" viewBox="0 0 1000 100" preserveAspectRatio="none"><path d="M0 50 L392 50 L412 44 L430 50 L446 18 L470 88 L494 6 L516 72 L532 50 L552 44 L570 50 L1000 50" /></svg><div class="fs-title"></div><div class="fs-sub"></div>';
    this.failsafeTitle = this.failsafePanel.querySelector('.fs-title') as HTMLElement;
    this.failsafeSub = this.failsafePanel.querySelector('.fs-sub') as HTMLElement;

    // Under the crosshair: why a hit did less than it might have.
    this.hitNote = el('div', 'hit-note', this.root);

    // ARGUS's side of the screen (the player's objective is on the left,
    // in the mission's colour; what ARGUS has made of them is on the
    // right, in its own): the analysis shown between rounds, and under it
    // the remarks it passes during them.
    const argus = el('div', 'hud-argus', this.root);
    this.analysisPanel = el('div', 'argus-analysis', argus);
    const head = el('div', 'argus-head', this.analysisPanel);
    el('i', 'argus-eye', head);
    el('span', 'argus-title', head, 'ARGUS ANALYSIS');
    this.analysisRound = el('span', 'argus-round', head);
    this.analysisLines = el('div', 'argus-lines', this.analysisPanel);
    this.remarkLine = el('div', 'argus-remark', argus);
    el('span', 'argus-remark-name', this.remarkLine, 'ARGUS');
    this.remarkText = el('span', 'argus-remark-text', this.remarkLine);

    // The analysis is the one idea the game is built around, so it arrives
    // as a moment: large, near the top centre, under ARGUS's mark, for
    // about two seconds. Then it shrinks into the corner above, where it
    // stays for the rest of the lull. It is lettering on a dark band: it
    // never stops the game, and it ends well above the crosshair.
    // (Two boxes: the outer one is moved and faded when the moment ends,
    // the inner one is what arrives. An element cannot do both: a browser
    // will not start a transition on something an animation has just had.)
    this.momentPanel = el('div', 'argus-moment', this.root);
    const band = el('div', 'moment-band', this.momentPanel);
    const momentHead = el('div', 'moment-head', band);
    momentHead.insertAdjacentHTML('beforeend', EYE_MARK);
    el('span', 'moment-title', momentHead, 'ARGUS ANALYSIS');
    this.momentRound = el('span', 'moment-round', momentHead);
    this.momentLines = el('div', 'moment-lines', band);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    // (A run begun during the warm-up is shown at full strength at once.)
    if (visible) this.root.classList.remove('prewarm');
    this.root.classList.toggle('hidden', !visible && !this.warming);
  }

  /**
   * Paint, once, the things that are costly to paint for the first time,
   * while the title screen is up and nobody can feel it.
   *
   * The first time ARGUS's large banner appeared, the picture stopped for
   * a fifth of a second: the browser was building, on the graphics card,
   * what it needs to draw big soft-shadowed lettering on a faded band, and
   * the game shares that card. The second time cost nothing. So the whole
   * HUD is drawn once here at two hundredths of full strength, with the
   * banner, the corner panel, a remark and the RESISTED word all up, and
   * taken down again well before a round can start.
   */
  prewarm(): void {
    if (this.warming) return;
    this.warming = true;
    this.root.classList.add('prewarm');
    this.root.classList.remove('hidden');
    this.analysis({ round: 1, lines: [{ observed: 'Nothing yet.', adapting: 'Adapting: nothing. Yet.' }] });
    this.analysisPanel.classList.add('show');
    this.remark('...');
    this.hit(false, false, 'resisted', 0x4f8dff);
    window.setTimeout(() => {
      this.warming = false;
      this.root.classList.remove('prewarm');
      // (If a run has begun meanwhile, its own reset has cleared all this already.)
      if (!this.visible) {
        this.reset();
        this.root.classList.add('hidden');
      }
    }, 700);
  }

  /** A new run: clear everything left over from the last one. */
  reset(): void {
    this.hintTimer = 16;
    this.hint.classList.remove('faded');
    this.coach.classList.remove('show', 'done');
    this.coachShown = '';
    this.failsafeUntil = 0;
    this.failsafePanel.className = 'hud-failsafe';
    this.announcer.reset();
    this.scrapPops.textContent = '';
    this.shownScrap = -1;
    this.damageTimer = 0;
    this.hitTimer = 0;
    this.hitMarker.className = 'hitmarker';
    this.hitNoteUntil = 0;
    this.hitNote.classList.remove('show');
    this.analysisUntil = 0;
    this.analysisPanel.classList.remove('show');
    this.momentUntil = 0;
    this.momentPanel.className = 'argus-moment';
    this.waitingAnalysis = null;
    this.heldNotices.length = 0;
    this.heldStage = null;
    this.remarkUntil = 0;
    this.remarkLine.classList.remove('show');
  }

  /**
   * A shot landed. `weak` = weak-point hit, `kill` = it destroyed the
   * robot. `note` says why it did less than it might have, if it did: the
   * robot's shielding, a heavy's plating, or the plate over a weak point.
   * `tint` is the colour of the shielding that turned it, if any did.
   */
  hit(weak: boolean, kill: boolean, note: HitNote | null = null, tint: number | null = null): void {
    this.hitTimer = kill ? 0.32 : 0.16;
    this.hitMarker.className = `hitmarker show${weak ? ' weak' : ''}${kill ? ' kill' : ''}${note && !kill ? ' dull' : ''}`;
    // Restart the pop animation.
    void this.hitMarker.offsetWidth;
    this.hitMarker.classList.add('pop');
    if (note) {
      // The word snaps in the first time. While it is still up (a burst of
      // automatic fire into the same plating) it simply stays: a word that
      // jumped with every round would strobe.
      const now = performance.now();
      const again = this.hitNoteUntil > now && this.hitNote.textContent === HIT_NOTES[note];
      this.hitNote.textContent = HIT_NOTES[note];
      // (RESISTED is written in the colour of the plating that did it.)
      this.hitNote.style.setProperty('--tint', tint === null ? '#9fc4ff' : `#${tint.toString(16).padStart(6, '0')}`);
      this.hitNote.className = `hit-note show ${note}${settings.value.reducedMotion ? ' calm' : ''}`;
      if (!again) void this.hitNote.offsetWidth;
      this.hitNote.classList.add('pop');
      this.hitNoteUntil = now + (note === 'guardBroke' || note === 'turned' || note === 'immune' ? 1100 : note === 'resisted' ? 850 : 550);
    }
  }

  /**
   * ARGUS has finished its analysis of the round. It is shown large, near
   * the top centre, for a couple of seconds; then it shrinks into ARGUS's
   * corner and stays there until the next round begins. The game carries
   * on behind it throughout.
   */
  analysis(analysis: HudAnalysis): void {
    // (One thing at a time at the top of the view: it waits for a round or mission announcement to finish.)
    if (this.announcer.status.showing !== 'none') {
      this.waitingAnalysis = analysis;
      return;
    }
    this.waitingAnalysis = null;
    // The same words twice over: large for the moment, small for the corner.
    for (const [prefix, round, lines] of [
      ['argus', this.analysisRound, this.analysisLines],
      ['moment', this.momentRound, this.momentLines],
    ] as const) {
      round.textContent = `ROUND ${analysis.round}`;
      lines.textContent = '';
      analysis.lines.forEach((line, i) => {
        const row = el('div', `${prefix}-line`, lines);
        row.style.setProperty('--i', String(i));
        const seen = el('div', `${prefix}-observed`, row);
        el('b', '', seen, 'OBSERVED');
        el('span', '', seen, line.observed);
        // "Adapting: rifle-resistant plating." becomes a label and what follows it.
        const colon = line.adapting.indexOf(':');
        const doing = el('div', `${prefix}-adapting ${line.adapting.slice(0, colon).toLowerCase()}`, row);
        el('b', '', doing, line.adapting.slice(0, colon).toUpperCase());
        el('span', '', doing, line.adapting.slice(colon + 1).trim());
      });
    }
    const calm = settings.value.reducedMotion;
    const now = performance.now();
    this.analysisPanel.classList.remove('show', 'docked');
    this.momentPanel.className = `argus-moment${calm ? ' calm' : ''}${analysis.lines.length > 2 ? ' many' : ''}`;
    void this.momentPanel.offsetWidth;
    this.momentPanel.classList.add('show');
    this.momentUntil = now + ARGUS.momentSeconds * 1000;
    this.analysisUntil = now + ARGUS.bannerSeconds * 1000;
  }

  /** The moment is over: the large analysis flies to ARGUS's corner as it fades, and the small one there takes its place. */
  private dockAnalysis(): void {
    this.momentUntil = 0;
    const calm = settings.value.reducedMotion;
    const from = this.momentPanel.getBoundingClientRect();
    const to = this.analysisPanel.getBoundingClientRect();
    const style = this.momentPanel.style;
    style.setProperty('--dx', `${(to.left + to.width / 2 - (from.left + from.width / 2)).toFixed(1)}px`);
    style.setProperty('--dy', `${(to.top + to.height / 2 - (from.top + from.height / 2)).toFixed(1)}px`);
    style.setProperty('--s', (from.width > 0 ? Math.min(1, to.width / from.width) : 0.5).toFixed(3));
    this.momentPanel.classList.remove('show');
    this.momentPanel.classList.add('leave');
    this.analysisPanel.classList.toggle('calm', calm);
    this.analysisPanel.classList.remove('show');
    void this.analysisPanel.offsetWidth;
    this.analysisPanel.classList.add('show', 'docked');
    for (const [title, detail] of this.heldNotices.splice(0)) this.announcer.notice(title, detail);
  }

  /** Take the analysis off the screen, whichever stage it is at. */
  private clearAnalysis(): void {
    this.analysisUntil = 0;
    this.momentUntil = 0;
    this.waitingAnalysis = null;
    this.momentPanel.classList.remove('show', 'leave');
    this.analysisPanel.classList.remove('show');
    for (const [title, detail] of this.heldNotices.splice(0)) this.announcer.notice(title, detail);
  }

  /**
   * Hold the analysis at one of its two stages, or let it go (for staged
   * screenshots and the checks: its own clock is real time, and they run
   * the game faster or slower than that).
   */
  holdAnalysis(stage: 'moment' | 'corner' | null): void {
    this.heldStage = stage;
    if (stage === null) return;
    if (this.waitingAnalysis) {
      this.announcer.dismiss();
      this.analysis(this.waitingAnalysis);
    }
    if (stage === 'corner' && this.momentUntil) this.dockAnalysis();
  }

  /** ARGUS passes a remark. */
  remark(line: string): void {
    this.remarkText.textContent = line;
    this.remarkLine.style.setProperty('--chars', String(line.length));
    this.remarkLine.classList.toggle('calm', settings.value.reducedMotion);
    this.remarkLine.classList.remove('show');
    void this.remarkLine.offsetWidth;
    this.remarkLine.classList.add('show');
    this.remarkUntil = performance.now() + ARGUS.remarkSeconds * 1000;
  }

  /** Take down ARGUS's banner and remark at once (for staged screenshots). */
  dismissArgus(): void {
    this.heldStage = null;
    this.clearAnalysis();
    this.remarkUntil = 0;
    this.remarkLine.classList.remove('show');
  }

  /** What ARGUS has on screen right now (for the checks): the analysis large ('moment'), in its corner, or not at all; and its remark. */
  get argusShowing(): { analysis: 'moment' | 'corner' | 'waiting' | null; remark: string | null } {
    const analysis = this.waitingAnalysis ? 'waiting' : this.momentUntil > 0 ? 'moment' : this.analysisUntil > 0 ? 'corner' : null;
    return { analysis, remark: this.remarkUntil > 0 ? this.remarkText.textContent : null };
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

  /** A round has begun, with this many robots on their way (`swarm`: all of them drones). */
  roundStarted(round: number, robots: number, swarm = false): void {
    // The lull is over, and ARGUS's analysis with it. (What it decided is on the robots now.)
    if (this.heldStage === null) this.clearAnalysis();
    this.announcer.begin(round, robots, swarm);
  }

  /** A round has been cleared, having paid this much scrap. */
  roundCleared(round: number, scrap: number): void {
    this.announcer.cleared(round, scrap);
  }

  /** Something in the mission has happened: a line across the top of the view. */
  notice(title: string, detail: string): void {
    // (One thing at a time at the top of the view: it waits for the large analysis to shrink.)
    if (this.momentUntil) this.heldNotices.push([title, detail]);
    else this.announcer.notice(title, detail);
  }

  /**
   * The fail-safe's moment: 'down' when the blow lands (it stays up until
   * the fail-safe fires), 'up' when it does (and then clears by itself).
   */
  failsafe(phase: 'down' | 'up'): void {
    this.failsafePanel.className = `hud-failsafe show ${phase}`;
    this.failsafeTitle.textContent = phase === 'down' ? 'DOWN' : 'FAILSAFE ENGAGED';
    this.failsafeSub.textContent = phase === 'down' ? 'VITAL SIGNS LOST' : 'BACK ON YOUR FEET';
    this.failsafeUntil = phase === 'up' ? performance.now() + 1900 : 0;
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
    // (Not under the fail-safe's words, which are where it is.)
    this.crosshair.style.opacity = this.failsafePanel.classList.contains('show') ? '0' : String(Math.max(0, 1 - state.aim * 1.6) * (state.sprinting || state.reloading ? 0.35 : 1));

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

    // Grenades: a pip for each one the pouch holds, lit for each one in it.
    const grenades = `${state.grenades}/${state.grenadeMax}`;
    if (grenades !== last.grenades) {
      last.grenades = grenades;
      this.grenadePips.textContent = '';
      for (let i = 0; i < state.grenadeMax; i++) el('i', i < state.grenades ? 'have' : '', this.grenadePips);
    }
    // The boosts the player has, each in its own colour.
    const boosts = state.boosts.map((boost) => boost.name).join('|');
    if (boosts !== last.boosts) {
      last.boosts = boosts;
      this.boostRow.textContent = '';
      for (const boost of state.boosts) el('span', 'hud-boost', this.boostRow, boost.name).style.setProperty('--tint', boost.color);
    }
    // Timed pickups: named, with a bar that drains as their time runs out.
    const effects = state.effects.map((effect) => effect.name).join('|');
    if (effects !== last.effects) {
      last.effects = effects;
      this.effectRow.textContent = '';
      this.effectBars = state.effects.map((effect) => {
        const item = el('div', 'hud-effect', this.effectRow);
        item.style.setProperty('--tint', effect.color);
        el('span', '', item, effect.name);
        return el('i', '', el('div', 'hud-effect-bar', item));
      });
    }
    if (state.effects.length) this.effectRow.classList.toggle('calm', settings.value.reducedMotion);
    state.effects.forEach((effect, i) => {
      const bar = this.effectBars[i];
      if (bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, effect.left / effect.total)).toFixed(3)})`;
      bar?.parentElement?.parentElement?.classList.toggle('ending', effect.left < 5);
    });

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
    // The first-minute hint, if there is one.
    const coachKey = state.coach ? `${state.coach.hint}|${state.coach.done}` : '';
    if (coachKey !== this.coachShown) {
      if (state.coach && state.coach.hint !== this.coachShown.split('|')[0]) {
        const words = COACH_TEXT[state.coach.hint];
        this.coachKeys.textContent = '';
        for (const key of words.keys) el('kbd', state.coach.hint === 'marker' ? 'mark' : '', this.coachKeys, key);
        this.coachText.textContent = words.text;
      }
      this.coachShown = coachKey;
      this.coach.classList.toggle('show', !!state.coach);
      this.coach.classList.toggle('done', !!state.coach?.done);
    }
    // The control reminder gives way to a prompt, and waits its turn behind the hints.
    this.hint.classList.toggle('faded', this.hintTimer <= 0 || !!prompt || !!state.coach);

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

    if (this.hintTimer > 0 && !state.coach) this.hintTimer -= dt;
    const now = performance.now();
    if (this.failsafeUntil && now >= this.failsafeUntil) {
      this.failsafeUntil = 0;
      this.failsafePanel.classList.remove('show');
    }
    if (this.hitNoteUntil && now >= this.hitNoteUntil) {
      this.hitNoteUntil = 0;
      this.hitNote.classList.remove('show');
    }
    if (this.waitingAnalysis && this.announcer.status.showing === 'none') this.analysis(this.waitingAnalysis);
    if (this.heldStage === null) {
      if (this.momentUntil && now >= this.momentUntil) this.dockAnalysis();
      if (this.analysisUntil && now >= this.analysisUntil) this.clearAnalysis();
    }
    if (this.remarkUntil && now >= this.remarkUntil) {
      this.remarkUntil = 0;
      this.remarkLine.classList.remove('show');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('show');
    }
  }
}
