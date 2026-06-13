import {
  collectLodRuntimes,
  collectProjectileTargetBodies,
  collectShipWeaponSystems,
} from './queries/combat-queries';
import type { ComponentKey, ComponentMap } from './component-map';
import { Role } from './components/role-tag';
import { entityId, type EntityId } from './entity-id';
import { AsteroidSpawnService } from '../hazards/asteroid-spawn-service';
import { runAsteroidTumbleSystem } from './systems/asteroid-tumble-system';

type ComponentStore<K extends ComponentKey> = Map<EntityId, ComponentMap[K]>;

/**
 * Entity Component System world: entities are IDs, behavior lives in systems.
 */
export class World {
  private readonly entities = new Set<EntityId>();
  private readonly stores = new Map<ComponentKey, ComponentStore<ComponentKey>>();
  private nextSeq = 0;
  playerEntity?: EntityId;
  readonly asteroids = new AsteroidSpawnService();

  spawn(rawId?: string): EntityId {
    const id = entityId(rawId ?? `entity_${this.nextSeq++}`);
    this.entities.add(id);
    return id;
  }

  despawn(id: EntityId): void {
    if (this.playerEntity === id) {
      this.playerEntity = undefined;
    }
    this.entities.delete(id);
    for (const store of this.stores.values()) {
      store.delete(id);
    }
  }

  add<K extends ComponentKey>(id: EntityId, key: K, value: ComponentMap[K]): void {
    let store = this.stores.get(key) as ComponentStore<K> | undefined;
    if (!store) {
      store = new Map<EntityId, ComponentMap[K]>();
      this.stores.set(key, store as ComponentStore<ComponentKey>);
    }
    store.set(id, value);
    if (key === 'role' && value === Role.Player) {
      this.playerEntity = id;
    }
  }

  removeComponent<K extends ComponentKey>(id: EntityId, key: K): void {
    this.stores.get(key)?.delete(id);
  }

  get<K extends ComponentKey>(id: EntityId, key: K): ComponentMap[K] | undefined {
    return (this.stores.get(key) as ComponentStore<K> | undefined)?.get(id);
  }

  has(id: EntityId, key: ComponentKey): boolean {
    return this.stores.get(key)?.has(id) ?? false;
  }

  /** All entities that have every listed component. */
  query<const K extends ComponentKey[]>(...keys: K): EntityId[] {
    const result: EntityId[] = [];
    for (const id of this.entities) {
      if (keys.every((key) => this.has(id, key))) {
        result.push(id);
      }
    }
    return result;
  }

  queryByRole(role: Role): EntityId[] {
    const store = this.stores.get('role');
    if (!store) return [];
    const result: EntityId[] = [];
    for (const [id, value] of store.entries()) {
      if (value === role) {
        result.push(id);
      }
    }
    return result;
  }

  getNpcCount(): number {
    return this.queryByRole(Role.Npc).length;
  }

  findEntity(rawId: string): EntityId | undefined {
    const id = entityId(rawId);
    return this.entities.has(id) ? id : undefined;
  }

  allEntities(): readonly EntityId[] {
    return [...this.entities];
  }

  collectShipWeaponSystems() {
    return collectShipWeaponSystems(this);
  }

  collectProjectileTargetBodies() {
    return collectProjectileTargetBodies(this);
  }

  collectLodRuntimes() {
    return collectLodRuntimes(this);
  }

  updateHazards(dt: number): void {
    runAsteroidTumbleSystem(this, dt);
  }

  clear(): void {
    this.entities.clear();
    this.stores.clear();
    this.playerEntity = undefined;
    this.nextSeq = 0;
  }

  dispose(): void {
    this.asteroids.dispose(this);
    this.clear();
  }
}

export type SystemFn = (world: World, dt: number) => void;
