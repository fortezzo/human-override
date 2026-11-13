// A small pooled particle system for sparks, smoke, dust and flashes.
//
// Every particle is one camera-facing quad drawn with GPU instancing, so
// hundreds of them cost two draw calls: one "additive" layer for things that
// glow (sparks, flashes, tracers) and one "blended" layer for things that
// block light (smoke, dust, chips). Particles are simulated on the CPU,
// which is plenty fast at these counts and keeps the code easy to follow.

import * as THREE from 'three';

export interface ParticleSpec {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds to live. */
  life: number;
  /** Size in metres at birth and at death. */
  size: number;
  sizeEnd?: number;
  /** Linear color; values above 1 glow through the bloom pass. */
  r: number;
  g: number;
  b: number;
  alpha?: number;
  gravity?: number;
  /** Fraction of speed lost per second. */
  drag?: number;
  /** 0 = round sprite. Above 0 the sprite stretches along its motion by this many seconds of travel. */
  streak?: number;
  /** Bounce off the floor (sparks, chips). */
  bounce?: boolean;
  rotation?: number;
  spin?: number;
}

const vertex = /* glsl */ `
attribute vec3 iPosition;
attribute vec3 iVelocity;
attribute vec4 iColor;
attribute vec3 iShape; // size, rotation, streak
varying vec2 vUv;
varying vec4 vColor;
varying float vDepth;

void main() {
  vUv = uv;
  vColor = iColor;
  vec4 centre = viewMatrix * vec4(iPosition, 1.0);
  vec2 corner = position.xy * iShape.x;

  if (iShape.z > 0.0) {
    // Stretch along the direction of travel as seen on screen.
    vec3 velocityView = (viewMatrix * vec4(iVelocity, 0.0)).xyz;
    float speed = length(velocityView.xy);
    vec2 dir = speed > 0.0001 ? velocityView.xy / speed : vec2(0.0, 1.0);
    // Use on-screen speed, so a streak flying straight away from the camera
    // foreshortens to a dot instead of smearing across the view.
    float len = max(iShape.x, speed * iShape.z);
    centre.xy += dir * position.y * len + vec2(-dir.y, dir.x) * position.x * iShape.x;
  } else {
    float c = cos(iShape.y);
    float s = sin(iShape.y);
    centre.xy += vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
  }
  vDepth = -centre.z;
  gl_Position = projectionMatrix * centre;
}`;

const fragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uAdditive;
varying vec2 vUv;
varying vec4 vColor;
varying float vDepth;

