// The full-screen overlays: loading, the start screen, how to play,
// settings, pause, game over, HUMANITY SAVED, the end-of-run card ("ARGUS's
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
  ['G', 'Throw a grenade'],
  ['F', 'Use / buy / open / repair'],
  ['1  2  wheel', 'Switch weapon'],
  ['Shift', 'Sprint'],
  ['Space', 'Jump'],
  ['Esc', 'Pause and settings'],
  ['M', 'Mute'],
];

/** The five lines at the top of How to Play: enough to start with, for someone who will read no further. */
const QUICK_START: string[] = [
  `<b>Move</b> with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> and look with the mouse. <kbd>Shift</kbd> runs, <kbd>Space</kbd> jumps over anything up to waist height.`,
  `<b>Shoot</b> with <kbd>Left click</kbd>, aim with <kbd>Right click</kbd>, reload with <kbd>R</kbd>. Aim for the head.`,
  `<b>Keep moving.</b> Robots only hurt you up close, and your health comes back by itself when you get away.`,
  `<b>Spend your scrap.</b> Every hit earns some. Walk up to a weapon on a wall, or a door, and press <kbd>F</kbd> to buy it.`,
  `<b>Follow the marker</b> <span class="howto-mark">\u25c6</span> to the next step of the mission. Pull the kill switch and you win.`,
];

/**
 * How to play, for someone who has never played a game like this: short
 * paragraphs in plain words, in the order a new player needs them.
 */
