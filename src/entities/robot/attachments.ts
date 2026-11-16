// What ARGUS hangs on a robot to counter the player, where it can be seen:
// shielding against one weapon (plates of light round the chest, in that
// weapon's colour) and a steel plate bolted over the weak point.
//
// Both are authored in the robot's rest pose, in metres, like the body
// itself, and ride on one bone.

import * as THREE from 'three';
import { addsLightOnly } from '../../render/glow';
import type { WeaponKey } from '../../sim/argus';

/** Each weapon's shielding has its own colour, so the player can tell at a glance which gun a robot is proof against. */
export const SHIELD_COLOR: Record<string, number> = {
  pistol: 0x6dff9a,
  shotgun: 0xffa630,
  carbine: 0x4f8dff,
  melee: 0xff4fc8,
};

let plate: THREE.BufferGeometry | null = null;
let pattern: THREE.Texture | null = null;

/** A hexagon of light: a bright rim, a faint fill and a honeycomb inside it. */
function shieldPattern(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const corner = (i: number, radius: number): [number, number] => [size / 2 + Math.cos((i / 6) * Math.PI * 2) * radius, size / 2 + Math.sin((i / 6) * Math.PI * 2) * radius];
  const trace = (radius: number): void => {
    g.beginPath();
    for (let i = 0; i < 6; i++) g[i ? 'lineTo' : 'moveTo'](...corner(i, radius));
    g.closePath();
  };
  g.fillStyle = 'rgba(255,255,255,0.1)';
  trace(60);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 2;
  for (const radius of [20, 40]) {
    trace(radius);
    g.stroke();
  }
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(...corner(i, 20));
    g.lineTo(...corner(i, 60));
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.lineWidth = 6;
  trace(58);
  g.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface Shield {
  object: THREE.Group;
  /** Brightness, 1 at rest; raise it when the shielding turns a shot and let it fall back. */
  setLevel(level: number): void;
  dispose(): void;
}

/**
 * Shielding against `weapon`: four plates of light round the chest, one
 * in front, one behind and one at each side. `chest` is the middle of the
 * chest in the rest pose, and `size` the robot's own.
 */
export function createShield(weapon: WeaponKey, chest: THREE.Vector3): Shield {
  plate ??= new THREE.CircleGeometry(1, 6);
  pattern ??= shieldPattern();
  const color = new THREE.Color(SHIELD_COLOR[weapon] ?? 0xffffff);
  const material = new THREE.MeshBasicMaterial({ map: pattern, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const object = new THREE.Group();
  object.name = 'shield';
  // [sideways, up, forward, turn about the upright, radius]
  const plates: Array<[number, number, number, number, number]> = [
    [0, 0.02, 0.3, 0, 0.23],
    [0, 0.06, -0.37, Math.PI, 0.21],
    [0.31, 0.03, -0.03, Math.PI / 2, 0.17],
    [-0.31, 0.03, -0.03, -Math.PI / 2, 0.17],
  ];
  for (const [x, y, z, turn, radius] of plates) {
    const mesh = new THREE.Mesh(plate, material);
    mesh.position.set(chest.x + x, chest.y + y, chest.z + z);
    mesh.rotation.y = turn;
    mesh.scale.setScalar(radius);
    mesh.renderOrder = 8;
    addsLightOnly(mesh);
    object.add(mesh);
  }
  const setLevel = (level: number): void => {
    material.color.copy(color).multiplyScalar(1.5 * level);
  };
  setLevel(1);
  return { object, setLevel, dispose: () => material.dispose() };
}

let guardPlate: THREE.BufferGeometry | null = null;
let guardSteel: THREE.MeshStandardMaterial | null = null;
let guardEdge: THREE.MeshBasicMaterial | null = null;

/**
 * A plate over the weak point: a slab of bare steel across the visor with
 * two bolts, and a line of light along its top edge so that it shows in
 * the dark. `visor` is the middle of the visor in the rest pose.
 */
export function createGuard(visor: THREE.Vector3): THREE.Group {
  guardPlate ??= new THREE.BoxGeometry(1, 1, 1);
  guardSteel ??= new THREE.MeshStandardMaterial({ color: 0x8e8b84, metalness: 0.9, roughness: 0.42 });
  guardEdge ??= new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0d0).multiplyScalar(3), toneMapped: false, fog: false });
  const object = new THREE.Group();
  object.name = 'guard';
  const part = (material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number): void => {
    const mesh = new THREE.Mesh(guardPlate!, material);
    mesh.position.set(visor.x + x, visor.y + y, visor.z + z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = material === guardSteel;
    object.add(mesh);
  };
  // The slab, standing a little proud of the face, and the brackets that hold it to the cheeks.
  part(guardSteel, 0, 0.0, 0.035, 0.27, 0.15, 0.022);
  part(guardSteel, 0.128, 0.0, -0.02, 0.02, 0.11, 0.1);
  part(guardSteel, -0.128, 0.0, -0.02, 0.02, 0.11, 0.1);
  // Bolts.
  part(guardSteel, 0.1, 0.045, 0.049, 0.022, 0.022, 0.012);
  part(guardSteel, -0.1, 0.045, 0.049, 0.022, 0.022, 0.012);
  // The lit edge.
  part(guardEdge, 0, 0.079, 0.035, 0.27, 0.008, 0.024);
  return object;
}
