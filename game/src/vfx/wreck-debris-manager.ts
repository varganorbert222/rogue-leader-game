import {
  Mesh,
  ParticleSystem,
  Quaternion,
  TransformNode,
  Vector3,
  type Scene,
} from '@babylonjs/core';
import {
  ObjectPool,
  ParticleFx,
  WreckLoader,
  applyMeshAlphaCutoff,
  ensureMeshWorldMatrix,
  ensureNodeWorldMatrix,
  filterDebrisPieceMeshes,
  randomInRange,
  randomVector3InRange,
  type AssetManifest,
  type ShipManifestEntry,
  type WreckTemplate,
} from '@rogue-leader/engine';

const DEBRIS_LIFETIME_SEC = 10;
const DEBRIS_LIFETIME_JITTER_SEC = 4;
const DEBRIS_SHRINK_START = 0.45;
const EXPLOSION_IMPULSE_MIN = 4;
const EXPLOSION_IMPULSE_MAX = 14;
const MIN_DESPAWN_SCALE = 0.02;

export interface MissionEnvironment {
  gravity: boolean;
  gravityVector: Vector3;
}

export interface WreckSpawnKinematics {
  position: Vector3;
  rotationQuaternion: Quaternion;
  velocity: Vector3;
  scaling?: Vector3;
}

export function resolveMissionEnvironment(config: {
  id: string;
  environment?: { gravity?: boolean; gravityVector?: [number, number, number] };
}): MissionEnvironment {
  const gravity =
    config.environment?.gravity ??
    !config.id.includes('space');
  const gravityVector = config.environment?.gravityVector
    ? Vector3.FromArray(config.environment.gravityVector)
    : new Vector3(0, -9.81, 0);

  return { gravity, gravityVector };
}

interface DebrisPiece {
  node: TransformNode;
  velocity: Vector3;
  angularVelocity: Vector3;
  age: number;
  lifetime: number;
  baseScale: Vector3;
  particleSystems: ParticleSystem[];
}

export class WreckDebrisManager {
  private readonly pieces: DebrisPiece[] = [];
  private readonly wreckLoader: WreckLoader;
  private readonly debrisNodePool: ObjectPool<TransformNode>;
  private environment: MissionEnvironment = { gravity: false, gravityVector: Vector3.Zero() };

  constructor(private readonly scene: Scene) {
    this.wreckLoader = new WreckLoader(scene, '/assets');
    this.debrisNodePool = ObjectPool.create({
      factory: () => new TransformNode('debris_piece_pooled', this.scene),
      reset: (node) => {
        node.setEnabled(false);
        node.position.set(0, 0, 0);
        node.rotationQuaternion = Quaternion.Identity();
        node.scaling.setAll(1);
        for (const child of node.getChildMeshes()) {
          child.dispose();
        }
      },
      destroy: (node) => node.dispose(),
      maxSize: 48,
    });
    this.debrisNodePool.prewarm(12);
  }

  setEnvironment(environment: MissionEnvironment): void {
    this.environment = environment;
  }

  async preload(shipIds: readonly string[], manifest: AssetManifest): Promise<void> {
    const unique = [...new Set(shipIds)];
    await Promise.all(
      unique.map(async (shipId) => {
        const entry = manifest.ships[shipId];
        if (!entry) return;
        await this.wreckLoader.loadWreck(shipId, entry);
      })
    );
  }

  async preloadAsteroidWrecks(prefabId: string, manifest: AssetManifest): Promise<void> {
    const entry = manifest.props[prefabId];
    if (!entry?.variants?.length) return;

    const scale = Array.isArray(entry.scale) ? entry.scale[1] : entry.scale;
    await Promise.all(
      entry.variants.map((variantPath) =>
        this.wreckLoader.loadPropWreck(variantPath, variantPath, scale)
      )
    );
  }

  spawnFromShip(
    shipId: string,
    entry: ShipManifestEntry,
    kinematics: WreckSpawnKinematics,
    explosionCenter?: Vector3,
  ): void {
    const template = this.wreckLoader.getCached(shipId);
    if (!template) {
      void this.wreckLoader.loadWreck(shipId, entry).then((loaded) => {
        if (loaded) {
          this.spawnFromTemplate(loaded, kinematics, explosionCenter);
        }
      });
      return;
    }

    this.spawnFromTemplate(template, kinematics, explosionCenter);
  }

  spawnFromAsteroidVariant(
    variantPath: string,
    kinematics: WreckSpawnKinematics,
    explosionCenter?: Vector3,
  ): void {
    const template = this.wreckLoader.getCached(variantPath);
    if (!template) {
      return;
    }

    this.spawnFromTemplate(template, kinematics, explosionCenter);
  }

  update(dt: number): void {
    const gravity = this.environment.gravity ? this.environment.gravityVector : Vector3.Zero();

    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i];
      piece.age += dt;

      piece.velocity.addInPlace(gravity.scale(dt));
      piece.node.position.addInPlace(piece.velocity.scale(dt));

