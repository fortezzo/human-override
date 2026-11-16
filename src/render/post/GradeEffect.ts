// The final "film look" step, done in a single shader pass:
//
//   exposure -> filmic tone mapping -> cold/warm split toning ->
//   selective desaturation -> contrast -> shadow lift -> vignette ->
//   damage flash -> the player's brightness setting -> grain
//
// The scene is rendered in HDR (lights can be much brighter than white);
// this is where those values are squeezed into what a screen can show.

import { BlendFunction, Effect } from 'postprocessing';
import { Uniform, Vector3 } from 'three';
import { LOOKDEV } from '../../config';

const fragment = /* glsl */ `
uniform float uExposure;
uniform float uSaturation;
uniform float uCoolDesaturate;
uniform float uContrast;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform float uDamage;
uniform float uFade;
uniform float uShadowLift;
uniform float uBrightness;
uniform float uDown;
uniform float uSurge;
uniform vec3 uSurgeTint;

// ACES filmic tone curve (fit by Stephen Hill).
const mat3 ACES_IN = mat3(
  0.59719, 0.07600, 0.02840,
  0.35458, 0.90834, 0.13383,
  0.04823, 0.01566, 0.83777);
const mat3 ACES_OUT = mat3(
   1.60475, -0.10208, -0.00327,
  -0.53108,  1.10813, -0.07276,
  -0.07367, -0.00605,  1.07602);

// On its own, this curve maps the faintest third of a percent of its range
// to pure black, which is what used to turn dim ceilings and corners into
// solid black shapes. Starting just past that point keeps some gradation
// all the way down, and changes nothing that is brighter.
const float TOE = 0.003253;

vec3 filmic(vec3 color) {
  color = ACES_IN * color + TOE;
  vec3 a = color * (color + 0.0245786) - 0.000090537;
  vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
  return clamp(ACES_OUT * (a / b), 0.0, 1.0);
}

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // A broken pixel (not a number) fails every comparison: show it as black
  // on every graphics card, not as whatever that card makes of it.
  vec3 scene = inputColor.rgb;
  if (!(scene.r >= 0.0) || !(scene.g >= 0.0) || !(scene.b >= 0.0)) scene = vec3(0.0);
  vec3 color = filmic(scene * uExposure);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

  // Split toning: cool shadows, slightly warm highlights.
  color *= mix(uShadowTint, uHighlightTint, smoothstep(0.02, 0.55, luma));

  // Pull saturation out of cool hues but leave warm light (lamps, sparks,
  // emergency red, robot eyes) rich, so warm accents pop against a cold room.
  float warmth = clamp((color.r - color.b) / max(luma, 0.04) * 1.6, 0.0, 1.0);
  float saturation = uSaturation * mix(1.0 - uCoolDesaturate, 1.08, warmth);
  color = mix(vec3(luma), color, saturation);

  // Work in display (gamma) space for contrast, vignette and grain.
  color = pow(max(color, 0.0), vec3(1.0 / 2.2));
  // Contrast as an S-curve through mid grey. Unlike a straight line it
  // never pushes dark tones below zero, so shadows keep their detail
  // instead of clipping to solid black.
  color = clamp(color, 0.0, 1.0);
  vec3 low = 0.5 * pow(2.0 * color, vec3(uContrast));
  vec3 high = 1.0 - 0.5 * pow(2.0 * (1.0 - color), vec3(uContrast));
  color = mix(low, high, step(0.5, color));
  // Lift only the deepest shadows; anything brighter is left alone.
  color *= 1.0 + uShadowLift * exp(-dot(color, vec3(0.2126, 0.7152, 0.0722)) / 0.055);

  vec2 centred = uv - 0.5;
  float edge = length(centred * vec2(1.0, 0.82));
  color *= mix(1.0, 1.0 - smoothstep(0.22, 0.86, edge), uVignette);

  // Damage: red closes in from the screen edges.
  float hurt = uDamage * smoothstep(0.18, 0.75, edge);
  color = mix(color, vec3(0.55, 0.02, 0.0) + color * 0.35, clamp(hurt, 0.0, 0.85));

  // Down: the colour drains out of the picture and the dark closes in
  // from its edges, until all that is left is a dim patch in the middle.
  float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(color, vec3(grey) * vec3(1.0, 0.84, 0.82), uDown * 0.9);
  color *= 1.0 - uDown * (0.28 + 0.7 * smoothstep(0.06, 0.6, edge));
  // The fail-safe firing: its own colour flooding in from the edges, and
  // the whole picture lifted for a moment.
  color += uSurgeTint * uSurge * (0.1 + 0.72 * smoothstep(0.16, 0.8, edge));

  // The player's brightness setting: a gamma curve, so it opens up the
  // dark end without washing out the lights.
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / uBrightness));

  float grain = hash(uv * resolution + fract(uTime) * 917.0) - 0.5;
  color += grain * uGrain * (1.15 - luma * 0.7);

  color *= uFade;
  outputColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(2.2)), inputColor.a);
}
`;

export class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', fragment, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map<string, Uniform>([
        ['uExposure', new Uniform(LOOKDEV.exposure)],
        ['uSaturation', new Uniform(LOOKDEV.saturation)],
        ['uCoolDesaturate', new Uniform(LOOKDEV.coolDesaturate)],
        ['uContrast', new Uniform(LOOKDEV.contrast)],
        ['uShadowTint', new Uniform(new Vector3(...LOOKDEV.shadowTint))],
        ['uHighlightTint', new Uniform(new Vector3(...LOOKDEV.highlightTint))],
        ['uVignette', new Uniform(LOOKDEV.vignette)],
        ['uGrain', new Uniform(0.06)],
        ['uTime', new Uniform(0)],
        ['uDamage', new Uniform(0)],
        ['uFade', new Uniform(1)],
        ['uShadowLift', new Uniform(LOOKDEV.shadowLift)],
        ['uBrightness', new Uniform(1)],
        ['uDown', new Uniform(0)],
        ['uSurge', new Uniform(0)],
        ['uSurgeTint', new Uniform(new Vector3(0.78, 0.49, 1))],
      ]),
    });
  }

  private set(name: string, value: number): void {
    this.uniforms.get(name)!.value = value;
  }

  set time(value: number) {
    this.set('uTime', value);
  }

  set grain(value: number) {
    this.set('uGrain', value);
  }

  /** 0 = healthy, 1 = heavily hurt (red vignette). */
  set damage(value: number) {
    this.set('uDamage', value);
  }

  /** 1 = normal, 0 = faded to black. */
  set fade(value: number) {
    this.set('uFade', value);
  }

  /** 0 = on their feet, 1 = down: the picture drained and closed in. */
  set down(value: number) {
    this.set('uDown', Math.min(1, Math.max(0, value)));
  }

  /** The fail-safe's flash, 1 at the moment it fires. */
  set surge(value: number) {
    this.set('uSurge', Math.min(1, Math.max(0, value)));
  }

  set exposure(value: number) {
    this.set('uExposure', value);
  }

  /** The player's brightness setting: 1 = as designed, higher opens up the shadows. */
  set brightness(value: number) {
    this.set('uBrightness', Math.min(2, Math.max(0.5, value)));
  }
}
