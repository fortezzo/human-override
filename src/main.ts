// Entry point: show the loading screen, build the game, and connect it to
// the HUD and menus.

import './ui/style.css';
import { BOOSTS, COACH, GRENADE, PICKUPS, QUALITY, WEAPONS } from './config';
import { settings } from './core/settings';
import { installDebugApi, type DebugTools } from './debug/debugApi';
import { SHIELD_COLOR } from './entities/robot/attachments';
import { Game } from './game/Game';
import { accuracy, readBest, type RunStats } from './game/RunStats';
import { markName } from './sim/bench';
import { BOOST_IDS } from './sim/boosts';
import { HINTS, createCoach, updateCoach, type HintId } from './sim/coach';
import { KEY_IDS } from './sim/mission';
import { AREA_NAMES } from './world/plan';
import { STATION_COLOR } from './world/Stations';
import { PICKUP_COLOR } from './game/FloorPickups';
import { Hud } from './ui/Hud';
import { Screens, type ProfileCard } from './ui/Screens';

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
    window.__HO!.announcement = { clear: () => {
        hud.announcer.dismiss();
        hud.dismissArgus();
      }, freezeAt: (seconds) => hud.announcer.freezeAt(seconds), status: () => hud.announcer.status };
    window.__HO!.analysisBanner = { hold: (stage) => hud.holdAnalysis(stage), showing: () => hud.argusShowing.analysis };
  }

  // Phones and tablets get the scene and a friendly note instead of a game
  // they cannot control.
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

  // ---- Game -> interface
  let previous = game.state;
  game.onStateChange = (state) => {
    // Coming into play from anything but a pause is a new run.
    // (Coming back from a pause, or carrying on after the ending, is the same run.)
    if (state === 'playing' && previous !== 'paused' && previous !== 'saved') hud.reset();
    previous = state;
    hud.setVisible(state === 'playing');
    if (state === 'title') screens.setBest(readBest());
    screens.show(state === 'playing' ? 'none' : state === 'paused' ? 'pause' : state === 'over' ? 'over' : state === 'saved' ? 'saved' : touchOnly ? 'touch' : 'title');
  };
  game.onQualityChange = (level, automatic) => {
    screens.setQuality(level, settings.value.quality);
    if (automatic) hud.showToast(`Graphics lowered to ${QUALITY[level].label} to keep the game smooth`);
  };
  game.onHit = (hit) => {
    hud.hit(
      hit.weakPoint,
      hit.killed,
      hit.turned ? 'turned' : hit.immune ? 'immune' : hit.guardBroke ? 'guardBroke' : hit.resisted ? 'resisted' : hit.guarded ? 'guarded' : hit.plated ? 'plated' : null,
      hit.resisted ? (SHIELD_COLOR[hit.robot.shieldedAgainst ?? ''] ?? null) : null,
    );
    hud.scrapChange(hit.scrap);
  };
  game.onAnalysis = (analysis) => hud.analysis(analysis);
  game.onRemark = (line) => hud.remark(line);
  game.onPlayerHurt = (angle) => hud.damage(angle);
  game.onRound = (event, round, amount) => {
    if (event === 'start') hud.roundStarted(round, amount, game.director.swarm);
    else hud.roundCleared(round, amount);
  };
  game.onPurchase = (purchase) => {
    if (purchase.cost > 0) hud.scrapChange(-purchase.cost);
    if ((purchase.kind === 'weapon' || purchase.kind === 'crateTake') && purchase.replaced) hud.showToast(`${WEAPONS[purchase.replaced].name} left behind`, 2.5);
    if (purchase.kind === 'bench') hud.showToast(`${WEAPONS[purchase.weapon].name} overclocked to ${markName(purchase.level)}`, 3);
  };
  game.onPickup = (id) => hud.notice(PICKUPS.names[id], PICKUPS.notes[id].toUpperCase());
  game.onDown = () => hud.failsafe('down');
  game.onRevive = () => {
    hud.failsafe('up');
    hud.notice('FAILSAFE USED', 'BUY ANOTHER AT ITS STATION');
  };
  const summary = (stats: RunStats, best: boolean) => ({
    round: Math.max(1, stats.round),
    kills: stats.kills,
    weakPointKills: stats.weakPointKills,
    meleeKills: stats.meleeKills,
    accuracy: accuracy(stats),
    scrapEarned: stats.scrapEarned,
    time: stats.time,
    missionTime: stats.missionTime,
    best,
    bestRound: readBest().round,
    bestMissionTime: readBest().missionTime,
  });
  /** The end-of-run card: ARGUS's profile of the player, with this page's address on it. */
  const profileCard = (stats: RunStats): ProfileCard => {
    const report = game.argus.report();
    return {
      label: report.profile.label,
      verdict: report.profile.verdict,
      round: Math.max(1, stats.round),
      saved: stats.missionTime !== null,
      favourite: report.favourite,
      weakShare: report.weakShare,
      accuracy: accuracy(stats),
      heldShare: report.heldShare,
      kills: stats.kills,
      laps: report.laps,
      adaptations: report.adaptations,
      // (Without "https://" and any "index.html", so that it is short enough to read off a screenshot and type.)
      url: (location.host + location.pathname).replace(/index\.html$/, ''),
    };
  };
  game.onGameOver = (stats, best) => {
    screens.setSummary(summary(stats, best));
    screens.setProfile(profileCard(stats));
  };
  game.onSaved = (stats, best) => {
    screens.setSaved(summary(stats, best));
    screens.setProfile(profileCard(stats));
  };
  game.onNotice = (title, detail) => hud.notice(title, detail);

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
  let hintsOn = settings.value.hints;
  settings.onChange((s) => {
    // (In debug mode the counter is always up: it is one of the debug tools.)
    hud.showFps(s.frameRate || debug);
    if (s.hints !== hintsOn) {
      // The hints switched on or off in the settings: start them again, or stop them.
      hintsOn = s.hints;
      coach = createCoach(COACH, s.hints ? s.learned : HINTS);
    }
    if (s.muted !== wasMuted) {
      wasMuted = s.muted;
      hud.showToast(s.muted ? 'Sound off (press M to turn it back on)' : 'Sound on', 2.5);
    }
  });
  hud.showFps(settings.value.frameRate || debug);

  // ---- The first-minute hints: what the player has done since the last frame, and so which hint (if any) to show.
  let coach = createCoach(COACH, settings.value.hints ? settings.value.learned : HINTS);
  const before = { time: 0, shots: 0, spent: 0, x: 0, z: 0, at: performance.now() };
  const coaching = (marker: { distance: number } | null): { hint: HintId; done: boolean } | null => {
    const { player, stats } = game;
    const now = performance.now();
    // (A run that has only just begun: a fresh coach, which knows what earlier runs taught.)
    if (stats.time < before.time) coach = createCoach(COACH, settings.value.hints ? settings.value.learned : HINTS);
    const step = Math.hypot(player.position.x - before.x, player.position.z - before.z);
    const learned = updateCoach(
      coach,
      COACH,
      {
        walked: player.onGround && step < 1 ? step : 0,
        fired: stats.shots > before.shots,
        aiming: player.aim > 0.6,
        jumped: !player.onGround && player.velocity.y > 1,
        bought: stats.scrapSpent > before.spent,
        canBuy: game.wallet.scrap >= COACH.buyAt,
        markerDistance: marker ? marker.distance : null,
        round: game.director.rounds.round,
      },
      Math.min(0.25, (now - before.at) / 1000),
    );
    if (learned.length && settings.value.hints) settings.set({ learned: [...new Set([...settings.value.learned, ...learned])] });
    Object.assign(before, { time: stats.time, shots: stats.shots, spent: stats.scrapSpent, x: player.position.x, z: player.position.z, at: now });
    return coach.showing ? { hint: coach.showing, done: coach.done } : null;
  };

  await game.load((fraction) => screens.setProgress(fraction));
  // (Under the title screen: see Hud.prewarm.)
  hud.prewarm();
  screens.setQuality(game.qualityLevel, settings.value.quality);
  screens.setBest(readBest());
  screens.show(touchOnly ? 'touch' : 'title');

  // The HUD reads the game's state once per frame.
  const tick = () => {
    if (game.state === 'playing') {
      const { weapons, player, director, wallet, economy } = game;
      const def = weapons.def;
      const css = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
      const objectiveMarker = game.objectiveMarker();
      hud.update(1 / Math.max(game.fps, 1), {
        health: player.health,
        maxHealth: player.maxHealth,
        stamina: player.stamina.level,
        winded: player.stamina.winded,
        weapon: weapons.title,
        grenades: economy.grenades.count,
        grenadeMax: GRENADE.max,
        boosts: BOOST_IDS.filter((id) => economy.boosts.owned[id]).map((id) => ({ name: BOOSTS[id].name, color: css(STATION_COLOR[id]) })),
        effects: [
          ...(economy.effects.overload > 0 ? [{ name: PICKUPS.names.overload, color: css(PICKUP_COLOR.overload), left: economy.effects.overload, total: PICKUPS.overloadSeconds }] : []),
          ...(economy.effects.doubleScrap > 0 ? [{ name: PICKUPS.names.doubleScrap, color: css(PICKUP_COLOR.doubleScrap), left: economy.effects.doubleScrap, total: PICKUPS.doubleSeconds }] : []),
        ],
        ammo: weapons.state.ammo,
        reserve: weapons.state.reserve,
        lowAmmo: Math.max(1, Math.floor(def.magazine * 0.2)),
        reloading: weapons.reloading,
        slots: weapons.loadout.slots.map((slot) => (slot ? WEAPONS[slot.id].kind : null)),
        current: weapons.loadout.current,
        scrap: wallet.scrap,
        round: director.rounds.round,
        // (During the final stand the rounds stand aside: there is no count to show.)
        remaining: director.suspended ? 0 : director.remaining,
        area: AREA_NAMES[game.world.playerArea],
        prompt: game.interactions.prompt,
        markers: game.markers(),
        objective: { ...game.mission.objective, keys: KEY_IDS.map((id) => game.mission.state.keys[id]) },
        objectiveMarker,
        coach: coaching(objectiveMarker),
        coachWaiting: settings.value.hints && director.rounds.round <= COACH.lastRound && HINTS.some((id) => !coach.learned[id]),
        boss: game.mission.boss,
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
