// The robot's skeleton.
//
// The bones and their motion come from the Mixamo download. This class
// rebuilds them as a fresh bone tree, reshapes the proportions for a given
// robot design (wider shoulders, longer forearms and so on), and records the
// rest pose that the body parts are designed against.

import * as THREE from 'three';

/** Multipliers for the lengths of parts of the skeleton (1 = as downloaded). */
export interface Proportions {
  /** Distance from the neck out to each shoulder joint. */
  shoulders: number;
  /** Distance from the centre line out to each hip joint. */
  hips: number;
  upperArm: number;
  forearm: number;
  neck: number;
  thigh: number;
  shin: number;
}

/** A constant lean added to a bone on top of whatever animation is playing. */
export interface PostureLean {
  bone: string;
  /** Degrees to pitch forward (negative leans back). */
  forward: number;
}

const _worldRight = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();

export class Rig {
  /** Root of the bone tree. */
  readonly root = new THREE.Group();
  readonly bones: THREE.Bone[] = [];
  private readonly byName = new Map<string, THREE.Bone>();
  private readonly restPosition = new Map<string, THREE.Vector3>();
  private readonly restInverse = new Map<string, THREE.Matrix4>();

  /**
   * @param source the loaded model's scene: a tree of named nodes
   */
  constructor(source: THREE.Object3D, proportions: Proportions) {
    this.root.name = 'rig';
    for (const child of source.children) this.root.add(this.copy(child));

    const stretch = (name: string, factor: number) => {
      for (const side of ['Left', 'Right']) this.bone(side + name).position.multiplyScalar(factor);
    };
    // A bone's position is its offset from its parent, so scaling it changes
    // the length of the parent segment.
    stretch('Arm', proportions.shoulders);
    for (const side of ['Left', 'Right']) this.bone(side + 'UpLeg').position.x *= proportions.hips;
    stretch('ForeArm', proportions.upperArm);
    stretch('Hand', proportions.forearm);
    stretch('Leg', proportions.thigh);
    stretch('Foot', proportions.shin);
    this.bone('Head').position.multiplyScalar(proportions.neck);

    this.root.updateMatrixWorld(true);
    for (const bone of this.bones) {
      this.restPosition.set(bone.name, new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld));
      this.restInverse.set(bone.name, bone.matrixWorld.clone().invert());
    }
  }

  private copy(node: THREE.Object3D): THREE.Bone {
    const bone = new THREE.Bone();
    bone.name = node.name;
    bone.position.copy(node.position);
    bone.quaternion.copy(node.quaternion);
    bone.scale.copy(node.scale);
    this.bones.push(bone);
    this.byName.set(bone.name, bone);
    for (const child of node.children) bone.add(this.copy(child));
    return bone;
  }

  bone(name: string): THREE.Bone {
    const bone = this.byName.get(name);
    if (!bone) throw new Error(`The robot skeleton has no bone called ${name}`);
    return bone;
  }

  index(name: string): number {
    return this.bones.indexOf(this.bone(name));
  }

  /** Where a joint sits in the rest pose (a fresh vector each call). */
  at(name: string): THREE.Vector3 {
    return this.restPosition.get(name)!.clone();
  }

  /** Converts rest-pose positions into a bone's own space. */
  toBone(name: string): THREE.Matrix4 {
    return this.restInverse.get(name)!;
  }

  /**
   * Works out, for each lean, the rotation to apply to that bone after the
   * animation has posed it.
   */
  posture(leans: PostureLean[]): Array<{ bone: string; rotation: THREE.Quaternion }> {
    return leans.map(({ bone, forward }) => {
      // Pitching forward is a turn about the robot's left-right axis,
      // expressed in the bone's own frame.
      this.bone(bone).getWorldQuaternion(_quaternion).invert();
      _worldRight.set(1, 0, 0).applyQuaternion(_quaternion);
      return { bone, rotation: new THREE.Quaternion().setFromAxisAngle(_worldRight.clone(), THREE.MathUtils.degToRad(forward)) };
    });
  }
}
