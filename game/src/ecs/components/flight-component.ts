import type { TransformNode } from '@babylonjs/core';
import type { ShipFlightController } from '../../flight/ship-flight-controller';

export interface FlightComponent {
  controller: ShipFlightController;
  bankPivot?: TransformNode;
  /** Smoothed yaw stick [-1, 1] driving cosmetic bank. */
  visualBankYaw: number;
  /** Spring velocity for {@link visualBankYaw}. */
  visualBankYawVel: number;
  invertForwardRoll: boolean;
}