void main() {
  float shape = texture2D(uMap, vUv).r;
  // Fade out right in front of the camera instead of clipping.
  float near = smoothstep(0.08, 0.45, vDepth);
  float a = shape * vColor.a * near;
  if (a < 0.003) discard;
  // Additive layer: premultiply so alpha only scales brightness.
  gl_FragColor = uAdditive > 0.5 ? vec4(vColor.rgb * a, 1.0) : vec4(vColor.rgb, a);
}`;

/** A soft round dot. */
function softDot(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** A lumpy cloud shape, so smoke does not look like perfect circles. */
function smokePuff(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const angle = random() * Math.PI * 2;
    const distance = random() * size * 0.2;
    const x = size / 2 + Math.cos(angle) * distance;
    const y = size / 2 + Math.sin(angle) * distance;
    const radius = size * (0.14 + random() * 0.16);
    const gradient = g.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

class Layer {
  readonly mesh: THREE.Mesh;
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly position: THREE.InstancedBufferAttribute;
  private readonly velocity: THREE.InstancedBufferAttribute;
  private readonly color: THREE.InstancedBufferAttribute;
  private readonly shape: THREE.InstancedBufferAttribute;

  // Simulation state, one entry per live particle.
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly sizeStart: Float32Array;
  private readonly sizeEnd: Float32Array;
  private readonly alpha: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private readonly spin: Float32Array;
  private readonly bounce: Uint8Array;
  private count = 0;

  constructor(
    private readonly capacity: number,
    map: THREE.Texture,
    additive: boolean,
  ) {
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.attributes.position!);
    this.geometry.setAttribute('uv', quad.attributes.uv!);

    const attribute = (size: number) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.position = attribute(3);
    this.velocity = attribute(3);
    this.color = attribute(4);
    this.shape = attribute(3);
    this.geometry.setAttribute('iPosition', this.position);
    this.geometry.setAttribute('iVelocity', this.velocity);
    this.geometry.setAttribute('iColor', this.color);
    this.geometry.setAttribute('iShape', this.shape);
    this.geometry.instanceCount = 0;

    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.sizeStart = new Float32Array(capacity);
    this.sizeEnd = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.spin = new Float32Array(capacity);
    this.bounce = new Uint8Array(capacity);

    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uMap: { value: map }, uAdditive: { value: additive ? 1 : 0 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 8 : 7;
  }

  spawn(p: ParticleSpec): void {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    this.position.setXYZ(i, p.x, p.y, p.z);
    this.velocity.setXYZ(i, p.vx, p.vy, p.vz);
    this.color.setXYZW(i, p.r, p.g, p.b, p.alpha ?? 1);
    this.shape.setXYZ(i, p.size, p.rotation ?? 0, p.streak ?? 0);
    this.age[i] = 0;
    this.life[i] = p.life;
    this.sizeStart[i] = p.size;
    this.sizeEnd[i] = p.sizeEnd ?? p.size;
    this.alpha[i] = p.alpha ?? 1;
    this.gravity[i] = p.gravity ?? 0;
    this.drag[i] = p.drag ?? 0;
    this.spin[i] = p.spin ?? 0;
    this.bounce[i] = p.bounce ? 1 : 0;
  }

  update(dt: number): void {
    const pos = this.position.array as Float32Array;
    const vel = this.velocity.array as Float32Array;
    const col = this.color.array as Float32Array;
    const shp = this.shape.array as Float32Array;

    for (let i = 0; i < this.count; ) {
      this.age[i]! += dt;
      if (this.age[i]! >= this.life[i]!) {
        this.remove(i);
        continue;
      }
      const t = this.age[i]! / this.life[i]!;
      const i3 = i * 3;
      const keep = Math.max(0, 1 - this.drag[i]! * dt);
      vel[i3]! *= keep;
      vel[i3 + 1] = vel[i3 + 1]! * keep - this.gravity[i]! * dt;
      vel[i3 + 2]! *= keep;
      pos[i3]! += vel[i3]! * dt;
      pos[i3 + 1]! += vel[i3 + 1]! * dt;
      pos[i3 + 2]! += vel[i3 + 2]! * dt;
      if (this.bounce[i] && pos[i3 + 1]! < 0.015 && vel[i3 + 1]! < 0) {
        pos[i3 + 1] = 0.015;
        vel[i3 + 1] = -vel[i3 + 1]! * 0.38;
        vel[i3]! *= 0.6;
        vel[i3 + 2]! *= 0.6;
      }
      shp[i3] = this.sizeStart[i]! + (this.sizeEnd[i]! - this.sizeStart[i]!) * t;
      shp[i3 + 1]! += this.spin[i]! * dt;
      // Quick fade-in, long fade-out.
      col[i * 4 + 3] = this.alpha[i]! * Math.min(1, t * 12) * (1 - t * t);
      i++;
    }

    this.geometry.instanceCount = this.count;
    if (this.count > 0) {
      for (const attr of [this.position, this.velocity, this.color, this.shape]) {
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, this.count * attr.itemSize);
        attr.needsUpdate = true;
      }
    }
  }

  /** Remove particle `i` by moving the last one into its slot. */
  private remove(i: number): void {
    const last = --this.count;
    if (i === last) return;
    for (const attr of [this.position, this.velocity, this.color, this.shape]) {
      const array = attr.array as Float32Array;
      const size = attr.itemSize;
      for (let k = 0; k < size; k++) array[i * size + k] = array[last * size + k]!;
    }
    this.age[i] = this.age[last]!;
    this.life[i] = this.life[last]!;
    this.sizeStart[i] = this.sizeStart[last]!;
    this.sizeEnd[i] = this.sizeEnd[last]!;
    this.alpha[i] = this.alpha[last]!;
    this.gravity[i] = this.gravity[last]!;
    this.drag[i] = this.drag[last]!;
    this.spin[i] = this.spin[last]!;
    this.bounce[i] = this.bounce[last]!;
  }

  get active(): number {
    return this.count;
  }

  clear(): void {
    this.count = 0;
    this.geometry.instanceCount = 0;
  }
}

export class Particles {
  readonly group = new THREE.Group();
  private readonly glow: Layer;
  private readonly smoke: Layer;
  /** Fewer particles on low quality; set from the quality preset. */
  density = 1;

  constructor() {
    this.glow = new Layer(900, softDot(), true);
    this.smoke = new Layer(320, smokePuff(), false);
    this.group.add(this.smoke.mesh, this.glow.mesh);
    this.group.name = 'particles';
  }

  /** A glowing particle (sparks, flashes, tracers). */
  emitGlow(spec: ParticleSpec): void {
    this.glow.spawn(spec);
  }

  /** A light-blocking particle (smoke, dust, chips). */
  emitSmoke(spec: ParticleSpec): void {
    this.smoke.spawn(spec);
  }

  /** How many of `count` to actually emit at the current quality. */
  scaled(count: number): number {
    return Math.max(1, Math.round(count * this.density));
  }

  update(dt: number): void {
    this.glow.update(dt);
    this.smoke.update(dt);
  }

  get active(): number {
    return this.glow.active + this.smoke.active;
  }

  clear(): void {
    this.glow.clear();
    this.smoke.clear();
  }
}
