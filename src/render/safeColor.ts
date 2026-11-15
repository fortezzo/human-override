// A guard for hand-written shaders.
//
// A shader that does arithmetic on a number that turns out a hair outside
// the range it was written for (the square root or a power of something
// slightly below zero, a division by nothing) produces a value that is "not
// a number". One such pixel is not a small blemish. The glow filter smears
// it across the screen, and if it lands in the picture a room's reflections
// are made from, the blur that follows spreads it through that picture and
// every surface in the room goes black. That happened: one pixel at the rim
// of a haze cone turned the server hall black on the highest quality level.
//
// Every shader in the game that works out its own color ends by passing it
// through this, which turns anything broken into "no light at all".

export const SAFE_COLOR = /* glsl */ `
vec3 safeColor(vec3 color) {
  // A broken number fails every comparison, so "not at least zero" catches
  // not-a-number as well as negatives.
  if (!(color.r >= 0.0) || !(color.g >= 0.0) || !(color.b >= 0.0)) return vec3(0.0);
  // And nothing in the game is this bright; an infinite value stops here.
  return min(color, vec3(16000.0));
}`;
