export type GameEventType =
  | 'WeaponFired'
  | 'ProjectileHit'
  | 'EntityDestroyed'
  | 'PlayerDamaged'
  | 'MeteorImpact'
  | 'ShieldHit'
  | 'BoostStarted'
  | 'MissionStarted'
  | 'MissionEnded'
  | 'MenuOpened'
  | 'MissileLock'
  | 'MissileLaunched'
  | 'HarpoonAttached';

export interface GameEvent {
  type: GameEventType;
  payload?: Record<string, unknown>;
}

export type GameEventListener = (event: GameEvent) => void;

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
