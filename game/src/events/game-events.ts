import { Vector3 } from "@babylonjs/core";
import type { EntityDestroyKind } from "../data/constants/entity-destroy-kind";
import type { SfxClipId } from "../data/constants/audio-clips";

export const GameEventTypes = {
  WeaponFired: "WeaponFired",
  ProjectileHit: "ProjectileHit",
  EntityDestroyed: "EntityDestroyed",
  PlayerDamaged: "PlayerDamaged",
  AsteroidImpact: "AsteroidImpact",
  ShieldHit: "ShieldHit",
  BoostStarted: "BoostStarted",
  MissionStarted: "MissionStarted",
  MissionEnded: "MissionEnded",
  MenuOpened: "MenuOpened",
  MissileLock: "MissileLock",
  MissileLaunched: "MissileLaunched",
  HarpoonAttached: "HarpoonAttached",
  ProjectileWhoosh: "ProjectileWhoosh",
  ShipInbound: "ShipInbound",
  SfoilToggled: "SfoilToggled",
} as const;

export type GameEventType =
  (typeof GameEventTypes)[keyof typeof GameEventTypes];

export const GameEventPayloadKeys = {
  Sfx: "sfx",
  Kind: "kind",
  ShipId: "shipId",
  MusicId: "musicId",
  MusicSetId: "musicSetId",
  PlayerShipId: "playerShipId",
  WeaponId: "weaponId",
  Behavior: "behavior",
  Team: "team",
  Faction: "faction",
  Delivery: "delivery",
  ClipId: "clipId",
  Position: "position",
  Velocity: "velocity",
  SfxClipIds: "sfxClipIds",
  SfxFiles: "sfxFiles",
  SfxBasePath: "sfxBasePath",
} as const;

export interface WeaponFiredPayload {
  team: string;
  weaponId: string;
  delivery: string;
  behavior: string;
  faction: string;
  sfx?: string;
  position?: Vector3;
}

export interface ProjectileHitPayload {
  weaponId: string;
  behavior?: string;
  sfx: string;
  position?: Vector3;
}

export interface EntityDestroyedPayload {
  kind: EntityDestroyKind;
  shipId?: string;
  position?: Vector3;
}

export interface SpatialSfxPayload {
  position?: Vector3;
  velocity?: Vector3;
  sfx?: string;
}

export interface MissionStartedPayload {
  musicId: string;
  musicSetId?: string;
  playerShipId: string;
}

export interface GameEvent {
  type: GameEventType;
  payload?: Record<string, unknown>;
}

export type GameEventListener = (event: GameEvent) => void;

function asEventPayload(payload: object): Record<string, unknown> {
  return payload as unknown as Record<string, unknown>;
}

export class GameEventBus {
  private readonly listeners = new Map<GameEventType, GameEventListener[]>();

  on(type: GameEventType, listener: GameEventListener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  emit(event: GameEvent): void {
    const list = this.listeners.get(event.type) ?? [];
    list.forEach((l) => l(event));
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** Typed event factories for emit sites. */
export const GameEvents = {
  weaponFired(payload: WeaponFiredPayload): GameEvent {
    return {
      type: GameEventTypes.WeaponFired,
      payload: asEventPayload(payload),
    };
  },

  projectileHit(payload: ProjectileHitPayload): GameEvent {
    return {
      type: GameEventTypes.ProjectileHit,
      payload: asEventPayload(payload),
    };
  },

  projectileWhoosh(payload: SpatialSfxPayload = {}): GameEvent {
    return {
      type: GameEventTypes.ProjectileWhoosh,
      payload: asEventPayload(payload),
    };
  },

  entityDestroyed(payload: EntityDestroyedPayload): GameEvent {
    return {
      type: GameEventTypes.EntityDestroyed,
      payload: asEventPayload(payload),
    };
  },

  shieldHit(payload: SpatialSfxPayload = {}): GameEvent {
    return {
      type: GameEventTypes.ShieldHit,
      payload: asEventPayload(payload),
    };
  },

  playerDamaged(payload: SpatialSfxPayload = {}): GameEvent {
    return {
      type: GameEventTypes.PlayerDamaged,
      payload: asEventPayload(payload),
    };
  },

  asteroidImpact(payload: SpatialSfxPayload = {}): GameEvent {
    return {
      type: GameEventTypes.AsteroidImpact,
      payload: asEventPayload(payload),
    };
  },

  boostStarted(): GameEvent {
    return { type: GameEventTypes.BoostStarted };
  },

  missionStarted(payload: MissionStartedPayload): GameEvent {
    return {
      type: GameEventTypes.MissionStarted,
      payload: asEventPayload(payload),
    };
  },

  missionEnded(): GameEvent {
    return { type: GameEventTypes.MissionEnded };
  },

  missileLaunched(weaponId: string): GameEvent {
    return {
      type: GameEventTypes.MissileLaunched,
      payload: { [GameEventPayloadKeys.WeaponId]: weaponId },
    };
  },

  harpoonAttached(): GameEvent {
    return { type: GameEventTypes.HarpoonAttached };
  },

  sfoilToggled(payload: SpatialSfxPayload): GameEvent {
    return {
      type: GameEventTypes.SfoilToggled,
      payload: asEventPayload(payload),
    };
  },
};

export function readPayloadString(
  payload: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = payload?.[key];
  return typeof value === "string" ? value : undefined;
}

export function readPayloadSfx(
  payload: Record<string, unknown> | undefined,
  fallback: SfxClipId,
): SfxClipId {
  return (
    (readPayloadString(payload, GameEventPayloadKeys.Sfx) as
      | SfxClipId
      | undefined) ?? fallback
  );
}

export function readPayloadDestroyKind(
  payload: Record<string, unknown> | undefined,
): EntityDestroyKind | undefined {
  return readPayloadString(payload, GameEventPayloadKeys.Kind) as
    | EntityDestroyKind
    | undefined;
}

export function readPayloadStringArray(
  payload: Record<string, unknown> | undefined,
  key: string,
): string[] | undefined {
  const value = payload?.[key];
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter(
    (entry): entry is string => typeof entry === "string",
  );
  return strings.length > 0 ? strings : undefined;
}

export function readPayloadVector3(
  payload: Record<string, unknown> | undefined,
  key: string,
): Vector3 | undefined {
  const value = payload?.[key];
  if (!value || typeof value !== "object") return undefined;
  const v = value as { x?: unknown; y?: unknown; z?: unknown };
  if (
    typeof v.x !== "number" ||
    typeof v.y !== "number" ||
    typeof v.z !== "number"
  ) {
    return undefined;
  }
  return new Vector3(v.x, v.y, v.z);
}
