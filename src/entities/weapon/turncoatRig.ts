// What makes the Turncoat a lab prototype and not a finished gun.
//
// Its model is a smooth, bare shell. This bolts the lab's work onto it: a
// steel frame round the body that everything else is fixed to, a finned
// shroud round the barrel, an emitter ring in the muzzle that glows the
// colour of the beam, a control box on one flank and a pair of capacitors
// on the other, a cage over the cell on top, a guard round the trigger,
// and the wiring that joins it all up, tied on wherever it would stay. All
// of it is drawn as three shapes: the dark parts, the parts that glow, and
// the box's label.
//
// Everything is in the model's own coordinates: it points down -Z, +Y is
// up, and its barrel runs along the line y = 0.037.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TURNCOAT } from '../../config';

type Vec3 = [number, number, number];

/** The line the barrel and the body lie along. */
const AXIS = 0.037;

const STEEL = 0x30353b;
const STEEL_PALE = 0x6d737a;
const RUBBER = 0x0d0f11;
const BOARD = 0x0f2a1d;
const WIRE_RED = 0x64201a;
const WIRE_YELLOW = 0x70601c;
const WIRE_BLUE = 0x1b3c58;

/** Shapes gathered up to be drawn as one, each in a colour of its own. */
class Parts {
  private readonly shapes: THREE.BufferGeometry[] = [];

  add(shape: THREE.BufferGeometry, color: number, at: Vec3 = [0, 0, 0]): void {
    const plain = shape.index ? shape.toNonIndexed() : shape;
    if (plain !== shape) shape.dispose();
    plain.translate(at[0], at[1], at[2]);
    const c = new THREE.Color(color);
    const count = plain.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
    plain.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    plain.deleteAttribute('uv');
    this.shapes.push(plain);
  }

  box(size: Vec3, at: Vec3, color: number): void {
    this.add(new THREE.BoxGeometry(...size), color, at);
  }

  /** A rod or drum lying along the gun's length. */
  drum(radius: number, length: number, at: Vec3, color: number, sides = 12): void {
    this.add(new THREE.CylinderGeometry(radius, radius, length, sides).rotateX(Math.PI / 2), color, at);
  }

  /** A hoop round the gun's length. */
  hoop(radius: number, thickness: number, at: Vec3, color: number): void {
    this.add(new THREE.TorusGeometry(radius, thickness, 6, 24), color, at);
  }

  /** A wire or cable through the given points. */
  wire(points: Vec3[], radius: number, color: number): void {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    this.add(new THREE.TubeGeometry(curve, points.length * 6, radius, 6, false), color);
  }

  build(material: THREE.Material, name: string): THREE.Mesh {
    const mesh = new THREE.Mesh(mergeGeometries(this.shapes)!, material);
    for (const shape of this.shapes) shape.dispose();
    mesh.name = name;
    return mesh;
  }
}

