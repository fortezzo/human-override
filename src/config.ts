// Every tuning number in the game lives in this one file, so balance and
// feel can be changed without hunting through the code.
//
// Units: metres, seconds, radians unless a name says otherwise.

export const PLAYER = {
  height: 1.78,
  eyeHeight: 1.64,
  radius: 0.34,
  walkSpeed: 4.3,
  sprintSpeed: 6.4,
  aimSpeedFactor: 0.55,
  groundAccel: 46,
  groundFriction: 11,
  airAccel: 9,
  jumpSpeed: 5.4,
  gravity: 17.5,
  stepHeight: 0.32,
  maxHealth: 100,
  regenDelay: 4.0,
  regenPerSecond: 34,
  /** How hard a robot hit shoves the view (degrees). */
  hitKick: 3.2,
};

export const LOOK = {
  /** Radians of turn per pixel of mouse movement at sensitivity 1.0. */
  radiansPerPixel: 0.0021,
  aimSensitivityFactor: 0.62,
  fov: 74,
  aimFov: 52,
  sprintFovBoost: 5,
  fovLerp: 11,
  pitchLimit: 1.5,
};

export const RIFLE = {
  name: 'KR-7 Carbine',
  damage: 34,
  weakPointMultiplier: 2.4,
  limbMultiplier: 0.8,
  /** Seconds between shots (0.092 is about 650 rounds a minute). */
  fireInterval: 0.092,
  magazine: 30,
  reserve: 240,
  reloadTime: 2.15,
  /** Point in the reload (0..1) where the fresh magazine counts as seated. */
  reloadCommit: 0.72,
  range: 90,
  /** Cone half-angles in radians. */
  spreadHip: 0.016,
  spreadAim: 0.0018,
  spreadMoveBonus: 0.012,
  spreadPerShot: 0.0035,
  spreadMax: 0.03,
  spreadRecovery: 9,
  aimTime: 0.17,
  /** View kick per shot, degrees. */
  recoilPitch: 0.62,
  recoilPitchAim: 0.42,
  recoilYaw: 0.28,
  recoilRecovery: 8.5,
  /** How far the gun model itself jumps back per shot. */
  kickBack: 0.045,
  kickUp: 0.011,
  kickTilt: 0.05,
  kickRecovery: 16,
  shake: 0.16,
  tracerEvery: 1,
  tracerSpeed: 170,
  casingSpeed: 2.6,
};

export const ROBOT = {
  health: 110,
  radius: 0.36,
  walkSpeed: 1.05,
  runSpeed: 3.3,
  turnSpeed: 5.5,
  /** Animation speeds are matched to ground speed so feet do not slide. */
  walkAnimSpeedAt: 0.38,
  runAnimSpeedAt: 3.1,
  attackRange: 1.45,
  attackDamage: 34,
  /** Seconds into the swing when the hit lands, and the swing's length. */
  attackHitTime: 0.42,
  attackDuration: 1.0,
  attackCooldown: 0.5,
  /** Damage in one hit that makes the robot stagger instead of flinch. */
  staggerDamage: 60,
  staggerTime: 0.75,
  flinchTime: 0.22,
  /** Stage 0 only: how long after a kill the next robot walks in. */
  respawnDelay: 2.0,
  separation: 0.85,
  eyeColor: 0xff3a1a,
};

export const FX = {
  maxDecals: 160,
  maxCasings: 48,
  maxGibs: 72,
  gibLifetime: 9,
  sparkGravity: 9.8,
  /** How long the flash at the barrel is drawn, in seconds (about two frames). */
  muzzleFlashTime: 0.034,
  muzzleLightIntensity: 22,
  /** How fast the flash's light on the room dies away (higher is shorter). */
  muzzleLightFade: 46,
};

export const AUDIO = {
  master: 0.8,
  buses: { weapons: 0.9, impacts: 0.7, robots: 0.8, player: 0.6, ambience: 0.5, music: 0.42, ui: 0.6 },
  reverbSend: 0.34,
  /** Distance at which positional sounds start to fall off. */
  refDistance: 2.4,
  rolloff: 1.15,
};

