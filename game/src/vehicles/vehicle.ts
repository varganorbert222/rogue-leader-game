import {
  Quaternion,
  Scalar,
  TransformNode,
  Vector3,
  type AbstractMesh,
} from '@babylonjs/core';
import type { LoadedEntity, LodRuntimeState, ShipManifestEntry } from '@rogue-leader/engine';
import { setLoadedEntityVisible } from '@rogue-leader/engine';
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
import type { SfoilSfxPlayRequest } from '../audio/sfoil-sfx';
import { ShipSfoilController } from './ship-sfoil-controller';

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
  readonly colliderMeshes: readonly AbstractMesh[];
  readonly lodRuntime: LodRuntimeState;
  readonly weapons: VehicleWeaponSystem;
  readonly loadedEntity: LoadedEntity;
  private readonly flight: ShipFlightController;
  private readonly bankPivot?: TransformNode;
  private readonly invertForwardRoll: boolean;
  private visualBank = 0;

  private constructor(
    options: VehicleSpawnOptions,
    flight: ShipFlightController,
    private readonly sfoil?: ShipSfoilController,
    bankPivot?: TransformNode,
    invertForwardRoll = false
  ) {
    this.id = options.id;
    this.shipId = options.shipId;
    this.faction = options.faction;
    this.combatTeam = options.combatTeam;
    this.colliderRadius = options.loaded.colliderRadius;
    this.colliderMeshes = options.loaded.colliderMeshes;
    this.lodRuntime = options.loaded.lodRuntime;
    this.weapons = options.weapons;
    this.loadedEntity = options.loaded;
    this.flight = flight;
    this.sfoil = sfoil;
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
    const sfoil = ShipSfoilController.tryCreate({
      shipEntry: options.shipEntry,
      animationGroups: options.loaded.animationGroups,
      weapons: options.weapons,
      flight,
    });
    return new Vehicle(
      options,
      flight,
      sfoil ?? undefined,
      bankPivot,
      options.loaded.visual.invertForwardRoll
    );
  }

  hasSfoilAbility(): boolean {
    return this.sfoil != null;
  }

  /** Start S-foil toggle; returns sfx play request when a transition starts. */
  tryToggleSfoil(): SfoilSfxPlayRequest | null {
    if (!this.sfoil?.requestToggle()) return null;
    return this.sfoil.sfxRequest;
  }

  getSfoilState(): string | null {
    return this.sfoil?.getState() ?? null;
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
    this.sfoil?.dispose();
    this.root.dispose();
  }

  /** Return ship visuals to instance pool without destroying the loaded hierarchy. */
  prepareForPool(): void {
    this.sfoil?.dispose();
    this.weapons.setFireEnabled(false);
    this.flight.resetKinematics();
    this.root.rotationQuaternion = Quaternion.Identity();
    this.root.rotation.setAll(0);
    setLoadedEntityVisible(this.loadedEntity, false);
    this.root.position.set(0, -5000, 0);
  }
}

function setupVisualBankPivot(
  visualRoot: TransformNode,
  _invertForwardRoll: boolean
): TransformNode | undefined {
  const existing = visualRoot
    .getChildTransformNodes(false)
    .find((node) => node.name.endsWith('_bank'));
  if (existing) {
    return existing;
  }

  const bank = new TransformNode(`${visualRoot.name}_bank`, visualRoot.getScene());
  bank.parent = visualRoot;
  for (const child of [...visualRoot.getChildren()]) {
    if (child !== bank) {
      child.parent = bank;
    }
  }
  return bank;
}
