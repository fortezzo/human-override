// Player settings, remembered between visits in the browser's local storage.

import type { QualityLevel } from '../config';

export interface Settings {
  /** 'auto' lets the game pick a quality level and lower it if needed. */
  quality: QualityLevel | 'auto';
  sensitivity: number;
  volume: number;
  muted: boolean;
  showFps: boolean;
  reducedMotion: boolean;
}

const KEY = 'human-override.settings.v1';

const DEFAULTS: Settings = {
  quality: 'auto',
  sensitivity: 1,
  volume: 0.8,
  muted: false,
  showFps: true,
  reducedMotion: false,
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