/** Range of the brightness slider in the settings (1 = as designed). */
export const BRIGHTNESS = { min: 0.7, max: 1.6 };

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityPreset {
  label: string;
  /** Upper limit on device pixel ratio. */
  pixelRatioCap: number;
  /** Fraction of the window resolution that is actually rendered. */
  renderScale: number;
  /**
   * How many lights cast real-time shadows, and their map size. Every light
   * is switched on at every quality level, so the room is equally bright
   * on all of them; quality only decides how many of them cast shadows.
   */
  shadowLights: number;
  shadowMapSize: number;
  softShadows: boolean;
  ambientOcclusion: 'off' | 'half' | 'full';
  aoQuality: 'Performance' | 'Low' | 'Medium' | 'High';
  bloom: boolean;
  antialias: 'off' | 'smaa-low' | 'smaa-high';
  anisotropy: number;
  lightShafts: boolean;
  dustMotes: number;
  particleScale: number;
  filmGrain: number;
  chromaticAberration: number;
  reflectionProbeSize: number;
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  low: {
    label: 'Low',
    pixelRatioCap: 1,
    renderScale: 0.75,
    shadowLights: 2,
    shadowMapSize: 1024,
    softShadows: false,
    ambientOcclusion: 'off',
    aoQuality: 'Performance',
    bloom: true,
    antialias: 'off',
    anisotropy: 2,
    lightShafts: true,
    dustMotes: 220,
    particleScale: 0.5,
    filmGrain: 0.05,
    chromaticAberration: 0,
    reflectionProbeSize: 128,
  },
  medium: {
    label: 'Medium',
    pixelRatioCap: 1,
    renderScale: 1,
    shadowLights: 3,
    shadowMapSize: 1024,
    softShadows: true,
    ambientOcclusion: 'half',
    aoQuality: 'Low',
    bloom: true,
    antialias: 'smaa-low',
    anisotropy: 4,
    lightShafts: true,
    dustMotes: 450,
    particleScale: 0.75,
    filmGrain: 0.055,
    chromaticAberration: 0.0006,
    reflectionProbeSize: 256,
  },
  high: {
    label: 'High',
    pixelRatioCap: 1.25,
    renderScale: 1,
    shadowLights: 3,
    shadowMapSize: 2048,
    softShadows: true,
    ambientOcclusion: 'half',
    aoQuality: 'Medium',
    bloom: true,
    antialias: 'smaa-high',
    anisotropy: 8,
    lightShafts: true,
    dustMotes: 700,
    particleScale: 1,
    filmGrain: 0.06,
    chromaticAberration: 0.0008,
    reflectionProbeSize: 256,
  },
  ultra: {
    label: 'Ultra',
    pixelRatioCap: 2,
    renderScale: 1,
    shadowLights: 4,
    shadowMapSize: 2048,
    softShadows: true,
    ambientOcclusion: 'full',
    aoQuality: 'High',
    bloom: true,
    antialias: 'smaa-high',
    anisotropy: 16,
    lightShafts: true,
    dustMotes: 1000,
    particleScale: 1.25,
    filmGrain: 0.06,
    chromaticAberration: 0.0008,
    reflectionProbeSize: 512,
  },
};

export const QUALITY_ORDER: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];

/** Automatic quality: step down when the frame rate stays below this. */
export const GOVERNOR = {
  minFps: 44,
  /** Seconds the frame rate must stay low before stepping down. */
  window: 3.0,
  /** Ignore the first seconds after a change while shaders compile. */
  settle: 4.0,
  /**
   * If even the lowest preset is too slow, drop the rendering resolution
   * through these steps. The game plays the same; the picture gets softer.
   */
  resolutionSteps: [0.85, 0.7, 0.58, 0.5],
};

/** The overall look. Changing these re-grades the whole game. */
export const LOOKDEV = {
  exposure: 1.05,
  fogColor: 0x0b0f14,
  fogDensity: 0.034,
  // Fill light: what reaches the places no lamp shines on. Kept low so
  // the pools of lamplight still carry the mood, but high enough that
  // columns and corners read as dark concrete instead of holes.
  ambientSky: 0x4a5c7a,
  ambientGround: 0x3a3128,
  ambientIntensity: 0.7,
  environmentIntensity: 1.0,
  /** Exposure trim on quality levels with no ambient occlusion, measured so they match the others. */
  exposureWithoutAo: 0.93,
  /** Brightens only the deepest shadows in the final grade (0 = off). */
  shadowLift: 0.9,
  bloomThreshold: 0.92,
  bloomIntensity: 0.75,
  bloomRadius: 0.72,
  aoRadius: 0.85,
  aoIntensity: 3.2,
  aoFalloff: 0.9,
  /** Grade: 1 = untouched color, 0 = black and white. */
  saturation: 0.8,
  /** Extra desaturation applied only to cool hues, keeping warm lights rich. */
  coolDesaturate: 0.35,
  contrast: 1.13,
  shadowTint: [0.86, 0.97, 1.1] as [number, number, number],
  highlightTint: [1.06, 1.0, 0.92] as [number, number, number],
  vignette: 0.42,
};
