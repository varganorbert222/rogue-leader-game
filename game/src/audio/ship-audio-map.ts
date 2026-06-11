import { Factions } from '../constants/factions';
import { SfxClipIds, type SfxClipId } from '../constants/audio-clips';
import { ShipIds, type ShipId } from '../constants/ships';

/** Maps ship and faction ids to audio clip ids. */
export class ShipAudioCatalog {
  private static readonly ENGINE_BY_SHIP: Partial<Record<ShipId, SfxClipId>> = {
    [ShipIds.Xwing]: SfxClipIds.XwingEngine,
    [ShipIds.TieFighter]: SfxClipIds.TieFighterEngine,
  };

  private static readonly INBOUND_BY_SHIP: Partial<Record<ShipId, SfxClipId>> = {
    [ShipIds.Xwing]: SfxClipIds.XwingInbound,
    [ShipIds.TieFighter]: SfxClipIds.TieFighterInbound,
  };

  private static readonly CANNON_BY_FACTION: Record<string, SfxClipId> = {
    [Factions.Imperial]: SfxClipIds.ImperialCannonFire,
    [Factions.Rebel]: SfxClipIds.RebelCannonFire,
  };

  static engineClipForShip(shipId: string): SfxClipId {
    return this.ENGINE_BY_SHIP[shipId as ShipId] ?? SfxClipIds.XwingEngine;
  }

  static inboundClipForShip(shipId: string): SfxClipId | null {
    return this.INBOUND_BY_SHIP[shipId as ShipId] ?? null;
  }

  static cannonFireClipForFaction(faction: string): SfxClipId {
    return this.CANNON_BY_FACTION[faction] ?? SfxClipIds.RebelCannonFire;
  }
}
