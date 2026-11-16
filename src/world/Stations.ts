// The six stations: the four Boost Stations, the Prototype Crate and the
// Overclock Bench, one to an area.
//
// Each is built from the same kit as the rooms (so it sits in the same
// light and takes the same bullet holes), with a lit sign of its own that
// says what it is and what it does. The part of a station that never moves
// is built into the room it stands in, by the room's own builder, so it
// costs nothing extra to draw; what lights up is a few shapes more. Everything here only shows what it is
// told to show: whether the power is on, which boosts have been bought,
// what the crate is offering. What may be bought, and for how much, is
// decided in sim/ and game/Economy.ts.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BENCH, BOOSTS, CRATE, WEAPONS, type WeaponId } from '../config';
import type { Assets } from '../core/assets';
import { damp } from '../core/math';
import { VIEW_MODELS, dressGun } from '../entities/weapon/viewModels';
import type { LightDef } from '../render/lighting';
import type { MaterialKey, MaterialLibrary } from '../render/materials';
import type { BoostId } from '../sim/boosts';
import { LevelBuilder } from './build/LevelBuilder';
import type { Fixtures } from './build/room';
import { PAINT, SignAtlas, type Sign } from './build/SignAtlas';
import { STATION_PLANS, type AreaId, type StationId, type StationPlan } from './plan';

type Vec3 = THREE.Vector3Tuple;

/** The colour each station is lit in: its sign, its lamps and the light it throws. */
export const STATION_COLOR: Record<StationId, number> = {
  carapace: 0x5dff8a,
  autoloader: 0xffc247,
  hairTrigger: 0xff5a3a,
  failsafe: 0xc77dff,
  crate: 0xffd9a0,
  bench: 0x6aa8ff,
};

const css = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/** A point in a station's own frame: `out` from its wall, `up` from the floor, `along` the wall. */
function frameOf(plan: StationPlan) {
  const [x, z] = plan.at;
  const [nx, nz] = plan.normal;
  const point = (out: number, up: number, along: number): Vec3 => [x + nx * out - nz * along, up, z + nz * out + nx * along];
  const box = (b: LevelBuilder, key: MaterialKey, o0: number, u0: number, a0: number, o1: number, u1: number, a1: number, collide = false, cast = false): void => {
    const p = point(o0, u0, a0);
    const q = point(o1, u1, a1);
    b.box(key, [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2])], [Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])], { collide, cast });
  };
  const normal: Vec3 = [nx, 0, nz];
  /** Turn for something built facing +Z so that it faces the way the station does. */
  const turn = Math.atan2(nx, nz);
  return { point, box, normal, turn };
}

/** The lit panels: one picture holding every station's sign and its small print. */
class Panels {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  private readonly g: CanvasRenderingContext2D;
  /** Where the next panel goes: the picture is filled in two columns. */
  private column = 0;
  private row = 0;

