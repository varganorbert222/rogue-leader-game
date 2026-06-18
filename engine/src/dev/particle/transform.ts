import { TransformNode } from '@babylonjs/core';
import { mergeVec3, vec3, type Vec3Editable } from '../shared/editable-primitives';
import type { ParticleEffectTreeNode } from './types';

export interface ParticleNodeTransform {
  position: Vec3Editable;
  rotationDeg: Vec3Editable;
  scale: Vec3Editable;
}

export function defaultNodeTransform(): ParticleNodeTransform {
  return {
    position: vec3(),
    rotationDeg: vec3(),
    scale: vec3(1, 1, 1),
  };
}

export function normalizeNodeTransform(raw?: Partial<ParticleNodeTransform>): ParticleNodeTransform {
  const defaults = defaultNodeTransform();
  return {
    position: mergeVec3(defaults.position, raw?.position),
    rotationDeg: mergeVec3(defaults.rotationDeg, raw?.rotationDeg),
    scale: mergeVec3(defaults.scale, raw?.scale),
  };
}

function ensureVec3InPlace(target: Vec3Editable | undefined, defaults: Vec3Editable): Vec3Editable {
  if (!target) {
    return { ...defaults };
  }
  if (!Number.isFinite(target.x)) target.x = defaults.x;
  if (!Number.isFinite(target.y)) target.y = defaults.y;
  if (!Number.isFinite(target.z)) target.z = defaults.z;
  return target;
}

export function ensureTreeNodeTransform(node: ParticleEffectTreeNode): ParticleNodeTransform {
  const defaults = defaultNodeTransform();
  if (!node.transform) {
    node.transform = defaults;
    return node.transform;
  }
  const t = node.transform;
  if (!t.position) {
    t.position = { ...defaults.position };
  } else {
    ensureVec3InPlace(t.position, defaults.position);
  }
  if (!t.rotationDeg) {
    t.rotationDeg = { ...defaults.rotationDeg };
  } else {
    ensureVec3InPlace(t.rotationDeg, defaults.rotationDeg);
  }
  if (!t.scale) {
    t.scale = { ...defaults.scale };
  } else {
    ensureVec3InPlace(t.scale, defaults.scale);
  }
  return node.transform;
}

export function copyNodeTransform(target: ParticleNodeTransform, source: ParticleNodeTransform): void {
  target.position.x = source.position.x;
  target.position.y = source.position.y;
  target.position.z = source.position.z;
  target.rotationDeg.x = source.rotationDeg.x;
  target.rotationDeg.y = source.rotationDeg.y;
  target.rotationDeg.z = source.rotationDeg.z;
  target.scale.x = source.scale.x;
  target.scale.y = source.scale.y;
  target.scale.z = source.scale.z;
}

export function isUniformScale(scale: Vec3Editable, epsilon = 1e-4): boolean {
  return (
    Math.abs(Math.abs(scale.x) - Math.abs(scale.y)) <= epsilon &&
    Math.abs(Math.abs(scale.x) - Math.abs(scale.z)) <= epsilon
  );
}

export function applyTransformToBabylonNode(
  node: TransformNode,
  transform: ParticleNodeTransform,
): void {
  const t = normalizeNodeTransform(transform);
  node.rotationQuaternion = null;
  node.rotation.set(
    (t.rotationDeg.x * Math.PI) / 180,
    (t.rotationDeg.y * Math.PI) / 180,
    (t.rotationDeg.z * Math.PI) / 180,
  );
  node.scaling.set(t.scale.x, t.scale.y, t.scale.z);
  node.position.set(t.position.x, t.position.y, t.position.z);
  node.computeWorldMatrix(true);
}

export function readTransformFromBabylonNode(node: TransformNode): ParticleNodeTransform {
  const radToDeg = (rad: number) => (rad * 180) / Math.PI;
  let rotationX = node.rotation.x;
  let rotationY = node.rotation.y;
  let rotationZ = node.rotation.z;
  if (node.rotationQuaternion) {
    const euler = node.rotationQuaternion.toEulerAngles();
    rotationX = euler.x;
    rotationY = euler.y;
    rotationZ = euler.z;
  }
  return {
    position: {
      x: node.position.x,
      y: node.position.y,
      z: node.position.z,
    },
    rotationDeg: {
      x: radToDeg(rotationX),
      y: radToDeg(rotationY),
      z: radToDeg(rotationZ),
    },
    scale: {
      x: node.scaling.x,
      y: node.scaling.y,
      z: node.scaling.z,
    },
  };
}
