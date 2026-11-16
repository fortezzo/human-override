// The round announcement: the moment a round begins, and the moment it is
// cleared.
//
// A round begins: a red scan line sweeps down the whole view, as if ARGUS
// had just looked the room over, and the round number snaps in behind it,
// large, in the title's lettering with the numeral in red. It is held for
// a second and a half, then the numeral flies up to the round counter in
// the corner, which takes the new number and pulses as it lands.
//
// A round is cleared: one line, "ROUND 4 CLEARED", with the scrap earned
// in that round counting up beneath it.
//
// Both begin on the same instant as their sound (the round sting opens on
// a sharp burst for exactly this). Neither stops the game, and neither
// puts a panel over the view: it is lettering only, above the crosshair,
// and gone in about two seconds.
//
// Every frame of it is placed by this file from one clock, not by CSS
// animations, so it can be frozen at any moment (for a pause, or for a
// screenshot), and so the "reduce screen shake and flashing" setting can
// take the scan line, the interference and the glitch out and leave a
// plain fade.

import { settings } from '../core/settings';

/** Round start, in seconds: the snap in, the hold, the flight to the corner. */
const START = { in: 0.2, hold: 1.5, fly: 0.42 };
/** How long the corner counter pulses after the numeral lands on it. */
const PULSE = 0.6;
/** Round cleared, in seconds: in, hold, out. */
const CLEAR = { in: 0.24, hold: 2.0, out: 0.4 };
/** A notice from the mission, in seconds: in, hold, out. */
const NOTICE = { in: 0.22, hold: 2.5, out: 0.4 };
/** A notice that has waited this long (seconds) for its turn is dropped. */
const STALE = 7;
/** How long the scan line takes to cross the view. */
const SCAN = 0.6;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const easeOutCubic = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
const easeOutExpo = (x: number): number => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(x)));
const easeInOutCubic = (x: number): number => {
  const c = clamp01(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};

function el(tag: string, className: string, parent: HTMLElement, text = ''): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  parent.appendChild(node);
  return node;
}

/**
 * What the corner counter shows before the first round has begun: nothing.
 * (A character with no width, so the line it sits on keeps its height and
 * nothing shifts when the first numeral lands.)
 */
const NO_ROUND = '\u200b';
const SHADE = '0 2px 22px rgba(0, 0, 0, 0.6)';

export class RoundAnnouncer {
  /** Everything the announcements are drawn with: taken out of the picture altogether while nothing is showing. */
  private readonly root: HTMLElement;
  private readonly scan: HTMLElement;
  private readonly lines: HTMLElement;
  private readonly start: HTMLElement;
  private readonly row: HTMLElement;
  private readonly word: HTMLElement;
  private readonly number: HTMLElement;
  private readonly rule: HTMLElement;
  private readonly sub: HTMLElement;
  private readonly clear: HTMLElement;
  private readonly clearNumber: HTMLElement;
  private readonly clearRule: HTMLElement;
  private readonly clearSub: HTMLElement;
  private readonly note: HTMLElement;
  private readonly noteTitle: HTMLElement;
  private readonly noteRule: HTMLElement;
  private readonly noteSub: HTMLElement;
  /** Notices waiting their turn: a title, a second line, and when it was raised. */
  private readonly queue: Array<[string, string, number]> = [];
  /** The notice on screen, so it can be shown again if a round cuts it short. */
  private showing: [string, string, number] | null = null;

  private mode: 'idle' | 'start' | 'clear' | 'notice' = 'idle';
  /** Seconds since the announcement on screen began. */
  private time = 0;
  /** Seconds since the corner counter last took a new number, or -1. */
  private pulse = -1;
  /** The round the corner counter is showing (0 = none yet). */
  private shown = 0;
  /** The round being announced. */
  private round = 0;
  private scrap = 0;
  /** How far, and how much smaller, the numeral has to go to reach the corner. */
  private flight: { dx: number; dy: number; scale: number } | null = null;
  private clock = performance.now();
  /** Debug: hold the announcement at this many seconds in. */
  private frozenAt: number | null = null;
  private lastScrapText = '';

