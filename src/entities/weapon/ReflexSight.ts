// The rifle's sight: an open reflex sight on a riser, with a glowing reticle.
//
// The downloaded rifle only has a tiny folding ring, set so low that aiming
// through it fills the view with the top of the gun. The asset pipeline
// takes that ring off, and this clamps a raised window onto the block it
// stood on, built from the same shape kit as the robots: the eye sits
// higher, the gun drops lower in the frame, and the target is seen through
// clear glass with a bright mark on it.
//
// The mark behaves like the real thing. A reflex sight projects its reticle
// "at infinity", so it stays on the point of aim even when the gun shakes;
// the frame moves around the mark, not the mark with the frame. Here that
// means the reticle is always drawn where the bullets will go (the centre
// of the view) and the window only decides how much of it can be seen.

import * as THREE from 'three';
import { addsLightOnly } from '../../render/glow';
import { box, hull, merge, rect, row, tube, vec } from '../../render/shapes';

/** Height of the line of sight above the rifle model's origin, in metres. */
export const SIGHT_HEIGHT = 0.208;

/** Where the window stands along the rifle (model coordinates, + is toward the stock). */
const WINDOW_Z = 0.02;
const WINDOW_WIDTH = 0.046;
const WINDOW_HEIGHT = 0.036;
/** Thickness of the bars around the window. */
const FRAME = 0.0024;
/** Half the width of the reticle picture, as a slope from the line of sight. */
const RETICLE_SPAN = 0.052;

const UP = vec(0, 1, 0);

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
  const post = WINDOW_WIDTH / 2 + FRAME / 2;
  const outer = WINDOW_WIDTH + FRAME * 2;
  const DEPTH = 0.01;
  const SILL = 0.004;

  // Clamp over the rail where the old sight stood, sloped at both ends.
  const clamp = hull(
    [
      { at: vec(0, 0.15, 0.106), section: rect(0.036, 0.008, 0.002) },
      { at: vec(0, 0.1545, 0.09), section: rect(0.042, 0.017, 0.003) },
      { at: vec(0, 0.1545, 0.004), section: rect(0.042, 0.017, 0.003) },
      { at: vec(0, 0.152, -0.008), section: rect(0.036, 0.012, 0.002) },
    ],
    UP,
  );
  const bolts = merge(
    tube(vec(-0.0235, 0.154, 0.03), vec(0.0235, 0.154, 0.03), 0.0036, 0.0036, 6),
    tube(vec(-0.0235, 0.154, 0.07), vec(0.0235, 0.154, 0.07), 0.0036, 0.0036, 6),
  );
  // Fine ridges across the top of the clamp, the kind machined into a
  // sight to stop it glinting in the shooter's eye.
  const ridges = row(6, (i) => box(vec(0, 0.1637, 0.059 + i * 0.0062), vec(0.03, 0.0016, 0.0034), 0.0005));

  // Riser: two cheek plates that lift the window clear of the gun, with a
  // battery tray between them and daylight above it.
  const foot = 0.162;
  const head = sill - SILL;
  const cheek = (x: number) =>
    hull(
      [
        { at: vec(x, foot, 0.027), section: rect(0.0034, 0.05, 0.001) },
        { at: vec(x, head, z + 0.003), section: rect(0.0034, 0.018, 0.001) },
      ],
      vec(0, 0, 1),
    );
  const tray = box(vec(0, foot + 0.0065, 0.027), vec(0.0245, 0.013, 0.04), 0.0015);
  const cap = tube(vec(0, foot + 0.0065, 0.046), vec(0, foot + 0.0065, 0.0505), 0.0048, 0.0042, 8);
  const dial = tube(vec(0.0145, foot + 0.008, 0.03), vec(0.0215, foot + 0.008, 0.03), 0.0058, 0.0058, 10);

  // Window frame: a sill, two posts and a top bar, as thin as will hold glass.
  const frame = merge(
    box(vec(0, sill - SILL / 2, z + 0.003), vec(outer, SILL, DEPTH + 0.008), 0.001),
    box(vec(post, y, z), vec(FRAME, WINDOW_HEIGHT, DEPTH), 0.0006),
    box(vec(-post, y, z), vec(FRAME, WINDOW_HEIGHT, DEPTH), 0.0006),
    box(vec(0, y + WINDOW_HEIGHT / 2 + FRAME / 2, z), vec(outer, FRAME, DEPTH), 0.0006),
  );

  const geometry = merge(clamp, bolts, ridges, cheek(0.0138), cheek(-0.0138), tray, cap, dial, frame);
  geometry.computeVertexNormals();
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
  constructor(lens: { value: THREE.Matrix4 }, prepare: (material: THREE.Material) => void) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x2f3036, metalness: 0.85, roughness: 0.5, envMapIntensity: 1.35 });
    prepare(metal);
    const body = new THREE.Mesh(housing(), metal);
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
        void main() {
          // Which way this bit of glass lies from the eye, as a slope from
          // straight ahead. The reticle is pinned to "straight ahead".
          vec2 slope = vToEye.xy / -vToEye.z;
          float mark = texture2D(uReticle, slope / uSpan * 0.5 + 0.5).a;
          // A little reflected sky toward the top of the pane.
          float sheen = 0.3 + 0.7 * smoothstep(0.3, 1.0, vPane.y);
          gl_FragColor = vec4(uTint * sheen + uColor * (mark * uGain), 1.0);
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
