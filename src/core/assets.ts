// Downloads everything in assetList.ts and reports progress for the
// loading screen. After load() resolves, every lookup is synchronous.

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DECALS, MODELS, PROPS, SKY, SURFACES, type DecalId, type ModelId, type PropId, type SurfaceId } from '../assetList';
import { SOUNDS, type SoundId } from '../audio/soundList';

export interface SurfaceMaps {
  color: THREE.Texture;
  normal: THREE.Texture;
  /** R = ambient occlusion, G = roughness, B = metalness. */
  orm: THREE.Texture;
}

const BASE = `${import.meta.env.BASE_URL}assets/`;

export class Assets {
  private readonly surfaces = new Map<string, SurfaceMaps>();
  private readonly decals = new Map<string, THREE.Texture>();
  private readonly gltfs = new Map<string, GLTF>();
  private readonly sounds = new Map<string, AudioBuffer>();
  sky!: THREE.Texture;

  private readonly textureLoader = new THREE.TextureLoader();
  private readonly gltfLoader = new GLTFLoader();

  constructor() {
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }

  /**
   * @param decodeAudio turns a downloaded sound file into a playable buffer
   * @param onProgress called with 0..1 as files arrive
   */
  async load(decodeAudio: (data: ArrayBuffer) => Promise<AudioBuffer>, onProgress: (fraction: number) => void): Promise<void> {
    const jobs: Array<() => Promise<void>> = [];

    for (const id of SURFACES) {
      jobs.push(async () => {
        const [color, normal, orm] = await Promise.all([
          this.texture(`textures/${id}_color.webp`, true),
          this.texture(`textures/${id}_normal.webp`, false),
          this.texture(`textures/${id}_orm.webp`, false),
        ]);
        this.surfaces.set(id, { color, normal, orm });
      });
    }
    for (const id of DECALS) {
      jobs.push(async () => {
        this.decals.set(id, await this.texture(`textures/${id}_color.webp`, true));
      });
    }
    for (const id of PROPS) {
      jobs.push(async () => {
        this.gltfs.set(`prop:${id}`, await this.gltfLoader.loadAsync(`${BASE}models/props/${id}.glb`));
      });
    }
    for (const [id, path] of Object.entries(MODELS)) {
      jobs.push(async () => {
        this.gltfs.set(`model:${id}`, await this.gltfLoader.loadAsync(BASE + path));
      });
    }
    for (const [id, def] of Object.entries(SOUNDS)) {
      for (let i = 0; i < def.files.length; i++) {
        jobs.push(async () => {
          const response = await fetch(`${BASE}audio/${def.files[i]}`);
          if (!response.ok) throw new Error(`Sound missing: ${def.files[i]}`);
          this.sounds.set(`${id}:${i}`, await decodeAudio(await response.arrayBuffer()));
        });
      }
    }
    jobs.push(async () => {
      this.sky = await this.texture(SKY, true);
      this.sky.mapping = THREE.EquirectangularReflectionMapping;
    });

    // Run a handful of downloads at a time and count them off.
    let done = 0;
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++]!;
        await job();
        onProgress(++done / jobs.length);
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
  }

  surface(id: SurfaceId): SurfaceMaps {
    return this.need(this.surfaces.get(id), id);
  }

  decal(id: DecalId): THREE.Texture {
    return this.need(this.decals.get(id), id);
  }

  prop(id: PropId): GLTF {
    return this.need(this.gltfs.get(`prop:${id}`), id);
  }

  model(id: ModelId): GLTF {
    return this.need(this.gltfs.get(`model:${id}`), id);
  }

  /** All recorded variations of one sound. */
  sound(id: SoundId): AudioBuffer[] {
    const buffers: AudioBuffer[] = [];
    for (let i = 0; i < SOUNDS[id].files.length; i++) buffers.push(this.need(this.sounds.get(`${id}:${i}`), id));
    return buffers;
  }

  private async texture(path: string, srgb: boolean): Promise<THREE.Texture> {
    const texture = await this.textureLoader.loadAsync(BASE + path);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return texture;
  }

  private need<T>(value: T | undefined, id: string): T {
    if (value === undefined) throw new Error(`Asset not loaded: ${id}`);
    return value;
  }
}