  /**
   * @param parent the HUD
   * @param corner the round counter in the corner, which this takes charge of
   */
  constructor(
    parent: HTMLElement,
    private readonly corner: HTMLElement,
  ) {
    const root = el('div', 'announce', parent);
    this.root = root;
    this.lines = el('div', 'announce-lines', root);
    this.scan = el('div', 'announce-scan', root);

    this.start = el('div', 'announce-start', root);
    this.row = el('div', 'announce-row', this.start);
    this.word = el('span', 'announce-word', this.row, 'ROUND');
    this.number = el('span', 'announce-number', this.row);
    this.rule = el('div', 'announce-rule', this.start);
    this.sub = el('div', 'announce-sub', this.start);

    this.clear = el('div', 'announce-clear', root);
    const title = el('div', 'announce-clear-title', this.clear);
    title.append('ROUND ');
    this.clearNumber = el('span', '', title);
    title.append(' CLEARED');
    this.clearRule = el('div', 'announce-rule', this.clear);
    this.clearSub = el('div', 'announce-sub', this.clear);

    this.note = el('div', 'announce-clear announce-notice', root);
    this.noteTitle = el('div', 'announce-clear-title', this.note);
    this.noteRule = el('div', 'announce-rule', this.note);
    this.noteSub = el('div', 'announce-sub', this.note);

    this.corner.textContent = NO_ROUND;
    this.hide();
  }

  /** A round has begun, with this many robots on their way (`swarm`: all of them drones). */
  begin(round: number, robots: number, swarm = false): void {
    this.settle();
    this.mode = 'start';
    this.time = 0;
    this.round = round;
    this.flight = null;
    this.number.textContent = String(round);
    this.sub.textContent = swarm ? `SWARM · ${robots} DRONES INBOUND` : `${robots} ROBOT${robots === 1 ? '' : 'S'} INBOUND`;
    this.clock = performance.now();
    this.render();
  }

  /** A round has been cleared, having paid this much scrap. */
  cleared(round: number, scrap: number): void {
    this.settle();
    this.mode = 'clear';
    this.time = 0;
    this.round = round;
    this.scrap = scrap;
    this.clearNumber.textContent = String(round);
    this.lastScrapText = '';
    this.clock = performance.now();
    this.render();
  }

  /**
   * Something in the mission has happened: one line and a second, smaller
   * one. It waits its turn if something else is on screen, and is shown
   * again afterwards if a round begins on top of it.
   */
  notice(title: string, detail: string): void {
    this.queue.push([title, detail, performance.now()]);
    if (this.mode === 'idle') this.nextNotice();
  }

  private nextNotice(): void {
    // One that has been waiting longer than a few seconds is no longer news.
    const now = performance.now();
    while (this.queue.length && now - this.queue[0]![2] > STALE * 1000) this.queue.shift();
    const next = this.queue.shift();
    if (!next) return;
    this.showing = next;
    this.mode = 'notice';
    this.time = 0;
    this.noteTitle.textContent = next[0];
    this.noteSub.textContent = next[1];
    this.clock = performance.now();
    this.render();
  }

  /** A new run: nothing on screen and no round on the counter. */
  reset(): void {
    this.queue.length = 0;
    this.showing = null;
    this.mode = 'idle';
    this.frozenAt = null;
    this.hide();
    this.shown = 0;
    this.corner.textContent = NO_ROUND;
    this.endPulse();
  }

  /**
   * Make sure the corner counter is not behind the game: if nothing is
   * being announced and it shows the wrong round, correct it quietly.
   */
  sync(round: number): void {
    if (this.mode !== 'start' && round > 0 && round !== this.shown) this.show(round, false);
  }

  /** Move on by however long it has really been since the last call. */
  update(): void {
    const now = performance.now();
    // Never more than a tenth of a second at once: after a pause, or a
    // stall, it carries on from where it was.
    const dt = Math.min(0.1, Math.max(0, (now - this.clock) / 1000));
    this.clock = now;
    if (this.frozenAt !== null) {
      this.time = this.frozenAt;
      this.render();
      return;
    }
    if (this.pulse >= 0) {
      this.pulse += dt;
      this.renderPulse();
    }
    if (this.mode === 'idle') {
      if (this.queue.length) this.nextNotice();
      return;
    }
    this.time += dt;
    this.render();
  }

  /** Debug: take down whatever is on screen and forget any notices waiting (the round counter is kept). */
  dismiss(): void {
    this.queue.length = 0;
    this.showing = null;
    this.frozenAt = null;
    if (this.mode === 'start') this.show(this.round, false);
    this.finish();
  }

