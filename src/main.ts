// Entry point: show the loading screen, build the game, and connect it to
// the HUD and menus.

import './ui/style.css';
import { PLAYER, QUALITY, WEAPONS } from './config';
import { settings } from './core/settings';
import { installDebugApi, type DebugTools } from './debug/debugApi';
import { Game } from './game/Game';
import { accuracy, readBest } from './game/RunStats';
import { AREA_NAMES } from './world/plan';
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
  let tools: DebugTools | null = null;
  if (debug) {
    tools = installDebugApi(game);
    window.__HO!.announcement = { freezeAt: (seconds) => hud.announcer.freezeAt(seconds), status: () => hud.announcer.status };
  }

  // Phones and tablets get the scene and a friendly note instead of a game
  // they cannot control.
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

  // ---- Game -> interface
  let previous = game.state;
  game.onStateChange = (state) => {
    // Coming into play from anything but a pause is a new run.
    if (state === 'playing' && previous !== 'paused') hud.reset();
    previous = state;
    hud.setVisible(state === 'playing');
    if (state === 'title') screens.setBest(readBest().round);
    screens.show(state === 'playing' ? 'none' : state === 'paused' ? 'pause' : state === 'over' ? 'over' : touchOnly ? 'touch' : 'title');
  };
  game.onQualityChange = (level, automatic) => {
    screens.setQuality(level, settings.value.quality);
    if (automatic) hud.showToast(`Graphics lowered to ${QUALITY[level].label} to keep the game smooth`);
  };
  game.onHit = (hit) => {
    hud.hit(hit.weakPoint, hit.killed);
    hud.scrapChange(hit.scrap);
  };
  game.onPlayerHurt = (angle) => hud.damage(angle);
  game.onRound = (event, round, amount) => {
    if (event === 'start') hud.roundStarted(round, amount);
    else hud.roundCleared(round, amount);
  };
  game.onPurchase = (purchase) => {
    hud.scrapChange(-purchase.cost);
    if (purchase.kind === 'weapon' && purchase.replaced) hud.showToast(`${WEAPONS[purchase.replaced].name} left behind`, 2.5);
  };
  game.onGameOver = (stats, best) => {
    screens.setSummary({
      round: Math.max(1, stats.round),
      kills: stats.kills,
      weakPointKills: stats.weakPointKills,
      meleeKills: stats.meleeKills,
      accuracy: accuracy(stats),
      scrapEarned: stats.scrapEarned,
      time: stats.time,
      best,
      bestRound: readBest().round,
    });
  };

  // ---- Interface -> game
  screens.onStart = () => game.requestPlay();
  screens.onResume = () => game.requestPlay();
  screens.onRestart = () => {
    hud.reset();
    game.restart();
  };
  screens.onQuit = () => game.toTitle();
  screens.onQuality = (choice) => {
    // "Auto" starts again from the level guessed for this computer (and
    // steps down from there if it has to), not merely from whichever
    // level happened to be in use when it was pressed.
    game.setQuality(choice === 'auto' ? game.automaticQuality() : choice, false);
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
  screens.setBest(readBest().round);
  screens.show(touchOnly ? 'touch' : 'title');

  // The HUD reads the game's state once per frame.
  const tick = () => {
    if (game.state === 'playing') {
      const { weapons, player, director, wallet } = game;
      const def = weapons.def;
      hud.update(1 / Math.max(game.fps, 1), {
        health: player.health,
        maxHealth: PLAYER.maxHealth,
        stamina: player.stamina.level,
        winded: player.stamina.winded,
        weapon: def.name,
        ammo: weapons.state.ammo,
        reserve: weapons.state.reserve,
        lowAmmo: Math.max(1, Math.floor(def.magazine * 0.2)),
        reloading: weapons.reloading,
        slots: weapons.loadout.slots.map((slot) => (slot ? WEAPONS[slot.id].kind : null)),
        current: weapons.loadout.current,
        scrap: wallet.scrap,
        round: director.rounds.round,
        remaining: director.remaining,
        area: AREA_NAMES[game.world.playerArea],
        prompt: game.interactions.prompt,
        markers: game.markers(),
        spread: weapons.spread(player),
        fov: game.camera.fov,
        aim: player.aim,
        sprinting: player.sprinting,
        fps: game.fps,
        quality: game.qualityLevel,
        debug: tools ? tools.overlay() : null,
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
