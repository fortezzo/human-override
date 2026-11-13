// Entry point: show the loading screen, build the game, hand over control.

import './ui/style.css';
import { installDebugApi } from './debug/debugApi';
import { Game } from './game/Game';

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;

  // The stencilled signs are drawn with these fonts, so they must be ready
  // before the level is built.
  await Promise.all([
    document.fonts.load('700 48px "Barlow Condensed"'),
    document.fonts.load('600 48px "Barlow Condensed"'),
    document.fonts.load('500 48px "Barlow Condensed"'),
    document.fonts.load('400 24px "Share Tech Mono"'),
  ]);

  const game = new Game(app);
  const debug = new URLSearchParams(location.search).has('debug');
  if (debug) installDebugApi(game);

  await game.load(() => {});
  game.start();
  if (debug) window.__HO!.ready = true;
}

boot().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;inset:auto 0 0 0;margin:0;padding:12px;background:#300;color:#fff;font:12px monospace;white-space:pre-wrap">${String(error?.stack ?? error)}</pre>`);
});
