// Extra rotation layered on top of an animation: the design's built-in
// hunch, and the flinch when a bullet lands.
//
// The catch this exists to handle: the animation system only writes a bone
// when that bone's animated value has changed since the last frame. A bone
// that holds still for a moment is left alone, and anything added to it the
// frame before is still there. Adding the same lean again every frame would
// pile it up, and a robot standing still would slowly fold in half.
//
// So each bone remembers two things: what the animation last gave it, and
// what was left in it after the additions. If the bone still holds the
// latter, the animation has not written it this frame and the additions
// start again from the former.

import * as THREE from 'three';

interface Layer {
  bone: THREE.Bone;
  /** Fixed lean built into the design (none for bones that only flinch). */
  lean: THREE.Quaternion | null;
  /** What the animation last set. */
  animated: THREE.Quaternion;
  /** What was left in the bone after the last call to `apply`. */
  left: THREE.Quaternion;
}

const _extra = new THREE.Quaternion();
const _euler = new THREE.Euler();

export class PoseLayers {
  private readonly layers = new Map<string, Layer>();

  /** @param leans the design's hunch: a fixed extra rotation per bone */
  constructor(bones: Map<string, THREE.Bone>, leans: Array<{ bone: string; rotation: THREE.Quaternion }>, alsoFlinch: string[]) {
    const add = (name: string, lean: THREE.Quaternion | null) => {
      const bone = bones.get(name);
      if (!bone) throw new Error(`Robot has no bone called ${name}`);
      // NaN never equals anything, so the first frame always takes the bone as it finds it.
      this.layers.set(name, { bone, lean, animated: bone.quaternion.clone(), left: new THREE.Quaternion(NaN, NaN, NaN, NaN) });
    };
    for (const { bone, rotation } of leans) add(bone, rotation);
    for (const name of alsoFlinch) if (!this.layers.has(name)) add(name, null);
  }

  /**
   * Call once per frame, straight after the animation has been advanced.
   * `flinch` gives extra pitch and twist (radians) for named bones.
   */
  apply(flinch?: Array<{ bone: string; pitch: number; twist: number }>): void {
    for (const layer of this.layers.values()) {
      const q = layer.bone.quaternion;
      if (q.equals(layer.left)) q.copy(layer.animated);
      else layer.animated.copy(q);
      if (layer.lean) q.multiply(layer.lean);
    }
    if (flinch) {
      for (const { bone, pitch, twist } of flinch) {
        const layer = this.layers.get(bone);
        if (layer) layer.bone.quaternion.multiply(_extra.setFromEuler(_euler.set(pitch, twist, 0)));
      }
    }
    for (const layer of this.layers.values()) layer.left.copy(layer.bone.quaternion);
  }
}
