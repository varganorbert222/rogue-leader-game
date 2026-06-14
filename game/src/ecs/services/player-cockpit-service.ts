import type { Scene } from '@babylonjs/core';
import {
  disposeCockpitAttachment,
  loadCockpitForShip,
  resolveCockpitConfig,
  type ShipManifestEntry,
} from '@rogue-leader/engine';
import type { CockpitComponent } from '../components/cockpit-component';
import type { EntityId } from '../entity-id';
import type { World } from '../world';

export async function attachPlayerCockpit(
  world: World,
  playerId: EntityId,
  scene: Scene,
  baseUrl: string,
  shipEntry: ShipManifestEntry,
): Promise<CockpitComponent | null> {
  const config = resolveCockpitConfig(shipEntry);
  if (!config) return null;

  const shipIdentity = world.get(playerId, 'shipIdentity');
  if (!shipIdentity) return null;

  const attachment = await loadCockpitForShip(
    scene,
    baseUrl,
    shipIdentity.loadedEntity,
    shipEntry,
  );
  if (!attachment) return null;

  const component: CockpitComponent = { attachment, config };
  world.add(playerId, 'cockpit', component);
  return component;
}

export function disposePlayerCockpit(world: World, playerId: EntityId): void {
  const cockpit = world.get(playerId, 'cockpit');
  if (!cockpit) return;
  disposeCockpitAttachment(cockpit.attachment);
  world.removeComponent(playerId, 'cockpit');
}
