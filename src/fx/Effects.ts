// Recipes for the game's visual effects, built from particles and decals:
// what it looks like when a bullet hits concrete, steel or a robot, and
// when a robot is destroyed.

import * as THREE from 'three';
import { FX } from '../config';
import { rand } from '../core/math';
import type { SurfaceKind } from '../render/materials';
import type { BulletDecals } from './BulletDecals';
import type { Particles } from './Particles';

// Colors are linear and deliberately far above 1 where something should glow.
const SPARK = { r: 6.5, g: 2.7, b: 0.55 };
const SPARK_HOT = { r: 10, g: 8.5, b: 5.5 };
const ARC = { r: 3.5, g: 6.5, b: 11 };

const _tangent = new THREE.Vector3();
const _bitangent = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _side = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** A random direction in the half of space around `normal`. `spread` 0 = straight out, 1 = anywhere in the hemisphere. */
function scatter(normal: THREE.Vector3, spread: number, out: THREE.Vector3): THREE.Vector3 {
  _tangent.set(normal.y, normal.z, -normal.x).cross(normal).normalize();
  _bitangent.crossVectors(normal, _tangent);
  const angle = Math.random() * Math.PI * 2;
  const tilt = Math.random() * spread;
  return out
    .copy(normal)
    .multiplyScalar(1 - tilt)
    .addScaledVector(_tangent, Math.cos(angle) * tilt)
    .addScaledVector(_bitangent, Math.sin(angle) * tilt)
    .normalize();
}

export class Effects {
  constructor(
    private readonly particles: Particles,
    private readonly decals: BulletDecals,
  ) {}

  /** A bullet striking part of the level. */
  bulletImpact(point: THREE.Vector3, normal: THREE.Vector3, kind: SurfaceKind): void {
    const p = this.particles;

    if (kind === 'metal') {
      this.decals.add('metal', point, normal, rand(0.06, 0.09));
      this.sparks(point, normal, p.scaled(10), 0.75, 2.5, 8, SPARK);
      p.emitGlow({ x: point.x, y: point.y, z: point.z, vx: 0, vy: 0, vz: 0, life: 0.06, size: 0.22, sizeEnd: 0.05, ...SPARK_HOT, alpha: 0.9 });
      this.puff(point, normal, 2, 0.5, 0.3, 0.32, 0.3, 0.28);
      return;
    }

    const dusty = kind === 'concrete';
    this.decals.add('concrete', point, normal, dusty ? rand(0.09, 0.14) : rand(0.06, 0.09));
    // Pulverised material hanging in the air.
    const tone = kind === 'wood' ? [0.42, 0.33, 0.24] : kind === 'soft' ? [0.5, 0.45, 0.36] : [0.52, 0.5, 0.47];
    this.puff(point, normal, p.scaled(dusty ? 5 : 3), 1.1, dusty ? 0.55 : 0.4, tone[0]!, tone[1]!, tone[2]!);
    // Chips knocked loose.
    for (let i = 0; i < p.scaled(dusty ? 5 : 3); i++) {
      scatter(normal, 0.8, _dir);
      const speed = rand(1.5, 4.5);
      p.emitSmoke({
        x: point.x,
        y: point.y,
        z: point.z,
        vx: _dir.x * speed,
        vy: _dir.y * speed + 0.8,
        vz: _dir.z * speed,
        life: rand(0.5, 0.9),
        size: rand(0.012, 0.026),
        r: tone[0]! * 0.6,
        g: tone[1]! * 0.6,
        b: tone[2]! * 0.6,
        alpha: 1,
        gravity: FX.sparkGravity,
        bounce: true,
        drag: 0.4,
      });
    }
    if (dusty) {
      p.emitGlow({ x: point.x, y: point.y, z: point.z, vx: 0, vy: 0, vz: 0, life: 0.05, size: 0.13, sizeEnd: 0.03, r: 5, g: 3.6, b: 2.2, alpha: 0.7 });
      if (Math.random() < 0.45) this.sparks(point, normal, 3, 0.7, 2, 5, SPARK);
    }
  }

