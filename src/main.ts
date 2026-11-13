// Entry point: show the loading screen, build the game, and connect it to
// the HUD and menus.

import './ui/style.css';
import { PLAYER, QUALITY } from './config';
import { settings } from './core/settings';
import { installDebugApi } from './debug/debugApi';
import { Game } from './game/Game';
import { Hud } from './ui/Hud';
import { Screens } from './ui/Screens';

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  const screens = new Screens(app);
  screens.show('loading');

  // The stencilled signs are drawn with these fonts, so they must be ready
  // before the level is built.
  await Promise.all([
    document.fonts.load('700 48px "Barlow Condensed"'),
    document.fonts.load('600 48px "Barlow Condensed"'),
    document.fonts.load('500 48px "Barlow Condensed"'),
    document.fonts.load('400 24px "Share Tech Mono"'),
  ]);

  const game = new Game(app);
  const hud = new Hud(app);
  hud.setVisible(false);
  const debug = new URLSearchParams(location.search).has('debug');
  if (debug) installDebugApi(game);

  // Phones and tablets get the scene and a friendly note instead of a game
  // they cannot control.
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

  // ---- Game -> interface
  game.onStateChange = (state) => {
    hud.setVisible(state === 'playing');
    screens.show(state === 'playing' ? 'none' : state === 'paused' ? 'pause' : touchOnly ? 'touch' : 'title');
  };
  game.onQualityChange = (level, automatic) => {
    screens.setQuality(level, settings.value.quality);
    if (automatic) hud.showToast(`Graphics lowered to ${QUALITY[level].label} to keep the game smooth`);
  };
  game.onHit = (weak, kill) => hud.hit(weak, kill);
  game.onPlayerHurt = (angle) => hud.damage(angle);
  game.onPlayerDown = () => hud.showToast('You went down. Resetting the test.', 3);

  // ---- Interface -> game
  screens.onStart = () => game.requestPlay();
  screens.onResume = () => game.requestPlay();
  screens.onQuality = (choice) => {
    if (choice === 'auto') screens.setQuality(game.qualityLevel, 'auto');
    else game.setQuality(choice, false);
  };
  screens.onClick = () => {
    game.audio.resume();
    game.audio.play('uiClick');
  };
  screens.onHover = () => game.audio.play('uiHover');
  let wasMuted = settings.value.muted;
  settings.onChange((s) => {
    hud.showFps(s.showFps);
    if (s.muted !== wasMuted) {
      wasMuted = s.muted;
      hud.showToast(s.muted ? 'Sound off (press M to turn it back on)' : 'Sound on', 2.5);
    }
  });
  hud.showFps(settings.value.showFps);

  await game.load((fraction) => screens.setProgress(fraction));
  screens.setQuality(game.qualityLevel, settings.value.quality);
  screens.show(touchOnly ? 'touch' : 'title');

  // The HUD reads the game's state once per frame.
  const tick = () => {
    if (game.state === 'playing') {
      hud.update(1 / Math.max(game.fps, 1), {
        health: game.player.health,
        maxHealth: PLAYER.maxHealth,
        ammo: game.rifle.state.ammo,
        reloading: game.rifle.reloading,
        spread: game.rifle.spread(game.player),
        fov: game.camera.fov,
        aim: game.player.aim,
        sprinting: game.player.sprinting,
        fps: game.fps,
        quality: game.qualityLevel,
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  game.start();
  if (debug) window.__HO!.ready = true;
}

boot().catch((error) => {
  console.error(error);
  const message = document.createElement('pre');
  message.style.cssText = 'position:fixed;inset:auto 0 0 0;margin:0;padding:12px;background:#300;color:#fff;font:12px monospace;white-space:pre-wrap;z-index:99';
  message.textContent = `HUMAN OVERRIDE failed to start.\n${String(error?.stack ?? error)}`;
  document.body.appendChild(message);
});
