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
  /**
   * How hard the player pushes off the ground, as a multiple of the speed
   * being aimed for per second. It must stay larger than groundFriction:
   * if friction is the stronger of the two, the top speed is never reached.
   */
  groundAccel: 12,
  /** Share of the current speed lost to friction per second. */
  groundFriction: 11,
  /** Steering in mid-air, in metres per second per second. */
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

export type WeaponId = 'pistol' | 'shotgun' | 'carbine';

/** Everything that makes one gun different from another. */
export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** Short label for the HUD and wall signs. */
  kind: string;
  /** Holding the trigger keeps firing. */
  automatic: boolean;
  /** Damage of one projectile; a shotgun fires several per shot. */
  damage: number;
  pellets: number;
  weakPointMultiplier: number;
  limbMultiplier: number;
  /** Full damage out to `falloffStart` metres, easing down to `falloffMin` (a fraction) at `falloffEnd`. */
  falloffStart: number;
  falloffEnd: number;
  falloffMin: number;
  /** Seconds between shots. */
  fireInterval: number;
  magazine: number;
  /** Spare rounds when bought, and the most that can be carried. */
  reserve: number;
  reserveMax: number;
  reloadTime: number;
  /** Point in the reload (0..1) where the fresh magazine counts as seated. */
  reloadCommit: number;
  range: number;
  /** Cone half-angles in radians. */
  spreadHip: number;
  spreadAim: number;
  spreadMoveBonus: number;
  spreadPerShot: number;
  spreadMax: number;
  spreadRecovery: number;
  /** Extra scatter of each pellet around the shot's direction. */
  pelletSpread: number;
  aimTime: number;
  /** Camera field of view while aiming, in degrees. */
  aimFov: number;
  /** View kick per shot, degrees. */
  recoilPitch: number;
  recoilPitchAim: number;
  recoilYaw: number;
  /** How far the gun model itself jumps per shot. */
  kickBack: number;
  kickUp: number;
  kickTilt: number;
  kickRecovery: number;
  shake: number;
  /** Speed of the ejected casing (0 = none). */
  casingSpeed: number;
  /** Strength of the flash's light on the room and the low thump under the shot. */
  flash: number;
  thump: number;
  /** Scrap to buy it from a wall rack, and to refill it there once owned. */
  price: number;
  ammoPrice: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol',
    name: 'VK-9 Sidearm',
    kind: 'SIDEARM',
    automatic: false,
    damage: 28,
    pellets: 1,
    weakPointMultiplier: 2.2,
    limbMultiplier: 0.8,
    falloffStart: 22,
    falloffEnd: 55,
    falloffMin: 0.6,
    fireInterval: 0.135,
    magazine: 12,
    reserve: 72,
    reserveMax: 96,
    reloadTime: 1.4,
    reloadCommit: 0.7,
    range: 80,
    spreadHip: 0.011,
    spreadAim: 0.0016,
    spreadMoveBonus: 0.01,
    spreadPerShot: 0.007,
    spreadMax: 0.032,
    spreadRecovery: 7,
    pelletSpread: 0,
    aimTime: 0.14,
    aimFov: 58,
    recoilPitch: 1.15,
    recoilPitchAim: 0.8,
    recoilYaw: 0.35,
    kickBack: 0.05,
    kickUp: 0.014,
    kickTilt: 0.13,
    kickRecovery: 15,
    shake: 0.13,
    casingSpeed: 2.2,
    flash: 0.7,
    thump: 0.55,
    price: 0,
    ammoPrice: 0,
  },
  shotgun: {
    id: 'shotgun',
    name: 'DB-12 Breacher',
    kind: 'SHOTGUN',
    automatic: false,
    damage: 15,
    pellets: 9,
    weakPointMultiplier: 1.5,
    limbMultiplier: 0.85,
    falloffStart: 5,
    falloffEnd: 18,
    falloffMin: 0.3,
    fireInterval: 0.5,
    magazine: 6,
    reserve: 30,
    reserveMax: 48,
    reloadTime: 2.3,
    reloadCommit: 0.74,
    range: 45,
    spreadHip: 0.012,
    spreadAim: 0.006,
    spreadMoveBonus: 0.008,
    spreadPerShot: 0.01,
    spreadMax: 0.03,
    spreadRecovery: 6,
    pelletSpread: 0.062,
    aimTime: 0.2,
    aimFov: 60,
    recoilPitch: 3.4,
    recoilPitchAim: 2.8,
    recoilYaw: 0.9,
    kickBack: 0.12,
    kickUp: 0.03,
    kickTilt: 0.17,
    kickRecovery: 9,
    shake: 0.42,
    casingSpeed: 0,
    flash: 1.5,
    thump: 1.5,
    price: 750,
    ammoPrice: 375,
  },
  carbine: {
    id: 'carbine',
    name: 'KR-7 Carbine',
    kind: 'CARBINE',
    automatic: true,
    damage: 34,
    pellets: 1,
    weakPointMultiplier: 2.4,
    limbMultiplier: 0.8,
    falloffStart: 30,
    falloffEnd: 70,
    falloffMin: 0.7,
    /** 0.092 is about 650 rounds a minute. */
    fireInterval: 0.092,
    magazine: 30,
    reserve: 150,
    reserveMax: 270,
    reloadTime: 2.15,
    reloadCommit: 0.72,
    range: 90,
    spreadHip: 0.016,
    spreadAim: 0.0018,
    spreadMoveBonus: 0.012,
    spreadPerShot: 0.0035,
    spreadMax: 0.03,
    spreadRecovery: 9,
    pelletSpread: 0,
    aimTime: 0.17,
    aimFov: 52,
    recoilPitch: 0.62,
    recoilPitchAim: 0.42,
    recoilYaw: 0.28,
    kickBack: 0.045,
    kickUp: 0.011,
    kickTilt: 0.05,
    kickRecovery: 16,
    shake: 0.16,
    casingSpeed: 2.6,
    flash: 1,
    thump: 0.9,
    price: 1500,
    ammoPrice: 600,
  },
};

