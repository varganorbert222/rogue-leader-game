import { TransformNode, Vector3 } from '@babylonjs/core';
import {
  detectShipAnchors,
  getAnchorForward,
  type ShipAnchors,
  type WeaponAnchor,
  type WeaponDelivery,
} from './ship-anchor-detector';

/** @deprecated Use WeaponAnchor from ship-anchor-detector. */
export interface DetectedWeaponMount {
  slotId: string;
  /** @deprecated Use delivery + behaviorHint. */
  weaponType: string;
  delivery: WeaponDelivery;
  behaviorHint?: string;
  node: TransformNode;
}

export function weaponAnchorsToMounts(anchors: WeaponAnchor[]): DetectedWeaponMount[] {
  return anchors.map(toDetectedMount);
}

export function detectWeaponMounts(
  root: TransformNode,
  cached?: ShipAnchors
): DetectedWeaponMount[] {
  const weapons = cached?.weapons ?? detectShipAnchors(root).weapons;
  if (weapons.length > 0) {
    return weaponAnchorsToMounts(weapons);
  }

  return createFallbackLaserMounts(root);
}

function toDetectedMount(anchor: WeaponAnchor): DetectedWeaponMount {
  return {
    slotId: anchor.slotId,
    weaponType: anchor.delivery,
    delivery: anchor.delivery,
    behaviorHint: anchor.behaviorHint,
    node: anchor.node,
  };
}

function createFallbackLaserMounts(root: TransformNode): DetectedWeaponMount[] {
  const fallback = new Vector3(0, 0, 2);
  const createFallback = (slotId: string, offset: Vector3): DetectedWeaponMount => {
    const n = new TransformNode(`weapon_laser_${slotId}_fallback`, root.getScene());
    n.parent = root;
    n.position = offset;
    return {
      slotId,
      weaponType: 'laser',
      delivery: 'laser',
      node: n,
    };
  };
  return [
    createFallback('left', fallback.add(new Vector3(-1.5, 0, 0))),
    createFallback('right', fallback.add(new Vector3(1.5, 0, 0))),
  ];
}

/** World-space muzzle direction from mount node (+Z). */
export function getMountForward(node: TransformNode): Vector3 {
  return getAnchorForward(node);
}
