import '@babylonjs/loaders/glTF';
import {
  Matrix,
  Mesh,
  Quaternion,
  SceneLoader,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type Scene,
} from '@babylonjs/core';
import { attachGltfImportToParent } from '../../../loaders/gltf-import-utils';
import { sampleShapeSpawn } from './mesh-shape-sample';
import type { ParticleSystemEditable } from '../types';

interface SimParticle {
  position: Vector3;
  velocity: Vector3;
  age: number;
  lifetime: number;
  size: number;
  rotation: Quaternion;
  alive: boolean;
}

const templateCache = new Map<string, Mesh[]>();

async function loadTemplateMeshes(scene: Scene, glbUrl: string): Promise<Mesh[]> {
  const cached = templateCache.get(glbUrl);
  if (cached) return cached;

  const root = new TransformNode(`pfx_mesh_tpl_${glbUrl}`, scene);
  const result = await SceneLoader.ImportMeshAsync('', glbUrl, '', scene);
  attachGltfImportToParent(result, root);

  const meshes = result.meshes.filter(
    (mesh): mesh is Mesh => mesh instanceof Mesh && mesh !== result.meshes[0],
  );
  if (!meshes.length) {
    for (const mesh of result.meshes) {
      if (mesh instanceof Mesh) meshes.push(mesh);
    }
  }

  for (const mesh of meshes) {
    mesh.parent = root;
    mesh.isVisible = false;
    mesh.isPickable = false;
    mesh.thinInstanceEnablePicking = false;
    mesh.thinInstanceAllowAutomaticStaticBufferRecreation = true;
    mesh.thinInstanceCount = 0;
  }

  templateCache.set(glbUrl, meshes);
  return meshes;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * CPU-simulated mesh particles rendered via thin instances (non-billboard).
 */
export class MeshParticlePreview {
  private readonly root: TransformNode;
  private readonly sourceMeshes: Mesh[] = [];
  private readonly particles: SimParticle[] = [];
  private readonly matrixScratch = Matrix.Identity();
  private observer: { remove: () => void } | null = null;
  private playing = false;
  private emitAccumulator = 0;

  private constructor(
    scene: Scene,
    parent: AbstractMesh | TransformNode,
    private config: ParticleSystemEditable,
    meshes: Mesh[],
  ) {
    this.root = new TransformNode(`pfx_mesh_root_${config.id}`, scene);
    this.root.parent = parent;
    this.sourceMeshes = meshes;

    for (let i = 0; i < config.capacity; i += 1) {
      this.particles.push({
        position: Vector3.Zero(),
        velocity: Vector3.Zero(),
        age: 0,
        lifetime: 1,
        size: 1,
        rotation: Quaternion.Identity(),
        alive: false,
      });
    }
  }

  static async create(
    scene: Scene,
    parent: AbstractMesh | TransformNode,
    config: ParticleSystemEditable,
  ): Promise<MeshParticlePreview | null> {
    if (!config.mesh.glbUrl) return null;
    const meshes = await loadTemplateMeshes(scene, config.mesh.glbUrl);
    if (!meshes.length) return null;
    return new MeshParticlePreview(scene, parent, config, meshes);
  }

  updateConfig(config: ParticleSystemEditable): void {
    this.config = config;
  }

  play(scene: Scene): void {
    this.stop();
    this.playing = true;
    this.emitAccumulator = 0;
    if (this.config.emissionMode === 'burst') {
      this.emitBurst();
    }
    this.observer = scene.onBeforeRenderObservable.add(() => this.tick(scene));
  }

  stop(): void {
    this.playing = false;
    this.observer?.remove();
    this.observer = null;
    for (const particle of this.particles) {
      particle.alive = false;
    }
    this.syncInstances();
  }

  dispose(): void {
    this.stop();
    this.root.dispose();
  }

  private tick(scene: Scene): void {
    if (!this.playing) return;
    const dt = scene.getEngine().getDeltaTime() / 1000;
    const speed = Math.max(this.config.playbackSpeed, 0.05);

    if (this.config.emissionMode === 'rate') {
      this.emitAccumulator += this.config.emitRate * dt * speed;
      while (this.emitAccumulator >= 1) {
        this.emitAccumulator -= 1;
        this.emitOne();
      }
    }

    const gravity = this.config.gravity;
    for (const particle of this.particles) {
      if (!particle.alive) continue;
      particle.age += dt * speed;
      if (particle.age >= particle.lifetime) {
        particle.alive = false;
        continue;
      }
      particle.velocity.x += gravity.x * dt;
      particle.velocity.y += gravity.y * dt;
      particle.velocity.z += gravity.z * dt;
      particle.position.addInPlace(particle.velocity.scale(dt * speed));
    }

    this.syncInstances();
  }

  private emitBurst(): void {
    const count = Math.max(0, Math.floor(this.config.burstCount));
    for (let i = 0; i < count; i += 1) {
      this.emitOne();
    }
  }

  private emitOne(): void {
    const slot = this.particles.find((p) => !p.alive);
    if (!slot) return;

    const spawn = sampleShapeSpawn(this.config.shape);
    const speed = randomBetween(
      this.config.minStartSpeedMps,
      this.config.maxStartSpeedMps,
    );
    slot.position.copyFrom(spawn.position);
    slot.velocity.copyFrom(spawn.direction.scale(speed));
    slot.age = 0;
    slot.lifetime = randomBetween(this.config.minLifeTime, this.config.maxLifeTime);
    slot.size =
      randomBetween(this.config.minSize, this.config.maxSize) *
      this.config.mesh.uniformScale;
    if (this.config.mesh.randomRotation) {
      slot.rotation = Quaternion.FromEulerAngles(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );
    } else {
      slot.rotation = Quaternion.Identity();
    }
    slot.alive = true;
  }

  private syncInstances(): void {
    const alive = this.particles.filter((p) => p.alive);
    const count = alive.length;
    for (const mesh of this.sourceMeshes) {
      mesh.thinInstanceCount = count;
      mesh.thinInstanceRefreshBoundingInfo(true);
    }

    for (let i = 0; i < count; i += 1) {
      const particle = alive[i];
      const scale = particle.size;
      Matrix.ComposeToRef(
        new Vector3(scale, scale, scale),
        particle.rotation,
        particle.position,
        this.matrixScratch,
      );
      for (const mesh of this.sourceMeshes) {
        mesh.thinInstanceSetMatrixAt(i, this.matrixScratch, false);
      }
    }

    for (const mesh of this.sourceMeshes) {
      if (count > 0) {
        mesh.thinInstanceBufferUpdated('matrix');
      }
    }
  }
}
