// Shared set-up for every robot: the re-skinned model, its animation clips,
// where its eyes go, and the pre-cut pieces it breaks into when destroyed.
// Built once; each robot on the map is a cheap copy.

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Assets } from '../../core/assets';
import type { MaterialLibrary } from '../../render/materials';

export type ClipName = 'idle' | 'walk' | 'run' | 'attack' | 'attackHeavy' | 'hit' | 'deathBack' | 'deathFront';

/** One rigid chunk of a destroyed robot. */
export interface GibPart {
  /** The bone this chunk rides on until the robot breaks apart. */
  bone: string;
  geometry: THREE.BufferGeometry;
  /** Rough size, used for bouncing on the floor. */
  radius: number;
}

// Which bones belong to which chunk. Anything not listed follows its parent.
const GIB_GROUPS: Array<{ bone: string; members: RegExp }> = [
  { bone: 'Head', members: /^(Head|Neck)/ },
  { bone: 'Spine1', members: /^(Spine|LeftShoulder|RightShoulder)/ },
  { bone: 'Hips', members: /^Hips$/ },
  { bone: 'LeftArm', members: /^LeftArm$/ },
  { bone: 'LeftForeArm', members: /^(LeftForeArm|LeftHand)/ },
  { bone: 'RightArm', members: /^RightArm$/ },
  { bone: 'RightForeArm', members: /^(RightForeArm|RightHand)/ },
  { bone: 'LeftUpLeg', members: /^LeftUpLeg$/ },
  { bone: 'LeftLeg', members: /^(LeftLeg|LeftFoot|LeftToe)/ },
  { bone: 'RightUpLeg', members: /^RightUpLeg$/ },
  { bone: 'RightLeg', members: /^(RightLeg|RightFoot|RightToe)/ },
];

export class RobotModel {
  readonly clips = new Map<ClipName, THREE.AnimationClip>();
  readonly gibs: GibPart[] = [];
  readonly gibMaterial: THREE.MeshStandardMaterial;
  /** Eye positions relative to the head bone. */
  readonly eyeOffsets: THREE.Vector3[] = [];
  readonly glowTexture: THREE.Texture;
  private readonly template: THREE.Object3D;

  constructor(assets: Assets, materials: MaterialLibrary) {
    const gltf = assets.model('robot');
    this.template = gltf.scene;
    for (const clip of gltf.animations) this.clips.set(clip.name as ClipName, clip);

    const shell = materials.get('robotShell').material;
    const joints = materials.get('robotJoints').material;
    const meshes: THREE.SkinnedMesh[] = [];
    this.template.traverse((node) => {
      const mesh = node as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      mesh.material = mesh.name === 'joints' ? joints : shell;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Animation moves the body well outside its rest-pose bounds, so give
      // culling a generous sphere around the whole figure.
      mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.9);
      meshes.push(mesh);
    });
    this.template.updateMatrixWorld(true);

    this.gibMaterial = shell.clone();
    this.gibMaterial.vertexColors = true;
    this.buildGibs(meshes);
    this.locateEyes(meshes.find((m) => m.name === 'shell')!);
    this.glowTexture = glowTexture();
  }

  /** A fresh copy of the robot with its own skeleton. */
  instantiate(): THREE.Object3D {
    return cloneSkinned(this.template);
  }

  /**
   * Cut the rest-pose body into rigid chunks, one per major body segment,
   * each stored relative to the bone it follows.
   */
  private buildGibs(meshes: THREE.SkinnedMesh[]): void {
    const skeleton = meshes[0]!.skeleton;
    const groupOfBone = skeleton.bones.map((bone) => GIB_GROUPS.findIndex((g) => g.members.test(bone.name)));
    const parts = GIB_GROUPS.map(() => ({ position: [] as number[], normal: [] as number[], uv: [] as number[], color: [] as number[] }));
    const toBone = GIB_GROUPS.map((g) => {
      const bone = skeleton.bones.find((b) => b.name === g.bone)!;
      return new THREE.Matrix4().copy(bone.matrixWorld).invert();
    });
    const normalToBone = toBone.map((m) => new THREE.Matrix3().setFromMatrix4(m));

    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      const index = geometry.index!;
      const skinIndex = geometry.attributes.skinIndex as THREE.BufferAttribute;
      const skinWeight = geometry.attributes.skinWeight as THREE.BufferAttribute;
      const normal = geometry.attributes.normal as THREE.BufferAttribute;
      const uv = geometry.attributes.uv as THREE.BufferAttribute;
      // Joints are drawn darker so one material can serve the whole chunk.
      const shade = mesh.name === 'joints' ? 0.42 : 1;

      for (let t = 0; t < index.count; t += 3) {
        // A triangle goes with whichever bone pulls hardest on its first corner.
        const first = index.getX(t);
        let best = 0;
        let bestWeight = -1;
        for (let k = 0; k < 4; k++) {
          const w = skinWeight.getComponent(first, k);
          if (w > bestWeight) {
            bestWeight = w;
            best = skinIndex.getComponent(first, k);
          }
        }
        const group = Math.max(0, groupOfBone[best] ?? 0);
        const part = parts[group]!;
        for (let k = 0; k < 3; k++) {
          const vertex = index.getX(t + k);
          // getVertexPosition applies the rest pose, giving model-space positions.
          mesh.getVertexPosition(vertex, p).applyMatrix4(mesh.matrixWorld).applyMatrix4(toBone[group]!);
          n.fromBufferAttribute(normal, vertex).applyMatrix3(normalToBone[group]!).normalize();
          part.position.push(p.x, p.y, p.z);
          part.normal.push(n.x, n.y, n.z);
          part.uv.push(uv.getX(vertex), uv.getY(vertex));
          part.color.push(shade, shade, shade);
        }
      }
    }

    parts.forEach((part, i) => {
      if (!part.position.length) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.position, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normal, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(part.color, 3));
      geometry.computeBoundingSphere();
      this.gibs.push({ bone: GIB_GROUPS[i]!.bone, geometry, radius: Math.min(0.16, geometry.boundingSphere!.radius * 0.45) });
    });
  }

  /** Find where the eyes sit by probing the face in the rest pose. */
  private locateEyes(shell: THREE.SkinnedMesh): void {
    const head = shell.skeleton.bones.find((b) => b.name === 'Head')!;
    const headPosition = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld);
    const toHead = new THREE.Matrix4().copy(head.matrixWorld).invert();
    const raycaster = new THREE.Raycaster();
    for (const side of [-1, 1]) {
      const origin = new THREE.Vector3(side * 0.034, headPosition.y + 0.1, headPosition.z + 0.6);
      raycaster.set(origin, new THREE.Vector3(0, 0, -1));
      const hit = raycaster.intersectObject(shell, false)[0];
      const point = hit ? hit.point.clone() : new THREE.Vector3(origin.x, origin.y, headPosition.z + 0.09);
      point.z += 0.004;
      this.eyeOffsets.push(point.applyMatrix4(toHead));
    }
  }
}

function glowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