      const spin = Quaternion.RotationYawPitchRoll(
        piece.angularVelocity.y * dt,
        piece.angularVelocity.x * dt,
        piece.angularVelocity.z * dt
      );
      piece.node.rotationQuaternion = spin.multiply(
        piece.node.rotationQuaternion ?? Quaternion.Identity()
      );

      const lifeT = piece.age / piece.lifetime;
      let scaleFactor = 1;
      if (lifeT > DEBRIS_SHRINK_START) {
        const shrinkT = (lifeT - DEBRIS_SHRINK_START) / (1 - DEBRIS_SHRINK_START);
        scaleFactor = Math.max(MIN_DESPAWN_SCALE, 1 - shrinkT);
      }
      piece.node.scaling.set(
        piece.baseScale.x * scaleFactor,
        piece.baseScale.y * scaleFactor,
        piece.baseScale.z * scaleFactor
      );

      if (lifeT >= 1 || scaleFactor <= MIN_DESPAWN_SCALE) {
        this.disposePiece(piece);
        this.pieces.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const piece of this.pieces) {
      this.disposePiece(piece);
    }
    this.pieces.length = 0;
    this.debrisNodePool.drain();
    this.wreckLoader.dispose();
  }

  private spawnFromTemplate(
    template: WreckTemplate,
    kinematics: WreckSpawnKinematics,
    explosionCenter?: Vector3,
  ): void {
    const instance = template.root.clone(`${template.root.name}_spawn`, null) as TransformNode;
    instance.setEnabled(true);
    instance.position = kinematics.position.clone();
    instance.rotationQuaternion = kinematics.rotationQuaternion.clone();
    if (kinematics.scaling) {
      instance.scaling.copyFrom(kinematics.scaling);
    }
    ensureNodeWorldMatrix(instance);

    const pieceMeshes = filterDebrisPieceMeshes(
      instance.getChildMeshes(false).filter((mesh): mesh is Mesh => mesh instanceof Mesh)
    );
    if (pieceMeshes.length === 0) {
      instance.dispose();
      return;
    }

    const center = explosionCenter?.clone() ?? kinematics.position.clone();
    const inheritedVelocity = kinematics.velocity.clone();

    for (const mesh of pieceMeshes) {
      ensureMeshWorldMatrix(mesh);
      const worldPos = mesh.getAbsolutePosition().clone();
      const worldRot = mesh.absoluteRotationQuaternion?.clone() ?? Quaternion.Identity();
      const worldScale = mesh.absoluteScaling?.clone() ?? Vector3.One();

      const pieceRoot = this.debrisNodePool.acquire();
      pieceRoot.name = `${mesh.name}_debris`;
      pieceRoot.setEnabled(true);
      pieceRoot.position = worldPos;
      pieceRoot.rotationQuaternion = worldRot;
      pieceRoot.scaling.copyFrom(worldScale);

      mesh.parent = pieceRoot;
      mesh.position.copyFromFloats(0, 0, 0);
      mesh.rotationQuaternion = Quaternion.Identity();
      mesh.scaling.copyFromFloats(1, 1, 1);
      applyMeshAlphaCutoff([mesh]);

      const outward = worldPos.subtract(center);
      if (outward.lengthSquared() < 0.01) {
        outward.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      }
      outward.normalize();

      const impulseMag = randomInRange(EXPLOSION_IMPULSE_MIN, EXPLOSION_IMPULSE_MAX);
      const velocity = inheritedVelocity
        .add(outward.scale(impulseMag))
        .add(randomVector3InRange(0.5, 2.5));

      const angularVelocity = randomVector3InRange(-4, 4);
      const particleSystems = pickDebrisEffects(this.scene, mesh);

      this.pieces.push({
        node: pieceRoot,
        velocity,
        angularVelocity,
        age: 0,
        lifetime: DEBRIS_LIFETIME_SEC + randomInRange(0, DEBRIS_LIFETIME_JITTER_SEC),
        baseScale: worldScale.clone(),
        particleSystems,
      });
    }

    instance.dispose();
  }

  private disposePiece(piece: DebrisPiece): void {
    for (const ps of piece.particleSystems) {
      ParticleFx.releaseDebrisEffect(this.scene, ps);
    }
    piece.node.setEnabled(false);
    this.debrisNodePool.release(piece.node);
  }
}

function pickDebrisEffects(scene: Scene, mesh: Mesh): ParticleSystem[] {
  const roll = Math.random();
  if (roll < 0.45) {
    return [ParticleFx.attachDebrisSmoke(scene, mesh)];
  }
  if (roll < 0.85) {
    return [ParticleFx.attachDebrisFire(scene, mesh)];
  }
  return [ParticleFx.attachDebrisSmoke(scene, mesh), ParticleFx.attachDebrisFire(scene, mesh)];
}

export { collectMissionShipIds } from '../mission/loading/collect-mission-assets';
