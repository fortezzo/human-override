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
  { name: 'sting_0', stereo: true, bitrate: '112k', peak: 0.8, layers: [whole('dark-ambiences', 'dark-ambiences/dark_ambiences/ambience-1.wav')] },
  { name: 'sting_1', stereo: true, bitrate: '112k', peak: 0.8, layers: [whole('dark-ambiences', 'dark-ambiences/dark_ambiences/ambience-5.wav')] },
];
