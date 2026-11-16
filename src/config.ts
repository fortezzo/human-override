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
  // (Health starts coming back this long after the last blow. It was 4
  // seconds; three rewards the player who breaks out of a crowd and keeps
  // moving, which is what good play is in a game like this.)
  regenDelay: 3.0,
  regenPerSecond: 34,
  /**
   * After a blow lands, no other blow can land for this long. Without it,
   * three robots in reach take a player from full health to down in under
   * a second, which nobody can react to. With it, being surrounded is
   * still lethal, but there is a moment in which to run. (It was 0.45,
   * and a blow did 30: a crowd took a player from full health to down in
   * 1.35 seconds. The first real person to finish the mission could not
   * have without a spot the robots could not reach. Now a crowd needs
   * five blows and at least 2.4 seconds.)
   */
  mercy: 0.6,
  /** How hard a robot hit shoves the view (degrees). */
  hitKick: 3.2,
  /**
   * Robots are solid to the player: this is how close their centres can
   * come. Less than the two bodies' widths, so a single robot can be
   * squeezed past, but a crowd cannot be walked through.
   */
  robotGap: 0.58,
};

/**
 * Sprinting drains a bar. Running should buy time, not safety: the fast
 * robots of the later rounds are nearly as quick as a sprint, and over a
 * long chase they cover more ground than a player who has to stop and
 * recover (tests/stamina.test.ts holds these numbers to that).
 */