  /** A bullet striking a robot. `weakPoint` hits throw brighter, bluer sparks. */
  robotHit(point: THREE.Vector3, shotDirection: THREE.Vector3, weakPoint: boolean): void {
    const p = this.particles;
    // Most sparks spray back toward the shooter, a few carry on through.
    _dir.copy(shotDirection).negate();
    this.sparks(point, _dir, p.scaled(weakPoint ? 16 : 9), 0.85, 2, weakPoint ? 9 : 6.5, weakPoint ? SPARK_HOT : SPARK);
    this.sparks(point, shotDirection, p.scaled(3), 0.5, 2, 5, SPARK);
    if (weakPoint) this.sparks(point, _dir, p.scaled(6), 1, 1, 4, ARC);
    p.emitGlow({
      x: point.x,
      y: point.y,
      z: point.z,
      vx: 0,
      vy: 0,
      vz: 0,
      // Small and brief: a hard glint at the point of impact, not a ball
      // of light that hides the target being shot at.
      life: 0.045,
      size: weakPoint ? 0.2 : 0.12,
      sizeEnd: 0.03,
      ...(weakPoint ? ARC : SPARK_HOT),
      alpha: 0.75,
    });
    this.puff(point, _dir, 1, 0.6, 0.25, 0.2, 0.2, 0.2);
  }

  /** A robot coming apart: flash, a shower of sparks, oily smoke, a scorch on the floor. */
  robotDestroyed(centre: THREE.Vector3): void {
    const p = this.particles;
    const up = new THREE.Vector3(0, 1, 0);
    p.emitGlow({ x: centre.x, y: centre.y, z: centre.z, vx: 0, vy: 0, vz: 0, life: 0.075, size: 1.0, sizeEnd: 0.2, ...SPARK_HOT, alpha: 0.7 });
    this.sparks(centre, up, p.scaled(46), 1.6, 2.5, 10, SPARK, 1.3);
    this.sparks(centre, up, p.scaled(14), 1.6, 1, 5, ARC, 1.1);
    for (let i = 0; i < p.scaled(9); i++) {
      scatter(up, 1.3, _dir);
      const speed = rand(0.4, 1.8);
      p.emitSmoke({
        x: centre.x + rand(-0.15, 0.15),
        y: centre.y + rand(-0.3, 0.3),
        z: centre.z + rand(-0.15, 0.15),
        vx: _dir.x * speed,
        vy: Math.abs(_dir.y) * speed + 0.5,
        vz: _dir.z * speed,
        life: rand(1.2, 2.2),
        size: rand(0.25, 0.4),
        sizeEnd: rand(0.9, 1.5),
        r: 0.07,
        g: 0.07,
        b: 0.075,
        alpha: 0.6,
        drag: 1.6,
        gravity: -0.35,
        rotation: rand(0, 6),
        spin: rand(-0.6, 0.6),
      });
    }
    // Embers that hang and drift for a moment.
    for (let i = 0; i < p.scaled(10); i++) {
      p.emitGlow({
        x: centre.x + rand(-0.3, 0.3),
        y: centre.y + rand(-0.4, 0.4),
        z: centre.z + rand(-0.3, 0.3),
        vx: rand(-0.4, 0.4),
        vy: rand(0.2, 1.0),
        vz: rand(-0.4, 0.4),
        life: rand(0.8, 1.6),
        size: rand(0.012, 0.022),
        ...SPARK,
        alpha: 1,
        drag: 0.8,
        gravity: 0.4,
      });
    }
    this.decals.add('scorch', new THREE.Vector3(centre.x, 0, centre.z), up, rand(1.1, 1.6));
  }

