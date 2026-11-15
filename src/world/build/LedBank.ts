// Rows of status lights on the fronts of server racks.
//
// Every rack face shows one of six columns of a shared picture: 22 rack
// units, each with a handful of lights. Most are the calm green and blue of
// healthy machines; clusters of red mark the ones ARGUS has taken.
//
// Nothing is repainted while the game runs. The picture of the racks is
// painted once, with the steady lights lit. The blinking lights live in two
// more pictures, also made once: each of their eight channels holds the
// lights of one group. For every rack unit the graphics card works out
// whether each group is on at this instant, and adds its color. (The first
// version repainted the whole picture eight times a second and sent it to
// the graphics card each time, which made the frame rate hitch.)

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seededRandom } from '../../core/math';
import { quadAt } from './geometry';

const COLUMNS = 6;
const UNITS = 22;
const CELL_W = 128;
const UNIT_H = 44;
const WIDTH = COLUMNS * CELL_W;
const HEIGHT = UNITS * UNIT_H;
/** Side of one light, in pixels of the picture. */
const LED = 6;

type Kind = 'green' | 'blue' | 'amber' | 'red';
const COLOR: Record<Kind, string> = { green: '#35f27a', blue: '#49a6ff', amber: '#ffb42e', red: '#ff3a1e' };
/** What a healthy machine shows: mostly green and blue, the odd amber. */
const CALM: Kind[] = ['green', 'green', 'blue', 'blue', 'amber'];

/**
 * The eight groups of blinking lights. Lights of one group in one rack unit
 * blink together; every unit of every rack keeps its own time. `rate` is
 * the slowest blinks per second and the spread above it: red is busier.
 */
const GROUPS: Array<{ kind: Kind; rate: [number, number] }> = [
  { kind: 'green', rate: [0.15, 2.2] },
  { kind: 'green', rate: [0.15, 2.2] },
  { kind: 'blue', rate: [0.15, 2.2] },
  { kind: 'blue', rate: [0.15, 2.2] },
  { kind: 'amber', rate: [0.15, 2.2] },
  { kind: 'red', rate: [1.2, 3.0] },
  { kind: 'red', rate: [1.2, 3.0] },
  { kind: 'red', rate: [1.2, 3.0] },
];

interface Pictures {
  /** The racks themselves, with the lights that never blink. */
  base: THREE.CanvasTexture;
  /** Where the blinking lights are: groups 0-3 and 4-7, one per channel. */
  groupsA: THREE.DataTexture;
  groupsB: THREE.DataTexture;
}

// Painted once and shared by every bank in the facility.
let pictures: Pictures | null = null;

