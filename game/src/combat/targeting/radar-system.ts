import { Vector3 } from '@babylonjs/core';
import { isAutoAimCandidate, type FactionId } from '../faction';
import type { TargetEntity } from './targeting-system';
import { isTargetInAimHemisphere } from './aim-solver';

export interface RadarContact {
  id: string;
  faction: FactionId;
  position: Vector3;
  velocity: Vector3;
  radius: number;
  distance: number;
}

export interface RadarScanOptions {
  radius: number;
  /** When set, only contacts in the forward hemisphere qualify. */
  aimAxis?: Vector3;
  aimOrigin?: Vector3;
}

/** Spatial sensor — independent of player vs NPC control. */
export class RadarSystem {
  scan(
    observerFaction: FactionId,
    observerPos: Vector3,
    candidates: TargetEntity[],
    options: RadarScanOptions
  ): RadarContact[] {
    const contacts: RadarContact[] = [];

    for (const candidate of candidates) {
      if (!isAutoAimCandidate(observerFaction, candidate.faction)) continue;

      const distance = Vector3.Distance(observerPos, candidate.position);
      if (distance > options.radius) continue;

      if (
        options.aimAxis &&
        options.aimOrigin &&
        !isTargetInAimHemisphere(options.aimOrigin, options.aimAxis, candidate.position)
      ) {
        continue;
      }

      contacts.push({
        id: candidate.id,
        faction: candidate.faction,
        position: candidate.position.clone(),
        velocity: candidate.velocity.clone(),
        radius: candidate.radius,
        distance,
      });
    }

    contacts.sort((a, b) => a.distance - b.distance);
    return contacts;
  }

  nearest(contacts: RadarContact[]): RadarContact | null {
    return contacts[0] ?? null;
  }
}
