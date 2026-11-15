// The rifle's sight: a small open reflex sight on a riser, with a glowing
// reticle.
//
// The downloaded rifle only has a tiny folding ring, set so low that aiming
// through it fills the view with the top of the gun. The asset pipeline
// takes that ring off, and this clamps a raised window onto the block it
// stood on, built from the same shape kit as the robots: the eye sits
// higher, the gun drops lower in the frame, and the target is seen through
// clear glass with a bright mark on it.
//
// Everything about the housing is there to keep the eye on the mark: it is
// one compact shape in the same dark, scratched metal as the rifle, with no
// bright faces and nothing fiddly near the window.
//
// The mark behaves like the real thing. A reflex sight projects its reticle
// "at infinity", so it stays on the point of aim even when the gun shakes;
// the frame moves around the mark, not the mark with the frame. Here that
// means the reticle is always drawn where the bullets will go (the centre
// of the view) and the window only decides how much of it can be seen.

import * as THREE from 'three';
import type { Assets } from '../../core/assets';
import { addsLightOnly } from '../../render/glow';
import { SAFE_COLOR } from '../../render/safeColor';
import { box, hull, merge, rect, tube, vec } from '../../render/shapes';

/** Height of the line of sight above the rifle model's origin, in metres. */
export const SIGHT_HEIGHT = 0.208;

/** Where the window stands along the rifle (model coordinates, + is toward the stock). */
const WINDOW_Z = 0.016;
const WINDOW_WIDTH = 0.04;
const WINDOW_HEIGHT = 0.031;
/** Thickness of the bars around the window. */
const FRAME = 0.0026;
/** Half the width of the reticle picture, as a slope from the line of sight. */
const RETICLE_SPAN = 0.052;
/** How often the metal texture repeats across the housing, in metres. */
const TEXTURE_TILE = 0.045;

const UP = vec(0, 1, 0);
const BACK = vec(0, 0, 1);

function reticleTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const c = size / 2;
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  // Centre dot.
  g.beginPath();
  g.arc(c, c, 6.5, 0, Math.PI * 2);
  g.fill();
  // Broken ring: four arcs with gaps at the compass points.
  g.lineWidth = 5;
  for (let i = 0; i < 4; i++) {
    const start = (i * Math.PI) / 2 + 0.3;
    g.beginPath();
    g.arc(c, c, 62, start, start + Math.PI / 2 - 0.6);
    g.stroke();
  }
  // Short ticks outside the ring: left, right and below.
  g.lineWidth = 4;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
  ] as const) {
    g.beginPath();
    g.moveTo(c + dx * 78, c + dy * 78);
    g.lineTo(c + dx * 106, c + dy * 106);
    g.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

/** The metal parts, in the rifle model's coordinates. */
function housing(): THREE.BufferGeometry {
  const y = SIGHT_HEIGHT;
  const z = WINDOW_Z;
  const sill = y - WINDOW_HEIGHT / 2;
  const top = y + WINDOW_HEIGHT / 2;
  const post = WINDOW_WIDTH / 2 + FRAME / 2;
  const outer = WINDOW_WIDTH + FRAME * 2;
  const HOOD_DEPTH = 0.013;
  const DECK = 0.0055;

  // Clamp over the block where the old sight stood, sloped at both ends.
  const clamp = hull(
    [
      { at: vec(0, 0.1505, 0.102), section: rect(0.044, 0.009, 0.002) },
      { at: vec(0, 0.1545, 0.089), section: rect(0.05, 0.02, 0.003) },
      { at: vec(0, 0.1545, 0.004), section: rect(0.05, 0.02, 0.003) },
      { at: vec(0, 0.152, -0.007), section: rect(0.044, 0.012, 0.002) },
    ],
    UP,
  );
  // Two cross-bolts hold it on; only their hexagonal heads show.
  const bolts = merge(
    tube(vec(-0.0268, 0.1535, 0.028), vec(0.0268, 0.1535, 0.028), 0.0032, 0.0032, 6),
    tube(vec(-0.0268, 0.1535, 0.066), vec(0.0268, 0.1535, 0.066), 0.0032, 0.0032, 6),
  );

  // Riser: an open A-frame, two plates leaning in and forward from the
  // edges of the clamp to the underside of the deck, tied by a cross-pin.
  // Seen from behind it is two thin dark legs with daylight between them.
  const leg = (side: number) =>
    hull(
      [
        { at: vec(side * 0.0215, 0.162, 0.036), section: rect(0.003, 0.05, 0.001) },
        { at: vec(side * 0.0165, sill - DECK + 0.001, z + 0.011), section: rect(0.003, 0.032, 0.001) },
      ],
      vec(0, 0, -1),
    );
  const pin = tube(vec(-0.019, 0.1745, 0.026), vec(0.019, 0.1745, 0.026), 0.0026, 0.0026, 6);
  const riser = merge(leg(1), leg(-1), pin);

  // Deck: the body of the sight itself, under the window, tapering away
  // toward the shooter, with the small housing of the lamp that projects
  // the reticle sitting on it.
  const deck = hull(
    [
      { at: vec(0, sill - DECK / 2, z - HOOD_DEPTH / 2 - 0.001), section: rect(outer, DECK, 0.0014) },
      { at: vec(0, sill - DECK / 2, z + 0.024), section: rect(outer, DECK, 0.0014) },
      { at: vec(0, sill - DECK / 2 - 0.0012, z + 0.034), section: rect(outer - 0.008, DECK - 0.0024, 0.001) },
    ],
    UP,
  );
  const emitter = box(vec(0, sill + 0.0012, z + 0.024), vec(0.011, 0.0034, 0.011), 0.001);

  // Hood: two posts and a top bar around the glass, as thin as will hold it.
  const hood = merge(
    hull(
      [
        { at: vec(post, y, z + HOOD_DEPTH / 2), section: rect(FRAME, WINDOW_HEIGHT + 0.001, 0.0006) },
        { at: vec(post, y, z - HOOD_DEPTH / 2), section: rect(FRAME, WINDOW_HEIGHT + 0.001, 0.0006) },
      ],
      UP,
    ),
    hull(
      [
        { at: vec(-post, y, z + HOOD_DEPTH / 2), section: rect(FRAME, WINDOW_HEIGHT + 0.001, 0.0006) },
        { at: vec(-post, y, z - HOOD_DEPTH / 2), section: rect(FRAME, WINDOW_HEIGHT + 0.001, 0.0006) },
      ],
      UP,
    ),
    hull(
      [
        { at: vec(0, top + FRAME / 2, z + HOOD_DEPTH / 2), section: rect(outer, FRAME, [0.0018, 0.0018, 0, 0]) },
        { at: vec(0, top + FRAME / 2, z - HOOD_DEPTH / 2), section: rect(outer, FRAME, [0.0018, 0.0018, 0, 0]) },
      ],
      UP,
    ),
  );
  // Braces from the top corners forward and down to the deck. They splay
  // outward a little, which keeps them hidden behind the posts from the
  // shooter's eye, so they shape the sight from the side without adding
  // anything to the view through it.
  const brace = (side: number) =>
    hull(
      [
        { at: vec(side * post, top - 0.001, z - HOOD_DEPTH / 2 + 0.001), section: rect(FRAME, 0.0034, 0.0006) },
        { at: vec(side * (post + 0.0032), sill - 0.002, z - 0.03), section: rect(FRAME, 0.0034, 0.0006) },
      ],
      BACK,
    );
  const nose = hull(
    [
      { at: vec(0, sill - DECK / 2, z - HOOD_DEPTH / 2 - 0.001), section: rect(outer, DECK, 0.0014) },
      { at: vec(0, sill - DECK / 2 - 0.001, z - 0.033), section: rect(outer + 0.0064, DECK - 0.002, 0.0012) },
    ],
    UP,
  );

  return merge(clamp, bolts, riser, deck, emitter, hood, brace(1), brace(-1), nose);
}

/**
 * Gives a kit shape what a textured material needs: flat-shaded normals and
 * texture coordinates laid on by "box projection" (each face takes its
 * coordinates from whichever two axes it lies most nearly along), so the
 * metal's scratches are the same size everywhere on the housing.
 */
function textured(geometry: THREE.BufferGeometry, tile: number): THREE.BufferGeometry {
  geometry.computeVertexNormals();
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const normal = geometry.attributes.normal as THREE.BufferAttribute;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    const [u, v] = nx >= ny && nx >= nz ? [position.getZ(i), position.getY(i)] : ny >= nz ? [position.getX(i), position.getZ(i)] : [position.getX(i), position.getY(i)];
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

export class ReflexSight {
  /** Add to the rifle model's group. */
  readonly group = new THREE.Group();
  private readonly glass: THREE.ShaderMaterial;

  /**
   * @param lens the rifle's own projection, shared with the rest of the gun
   * @param prepare applied to the metal so it is drawn and lit like the rifle
   */
  constructor(assets: Assets, lens: { value: THREE.Matrix4 }, prepare: (material: THREE.Material) => void) {
    // The same dark, scratched gunmetal as the rifle's own body: its
    // typical color, its satin finish, and a steel texture for the fine
    // scratches. Rough enough that no face of it can flash white.
    const steel = assets.surface('Metal046B');
    const metal = new THREE.MeshStandardMaterial({
      name: 'sight',
      map: steel.color,
      normalMap: steel.normal,
      // The steel texture's own roughness and metal values are for bare
      // polished steel; these multipliers bring their averages to the
      // rifle's satin finish (roughness about 0.72, metalness about 0.6)
      // while keeping the texture's scratches.
      roughnessMap: steel.orm,
      metalnessMap: steel.orm,
      roughness: 2.05,
      metalness: 0.72,
      color: new THREE.Color(0.56, 0.52, 0.66),
      envMapIntensity: 0.9,
    });
    metal.normalScale.setScalar(1.6);
    prepare(metal);
    const body = new THREE.Mesh(textured(housing(), TEXTURE_TILE), metal);
    body.frustumCulled = false;
    body.receiveShadow = true;

    // One pane does two jobs: a faint tint so the window reads as glass, and
    // the reticle. Both are added light, so the view through stays clear.
    this.glass = new THREE.ShaderMaterial({
      uniforms: {
        uViewLens: lens,
        uReticle: { value: reticleTexture() },
        uColor: { value: new THREE.Color(1.2, 2.6, 0.55) },
        uGain: { value: 0 },
        uSpan: { value: RETICLE_SPAN },
        uTint: { value: new THREE.Color(0.006, 0.013, 0.016) },
      },
      vertexShader: /* glsl */ `
        uniform mat4 uViewLens;
        varying vec3 vToEye;
        varying vec2 vPane;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vToEye = mvPosition.xyz;
          vPane = uv;
          gl_Position = uViewLens * mvPosition;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uReticle;
        uniform vec3 uColor;
        uniform vec3 uTint;
        uniform float uGain;
        uniform float uSpan;
        varying vec3 vToEye;
        varying vec2 vPane;
        ${SAFE_COLOR}
        void main() {
          // Which way this bit of glass lies from the eye, as a slope from
          // straight ahead. The reticle is pinned to "straight ahead".
          vec2 slope = vToEye.xy / -vToEye.z;
          float mark = texture2D(uReticle, slope / uSpan * 0.5 + 0.5).a;
          // A little reflected sky toward the top of the pane.
          float sheen = 0.3 + 0.7 * smoothstep(0.3, 1.0, vPane.y);
          gl_FragColor = vec4(safeColor(uTint * sheen + uColor * (mark * uGain)), 1.0);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW_WIDTH, WINDOW_HEIGHT), this.glass);
    pane.position.set(0, SIGHT_HEIGHT, WINDOW_Z);
    pane.frustumCulled = false;
    pane.renderOrder = 2;
    addsLightOnly(pane);

    this.group.add(body, pane);
  }

  /** How brightly the reticle is showing, 0..1. */
  get level(): number {
    return this.glass.uniforms.uGain!.value as number;
  }

  /**
   * @param aim 0 at the hip, 1 with the rifle fully raised
   * @param tilt how far the rifle points away from the line of sight, in radians
   */
  update(aim: number, tilt: number): void {
    // The mark needs the eye behind the window and the gun roughly level;
    // it fades out when the rifle is lowered, reloaded or thrown about.
    const raised = THREE.MathUtils.smoothstep(aim, 0.5, 0.9);
    const level = 1 - THREE.MathUtils.smoothstep(tilt, 0.07, 0.2);
    this.glass.uniforms.uGain!.value = raised * level;
  }
}