  /**
   * A bomber going off: a white flash, a ball of fire, sparks thrown out
   * along the floor, a column of black smoke and a wide scorch. `radius`
   * is how far the blast reaches, so the picture matches the damage.
   */
  explosion(centre: THREE.Vector3, radius: number): void {
    const p = this.particles;
    const up = new THREE.Vector3(0, 1, 0);
    p.emitGlow({ x: centre.x, y: centre.y, z: centre.z, vx: 0, vy: 0, vz: 0, life: 0.09, size: radius * 1.1, sizeEnd: radius * 0.5, ...SPARK_HOT, alpha: 0.85 });
    // The fireball: a few big glows that swell and rise.
    for (let i = 0; i < p.scaled(7); i++) {
      scatter(up, 1.5, _dir);
      const speed = rand(1.5, 4);
      p.emitGlow({
        x: centre.x + _dir.x * 0.2,
        y: centre.y + _dir.y * 0.2,
        z: centre.z + _dir.z * 0.2,
        vx: _dir.x * speed,
        vy: Math.abs(_dir.y) * speed * 0.6 + 0.8,
        vz: _dir.z * speed,
        life: rand(0.22, 0.4),
        size: rand(0.5, 0.9),
        sizeEnd: rand(1.2, 1.9),
        r: 7,
        g: 2.6,
        b: 0.5,
        alpha: 0.55,
        drag: 3,
      });
    }
    this.sparks(centre, up, p.scaled(90), 1.9, 4, 15, SPARK, 1.5);
    this.sparks(centre, up, p.scaled(26), 1.9, 2, 9, SPARK_HOT, 1.2);
    for (let i = 0; i < p.scaled(16); i++) {
      scatter(up, 1.4, _dir);
      const speed = rand(0.8, 3);
      p.emitSmoke({
        x: centre.x + rand(-0.4, 0.4),
        y: centre.y + rand(-0.3, 0.5),
        z: centre.z + rand(-0.4, 0.4),
        vx: _dir.x * speed,
        vy: Math.abs(_dir.y) * speed + 0.9,
        vz: _dir.z * speed,
        life: rand(1.6, 3),
        size: rand(0.5, 0.8),
        sizeEnd: rand(1.8, 2.8),
        r: 0.05,
        g: 0.05,
        b: 0.055,
        alpha: 0.7,
        drag: 1.8,
        gravity: -0.4,
        rotation: rand(0, 6),
        spin: rand(-0.6, 0.6),
      });
    }
    this.decals.add('scorch', new THREE.Vector3(centre.x, 0, centre.z), up, radius * rand(0.75, 0.9));
  }

  /**
   * A robot's plating turning a shot. It has to be plain at a glance that
   * the round did not go in: a hard white flash where it struck, a spray
   * of long sparks thrown back off the plate in the plating's own colour,
   * and the round itself skidding away to one side as a bright streak.
   * `calm` (the "reduce flashing" setting) keeps the sparks and the streak
   * and takes most of the flash away.
   */
  deflect(point: THREE.Vector3, shotDirection: THREE.Vector3, color: THREE.Color, calm = false): void {
    const p = this.particles;
    const tint = { r: color.r * 7, g: color.g * 7, b: color.b * 7 };
    _dir.copy(shotDirection).negate();
    this.sparks(point, _dir, p.scaled(14), 1.25, 2.5, 7.5, tint, 1.15);
    this.sparks(point, _dir, p.scaled(6), 0.9, 3, 8.5, SPARK_HOT, 1.1);
    // The flash: white at the middle, the plating's colour round it. (Brief: it must not hide the robot being shot at.)
    const flash = calm ? 0.35 : 1;
    p.emitGlow({ x: point.x, y: point.y, z: point.z, vx: 0, vy: 0, vz: 0, life: 0.08, size: 0.3, sizeEnd: 0.5, r: 9, g: 9.5, b: 10, alpha: 0.7 * flash });
    p.emitGlow({ x: point.x, y: point.y, z: point.z, vx: 0, vy: 0, vz: 0, life: 0.14, size: 0.34, sizeEnd: 0.6, ...tint, alpha: 0.24 * flash });
    // The round, glancing off: back toward the shooter, well to one side or the other, and upward.
    _side.crossVectors(shotDirection, _up).normalize().multiplyScalar((Math.random() < 0.5 ? -1 : 1) * rand(0.7, 1.2));
    _dir.multiplyScalar(rand(0.35, 0.6)).add(_side);
    _dir.y += rand(0.35, 0.9);
    _dir.normalize();
    const speed = 34;
    p.emitGlow({ x: point.x, y: point.y, z: point.z, vx: _dir.x * speed, vy: _dir.y * speed, vz: _dir.z * speed, life: 0.16, size: 0.02, r: 10, g: 9, b: 7, alpha: 0.95, streak: 0.022 });
  }

  /** The plate over a weak point coming off: a clang's worth of sparks, and the plate's fragments. */
  plateBreak(point: THREE.Vector3, shotDirection: THREE.Vector3): void {
    const p = this.particles;
    _dir.copy(shotDirection).negate();
    this.sparks(point, _dir, p.scaled(30), 1.4, 2, 9, SPARK_HOT, 1.2);
    this.sparks(point, shotDirection, p.scaled(10), 1, 2, 6, SPARK);
    p.emitGlow({ x: point.x, y: point.y, z: point.z, vx: 0, vy: 0, vz: 0, life: 0.07, size: 0.6, sizeEnd: 0.15, ...SPARK_HOT, alpha: 0.8 });
    this.puff(point, _dir, 3, 0.8, 0.5, 0.3, 0.3, 0.3);
  }

