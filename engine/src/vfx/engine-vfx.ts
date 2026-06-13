import {
  Color3,
  Constants,
  StandardMaterial,
  TrailMesh,
  Scene,
  type TransformNode,
} from '@babylonjs/core';

export interface EngineVfxProfile {
  emitRate: number;
  color1: [number, number, number, number];
  color2: [number, number, number, number];
  minSize: number;
  maxSize: number;
  minLifeTime?: number;
  maxLifeTime?: number;
  blendMode?: 'add' | 'standard';
  bloom?: boolean;
  direction1?: [number, number, number];
  direction2?: [number, number, number];
}

export const DEFAULT_ENGINE_VFX: EngineVfxProfile = {
  emitRate: 80,
  color1: [0.3, 0.6, 1, 0.8],
  color2: [0.1, 0.2, 0.8, 0],
  minSize: 0.15,
  maxSize: 0.5,
  minLifeTime: 0.1,
  maxLifeTime: 0.35,
  blendMode: 'add',
  bloom: false,
  direction1: [-0.2, 0, 0.5],
  direction2: [0.2, 0, 1],
};

function trailLengthFromProfile(profile: EngineVfxProfile): number {
  const life = (profile.minLifeTime ?? 0.1) + (profile.maxLifeTime ?? 0.35);
  const rateScale = Math.min(1.4, (profile.emitRate ?? 80) / 80);
  return Math.round(Math.max(24, Math.min(140, life * rateScale * 90)));
}

function trailSegments(length: number): number {
  return Math.round(Math.max(16, Math.min(72, length * 0.45)));
}

/** Native Babylon TrailMesh exhaust ribbon following an engine anchor. */
export function createEngineTrail(
  scene: Scene,
  anchor: TransformNode,
  profile: EngineVfxProfile = DEFAULT_ENGINE_VFX
): TrailMesh {
  const length = trailLengthFromProfile(profile);
  const trail = new TrailMesh(`engine_${anchor.name}`, anchor, scene, {
    diameter: Math.max(0.2, profile.maxSize * 1.4),
    length,
    segments: trailSegments(length),
    sections: 4,
    doNotTaper: false,
    autoStart: true,
  });

  const mat = new StandardMaterial(`engineTrailMat_${anchor.name}`, scene);
  mat.emissiveColor = new Color3(
    profile.color1[0],
    profile.color1[1],
    profile.color1[2],
  );
  mat.alpha = profile.color1[3];
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  if (profile.blendMode === 'add') {
    mat.alphaMode = Constants.ALPHA_ADD;
  }
  trail.material = mat;
  trail.isPickable = false;

  return trail;
}

/** @deprecated TrailMesh follows its generator automatically; kept for API compatibility. */
export function updateEngineTrailEmitter(
  _trail: TrailMesh,
  _anchor: TransformNode,
): void {}
