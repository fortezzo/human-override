// The full-screen overlays: loading, the start screen, pause with its
// settings, the credits list, and the "use a computer" notice for phones.

import { QUALITY, QUALITY_ORDER, type QualityLevel } from '../config';
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
  ['Shift', 'Sprint'],
  ['Space', 'Jump'],
  ['Esc', 'Pause and settings'],
  ['M', 'Mute'],
];

export class Screens {
  onStart: Handler = () => {};
  onResume: Handler = () => {};
  onQuality: (choice: QualityLevel | 'auto') => void = () => {};
  onClick: Handler = () => {};
  onHover: Handler = () => {};

  private readonly loading: HTMLElement;
  private readonly loadingBar: HTMLElement;
  private readonly loadingText: HTMLElement;
  private readonly title: HTMLElement;
  private readonly pause: HTMLElement;
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
        <button class="button primary" data-action="start">ENTER THE LOBBY</button>
        <div class="title-note">Stage 0 look test: one room, one robot, one rifle.</div>
      </div>
      <div class="controls-card">
        <div class="card-title">CONTROLS</div>
        ${CONTROLS.map(([key, what]) => `<div class="control"><kbd>${key}</kbd><span>${what}</span></div>`).join('')}
      </div>`;
    parent.appendChild(this.title);

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
    panel.appendChild(this.slider('Volume', 0, 1, 0.01, settings.value.volume, (v) => settings.set({ volume: v }), (v) => `${Math.round(v * 100)}%`));
    panel.appendChild(this.toggle('Show frame rate', settings.value.showFps, (v) => settings.set({ showFps: v })));
    panel.appendChild(this.toggle('Reduce screen shake and flashing', settings.value.reducedMotion, (v) => settings.set({ reducedMotion: v })));

    const actions = h('div', 'panel-actions');
    actions.innerHTML = `<button class="button primary" data-action="resume">RESUME</button><button class="button" data-action="credits">CREDITS</button>`;
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
  show(which: 'loading' | 'title' | 'pause' | 'credits' | 'touch' | 'none'): void {
    this.loading.classList.toggle('hidden', which !== 'loading');
    this.title.classList.toggle('hidden', which !== 'title');
    this.pause.classList.toggle('hidden', which !== 'pause');
    this.credits.classList.toggle('hidden', which !== 'credits');
    this.touch.classList.toggle('hidden', which !== 'touch');
  }

  /** Reflect the current quality choice and what "Auto" resolved to. */
  setQuality(active: QualityLevel, choice: QualityLevel | 'auto'): void {
    for (const [key, button] of this.qualityButtons) button.classList.toggle('active', key === choice);
    this.qualityNote.textContent = choice === 'auto' ? `Auto is using ${QUALITY[active].label}. It steps down by itself if the frame rate drops.` : '';
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
