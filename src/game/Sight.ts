// What the player can see from where they stand.
//
// Robots must never be seen to appear. Before one is created, the director
// asks this class two questions about the place it has in mind: is there a
// clear line from the player's eye to any part of a robot standing there
// (for the places robots walk in from, which must be out of sight whichever
// way the player turns), and is a given point inside the picture on screen
// right now (for the ceiling vents, which are used only while the player is
// not looking at them).

import * as THREE from 'three';

/** How much wider than the screen "the picture" is taken to be: a quick turn of the head must not catch a robot arriving. */
const VIEW_MARGIN = 1.35;

const _eye = new THREE.Vector3();
const _to = new THREE.Vector3();
const _local = new THREE.Vector3();
const _side = new THREE.Vector3();
const _point = new THREE.Vector3();
const _inverse = new THREE.Matrix4();

export class Sight {
  private readonly raycaster = new THREE.Raycaster();

  /**
   * @param camera the player's eye
   * @param solids everything that blocks a view (walls, doors, machinery)
   */
  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly solids: () => THREE.Object3D[],
  ) {
    this.raycaster.firstHitOnly = true;
  }

  /** True if nothing solid stands between the player's eye and a point. */
  clearLineTo(point: THREE.Vector3): boolean {
    this.camera.getWorldPosition(_eye);
    const distance = _eye.distanceTo(point);
    if (distance < 0.05) return true;
    this.raycaster.set(_eye, _to.copy(point).sub(_eye).divideScalar(distance));
    // Stop just short of the point, so the thing standing there is not counted as being in its own way.
    this.raycaster.far = distance - 0.02;
    return this.raycaster.intersectObjects(this.solids(), false).length === 0;
  }

  /** True if a point is inside the picture on screen (or just off its edge), whether or not anything is in the way. */
  inView(point: THREE.Vector3): boolean {
    const camera = this.camera;
    camera.updateMatrixWorld();
    _local.copy(point).applyMatrix4(_inverse.copy(camera.matrixWorld).invert());
    if (_local.z > -camera.near) return false;
    const reach = -_local.z * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * VIEW_MARGIN;
    return Math.abs(_local.y) <= reach && Math.abs(_local.x) <= reach * camera.aspect;
  }

  /** True if the player is looking at a point and nothing is in the way. */
  watching(point: THREE.Vector3): boolean {
    return this.inView(point) && this.clearLineTo(point);
  }

  /**
   * True if any part of a robot standing with its feet at (x, y, z) could
   * be seen from where the player is, whichever way they turned: its feet,
   * its head, or either shoulder.
   */
  robotInSight(x: number, y: number, z: number): boolean {
    this.camera.getWorldPosition(_eye);
    // Across the line of sight: the robot's shoulders stick out either side of it.
    _side.set(-(z - _eye.z), 0, x - _eye.x);
    if (_side.lengthSq() > 1e-6) _side.normalize().multiplyScalar(0.32);
    for (const [across, up] of [
      [0, 1.0],
      [0, 1.85],
      [0, 0.15],
      [1, 1.35],
      [-1, 1.35],
      [1, 0.4],
      [-1, 0.4],
    ] as const) {
      _point.set(x + _side.x * across, y + up, z + _side.z * across);
      if (this.clearLineTo(_point)) return true;
    }
    return false;
  }
}
