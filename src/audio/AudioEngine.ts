// Plays the game's sounds through the Web Audio API.
//
// Signal path:
//
//   sound -> (3D panner) -> bus gain -> master gain -> limiter -> speakers
//                  \-> reverb send -> room reverb -> master gain
//
// Sounds given a position are placed in 3D around the listener (the
// camera), so a robot behind you sounds like it is behind you. The reverb
// is a synthetic "concrete room" impulse generated in code, which is what
// makes gunfire ring off the walls.

import * as THREE from 'three';
import { AUDIO } from '../config';
import type { Assets } from '../core/assets';
import { pick } from '../core/math';
import { SOUNDS, type Bus, type SoundId } from './soundList';

export interface PlayOptions {
  /** World position; omit for sounds that are "in your head" (your own gun, UI). */
  position?: THREE.Vector3;
  gain?: number;
  pitch?: number;
}

export interface LoopHandle {
  setGain(gain: number, seconds?: number): void;
  stop(): void;
}

const BUSES: Bus[] = ['weapons', 'impacts', 'robots', 'player', 'ambience', 'music', 'ui'];

export class AudioEngine {
  readonly context: AudioContext;
  private readonly master: GainNode;
  private readonly buses = new Map<Bus, GainNode>();
  private readonly reverbSend: GainNode;
  private readonly voices = new Map<SoundId, number>();
  private assets: Assets | null = null;
  private volume = AUDIO.master;
  private muted = false;

  private readonly forward = new THREE.Vector3();
  private readonly up = new THREE.Vector3();

  constructor() {
    this.context = new AudioContext({ latencyHint: 'interactive' });
    const ctx = this.context;

    // A limiter on the way out stops stacked gunshots from distorting.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 6;
    limiter.ratio.value = 14;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.connect(limiter);

    for (const name of BUSES) {
      const bus = ctx.createGain();
      bus.gain.value = AUDIO.buses[name];
      bus.connect(this.master);
      this.buses.set(name, bus);
    }

    const reverb = ctx.createConvolver();
    reverb.buffer = this.roomImpulse(1.5);
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = AUDIO.reverbSend;
    reverb.connect(reverbOut).connect(this.master);
    this.reverbSend = ctx.createGain();
    this.reverbSend.connect(reverb);

    this.applyVolume();
  }

  /** Give the engine access to decoded sounds once loading has finished. */
  attach(assets: Assets): void {
    this.assets = assets;
  }

  /** Browsers only allow sound after a click or key press; call from one. */
  resume(): void {
    if (this.context.state !== 'running') void this.context.resume();
  }

  suspend(): void {
    if (this.context.state === 'running') void this.context.suspend();
  }

