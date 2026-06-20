import { mergeVec3, vec3, type Vec3Editable } from '../shared/editable-primitives';
import type { PrefabNodeTransform, PrefabTreeNode } from './types';

export {
  defaultNodeTransform,
  normalizeNodeTransform,
  copyNodeTransform,
  applyTransformToBabylonNode,
  readTransformFromBabylonNode,
} from '../particle/transform';

export function defaultPrefabNodeTransform(): PrefabNodeTransform {
  return {
    position: vec3(),
    rotationDeg: vec3(),
    scale: vec3(1, 1, 1),
  };
}

function ensureVec3InPlace(target: Vec3Editable | undefined, defaults: Vec3Editable): Vec3Editable {
  if (!target) return { ...defaults };
  if (!Number.isFinite(target.x)) target.x = defaults.x;
  if (!Number.isFinite(target.y)) target.y = defaults.y;
  if (!Number.isFinite(target.z)) target.z = defaults.z;
  return target;
}

export function ensurePrefabTreeNodeTransform(node: PrefabTreeNode): PrefabNodeTransform {
  const defaults = defaultPrefabNodeTransform();
  if (!node.transform) {
    node.transform = defaults;
    return node.transform;
  }
  const t = node.transform;
  if (!t.position) t.position = { ...defaults.position };
  else ensureVec3InPlace(t.position, defaults.position);
  if (!t.rotationDeg) t.rotationDeg = { ...defaults.rotationDeg };
  else ensureVec3InPlace(t.rotationDeg, defaults.rotationDeg);
  if (!t.scale) t.scale = { ...defaults.scale };
  else ensureVec3InPlace(t.scale, defaults.scale);
  return node.transform;
}

export function normalizePrefabNodeTransform(raw?: Partial<PrefabNodeTransform>): PrefabNodeTransform {
  const defaults = defaultPrefabNodeTransform();
  return {
    position: mergeVec3(defaults.position, raw?.position),
    rotationDeg: mergeVec3(defaults.rotationDeg, raw?.rotationDeg),
    scale: mergeVec3(defaults.scale, raw?.scale),
  };
}
