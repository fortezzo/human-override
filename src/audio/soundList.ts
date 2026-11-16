// Every sound the game plays. `files` are recorded variations, picked at
// random so repeated sounds (gunshots, footsteps) never sound identical.
// Paths are relative to public/assets/audio. Sources: see CREDITS.md.

export type Bus = 'weapons' | 'impacts' | 'robots' | 'player' | 'ambience' | 'music' | 'ui';

export interface SoundDef {
  files: string[];
  bus: Bus;
  /** Relative loudness before bus and master volume. */
  gain: number;
  /** Random pitch variation, as a fraction (0.05 = plus or minus 5%). */
  pitchJitter?: number;
  /** How much of the sound is sent to the room reverb (0..1). */
  reverb?: number;
  /** Most copies of this sound allowed to play at once. */
  maxVoices?: number;
}

const variations = (name: string, count: number): string[] => Array.from({ length: count }, (_, i) => `${name}_${i}.mp3`);

export const SOUNDS = {
  rifleShot: { files: variations('rifle_shot', 4), bus: 'weapons', gain: 0.9, pitchJitter: 0.035, reverb: 0.5, maxVoices: 8 },
  pistolShot: { files: variations('pistol_shot', 3), bus: 'weapons', gain: 0.85, pitchJitter: 0.04, reverb: 0.5, maxVoices: 6 },
  shotgunShot: { files: variations('shotgun_shot', 3), bus: 'weapons', gain: 1.0, pitchJitter: 0.03, reverb: 0.6, maxVoices: 4 },
  rifleDry: { files: ['rifle_dry.mp3'], bus: 'weapons', gain: 0.7 },
  weaponSwitch: { files: ['weapon_switch.mp3'], bus: 'weapons', gain: 0.6, pitchJitter: 0.05, reverb: 0.1 },
  meleeHit: { files: variations('melee_hit', 3), bus: 'weapons', gain: 0.95, pitchJitter: 0.08, reverb: 0.4, maxVoices: 3 },
  reloadMagOut: { files: ['reload_magout.mp3'], bus: 'weapons', gain: 0.7, reverb: 0.15 },
  reloadMagIn: { files: ['reload_magin.mp3'], bus: 'weapons', gain: 0.75, reverb: 0.15 },
  reloadBolt: { files: ['reload_bolt.mp3'], bus: 'weapons', gain: 0.75, reverb: 0.2 },
  casing: { files: variations('casing', 3), bus: 'impacts', gain: 0.45, pitchJitter: 0.12, reverb: 0.3, maxVoices: 4 },

  impactConcrete: { files: variations('impact_concrete', 4), bus: 'impacts', gain: 0.8, pitchJitter: 0.1, reverb: 0.4, maxVoices: 5 },
  impactMetal: { files: variations('impact_metal', 4), bus: 'impacts', gain: 0.85, pitchJitter: 0.12, reverb: 0.45, maxVoices: 5 },
  impactSoft: { files: variations('impact_soft', 2), bus: 'impacts', gain: 0.7, pitchJitter: 0.1, reverb: 0.3, maxVoices: 4 },

  robotHit: { files: variations('robot_hit', 4), bus: 'robots', gain: 0.9, pitchJitter: 0.1, reverb: 0.4, maxVoices: 5 },
  robotHitWeak: { files: variations('robot_hit_weak', 2), bus: 'robots', gain: 1.0, pitchJitter: 0.06, reverb: 0.4, maxVoices: 4 },
  robotStep: { files: variations('robot_step', 4), bus: 'robots', gain: 0.55, pitchJitter: 0.08, reverb: 0.35, maxVoices: 8 },
  robotServo: { files: variations('robot_servo', 3), bus: 'robots', gain: 0.4, pitchJitter: 0.1, reverb: 0.3, maxVoices: 4 },
  robotVoice: { files: variations('robot_voice', 3), bus: 'robots', gain: 0.7, pitchJitter: 0.08, reverb: 0.5, maxVoices: 3 },
  robotAttack: { files: ['robot_attack.mp3'], bus: 'robots', gain: 0.8, pitchJitter: 0.08, reverb: 0.3, maxVoices: 4 },
  robotLand: { files: variations('robot_land', 2), bus: 'robots', gain: 0.9, pitchJitter: 0.08, reverb: 0.5, maxVoices: 4 },
  robotDeath: { files: variations('robot_death', 2), bus: 'robots', gain: 1.0, pitchJitter: 0.06, reverb: 0.6, maxVoices: 4 },
  scrap: { files: variations('scrap', 4), bus: 'impacts', gain: 0.6, pitchJitter: 0.15, reverb: 0.4, maxVoices: 5 },
  explosion: { files: variations('explosion', 2), bus: 'impacts', gain: 1.0, pitchJitter: 0.06, reverb: 0.7, maxVoices: 3 },
  bomberBeep: { files: ['bomber_beep.mp3'], bus: 'robots', gain: 0.8, reverb: 0.2, maxVoices: 4 },
  droneBuzz: { files: variations('drone_buzz', 2), bus: 'robots', gain: 0.5, pitchJitter: 0.1, reverb: 0.3, maxVoices: 4 },
  deflect: { files: variations('deflect', 3), bus: 'robots', gain: 1.0, pitchJitter: 0.07, reverb: 0.35, maxVoices: 4 },
  plateBreak: { files: ['plate_break.mp3'], bus: 'robots', gain: 1.0, pitchJitter: 0.08, reverb: 0.5, maxVoices: 3 },

  step: { files: variations('step', 5), bus: 'player', gain: 0.5, pitchJitter: 0.1, reverb: 0.25, maxVoices: 3 },
  land: { files: ['land.mp3'], bus: 'player', gain: 0.6, reverb: 0.25 },
  hurt: { files: variations('hurt', 3), bus: 'player', gain: 0.95, pitchJitter: 0.06 },

  hitTick: { files: ['hit_tick.mp3'], bus: 'ui', gain: 0.5, maxVoices: 4 },
  killTick: { files: ['kill_tick.mp3'], bus: 'ui', gain: 0.55 },
  uiClick: { files: ['ui_click.mp3'], bus: 'ui', gain: 0.6 },
  uiHover: { files: ['ui_hover.mp3'], bus: 'ui', gain: 0.4 },
  buy: { files: ['buy.mp3'], bus: 'ui', gain: 0.6 },
  deny: { files: ['deny.mp3'], bus: 'ui', gain: 0.5 },
  scrapTick: { files: ['scrap_tick.mp3'], bus: 'ui', gain: 0.35, pitchJitter: 0.1, maxVoices: 3 },
  doorOpen: { files: ['door_open.mp3'], bus: 'impacts', gain: 0.95, reverb: 0.6 },
  roundClear: { files: ['round_clear.mp3'], bus: 'music', gain: 0.8, reverb: 0.4 },
  missionPower: { files: ['mission_power.mp3'], bus: 'impacts', gain: 0.95, reverb: 0.5 },
  missionKey: { files: ['mission_key.mp3'], bus: 'ui', gain: 0.7 },
  missionNotice: { files: ['mission_notice.mp3'], bus: 'ui', gain: 0.55 },
  missionAlarm: { files: ['mission_alarm.mp3'], bus: 'music', gain: 0.8, reverb: 0.3 },
  missionSwitch: { files: ['mission_switch.mp3'], bus: 'impacts', gain: 1.0, reverb: 0.5 },
  missionSaved: { files: ['mission_saved.mp3'], bus: 'music', gain: 0.9, reverb: 0.5 },
  gameOver: { files: ['game_over.mp3'], bus: 'music', gain: 0.95, reverb: 0.3 },
  argusAnalysis: { files: ['argus_analysis.mp3'], bus: 'ui', gain: 0.9 },
  argusRemark: { files: ['argus_remark.mp3'], bus: 'ui', gain: 0.5 },

  ambienceRoom: { files: ['ambience_room.mp3'], bus: 'ambience', gain: 0.8 },
  musicBed: { files: ['music_bed.mp3'], bus: 'music', gain: 0.9 },
  sting: { files: variations('sting', 2), bus: 'music', gain: 0.9, reverb: 0.3 },
} satisfies Record<string, SoundDef>;

export type SoundId = keyof typeof SOUNDS;
