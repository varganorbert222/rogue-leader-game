import type { TransformNode } from '@babylonjs/core';
import { Vector3 } from '@babylonjs/core';
import { detectShipAnchors } from './ship-anchor-detector';

export interface FirePoints {
  fires: Vector3[];
  engines: Vector3[];
}

/** Collect world positions of weapon (legacy fires) and engine anchors. */
export function detectFirePoints(root: TransformNode): FirePoints {
  const anchors = detectShipAnchors(root);
  const fires = anchors.weapons.map((w) => w.node.getAbsolutePosition().clone());
  const engines = anchors.engines.map((e) => e.node.getAbsolutePosition().clone());

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

/** Refresh anchor world positions each frame from root. */
export function refreshFirePoints(root: TransformNode): FirePoints {
  return detectFirePoints(root);
}
