// What happens when the player pulls the trigger or strikes: what each
// projectile hits, how much it hurts, what it pays, and everything seen and
// heard as a result.

import * as THREE from 'three';
import { MELEE, PICKUPS, SCRAP, TURNCOAT, type WeaponDef, type WeaponId } from '../config';
import { settings } from '../core/settings';
import { SHIELD_COLOR } from '../entities/robot/attachments';
import type { WeaponKey } from '../sim/argus';
import { resolveHit } from '../sim/armour';
import type { AudioEngine } from '../audio/AudioEngine';
import type { SoundId } from '../audio/soundList';
import { lerp, rand } from '../core/math';
import type { Player } from '../entities/Player';
import type { Robot } from '../entities/robot/Robot';
import type { ShotEvent } from '../entities/weapon/WeaponController';
import type { WeaponView } from '../entities/weapon/WeaponView';
import type { Casings } from '../fx/Casings';
import type { Effects } from '../fx/Effects';
import type { SurfaceKind } from '../render/materials';
import { awardFor } from '../sim/economy';
import type { World } from '../world/World';

const SHOT_SOUND: Record<WeaponId, SoundId> = { pistol: 'pistolShot', shotgun: 'shotgunShot', carbine: 'rifleShot', turncoat: 'beamShot' };

/** What one shot or strike did to one robot. */
export interface HitResult {
  robot: Robot;
  weakPoint: boolean;
  killed: boolean;
  melee: boolean;
  /** Scrap it paid. */
  scrap: number;
  /** What did it: a weapon's id, or 'melee'. */
  weapon: WeaponKey;
  /** Damage done to the robot. */
  damage: number;
  /** The robot's shielding against this weapon took half of it. */
  resisted: boolean;
  /** It landed on a heavy's plating, not its core. */
  plated: boolean;
  /** It landed on the plate over the weak point; `guardBroke` if that knocked the plate off. */
  guarded: boolean;
  guardBroke: boolean;
  /** The Turncoat's beam turned it to the player's side. */
  turned?: boolean;
  /** The Turncoat's beam struck one of ARGUS's own machines, which cannot be turned. */
  immune?: boolean;
}

interface Tally {
  damage: number;
  weak: boolean;
  resisted: boolean;
  plated: boolean;
  guarded: boolean;
  guardBroke: boolean;
  point: THREE.Vector3;
}

const STRIKE = { damage: MELEE.damage, weakPointMultiplier: 1, limbMultiplier: 1 };
const _tint = new THREE.Color();
const BEAM = new THREE.Color(TURNCOAT.color);
const BEAM_GLOW = { r: BEAM.r * 9, g: BEAM.g * 9, b: BEAM.b * 9 };

const _end = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _right = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _to = new THREE.Vector3();

export class Combat {
  /** Called once for every robot a shot or strike lands on. */
  onHit: (hit: HitResult) => void = () => {};
  /** Called for every shot fired, with whether it hit anything. */
  onShotFired: (hit: boolean) => void = () => {};
  /**
   * What is in force right now, set by the game each frame: Overload (every
   * hit destroys what it lands on), and an ordinary robot's health this
   * round (the measure of what the Turncoat does to a machine it cannot turn).
   */
  readonly modifiers = { overload: false, ordinaryHealth: 100 };

  private readonly raycaster = new THREE.Raycaster();
  private readonly tallies = new Map<Robot, Tally>();
  private readonly pool: THREE.Vector3[] = [];

  constructor(
    private readonly world: World,
    private readonly robots: Robot[],
    private readonly player: Player,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly view: WeaponView,
    private readonly effects: Effects,
    private readonly casings: Casings,
    private readonly audio: AudioEngine,
  ) {
    this.raycaster.firstHitOnly = true;
  }

  /** What a hit of `damage` really does to this robot right now: under Overload, everything it has left (ARGUS's own machines take a multiple instead). */
  private dealt(robot: Robot, damage: number): number {
    if (!this.modifiers.overload) return damage;
    return robot.role ? damage * PICKUPS.overloadElite : Math.max(damage, robot.mind.health + 1);
  }

  /** Damage multiplier for a hit at `distance` metres. */
  private static falloff(weapon: WeaponDef, distance: number): number {
    if (distance <= weapon.falloffStart) return 1;
    if (distance >= weapon.falloffEnd) return weapon.falloffMin;
    return lerp(1, weapon.falloffMin, (distance - weapon.falloffStart) / (weapon.falloffEnd - weapon.falloffStart));
  }

