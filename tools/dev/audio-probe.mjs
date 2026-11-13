// Dev helper: prints duration, channels, loudness and the number of distinct
// transients ("shots") for audio files, since the author of this pipeline
// has no ears. Usage: node tools/dev/audio-probe.mjs file1 file2 ...
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const RATE = 22050;

export function decodeMono(file) {
  const raw = execFileSync(ffmpeg, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { maxBuffer: 1 << 29 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

export function probe(file) {
  const info = execFileSync(ffmpeg, ['-hide_banner', '-i', file, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).toString();
  void info;
  const samples = decodeMono(file);
  let peak = 0;
  let sum = 0;
  for (const s of samples) {
    peak = Math.max(peak, Math.abs(s));
    sum += s * s;
  }
  // Envelope in 5 ms windows, then count rises above 35% of peak after a quiet gap.
  const win = Math.floor(RATE * 0.005);
  const env = [];
  for (let i = 0; i + win <= samples.length; i += win) {
    let m = 0;
    for (let k = 0; k < win; k++) m = Math.max(m, Math.abs(samples[i + k]));
    env.push(m);
  }
  const onsets = [];
  let quiet = true;
  for (let i = 0; i < env.length; i++) {
    if (quiet && env[i] > peak * 0.35) {
      onsets.push((i * win) / RATE);
      quiet = false;
    } else if (!quiet && env[i] < peak * 0.12) quiet = true;
  }
  // Time for the envelope to fall below 10% of peak after the first onset.
  let decay = 0;
  const start = Math.floor(((onsets[0] ?? 0) * RATE) / win);
  for (let i = env.length - 1; i > start; i--) {
    if (env[i] > peak * 0.1) {
      decay = ((i - start) * win) / RATE;
      break;
    }
  }
  return { duration: samples.length / RATE, peak, rms: Math.sqrt(sum / samples.length), onsets, decay };
}

if (process.argv[1] && process.argv[1].endsWith('audio-probe.mjs')) {
  for (const file of process.argv.slice(2)) {
    try {
      const p = probe(file);
      console.log(
        `${path.basename(file).padEnd(44)} ${p.duration.toFixed(2).padStart(6)}s peak ${p.peak.toFixed(2)} rms ${p.rms.toFixed(3)} hits ${String(p.onsets.length).padStart(2)} first ${(p.onsets[0] ?? 0).toFixed(2)}s tail ${p.decay.toFixed(2)}s  [${p.onsets.slice(0, 8).map((o) => o.toFixed(2)).join(' ')}]`,
      );
    } catch (e) {
      console.log(path.basename(file), 'ERROR', String(e.message).slice(0, 80));
    }
  }
}