function paintPictures(): Pictures {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#030405';
  g.fillRect(0, 0, WIDTH, HEIGHT);
  // The faint outline of each rack unit, so the panel reads as equipment.
  for (let column = 0; column < COLUMNS; column++) {
    for (let unit = 0; unit < UNITS; unit++) {
      const x = column * CELL_W + 8;
      const y = unit * UNIT_H + 4;
      g.fillStyle = '#10141a';
      g.fillRect(x, y, CELL_W - 16, UNIT_H - 8);
      // A lit top edge and a row of vent slots give each unit some shape.
      g.fillStyle = '#1b222b';
      g.fillRect(x, y, CELL_W - 16, 2);
      g.fillStyle = '#07090c';
      for (let slot = 0; slot < 6; slot++) g.fillRect(x + CELL_W - 62 + slot * 7, y + 8, 4, UNIT_H - 22);
    }
  }

  const channels = [new Uint8Array(WIDTH * HEIGHT * 4), new Uint8Array(WIDTH * HEIGHT * 4)];
  const r = seededRandom(77);
  for (let column = 0; column < COLUMNS; column++) {
    // The last two columns are racks ARGUS has taken over.
    const taken = column >= COLUMNS - 2;
    for (let unit = 0; unit < UNITS; unit++) {
      if (r() < 0.14) continue; // an empty slot
      const count = 2 + Math.floor(r() * 5);
      const red = taken && r() < 0.75;
      for (let i = 0; i < count; i++) {
        const x = column * CELL_W + 16 + i * 11 + (r() < 0.3 ? 30 : 0);
        const y = unit * UNIT_H + 18;
        const kind: Kind = red ? 'red' : CALM[Math.floor(r() * CALM.length)]!;
        if (r() < 0.35) {
          // A steady light: part of the picture.
          g.fillStyle = COLOR[kind];
          g.fillRect(x, y, LED, LED);
          continue;
        }
        // A blinking light: marked in one channel of the group pictures.
        const choices = GROUPS.map((group, index) => (group.kind === kind ? index : -1)).filter((index) => index >= 0);
        const group = choices[Math.floor(r() * choices.length)]!;
        const data = channels[group >> 2]!;
        for (let py = y; py < y + LED; py++) {
          // Rows are stored bottom-up, to match the painted picture.
          const row = HEIGHT - 1 - py;
          for (let px = x; px < x + LED; px++) data[(row * WIDTH + px) * 4 + (group & 3)] = 255;
        }
      }
    }
  }

  const base = new THREE.CanvasTexture(canvas);
  base.colorSpace = THREE.SRGBColorSpace;
  const groups = (data: Uint8Array): THREE.DataTexture => {
    const texture = new THREE.DataTexture(data, WIDTH, HEIGHT, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  };
  return { base, groupsA: groups(channels[0]!), groupsB: groups(channels[1]!) };
}

/** How brightly the red lights (the machines ARGUS has taken) burn: 1 while it runs, 0 once it is off. Shared by every rack. */
const argusGlow = { value: 1 };
/** The red groups are the last ones in the list. */
const FIRST_RED = GROUPS.findIndex((group) => group.kind === 'red');

/** Dim the red rack lights with ARGUS (1 = running, 0 = off). */
export function setArgusGlow(level: number): void {
  argusGlow.value = level;
}

export class LedBank {
  readonly object = new THREE.Group();
  private readonly quads: THREE.BufferGeometry[] = [];
  private readonly random = seededRandom(77);
  /** The game's clock, read by the shader. */
  private readonly clock = { value: 0 };

  constructor() {
    this.object.name = 'rack-lights';
  }

  /** Add the light panel of one rack face. Call finish() after the last one. */
  add(centre: THREE.Vector3Tuple, normal: THREE.Vector3Tuple, width: number, height: number): void {
    const column = Math.floor(this.random() * COLUMNS);
    const u = column / COLUMNS;
    const quad = quadAt(centre, normal, width, height, 0, [u + 0.004, 0, u + 1 / COLUMNS - 0.004, 1]);
    // Each rack face keeps its own time, so two faces showing the same
    // column of the picture never blink in step. A whole number, because
    // the shader has to recover it exactly (see ledRack there).
    const seed = Math.floor(this.random() * 1000);
    quad.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array([seed, seed, seed, seed]), 1));
    this.quads.push(quad);
  }

  finish(): void {
    if (!this.quads.length) return;
    pictures ??= paintPictures();
    const { base, groupsA, groupsB } = pictures;
    const material = new THREE.MeshBasicMaterial({ map: base, toneMapped: false, fog: true });
    // Above 1.0 so the lights glow through the bloom pass.
    material.color.setScalar(2.2);
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uLedTime = this.clock;
      shader.uniforms.uLedArgus = argusGlow;
      shader.uniforms.uLedGroupsA = { value: groupsA };
      shader.uniforms.uLedGroupsB = { value: groupsB };
      shader.uniforms.uLedColor = { value: GROUPS.map((group) => new THREE.Color(COLOR[group.kind])) };
      shader.uniforms.uLedRate = { value: GROUPS.map((group) => new THREE.Vector2(...group.rate)) };

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aSeed;\nvarying vec2 vLedUv;\nvarying float vLedSeed;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLedUv = uv;\nvLedSeed = aSeed;');

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform float uLedTime;
          uniform float uLedArgus;
          uniform sampler2D uLedGroupsA;
          uniform sampler2D uLedGroupsB;
          uniform vec3 uLedColor[${GROUPS.length}];
          uniform vec2 uLedRate[${GROUPS.length}];
          varying vec2 vLedUv;
          varying float vLedSeed;
          float ledHash(float n) { return fract(sin(n) * 43758.5453); }`,
        )
        .replace(
          '#include <map_fragment>',
          /* glsl */ `#include <map_fragment>
          {
            vec4 ledA = texture2D(uLedGroupsA, vLedUv);
            vec4 ledB = texture2D(uLedGroupsB, vLedUv);
            float ledCover[${GROUPS.length}];
            ledCover[0] = ledA.r; ledCover[1] = ledA.g; ledCover[2] = ledA.b; ledCover[3] = ledA.a;
            ledCover[4] = ledB.r; ledCover[5] = ledB.g; ledCover[6] = ledB.b; ledCover[7] = ledB.a;
            // One whole number per rack unit of this rack face: its own
            // clock. The rack's number arrives very slightly smeared across
            // the panel; rounding restores it, or neighbouring pixels of
            // one light would disagree about whether it is on.
            float ledRack = floor(vLedSeed + 0.5);
            float ledUnit = floor(vLedUv.y * ${UNITS}.0) + floor(vLedUv.x * ${COLUMNS}.0) * 31.0 + ledRack * 197.0;
            vec3 ledLight = vec3(0.0);
            for (int k = 0; k < ${GROUPS.length}; k++) {
              float s = ledUnit + float(k) * 7.77;
              float rate = uLedRate[k].x + uLedRate[k].y * ledHash(s);
              // Lit for between a quarter and most of each cycle.
              float duty = 0.25 + 0.6 * ledHash(s + 2.1);
              float phase = ledHash(s + 4.3);
              ledLight += uLedColor[k] * ledCover[k] * step(fract(uLedTime * rate + phase), duty) * (k >= ${FIRST_RED} ? uLedArgus : 1.0);
            }
            diffuseColor.rgb += diffuse * ledLight;
          }`,
        );
    };
    const mesh = new THREE.Mesh(mergeGeometries(this.quads)!, material);
    mesh.matrixAutoUpdate = false;
    this.object.add(mesh);
  }

  update(time: number): void {
    this.clock.value = time;
  }
}