/** The label on the control box: what it is, in the lab's own stencil, over a strip of hazard tape. */
function labelTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#17191b';
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#b9b5a6';
  g.font = '700 34px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.textBaseline = 'middle';
  g.fillText('XM-0  PROTOTYPE', 10, 26);
  g.font = '400 19px "Share Tech Mono", monospace';
  g.fillText('SITE 04 LAB · UNIT 04', 10, 56);
  // Hazard tape along the bottom edge.
  for (let x = -20; x < 280; x += 26) {
    g.fillStyle = '#d9a514';
    g.beginPath();
    g.moveTo(x, 96);
    g.lineTo(x + 13, 96);
    g.lineTo(x + 31, 74);
    g.lineTo(x + 18, 74);
    g.closePath();
    g.fill();
  }
  // Wear: it has been handled.
  g.globalAlpha = 0.3;
  g.fillStyle = '#0c0d0e';
  for (let i = 0; i < 40; i++) g.fillRect((i * 67) % 256, (i * 41) % 96, 9 + (i % 5) * 3, 1 + (i % 2));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Everything bolted onto the model. `glow` scales how brightly its lit
 * parts shine (the copy in the Prototype Crate is lit up a little more than
 * the one in the player's hands).
 */
export function buildTurncoatRig(glow = 1): THREE.Group {
  const dark = new Parts();
  const lit = new Parts();

  // ---- A finned shroud round the barrel: nine thin discs on four rods, and a collar at the muzzle.
  for (let i = 0; i < 9; i++) dark.drum(0.0235, 0.0022, [0, AXIS, -0.2 + i * 0.0074], i % 3 === 1 ? 0x202428 : STEEL, 18);
  for (const dx of [-0.0155, 0.0155]) for (const dy of [-0.0155, 0.0155]) dark.drum(0.0018, 0.068, [dx, AXIS + dy, -0.171], STEEL_PALE, 6);
  dark.drum(0.0225, 0.014, [0, AXIS, -0.213], 0x1c1f23, 16);

  // ---- The frame: an open steel rectangle bolted along each flank of the
  // body, joined across the top in front of the cell and behind it. It is
  // what the box, the capacitors and the wiring are fixed to, and what
  // makes the thing a piece of lab equipment and not a bare bulb.
  for (const side of [-1, 1]) {
    const x = side * 0.0478;
    dark.box([0.004, 0.008, 0.25], [x, 0.083, 0.052], STEEL);
    dark.box([0.004, 0.008, 0.25], [x, -0.004, 0.052], STEEL);
    for (const z of [-0.069, 0.01, 0.094, 0.173]) dark.box([0.004, 0.087, 0.008], [x, 0.0395, z], z === 0.01 || z === 0.094 ? 0x282c31 : STEEL);
    // Bolt heads where the bars cross.
    for (const z of [-0.069, 0.01, 0.094, 0.173]) for (const y of [0.083, -0.004]) dark.add(new THREE.CylinderGeometry(0.0026, 0.0026, 0.0022, 6).rotateZ(Math.PI / 2), STEEL_PALE, [x + side * 0.003, y, z]);
  }
  for (const z of [-0.069, 0.173]) dark.box([0.0996, 0.006, 0.008], [0, 0.084, z], STEEL);
  // A carrying bar across the top at the back, and a hazard-yellow stripe along the left top bar.
  dark.box([0.0996, 0.005, 0.006], [0, 0.09, 0.14], 0x282c31);
  dark.box([0.0042, 0.0082, 0.06], [-0.0478, 0.083, -0.03], 0x8a6f12);
  // The emitter: a ring in the mouth of the barrel, the colour of the beam.
  lit.hoop(0.0125, 0.0032, [0, AXIS, -0.2215], 0xffffff);

  // ---- The control box, strapped to the left flank: a steel case with a
  // circuit board for a lid, a row of lamps, a charge gauge along its top.
  dark.box([0.03, 0.054, 0.092], [-0.05, 0.03, 0.055], 0x24282d);
  dark.box([0.0024, 0.046, 0.084], [-0.0658, 0.03, 0.055], BOARD);
  for (const dy of [-0.019, 0.019]) for (const dz of [-0.037, 0.037]) dark.add(new THREE.CylinderGeometry(0.0022, 0.0022, 0.002, 8).rotateZ(Math.PI / 2), STEEL_PALE, [-0.0676, 0.03 + dy, 0.055 + dz]);
  // (Chips on the board, and a trimmer.)
  dark.box([0.002, 0.011, 0.016], [-0.0676, 0.041, 0.07], 0x08090a);
  dark.box([0.002, 0.007, 0.009], [-0.0676, 0.04, 0.046], 0x08090a);
  dark.add(new THREE.CylinderGeometry(0.0034, 0.0034, 0.004, 10).rotateZ(Math.PI / 2), 0x8a6a2c, [-0.0684, 0.041, 0.026]);
  for (let i = 0; i < 3; i++) lit.box([0.0022, 0.0034, 0.0034], [-0.0676, 0.03, 0.03 + i * 0.008], 0xffffff);
  for (let i = 0; i < 5; i++) lit.box([0.006, 0.0016, 0.007], [-0.05, 0.0578, 0.022 + i * 0.011], i < 4 ? 0xffffff : 0x1b2a30);

  // ---- Two capacitors on the right flank, held by a strap.
  for (const y of [0.052, 0.03]) {
    dark.drum(0.0088, 0.064, [0.0495, y, 0.046], 0x1a1d21);
    for (const dz of [-0.03, 0.03]) dark.drum(0.0092, 0.004, [0.0495, y, 0.046 + dz], STEEL_PALE);
  }
  dark.box([0.004, 0.05, 0.012], [0.0585, 0.041, 0.046], 0x4b5057);

  // ---- A cage over the cell on top: two hoops and three bars.
  for (const z of [0.034, 0.066]) dark.hoop(0.0162, 0.0016, [0, 0.103, z], STEEL_PALE);
  for (const a of [-0.9, 0, 0.9]) dark.box([0.002, 0.002, 0.034], [Math.sin(a) * 0.0162, 0.103 + Math.cos(a) * 0.0162, 0.05], STEEL_PALE);

  // ---- A guard round the trigger: a flat bar bent under it.
  dark.box([0.008, 0.004, 0.07], [0, -0.07, -0.092], STEEL);
  dark.box([0.008, 0.05, 0.004], [0, -0.047, -0.127], STEEL);
  dark.box([0.008, 0.04, 0.004], [0, -0.052, -0.057], STEEL);

  // ---- The wiring. Two cables forward along the barrel to the emitter, a
  // red and a yellow wire down from the cell, a thin blue one back to the grip.
  dark.wire([[-0.052, 0.05, 0.012], [-0.046, 0.06, -0.028], [-0.031, 0.059, -0.076], [-0.026, 0.052, -0.118], [-0.029, 0.049, -0.168], [-0.021, 0.042, -0.208]], 0.0038, RUBBER);
  dark.wire([[-0.05, 0.012, 0.012], [-0.041, 0.002, -0.03], [-0.027, 0.014, -0.078], [-0.022, 0.022, -0.126], [-0.028, 0.024, -0.172], [-0.016, 0.022, -0.208]], 0.003, 0x15181b);
  dark.wire([[-0.006, 0.113, 0.04], [-0.03, 0.106, 0.045], [-0.05, 0.086, 0.054], [-0.056, 0.06, 0.06]], 0.0022, WIRE_RED);
  dark.wire([[0.006, 0.113, 0.06], [0.03, 0.101, 0.056], [0.049, 0.078, 0.05], [0.051, 0.062, 0.048]], 0.0022, WIRE_YELLOW);
  dark.wire([[-0.05, 0.008, 0.098], [-0.042, -0.018, 0.122], [-0.03, -0.048, 0.138], [-0.024, -0.07, 0.14]], 0.002, WIRE_BLUE);
  // Ties holding the cables to the barrel.
  for (const z of [-0.118, -0.168]) dark.box([0.014, 0.036, 0.0035], [-0.024, 0.038, z], 0x0a0b0c);

  const group = new THREE.Group();
  group.name = 'turncoat-rig';
  group.add(dark.build(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.58 }), 'turncoat-rig-dark'));
  group.add(lit.build(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(TURNCOAT.color).multiplyScalar(2.6 * glow), toneMapped: false, fog: false }), 'turncoat-rig-lit'));

  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.0218), new THREE.MeshStandardMaterial({ map: labelTexture(), metalness: 0, roughness: 0.8 }));
  label.name = 'turncoat-rig-label';
  label.rotation.y = -Math.PI / 2;
  label.position.set(-0.0672, 0.019, 0.066);
  group.add(label);
  return group;
}
