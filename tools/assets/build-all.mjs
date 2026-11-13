// Rebuilds every game asset in public/assets from the source downloads.
//
//   npm run assets:fetch    download the free source assets (once)
//   npm run assets:build    convert everything into game files
//
// The converted files are committed, so nobody needs to run this just to
// play or work on the game. It needs the Mixamo and Sketchfab downloads in
// assets-source (see the README) because those cannot be redistributed raw.

import { execFileSync } from 'node:child_process';

const STEPS = ['build-textures', 'build-sky', 'build-props', 'build-robot', 'build-guns', 'build-audio', 'build-fonts', 'build-credits'];
const only = process.argv.slice(2);
// The model library prints a line per processing pass; keep only our summaries.
const NOISE = /^(prune|quantize|dedup|join|flatten|weld|simplify|resample|reorder|textureCompress|meshopt)\b/;

for (const step of STEPS) {
  if (only.length && !only.includes(step.replace('build-', ''))) continue;
  console.log(`\n=== ${step}`);
  const output = execFileSync(process.execPath, [`tools/assets/${step}.mjs`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  console.log(
    output
      .split('\n')
      .filter((line) => !NOISE.test(line))
      .join('\n')
      .trim(),
  );
}
console.log('\nAll assets rebuilt.');