/** What the player carries, and how the two-weapon limit behaves. */
export const LOADOUT = {
  starting: 'pistol' as WeaponId,
  slots: 2,
  /** Seconds to put one weapon away and bring the other up. */
  switchTime: 0.42,
  /** How fast view kick settles, shared by every weapon. */
  recoilRecovery: 8.5,
};

/** The melee strike (V): a jab with whatever is in hand. */
export const MELEE = {
  damage: 150,
  /** Reach from the player, and half the angle of the arc it covers (radians). */
  range: 2.1,
  arc: 0.75,
  /** Seconds before another strike, and the moment in the swing when it lands. */
  cooldown: 0.62,
  hitTime: 0.12,
  shake: 0.3,
};

/** Scrap: what earns it. Prices live with the things they buy. */
export const SCRAP = {
  start: 0,
  /** A shot that hits but does not destroy. */
  hit: 10,
  /** Destroying a robot (this replaces the hit award for that shot). */
  kill: 60,
  weakPointKill: 100,
  meleeKill: 130,
};

/** How rounds grow. Round numbers start at 1. */
export const ROUNDS = {
  /** Seconds from pressing Play to the first robot, and between rounds. */
  firstDelay: 3.2,
  lull: 7,
  /** Robots sent in each of the first rounds, then this many more per round. */
  counts: [6, 8, 11, 14, 18, 22, 26, 30, 34, 38],
  countGrowth: 4,
  /** Most robots on the map at once; the rest wait their turn. */
  maxActive: 24,
  /** Seconds between arrivals in round 1, shrinking by `spawnQuicken` a round down to a floor. */
  spawnInterval: 2.3,
  spawnQuicken: 0.22,
  spawnIntervalMin: 0.45,
  /** Robot health: this much in round 1, growing by a fixed step, then by a percentage. */
  health: 70,
  healthStep: 35,
  healthStepRounds: 9,
  healthGrowth: 1.1,
  /** Walking speed in round 1 and how it climbs; from `runFrom` on, a growing share run. */
  walkSpeed: 1.25,
  walkSpeedStep: 0.22,
  walkSpeedMax: 2.2,
  runFrom: 4,
  runShareStep: 0.15,
  runShareMax: 0.85,
  runSpeed: 2.9,
  runSpeedStep: 0.12,
  runSpeedMax: 4.0,
  /** When this few robots are left in a round, the HUD marks them. */
  markLast: 3,
};

/** Prices and timings of the doors between areas. */
export const DOORS = {
  lobbyHall: 750,
  lobbyPower: 1000,
  hallPower: 1250,
  /** Seconds a door takes to slide open. */
  openTime: 1.6,
};

export const ROBOT = {
  /** Round 1 health; later rounds come from ROUNDS. */
  health: 70,
  radius: 0.36,
  walkSpeed: 1.25,
  runSpeed: 3.3,
  turnSpeed: 5.5,
  /** Animation speeds are matched to ground speed so feet do not slide. */
  walkAnimSpeedAt: 0.38,
  runAnimSpeedAt: 3.1,
  /** Above this ground speed the run animation is used instead of the walk. */
  runAbove: 1.75,
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
  /** How strongly robots steer away from each other, and from how far. */
  separation: 0.85,
  separationForce: 2.2,
  /** A robot that has made no headway for this long is sent round again. */
  stuckTime: 7,
  /** Seconds a robot dropping from a vent takes to find its feet. */
  landingTime: 0.55,
  /** How far below the ceiling a dropping robot starts (inside the vent shaft). */
  dropStart: 0.5,
  /** Robots hurry across the yard at least this fast, then slow to their own pace indoors. */
  arrivalSpeed: 3.3,
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
  tracerSpeed: 170,
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
