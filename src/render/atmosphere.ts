// Air you can see: light shafts, glowing haze and drifting dust.
//
// None of this is real volumetric lighting (far too slow for a browser).
// These are the classic cheap stand-ins: see-through cones under lamps,
// soft glowing cards where fog catches a bright light, and a cloud of dust
// specks that only light up while they drift through a beam.

import * as THREE from 'three';
import { addsLightOnly } from './glow';

type Vec3 = THREE.Vector3Tuple;

// ---------------------------------------------------------------- light cone

const coneVertex = /* glsl */ `
varying vec3 vNormalView;
varying vec3 vPositionView;
varying float vAlong;
varying vec3 vWorld;
void main() {
  vAlong = uv.y;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 view = viewMatrix * world;
  vPositionView = view.xyz;
  vNormalView = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * view;
}`;

const coneFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uLevel;
varying vec3 vNormalView;
varying vec3 vPositionView;
varying float vAlong;
varying vec3 vWorld;

float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

void main() {
  // Fade the cone toward its silhouette, so it reads as a soft column of
  // haze, thick in the middle and gone by the edge, not as a shell.
  float facing = abs(dot(normalize(vNormalView), normalize(-vPositionView)));
  // Slow drifting unevenness, as if the haze were moving. It also eats
  // into the edges, so they wander instead of running dead straight.
  float drift = noise(vWorld * 1.3 + vec3(0.0, -uTime * 0.12, uTime * 0.05));
  float body = pow(clamp(facing - (1.0 - drift) * 0.12, 0.0, 1.0), 3.0);
  // Brightest below the lamp, dying away toward the floor.
  float along = smoothstep(1.0, 0.84, vAlong) * pow(vAlong, 1.5);
  drift = 0.72 + 0.28 * drift;
  // Do not flash in the player's face when they walk through it.
  float near = smoothstep(0.35, 1.6, -vPositionView.z);
  gl_FragColor = vec4(uColor * uOpacity * uLevel * body * along * drift * near, 1.0);
}`;

export interface ConeShaft {
  mesh: THREE.Mesh;
  setLevel(level: number): void;
}

/** A see-through cone of haze from `from` (the lamp) to `to`. */
export function createConeShaft(from: Vec3, to: Vec3, startRadius: number, endRadius: number, color: number, opacity: number): ConeShaft {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const length = a.distanceTo(b);
  const geometry = new THREE.CylinderGeometry(startRadius, endRadius, length, 40, 1, true);
  // CylinderGeometry's UV.y runs 0 at the bottom to 1 at the top, which is
  // exactly "1 at the lamp, 0 at the far end".
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), b.clone().sub(a).normalize()));
  geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);

  const material = new THREE.ShaderMaterial({
    vertexShader: coneVertex,
    fragmentShader: coneFragment,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      uLevel: { value: 1 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const mesh = addsLightOnly(new THREE.Mesh(geometry, material));
  mesh.matrixAutoUpdate = false;
  mesh.renderOrder = 5;
  return { mesh, setLevel: (level) => (material.uniforms.uLevel!.value = level) };
}

// ------------------------------------------------------------------ fog card

const cardVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vPositionView;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 view = viewMatrix * world;
  vPositionView = view.xyz;
  gl_Position = projectionMatrix * view;
}`;

const cardFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uLevel;
uniform vec2 uShape;
varying vec2 vUv;
varying vec3 vPositionView;
varying vec3 vWorld;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  // Soft-edged blob; uShape squashes the falloff per axis.
  float d = length(p * uShape);
  float blob = pow(smoothstep(1.0, 0.0, d), 1.7);
  float wisps = 0.55 + 0.45 * noise(vWorld.xy * 0.8 + vec2(uTime * 0.07, -uTime * 0.04))
                     * (0.6 + 0.8 * noise(vWorld.xy * 2.3 - vec2(uTime * 0.05, 0.0)));
  float near = smoothstep(0.5, 2.6, -vPositionView.z);
  gl_FragColor = vec4(uColor * uOpacity * uLevel * blob * wisps * near, 1.0);
}`;

export interface FogCard {
  mesh: THREE.Mesh;
  setLevel(level: number): void;
}

/** A soft glowing patch of haze: a flat card that faces along `normal`. */
export function createFogCard(centre: Vec3, normal: Vec3, width: number, height: number, color: number, opacity: number, shape: [number, number] = [1, 1]): FogCard {
  const geometry = new THREE.PlaneGeometry(width, height);
  const n = new THREE.Vector3(...normal).normalize();
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
  geometry.translate(...centre);
  const material = new THREE.ShaderMaterial({
    vertexShader: cardVertex,
    fragmentShader: cardFragment,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      uLevel: { value: 1 },
      uShape: { value: new THREE.Vector2(...shape) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const mesh = addsLightOnly(new THREE.Mesh(geometry, material));
  mesh.matrixAutoUpdate = false;
  mesh.renderOrder = 4;
  return { mesh, setLevel: (level) => (material.uniforms.uLevel!.value = level) };
}

// ---------------------------------------------------------------- dust motes

/** A beam that dust can catch the light in. */
export interface DustBeam {
  position: Vec3;
  target: Vec3;
  /** Cone half-angle in radians. */
  angle: number;
  color: number;
  strength: number;
}

const MAX_BEAMS = 8;

const dustVertex = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsSize;
uniform vec3 uBeamPos[${MAX_BEAMS}];
uniform vec3 uBeamDir[${MAX_BEAMS}];
uniform vec4 uBeamColor[${MAX_BEAMS}];
uniform float uBeamCos[${MAX_BEAMS}];
attribute vec4 seed;
varying vec3 vColor;
varying float vFade;

void main() {
  // Each speck wanders on its own slow loop, wrapping inside the room.
  vec3 p = position;
  p.x += sin(uTime * 0.11 * (0.5 + seed.x) + seed.y * 40.0) * 0.6;
  p.y += mod(uTime * 0.035 * (0.4 + seed.z), uBoundsSize.y);
  p.z += cos(uTime * 0.09 * (0.5 + seed.w) + seed.x * 40.0) * 0.6;
  p = uBoundsMin + mod(p - uBoundsMin, uBoundsSize);

  // Light it by every beam it is inside of.
  vec3 lit = vec3(0.012, 0.016, 0.022);
  for (int i = 0; i < ${MAX_BEAMS}; i++) {
    vec3 toSpeck = p - uBeamPos[i];
    float dist = length(toSpeck);
    float cone = dot(toSpeck / max(dist, 0.001), uBeamDir[i]);
    float inside = smoothstep(uBeamCos[i], mix(uBeamCos[i], 1.0, 0.35), cone);
    lit += uBeamColor[i].rgb * uBeamColor[i].a * inside / (1.0 + dist * dist * 0.06);
  }
  vColor = lit;

  vec4 view = viewMatrix * vec4(p, 1.0);
  float depth = -view.z;
  vFade = smoothstep(0.25, 1.2, depth) * smoothstep(26.0, 12.0, depth);
  gl_Position = projectionMatrix * view;
  gl_PointSize = uSize * (0.5 + seed.y) / max(depth, 0.3);
}`;

const dustFragment = /* glsl */ `
varying vec3 vColor;
varying float vFade;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float disc = smoothstep(0.5, 0.05, length(c));
  gl_FragColor = vec4(vColor * disc * vFade, 1.0);
}`;

export class DustMotes {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly min: Vec3;
  private readonly max: Vec3;

  constructor(min: Vec3, max: Vec3, beams: DustBeam[]) {
    const beamPos: THREE.Vector3[] = [];
    const beamDir: THREE.Vector3[] = [];
    const beamColor: THREE.Vector4[] = [];
    const beamCos: number[] = [];
    for (let i = 0; i < MAX_BEAMS; i++) {
      const beam = beams[i];
      if (beam) {
        const from = new THREE.Vector3(...beam.position);
        const colour = new THREE.Color(beam.color);
        beamPos.push(from);
        beamDir.push(new THREE.Vector3(...beam.target).sub(from).normalize());
        beamColor.push(new THREE.Vector4(colour.r, colour.g, colour.b, beam.strength));
        beamCos.push(Math.cos(beam.angle));
      } else {
        beamPos.push(new THREE.Vector3());
        beamDir.push(new THREE.Vector3(0, -1, 0));
        beamColor.push(new THREE.Vector4(0, 0, 0, 0));
        beamCos.push(2); // never inside
      }
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 16 },
        uBoundsMin: { value: new THREE.Vector3(...min) },
        uBoundsSize: { value: new THREE.Vector3(max[0] - min[0], max[1] - min[1], max[2] - min[2]) },
        uBeamPos: { value: beamPos },
        uBeamDir: { value: beamDir },
        uBeamColor: { value: beamColor },
        uBeamCos: { value: beamCos },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.points = addsLightOnly(new THREE.Points(new THREE.BufferGeometry(), this.material));
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.min = min;
    this.max = max;
    this.setCount(600);
  }

  /** Number of specks; scaled by the quality preset. */
  setCount(count: number): void {
    const position = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 3; k++) position[i * 3 + k] = this.min[k]! + Math.random() * (this.max[k]! - this.min[k]!);
      for (let k = 0; k < 4; k++) seed[i * 4 + k] = Math.random();
    }
    this.points.geometry.dispose();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    this.points.geometry = geometry;
  }

  /** `pixelHeight` keeps specks the same apparent size at any resolution. */
  update(time: number, pixelHeight: number): void {
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uSize!.value = pixelHeight * 0.014;
  }
}

/** Advance the animated haze. */
export function updateShaftTime(objects: Array<ConeShaft | FogCard>, time: number): void {
  for (const object of objects) {
    (object.mesh.material as THREE.ShaderMaterial).uniforms.uTime!.value = time;
  }
}
