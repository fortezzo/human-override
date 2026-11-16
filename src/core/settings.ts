// Player settings, remembered between visits in the browser's local storage.

import type { QualityLevel } from '../config';
import type { HintId } from '../sim/coach';

export interface Settings {
  /** 'auto' lets the game pick a quality level and lower it if needed. */
  quality: QualityLevel | 'auto';
  sensitivity: number;
  /** Picture brightness: 1 is as designed, higher opens up the shadows. */
  brightness: number;
  volume: number;
  muted: boolean;
  /**
   * The frame-rate counter in the corner. Off unless asked for. (It was
   * called "showFps" and on by default until the last stage; the new name
   * is so that a browser which remembered the old default forgets it.)
   */
  frameRate: boolean;
  reducedMotion: boolean;
  /** The first-minute hints, and the ones this player has already done (they are not shown again). */
  hints: boolean;
  learned: HintId[];
}

const KEY = 'human-override.settings.v1';

const DEFAULTS: Settings = {
  quality: 'auto',
  sensitivity: 1,
  brightness: 1,
  volume: 0.8,
  muted: false,
  frameRate: false,
  reducedMotion: false,
  hints: true,
  learned: [],
};

type Listener = (settings: Settings) => void;

class SettingsStore {
  private data: Settings;
  private listeners = new Set<Listener>();

  constructor() {
    this.data = { ...DEFAULTS, ...this.read() };
  }

  get value(): Readonly<Settings> {
    return this.data;
  }

  set(patch: Partial<Settings>): void {
    this.data = { ...this.data, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Private browsing or storage disabled: settings just will not persist.
    }
    for (const listener of this.listeners) listener(this.data);
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private read(): Partial<Settings> {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    } catch {
      return {};
    }
  }
}

export const settings = new SettingsStore();