const HOW_TO_PLAY: Array<{ title: string; body: string }> = [
  {
    title: 'THE IDEA',
    body: `You are the last person inside a facility run by ARGUS, an AI that has taken over. Robots come for you in <b>rounds</b>: each round sends more of them, and they get tougher. You cannot win by waiting. To win, work through the <b>mission</b> shown at the top left of the screen, and pull the kill switch.`,
  },
  {
    title: 'STAYING ALIVE',
    body: `Robots hurt you when they are close enough to strike. Your health (bottom left) <b>comes back by itself</b> after a few seconds without being hit, so when you are hurt, back away and keep moving. Never stand still in a crowd. Hold <kbd>Shift</kbd> to run; the thin bar under your health is how much running you have left.`,
  },
  {
    title: 'FIGHTING',
    body: `<kbd>Left click</kbd> fires, <kbd>Right click</kbd> aims, <kbd>R</kbd> reloads. <b>Aim for the head</b>: a hit there does more than twice the damage. <kbd>V</kbd> strikes a robot that is right next to you, which saves ammunition. <kbd>G</kbd> throws a grenade; you are handed another each round.`,
  },
  {
    title: 'SCRAP, AND WHAT IT BUYS',
    body: `Every hit and every robot destroyed earns <b>scrap</b> (bottom right). Walk up to anything that can be bought and its price appears: press <kbd>F</kbd>.
      <ul>
        <li><b>Weapons</b> hang on the walls. The same spot sells ammunition for a weapon you already carry. You carry two; a third replaces the one in your hands.</li>
        <li><b>Doors</b> open new areas. There are six areas, and something worth having in each.</li>
        <li><b>Boost Stations</b> work once the power is on. <b>Carapace</b>: more health. <b>Autoloader</b>: faster reloading. <b>Hair Trigger</b>: faster firing. <b>Failsafe</b>: when you go down, you get back up, once.</li>
        <li><b>The Overclock Bench</b> (Robotics Lab) makes the weapon in your hands stronger, as many times as you can pay for.</li>
        <li><b>The Prototype Crate</b> (Loading Dock) hands out a random weapon, sometimes one found nowhere else. You can leave what it offers.</li>
      </ul>`,
  },
  {
    title: 'THE MISSION',
    body: `<ol>
        <li><b>Restore power</b> at the breaker in the Power Room.</li>
        <li><b>Collect three override keys</b>: one from the cage in the Robotics Lab; one by holding the ground round the uplink in the Server Hall for a minute; and one carried by the Custodian, a large robot that comes for you once you hold the other two.</li>
        <li><b>Take the keys to the Core</b>, start the kill switch, and stay alive in that room while it arms.</li>
        <li><b>Pull the switch.</b></li>
      </ol>
      A marker on screen always points to the next step.`,
  },
  {
    title: 'ARGUS IS WATCHING YOU',
    body: `Between rounds ARGUS tells you what it noticed about how you play, and what it is changing because of it: plating against the gun you lean on, bombers if you stay in one place. Every change can be <b>seen</b> on the robots, and every one can be <b>beaten by playing differently</b>.`,
  },
  {
    title: 'WORTH KNOWING',
    body: `<ul>
        <li><b>Shutters.</b> Robots have to batter down the shutters they walk in through. Press <kbd>F</kbd> at one to repair it for a little scrap.</li>
        <li><b>Pickups.</b> A destroyed robot sometimes leaves a glowing badge. Walk into it: it might fill your ammunition, double your scrap, or destroy every robot on the map.</li>
        <li><b>Swarms.</b> Every fifth round is a swarm of fast drones, and ends with a full resupply.</li>
        <li><b>The last few.</b> When only three robots are left in a round, they are marked so you never have to hunt for them.</li>
      </ul>`,
  },
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
  private readonly settings: HTMLElement;
  private readonly howto: HTMLElement;
  /** The settings themselves: one set of controls, shown on the pause screen and on the settings screen. */
  private readonly settingsBlock: HTMLElement;
  private readonly pauseSettings: HTMLElement;
  private readonly screenSettings: HTMLElement;
  /** The screen that settings, how to play or the credits were opened from, to go back to. */
  private cameFrom: 'title' | 'pause' = 'title';
  private showing = 'loading';
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
        <div class="title-links"><button class="button" data-action="howto">HOW TO PLAY</button><button class="button" data-action="settings">SETTINGS</button><button class="button" data-action="credits">CREDITS</button></div>
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
    this.pauseSettings = h('div', 'settings-holder');
    panel.appendChild(this.pauseSettings);
    this.settingsBlock = h('div', 'settings-block');
    this.pauseSettings.appendChild(this.settingsBlock);

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
    const block = this.settingsBlock;
    block.appendChild(quality);

    block.appendChild(this.slider('Mouse sensitivity', 0.3, 2.5, 0.05, settings.value.sensitivity, (v) => settings.set({ sensitivity: v }), (v) => `${v.toFixed(2)}×`));
    block.appendChild(this.slider('Brightness', BRIGHTNESS.min, BRIGHTNESS.max, 0.02, settings.value.brightness, (v) => settings.set({ brightness: v }), (v) => `${Math.round(v * 100)}%`));
    block.appendChild(this.slider('Volume', 0, 1, 0.01, settings.value.volume, (v) => settings.set({ volume: v }), (v) => `${Math.round(v * 100)}%`));
    // (M mutes from the keyboard as well, so the box follows the setting whoever changes it.)
    const mute = this.toggle('Sound off (M)', settings.value.muted, (v) => settings.set({ muted: v }));
    block.appendChild(mute);
    settings.onChange((s) => ((mute.querySelector('input') as HTMLInputElement).checked = s.muted));
    block.appendChild(this.toggle('Show frame rate', settings.value.frameRate, (v) => settings.set({ frameRate: v })));
    // (Switched on again, they start from the beginning: whatever had been learned is forgotten.)
    block.appendChild(this.toggle('Show hints for new players', settings.value.hints, (v) => settings.set(v ? { hints: true, learned: [] } : { hints: false })));
    block.appendChild(this.toggle('Reduce screen shake and flashing', settings.value.reducedMotion, (v) => settings.set({ reducedMotion: v })));
    block.appendChild(h('div', 'setting-note', 'Your settings are remembered on this computer.'));

    const actions = h('div', 'panel-actions');
    actions.innerHTML = `<button class="button primary" data-action="resume">RESUME</button><button class="button" data-action="howto">HOW TO PLAY</button><button class="button" data-action="restart">RESTART RUN</button><button class="button" data-action="quit">TITLE SCREEN</button><button class="button" data-action="credits">CREDITS</button>`;
    panel.appendChild(actions);
    this.pause.appendChild(panel);
    parent.appendChild(this.pause);

    // ---- Settings, as a screen of its own (from the start screen)
    this.settings = h('div', 'screen settings hidden');
    const settingsPanel = h('div', 'panel');
    settingsPanel.innerHTML = `<div class="panel-title">SETTINGS</div>`;
    this.screenSettings = h('div', 'settings-holder');
    settingsPanel.appendChild(this.screenSettings);
    const settingsActions = h('div', 'panel-actions');
    settingsActions.innerHTML = `<button class="button primary" data-action="back">BACK</button>`;
    settingsPanel.appendChild(settingsActions);
    this.settings.appendChild(settingsPanel);
    parent.appendChild(this.settings);

    // ---- How to play
    this.howto = h('div', 'screen howto hidden');
    const guide = h('div', 'panel wide');
    guide.innerHTML =
      `<div class="panel-title">HOW TO PLAY</div>
       <div class="howto-scroll">
         <div class="howto-quick">
           <h3>QUICK START</h3>
           <ol>${QUICK_START.map((line) => `<li>${line}</li>`).join('')}</ol>
         </div>
         <div class="howto-columns">${HOW_TO_PLAY.map((section) => `<section><h3>${section.title}</h3><div>${section.body}</div></section>`).join('')}</div>
         <h3>CONTROLS</h3>
         <div class="howto-controls">${CONTROLS.map(([key, what]) => `<div class="control"><kbd>${key}</kbd><span>${what}</span></div>`).join('')}</div>
       </div>
       <div class="panel-actions"><button class="button primary" data-action="back">BACK</button></div>`;
    this.howto.appendChild(guide);
    parent.appendChild(this.howto);

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
      `</div><div class="panel-actions"><button class="button primary" data-action="back">BACK</button></div>`;
    this.credits.appendChild(list);
    parent.appendChild(this.credits);

    // ---- Phones and tablets
    this.touch = h('div', 'screen touch hidden');
    this.touch.innerHTML = `
      <div class="title-block">
        <div class="logo big">HUMAN <span>OVERRIDE</span></div>
        <div class="tagline">Don't let the AI win.</div>
        <div class="touch-note"><b>Play this on a computer with a mouse and keyboard.</b><br>It is a first-person game: you look round with the mouse and move with the keys, which a phone or tablet cannot do. Open this page on a laptop or desktop and it will start there.</div>
        <div class="touch-link"><span class="touch-url"></span><button class="button" data-action="copy-link">COPY THE LINK</button></div>
        <div class="touch-what">One human holds a facility against a rogue AI's robots, round after round, while working toward its kill switch. The AI studies how you play and adapts.</div>
      </div>`;
    (this.touch.querySelector('.touch-url') as HTMLElement).textContent = (location.host + location.pathname).replace(/index\.html$/, '');
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
      else if (action === 'credits' || action === 'settings' || action === 'howto') {
        // (Remember which screen it was opened from, to go back to it.)
        if (this.showing === 'title' || this.showing === 'pause') this.cameFrom = this.showing;
        this.show(action);
      } else if (action === 'back') this.show(this.cameFrom);
      else if (action === 'copy-link') {
        // The page's own address, for sending to a computer. (Nothing leaves the device: it goes on the clipboard.)
        void navigator.clipboard?.writeText(location.href).then(
          () => (target.textContent = 'COPIED'),
          () => (target.textContent = 'COPY IT FROM THE ADDRESS BAR'),
        );
      }
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
  show(which: 'loading' | 'title' | 'pause' | 'over' | 'saved' | 'profile' | 'credits' | 'settings' | 'howto' | 'touch' | 'none'): void {
    if (which === 'over' || which === 'saved') this.profileFrom = which;
    this.showing = which;
    // The one set of settings controls goes wherever it is being looked at.
    if (which === 'settings') this.screenSettings.appendChild(this.settingsBlock);
    else if (which === 'pause') this.pauseSettings.appendChild(this.settingsBlock);
    this.settings.classList.toggle('hidden', which !== 'settings');
    this.howto.classList.toggle('hidden', which !== 'howto');
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
