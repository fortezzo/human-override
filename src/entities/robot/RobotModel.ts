// Shared set-up for one robot type: its reshaped skeleton, the body built
// on it, its animation clips, and the pre-cut pieces it breaks into when
// destroyed. Built once; each robot on the map is a cheap copy.

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ROBOT } from '../../config';
import type { Assets } from '../../core/assets';
import type { RobotDesign, RobotLamp } from './kit/design';
import { RobotBuilder, type Chunk } from './kit/RobotBuilder';
import { Rig } from './kit/Rig';
import { createGlowMaterial, createRobotMaterial } from './robotMaterial';

/** The size the standard robot is built at, which the hit shapes were measured for. */
const STANDARD_SCALE = 1.05;

export type ClipName = 'idle' | 'walk' | 'run' | 'attack' | 'attackHeavy' | 'hit' | 'deathBack' | 'deathFront';

export class RobotModel {
  readonly clips = new Map<ClipName, THREE.AnimationClip>();
  /** The rigid pieces a destroyed robot becomes. */
  readonly chunks: Chunk[];
  readonly material: THREE.MeshStandardMaterial;
  /**
   * The same finish for the pieces it breaks into. They are not skinned,
   * and a material used by both kinds of mesh has its shader swapped every
   * time the renderer goes from one kind to the other.
   */
  readonly chunkMaterial: THREE.MeshStandardMaterial;
  readonly glowTexture: THREE.Texture;
  /** Extra rotations layered over every animation (the hunch). */
  readonly posture: Array<{ bone: string; rotation: THREE.Quaternion }>;
  /** The weak point: a sphere in the space of the bone it rides on (the head, for most). Radius 0: it has none. */
  readonly weakPoint: { bone: string; centre: THREE.Vector3; radius: number };
  /** Where the visor's soft glow sits, in the space of the bone it rides on, and its size. */
  readonly glow: { bone: string; at: THREE.Vector3; size: THREE.Vector2 };
  /** The one sphere a bullet is tested against, for a body that is not a figure (the drone); null for the rest. */
  readonly hitShape: { bone: string; centre: THREE.Vector3; radius: number } | null;
  /** It flies. */
  readonly flies: boolean;
  /** How high its chest is off the ground when it stands, in metres. */
  readonly chestHeight: number;
  /**
   * Where things are hung on it (ARGUS's shielding round the chest, its
   * plate over the visor). Each is authored in the rest pose like the body
   * itself: `at` is the spot in the rest pose, and `toBone` carries
   * rest-pose positions into the space of the bone it rides on.
   */
  readonly mounts: Record<'chest' | 'visor', { bone: string; at: THREE.Vector3; toBone: THREE.Matrix4 }>;
  /** Overall size multiplier of this robot type. */
  readonly scale: number;
  /** How much thicker its body and limbs are than the standard robot's (for hit testing). */
  readonly girth: number;
  /** Colour of everything on it that glows. */
  readonly eyeColor: number;
  /** A light that travels with this kind of robot, or null. */
  readonly lamp: RobotLamp | null;
  /** Where an object can be hung on it: a bone, and a position in that bone's own space. Null if nowhere. */
  readonly carry: { bone: string; at: THREE.Vector3 } | null;
  /** Triangles in the body, for the performance report. */
  readonly triangles: number;
  private readonly template = new THREE.Group();

  constructor(assets: Assets, design: RobotDesign) {
    const source = assets.model('robot');
    for (const clip of source.animations) this.clips.set(clip.name as ClipName, clip);

    // Skeleton first, then the body designed against its rest pose.
    const rig = new Rig(source.scene, design.proportions);
    const builder = new RobotBuilder(rig);
    design.build(rig, builder);
    const built = builder.build();
    this.chunks = built.chunks;
    this.triangles = built.triangles;
    this.posture = rig.posture(design.posture);
    this.scale = design.scale;
    this.girth = design.scale / STANDARD_SCALE;
    this.eyeColor = design.eyeColor ?? ROBOT.eyeColor;
    this.carry = design.carry ? { bone: design.carry.bone, at: rig.at(design.carry.bone).add(new THREE.Vector3(...design.carry.at)).applyMatrix4(rig.toBone(design.carry.bone)) } : null;

    /** A point given relative to a joint in the rest pose, in that joint's bone's own space. */
    const inBone = (bone: string, offset: [number, number, number]) => rig.at(bone).add(new THREE.Vector3(...offset)).applyMatrix4(rig.toBone(bone));
    const weakBone = design.weakPoint.bone ?? 'Head';
    this.weakPoint = { bone: weakBone, centre: inBone(weakBone, design.weakPoint.centre), radius: design.weakPoint.radius * design.scale };
    const glowBone = design.glow.bone ?? 'Head';
    this.glow = { bone: glowBone, at: inBone(glowBone, design.glow.at), size: new THREE.Vector2(...design.glow.size) };
    this.hitShape = design.hitShape ? { bone: design.hitShape.bone, centre: inBone(design.hitShape.bone, design.hitShape.centre), radius: design.hitShape.radius * design.scale } : null;
    this.flies = design.flies ?? false;
    this.chestHeight = rig.at('Spine2').y * design.scale;
    this.mounts = {
      chest: { bone: 'Spine2', at: rig.at('Spine2').add(new THREE.Vector3(0, 0.04, 0)), toBone: rig.toBone('Spine2').clone() },
      visor: { bone: 'Head', at: rig.at('Head').add(new THREE.Vector3(...(design.glow.bone ? [0, 0.09, 0.14] : design.glow.at))), toBone: rig.toBone('Head').clone() },
    };

    const { color: edgeColor, ...edge } = design.edge ?? {};
    this.material = createRobotMaterial(assets, edgeColor ? { ...edge, color: new THREE.Color(...edgeColor) } : edge);
    this.chunkMaterial = createRobotMaterial(assets, edgeColor ? { ...edge, color: new THREE.Color(...edgeColor) } : edge);
    this.lamp = design.lamp ?? null;
    const skeleton = new THREE.Skeleton(rig.bones);
    const body = new THREE.SkinnedMesh(built.body, this.material);
    body.name = 'body';
    body.castShadow = true;
    body.receiveShadow = true;
    const glow = new THREE.SkinnedMesh(built.glow, createGlowMaterial());
    glow.name = 'glow';

    this.template.name = 'robot';
    this.template.add(rig.root, body, glow);
    this.template.updateMatrixWorld(true);
    body.bind(skeleton);
    glow.bind(skeleton);
    this.template.scale.setScalar(design.scale);

    this.glowTexture = glowTexture();
  }

  /** A fresh copy of the robot with its own skeleton. */
  instantiate(): THREE.Object3D {
    const copy = cloneSkinned(this.template);
    // Animation swings the body well outside its rest-pose bounds, so give
    // culling a generous fixed sphere instead of one measured in a T-pose.
    const bounds = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.2);
    copy.traverse((node) => {
      const mesh = node as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) mesh.boundingSphere = bounds;
    });
    return copy;
  }
}

/** A soft horizontal flare, so the visor reads from across the room. */
function glowTexture(): THREE.Texture {
  const width = 128;
  const height = 64;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d')!;
  // An ellipse of light: draw a circle in a squashed coordinate system.
  g.translate(width / 2, height / 2);
  g.scale(1, height / width);
  const gradient = g.createRadialGradient(0, 0, 0, 0, 0, width / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.16, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient;
  g.fillRect(-width / 2, -width / 2, width, width);
  return new THREE.CanvasTexture(canvas);
}
