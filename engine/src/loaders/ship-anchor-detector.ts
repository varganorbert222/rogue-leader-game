import { Mesh, TransformNode, Vector3, type AbstractMesh } from '@babylonjs/core';

/**
 * glTF / Blender transform anchor naming:
 *
 * **Engine pylons** (+Z = exhaust direction):
 * - `engine_{NN}` — e.g. `engine_01`, `engine_02` (numbered empties)
 * - `engine` or `engine_{name}` — any suffix
 *
 * **Weapon pylons** (+Z = muzzle direction):
 * - `weapon_laser_{NN}` — e.g. `weapon_laser_01`
 * - `weapon_projectile_{NN}` — e.g. `weapon_projectile_01`
 * - `weapon_{behavior}_{slot}` — projectile with behavior hint
 *   (`bomb`, `rocket`, `missile`, `torpedo`, `harpoon` → delivery projectile)
 *
 * Legacy: `fire_*` → laser mount; `engine_left` / `engine_right` / `engine_center` → engine.
 *
 * Weapon behavior (bomb, homing missile, disabling laser, etc.) comes from JSON config,
 * keyed by slot binding on the ship entry or defaultWeapons fallback.
 */
export type WeaponDelivery = 'laser' | 'projectile';

export interface EngineAnchor {
  slotId: string;
  node: TransformNode;
}

export interface WeaponAnchor {
  slotId: string;
  delivery: WeaponDelivery;
  /** Parsed from node name when not laser/projectile (bomb, missile, …). */
  behaviorHint?: string;
  node: TransformNode;
}

export interface ShipAnchors {
  engines: EngineAnchor[];
  weapons: WeaponAnchor[];
}

const LEGACY_FIRE_NAMES = new Set([
  'fire_left_01',
  'fire_left_02',
  'fire_right_01',
  'fire_right_02',
  'fire_center',
]);

const LEGACY_ENGINE_NAMES = new Set(['engine_left', 'engine_right', 'engine_center']);

const PROJECTILE_BEHAVIOR_HINTS = new Set([
  'bomb',
  'rocket',
  'missile',
  'torpedo',
  'harpoon',
  'projectile',
]);

function parseEngineName(name: string): { slotId: string } | null {
  if (LEGACY_ENGINE_NAMES.has(name)) {
    return { slotId: name.replace(/^engine_/, '') };
  }
  if (name === 'engine') {
    return { slotId: 'default' };
  }
  if (name.startsWith('engine_')) {
    return { slotId: name.slice('engine_'.length) || 'default' };
  }
  return null;
}

function parseWeaponName(
  name: string
): { slotId: string; delivery: WeaponDelivery; behaviorHint?: string } | null {
  if (LEGACY_FIRE_NAMES.has(name)) {
    return { slotId: name, delivery: 'laser' };
  }

  if (!name.startsWith('weapon_')) {
    return null;
  }

  const parts = name.split('_');
  if (parts.length < 2) return null;

  const kind = parts[1];
  const slotId = parts.length >= 3 ? parts.slice(2).join('_') : 'default';

  if (kind === 'laser') {
    return { slotId, delivery: 'laser' };
  }
  if (kind === 'projectile') {
    return { slotId, delivery: 'projectile' };
  }
  if (PROJECTILE_BEHAVIOR_HINTS.has(kind)) {
    return { slotId, delivery: 'projectile', behaviorHint: kind };
  }

  return null;
}

function collectNamedNodes(root: TransformNode): {
  transforms: TransformNode[];
  meshes: AbstractMesh[];
} {
  return {
    transforms: root.getChildTransformNodes(true),
    meshes: root.getChildMeshes(true),
  };
}

function resolveNodeTransform(
  node: TransformNode | AbstractMesh,
  root: TransformNode
): TransformNode {
  if (node instanceof Mesh) {
    return (node.parent as TransformNode | null) ?? root;
  }
  return node;
}

export function detectShipAnchors(root: TransformNode): ShipAnchors {
  const engines: EngineAnchor[] = [];
  const weapons: WeaponAnchor[] = [];
  const seen = new Set<string>();
  const { transforms, meshes } = collectNamedNodes(root);

  const visit = (name: string, node: TransformNode | AbstractMesh): void => {
    if (seen.has(name)) return;

    const engine = parseEngineName(name);
    if (engine) {
      seen.add(name);
      engines.push({
        slotId: engine.slotId,
        node: resolveNodeTransform(node, root),
      });
      return;
    }

    const weapon = parseWeaponName(name);
    if (weapon) {
      seen.add(name);
      weapons.push({
        slotId: weapon.slotId,
        delivery: weapon.delivery,
        behaviorHint: weapon.behaviorHint,
        node: resolveNodeTransform(node, root),
      });
    }
  };

  for (const node of transforms) visit(node.name, node);
  for (const mesh of meshes) visit(mesh.name, mesh);

  engines.sort((a, b) => compareSlotIds(a.slotId, b.slotId));
  weapons.sort((a, b) => compareSlotIds(a.slotId, b.slotId));

  return { engines, weapons };
}

function compareSlotIds(a: string, b: string): number {
  const numA = parseInt(a.replace(/\D/g, ''), 10);
  const numB = parseInt(b.replace(/\D/g, ''), 10);
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
    return numA - numB;
  }
  return a.localeCompare(b);
}

/** World-space muzzle / exhaust forward from anchor (+Z). */
export function getAnchorForward(node: TransformNode): Vector3 {
  return Vector3.TransformNormal(Vector3.Forward(), node.getWorldMatrix()).normalize();
}
