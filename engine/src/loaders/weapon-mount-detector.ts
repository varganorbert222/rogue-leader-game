import { TransformNode, Vector3, type AbstractMesh } from '@babylonjs/core';

/**
 * Blender / glTF weapon mount naming convention:
 *
 * - `weapon_{type}_{slot}` — e.g. weapon_laser_left, weapon_laser_right, weapon_missile_center
 * - Legacy laser mounts: fire_left_01, fire_right_01, fire_center, …
 *
 * Mount node forward (+Z) should align with muzzle direction in the DCC tool.
 */
export interface DetectedWeaponMount {
  slotId: string;
  weaponType: string;
  node: TransformNode;
}

const LEGACY_LASER_FIRE_NAMES = [
  'fire_left_01',
  'fire_left_02',
  'fire_right_01',
  'fire_right_02',
  'fire_center',
] as const;

function parseWeaponNodeName(name: string): { weaponType: string; slotId: string } | null {
  if (name.startsWith('weapon_')) {
    const parts = name.split('_');
    if (parts.length >= 3) {
      return {
        weaponType: parts[1],
        slotId: parts.slice(2).join('_'),
      };
    }
  }
  if (LEGACY_LASER_FIRE_NAMES.includes(name as (typeof LEGACY_LASER_FIRE_NAMES)[number])) {
    return { weaponType: 'laser', slotId: name };
  }
  return null;
}

export function detectWeaponMounts(root: TransformNode): DetectedWeaponMount[] {
  const mounts: DetectedWeaponMount[] = [];
  const seen = new Set<string>();

  const nodes = root.getChildTransformNodes(true);
  const meshes = root.getChildMeshes(true);

  for (const node of nodes) {
    const parsed = parseWeaponNodeName(node.name);
    if (!parsed || seen.has(node.name)) continue;
    seen.add(node.name);
    mounts.push({
      slotId: parsed.slotId,
      weaponType: parsed.weaponType,
      node,
    });
  }

  for (const mesh of meshes) {
    const parsed = parseWeaponNodeName(mesh.name);
    if (!parsed || seen.has(mesh.name)) continue;
    seen.add(mesh.name);
    const transform = (mesh.parent as TransformNode | null) ?? root;
    mounts.push({
      slotId: parsed.slotId,
      weaponType: parsed.weaponType,
      node: transform,
    });
  }

  if (mounts.length === 0) {
    const fallback = new Vector3(0, 0, 2);
    const createFallback = (slotId: string, offset: Vector3): DetectedWeaponMount => {
      const n = new TransformNode(`weapon_laser_${slotId}_fallback`, root.getScene());
      n.parent = root;
      n.position = offset;
      return { slotId, weaponType: 'laser', node: n };
    };
    mounts.push(createFallback('left', fallback.add(new Vector3(-1.5, 0, 0))));
    mounts.push(createFallback('right', fallback.add(new Vector3(1.5, 0, 0))));
  }

  return mounts;
}

/** World-space muzzle direction from mount node (+Z). */
export function getMountForward(node: TransformNode): Vector3 {
  return Vector3.TransformNormal(
    Vector3.Forward(),
    node.getWorldMatrix()
  ).normalize();
}
