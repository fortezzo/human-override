// The full-screen overlays: loading, the start screen, pause with its
// settings, game over, HUMANITY SAVED, the end-of-run card ("ARGUS's
// profile of you"), the credits list, and the "use a computer" notice for
// phones.

import { BRIGHTNESS, QUALITY, QUALITY_ORDER, type QualityLevel } from '../config';
import { settings } from '../core/settings';
import { CREDITS } from '../generated/credits';

type Handler = () => void;

function h(tag: string, className = '', html = ''): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

const CONTROLS: Array<[string, string]> = [
  ['W A S D', 'Move'],
  ['Mouse', 'Look'],
  ['Left click', 'Fire'],
  ['Right click', 'Aim down sights'],
  ['R', 'Reload'],
  ['V', 'Melee strike'],
  ['F', 'Use / buy / open'],
  ['1  2  wheel', 'Switch weapon'],
  ['Shift', 'Sprint'],
  ['Space', 'Jump'],
  ['Esc', 'Pause and settings'],
  ['M', 'Mute'],
];

/** The numbers shown on the game-over screen. */
export interface RunSummary {
  round: number;
  kills: number;
  weakPointKills: number;
  meleeKills: number;
  /** 0..1 */
  accuracy: number;
  scrapEarned: number;
  /** Seconds. */
  time: number;
  /** How long the mission took (seconds), or null if the kill switch was never pulled. */
  missionTime: number | null;
  /** This run set a record: the best round (game over), or the fastest mission (HUMANITY SAVED). */
  best: boolean;
  bestRound: number;
  bestMissionTime: number | null;
}

/** What goes on "ARGUS's profile of you", the card at the end of a run. */
export interface ProfileCard {
  /** The play style ARGUS settled on, and its one-line verdict. */
  label: string;
  verdict: string;
  round: number;
  /** The kill switch was pulled. */
  saved: boolean;
  /** The weapon that did most of the damage, and its share of it (0..1); null if no damage was done. */
  favourite: { name: string; share: number } | null;
  /** Shares, 0..1: hits on weak points, shots that hit, the fighting spent holding one spot. */
  weakShare: number;
  accuracy: number;
  heldShare: number;
  kills: number;
  laps: number;
  /** Every counter ARGUS used, with the rounds it was in force. */
  adaptations: Array<{ name: string; rounds: number[] }>;
  /** The page's own address, printed on the card so that a screenshot of it carries the link. */
  url: string;
}

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const percent = (share: number): string => `${Math.round(share * 100)}%`;

/** "3, 4, 5, 8" as "ROUNDS 3–5, 8". */
function roundsList(rounds: number[]): string {
  const runs: string[] = [];
  for (let i = 0; i < rounds.length; i++) {
    let j = i;
    while (j + 1 < rounds.length && rounds[j + 1] === rounds[j]! + 1) j++;
    runs.push(j > i ? `${rounds[i]}–${rounds[j]}` : String(rounds[i]));
    i = j;
  }
  return `${rounds.length > 1 ? 'ROUNDS' : 'ROUND'} ${runs.join(', ')}`;
}

export class Screens {
  onStart: Handler = () => {};
  onResume: Handler = () => {};
  /** Start a new run (from the pause menu or the game-over screen). */
  onRestart: Handler = () => {};
  /** Leave for the title screen. */
  onQuit: Handler = () => {};
  onQuality: (choice: QualityLevel | 'auto') => void = () => {};
  onClick: Handler = () => {};
  onHover: Handler = () => {};

  private readonly loading: HTMLElement;
  private readonly loadingBar: HTMLElement;
  private readonly loadingText: HTMLElement;
  private readonly title: HTMLElement;
  private readonly titleNote: HTMLElement;
  private readonly pause: HTMLElement;
  private readonly over: HTMLElement;
  private readonly saved: HTMLElement;
  private readonly profile: HTMLElement;
  /** The screen the profile card was opened from, to go back to. */
  private profileFrom: 'over' | 'saved' = 'over';
  private readonly credits: HTMLElement;
  private readonly touch: HTMLElement;
  private readonly qualityButtons = new Map<string, HTMLElement>();
  private readonly qualityNote: HTMLElement;