  shot(shot: ShotEvent): void {
    const { player, audio, effects, view } = this;
    const { weapon, origin, directions } = shot;
    const pellets = directions.length;
    this.tallies.clear();

    // Recoil and flash first, so the muzzle position below is the barrel that fired.
    view.kick(player.aim, weapon);
    const muzzle = view.muzzleWorld();

    directions.forEach((direction, index) => {
      // What does this projectile hit first: the level, or a robot?
      this.raycaster.set(origin, direction);
      this.raycaster.far = weapon.range;
      const worldHit = this.raycaster.intersectObjects(this.world.solids, false)[0];
      let limit = worldHit ? worldHit.distance : weapon.range;

      let struck: Robot | null = null;
      let zone: 'head' | 'torso' | 'limb' = 'torso';
      let point: THREE.Vector3 | null = null;
      for (const robot of this.robots) {
        const hit = robot.hitTest(origin, direction, limit);
        if (hit) {
          limit = hit.distance;
          struck = robot;
          zone = hit.zone;
          point = hit.point;
        }
      }

      if (struck && point) {
        // Plating, shielding and a plate over the weak point each take their share (sim/armour.ts).
        const hit = resolveHit(struck.armour, zone, weapon.id, weapon, Combat.falloff(weapon, limit));
        const tally = this.tallies.get(struck);
        if (tally) {
          tally.damage += hit.damage;
          tally.weak ||= hit.weakPoint;
          tally.resisted ||= hit.resisted;
          tally.plated ||= hit.plated;
          tally.guarded ||= hit.guarded;
          tally.guardBroke ||= hit.guardBroke;
        } else {
          this.tallies.set(struck, {
            damage: hit.damage,
            weak: hit.weakPoint,
            resisted: hit.resisted,
            plated: hit.plated,
            guarded: hit.guarded,
            guardBroke: hit.guardBroke,
            point: (this.pool[this.tallies.size] ??= new THREE.Vector3()).copy(point),
          });
        }
      } else if (worldHit) {
        _normal.copy(worldHit.face!.normal).transformDirection(worldHit.object.matrixWorld);
        if (_normal.dot(direction) > 0) _normal.negate();
        const kind = (worldHit.object.userData.kind as SurfaceKind) ?? 'concrete';
        effects.bulletImpact(worldHit.point, _normal, kind);
        // A blast of pellets makes one sound, not nine.
        if (index % 3 === 0) audio.play(kind === 'metal' ? 'impactMetal' : kind === 'concrete' ? 'impactConcrete' : 'impactSoft', { position: worldHit.point });
      }
      if (weapon.id === 'turncoat') effects.beam(muzzle, _end.copy(origin).addScaledVector(direction, limit), BEAM_GLOW);
      else if (pellets === 1 || index % 2 === 0) effects.tracer(muzzle, _end.copy(origin).addScaledVector(direction, limit));
    });

    // Apply each robot's share of the shot once, so a blast staggers and pays as one hit.
    const centre = directions[0]!;
    for (const [robot, tally] of this.tallies) {
      if (weapon.id === 'turncoat') {
        this.beamHit(robot, tally, centre);
        continue;
      }
      tally.damage = this.dealt(robot, tally.damage);
      const result = robot.damage(tally.damage, centre);
      effects.robotHit(tally.point, centre, tally.weak);
      this.armourFeedback(robot, tally, centre);
      // (A shot the plating or the shielding took most of sounds like one: steel, not machinery.)
      audio.play(tally.weak ? 'robotHitWeak' : tally.plated || tally.guarded ? 'impactMetal' : 'robotHit', { position: tally.point });
      audio.play(result.killed ? 'killTick' : 'hitTick');
      const report = { killed: result.killed, weakPoint: tally.weak, melee: false };
      this.onHit({ robot, ...report, scrap: awardFor(report, SCRAP), weapon: weapon.id, damage: tally.damage, resisted: tally.resisted, plated: tally.plated, guarded: tally.guarded, guardBroke: tally.guardBroke });
    }
    this.onShotFired(this.tallies.size > 0);

    // Everything the shooter sees and feels.
    if (weapon.id !== 'turncoat') effects.muzzleSmoke(muzzle, centre);
    player.addRecoil(lerp(weapon.recoilPitch, weapon.recoilPitchAim, player.aim), rand(-weapon.recoilYaw, weapon.recoilYaw));
    player.addShake(weapon.shake * (1 - player.aim * 0.35));
    audio.play(SHOT_SOUND[weapon.id]);
    audio.thump(weapon.thump);

    // Spent casing out to the right.
    const port = weapon.casingSpeed > 0 ? view.ejectionPortWorld() : null;
    if (port) {
      _right.setFromMatrixColumn(this.camera.matrixWorld, 0);
      const velocity = new THREE.Vector3()
        .copy(_right)
        .multiplyScalar(weapon.casingSpeed * rand(0.8, 1.2))
        .addScaledVector(centre, -0.4)
        .add(player.velocity);
      velocity.y += rand(1.4, 2.2);
      this.casings.eject(port, velocity);
    }
  }

