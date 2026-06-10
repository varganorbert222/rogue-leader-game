import type { AbstractMesh, TransformNode } from '@babylonjs/core';
import { Vector3 } from '@babylonjs/core';

const FIRE_NAMES = [
  'fire_left_01',
  'fire_left_02',
  'fire_right_01',
  'fire_right_02',
  'fire_center',
] as const;

const ENGINE_NAMES = ['engine_left', 'engine_right', 'engine_center'] as const;

export interface FirePoints {
  fires: Vector3[];
  engines: Vector3[];
}

/** Collect world positions of named fire/engine nodes; defaults if none found. */
export function detectFirePoints(root: TransformNode): FirePoints {
  const fires: Vector3[] = [];
  const engines: Vector3[] = [];

  const nodes = root.getChildTransformNodes(true);
  const meshes = root.getChildMeshes(true);

  for (const name of FIRE_NAMES) {
    const node =
      nodes.find((n) => n.name === name) ?? meshes.find((m) => m.name === name);
    if (node) fires.push(node.getAbsolutePosition().clone());
  }

  for (const name of ENGINE_NAMES) {
    const node =
      nodes.find((n) => n.name === name) ?? meshes.find((m) => m.name === name);
    if (node) engines.push(node.getAbsolutePosition().clone());
  }

  if (fires.length === 0) {
    const pos = root.getAbsolutePosition();
    fires.push(pos.add(new Vector3(-1.5, 0, 2)));
    fires.push(pos.add(new Vector3(1.5, 0, 2)));
  }

  if (engines.length === 0) {
    const pos = root.getAbsolutePosition();
    engines.push(pos.add(new Vector3(-0.8, 0, -1.5)));
    engines.push(pos.add(new Vector3(0.8, 0, -1.5)));
  }

  return { fires, engines };
}

/** Refresh fire world positions each frame from root. */
export function refreshFirePoints(root: TransformNode): FirePoints {
  return detectFirePoints(root);
}
