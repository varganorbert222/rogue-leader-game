import type { FactionId } from '../combat/faction';
import type { AsteroidBodyComponent } from './components/asteroid-body-component';
import type { CockpitComponent } from './components/cockpit-component';
import type { ColliderComponent } from './components/collider-component';
import type { FlightComponent } from './components/flight-component';
import type { HealthComponent } from './components/health-component';
import type { LodComponent } from './components/lod-component';
import type { NpcSteeringComponent } from './components/npc-steering-component';
import type { Role } from './components/role-tag';
import type { SfoilComponent } from './components/sfoil-component';
import type { ShipIdentityComponent } from './components/ship-identity-component';
import type { TargetingComponent } from './components/targeting-component';
import type { WeaponEnergyComponent } from './components/weapon-energy-component';
import type { WeaponsComponent } from './components/weapons-component';
import type { DeathEffectRefComponent } from './components/death-effect-ref';

/** Typed component registry — every key maps to one component type. */
export interface ComponentMap {
  role: Role;
  health: HealthComponent;
  weaponEnergy: WeaponEnergyComponent;
  faction: FactionId;
  shipIdentity: ShipIdentityComponent;
  cockpit: CockpitComponent;
  flight: FlightComponent;
  collider: ColliderComponent;
  lod: LodComponent;
  weapons: WeaponsComponent;
  sfoil: SfoilComponent;
  targeting: TargetingComponent;
  npcSteering: NpcSteeringComponent;
  asteroidBody: AsteroidBodyComponent;
  deathEffectRef: DeathEffectRefComponent;
}

export type ComponentKey = keyof ComponentMap;

/** Components present on every controllable ship entity. */
export const SHIP_COMPONENT_KEYS = [
  'role',
  'health',
  'faction',
  'shipIdentity',
  'flight',
  'collider',
  'lod',
  'weapons',
  'targeting',
] as const satisfies readonly ComponentKey[];