  /** Debug: hold the announcement on screen at a given moment (null lets it go on). */
  freezeAt(seconds: number | null): void {
    this.frozenAt = seconds;
    this.clock = performance.now();
  }

  /** What is on screen, for checks. */
  get status(): { showing: 'none' | 'start' | 'clear' | 'notice'; seconds: number; counter: string } {
    return { showing: this.mode === 'idle' ? 'none' : this.mode, seconds: this.time, counter: (this.corner.textContent ?? '').replace(NO_ROUND, '') };
  }

  // ------------------------------------------------------------------ drawing

  private render(): void {
    if (this.mode !== 'idle') this.root.style.visibility = 'visible';
    if (this.mode === 'start') this.renderStart();
    else if (this.mode === 'clear') this.renderClear();
    else if (this.mode === 'notice') this.renderNotice();
  }

  private renderNotice(): void {
    const t = this.time;
    const outAt = NOTICE.in + NOTICE.hold;
    if (t >= outAt + NOTICE.out) {
      this.showing = null;
      this.finish();
      return;
    }
    const calm = settings.value.reducedMotion;
    const leaving = clamp01((t - outAt) / NOTICE.out);
    const rise = calm ? 0 : 8 * (1 - easeOutCubic(t / NOTICE.in)) - 5 * leaving;
    this.note.style.opacity = String(clamp01(t / (calm ? 0.25 : 0.1)) * (1 - leaving));
    this.note.style.transform = `translateY(${rise.toFixed(1)}px)`;
    this.noteRule.style.transform = `scaleX(${easeOutCubic(t / 0.35).toFixed(4)})`;
    this.noteSub.style.clipPath = '';
  }