  decode(data: ArrayBuffer): Promise<AudioBuffer> {
    return this.context.decodeAudioData(data);
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.applyVolume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  private applyVolume(): void {
    const target = this.muted ? 0 : this.volume * AUDIO.master;
    this.master.gain.setTargetAtTime(target, this.context.currentTime, 0.03);
  }

  /** Move the "ears" to the camera. Call once per frame. */
  setListener(camera: THREE.Camera): void {
    const listener = this.context.listener;
    const p = camera.position;
    camera.getWorldDirection(this.forward);
    this.up.copy(camera.up).applyQuaternion(camera.quaternion);
    if (listener.positionX) {
      const t = this.context.currentTime;
      listener.positionX.setValueAtTime(p.x, t);
      listener.positionY.setValueAtTime(p.y, t);
      listener.positionZ.setValueAtTime(p.z, t);
      listener.forwardX.setValueAtTime(this.forward.x, t);
      listener.forwardY.setValueAtTime(this.forward.y, t);
      listener.forwardZ.setValueAtTime(this.forward.z, t);
      listener.upX.setValueAtTime(this.up.x, t);
      listener.upY.setValueAtTime(this.up.y, t);
      listener.upZ.setValueAtTime(this.up.z, t);
    } else {
      // Older Firefox.
      listener.setPosition(p.x, p.y, p.z);
      listener.setOrientation(this.forward.x, this.forward.y, this.forward.z, this.up.x, this.up.y, this.up.z);
    }
  }

  /** The sounds asked for lately, oldest first (kept short; the checks read it to see that a thing was heard as well as seen). */
  readonly asked: SoundId[] = [];

  /** Play a one-shot sound. */
  play(id: SoundId, options: PlayOptions = {}): void {
    this.asked.push(id);
    if (this.asked.length > 200) this.asked.splice(0, 100);
    if (!this.assets || this.context.state !== 'running') return;
    const def = SOUNDS[id] as (typeof SOUNDS)[SoundId] & { pitchJitter?: number; reverb?: number; maxVoices?: number };
    const active = this.voices.get(id) ?? 0;
    if (active >= (def.maxVoices ?? 6)) return;

    const ctx = this.context;
    const source = ctx.createBufferSource();
    source.buffer = pick(this.assets.sound(id));
    const jitter = def.pitchJitter ?? 0;
    source.playbackRate.value = (options.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * jitter);

    const gain = ctx.createGain();
    gain.gain.value = def.gain * (options.gain ?? 1);
    source.connect(gain);

    let output: AudioNode = gain;
    if (options.position) {
      const panner = new PannerNode(ctx, {
        panningModel: 'HRTF',
        distanceModel: 'inverse',
        refDistance: AUDIO.refDistance,
        rolloffFactor: AUDIO.rolloff,
        maxDistance: 60,
        positionX: options.position.x,
        positionY: options.position.y,
        positionZ: options.position.z,
      });
      gain.connect(panner);
      output = panner;
    }
    output.connect(this.buses.get(def.bus)!);
    if (def.reverb) {
      const send = ctx.createGain();
      send.gain.value = def.reverb;
      output.connect(send).connect(this.reverbSend);
    }

    this.voices.set(id, active + 1);
    source.onended = () => {
      this.voices.set(id, Math.max(0, (this.voices.get(id) ?? 1) - 1));
      output.disconnect();
    };
    source.start();
  }

  /**
   * Loop a sound for as long as the game runs. MP3 files have a sliver of
   * silence at each end, so instead of looping one copy this overlaps two
   * and cross-fades between them, which gives a seamless bed.
   */
  loop(id: SoundId, gain = 1, overlap = 2.5): LoopHandle {
    const ctx = this.context;
    const def = SOUNDS[id];
    const out = ctx.createGain();
    out.gain.value = def.gain * gain;
    out.connect(this.buses.get(def.bus)!);

    let stopped = false;
    let timer = 0;
    const sources = new Set<AudioBufferSourceNode>();

    const schedule = (when: number) => {
      if (stopped || !this.assets) return;
      const buffer = this.assets.sound(id)[0]!;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const fade = ctx.createGain();
      fade.gain.setValueAtTime(0, when);
      fade.gain.linearRampToValueAtTime(1, when + overlap);
      fade.gain.setValueAtTime(1, when + buffer.duration - overlap);
      fade.gain.linearRampToValueAtTime(0, when + buffer.duration);
      source.connect(fade).connect(out);
      source.start(when);
      sources.add(source);
      source.onended = () => sources.delete(source);
      // Queue the next copy to start as this one begins to fade out.
      const next = when + buffer.duration - overlap;
      timer = window.setTimeout(() => schedule(next), Math.max(0, (next - ctx.currentTime - 1) * 1000));
    };
    schedule(ctx.currentTime + 0.05);

    return {
      setGain: (value, seconds = 0.5) => out.gain.setTargetAtTime(def.gain * value, ctx.currentTime, seconds / 3),
      stop: () => {
        stopped = true;
        window.clearTimeout(timer);
        for (const source of sources) source.stop();
        out.disconnect();
      },
    };
  }

  /** A short, deep thump layered under each gunshot for weight. */
  thump(strength = 1): void {
    if (this.context.state !== 'running') return;
    const ctx = this.context;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118, t);
    osc.frequency.exponentialRampToValueAtTime(46, t + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5 * strength, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(gain).connect(this.buses.get('weapons')!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** The rush of air from a fast swing: a short burst of noise swept through a band. */
  whoosh(strength = 1): void {
    if (this.context.state !== 'running') return;
    const ctx = this.context;
    const t = ctx.currentTime;
    const length = Math.floor(ctx.sampleRate * 0.28);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.1;
    band.frequency.setValueAtTime(380, t);
    band.frequency.exponentialRampToValueAtTime(2100, t + 0.11);
    band.frequency.exponentialRampToValueAtTime(600, t + 0.26);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.34 * strength, t + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);
    source.connect(band).connect(gain).connect(this.buses.get('weapons')!);
    source.start(t);
  }

  /** Build the echo of a hard-walled room: decaying noise with early slaps. */
  private roomImpulse(seconds: number): AudioBuffer {
    const ctx = this.context;
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      let smooth = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        // Later reflections lose their highs, like sound soaking into a room.
        const cutoff = 0.65 - t * 0.55;
        smooth += (Math.random() * 2 - 1 - smooth) * cutoff;
        data[i] = smooth * Math.pow(1 - t, 3.2);
      }
      // A few distinct early reflections off the nearest walls.
      for (const [ms, level] of [
        [11, 0.5],
        [19, 0.4],
        [31, 0.32],
        [47, 0.24],
      ] as const) {
        const at = Math.floor(((ms + channel * 3) / 1000) * ctx.sampleRate);
        if (at < length) data[at]! += level;
      }
    }
    return impulse;
  }
}
