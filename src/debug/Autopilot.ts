// A debug player that moves, aims and shoots by itself.
//
// The code was written by an agent that cannot hold a mouse, so this is how
// the game gets played during testing: it presses the same buttons a person
// would. It is a crude player on purpose: it turns to the nearest robot it
// can see, fires when lined up, backs away when crowded, strikes when one
// is in reach, reloads when it should, and between fights walks to the next
// thing it can afford (a weapon, then doors) and buys it.

import * as THREE from 'three';
import { MELEE, WEAPONS } from '../config';
import { angleDelta, clamp } from '../core/math';
import type { Game } from '../game/Game';
import { rackOffer } from '../sim/economy';
import { floodFrom, nextWaypoint, type NavGrid } from '../sim/navGrid';
import { DOOR_PLANS, RACK_PLANS } from '../world/plan';

/** How fast it may turn, radians per second. */
const TURN_RATE = 7;

const _eye = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class Autopilot {
  /** What it is doing, for the debug overlay. */
  status = 'idle';

  private readonly raycaster = new THREE.Raycaster();
  /** Its own copy of the walking-distance map, flooded toward wherever it wants to go. */
  private route: NavGrid | null = null;
  private strafe: 'left' | 'right' = 'left';
  private strafeTimer = 0;
  private fireHeld = false;

  constructor(private readonly game: Game) {
    this.raycaster.firstHitOnly = true;
  }

  /** Let go of every button (when it is switched off). */
  release(): void {
    for (const action of ['forward', 'back', 'left', 'right', 'sprint', 'fire', 'aim'] as const) this.game.input.release(action);
    this.fireHeld = false;
    this.status = 'idle';
  }

  update(dt: number): void {
    const { game } = this;
    const { player, input, weapons, robots, world } = game;
    for (const action of ['forward', 'back', 'left', 'right', 'sprint'] as const) input.release(action);
    if (!player.alive) return;

    // The nearest robot it has a clear line to.
    _eye.copy(game.camera.position);
    let target: THREE.Vector3 | null = null;
    let nearest = Infinity;
    let closestAny = Infinity;
    for (const robot of robots) {
      if (!robot.alive) continue;
      const head = robot.bones.get('Head');
      if (!head) continue;
      _aim.setFromMatrixPosition(head.matrixWorld);
      const distance = _aim.distanceTo(_eye);
      closestAny = Math.min(closestAny, distance);
      if (distance >= nearest) continue;
      _dir.copy(_aim).sub(_eye).divideScalar(distance);
      this.raycaster.set(_eye, _dir);
      this.raycaster.far = distance - 0.3;
      if (this.raycaster.intersectObjects(world.solids, false).length) continue;
      nearest = distance;
      target = (target ?? new THREE.Vector3()).copy(_aim);
    }

    const state = weapons.state;
    const def = weapons.def;
    if (state.ammo === 0 && state.reserve === 0) {
      // Out of ammunition for this weapon: use the other one if there is one.
      const other = weapons.loadout.slots.findIndex((slot, i) => slot && i !== weapons.loadout.current && (slot.state.ammo > 0 || slot.state.reserve > 0));
      if (other >= 0) input.press(other === 0 ? 'weapon1' : 'weapon2');
    } else {
      input.release('weapon1');
      input.release('weapon2');
    }

    if (target) {
      this.status = `fighting (${nearest.toFixed(1)} m)`;
      const error = this.turnToward(target, dt);
      // Pull the trigger when lined up. Tapping, so single-shot weapons fire too.
      const lined = error < (nearest < 4 ? 0.12 : 0.035);
      if (lined && !this.fireHeld && state.ammo > 0) {
        input.press('fire');
        this.fireHeld = true;
      } else if (this.fireHeld && (!def.automatic || !lined)) {
        input.release('fire');
        this.fireHeld = false;
      }
      if (nearest < MELEE.range - 0.2) input.press('melee');
      else input.release('melee');
      if (state.ammo === 0 && state.reserve > 0) input.press('reload');
      else input.release('reload');

      // Keep them at arm's length: back away, sliding sideways so walls do not trap it.
      if (nearest < 5) {
        input.press('back');
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0 || player.speedFraction < 0.25) {
          this.strafe = this.strafe === 'left' ? 'right' : 'left';
          this.strafeTimer = 1.6;
        }
        input.press(this.strafe);
      }
      return;
    }

    if (this.fireHeld) {
      input.release('fire');
      this.fireHeld = false;
    }
    input.release('melee');
    if (state.ammo < def.magazine && state.reserve > 0 && !state.reloading) input.press('reload');
    else input.release('reload');

    // Nothing to shoot at. If something is close but out of sight, wait for it;
    // otherwise go shopping.
    if (closestAny < 9) {
      this.status = 'waiting';
      return;
    }
    const goal = this.nextPurchase();
    if (!goal) {
      this.status = 'waiting';
      return;
    }
    this.status = `going to ${goal.label}`;
    const distance = Math.hypot(goal.x - player.position.x, goal.z - player.position.z);
    if (distance < 1.5) {
      // Face it and press the button.
      this.turnToward(_aim.set(goal.x, 1.4, goal.z), dt);
      if (game.interactions.prompt?.usable) input.press('interact');
      else input.release('interact');
      return;
    }
    input.release('interact');
    this.route ??= { ...world.nav, distance: new Float32Array(world.nav.distance.length).fill(Infinity), goal: -1 };
    floodFrom(this.route, goal.x, goal.z);
    const waypoint = nextWaypoint(this.route, player.position.x, player.position.z);
    if (!waypoint) return;
    const error = this.turnToward(_aim.set(waypoint.x, 1.5, waypoint.z), dt);
    if (error < 0.6) {
      input.press('forward');
      if (error < 0.2 && distance > 4) input.press('sprint');
    }
  }

  /** Turn the view toward a point, no faster than a person could. Returns how far off it still is, in radians. */
  private turnToward(point: THREE.Vector3, dt: number): number {
    const { player, camera } = this.game;
    const dx = point.x - camera.position.x;
    const dy = point.y - camera.position.y;
    const dz = point.z - camera.position.z;
    const yawError = angleDelta(player.yaw, Math.atan2(-dx, -dz));
    const pitchError = Math.atan2(dy, Math.hypot(dx, dz)) - player.pitch;
    const step = TURN_RATE * dt;
    player.yaw += clamp(yawError, -step, step);
    player.pitch += clamp(pitchError, -step, step);
    return Math.hypot(yawError, pitchError);
  }

  /** The next thing worth walking to that it can pay for right now. */
  private nextPurchase(): { x: number; z: number; label: string } | null {
    const { wallet, weapons, world } = this.game;
    const reachable = world.reachable;
    for (const rack of RACK_PLANS) {
      if (!reachable.has(rack.area)) continue;
      const offer = rackOffer(wallet, weapons.loadout, rack.weapon, WEAPONS[rack.weapon]);
      if (offer.kind !== 'full' && offer.affordable) {
        return { x: rack.at[0] + rack.normal[0] * 0.9, z: rack.at[2] + rack.normal[2] * 0.9, label: `${WEAPONS[rack.weapon].name} rack` };
      }
    }
    for (const plan of DOOR_PLANS) {
      const door = world.door(plan.id);
      if (door.open || plan.cost === null || wallet.scrap < plan.cost) continue;
      const near = reachable.has(plan.a) ? plan.a : reachable.has(plan.b) ? plan.b : null;
      if (!near) continue;
      // Stand a little way back from the door, on the side it can be reached from.
      // (A door's first area is always the one on its north or west side.)
      const side = near === plan.a ? -1 : 1;
      const x = plan.along === 'x' ? door.centre.x : door.centre.x + side * 1.0;
      const z = plan.along === 'x' ? door.centre.z + side * 1.0 : door.centre.z;
      return { x, z, label: `${plan.label} door` };
    }
    return null;
  }
}
