// Which recording becomes which game sound.
//
// Every game sound is cut from one or more source recordings ("layers"),
// optionally filtered or re-pitched, then levelled so that sounds of the
// same kind come out at the same loudness. build-audio.mjs does the work;
// build-credits.mjs reads the `pack` fields to credit only what is used.

const FIREARM = 'firearm-library/Prepared SFX Library';
const KENNEY_IMPACT = 'impact-sounds/Audio';
const KENNEY_SCIFI = 'sci-fi-sounds/Audio';
const KENNEY_UI = 'interface-sounds/Audio';
const SCIFI_LIB = 'scifi-sfx-library/Sci-Fi Sound Library/Wav';

/** A whole short file, as is. */
const whole = (pack, file, extra = {}) => ({ pack, file, ...extra });

/**
 * name    - output file (public/assets/audio/<name>.mp3)
 * layers  - recordings mixed together: { pack, file, at?, dur?, gain?, filter?, pitch? }
 *           `at` is where the sound starts in the source; with `snap` the
 *           exact attack is found within a few hundredths of a second of it.
 * drive   - gain into a soft clipper before levelling (adds weight and tail)
 * peak    - loudest sample after levelling (1 = full scale)
 * stereo  - keep two channels (positional sounds must be mono)
 */
export const AUDIO_SPEC = [
  // ---- Rifle: the close microphone gives the crack, the far one the body.
  ...[0.61, 3.25, 6.02, 9.15].map((at, i) => ({
    name: `rifle_shot_${i}`,
    stereo: true,
    bitrate: '128k',
    peak: 0.97,
    duration: 0.85,
    fadeOut: 0.5,
    drive: 7,
    post: 'bass=g=5:f=95:w=0.8,treble=g=1.5:f=4800:w=0.6',
    layers: [
      { pack: 'firearm-library', file: `${FIREARM}/AK-47/C_28P.wav`, at, snap: true, gain: 1 },
      { pack: 'firearm-library', file: `${FIREARM}/AK-47/C_31P.wav`, at: [0.35, 4.41][i % 2], snap: true, gain: 0.55, filter: 'lowpass=f=2600' },
    ],
  })),
  // ---- Sidearm: a sharper, shorter report.
  ...[1.41, 6.44, 10.66].map((at, i) => ({
    name: `pistol_shot_${i}`,
    stereo: true,
    bitrate: '128k',
    peak: 0.9,
    duration: 0.6,
    fadeOut: 0.36,
    drive: 5,
    post: 'bass=g=3:f=120:w=0.8,treble=g=2.5:f=5200:w=0.6',
    layers: [
      { pack: 'firearm-library', file: `${FIREARM}/Walther PPQ/X_39P.wav`, at, snap: true, gain: 1 },
      { pack: 'firearm-library', file: `${FIREARM}/Walther PPQ/X_31P.wav`, at: [1.08, 5.24][i % 2], snap: true, gain: 0.5, filter: 'lowpass=f=2400' },
    ],
  })),
  // ---- Shotgun: the heaviest sound in the game, with a long tail.
  ...[0.78, 4.57, 7.95].map((at, i) => ({
    name: `shotgun_shot_${i}`,
    stereo: true,
    bitrate: '128k',
    peak: 0.99,
    duration: 1.15,
    fadeOut: 0.65,
    drive: 9,
    post: 'bass=g=7:f=80:w=0.9,treble=g=1:f=4200:w=0.6',
    layers: [
      { pack: 'firearm-library', file: `${FIREARM}/Mossberg/N_26P.wav`, at, snap: true, gain: 1 },
      { pack: 'firearm-library', file: `${FIREARM}/Mossberg/N_30P.wav`, at: [1.7, 4.96][i % 2], snap: true, gain: 0.6, filter: 'lowpass=f=2200' },
    ],
  })),
  { name: 'weapon_switch', peak: 0.55, duration: 0.3, layers: [{ pack: 'equipment-clicks-ii', file: 'equipment-clicks-ii/equipmentclicks.wav', at: 2.07, snap: true }] },
  // ---- Melee: steel on steel.
  ...[0, 1, 2].map((i) => ({
    name: `melee_hit_${i}`,
    peak: 0.95,
    drive: 2,
    layers: [whole('impact-sounds', `${KENNEY_IMPACT}/impactMetal_heavy_00${i}.ogg`), whole('impact-sounds', `${KENNEY_IMPACT}/impactPunch_heavy_00${i + 2}.ogg`, { gain: 0.7, filter: 'lowpass=f=2600' })],
  })),
  { name: 'rifle_dry', peak: 0.6, duration: 0.2, layers: [{ pack: 'equipment-clicks-ii', file: 'equipment-clicks-ii/equipmentclicks.wav', at: 0.14, snap: true }] },
  { name: 'reload_magout', peak: 0.7, duration: 0.5, layers: [{ pack: 'gun-reload-sounds', file: 'gun-reload-sounds/gunreload1.wav', at: 0.18, snap: true }] },
  { name: 'reload_magin', peak: 0.75, duration: 0.5, layers: [{ pack: 'gun-reload-sounds', file: 'gun-reload-sounds/assaultriflereload1_0.wav', at: 1.05, snap: true }] },
  { name: 'reload_bolt', peak: 0.8, layers: [whole('gun-reload-sounds', 'gun-reload-sounds/shotguncock_0.wav', { pitch: 1.12 })] },
  ...['clink1_0', 'clink2', 'clink3'].map((file, i) => ({
    name: `casing_${i}`,
    peak: 0.5,
    layers: [whole('metal-impact-sounds', `metal-impact-sounds/${file}.wav`, { pitch: 1.45 })],
  })),

  // ---- Bullets hitting things.
  ...[0, 1, 2, 3].map((i) => ({ name: `impact_concrete_${i}`, peak: 0.8, duration: 0.5, fadeOut: 0.3, layers: [whole('impact-sounds', `${KENNEY_IMPACT}/impactMining_00${i}.ogg`)] })),
  ...[0, 1, 2, 3].map((i) => ({ name: `impact_metal_${i}`, peak: 0.8, layers: [whole('impact-sounds', `${KENNEY_IMPACT}/impactMetal_light_00${i}.ogg`)] })),
  ...[0, 1].map((i) => ({ name: `impact_soft_${i}`, peak: 0.7, layers: [whole('impact-sounds', `${KENNEY_IMPACT}/impactWood_light_00${i}.ogg`)] })),

  // ---- Robots.
  ...[0, 1, 2, 3].map((i) => ({ name: `robot_hit_${i}`, peak: 0.85, layers: [whole('impact-sounds', `${KENNEY_IMPACT}/impactPlate_medium_00${i}.ogg`)] })),
  ...[0, 1].map((i) => ({
    name: `robot_hit_weak_${i}`,
    peak: 0.9,
    layers: [whole('impact-sounds', `${KENNEY_IMPACT}/impactPlate_heavy_00${i}.ogg`), whole('impact-sounds', `${KENNEY_IMPACT}/impactGlass_light_00${i}.ogg`, { gain: 0.5 })],
  })),
  ...[2, 3].map((n, i) => ({
    name: `robot_land_${i}`,
    peak: 0.95,
    drive: 2,
    layers: [whole('metal-impact-sounds', `metal-impact-sounds/thud${n}.wav`, { pitch: 0.7 }), whole('robotic-steps', 'robotic-steps/robotic/robotstomp.wav', { gain: 0.7 })],
  })),
  ...[1, 2, 3, 4].map((n, i) => ({ name: `robot_step_${i}`, peak: 0.8, duration: 0.45, fadeOut: 0.12, layers: [whole('robotic-steps', `robotic-steps/robotic/robotstep${n}.wav`)] })),
  ...[1, 2, 3].map((n, i) => ({ name: `robot_servo_${i}`, peak: 0.7, layers: [whole('robotic-steps', `robotic-steps/robotic/robot${n}.wav`)] })),
  ...[0, 1, 2].map((i) => ({
    name: `robot_voice_${i}`,
    peak: 0.8,
    layers: [whole('scifi-sfx-library', `${SCIFI_LIB}/Robot_Talk_0${i}.wav`, { pitch: 0.78, filter: 'highpass=f=120' })],
  })),
  { name: 'robot_attack', peak: 0.85, duration: 0.9, fadeOut: 0.3, layers: [whole('robotic-steps', 'robotic-steps/robotic/robotstomp.wav', { pitch: 1.25 })] },
  ...[0, 1].map((i) => ({
    name: `robot_death_${i}`,
    peak: 0.95,
    drive: 2,
    duration: 1.6,
    fadeOut: 0.6,
    layers: [
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/explosionCrunch_00${i + 1}.ogg`),
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/lowFrequency_explosion_00${i}.ogg`, { gain: 0.8 }),
      whole('breaking-falling-hit', `breaking-falling-hit/bfh1_metal_falling_0${i + 1}.ogg`, { gain: 0.7 }),
    ],
  })),
  ...[2, 3, 4, 5].map((n, i) => ({ name: `scrap_${i}`, peak: 0.7, layers: [whole('breaking-falling-hit', `breaking-falling-hit/bfh1_metal_hit_0${n}.ogg`)] })),

  // ---- The player.
  ...[0, 1, 2, 3, 4].map((i) => ({ name: `step_${i}`, peak: 0.55, layers: [whole('impact-sounds', `${KENNEY_IMPACT}/footstep_concrete_00${i}.ogg`)] })),
  { name: 'land', peak: 0.6, layers: [whole('impact-sounds', `${KENNEY_IMPACT}/impactSoft_heavy_000.ogg`)] },
  ...[0, 1, 2].map((i) => ({ name: `hurt_${i}`, peak: 0.9, layers: [whole('impact-sounds', `${KENNEY_IMPACT}/impactPunch_heavy_00${i}.ogg`, { filter: 'lowpass=f=3200' })] })),

  // ---- Interface.
  { name: 'hit_tick', peak: 0.5, layers: [whole('interface-sounds', `${KENNEY_UI}/tick_001.ogg`)] },
  { name: 'kill_tick', peak: 0.55, layers: [whole('interface-sounds', `${KENNEY_UI}/glass_002.ogg`)] },
  { name: 'ui_click', peak: 0.5, layers: [whole('interface-sounds', `${KENNEY_UI}/click_001.ogg`)] },
  { name: 'ui_hover', peak: 0.35, layers: [whole('interface-sounds', `${KENNEY_UI}/tick_002.ogg`)] },
  { name: 'buy', peak: 0.6, layers: [whole('interface-sounds', `${KENNEY_UI}/confirmation_002.ogg`, { pitch: 0.85 })] },
  { name: 'deny', peak: 0.5, layers: [whole('interface-sounds', `${KENNEY_UI}/error_004.ogg`, { pitch: 0.8 })] },
  { name: 'scrap_tick', peak: 0.3, layers: [whole('interface-sounds', `${KENNEY_UI}/drop_002.ogg`, { pitch: 1.3 })] },

  // ---- The mission.
  // The main breaker thrown and the power coming up behind it.
  {
    name: 'mission_power',
    stereo: true,
    peak: 0.9,
    duration: 2.6,
    fadeOut: 1.3,
    layers: [whole('sci-fi-sounds', `${KENNEY_SCIFI}/impactMetal_003.ogg`, { pitch: 0.6 }), whole('sci-fi-sounds', `${KENNEY_SCIFI}/forceField_002.ogg`, { gain: 0.55, pitch: 0.5 })],
  },
  // An override key in hand.
  { name: 'mission_key', peak: 0.6, layers: [whole('interface-sounds', `${KENNEY_UI}/confirmation_004.ogg`, { pitch: 0.7 }), whole('interface-sounds', `${KENNEY_UI}/glass_004.ogg`, { gain: 0.35, pitch: 0.8 })] },
  // Something in the mission has changed: goes with the line on the HUD.
  { name: 'mission_notice', peak: 0.5, layers: [whole('interface-sounds', `${KENNEY_UI}/maximize_008.ogg`, { pitch: 0.7 })] },
  // The kill switch starts to arm, and ARGUS's own unit arrives: a low two-tone warning.
  { name: 'mission_alarm', stereo: true, peak: 0.7, layers: [whole('interface-sounds', `${KENNEY_UI}/error_006.ogg`, { pitch: 0.45 }), whole('sci-fi-sounds', `${KENNEY_SCIFI}/lowFrequency_explosion_001.ogg`, { gain: 0.5, pitch: 0.7, filter: 'lowpass=f=300' })] },
  // The kill switch pulled: the lever going home, and everything ARGUS runs winding down.
  {
    name: 'mission_switch',
    stereo: true,
    peak: 0.95,
    duration: 3.4,
    fadeOut: 2.2,
    layers: [
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/doorClose_002.ogg`, { pitch: 0.45 }),
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/lowFrequency_explosion_000.ogg`, { gain: 0.8, pitch: 0.6 }),
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/spaceEngineLow_001.ogg`, { gain: 0.5, pitch: 0.5, filter: 'afade=t=out:st=0.4:d=2.6' }),
    ],
  },
  // HUMANITY SAVED: two bells a fifth apart, left to ring.
  {
    name: 'mission_saved',
    stereo: true,
    bitrate: '112k',
    peak: 0.75,
    duration: 4.6,
    fadeOut: 3.2,
    layers: [whole('impact-sounds', `${KENNEY_IMPACT}/impactBell_heavy_002.ogg`, { pitch: 0.5 }), whole('impact-sounds', `${KENNEY_IMPACT}/impactBell_heavy_000.ogg`, { gain: 0.7, pitch: 0.75 })],
  },

  // ---- The facility.
  {
    name: 'door_open',
    peak: 0.9,
    drive: 2,
    duration: 1.9,
    fadeOut: 0.5,
    layers: [
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/doorOpen_002.ogg`, { pitch: 0.42 }),
      whole('breaking-falling-hit', 'breaking-falling-hit/bfh1_metal_falling_03.ogg', { gain: 0.5, pitch: 0.6, filter: 'lowpass=f=1800' }),
    ],
  },
  { name: 'round_clear', stereo: true, bitrate: '112k', peak: 0.7, duration: 2.2, fadeOut: 1.4, layers: [whole('impact-sounds', `${KENNEY_IMPACT}/impactBell_heavy_002.ogg`, { pitch: 0.5 })] },
  {
    name: 'game_over',
    stereo: true,
    bitrate: '112k',
    peak: 0.9,
    duration: 3.2,
    fadeOut: 1.6,
    layers: [whole('sci-fi-sounds', `${KENNEY_SCIFI}/lowFrequency_explosion_001.ogg`, { pitch: 0.55 }), whole('sci-fi-sounds', `${KENNEY_SCIFI}/spaceEngineLow_002.ogg`, { gain: 0.5, pitch: 0.6 })],
  },

  // ---- Beds and stings.
  {
    name: 'ambience_room',
    stereo: true,
    bitrate: '80k',
    rms: 0.09,
    duration: 46,
    layers: [{ pack: 'factory-ambiance', file: 'factory-ambiance/Factory.ogg', at: 12, filter: 'lowpass=f=1500,highpass=f=35' }],
  },
  {
    name: 'music_bed',
    stereo: true,
    bitrate: '96k',
    rms: 0.11,
    duration: 57.6,
    layers: [{ pack: 'when-the-shadows-gather', file: 'when-the-shadows-gather/when_the_shadows_gather_0.ogg', at: 2.4 }],
  },
  // ---- Stage 3: the special robots and ARGUS's counters.
  // A bomber going off: the crunch of the blast over a long low boom.
  ...[
    ['explosionCrunch_000.ogg', 'lowFrequency_explosion_000.ogg'],
    ['explosionCrunch_003.ogg', 'lowFrequency_explosion_001.ogg'],
  ].map(([crunch, boom], i) => ({
    name: `explosion_${i}`,
    peak: 0.97,
    drive: 3,
    duration: 2.4,
    fadeOut: 1.1,
    layers: [whole('sci-fi-sounds', `${KENNEY_SCIFI}/${crunch}`, { pitch: 0.8 }), whole('sci-fi-sounds', `${KENNEY_SCIFI}/${boom}`, { gain: 0.9, pitch: 0.8 })],
  })),
  // A bomber's fuse: one short high pip, played faster and faster.
  { name: 'bomber_beep', peak: 0.7, fadeOut: 0.1, layers: [whole('interface-sounds', `${KENNEY_UI}/glass_001.ogg`, { pitch: 1.3 })] },
  // A drone passing: a short stretch of a small engine, pitched up until it whines.
  ...[0, 2].map((n, i) => ({
    name: `drone_buzz_${i}`,
    peak: 0.6,
    // (The cut is made before the pitch is raised, so it is asked for long: what comes out is under a second.)
    duration: 2.5,
    fadeOut: 0.45,
    layers: [whole('sci-fi-sounds', `${KENNEY_SCIFI}/engineCircular_00${n}.ogg`, { pitch: 1.7, filter: 'highpass=f=250,afade=t=in:st=0:d=0.2' })],
  })),
  // Plating turning a shot: the round rings off it. A bell struck hard
  // and pitched up (the ring), a light plate struck (the smack), and under
  // them a breath of the force field the plating is made of. Three of
  // them, so that a burst into the same plate does not sound like a loop.
  ...[
    [0, 1, 1.9],
    [2, 2, 2.15],
    [4, 3, 1.7],
  ].map(([bell, plate, pitch], i) => ({
    name: `deflect_${i}`,
    peak: 0.9,
    duration: 0.55,
    fadeOut: 0.18,
    layers: [
      whole('impact-sounds', `${KENNEY_IMPACT}/impactBell_heavy_00${bell}.ogg`, { pitch, gain: 1.0, filter: 'highpass=f=700' }),
      whole('impact-sounds', `${KENNEY_IMPACT}/impactPlate_light_00${plate}.ogg`, { pitch: 1.35, gain: 0.8 }),
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/forceField_000.ogg`, { pitch: 1.6, gain: 0.3 }),
    ],
  })),
  // The plate over a weak point coming off: a heavy plate struck, and steel ringing under it.
  { name: 'plate_break', peak: 0.95, duration: 1.1, fadeOut: 0.5, layers: [whole('impact-sounds', `${KENNEY_IMPACT}/impactPlate_heavy_002.ogg`), whole('impact-sounds', `${KENNEY_IMPACT}/impactMetal_heavy_001.ogg`, { gain: 0.6, pitch: 0.8 })] },
  // ARGUS has finished its analysis, and says so across the top of the
  // view: a sharp burst and a low thump as it lands (the banner snaps in,
  // so the sound must too), a stutter of machine noise as it reads out
  // what it saw, and two low notes under that, its voice.
  {
    name: 'argus_analysis',
    stereo: true,
    bitrate: '112k',
    peak: 0.8,
    duration: 1.9,
    fadeOut: 0.9,
    layers: [
      { pack: 'sci-fi-sounds', file: `${KENNEY_SCIFI}/computerNoise_003.ogg`, at: 2.45, gain: 1.5, filter: 'highpass=f=500,afade=t=out:st=0.08:d=0.14,atrim=duration=0.25' },
      { pack: 'sci-fi-sounds', file: `${KENNEY_SCIFI}/lowFrequency_explosion_000.ogg`, at: 0.07, gain: 0.7, pitch: 0.6, filter: 'lowpass=f=240' },
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/computerNoise_001.ogg`, { pitch: 0.7, gain: 0.6, filter: 'lowpass=f=2400' }),
      whole('interface-sounds', `${KENNEY_UI}/question_001.ogg`, { gain: 0.7, pitch: 0.4 }),
    ],
  },
  // ARGUS passes a remark: two low notes.
  { name: 'argus_remark', stereo: true, peak: 0.45, layers: [whole('interface-sounds', `${KENNEY_UI}/question_001.ogg`, { pitch: 0.55 })] },
  // ---- Stage 4: the economy.
  // The Turncoat firing: a large laser pitched down, with a breath of force field behind it.
  ...[0, 2].map((n, i) => ({
    name: `beam_shot_${i}`,
    stereo: true,
    peak: 0.88,
    duration: 0.8,
    fadeOut: 0.35,
    layers: [whole('sci-fi-sounds', `${KENNEY_SCIFI}/laserLarge_00${n}.ogg`, { pitch: 0.72 }), whole('sci-fi-sounds', `${KENNEY_SCIFI}/forceField_001.ogg`, { gain: 0.35, pitch: 1.5 })],
  })),
  // A robot turned to the player's side: a machine starting up.
  { name: 'turned', peak: 0.75, duration: 1.3, fadeOut: 0.4, layers: [whole('scifi-sfx-library', `${SCIFI_LIB}/Robot_Activated_00.wav`, { pitch: 1.25 })] },
  // A boost bought: the station's door, a low confirming note, and the charge going in.
  {
    name: 'boost_buy',
    stereo: true,
    peak: 0.8,
    duration: 1.5,
    fadeOut: 0.7,
    layers: [
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/doorClose_001.ogg`, { pitch: 1.35, gain: 0.8 }),
      whole('interface-sounds', `${KENNEY_UI}/confirmation_003.ogg`, { pitch: 0.62 }),
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/forceField_003.ogg`, { gain: 0.4, pitch: 0.9 }),
    ],
  },
  // The Overclock Bench at work: an arc, a struck plate and machine chatter.
  {
    name: 'bench_work',
    peak: 0.85,
    duration: 1.6,
    fadeOut: 0.5,
    layers: [
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/laserRetro_002.ogg`, { pitch: 0.5, gain: 0.8 }),
      whole('impact-sounds', `${KENNEY_IMPACT}/impactMetal_medium_002.ogg`, { gain: 0.7 }),
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/computerNoise_002.ogg`, { gain: 0.45, pitch: 1.2, filter: 'highpass=f=400' }),
    ],
  },
  // The Prototype Crate: its lid, the ticking while it chooses, the note it settles on, and the lid again.
  { name: 'crate_open', peak: 0.85, duration: 1.1, fadeOut: 0.4, layers: [whole('sci-fi-sounds', `${KENNEY_SCIFI}/doorOpen_001.ogg`, { pitch: 0.8 }), whole('impact-sounds', `${KENNEY_IMPACT}/impactPlate_heavy_003.ogg`, { gain: 0.5, pitch: 0.8 })] },
  { name: 'crate_tick', peak: 0.4, duration: 0.14, fadeOut: 0.05, layers: [whole('interface-sounds', `${KENNEY_UI}/select_003.ogg`, { pitch: 1.4 })] },
  { name: 'crate_offer', stereo: true, peak: 0.7, duration: 1.1, fadeOut: 0.6, layers: [whole('interface-sounds', `${KENNEY_UI}/confirmation_001.ogg`, { pitch: 0.75 }), whole('interface-sounds', `${KENNEY_UI}/glass_005.ogg`, { gain: 0.4, pitch: 0.7 })] },
  { name: 'crate_close', peak: 0.8, duration: 0.9, fadeOut: 0.3, layers: [whole('sci-fi-sounds', `${KENNEY_SCIFI}/doorClose_000.ogg`, { pitch: 0.9 }), whole('impact-sounds', `${KENNEY_IMPACT}/impactPlate_medium_001.ogg`, { gain: 0.5, pitch: 0.7 })] },
  // A pickup taken.
  { name: 'pickup', stereo: true, peak: 0.7, duration: 1.0, fadeOut: 0.5, layers: [whole('interface-sounds', `${KENNEY_UI}/maximize_003.ogg`, { pitch: 1.1 }), whole('interface-sounds', `${KENNEY_UI}/confirmation_001.ogg`, { gain: 0.7, pitch: 1.0 })] },
  // An EMP Blast: a low boom, a force field collapsing and a long falling tone.
  {
    name: 'emp_blast',
    stereo: true,
    bitrate: '112k',
    peak: 0.95,
    duration: 2.3,
    fadeOut: 1.2,
    drive: 2,
    layers: [
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/lowFrequency_explosion_000.ogg`),
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/forceField_004.ogg`, { gain: 0.6, pitch: 0.6 }),
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/laserLarge_004.ogg`, { gain: 0.5, pitch: 0.4 }),
    ],
  },
  // A robot battering a shutter: heavy steel struck, and the slats rattling.
  ...[2, 3, 4].map((n, i) => ({
    name: `shutter_hit_${i}`,
    peak: 0.92,
    duration: 0.8,
    fadeOut: 0.3,
    drive: 2,
    layers: [whole('impact-sounds', `${KENNEY_IMPACT}/impactMetal_heavy_00${n}.ogg`, { pitch: 0.6 }), whole('impact-sounds', `${KENNEY_IMPACT}/impactTin_medium_00${i}.ogg`, { gain: 0.6, pitch: 0.7 })],
  })),
  // A shutter forced up: sheet metal giving way.
  {
    name: 'shutter_break',
    peak: 0.97,
    duration: 1.7,
    fadeOut: 0.6,
    drive: 2,
    layers: [whole('breaking-falling-hit', 'breaking-falling-hit/bfh1_metal_falling_02.ogg'), whole('impact-sounds', `${KENNEY_IMPACT}/impactMetal_heavy_000.ogg`, { gain: 0.9, pitch: 0.5 })],
  },
  // A shutter run back down, and home.
  { name: 'shutter_repair', peak: 0.85, duration: 1.0, fadeOut: 0.3, layers: [whole('sci-fi-sounds', `${KENNEY_SCIFI}/doorClose_002.ogg`, { pitch: 0.7 }), whole('impact-sounds', `${KENNEY_IMPACT}/impactPlate_medium_002.ogg`, { gain: 0.6, pitch: 0.8 })] },
  // A grenade bouncing.
  { name: 'grenade_bounce', peak: 0.6, layers: [whole('metal-impact-sounds', 'metal-impact-sounds/clink2.wav', { pitch: 0.6 })] },
  // The fail-safe bringing the player back: a thump in the chest and a rising charge.
  {
    name: 'revive',
    stereo: true,
    peak: 0.9,
    duration: 1.7,
    fadeOut: 0.8,
    layers: [
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/lowFrequency_explosion_001.ogg`, { pitch: 1.2, filter: 'lowpass=f=400' }),
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/forceField_002.ogg`, { gain: 0.6, pitch: 1.3 }),
      whole('interface-sounds', `${KENNEY_UI}/confirmation_004.ogg`, { gain: 0.5, pitch: 0.8 }),
    ],
  },
  // The round stings. The round number snaps onto the screen the moment a
  // round begins, so each sting opens on something just as sharp: a short
  // burst of machine noise over a low thump. The dark swell underneath is
  // cut in late, so that in both it is already rising as the number lands
  // and is at its fullest half a second in, while the number is held.
  ...[
    ['ambience-1.wav', 0.9, 2.1],
    ['ambience-5.wav', 0.1, 2.72],
  ].map(([swell, from, noiseAt], i) => ({
    name: `sting_${i}`,
    stereo: true,
    bitrate: '112k',
    peak: 0.8,
    layers: [
      { pack: 'dark-ambiences', file: `dark-ambiences/dark_ambiences/${swell}`, at: from },
      { pack: 'sci-fi-sounds', file: `${KENNEY_SCIFI}/computerNoise_000.ogg`, at: noiseAt, gain: 0.5, filter: 'highpass=f=600,afade=t=out:st=0.07:d=0.13,atrim=duration=0.25' },
      whole('sci-fi-sounds', `${KENNEY_SCIFI}/lowFrequency_explosion_001.ogg`, { gain: 0.55, pitch: 0.6, filter: 'lowpass=f=240' }),
    ],
  })),
];
