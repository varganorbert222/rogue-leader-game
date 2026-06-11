import {
  Quaternion,
  Scalar,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { LoadedEntity, ShipManifestEntry } from '@rogue-leader/engine';
import type { LodRuntimeState } from '@rogue-leader/engine';
import type { FactionId } from '../combat/faction';
import { computeEngineSpeedRatio } from '../audio/engine-audio-config';
import {
  resolveShipFlightStats,
  type ShipFlightStatsConfig,
} from '../config/ship-flight-stats';
import {
  INPUT_DEADZONE,
  type FlightAssistOptions,
} from '../flight/flight-assist';
import { YAW_VISUAL_BANK_DEG } from '../flight/flight-constants';
import { ShipFlightController } from '../flight/ship-flight-controller';
import type { SoftBoundary } from '../flight/soft-boundary';
import type { VehicleInput } from '../input/vehicle-input';
import type { CombatTeam } from '../weapons/core/combat-team';
import type { VehicleWeaponSystem } from '../weapons/core/vehicle-weapon-system';

const YAW_VISUAL_BANK_RAD = (YAW_VISUAL_BANK_DEG * Math.PI) / 180;

export interface VehicleSpawnOptions {
  id: string;
  shipId: string;
  shipEntry: ShipManifestEntry;
  loaded: LoadedEntity;
  faction: FactionId;
  combatTeam: CombatTeam;
  weapons: VehicleWeaponSystem;
  flightDefaults?: ShipFlightStatsConfig;
}

/** Controllable craft: flight kinematics, weapons, and collision footprint. */
export class Vehicle {
  readonly id: string;
  readonly shipId: string;
  readonly faction: FactionId;
  readonly combatTeam: CombatTeam;
  readonly colliderRadius: number;
  readonly lodRuntime: LodRuntimeState;
  readonly weapons: VehicleWeaponSystem;
  private readonly flight: ShipFlightController;
  private readonly bankPivot?: TransformNode;
  private readonly invertForwardRoll: boolean;
  private visualBank = 0;

  private constructor(
    options: VehicleSpawnOptions,
    flight: ShipFlightController,
    bankPivot?: TransformNode,
    invertForwardRoll = false
  ) {
    this.id = options.id;
    this.shipId = options.shipId;
    this.faction = options.faction;
    this.combatTeam = options.combatTeam;
    this.colliderRadius = options.loaded.colliderRadius;
    this.lodRuntime = options.loaded.lodRuntime;
    this.weapons = options.weapons;
    this.flight = flight;
    this.bankPivot = bankPivot;
    this.invertForwardRoll = invertForwardRoll;
  }

  static spawn(options: VehicleSpawnOptions): Vehicle {
    const stats = resolveShipFlightStats(options.shipEntry, options.flightDefaults);
    const flight = new ShipFlightController(options.loaded.root, stats);
    const bankPivot = setupVisualBankPivot(
      options.loaded.visualRoot,
      options.loaded.visual.invertForwardRoll
    );
    return new Vehicle(
      options,
      flight,
      bankPivot,
      options.loaded.visual.invertForwardRoll
    );
  }

  get root(): TransformNode {
    return this.flight.root;
  }

  get position(): Vector3 {
    return this.flight.root.position;
  }

  get velocity(): Vector3 {
    return this.flight.velocity;
  }

  get rotationQuaternion(): Quaternion {
    return this.flight.root.rotationQuaternion ?? Quaternion.Identity();
  }

  getForward(): Vector3 {
    return this.flight.getForward();
  }

  getSpeed(): number {
    return this.flight.getSpeed();
  }

  getMinSpeed(): number {
    return this.flight.getMinSpeed();
  }

  getMaxSpeed(): number {
    return this.flight.getMaxSpeed();
  }

  getEngineSpeedRatio(): number {
    return computeEngineSpeedRatio(
      this.getSpeed(),
      this.getMinSpeed(),
      this.getMaxSpeed()
    );
  }

  getCruiseSpeed(): number {
    return this.flight.getCruiseSpeed();
  }

  setFlightAssist(options: Partial<FlightAssistOptions>): void {
    this.flight.setFlightAssist(options);
  }

  applyVehicleInput(
    dt: number,
    input: VehicleInput,
    boundary?: SoftBoundary,
    visualYaw = input.yaw
  ): void {
    this.flight.update(dt, input, boundary);
    this.updateVisualYawBank(dt, visualYaw);
  }

  private updateVisualYawBank(dt: number, yaw: number): void {
    if (!this.bankPivot) return;

    const hasYaw = Math.abs(yaw) >= INPUT_DEADZONE;
    const target = hasYaw ? Scalar.Clamp(yaw, -1, 1) * YAW_VISUAL_BANK_RAD : 0;
    const blend = hasYaw ? 1 - Math.pow(0.00005, dt) : 1 - Math.pow(0.001, dt);
    this.visualBank = Scalar.Lerp(this.visualBank, target, blend);
    const rollAngle = this.invertForwardRoll ? -this.visualBank : this.visualBank;
    this.bankPivot.rotationQuaternion = Quaternion.RotationAxis(
      Vector3.Backward(),
      rollAngle
    );
  }

  dispose(): void {
    this.root.dispose();
  }
}

function setupVisualBankPivot(
  visualRoot: TransformNode,
  _invertForwardRoll: boolean
): TransformNode | undefined {
  const bank = new TransformNode(`${visualRoot.name}_bank`, visualRoot.getScene());
  bank.parent = visualRoot;
  for (const child of [...visualRoot.getChildren()]) {
    if (child !== bank) {
      child.parent = bank;
    }
  }
  return bank;
}
