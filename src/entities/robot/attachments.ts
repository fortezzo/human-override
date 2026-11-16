// What ARGUS hangs on a robot to counter the player, where it can be seen:
// shielding against one weapon (plates of light round the chest, in that
// weapon's colour) and a steel plate bolted over the weak point.
//
// Both are authored in the robot's rest pose, in metres, like the body
// itself, and ride on one bone.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addsLightOnly } from '../../render/glow';
import type { WeaponKey } from '../../sim/argus';

/** Each weapon's shielding has its own colour, so the player can tell at a glance which gun a robot is proof against. */
export const SHIELD_COLOR: Record<string, number> = {
  pistol: 0x6dff9a,
  shotgun: 0xffa630,
  carbine: 0x4f8dff,
  melee: 0xff4fc8,
};

let plates: THREE.BufferGeometry | null = null;
let pattern: THREE.Texture | null = null;

/**
 * The four plates of a shield as one shape, so that a shield is one thing
 * to draw and not four: one plate in front of the chest, one behind and
 * one at each side.
 */
function shieldPlates(): THREE.BufferGeometry {
  // [sideways, up, forward, turn about the upright, radius]
  const layout: Array<[number, number, number, number, number]> = [
    [0, 0.02, 0.3, 0, 0.23],
    [0, 0.06, -0.37, Math.PI, 0.21],
    [0.31, 0.03, -0.03, Math.PI / 2, 0.17],
    [-0.31, 0.03, -0.03, -Math.PI / 2, 0.17],
  ];
  return mergeGeometries(layout.map(([x, y, z, turn, radius]) => new THREE.CircleGeometry(radius, 6).rotateY(turn).translate(x, y, z)))!;
}

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
 * chest in the rest pose.
 */
export function createShield(weapon: WeaponKey, chest: THREE.Vector3): Shield {
  plates ??= shieldPlates();
  pattern ??= shieldPattern();
  const color = new THREE.Color(SHIELD_COLOR[weapon] ?? 0xffffff);
  // (Seen from both sides, and drawn in one go: see drawSeeThroughOnce in render/materials.)
  const material = new THREE.MeshBasicMaterial({ map: pattern, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false, fog: false });
  const object = new THREE.Group();
  object.name = 'shield';
  const mesh = new THREE.Mesh(plates, material);
  mesh.position.copy(chest);
  mesh.renderOrder = 8;
  addsLightOnly(mesh);
  object.add(mesh);
  const setLevel = (level: number): void => {
    material.color.copy(color).multiplyScalar(1.5 * level);
  };
  setLevel(1);
  return { object, setLevel, dispose: () => material.dispose() };
}

let guardSteelShape: THREE.BufferGeometry | null = null;
let guardEdgeShape: THREE.BufferGeometry | null = null;
let guardSteel: THREE.MeshStandardMaterial | null = null;
let guardEdge: THREE.MeshBasicMaterial | null = null;

/**
 * The steel of a plate as one shape (one thing to draw, and one shadow to
 * cast, not five): the slab, standing a little proud of the face, the
 * brackets that hold it to the cheeks, and two bolts.
 */
function guardSteelParts(): THREE.BufferGeometry {
  // [sideways, up, forward, width, height, depth]
  const boxes: Array<[number, number, number, number, number, number]> = [
    [0, 0.0, 0.035, 0.27, 0.15, 0.022],
    [0.128, 0.0, -0.02, 0.02, 0.11, 0.1],
    [-0.128, 0.0, -0.02, 0.02, 0.11, 0.1],
    [0.1, 0.045, 0.049, 0.022, 0.022, 0.012],
    [-0.1, 0.045, 0.049, 0.022, 0.022, 0.012],
  ];
  return mergeGeometries(boxes.map(([x, y, z, w, h, d]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)))!;
}

/**
 * A plate over the weak point: a slab of bare steel across the visor with
 * two bolts, and a line of light along its top edge so that it shows in
 * the dark. `visor` is the middle of the visor in the rest pose.
 */
export function createGuard(visor: THREE.Vector3): THREE.Group {
  guardSteelShape ??= guardSteelParts();
  // (The lit edge, along the top of the slab.)
  guardEdgeShape ??= new THREE.BoxGeometry(0.27, 0.008, 0.024).translate(0, 0.079, 0.035);
  guardSteel ??= new THREE.MeshStandardMaterial({ color: 0x55534f, metalness: 0.9, roughness: 0.5 });
  guardEdge ??= new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0d0).multiplyScalar(3), toneMapped: false, fog: false });
  const object = new THREE.Group();
  object.name = 'guard';
  // (It casts no shadow of its own: the head behind it already does, and
  // a shadow from a mesh that is not skinned, in among robots that are,
  // makes the shadow pass change shaders at every plated robot.)
  const steel = new THREE.Mesh(guardSteelShape, guardSteel);
  const edge = new THREE.Mesh(guardEdgeShape, guardEdge);
  for (const mesh of [steel, edge]) {
    mesh.position.copy(visor);
    object.add(mesh);
  }
  return object;
}