  private renderStart(): void {
    const t = this.time;
    const calm = settings.value.reducedMotion;
    const flyAt = START.in + START.hold;
    if (t >= flyAt + START.fly) {
      this.finish();
      this.show(this.round, true);
      return;
    }

    // ---- The lettering snaps in.
    const entering = clamp01(t / START.in);
    const held = clamp01((t - START.in) / START.hold);
    const scale = calm ? 1.06 - 0.06 * easeOutCubic(t / 0.25) : 1.45 - 0.45 * easeOutExpo(entering) + 0.02 * held;
    // A moment of interference as it arrives: it lands a few pixels to one
    // side and then the other, sheared, its red and blue apart.
    const jitter = calm ? 0 : t < 0.035 ? 16 : t < 0.07 ? -10 : t < 0.105 ? 5 : 0;
    const skew = calm ? 0 : -9 * (1 - easeOutCubic(t / 0.12));
    const split = calm ? 0 : 7 * (1 - clamp01(t / 0.16));
    this.start.style.opacity = String(calm ? clamp01(t / 0.25) : clamp01(t / 0.05));
    this.row.style.transform = `translateX(${jitter}px) skewX(${skew.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
    this.row.style.textShadow = split > 0.05 ? `${split.toFixed(1)}px 0 0 rgba(255, 67, 38, 0.7), ${(-split).toFixed(1)}px 0 0 rgba(96, 200, 255, 0.45), ${SHADE}` : SHADE;

    // ---- The rule draws out from the middle; the line under it types itself.
    const flying = clamp01((t - flyAt) / START.fly);
    const leaving = 1 - clamp01(flying * 3);
    this.rule.style.transform = `scaleX(${easeOutCubic((t - 0.08) / 0.3).toFixed(4)})`;
    this.rule.style.opacity = String(leaving);
    const letters = this.sub.textContent?.length ?? 0;
    const typed = calm ? 1 : Math.floor(clamp01((t - 0.2) / 0.42) * letters) / Math.max(1, letters);
    this.sub.style.clipPath = `inset(0 ${((1 - typed) * 100).toFixed(2)}% 0 0)`;
    this.sub.style.opacity = String((calm ? clamp01((t - 0.15) / 0.3) : 1) * leaving);
    this.word.style.opacity = String(leaving);

    // ---- The numeral flies to the counter in the corner.
    if (flying > 0) {
      if (!this.flight) {
        // Measured once, as it sets off, from where both actually are.
        const from = this.number.getBoundingClientRect();
        const to = this.corner.getBoundingClientRect();
        this.flight = {
          dx: (to.left + to.width / 2 - (from.left + from.width / 2)) / scale,
          dy: (to.top + to.height / 2 - (from.top + from.height / 2)) / scale,
          scale: to.height / Math.max(1, from.height),
        };
      }
      const e = easeInOutCubic(flying);
      const f = this.flight;
      this.number.style.transform = `translate(${(f.dx * e).toFixed(1)}px, ${(f.dy * e).toFixed(1)}px) scale(${(1 + (f.scale - 1) * e).toFixed(4)})`;
    } else {
      this.number.style.transform = '';
    }

    // ---- The scan line and the interference it leaves behind it.
    if (!calm && t < SCAN) {
      const across = t / SCAN;
      this.scan.style.opacity = String(0.9 * (across < 0.75 ? 1 : 1 - (across - 0.75) / 0.25));
      this.scan.style.transform = `translate3d(0, calc(${(across * 100).toFixed(2)}vh + ${(across * 130).toFixed(1)}px), 0)`;
      this.lines.style.opacity = String(0.1 * (1 - clamp01(t / 0.3)));
    } else {
      this.scan.style.opacity = '0';
      this.lines.style.opacity = '0';
    }
  }

  private renderClear(): void {
    const t = this.time;
    const outAt = CLEAR.in + CLEAR.hold;
    if (t >= outAt + CLEAR.out) {
      this.finish();
      return;
    }
    const calm = settings.value.reducedMotion;
    const leaving = clamp01((t - outAt) / CLEAR.out);
    const rise = calm ? 0 : 10 * (1 - easeOutCubic(t / CLEAR.in)) - 6 * leaving;
    this.clear.style.opacity = String(clamp01(t / (calm ? 0.25 : 0.1)) * (1 - leaving));
    this.clear.style.transform = `translateY(${rise.toFixed(1)}px)`;
    this.clearRule.style.transform = `scaleX(${easeOutCubic(t / 0.35).toFixed(4)})`;
    // The round's scrap counts up as the bell rings out.
    const counted = Math.round(this.scrap * (calm ? 1 : easeOutCubic((t - 0.08) / 0.7)));
    const text = `+${counted.toLocaleString('en-US')} SCRAP THIS ROUND`;
    if (text !== this.lastScrapText) {
      this.lastScrapText = text;
      this.clearSub.textContent = text;
    }
    this.clearSub.style.clipPath = '';
  }

  /** The corner counter, swelling and glowing as it takes a new number. */
  private renderPulse(): void {
    const p = this.pulse / PULSE;
    if (p >= 1) {
      this.endPulse();
      return;
    }
    const calm = settings.value.reducedMotion;
    const swell = (calm ? 0.12 : 0.42) * (1 - easeOutCubic(p));
    this.corner.style.transform = `scale(${(1 + swell).toFixed(4)})`;
    this.corner.style.textShadow = calm ? '' : `0 0 ${(24 * (1 - p)).toFixed(1)}px rgba(255, 67, 38, ${(0.9 * (1 - p)).toFixed(2)})`;
  }

  private endPulse(): void {
    this.pulse = -1;
    this.corner.style.transform = '';
    this.corner.style.textShadow = '';
  }

  /** Put a round on the corner counter, with or without the pulse. */
  private show(round: number, pulse: boolean): void {
    this.shown = round;
    this.corner.textContent = String(round);
    if (pulse) {
      this.pulse = 0;
      this.renderPulse();
    }
  }

  /**
   * Whatever is on screen is cut short. A round being announced still
   * reaches the counter, and a notice that had barely been seen goes back
   * to the front of the queue.
   */
  private settle(): void {
    if (this.mode === 'start') this.show(this.round, false);
    if (this.mode === 'notice' && this.showing && this.time < NOTICE.in + NOTICE.hold * 0.6) this.queue.unshift(this.showing);
    this.showing = null;
    this.finish();
  }

  private finish(): void {
    this.mode = 'idle';
    this.hide();
  }

  private hide(): void {
    this.root.style.visibility = 'hidden';
    this.start.style.opacity = '0';
    this.clear.style.opacity = '0';
    this.note.style.opacity = '0';
    this.scan.style.opacity = '0';
    this.lines.style.opacity = '0';
    this.number.style.transform = '';
  }
}
