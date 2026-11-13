// A note to the ambient-occlusion pass about things that only add light.
//
// Ambient occlusion darkens creases and corners. The library that does it
// treats every see-through object as a pane of glass and switches that
// darkening off behind it. That is right for a window, but wrong for haze,
// sparks and glows: it leaves the outline of the effect stamped on whatever
// is behind it (a pale triangle on the shutter behind every light shaft).
// Marking an object here tells the pass to ignore it.

import type * as THREE from 'three';

/** Call on any object drawn with additive blending. Returns the object. */
export function addsLightOnly<T extends THREE.Object3D>(object: T): T {
  object.userData.treatAsOpaque = true;
  return object;
}