  constructor(parent: HTMLElement) {
    // ---- Loading
    this.loading = h('div', 'screen loading');
    this.loading.innerHTML = `
      <div class="loading-inner">
        <div class="logo">HUMAN <span>OVERRIDE</span></div>
        <div class="tagline">Don't let the AI win.</div>
        <div class="progress"><div class="progress-fill"></div></div>
        <div class="progress-text">LOADING 0%</div>
      </div>`;
    this.loadingBar = this.loading.querySelector('.progress-fill')!;
    this.loadingText = this.loading.querySelector('.progress-text')!;
    parent.appendChild(this.loading);

    // ---- Start screen
    this.title = h('div', 'screen title hidden');
    this.title.innerHTML = `
      <div class="title-block">
        <div class="eyebrow">SITE 04 · MANUAL OVERRIDE FACILITY</div>
        <div class="logo big">HUMAN <span>OVERRIDE</span></div>
        <div class="tagline">Don't let the AI win.</div>
        <button class="button primary" data-action="start">PLAY</button>
        <div class="title-note"></div>
      </div>
      <div class="controls-card">
        <div class="card-title">CONTROLS</div>
        ${CONTROLS.map(([key, what]) => `<div class="control"><kbd>${key}</kbd><span>${what}</span></div>`).join('')}
      </div>`;
    this.titleNote = this.title.querySelector('.title-note')!;
    parent.appendChild(this.title);

    // ---- Game over
    this.over = h('div', 'screen over hidden');
    parent.appendChild(this.over);

    // ---- HUMANITY SAVED
    this.saved = h('div', 'screen saved hidden');
    parent.appendChild(this.saved);

    // ---- ARGUS's profile of the player
    this.profile = h('div', 'screen profile hidden');
    parent.appendChild(this.profile);

    // ---- Pause and settings
    this.pause = h('div', 'screen pause hidden');
    const panel = h('div', 'panel');
    panel.innerHTML = `<div class="panel-title">PAUSED</div>`;

    const quality = h('div', 'setting');
    quality.appendChild(h('label', '', 'Graphics quality'));
    const group = h('div', 'segmented');
    for (const choice of ['auto', ...QUALITY_ORDER]) {
      const button = h('button', 'segment', choice === 'auto' ? 'Auto' : QUALITY[choice as QualityLevel].label);
      button.dataset.quality = choice;
      this.qualityButtons.set(choice, button);
      group.appendChild(button);
    }
    quality.appendChild(group);
    this.qualityNote = h('div', 'setting-note');
    quality.appendChild(this.qualityNote);
    panel.appendChild(quality);

    panel.appendChild(this.slider('Mouse sensitivity', 0.3, 2.5, 0.05, settings.value.sensitivity, (v) => settings.set({ sensitivity: v }), (v) => `${v.toFixed(2)}×`));
    panel.appendChild(this.slider('Brightness', BRIGHTNESS.min, BRIGHTNESS.max, 0.02, settings.value.brightness, (v) => settings.set({ brightness: v }), (v) => `${Math.round(v * 100)}%`));
    panel.appendChild(this.slider('Volume', 0, 1, 0.01, settings.value.volume, (v) => settings.set({ volume: v }), (v) => `${Math.round(v * 100)}%`));
    panel.appendChild(this.toggle('Show frame rate', settings.value.showFps, (v) => settings.set({ showFps: v })));
    panel.appendChild(this.toggle('Reduce screen shake and flashing', settings.value.reducedMotion, (v) => settings.set({ reducedMotion: v })));

    const actions = h('div', 'panel-actions');
    actions.innerHTML = `<button class="button primary" data-action="resume">RESUME</button><button class="button" data-action="restart">RESTART RUN</button><button class="button" data-action="quit">TITLE SCREEN</button><button class="button" data-action="credits">CREDITS</button>`;
    panel.appendChild(actions);
    this.pause.appendChild(panel);
    parent.appendChild(this.pause);

    // ---- Credits
    this.credits = h('div', 'screen credits hidden');
    const list = h('div', 'panel wide');
    list.innerHTML =
      `<div class="panel-title">CREDITS</div>
       <div class="credits-intro">Designed and directed by Christian Fortezzo. Code written by Claude Code, an AI coding agent from Anthropic. Art and sound from these free sources:</div>
       <div class="credits-scroll">` +
      CREDITS.map(
        (g) =>
          `<div class="credits-group"><div class="credits-heading">${g.title}</div>${g.items
            .map((i) => `<div class="credit"><span>${i.title}</span><span>${i.author}</span><span>${i.license}</span></div>`)
            .join('')}</div>`,
      ).join('') +
      `</div><div class="panel-actions"><button class="button primary" data-action="credits-back">BACK</button></div>`;
    this.credits.appendChild(list);
    parent.appendChild(this.credits);

    // ---- Phones and tablets
    this.touch = h('div', 'screen touch hidden');
    this.touch.innerHTML = `
      <div class="title-block">
        <div class="logo big">HUMAN <span>OVERRIDE</span></div>
        <div class="tagline">Don't let the AI win.</div>
        <div class="touch-note">This game needs a mouse and keyboard.<br>Open this page on a computer to play.</div>
      </div>`;
    parent.appendChild(this.touch);

    // One click handler for every button.
    parent.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest('button');
      if (!target) return;
      this.onClick();
      const action = target.dataset.action;
      if (action === 'start') this.onStart();
      else if (action === 'resume') this.onResume();
      else if (action === 'restart') this.onRestart();
      else if (action === 'quit') this.onQuit();
      else if (action === 'profile') this.show('profile');
      else if (action === 'profile-back') this.show(this.profileFrom);
      else if (action === 'credits') this.show('credits');
      else if (action === 'credits-back') this.show('pause');
      else if (target.dataset.quality) {
        const choice = target.dataset.quality as QualityLevel | 'auto';
        settings.set({ quality: choice });
        this.onQuality(choice);
      }
    });
    parent.addEventListener('mouseover', (event) => {
      if ((event.target as HTMLElement).closest('button')) this.onHover();
    });
  }

  setProgress(fraction: number): void {
    const percent = Math.round(fraction * 100);
    this.loadingBar.style.transform = `scaleX(${fraction})`;
    this.loadingText.textContent = percent >= 100 ? 'PREPARING THE ROOM' : `LOADING ${percent}%`;
  }

  /** Show one overlay, or none. */
  show(which: 'loading' | 'title' | 'pause' | 'over' | 'saved' | 'profile' | 'credits' | 'touch' | 'none'): void {
    if (which === 'over' || which === 'saved') this.profileFrom = which;
    this.saved.classList.toggle('hidden', which !== 'saved');
    this.profile.classList.toggle('hidden', which !== 'profile');
    this.loading.classList.toggle('hidden', which !== 'loading');
    this.title.classList.toggle('hidden', which !== 'title');
    this.pause.classList.toggle('hidden', which !== 'pause');
    this.over.classList.toggle('hidden', which !== 'over');
    this.credits.classList.toggle('hidden', which !== 'credits');
    this.touch.classList.toggle('hidden', which !== 'touch');
  }

  /** The line under the start button: the best round so far and the fastest mission, if there are any. */
  setBest(best: { round: number; missionTime: number | null }): void {
    const parts: string[] = [];
    if (best.round > 0) parts.push(`Best run so far: round ${best.round}`);
    if (best.missionTime !== null) parts.push(`Fastest mission: ${clock(best.missionTime)}`);
    this.titleNote.textContent = parts.length ? parts.join('  ·  ') : 'Hold the facility. Find the kill switch. Every round sends more of them.';
  }

  /** Fill in the HUMANITY SAVED screen: the kill switch has been pulled. */
  setSaved(run: RunSummary): void {
    const rows: Array<[string, string]> = [
      ['Mission time', clock(run.missionTime ?? run.time)],
      ['Round reached', String(run.round)],
      ['Robots destroyed', String(run.kills)],
      ['Weak-point kills', String(run.weakPointKills)],
      ['Accuracy', `${Math.round(run.accuracy * 100)}%`],
      ['Scrap earned', run.scrapEarned.toLocaleString('en-US')],
    ];
    const record = run.best ? 'Your fastest yet.' : run.bestMissionTime !== null ? `Your fastest is ${clock(run.bestMissionTime)}.` : '';
    this.saved.innerHTML = `
      <div class="panel over-panel saved-panel">
        <div class="eyebrow">ARGUS IS OFFLINE</div>
        <div class="over-title">HUMANITY <span>SAVED</span></div>
        <div class="over-best">${record}</div>
        <div class="over-stats">${rows.map(([label, value]) => `<div class="over-stat"><span>${label}</span><b>${value}</b></div>`).join('')}</div>
        <div class="saved-note">The switch is pulled and every machine it ran has stopped. The ones still outside have not heard. Fight on for a higher round, or end the run here.</div>
        <div class="panel-actions"><button class="button primary" data-action="resume">KEEP FIGHTING</button><button class="button" data-action="profile">ARGUS'S PROFILE OF YOU</button><button class="button" data-action="quit">END RUN</button></div>
      </div>`;
  }

  /**
   * Fill in the end-of-run card: what ARGUS made of the player. It is laid
   * out to be screenshotted, with the page's own address on it.
   */
  setProfile(card: ProfileCard): void {
    const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
    const stats: Array<[string, string, string]> = [
      ['FAVOURITE WEAPON', card.favourite ? card.favourite.name.toUpperCase() : 'NONE', card.favourite ? `${percent(card.favourite.share)} of damage` : ''],
      ['WEAK-POINT HITS', percent(card.weakShare), 'of hits'],
      ['ACCURACY', percent(card.accuracy), 'of shots'],
      ['ROBOTS DESTROYED', card.kills.toLocaleString('en-US'), ''],
      ['HELD ONE POSITION', percent(card.heldShare), 'of the fighting'],
      ['LAPS RUN', String(card.laps), ''],
    ];
    const adaptations = card.adaptations.length
      ? `<ul>${card.adaptations.map((used) => `<li><span>${capital(used.name)}</span><i>${roundsList(used.rounds)}</i></li>`).join('')}</ul>`
      : `<div class="profile-none">None. ${card.round < 3 ? 'It was still watching.' : 'You gave it no pattern to answer.'}</div>`;
    this.profile.innerHTML = `
      <div class="profile-card${card.saved ? ' saved' : ''}">
        <div class="profile-top"><span><i class="argus-eye"></i><b>ARGUS</b> · SUBJECT PROFILE</span><span class="profile-game">HUMAN <span>OVERRIDE</span></span></div>
        <div class="profile-main">
          <div>
            <div class="profile-kicker">PLAY STYLE</div>
            <div class="profile-label">${card.label}</div>
            <div class="profile-verdict"><b>ARGUS</b>${card.verdict}</div>
          </div>
          <div class="profile-outcome">
            <div class="profile-kicker">ROUND REACHED</div>
            <div class="profile-round">${card.round}</div>
            <div class="profile-stamp">${card.saved ? 'HUMANITY SAVED' : 'ARGUS WINS'}</div>
          </div>
        </div>
        <div class="profile-stats">${stats.map(([label, value, note]) => `<div class="profile-stat"><span>${label}</span><b>${value}${note ? `<small>${note}</small>` : ''}</b></div>`).join('')}</div>
        <div class="profile-adaptations"><div class="profile-kicker">ADAPTATIONS USED AGAINST YOU</div>${adaptations}</div>
        <div class="profile-foot"><span>DON'T LET THE AI WIN.</span><span class="profile-url">${card.url}</span></div>
      </div>
      <div class="panel-actions"><button class="button primary" data-action="profile-back">BACK</button></div>`;
  }

  /** Fill in the game-over screen for a finished run. */
  setSummary(run: RunSummary): void {
    const minutes = Math.floor(run.time / 60);
    const seconds = Math.floor(run.time % 60);
    const rows: Array<[string, string]> = [
      ['Robots destroyed', String(run.kills)],
      ['Weak-point kills', String(run.weakPointKills)],
      ['Melee kills', String(run.meleeKills)],
      ['Accuracy', `${Math.round(run.accuracy * 100)}%`],
      ['Scrap earned', run.scrapEarned.toLocaleString('en-US')],
      ['Time held', `${minutes}:${String(seconds).padStart(2, '0')}`],
    ];
    // Going down after the kill switch was pulled is not ARGUS winning.
    const saved = run.missionTime !== null;
    if (saved) rows.unshift(['Mission time', clock(run.missionTime!)]);
    this.over.innerHTML = `
      <div class="panel over-panel${saved ? ' saved-panel' : ''}">
        <div class="eyebrow">${saved ? 'HUMANITY SAVED · ARGUS IS OFFLINE' : 'ARGUS WINS'}</div>
        <div class="over-title">YOU HELD UNTIL <span>ROUND ${run.round}</span></div>
        <div class="over-best">${run.best ? 'A new best.' : run.bestRound > 0 ? `Your best is round ${run.bestRound}.` : ''}</div>
        <div class="over-stats">${rows.map(([label, value]) => `<div class="over-stat"><span>${label}</span><b>${value}</b></div>`).join('')}</div>
        <div class="panel-actions"><button class="button primary" data-action="restart">PLAY AGAIN</button><button class="button" data-action="profile">ARGUS'S PROFILE OF YOU</button><button class="button" data-action="quit">TITLE SCREEN</button></div>
      </div>`;
  }

  /** Reflect the current quality choice and what "Auto" resolved to. */
  setQuality(active: QualityLevel, choice: QualityLevel | 'auto'): void {
    for (const [key, button] of this.qualityButtons) button.classList.toggle('active', key === choice);
    this.qualityNote.textContent = choice === 'auto' ? `Auto is using ${QUALITY[active].label}. It steps down by itself if the frame rate drops; press Auto again to let it choose afresh.` : '';
  }

  private slider(label: string, min: number, max: number, step: number, value: number, onChange: (value: number) => void, format: (value: number) => string): HTMLElement {
    const row = h('div', 'setting');
    const name = h('label', '', label);
    const readout = h('span', 'setting-value', format(value));
    name.appendChild(readout);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      readout.textContent = format(v);
      onChange(v);
    });
    row.append(name, input);
    return row;
  }

  private toggle(label: string, value: boolean, onChange: (value: boolean) => void): HTMLElement {
    const row = h('label', 'setting check');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value;
    input.addEventListener('change', () => onChange(input.checked));
    row.append(input, h('span', '', label));
    return row;
  }
}
