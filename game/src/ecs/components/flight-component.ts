import type { TransformNode } from '@babylonjs/core';
import type { ShipFlightController } from '../../flight/ship-flight-controller';

export interface FlightComponent {
  controller: ShipFlightController;
  bankPivot?: TransformNode;
  visualBank: number;
  invertForwardRoll: boolean;
}
