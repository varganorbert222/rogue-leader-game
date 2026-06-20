import type { ShipManifestEntry } from '../loaders/asset-manifest';
import type { LoadedEntity } from '../loaders/gltf-ship-loader';
import { ShipAnimationController } from './ship-animation-controller';

/** Stop ship clips and snap them to the manifest initial pose (e.g. folded s-foils). */
export function resetShipAnimations(
  loaded: LoadedEntity,
  entry: ShipManifestEntry,
): void {
  const config = entry.abilities?.sfoil?.animation ?? entry.animations;
  if (!config?.transitions.length || loaded.animationGroups.length === 0) {
    return;
  }

  const controller = new ShipAnimationController(loaded.animationGroups, config);
  controller.dispose();
}
