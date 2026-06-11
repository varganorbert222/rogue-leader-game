import { Color3, MeshBuilder, Vector3, type LinesMesh, type Scene } from '@babylonjs/core';
import type { NpcStateId } from '../config/npc-behavior-config';
import type { WeaponAimDebugInfo } from '../combat/weapon-aim-controller';
import type { NpcSteeringDebugInfo } from '../ai/behavior-npc-input';
import type { WanderZoneDefinition } from '../ai/navigation/nav-types';
import type { DebugPreferences } from './debug-preferences';
import { DebugLabelLayer, type DebugLabelSpec } from './debug-labels';
import {
  addLineSystem,
  buildCubeWireframeLines,
  buildSphereWireframeLines,
} from './wireframe-primitives';

export interface NpcDebugSnapshot {
  id: string;
  position: Vector3;
  flockId: string;
  state: NpcStateId;
  steering: NpcSteeringDebugInfo;
  radarRadius: number;
}

export interface VehicleDebugSnapshot {
  id: string;
  position: Vector3;
  radius: number;
  label: string;
  isPlayer: boolean;
}

export interface ProjectileDebugSnapshot {
  id: string;
  position: Vector3;
  direction: Vector3;
  team: string;
  weaponId: string;
}

export interface MeteorDebugSnapshot {
  id: string;
  position: Vector3;
  radius: number;
}

export interface GameDebugFrame {
  playerAim?: WeaponAimDebugInfo;
  paths: { pathId: string; points: Vector3[] }[];
  zones: { zoneId: string; zone: WanderZoneDefinition }[];
  npcs: NpcDebugSnapshot[];
  vehicles: VehicleDebugSnapshot[];
  projectiles: ProjectileDebugSnapshot[];
  meteors: MeteorDebugSnapshot[];
}

const STATE_COLORS: Record<NpcStateId, Color3> = {
  patrol: new Color3(0.35, 0.85, 0.45),
  chase: new Color3(0.95, 0.85, 0.2),
  attack: new Color3(0.95, 0.25, 0.2),
};

export class GameDebugOverlay {
  private lineMeshes: LinesMesh[] = [];
  private readonly labels = new DebugLabelLayer();

