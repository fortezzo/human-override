import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PoseLayers } from '../src/entities/robot/kit/PoseLayers';

const degrees = THREE.MathUtils.radToDeg;

/** How far a bone is pitched forward, in degrees. */
function pitchOf(bone: THREE.Bone): number {
  return degrees(new THREE.Euler().setFromQuaternion(bone.quaternion).x);
}

function setup(leanDegrees = 10) {
  const spine = new THREE.Bone();
  const neck = new THREE.Bone();
  const bones = new Map([
    ['Spine1', spine],
    ['Neck', neck],
  ]);
  const lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(leanDegrees));
  const layers = new PoseLayers(bones, [{ bone: 'Spine1', rotation: lean }], ['Spine1', 'Neck']);
  return { spine, neck, layers };
}

describe('pose layers (the robot hunch and flinch)', () => {
  it('adds the lean once, however long the animation holds a bone still', () => {
    const { spine, layers } = setup(10);
    // The animation system writes a bone only when its value changes, so a
    // robot standing still is not rewritten. 600 frames is ten seconds.
    for (let frame = 0; frame < 600; frame++) layers.apply();
    expect(pitchOf(spine)).toBeCloseTo(10, 4);
  });

  it('puts the lean on top of each new pose from the animation', () => {
    const { spine, layers } = setup(10);
    layers.apply();
    // The animation moves the bone to a new pose: 25 degrees forward.
    spine.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(25));
    layers.apply();
    expect(pitchOf(spine)).toBeCloseTo(35, 4);
    // And then holds it there.
    for (let frame = 0; frame < 100; frame++) layers.apply();
    expect(pitchOf(spine)).toBeCloseTo(35, 4);
  });

  it('a flinch lasts only as long as it is asked for', () => {
    const { spine, neck, layers } = setup(10);
    const flinch = [
      { bone: 'Spine1', pitch: THREE.MathUtils.degToRad(5), twist: 0 },
      { bone: 'Neck', pitch: THREE.MathUtils.degToRad(4), twist: 0 },
    ];
    for (let frame = 0; frame < 50; frame++) layers.apply(flinch);
    expect(pitchOf(spine)).toBeCloseTo(15, 4);
    expect(pitchOf(neck)).toBeCloseTo(4, 4);
    layers.apply();
    expect(pitchOf(spine)).toBeCloseTo(10, 4);
    expect(pitchOf(neck)).toBeCloseTo(0, 4);
  });

  it('refuses a design that names a bone the skeleton does not have', () => {
    expect(() => new PoseLayers(new Map(), [], ['Spine1'])).toThrow(/Spine1/);
  });
});