  /**
   * The Turncoat's beam has struck a robot. One of the horde is turned to
   * the player's side (for half the time if it is shielded against the
   * beam). One of ARGUS's own machines cannot be turned: it is only hurt.
   */
  private beamHit(robot: Robot, tally: Tally, direction: THREE.Vector3): void {
    const factor = tally.resisted ? robot.armour.shieldFactor : 1;
    this.armourFeedback(robot, { resisted: tally.resisted, guardBroke: false, point: tally.point }, direction);
    if (robot.role) {
      const damage = this.dealt(robot, TURNCOAT.eliteDamage * this.modifiers.ordinaryHealth * factor);
      const result = robot.damage(damage, direction);
      this.effects.robotHit(tally.point, direction, false);
      this.audio.play('robotHit', { position: tally.point });
      this.audio.play(result.killed ? 'killTick' : 'hitTick');
      const report = { killed: result.killed, weakPoint: false, melee: false };
      this.onHit({ robot, ...report, scrap: awardFor(report, SCRAP), weapon: 'turncoat', damage, resisted: tally.resisted, plated: false, guarded: false, guardBroke: false, immune: true });
      return;
    }
    robot.turn(TURNCOAT.seconds * factor);
    this.effects.turned(tally.point, BEAM_GLOW);
    this.audio.play('turned', { position: tally.point });
    this.audio.play('hitTick');
    this.onHit({ robot, killed: false, weakPoint: false, melee: false, scrap: SCRAP.hit, weapon: 'turncoat', damage: 0, resisted: tally.resisted, plated: false, guarded: false, guardBroke: false, turned: true });
  }

  /** What is seen and heard when a robot's shielding turns a shot, or the plate over its weak point comes off. */
  private armourFeedback(robot: Robot, hit: { resisted: boolean; guardBroke: boolean; point: THREE.Vector3 }, direction: THREE.Vector3): void {
    if (hit.resisted) {
      robot.flashShield();
      this.effects.deflect(hit.point, direction, _tint.setHex(SHIELD_COLOR[robot.shieldedAgainst ?? ''] ?? 0xffffff), settings.value.reducedMotion);
      this.audio.play('deflect', { position: hit.point });
    }
    if (hit.guardBroke) {
      const at = robot.dropGuard(_end);
      if (at) {
        this.effects.plateBreak(at, direction);
        this.audio.play('plateBreak', { position: at });
      }
    }
  }

  /** The melee strike begins: the swing is heard whether or not it lands. */
  swing(): void {
    this.audio.whoosh();
    this.player.addShake(0.08);
  }

  /** The moment the strike lands: hit the nearest robot in reach and in front. */
  strike(): void {
    const { player, camera } = this;
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();

    let target: Robot | null = null;
    let nearest = MELEE.range;
    for (const robot of this.robots) {
      if (!robot.alive) continue;
      _to.set(robot.position.x - player.position.x, 0, robot.position.z - player.position.z);
      const distance = _to.length();
      if (distance >= nearest) continue;
      // Anything this close counts; further out it must be in front.
      if (distance > 0.7 && _to.dot(_forward) / distance < Math.cos(MELEE.arc)) continue;
      nearest = distance;
      target = robot;
    }
    if (!target) return;

    const point = target.chest(new THREE.Vector3());
    const hit = resolveHit(target.armour, 'torso', 'melee', STRIKE);
    hit.damage = this.dealt(target, hit.damage);
    const result = target.damage(hit.damage, _forward);
    this.effects.robotHit(point, _forward, false);
    this.armourFeedback(target, { resisted: hit.resisted, guardBroke: false, point }, _forward);
    this.audio.play('meleeHit', { position: point });
    this.audio.play(result.killed ? 'killTick' : 'hitTick');
    player.addShake(MELEE.shake);
    const report = { killed: result.killed, weakPoint: false, melee: true };
    this.onHit({ robot: target, ...report, scrap: awardFor(report, SCRAP), weapon: 'melee', damage: hit.damage, resisted: hit.resisted, plated: hit.plated, guarded: false, guardBroke: false });
  }
}