  render(scene: Scene, frame: GameDebugFrame, prefs: DebugPreferences): void {
    this.clear();

    if (!prefs.masterEnabled) {
      return;
    }

    const labelSpecs: DebugLabelSpec[] = [];
    const labelsOn = prefs.labels.enabled;

    if (prefs.overlays.navPaths) {
      for (const path of frame.paths) {
        if (path.points.length < 2) continue;
        const segments: Vector3[][] = [];
        for (let i = 0; i < path.points.length - 1; i++) {
          segments.push([path.points[i], path.points[i + 1]]);
        }
        if (path.points.length > 2) {
          segments.push([path.points[path.points.length - 1], path.points[0]]);
        }
        addLineSystem(
          scene,
          `dbgPath_${path.pathId}`,
          segments,
          new Color3(0.3, 0.75, 1),
          this.lineMeshes
        );
        if (labelsOn && prefs.labels.navPaths) {
          labelSpecs.push({
            id: `path_${path.pathId}`,
            category: 'navPath',
            text: path.pathId,
            position: path.points[0].add(new Vector3(0, 6, 0)),
          });
        }
      }
    }

    if (prefs.overlays.navWaypoints) {
      for (const path of frame.paths) {
        path.points.forEach((point, index) => {
          addLineSystem(
            scene,
            `dbgWp_${path.pathId}_${index}`,
            [
              [point, point.add(new Vector3(0, 12, 0))],
              [
                point.add(new Vector3(-2, 0, 0)),
                point.add(new Vector3(2, 0, 0)),
              ],
              [
                point.add(new Vector3(0, 0, -2)),
                point.add(new Vector3(0, 0, 2)),
              ],
            ],
            new Color3(0.45, 0.95, 0.55),
            this.lineMeshes
          );
          if (labelsOn && prefs.labels.navWaypoints) {
            labelSpecs.push({
              id: `wp_${path.pathId}_${index}`,
              category: 'navWaypoint',
              text: `${path.pathId} #${index + 1}`,
              position: point.add(new Vector3(0, 14, 0)),
              markerScale: 2,
            });
          }
        });
      }
    }

    if (prefs.overlays.wanderZones3d) {
      for (const entry of frame.zones) {
        const center = Vector3.FromArray(entry.zone.center);
        const zoneLines =
          entry.zone.type === 'cube'
            ? buildCubeWireframeLines(
                center,
                Vector3.FromArray(entry.zone.halfExtents)
              )
            : buildSphereWireframeLines(center, entry.zone.radius);
        addLineSystem(
          scene,
          `dbgZone3d_${entry.zoneId}`,
          zoneLines,
          new Color3(0.55, 0.35, 0.95),
          this.lineMeshes
        );
        if (labelsOn && prefs.labels.wanderZones) {
          labelSpecs.push({
            id: `zone_${entry.zoneId}`,
            category: 'wanderZone',
            text: entry.zoneId,
            position: center.add(new Vector3(0, entry.zone.type === 'sphere' ? entry.zone.radius + 4 : 8, 0)),
          });
        }
      }
    }

    if (prefs.overlays.playerAimVectors && frame.playerAim) {
      const aim = frame.playerAim;
      addLineSystem(
        scene,
        'dbgPlayerAim',
        [[aim.aimOrigin, aim.aimOrigin.add(aim.aimDirection.scale(60))]],
        new Color3(0.2, 1, 0.35),
        this.lineMeshes
      );
      if (aim.targetPosition) {
        addLineSystem(
          scene,
          'dbgPlayerAimTarget',
          [[aim.aimOrigin, aim.targetPosition]],
          new Color3(1, 0.35, 0.2),
          this.lineMeshes
        );
      }
    }

    if (prefs.overlays.playerRadarRing && frame.playerAim) {
      addLineSystem(
        scene,
        'dbgPlayerRadar',
        buildSphereWireframeLines(frame.playerAim.aimOrigin, frame.playerAim.radarRadius, 32),
        new Color3(0.2, 0.9, 0.9),
        this.lineMeshes
      );
    }

    for (const npc of frame.npcs) {
      const color = STATE_COLORS[npc.steering.state] ?? Color3.White();
      if (prefs.overlays.npcSteeringVectors) {
        addLineSystem(
          scene,
          `dbgNpcSteer_${npc.id}`,
          [[npc.position, npc.steering.steerTarget]],
          color,
          this.lineMeshes
        );
      }
      if (prefs.overlays.npcRadarRings) {
        addLineSystem(
          scene,
          `dbgNpcRadar_${npc.id}`,
          buildSphereWireframeLines(npc.position, npc.radarRadius, 24),
          color,
          this.lineMeshes
        );
      }
      if (labelsOn && prefs.labels.npcActors) {
        labelSpecs.push({
          id: `npc_${npc.id}`,
          category: 'npc',
          text: `${npc.id} · ${npc.steering.state} · ${npc.steering.mode}`,
          position: npc.position.add(new Vector3(0, 8, 0)),
        });
      }
    }

    if (prefs.overlays.vehicleWireframes) {
      for (const vehicle of frame.vehicles) {
        const size = Math.max(4, vehicle.radius * 2);
        const half = new Vector3(size * 0.5, size * 0.25, size * 0.7);
        addLineSystem(
          scene,
          `dbgVeh_${vehicle.id}`,
          buildCubeWireframeLines(vehicle.position, half),
          vehicle.isPlayer ? new Color3(0.3, 1, 0.5) : new Color3(0.35, 0.75, 1),
          this.lineMeshes
        );
        if (labelsOn && prefs.labels.vehicles) {
          labelSpecs.push({
            id: `veh_${vehicle.id}`,
            category: 'vehicle',
            text: vehicle.label,
            position: vehicle.position.add(new Vector3(0, size + 2, 0)),
          });
        }
      }
    }

    if (prefs.overlays.projectileGizmos) {
      for (const projectile of frame.projectiles) {
        const tip = projectile.position.add(projectile.direction.scale(4));
        addLineSystem(
          scene,
          `dbgPrj_${projectile.id}`,
          [[projectile.position, tip]],
          new Color3(1, 0.8, 0.25),
          this.lineMeshes
        );
        if (labelsOn && prefs.labels.projectiles) {
          labelSpecs.push({
            id: `prj_${projectile.id}`,
            category: 'projectile',
            text: `${projectile.weaponId} (${projectile.team})`,
            position: projectile.position.add(new Vector3(0, 2, 0)),
            markerScale: 1.5,
          });
        }
      }
    }

    if (prefs.overlays.meteorWireframes) {
      for (const meteor of frame.meteors) {
        addLineSystem(
          scene,
          `dbgMeteor_${meteor.id}`,
          buildSphereWireframeLines(meteor.position, meteor.radius, 16),
          new Color3(0.85, 0.5, 0.3),
          this.lineMeshes
        );
        if (labelsOn && prefs.labels.meteors) {
          labelSpecs.push({
            id: `mtr_${meteor.id}`,
            category: 'meteor',
            text: meteor.id,
            position: meteor.position.add(new Vector3(0, meteor.radius + 3, 0)),
          });
        }
      }
    }

    if (labelsOn) {
      this.labels.render(scene, labelSpecs);
    }
  }

  dispose(): void {
    this.clear();
  }

  private clear(): void {
    for (const mesh of this.lineMeshes) {
      mesh.dispose();
    }
    this.lineMeshes = [];
    this.labels.clear();
  }
}
