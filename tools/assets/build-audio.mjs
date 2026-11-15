// Cuts, layers, levels and compresses the game's sounds.
//
// Reads audio-spec.mjs, pulls each sound out of the downloaded recordings
// with ffmpeg, and writes small MP3 files to public/assets/audio. MP3 is
// used because every browser can decode it.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { AUDIO_SPEC } from './audio-spec.mjs';
import { extractAudioSources } from './lib/extract-audio.mjs';

const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const SRC = extractAudioSources();
const OUT = 'public/assets/audio';
const TMP = 'assets-source/_work/audio-tmp';
const RATE = 44100;
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const run = (args) => execFileSync(ffmpeg, ['-v', 'error', '-y', ...args], { maxBuffer: 1 << 29 });

/** Decode a stretch of a file to mono floats, for measuring. */
function decode(file, start = 0, duration) {
  const args = ['-v', 'error'];
  if (start) args.push('-ss', String(start));
  if (duration) args.push('-t', String(duration));
  args.push('-i', file, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-');
  const raw = execFileSync(ffmpeg, args, { maxBuffer: 1 << 29 });
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
}

/** Find the exact start of the attack near `at` seconds. */
function snapToAttack(file, at) {
  const from = Math.max(0, at - 0.06);
  const samples = decode(file, from, 0.2);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > peak * 0.1) return Math.max(0, from + i / RATE - 0.003);
  }
  return at;
}

function measure(file) {
  const samples = decode(file);
  let peak = 0;
  let sum = 0;
  for (const s of samples) {
    peak = Math.max(peak, Math.abs(s));
    sum += s * s;
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, samples.length)), duration: samples.length / RATE };
}

// "node tools/assets/build-audio.mjs sting" rebuilds only the sounds whose
// names start with "sting"; with no argument, all of them.
const only = process.argv[2];
let total = 0;
for (const spec of AUDIO_SPEC) {
  if (only && !spec.name.startsWith(only)) continue;
  const inputs = [];
  const chains = [];
  spec.layers.forEach((layer, i) => {
    const file = path.join(SRC, layer.file);
    if (!fs.existsSync(file)) throw new Error(`Missing source for ${spec.name}: ${file}`);
    let start = layer.at ?? 0;
    if (layer.snap) start = snapToAttack(file, start);
    inputs.push('-i', file);
    const steps = [`atrim=start=${start.toFixed(4)}${spec.duration ? `:duration=${(spec.duration / (layer.pitch ?? 1) + 0.05).toFixed(3)}` : ''}`, 'asetpts=PTS-STARTPTS', `aresample=${RATE}`];
    if (layer.pitch) steps.push(`asetrate=${Math.round(RATE * layer.pitch)}`, `aresample=${RATE}`);
    if (layer.filter) steps.push(layer.filter);
    steps.push(`volume=${layer.gain ?? 1}`);
    steps.push(`aformat=channel_layouts=${spec.stereo ? 'stereo' : 'mono'}`);
    chains.push(`[${i}:a]${steps.join(',')}[l${i}]`);
  });
  const mix = spec.layers.length > 1 ? `${spec.layers.map((_, i) => `[l${i}]`).join('')}amix=inputs=${spec.layers.length}:normalize=0:duration=longest[m]` : '[l0]anull[m]';
  const post = [];
  // "Drive" pushes the sound hard into a soft clipper. Raw gunshot recordings
  // are one huge spike and a faint tail; clipping the spike brings the body
  // and tail up, which is what makes a shot sound heavy instead of clicky.
  if (spec.drive) post.push(`volume=${spec.drive}`, 'asoftclip=type=tanh');
  if (spec.post) post.push(spec.post);
  if (spec.duration) post.push(`atrim=duration=${spec.duration}`);
  post.push('afade=t=in:d=0.002');
  const filter = `${chains.join(';')};${mix};[m]${post.join(',')}[out]`;

  // First pass to an uncompressed file, so the level can be measured.
  const wav = path.join(TMP, `${spec.name}.wav`);
  run([...inputs, '-filter_complex', filter, '-map', '[out]', '-c:a', 'pcm_f32le', wav]);
  const m = measure(wav);
  const gain = spec.rms ? spec.rms / Math.max(m.rms, 1e-6) : (spec.peak ?? 0.8) / Math.max(m.peak, 1e-6);

  // Second pass: apply the level, fade the tail, encode.
  const tail = spec.fadeOut ?? Math.min(0.08, m.duration * 0.3);
  const final = [`volume=${gain.toFixed(4)}`, `afade=t=out:st=${Math.max(0, m.duration - tail).toFixed(3)}:d=${tail.toFixed(3)}`];
  // A limiter catches the peaks of loudness-levelled beds.
  if (spec.rms) final.push('alimiter=limit=0.95');
  const out = path.join(OUT, `${spec.name}.mp3`);
  run(['-i', wav, '-af', final.join(','), '-ar', String(RATE), '-c:a', 'libmp3lame', '-b:a', spec.bitrate ?? (spec.stereo ? '128k' : '96k'), out]);
  total += fs.statSync(out).size;
  console.log(`  ${spec.name.padEnd(20)} ${m.duration.toFixed(2).padStart(6)}s  x${gain.toFixed(2).padStart(5)}  ${(fs.statSync(out).size / 1024).toFixed(0).padStart(4)} KB`);
}
console.log(`Audio: ${only ? `sounds named "${only}..."` : `${AUDIO_SPEC.length} sounds`}, ${(total / 1024 / 1024).toFixed(2)} MB`);