  /** A robot dropping from a vent hits the floor: a ring of dust and a few sparks off its feet. */
  landing(point: THREE.Vector3): void {
    const up = new THREE.Vector3(0, 1, 0);
    const at = new THREE.Vector3(point.x, 0.05, point.z);
    this.puff(at, up, this.particles.scaled(7), 1.4, 0.6, 0.46, 0.44, 0.41);
    this.sparks(at, up, this.particles.scaled(8), 1.3, 1.5, 4, SPARK);
  }

  /** A few sparks dripping from damaged machinery (ambient detail). */
  drip(point: THREE.Vector3): void {
    this.sparks(point, new THREE.Vector3(0, -1, 0), this.particles.scaled(5), 0.5, 0.3, 1.6, SPARK);
  }

  /** The bright streak of a bullet in flight. */
  tracer(from: THREE.Vector3, to: THREE.Vector3): void {
    _dir.copy(to).sub(from);
    const distance = _dir.length();
    if (distance < 3) return;
    _dir.divideScalar(distance);
    const streak = 0.028;
    const lead = 1.2;
    this.particles.emitGlow({
      x: from.x + _dir.x * lead,
      y: from.y + _dir.y * lead,
      z: from.z + _dir.z * lead,
      vx: _dir.x * FX.tracerSpeed,
      vy: _dir.y * FX.tracerSpeed,
      vz: _dir.z * FX.tracerSpeed,
      life: Math.max(0.02, (distance - lead) / FX.tracerSpeed),
      size: 0.032,
      r: 7,
      g: 5,
      b: 2.4,
      alpha: 0.9,
      streak,
    });
  }

  /** Thin smoke curling from the muzzle after a shot. */
  muzzleSmoke(point: THREE.Vector3, direction: THREE.Vector3): void {
    this.particles.emitSmoke({
      x: point.x,
      y: point.y,
      z: point.z,
      vx: direction.x * 1.4 + rand(-0.15, 0.15),
      vy: direction.y * 1.4 + rand(0.1, 0.4),
      vz: direction.z * 1.4 + rand(-0.15, 0.15),
      life: rand(0.5, 0.9),
      size: 0.05,
      sizeEnd: rand(0.3, 0.45),
      r: 0.55,
      g: 0.55,
      b: 0.56,
      alpha: 0.16,
      drag: 3,
      gravity: -0.4,
      rotation: rand(0, 6),
      spin: rand(-1, 1),
    });
  }

  private sparks(point: THREE.Vector3, normal: THREE.Vector3, count: number, spread: number, minSpeed: number, maxSpeed: number, color: { r: number; g: number; b: number }, scale = 1): void {
    for (let i = 0; i < count; i++) {
      scatter(normal, spread, _dir);
      const speed = rand(minSpeed, maxSpeed);
      this.particles.emitGlow({
        x: point.x,
        y: point.y,
        z: point.z,
        vx: _dir.x * speed,
        vy: _dir.y * speed,
        vz: _dir.z * speed,
        life: rand(0.22, 0.6) * scale,
        size: rand(0.008, 0.014) * scale,
        ...color,
        alpha: 1,
        gravity: FX.sparkGravity,
        drag: 0.9,
        streak: 0.035,
        bounce: true,
      });
    }
  }

  private puff(point: THREE.Vector3, normal: THREE.Vector3, count: number, speed: number, size: number, r: number, g: number, b: number): void {
    for (let i = 0; i < count; i++) {
      scatter(normal, 0.6, _dir);
      const v = rand(0.3, 1) * speed;
      this.particles.emitSmoke({
        x: point.x + normal.x * 0.03,
        y: point.y + normal.y * 0.03,
        z: point.z + normal.z * 0.03,
        vx: _dir.x * v,
        vy: _dir.y * v + 0.15,
        vz: _dir.z * v,
        life: rand(0.6, 1.2),
        size: size * 0.25,
        sizeEnd: size * rand(0.9, 1.4),
        r,
        g,
        b,
        alpha: 0.4,
        drag: 2.6,
        gravity: 0.25,
        rotation: rand(0, 6),
        spin: rand(-1, 1),
      });
    }
  }
}
