// Puts the built game on the web.
//
//   npm run build
//   npm run deploy
//
// The contents of dist/, exactly as they were built and checked, become the
// one commit of this repository's "gh-pages" branch on GitHub, which GitHub
// Pages serves at the address written in site-address.txt. Nothing is built
// here, and nothing but that branch is touched: the code's own history (the
// "main" branch) is pushed separately, with "git push".
//
// The branch only ever holds the latest build. Each deploy replaces it, so
// the repository does not grow by a copy of the game every time.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseSiteAddress } from './lib/site-address.mjs';

const DIST = 'dist';
const BRANCH = 'gh-pages';
const git = (args, options = {}) => execFileSync('git', args, { encoding: 'utf8', ...options }).trim();
const stop = (message) => {
  console.error(message);
  process.exit(1);
};

if (!fs.existsSync(path.join(DIST, 'index.html'))) stop('There is no built game to publish. Run "npm run build" first.');
const address = fs.existsSync('site-address.txt') ? parseSiteAddress(fs.readFileSync('site-address.txt', 'utf8')) : '';
if (!address) stop('site-address.txt has no address in it. Put the public address on a line of its own, then "npm run build".');
const page = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
if (!page.includes(`<meta property="og:url" content="${address}" />`)) {
  stop(`The built page does not carry the address in site-address.txt (${address}). It was built before the address was written there: run "npm run build" again.`);
}
// GitHub Pages would otherwise run the files through its site generator, which skips some of them.
if (!fs.existsSync(path.join(DIST, '.nojekyll'))) stop('dist/.nojekyll is missing (it comes from public/.nojekyll). Run "npm run build" again.');
let remote = '';
try {
  remote = git(['remote', 'get-url', 'origin']);
} catch {
  stop('This repository has no "origin" on GitHub yet.');
}

const from = git(['rev-parse', '--short', 'HEAD']);
const dirty = git(['status', '--porcelain']) !== '';
const index = path.join(git(['rev-parse', '--git-dir']), 'deploy-index');
const env = { ...process.env, GIT_INDEX_FILE: path.resolve(index) };
try {
  fs.rmSync(index, { force: true });
  // (Stored byte for byte: no line-ending conversion, whatever this computer's git is set to do.)
  git(['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', `--work-tree=${DIST}`, 'add', '--all', '--force', '.'], { env });
  const tree = git(['write-tree'], { env });
  const files = git(['ls-tree', '-r', '--name-only', tree]).split('\n').length;
  const message = `The game as built from ${from}${dirty ? ' (with changes not yet committed)' : ''}\n\nPublished by tools/deploy.mjs: the contents of dist/, as served at ${address}`;
  const commit = git(['commit-tree', tree, '-m', message]);
  console.log(`Publishing ${files} files (the build from ${from}${dirty ? ', with uncommitted changes' : ''}) to the "${BRANCH}" branch of ${remote} ...`);
  execFileSync('git', ['push', '--force', 'origin', `${commit}:refs/heads/${BRANCH}`], { stdio: 'inherit' });
  console.log(`\nDone. GitHub Pages takes a minute or two to put it up at ${address}`);
  console.log('Then "npm run check:live" visits it the way a stranger would.');
} finally {
  fs.rmSync(index, { force: true });
}
