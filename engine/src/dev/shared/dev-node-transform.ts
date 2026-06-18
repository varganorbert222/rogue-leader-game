import type { TransformNode } from '@babylonjs/core';
import type { Vec3Editable } from '../shared/editable-primitives';

export interface DevNodeTransform {
  position: Vec3Editable;
  rotationDeg: Vec3Editable;
  scale: Vec3Editable;
}

export function defaultDevNodeTransform(): DevNodeTransform {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

export function readDevNodeTransform(node: TransformNode): DevNodeTransform {
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
    position: { x: node.position.x, y: node.position.y, z: node.position.z },
    rotationDeg: {
      x: radToDeg(rotationX),
      y: radToDeg(rotationY),
      z: radToDeg(rotationZ),
    },
    scale: { x: node.scaling.x, y: node.scaling.y, z: node.scaling.z },
  };
}

export function applyDevNodeTransform(node: TransformNode, transform: DevNodeTransform): void {
  node.rotationQuaternion = null;
  node.rotation.set(
    (transform.rotationDeg.x * Math.PI) / 180,
    (transform.rotationDeg.y * Math.PI) / 180,
    (transform.rotationDeg.z * Math.PI) / 180,
  );
  node.scaling.set(transform.scale.x, transform.scale.y, transform.scale.z);
  node.position.set(transform.position.x, transform.position.y, transform.position.z);
  node.computeWorldMatrix(true);
}

export function copyDevNodeTransform(target: DevNodeTransform, source: DevNodeTransform): void {
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