export const STAMINA = {
  /** Seconds of sprinting a full bar pays for (about 25 metres). */
  sprintSeconds: 4,
  /** Seconds after the last sprint before the bar starts to refill. */
  recoverDelay: 1,
  /** Seconds to refill from empty, once refilling. */
  recoverSeconds: 5,
  /** After running dry, this share of the bar must return before sprinting works again. */
  restartAt: 0.3,
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
    // The sidearm has a rack of its own in the lobby, so there is always
    // something cheap to spend scrap on and an empty gun is never the end:
    // one melee kill (130) pays for a refill.
    price: 100,
    ammoPrice: 100,
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

/**
 * The mission: restore power, recover three override keys, unseal the core,
 * arm the kill switch and pull it. (The rules are in sim/mission.ts.)
 */
export const MISSION = {
  /**
   * The Custodian comes for the last key: with the first round to start
   * once the player holds the other two, and never before this round. (So
   * the mission's length follows the player. A fast one meets it in round
   * 8 and can be at the final stand before round 10; a slower one meets it
   * the round after their second key, whenever that is.)
   */
  custodianFromRound: 8,
  /** Seconds the ground round the uplink has to be held, and how far from it that ground reaches (metres). */
  uplinkSeconds: 60,
  uplinkRadius: 8.5,
  /**
   * While the uplink is being held an extra robot is sent this often
   * (seconds), up to so many of them on the map at once: `uplinkWaveBase`
   * of them, one more for every `uplinkWaveRounds` rounds played, and never
   * more than `uplinkWaveMax`. (An uplink started in round 4 with a sidearm
   * is a smaller fight than one started in round 9 with everything.)
   */
  uplinkWaveInterval: 5,
  uplinkWaveBase: 0,
  uplinkWaveRounds: 3,
  uplinkWaveMax: 4,
  /**
   * While the uplink is being held, no more robots than this are on the
   * map at once, the round's and the uplink's own together: the rest of
   * the round waits its turn. Holding ground means standing where every
   * robot knows to find you, and a round that would put fifteen robots on
   * someone free to run puts them all on someone who is not. (Without it,
   * the uplink was where half of all missions ended, whoever was playing.)
   */
  uplinkCrowd: 7,
  /** Seconds the kill switch takes to arm, and how far into that ARGUS's own unit arrives. */
  armSeconds: 75,
  bossAfter: 10,
  /**
   * The ways in that ARGUS's Proxy may use, best first. It stands half as
   * tall again as the rest: too big for a ceiling duct or for the power
   * room's doors. So it comes in on foot through the loading dock (or the
   * front of the building, should the player be able to see the dock) and
   * walks in through the core's door, which gives the player the length of
   * the room to see it coming.
   */
  proxyEntries: ['dockBaySouth', 'dockBayNorth', 'yard'],
  /**
   * During the final stand a robot is sent in this often (seconds), up to
   * this many of them on the map. The horde of the stand is a heavy one
   * that presses in at a walk, with this share of runners among it: in a
   * room the size of the core a crowd of sprinters leaves nothing to do
   * but go down, and the Proxy is there to be the thing that hunts.
   */
  standInterval: 2.2,
  standMax: 9,
  standRunners: 0.2,
  /** How near the player must be to pick up a key that is lying on the floor (metres). */
  keyReach: 1.7,
  /**
   * The Custodian, which carries a key, and the Proxy, ARGUS's own unit at
   * the final stand. `health` is a multiple of an ordinary robot's in the
   * same round; `speed` is metres per second (the player walks at 4.3);
   * `damage` is one blow; `scrap` is the bounty for destroying it;
   * `stagger` is how many times harder than an ordinary robot it is to
   * knock off balance (a point-blank shotgun blast or a melee strike still
   * rocks the Custodian; nothing rocks the Proxy); and `flinch` is how long
   * a hit slows it for, in seconds (an ordinary robot: 0.22).
   */
  custodian: { health: 5, speed: 3.0, damage: 28, scrap: 500, stagger: 2, flinch: 0.1 },
  proxy: { health: 8, speed: 3.6, damage: 36, scrap: 1500, stagger: 12, flinch: 0 },
};

/** How rounds grow. Round numbers start at 1. */
export const ROUNDS = {
  /** Seconds from pressing Play to the first robot, and between rounds. */
  firstDelay: 3.2,
  lull: 15,
  /** Robots sent in each of the first rounds, then this many more per round. */
  counts: [6, 10, 14, 18, 23, 29, 35, 40, 46, 52],
  countGrowth: 6,
  /** Most robots on the map at once; the rest wait their turn. */
  maxActive: 24,
  /**
   * A robot is only let in somewhere the player cannot see it appear. If the
   * player somehow has every entry in sight at once, it waits this many
   * seconds and then comes in behind them.
   */
  arrivalPatience: 5,
  /** A ceiling vent is not used while the player is standing within this many metres of the spot under it. */
  ventClearance: 1.8,
  /** Seconds between arrivals in round 1, shrinking by `spawnQuicken` a round down to a floor. */
  spawnInterval: 2.6,
  spawnQuicken: 0.08,
  spawnIntervalMin: 2.0,
  /** Robot health: this much in round 1, growing by a fixed step, then by a percentage. */
  health: 70,
  healthStep: 26,
  healthStepRounds: 6,
  healthGrowth: 1.03,
  /** Walking speed in round 1 and how it climbs; from `runFrom` on, a growing share run. */
  walkSpeed: 1.25,
  walkSpeedStep: 0.22,
  walkSpeedMax: 2.2,
  runFrom: 5,
  runShareStep: 0.08,
  runShareMax: 0.5,
  // Runners start slower than a walking player (4.3), pass walking pace in
  // round 8, and level off just under sprinting pace (6.4) in round 13.
  runSpeed: 3.4,
  runSpeedStep: 0.31,
  runSpeedMax: 6.0,
  /** When this few robots are left in a round, the HUD marks them. */
  markLast: 3,
};

/**
 * The special robots mixed in with the horde as the rounds climb. `from` is
 * the first round a kind appears in; that round has `count` of them, and
 * one more is added every `every` rounds, up to `most`. They take the place
 * of ordinary robots, so a round is no longer for having them. `health` is
 * a multiple of an ordinary robot's in the same round; `speed` is metres
 * per second (the player walks at 4.3 and sprints at 6.4); `damage` is one
 * blow, or the middle of the blast.
 */
export const SPECIALS = {
  /** A flying drone: fast, fragile and small. It stings from close up. */
  drone: { from: 4, count: 2, every: 2, most: 6, health: 0.3, speed: 5.2, damage: 12, hover: 1.5 },
  /**
   * A bomber. It runs at the player and, within `trigger` metres, primes:
   * `fuse` seconds later it goes off, hurting everything within `radius`
   * metres (less with distance). There is time to back out of the blast,
   * and a bomber destroyed first goes off where it stands, among its own:
   * `wreck` is the damage to robots at the middle of the blast, as a
   * multiple of an ordinary robot's health.
   */
  bomber: { from: 6, count: 1, every: 3, most: 3, health: 0.8, speed: 3.9, trigger: 2.4, fuse: 0.8, radius: 4.5, damage: 60, wreck: 2.5 },
  /**
   * A heavy: slow, and plated all over, so that a hit anywhere but the
   * glowing core in its chest does only `plating` of its damage. The core
   * takes each weapon's weak-point damage.
   */
  heavy: { from: 8, count: 1, every: 4, most: 2, health: 4, speed: 1.35, damage: 40, plating: 0.3 },
};

/**
 * ARGUS: what it takes for it to notice each habit of the player's, and
 * what each of its counters amounts to. (The rules are in sim/argus.ts and
 * sim/horde.ts. This is rule-based game AI: fixed thresholds, no learning.)
 */
export const ARGUS = {
  /** The first round it adapts for; its analysis is shown in the lull before that round. */
  fromRound: 3,
  /** The most counters in force at once. */
  maxCounters: 2,
  /** Staying within this many metres of one spot is holding it, once it has gone on for this many seconds. */
  holdRadius: 4.5,
  holdAfter: 10,
  /** How often the player's trail is sampled (seconds), and how much of it is kept. */
  sampleEvery: 0.5,
  trailSeconds: 45,
  /**
   * A lap: coming back within `lapReturn` metres of where the player was
   * at least `lapSeconds` ago, having walked `lapDistance` metres since
   * and been `lapSpan` metres away in between.
   */
  lapReturn: 3.5,
  lapSeconds: 8,
  lapDistance: 25,
  lapSpan: 8,
  /** A habit counts when: this share of a round's damage came from one weapon ... */
  weaponShare: 0.6,
  /** ... this share of the round was spent holding one spot ... */
  holdShare: 0.45,
  /** ... this many laps were run in the round ... */
  laps: 3,
  /** ... this share of hits landed on weak points. */
  weakShare: 0.4,
  /** A round with less than this to go on is not judged: damage dealt, hits landed, seconds fought. */
  minDamage: 300,
  minHits: 10,
  minSeconds: 12,
  /** Seconds between its remarks, at the least, and how long one stays on screen. */
  remarkGap: 18,
  remarkSeconds: 5,
  /**
   * The analysis arrives as a moment: large, near the top centre of the
   * view, for this many seconds (a beat for it to arrive, then about two
   * seconds held). Then it shrinks into ARGUS's corner of the screen, and
   * stays there until the next round begins; `bannerSeconds` is only the
   * longest it may stay if no round does.
   */
  momentSeconds: 2.6,
  bannerSeconds: 20,

  /** Shielding: this share of the round's ordinary robots carry it, and the weapon it answers does this share of its damage to them. */
  shielding: { share: 0.4, factor: 0.5 },
  /** Flushing out: this many bombers on top of the round's own, and this share of the round's robots come in at the entry nearest the player. */
  flush: { bombers: 2, breach: 0.5 },
  /** Interception: this many drones on top of the round's own, sent in ahead of the way the player is running. */
  intercept: { drones: 4 },
  /**
   * Guarding: this share of the round's ordinary robots wear a plate over
   * the weak point. A hit there does ordinary damage and wears the plate
   * down; it comes off after this multiple of an ordinary robot's health.
   */
  guard: { share: 0.5, plate: 0.45 },
};

/** Prices and timings of the doors between areas. */
export const DOORS = {
  lobbyHall: 750,
  lobbyPower: 1000,
  hallPower: 1250,
  /** The loading dock's two doors, and the lab's two. */
  lobbyDock: 1000,
  hallDock: 1000,
  powerLab: 1000,
  hallLab: 1250,
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
  // Five blows to go down from full health.
  attackDamage: 20,
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
  /**
   * How far above the ceiling a dropping robot starts: wholly above the
   * vent's dark lining, so nothing of it can be seen until it falls out.
   */
  dropStart: 0.05,
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
  /**
   * How long the flash at the barrel stays after the frame it fires on, in
   * seconds: two frames in all at 60 a second. (The shotgun's is shorter;
   * see its view model.)
   */
  muzzleFlashTime: 0.02,
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