  constructor() {
    this.canvas.width = 2048;
    this.canvas.height = 2048;
    this.g = this.canvas.getContext('2d')!;
    this.g.fillStyle = '#05070a';
    this.g.fillRect(0, 0, 2048, 2048);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  /** A sign: the station's name, large, in its colour. Returns where it is in the picture. */
  sign(text: string, color: string): [number, number, number, number] {
    return this.draw(1024, 150, (g, w, h) => {
      g.fillStyle = color;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      let size = 112;
      g.font = `700 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      while (g.measureText(text).width > w - 110 && size > 40) g.font = `700 ${(size -= 4)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      g.fillText(text, w / 2, h / 2 + 6);
      g.fillRect(18, 16, w - 36, 6);
      g.fillRect(18, h - 22, w - 36, 6);
    });
  }

  /** The small print: what it does, the price, and a mark drawn by `icon`. */
  card(lines: string[], price: string, color: string, icon: (g: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void): [number, number, number, number] {
    return this.draw(1024, 300, (g, _w, h) => {
      g.strokeStyle = color;
      g.fillStyle = color;
      g.lineWidth = 9;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      icon(g, 150, h / 2, 96);
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillStyle = '#e8e4d8';
      g.font = `700 74px "Barlow Condensed", "Arial Narrow", sans-serif`;
      lines.forEach((line, i) => g.fillText(line, 300, h / 2 - 62 + i * 76 - (lines.length - 1) * 38 + 0));
      g.fillStyle = PAINT.amber;
      g.font = `400 62px "Share Tech Mono", monospace`;
      g.fillText(price, 300, h - 52);
    });
  }

  private draw(width: number, height: number, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void): [number, number, number, number] {
    if (this.row + height > 2048) {
      this.column += 1;
      this.row = 0;
    }
    const x = this.column * 1024;
    const y = this.row;
    this.row += height + 8;
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.beginPath();
    g.rect(0, 0, width, height);
    g.clip();
    g.fillStyle = '#080b0e';
    g.fillRect(0, 0, width, height);
    paint(g, width, height);
    g.restore();
    this.texture.needsUpdate = true;
    return [x / 2048, 1 - (y + height) / 2048, (x + width) / 2048, 1 - y / 2048];
  }
}

const ICONS: Record<StationId, (g: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void> = {
  // A shield.
  carapace: (g, cx, cy, r) => {
    g.beginPath();
    g.moveTo(cx - r * 0.7, cy - r * 0.8);
    g.lineTo(cx + r * 0.7, cy - r * 0.8);
    g.lineTo(cx + r * 0.7, cy + r * 0.05);
    g.quadraticCurveTo(cx + r * 0.6, cy + r * 0.7, cx, cy + r);
    g.quadraticCurveTo(cx - r * 0.6, cy + r * 0.7, cx - r * 0.7, cy + r * 0.05);
    g.closePath();
    g.stroke();
    g.fillRect(cx - r * 0.09, cy - r * 0.45, r * 0.18, r * 0.9);
    g.fillRect(cx - r * 0.42, cy - r * 0.1, r * 0.84, r * 0.18);
  },
  // A magazine going home.
  autoloader: (g, cx, cy, r) => {
    g.strokeRect(cx - r * 0.34, cy - r * 0.2, r * 0.68, r * 1.1);
    for (let i = 0; i < 3; i++) g.fillRect(cx - r * 0.2, cy + r * (0.02 + i * 0.3), r * 0.4, r * 0.14);
    g.beginPath();
    g.moveTo(cx - r * 0.5, cy - r * 0.5);
    g.lineTo(cx, cy - r);
    g.lineTo(cx + r * 0.5, cy - r * 0.5);
    g.stroke();
  },
  // Three rounds in flight.
  hairTrigger: (g, cx, cy, r) => {
    for (let i = -1; i <= 1; i++) {
      const y = cy + i * r * 0.55;
      g.beginPath();
      g.moveTo(cx - r * 0.9, y);
      g.lineTo(cx + r * 0.25, y);
      g.stroke();
      g.beginPath();
      g.moveTo(cx + r * 0.35, y - r * 0.2);
      g.lineTo(cx + r * 0.9, y);
      g.lineTo(cx + r * 0.35, y + r * 0.2);
      g.closePath();
      g.fill();
    }
  },
  // A pulse.
  failsafe: (g, cx, cy, r) => {
    g.beginPath();
    g.moveTo(cx - r, cy);
    g.lineTo(cx - r * 0.45, cy);
    g.lineTo(cx - r * 0.2, cy - r * 0.8);
    g.lineTo(cx + r * 0.1, cy + r * 0.7);
    g.lineTo(cx + r * 0.35, cy - r * 0.3);
    g.lineTo(cx + r * 0.55, cy);
    g.lineTo(cx + r, cy);
    g.stroke();
  },
  // A case with its lid up.
  crate: (g, cx, cy, r) => {
    g.strokeRect(cx - r * 0.8, cy - r * 0.05, r * 1.6, r * 0.8);
    g.beginPath();
    g.moveTo(cx - r * 0.8, cy - r * 0.05);
    g.lineTo(cx - r * 0.55, cy - r * 0.75);
    g.lineTo(cx + r * 1.0, cy - r * 0.75);
    g.stroke();
    g.font = `700 ${Math.round(r * 0.7)}px "Barlow Condensed", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', cx, cy + r * 0.38);
  },
  // A bolt of current.
  bench: (g, cx, cy, r) => {
    g.beginPath();
    g.moveTo(cx + r * 0.25, cy - r);
    g.lineTo(cx - r * 0.45, cy + r * 0.1);
    g.lineTo(cx + r * 0.05, cy + r * 0.1);
    g.lineTo(cx - r * 0.25, cy + r);
    g.lineTo(cx + r * 0.5, cy - r * 0.2);
    g.lineTo(cx, cy - r * 0.2);
    g.closePath();
    g.fill();
  },
};

/**
 * Several lit shapes drawn as one. Each part keeps a brightness and colour
 * of its own (stored on its corners, so that one can change without the
 * others), which is how a station's sign, its card and its lamps can each
 * be lit or dark without each being a separate thing to draw.
 */
class LitParts {
  private readonly shapes: THREE.BufferGeometry[] = [];
  private readonly ranges = new Map<string, [number, number]>();
  private corners = 0;
  private colors: THREE.BufferAttribute | null = null;

  /** A flat panel showing part of the panels' picture, facing the way `turn` says. */
  panel(part: string, uv: [number, number, number, number], width: number, height: number, at: Vec3, turn: number): void {
    const geometry = new THREE.PlaneGeometry(width, height);
    const corners = geometry.getAttribute('uv') as THREE.BufferAttribute;
    // (PlaneGeometry's corners: top left, top right, bottom left, bottom right.)
    corners.setXY(0, uv[0], uv[3]);
    corners.setXY(1, uv[2], uv[3]);
    corners.setXY(2, uv[0], uv[1]);
    corners.setXY(3, uv[2], uv[1]);
    geometry.rotateY(turn);
    geometry.translate(at[0], at[1], at[2]);
    this.add(part, geometry);
  }

  /** A lamp or lit strip: a small box. */
  lamp(part: string, size: Vec3, at: Vec3): void {
    const geometry = new THREE.BoxGeometry(...size);
    geometry.translate(at[0], at[1], at[2]);
    this.add(part, geometry);
  }

  private add(part: string, geometry: THREE.BufferGeometry): void {
    const plain = geometry.toNonIndexed();
    geometry.dispose();
    this.ranges.set(part, [this.corners, plain.getAttribute('position').count]);
    this.corners += plain.getAttribute('position').count;
    this.shapes.push(plain);
  }

  /** All of them as one shape. `map` is the picture the panels show (left out for plain lamps). */
  build(name: string, map?: THREE.Texture): THREE.Mesh {
    const merged = mergeGeometries(this.shapes)!;
    for (const shape of this.shapes) shape.dispose();
    this.colors = new THREE.BufferAttribute(new Float32Array(this.corners * 3), 3);
    merged.setAttribute('color', this.colors);
    const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ map: map ?? null, vertexColors: true, toneMapped: false, fog: false }));
    mesh.name = name;
    return mesh;
  }

  /** Light one part: a colour, times a brightness (more than 1 glows). */
  set(part: string, color: THREE.Color | number, level = 1): void {
    const range = this.ranges.get(part);
    if (!range || !this.colors) return;
    const c = typeof color === 'number' ? WHITE.setScalar(color) : color;
    for (let i = range[0]; i < range[0] + range[1]; i++) this.colors.setXYZ(i, c.r * level, c.g * level, c.b * level);
    this.colors.needsUpdate = true;
  }
}
const WHITE = new THREE.Color();

interface BoostParts {
  /** Its sign and its card (parts 'sign' and 'card'). */
  panels: LitParts;
  /** Its lamps: the strips either side of the charge and the bar under the sign ('strips'), and the status lamp ('status'). */
  lamps: LitParts;
  canister: THREE.Mesh;
  light: LightDef;
}

/** A boost station's status lamp with the power out, and once it has sold its charge. */
const STATUS_DEAD = new THREE.Color(1.6, 0.1, 0.05);
const STATUS_SOLD = new THREE.Color(1.6, 1.7, 1.6);

export class StationSet {
  /** The pieces that stand in each area, to be drawn with it. */
  readonly groups: Record<AreaId, THREE.Group> = { lobby: new THREE.Group(), hall: new THREE.Group(), power: new THREE.Group(), core: new THREE.Group(), dock: new THREE.Group(), lab: new THREE.Group() };
  readonly lights: LightDef[] = [];
  /** The part of each station that never moves, waiting to be built into its room. */
  private readonly fixedParts: Array<{ area: AreaId; build: Fixtures }> = [];

  private readonly panels = new Panels();
  private stripes!: Sign;
  private readonly boosts = new Map<BoostId, BoostParts>();
  private readonly owned: Record<BoostId, boolean> = { carapace: false, autoloader: false, hairTrigger: false, failsafe: false };
  private power = false;

  // The crate.
  private lid!: THREE.Group;
  private lidAngle = 0;
  private crateOpen = false;
  private crateGlow!: THREE.MeshBasicMaterial;
  private crateHalo!: THREE.SpriteMaterial;
  private crateLight!: LightDef;
  private readonly offers = new Map<WeaponId, THREE.Object3D>();
  private readonly offerHolder = new THREE.Group();
  private offered: WeaponId | null = null;
  /** Where the crate's offer hangs in the air (for the HUD and the debug tools). */
  readonly offerAt = new THREE.Vector3();

  // The bench.
  private benchPanels!: LitParts;
  private benchCoil: THREE.MeshBasicMaterial[] = [];
  private benchArm!: THREE.Group;
  private benchTip!: THREE.MeshBasicMaterial;
  private benchLight!: LightDef;
  private working = 0;
  /** Where the bench's arm does its work (for the sparks). */
  readonly benchAt = new THREE.Vector3();

  constructor(
    private readonly assets: Assets,
    private readonly materials: MaterialLibrary,
  ) {
    for (const [id, group] of Object.entries(this.groups)) group.name = `stations-${id}`;
    const atlas = new SignAtlas(1024, 1024);
    // (One band of hazard stripes, painted once and laid in front of every station.)
    this.stripes = atlas.stripes(512, 150, PAINT.yellow, PAINT.black, 0.5);
    for (const plan of STATION_PLANS) {
      if (plan.id === 'crate') this.buildCrate(plan, atlas);
      else if (plan.id === 'bench') this.buildBench(plan, atlas);
      else this.buildBoost(plan, plan.id, atlas);
    }
    this.reset();
  }

  /** The fixed part of a station: kept until its room is built, and built into it. */
  private fixed(plan: StationPlan, build: Fixtures): void {
    this.fixedParts.push({ area: plan.area, build });
  }

  /**
   * Everything that never moves about the stations in one area, for that
   * area's builder to build with the room. (They were built apart from
   * their rooms once, each a dozen shapes of its own, and the six of them
   * cost a tenth of the frame rate with every door on the map open.)
   */
  fixtures(area: AreaId): Fixtures {
    return (b) => {
      for (const part of this.fixedParts) if (part.area === area) part.build(b);
    };
  }

  // ------------------------------------------------------- a boost station

  private buildBoost(plan: StationPlan, id: BoostId, atlas: SignAtlas): void {
    const { point, box, turn } = frameOf(plan);
    const color = STATION_COLOR[id];
    const group = this.groups[plan.area];
    const w = plan.half;

    this.fixed(plan, (b) => {
      // The cabinet, on a hazard-striped plinth.
      box(b, 'stationPaint', 0, 0, -w, 0.5, 2.12, w, true, true);
      box(b, 'hazard', 0, 0, -w - 0.04, 0.54, 0.14, w + 0.04);
      box(b, 'steelPlate', 0.5, 0.2, -w + 0.06, 0.53, 2.04, w - 0.06);
      // Corner posts and a cap, so that it is not one plain box.
      for (const a of [-w - 0.02, w - 0.04]) box(b, 'rustedSteel', 0.44, 0.14, a, 0.56, 2.12, a + 0.06, false, true);
      box(b, 'steelPlate', 0, 2.12, -w - 0.03, 0.56, 2.17, w + 0.03, false, true);
      // The alcove the charge stands in: a dark recess with a lip above and below.
      box(b, 'cable', 0.53, 0.98, -0.3, 0.536, 1.64, 0.3);
      box(b, 'darkSteel', 0.53, 0.92, -0.34, 0.62, 0.98, 0.34, false, true);
      box(b, 'darkSteel', 0.53, 1.64, -0.34, 0.6, 1.7, 0.34, false, true);
      for (const a of [-0.34, 0.3]) box(b, 'darkSteel', 0.53, 0.98, a, 0.58, 1.64, a + 0.04);
      // The cradle the charge sits in, and its cap.
      b.tube('rustedSteel', point(0.585, 0.98, 0), point(0.585, 1.06, 0), 0.095, false);
      b.tube('rustedSteel', point(0.585, 1.56, 0), point(0.585, 1.64, 0), 0.095, false);
      // Cooling slats above, a kick plate with bolts below.
      for (let u = 1.78; u < 2.0; u += 0.07) box(b, 'darkSteel', 0.53, u, -0.42, 0.55, u + 0.035, 0.42);
      box(b, 'treadPlate', 0.53, 0.22, -0.46, 0.545, 0.36, 0.46);
      for (const a of [-0.4, 0.4]) for (const u of [0.29]) b.tube('darkSteel', point(0.545, u, a), point(0.56, u, a), 0.022, false);
      // Feed pipes down each side, and cables up to the ceiling from the sign.
      for (const a of [-w - 0.09, w + 0.09]) {
        b.tube('rustedSteel', point(0.12, 0.14, a), point(0.12, 2.3, a), 0.04);
        for (const u of [0.5, 1.2, 1.9]) b.tube('darkSteel', point(0.12, u - 0.03, a), point(0.12, u + 0.03, a), 0.056, false);
      }
      // The sign's housing: a lit box above, on two posts.
      box(b, 'darkSteel', 0.04, 2.27, -w - 0.1, 0.4, 2.67, w + 0.1, false, true);
      box(b, 'steelPlate', 0.04, 2.23, -w - 0.13, 0.43, 2.27, w + 0.13);
      box(b, 'steelPlate', 0.04, 2.67, -w - 0.13, 0.43, 2.71, w + 0.13);
      for (const a of [-0.42, 0.38]) box(b, 'darkSteel', 0.16, 2.17, a, 0.24, 2.23, a + 0.06);
      for (const a of [-0.5, 0.5]) b.cable('cable', point(0.2, 2.71, a), point(0.03, 3.5, a * 1.12), 0.06, 0.022);
      // Hazard stripes on the floor in front, where to stand.
      const stripes = this.stripes;
      b.decal(atlas.texture, point(1.0, 0, 0), [0, 1, 0], 1.3, 0.46, { uvRect: stripes.uv, opacity: 0.7, roll: plan.normal[0] !== 0 ? Math.PI / 2 : 0 });
    });

    // The lit parts: its sign and card as one shape, its lamps as another.
    const rule = BOOSTS[id];
    const panels = new LitParts();
    panels.panel('sign', this.panels.sign(rule.name, css(color)), 2 * w + 0.12, 0.36, point(0.404, 2.47, 0), turn);
    const lines = rule.effect.toUpperCase().split(' ');
    const half = Math.ceil(lines.length / 2);
    panels.panel('card', this.panels.card(lines.length > 2 ? [lines.slice(0, half).join(' '), lines.slice(half).join(' ')] : [rule.effect.toUpperCase()], String(rule.price), css(color), ICONS[id]), 0.84, 0.246, point(0.534, 0.64, 0), turn);
    group.add(panels.build(`station-${id}-panels`, this.panels.texture));

    const lamps = new LitParts();
    for (const a of [-0.44, 0.44]) lamps.lamp('strips', plan.normal[0] !== 0 ? [0.02, 0.62, 0.04] : [0.04, 0.62, 0.02], point(0.54, 1.31, a));
    // A lamp bar under the sign, which is what lights the cabinet's face and the floor in front of it.
    lamps.lamp('strips', plan.normal[0] !== 0 ? [0.06, 0.03, 0.9] : [0.9, 0.03, 0.06], point(0.46, 2.215, 0));
    lamps.lamp('status', [0.07, 0.07, 0.07], point(0.545, 1.9, -w + 0.16));
    group.add(lamps.build(`station-${id}-lamps`));

    // The charge: a glowing cell that is taken when the boost is bought.
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.6), toneMapped: false, fog: false }));
    cell.position.set(...point(0.585, 1.31, 0));
    group.add(cell);

    const light: LightDef = { name: `station-${id}`, area: plan.area, kind: 'point', color, intensity: 15, position: point(0.9, 1.8, 0), distance: 5.5, when: 'powerOn' };
    this.lights.push(light);
    this.boosts.set(id, { panels, lamps, canister: cell, light });
  }

  // ---------------------------------------------------------------- the crate

  private buildCrate(plan: StationPlan, atlas: SignAtlas): void {
    const { point, box, normal, turn } = frameOf(plan);
    const group = this.groups[plan.area];
    const w = plan.half;
    const top = 0.6;

    this.fixed(plan, (b) => {
      // The case: a steel tub on skids, strapped and cornered.
      box(b, 'cratePaint', 0.08, 0.06, -w, 0.78, top, w, true, true);
      for (const a of [-0.55, 0.47]) box(b, 'rustedSteel', 0.04, 0, a, 0.82, 0.06, a + 0.1, false, true);
      for (const a of [-w - 0.012, -0.3, 0.26, w - 0.03]) box(b, 'steelPlate', 0.068, 0.06, a, 0.792, top + 0.004, a + 0.042, false, true);
      box(b, 'hazard', 0.78, 0.3, -w + 0.1, 0.792, 0.42, w - 0.1);
      // Latches on the front, handles on the ends.
      for (const a of [-0.45, 0.45]) box(b, 'rustedSteel', 0.78, 0.46, a - 0.05, 0.81, top, a + 0.05, false, true);
      for (const a of [-w - 0.05, w + 0.05]) b.tube('rustedSteel', point(0.3, 0.38, a), point(0.56, 0.38, a), 0.018, false);
      // Its markings.
      const name = atlas.text('PROTOTYPE', { size: 84, color: PAINT.white, wear: 0.3 });
      b.decal(atlas.texture, point(0.792, 0.16, 0), normal, 0.9, 0.9 / name.aspect, { uvRect: name.uv, opacity: 0.85 });
      // A work lamp's worth of hazard paint on the floor round it.
      const stripes = this.stripes;
      b.decal(atlas.texture, point(1.25, 0, 0), [0, 1, 0], 1.7, 0.5, { uvRect: stripes.uv, opacity: 0.7, roll: plan.normal[0] !== 0 ? Math.PI / 2 : 0 });
      // Above it on the wall: the sign's housing and its feed.
      box(b, 'darkSteel', 0.02, 1.95, -0.9, 0.2, 2.37, 0.9, false, true);
      box(b, 'steelPlate', 0.02, 1.91, -0.93, 0.23, 1.95, 0.93);
      box(b, 'steelPlate', 0.02, 2.37, -0.93, 0.23, 2.41, 0.93);
      for (const a of [-0.6, 0.6]) b.cable('cable', point(0.1, 2.41, a), point(0.03, 3.6, a * 1.1), 0.08, 0.022);
    });

    const color = STATION_COLOR.crate;
    // (The crate needs no power: its sign and card are always lit.)
    const panels = new LitParts();
    panels.panel('sign', this.panels.sign('PROTOTYPE CRATE', css(color)), 1.74, 0.36, point(0.204, 2.16, 0), turn);
    panels.panel('card', this.panels.card(['A RANDOM', 'WEAPON'], String(CRATE.price), css(color), ICONS.crate), 0.9, 0.264, point(0.204, 1.72, 0), turn);
    group.add(panels.build('station-crate-panels', this.panels.texture));
    panels.set('sign', 1.9);
    panels.set('card', 1.5);

    // The lid: hinged along the back, built about its hinge.
    const hinge = new THREE.Group();
    hinge.position.set(...point(0.1, top, 0));
    hinge.rotation.y = turn;
    this.lid = new THREE.Group();
    const lidBuilder = new LevelBuilder(this.assets, this.materials);
    lidBuilder.box('cratePaint', [-w - 0.01, 0, -0.03], [w + 0.01, 0.07, 0.69], { collide: false });
    for (const x of [-0.55, 0.47]) lidBuilder.box('steelPlate', [x, 0.07, -0.03], [x + 0.1, 0.082, 0.69], { collide: false, cast: false });
    lidBuilder.box('hazard', [-w + 0.1, 0.07, 0.5], [w - 0.1, 0.078, 0.6], { collide: false, cast: false });
    const lid = lidBuilder.build().group;
    lid.traverse((o) => (o.matrixAutoUpdate = true));
    this.lid.add(lid);
    hinge.add(this.lid);
    group.add(hinge);

    // The light inside, seen when the lid is up.
    this.crateGlow = new THREE.MeshBasicMaterial({ color: 0x050607, toneMapped: false, fog: false });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(...((plan.normal[0] !== 0 ? [0.56, 0.02, 2 * w - 0.2] : [2 * w - 0.2, 0.02, 0.56]) as Vec3)), this.crateGlow);
    glow.position.set(...point(0.43, top - 0.02, 0));
    group.add(glow);

    // What it offers: one of each gun, hanging over the open case, one shown at a time.
    this.offerAt.set(...point(0.43, 1.2, 0));
    this.offerHolder.position.copy(this.offerAt);
    // A soft glow behind whatever is on offer, so that it stands out from the lid.
    const halo = document.createElement('canvas');
    halo.width = halo.height = 64;
    const hg = halo.getContext('2d')!;
    const fade = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
    fade.addColorStop(0, 'rgba(255,255,255,0.9)');
    fade.addColorStop(0.4, 'rgba(255,255,255,0.3)');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    hg.fillStyle = fade;
    hg.fillRect(0, 0, 64, 64);
    this.crateHalo = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(halo), color: 0x000000, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, toneMapped: false });
    const haloSprite = new THREE.Sprite(this.crateHalo);
    haloSprite.scale.setScalar(1.7);
    haloSprite.position.set(...point(0.32, 1.2, 0));
    haloSprite.userData.treatAsOpaque = true;
    group.add(haloSprite);
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      const view = VIEW_MODELS[id];
      const gun = this.assets.model(view.model).scene.clone(true);
      dressGun(gun, view, this.assets, { paint: 1.3, glow: 1.2 });
      gun.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) node.castShadow = false;
      });
      const holder = new THREE.Group();
      holder.add(gun);
      holder.scale.setScalar(Math.min(1.8, 0.95 / view.length));
      holder.visible = false;
      this.offers.set(id, holder);
      this.offerHolder.add(holder);
    }
    group.add(this.offerHolder);

    this.crateLight = { name: 'station-crate', area: plan.area, kind: 'point', color, intensity: 7, position: point(0.9, 1.5, 0), distance: 6 };
    this.lights.push(this.crateLight);
  }

  // ---------------------------------------------------------------- the bench

  private buildBench(plan: StationPlan, atlas: SignAtlas): void {
    const { point, box, turn } = frameOf(plan);
    const group = this.groups[plan.area];
    const w = plan.half;

    this.fixed(plan, (b) => {
      // (One solid block for the whole of it, up past the arm that works over
      // it: nobody walks under a workbench, or jumps up to stand in one.)
      b.blocker(point(0, 0, -w).map((v, i) => Math.min(v, point(0.72, 0, w)[i]!)) as Vec3, point(0, 1.9, -w).map((v, i) => Math.max(v, point(0.72, 1.9, w)[i]!)) as Vec3);
      // The top, two cabinets under it, a shelf between.
      box(b, 'steelPlate', 0, 0.86, -w, 0.72, 0.92, w, false, true);
      box(b, 'rustedSteel', 0.7, 0.84, -w, 0.73, 0.92, w);
      for (const [a0, a1] of [[-w, -0.45], [0.45, w]] as const) {
        box(b, 'stationPaint', 0.04, 0, a0 + 0.02, 0.68, 0.86, a1 - 0.02, false, true);
        for (const u of [0.18, 0.42, 0.66]) {
          box(b, 'steelPlate', 0.68, u - 0.09, a0 + 0.06, 0.69, u + 0.09, a1 - 0.06);
          b.tube('rustedSteel', point(0.71, u, a0 + 0.2), point(0.71, u, a1 - 0.2), 0.012, false);
        }
      }
      box(b, 'steelPlate', 0.06, 0.2, -0.45, 0.62, 0.23, 0.45);
      // The back board: tools on pegs, a shelf, the screen's housing.
      box(b, 'stationPaint', 0, 0.92, -w, 0.05, 2.0, w, false, true);
      box(b, 'steelPlate', 0.05, 1.62, -w, 0.3, 1.65, w, false, true);
      for (const [a, len] of [[-0.86, 0.34], [-0.72, 0.26], [-0.58, 0.4], [0.56, 0.3], [0.7, 0.42], [0.84, 0.24]] as const) b.tube('rustedSteel', point(0.065, 1.5, a), point(0.065, 1.5 - len, a), 0.014, false);
      for (const a of [-0.86, -0.72, -0.58, 0.56, 0.7, 0.84]) b.tube('darkSteel', point(0.05, 1.53, a), point(0.1, 1.53, a), 0.008, false);
      // The cradle the weapon lies in: two blocks with a notch.
      for (const a of [0.08, 0.52]) {
        box(b, 'rustedSteel', 0.28, 0.92, a - 0.04, 0.5, 0.98, a + 0.04, false, true);
        box(b, 'darkSteel', 0.28, 0.98, a - 0.04, 0.33, 1.05, a + 0.04, false, true);
        box(b, 'darkSteel', 0.45, 0.98, a - 0.04, 0.5, 1.05, a + 0.04, false, true);
      }
      // The coil that does the work, standing at one end, and its cable.
      b.tube('rustedSteel', point(0.36, 0.92, -0.78), point(0.36, 1.52, -0.78), 0.085);
      b.tube('darkSteel', point(0.36, 1.52, -0.78), point(0.36, 1.58, -0.78), 0.11);
      b.cable('cable', point(0.36, 1.58, -0.78), point(0.04, 2.0, -0.6), 0.12, 0.025);
      // A vice at the other.
      box(b, 'rustedSteel', 0.34, 0.92, 0.7, 0.56, 1.02, 0.86, false, true);
      b.tube('darkSteel', point(0.6, 0.97, 0.78), point(0.34, 0.97, 0.78), 0.016, false);
      // The sign's housing above.
      box(b, 'darkSteel', 0.02, 2.1, -w, 0.24, 2.52, w, false, true);
      box(b, 'steelPlate', 0.02, 2.06, -w - 0.03, 0.27, 2.1, w + 0.03);
      box(b, 'steelPlate', 0.02, 2.52, -w - 0.03, 0.27, 2.56, w + 0.03);
      for (const a of [-0.7, 0.7]) b.cable('cable', point(0.1, 2.56, a), point(0.03, 3.6, a * 1.1), 0.08, 0.022);
      const stripes = this.stripes;
      b.decal(atlas.texture, point(1.2, 0, 0), [0, 1, 0], 2.0, 0.5, { uvRect: stripes.uv, opacity: 0.7, roll: plan.normal[0] !== 0 ? Math.PI / 2 : 0 });
    });

    const color = STATION_COLOR.bench;
    this.benchPanels = new LitParts();
    this.benchPanels.panel('sign', this.panels.sign('OVERCLOCK BENCH', css(color)), 2 * w - 0.06, 0.36, point(0.244, 2.31, 0), turn);
    this.benchPanels.panel('card', this.panels.card(['UPGRADES THE', 'WEAPON IN HAND'], `FROM ${BENCH.price}`, css(color), ICONS.bench), 0.86, 0.252, point(0.054, 1.84, 0.58), turn);
    group.add(this.benchPanels.build('station-bench-panels', this.panels.texture));

    // Rings round the coil that light as it works.
    for (const u of [1.06, 1.22, 1.38]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 6, 20), new THREE.MeshBasicMaterial({ color: 0x050607, toneMapped: false, fog: false }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(...point(0.36, u, -0.78));
      group.add(ring);
      this.benchCoil.push(ring.material as THREE.MeshBasicMaterial);
    }

    // The arm: two links on a shoulder at the back, with the emitter at its end.
    const shoulder = new THREE.Group();
    shoulder.position.set(...point(0.12, 1.58, 0.3));
    shoulder.rotation.y = turn;
    this.benchArm = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.9, roughness: 0.45 });
    // (Its two links and the joint between them are one shape: they move together.)
    const links = new THREE.Mesh(
      mergeGeometries([
        new THREE.CylinderGeometry(0.022, 0.026, 0.36, 8).rotateX(Math.PI / 2).translate(0, 0, 0.18),
        new THREE.SphereGeometry(0.04, 10, 8).translate(0, 0, 0.36),
        new THREE.CylinderGeometry(0.016, 0.022, 0.3, 8).translate(0, -0.15, 0.36),
        new THREE.SphereGeometry(0.05, 10, 8),
      ])!,
      steel,
    );
    links.castShadow = true;
    this.benchTip = new THREE.MeshBasicMaterial({ color: 0x050607, toneMapped: false, fog: false });
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.08, 10), this.benchTip);
    tip.rotation.x = Math.PI;
    tip.position.set(0, -0.33, 0.36);
    this.benchArm.add(links, tip);
    shoulder.add(this.benchArm);
    group.add(shoulder);
    this.benchAt.set(...point(0.4, 1.06, 0.3));

    this.benchLight = { name: 'station-bench', area: plan.area, kind: 'point', color, intensity: 16, position: point(0.9, 1.75, 0), distance: 6, when: 'powerOn' };
    this.lights.push(this.benchLight);
  }

  // ------------------------------------------------------------- what to show

  /** The main power: the boost stations and the bench are dead without it. */
  setPower(on: boolean): void {
    this.power = on;
    this.refresh();
  }

  /** Whether the player has a boost (its charge is gone from the station while they do). */
  setOwned(id: BoostId, owned: boolean): void {
    this.owned[id] = owned;
    this.refresh();
  }

  /** The crate's lid, and what hangs over it: a weapon, or nothing. */
  setCrate(open: boolean, weapon: WeaponId | null): void {
    this.crateOpen = open;
    if (weapon === this.offered) return;
    if (this.offered) this.offers.get(this.offered)!.visible = false;
    this.offered = weapon;
    if (weapon) this.offers.get(weapon)!.visible = true;
  }

  /** The bench has just been used: its arm comes down and works for a moment. */
  benchWork(): void {
    this.working = 1.4;
  }

  /** A new run: the power out, nothing bought, the crate shut. */
  reset(): void {
    this.power = false;
    for (const id of Object.keys(this.owned) as BoostId[]) this.owned[id] = false;
    this.setCrate(false, null);
    this.lidAngle = 0;
    this.working = 0;
    this.refresh();
  }

  private refresh(): void {
    for (const [id, parts] of this.boosts) {
      const color = new THREE.Color(STATION_COLOR[id]);
      const owned = this.owned[id];
      parts.panels.set('sign', this.power ? 2.3 : 0.16);
      parts.panels.set('card', this.power ? (owned ? 0.7 : 1.6) : 0.12);
      parts.lamps.set('strips', color, this.power ? (owned ? 0.5 : 2.6) : 0.02);
      // Its lamp: red with the power out, its own colour when it has something to sell, white once it has sold it.
      if (!this.power) parts.lamps.set('status', STATUS_DEAD);
      else if (owned) parts.lamps.set('status', STATUS_SOLD);
      else parts.lamps.set('status', color, 2.4);
      parts.canister.visible = !owned;
      (parts.canister.material as THREE.MeshBasicMaterial).color.copy(color).multiplyScalar(this.power ? 2.6 : 0.12);
      parts.light.intensity = owned ? 7 : 15;
    }
    if (this.benchPanels) {
      this.benchPanels.set('sign', this.power ? 2.3 : 0.16);
      this.benchPanels.set('card', this.power ? 1.6 : 0.12);
    }
  }

  // ----------------------------------------------------------------- motion

  update(dt: number, time: number): void {
    // The lid swings up when the crate is opened and drops when it shuts.
    this.lidAngle = damp(this.lidAngle, this.crateOpen ? 1.42 : 0, this.crateOpen ? 9 : 6, dt);
    this.lid.rotation.x = -this.lidAngle;
    const open = this.lidAngle / 1.42;
    this.crateGlow.color.set(STATION_COLOR.crate).multiplyScalar(0.05 + 3.2 * open);
    this.crateLight.intensity = 7 + 12 * open;
    this.crateHalo.color.set(STATION_COLOR.crate).multiplyScalar(this.offered ? 0.5 * open : 0);
    this.offerHolder.rotation.y = time * 1.6;
    this.offerHolder.position.y = this.offerAt.y + Math.sin(time * 2.2) * 0.03;

    // The bench: its arm folded back at rest, down over the cradle while it works.
    this.working = Math.max(0, this.working - dt);
    const busy = this.working > 0 ? Math.min(1, this.working / 0.25, (1.4 - this.working) / 0.2) : 0;
    this.benchArm.rotation.x = damp(this.benchArm.rotation.x, busy > 0 ? 0.62 + Math.sin(time * 23) * 0.03 : 0.12, 12, dt);
    const spark = busy > 0 ? 1.2 + 2.6 * Math.abs(Math.sin(time * 37)) : 0;
    this.benchTip.color.set(STATION_COLOR.bench).multiplyScalar(this.power ? 0.25 + spark : 0.02);
    this.benchCoil.forEach((ring, i) => ring.color.set(STATION_COLOR.bench).multiplyScalar(this.power ? (busy > 0 ? 1 + 2.2 * Math.abs(Math.sin(time * 14 - i * 1.1)) : 0.5 + 0.25 * Math.sin(time * 2 - i)) : 0.02));
    this.benchLight.intensity = 16 + 10 * busy;
  }
}
