import {
  Color3,
  Vector3,
  type AbstractMesh,
  type Scene,
} from "@babylonjs/core";
import type { NpcStateId } from "../config/npc-behavior-config";
import type { WeaponAimDebugInfo } from "../combat/weapon-aim-controller";
import type { NpcSteeringDebugInfo } from "../ai/behavior-npc-input";
import type { WanderZoneDefinition } from "../ai/navigation/nav-types";
import type { DebugPreferences } from "./debug-preferences";
import { DebugLabelLayer, type DebugLabelSpec } from "./debug-labels";
import { ColliderWireframeDebug } from "./collider-wireframe-debug";
import { LineSegmentCollector } from "./wireframe-primitives";
import { WireframeLinePool } from "./wireframe-line-pool";
import { WireframeShapePool } from "./wireframe-shape-pool";

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

export interface AsteroidDebugSnapshot {
  id: string;
  position: Vector3;
  radius: number;
  usesMeshCollider: boolean;
}

export type MeshWireframeEntityKind = "ship" | "asteroid";

export interface ColliderDebugSnapshot {
  ownerId: string;
  meshes: readonly AbstractMesh[];
  isPlayer: boolean;
  kind: MeshWireframeEntityKind;
}

export interface GameDebugFrame {
  playerAim?: WeaponAimDebugInfo;
  paths: { pathId: string; points: Vector3[] }[];
  zones: { zoneId: string; zone: WanderZoneDefinition }[];
  npcs: NpcDebugSnapshot[];
  vehicles: VehicleDebugSnapshot[];
  projectiles: ProjectileDebugSnapshot[];
  asteroids: AsteroidDebugSnapshot[];
  colliders: ColliderDebugSnapshot[];
}

const COLOR_NAV_PATH = new Color3(0.3, 0.75, 1);
const COLOR_NAV_WAYPOINT = new Color3(0.45, 0.95, 0.55);
const COLOR_WANDER_ZONE = new Color3(0.55, 0.35, 0.95);
const COLOR_PLAYER_AIM = new Color3(0.2, 1, 0.35);
const COLOR_PLAYER_AIM_TARGET = new Color3(1, 0.35, 0.2);
const COLOR_PLAYER_RADAR = new Color3(0.2, 0.9, 0.9);
const COLOR_PROJECTILE = new Color3(1, 0.8, 0.25);
const COLOR_ASTEROID = new Color3(0.85, 0.5, 0.3);
const COLOR_COLLIDER_PLAYER = new Color3(0.2, 1, 0.55);
const COLOR_COLLIDER_OTHER = new Color3(1, 0.45, 0.1);

const STATE_COLORS: Record<NpcStateId, Color3> = {
  patrol: new Color3(0.35, 0.85, 0.45),
  chase: new Color3(0.95, 0.85, 0.2),
  attack: new Color3(0.95, 0.25, 0.2),
};

function selectMeshWireframeColliders(
  frame: GameDebugFrame,
  prefs: DebugPreferences,
): ColliderDebugSnapshot[] {
  const showShips =
    prefs.overlays.vehicleWireframes || prefs.overlays.colliderWireframes;
  const showAsteroids =
    prefs.overlays.asteroidWireframes || prefs.overlays.colliderWireframes;

  return frame.colliders.filter((collider) => {
    if (collider.kind === "ship") return showShips;
    return showAsteroids;
  });
}

function meshWireframeOverlayEnabled(
  prefs: DebugPreferences,
  frame: GameDebugFrame | null,
): boolean {
  return (
    !!prefs.masterEnabled &&
    !!frame &&
    (prefs.overlays.colliderWireframes ||
      prefs.overlays.vehicleWireframes ||
      prefs.overlays.asteroidWireframes)
  );
}

export class GameDebugOverlay {
  private readonly linePool = new WireframeLinePool();
  private readonly shapePool = new WireframeShapePool();
  private readonly meshWireframes = new ColliderWireframeDebug();
  private readonly labels = new DebugLabelLayer();
  private readonly segmentCollector = new LineSegmentCollector();
  private readonly npcSteerByState = new Map<NpcStateId, LineSegmentCollector>();

  private cachedNavPathsKey = "";
  private cachedNavPathLines: Vector3[][] = [];
  private cachedNavWaypointsKey = "";
  private cachedNavWaypointLines: Vector3[][] = [];

  render(scene: Scene, frame: GameDebugFrame | null, prefs: DebugPreferences): void {
    const activeLineKeys = new Set<string>();
    const activeShapeKeys = new Set<string>();

    this.meshWireframes.sync(
      frame ? selectMeshWireframeColliders(frame, prefs) : [],
      meshWireframeOverlayEnabled(prefs, frame),
      { player: COLOR_COLLIDER_PLAYER, other: COLOR_COLLIDER_OTHER },
    );

    if (!prefs.masterEnabled || !frame) {
      this.linePool.releaseUnused(activeLineKeys);
      this.shapePool.releaseUnused(activeShapeKeys);
      this.labels.render(scene, []);
      return;
    }

    const labelSpecs: DebugLabelSpec[] = [];
    const labelsOn = prefs.labels.enabled;

    this.renderNavPaths(scene, frame, prefs, activeLineKeys, labelSpecs, labelsOn);
    this.renderNavWaypoints(scene, frame, prefs, activeLineKeys, labelSpecs, labelsOn);
    this.renderWanderZones(scene, frame, prefs, activeShapeKeys, labelSpecs, labelsOn);
    this.renderPlayerAim(scene, frame, prefs, activeLineKeys, activeShapeKeys);
    this.renderNpcOverlays(scene, frame, prefs, activeLineKeys, activeShapeKeys, labelSpecs, labelsOn);
    this.renderVehicleLabels(frame, prefs, labelSpecs, labelsOn);
    this.renderProjectiles(scene, frame, prefs, activeLineKeys, labelSpecs, labelsOn);
    this.renderAsteroidFallbacks(scene, frame, prefs, activeShapeKeys, labelSpecs, labelsOn);

    this.linePool.releaseUnused(activeLineKeys);
    this.shapePool.releaseUnused(activeShapeKeys);
    this.labels.render(scene, labelsOn ? labelSpecs : []);
  }

  dispose(): void {
    this.linePool.dispose();
    this.shapePool.dispose();
    this.meshWireframes.dispose();
    this.labels.clear();
    this.cachedNavPathsKey = "";
    this.cachedNavPathLines = [];
    this.cachedNavWaypointsKey = "";
    this.cachedNavWaypointLines = [];
  }

  private renderNavPaths(
    scene: Scene,
    frame: GameDebugFrame,
    prefs: DebugPreferences,
    activeKeys: Set<string>,
    labelSpecs: DebugLabelSpec[],
    labelsOn: boolean,
  ): void {
    if (!prefs.overlays.navPaths) return;

    const key = frame.paths
      .map((path) => `${path.pathId}:${path.points.length}`)
      .join("|");
    if (key !== this.cachedNavPathsKey) {
      this.cachedNavPathsKey = key;
      const lines: Vector3[][] = [];
      for (const path of frame.paths) {
        if (path.points.length < 2) continue;
        for (let i = 0; i < path.points.length - 1; i++) {
          lines.push([path.points[i], path.points[i + 1]]);
        }
        if (path.points.length > 2) {
          lines.push([
            path.points[path.points.length - 1],
            path.points[0],
          ]);
        }
      }
      this.cachedNavPathLines = lines;
    }

    this.linePool.set(scene, "batch_navPaths", this.cachedNavPathLines, COLOR_NAV_PATH, activeKeys);

    if (labelsOn && prefs.labels.navPaths) {
      for (const path of frame.paths) {
        if (path.points.length === 0) continue;
        labelSpecs.push({
          id: `path_${path.pathId}`,
          category: "navPath",
          text: path.pathId,
          position: path.points[0].add(new Vector3(0, 6, 0)),
        });
      }
    }
  }

  private renderNavWaypoints(
    scene: Scene,
    frame: GameDebugFrame,
    prefs: DebugPreferences,
    activeKeys: Set<string>,
    labelSpecs: DebugLabelSpec[],
    labelsOn: boolean,
  ): void {
    if (!prefs.overlays.navWaypoints) return;

    const key = frame.paths
      .map((path) => `${path.pathId}:${path.points.length}`)
      .join("|");
    if (key !== this.cachedNavWaypointsKey) {
      this.cachedNavWaypointsKey = key;
      const lines: Vector3[][] = [];
      for (const path of frame.paths) {
        for (const point of path.points) {
          lines.push([point, point.add(new Vector3(0, 12, 0))]);
          lines.push([
            point.add(new Vector3(-2, 0, 0)),
            point.add(new Vector3(2, 0, 0)),
          ]);
          lines.push([
            point.add(new Vector3(0, 0, -2)),
            point.add(new Vector3(0, 0, 2)),
          ]);
        }
      }
      this.cachedNavWaypointLines = lines;
    }

    this.linePool.set(
      scene,
      "batch_navWaypoints",
      this.cachedNavWaypointLines,
      COLOR_NAV_WAYPOINT,
      activeKeys,
    );

    if (labelsOn && prefs.labels.navWaypoints) {
      for (const path of frame.paths) {
        path.points.forEach((point, index) => {
          labelSpecs.push({
            id: `wp_${path.pathId}_${index}`,
            category: "navWaypoint",
            text: `${path.pathId} #${index + 1}`,
            position: point.add(new Vector3(0, 14, 0)),
            markerScale: 2,
          });
        });
      }
    }
  }

  private renderWanderZones(
    scene: Scene,
    frame: GameDebugFrame,
    prefs: DebugPreferences,
    activeKeys: Set<string>,
    labelSpecs: DebugLabelSpec[],
    labelsOn: boolean,
  ): void {
    if (!prefs.overlays.wanderZones3d) return;

    for (const entry of frame.zones) {
      const center = Vector3.FromArray(entry.zone.center);
      const shapeKey = `zone_${entry.zoneId}`;
      if (entry.zone.type === "cube") {
        this.shapePool.setBox(
          scene,
          shapeKey,
          center,
          Vector3.FromArray(entry.zone.halfExtents),
          COLOR_WANDER_ZONE,
          activeKeys,
        );
      } else {
        this.shapePool.setSphere(
          scene,
          shapeKey,
          center,
          entry.zone.radius,
          COLOR_WANDER_ZONE,
          activeKeys,
        );
      }

      if (labelsOn && prefs.labels.wanderZones) {
        labelSpecs.push({
          id: `zone_${entry.zoneId}`,
          category: "wanderZone",
          text: entry.zoneId,
          position: center.add(
            new Vector3(
              0,
              entry.zone.type === "sphere" ? entry.zone.radius + 4 : 8,
              0,
            ),
          ),
        });
      }
    }
  }

  private renderPlayerAim(
    scene: Scene,
    frame: GameDebugFrame,
    prefs: DebugPreferences,
    activeLineKeys: Set<string>,
    activeShapeKeys: Set<string>,
  ): void {
    if (!frame.playerAim) return;
    const aim = frame.playerAim;

    if (prefs.overlays.playerAimVectors) {
      this.linePool.set(
        scene,
        "batch_playerAim",
        [[aim.aimOrigin, aim.aimOrigin.add(aim.aimDirection.scale(60))]],
        COLOR_PLAYER_AIM,
        activeLineKeys,
      );

      if (aim.targetPosition) {
        this.linePool.set(
          scene,
          "batch_playerAimTarget",
          [[aim.aimOrigin, aim.targetPosition]],
          COLOR_PLAYER_AIM_TARGET,
          activeLineKeys,
        );
      }
    }

    if (prefs.overlays.playerRadarRing) {
      this.shapePool.setSphere(
        scene,
        "playerRadar",
        aim.aimOrigin,
        aim.radarRadius,
        COLOR_PLAYER_RADAR,
        activeShapeKeys,
      );
    }
  }

  private renderNpcOverlays(
    scene: Scene,
    frame: GameDebugFrame,
    prefs: DebugPreferences,
    activeLineKeys: Set<string>,
    activeShapeKeys: Set<string>,
    labelSpecs: DebugLabelSpec[],
    labelsOn: boolean,
  ): void {
    if (
      !prefs.overlays.npcSteeringVectors &&
      !prefs.overlays.npcRadarRings &&
      !(labelsOn && prefs.labels.npcActors)
    ) {
      return;
    }

    for (const collector of this.npcSteerByState.values()) {
      collector.clear();
    }

    for (const npc of frame.npcs) {
      const state = npc.steering.state;
      const color = STATE_COLORS[state] ?? Color3.White();

      if (prefs.overlays.npcSteeringVectors) {
        let steer = this.npcSteerByState.get(state);
        if (!steer) {
          steer = new LineSegmentCollector();
          this.npcSteerByState.set(state, steer);
        }
        steer.add(npc.position, npc.steering.steerTarget);
      }
      if (prefs.overlays.npcRadarRings) {
        this.shapePool.setSphere(
          scene,
          `npcRadar_${npc.id}`,
          npc.position,
          npc.radarRadius,
          color,
          activeShapeKeys,
        );
      }
      if (labelsOn && prefs.labels.npcActors) {
        labelSpecs.push({
          id: `npc_${npc.id}`,
          category: "npc",
          text: `${npc.id} · ${npc.steering.state} · ${npc.steering.mode}`,
          position: npc.position.add(new Vector3(0, 8, 0)),
        });
      }
    }

    if (prefs.overlays.npcSteeringVectors) {
      for (const [state, collector] of this.npcSteerByState) {
        const color = STATE_COLORS[state] ?? Color3.White();
        this.linePool.set(
          scene,
          `batch_npcSteer_${state}`,
          collector.lines,
          color,
          activeLineKeys,
        );
      }
    }
  }

  private renderVehicleLabels(
    frame: GameDebugFrame,
    prefs: DebugPreferences,
    labelSpecs: DebugLabelSpec[],
    labelsOn: boolean,
  ): void {
    if (!labelsOn || !prefs.labels.vehicles) return;
    if (!prefs.overlays.vehicleWireframes && !prefs.overlays.colliderWireframes) {
      return;
    }

    for (const vehicle of frame.vehicles) {
      const size = Math.max(4, vehicle.radius * 2);
      labelSpecs.push({
        id: `veh_${vehicle.id}`,
        category: "vehicle",
        text: vehicle.label,
        position: vehicle.position.add(new Vector3(0, size + 2, 0)),
      });
    }
  }

  private renderProjectiles(
    scene: Scene,
    frame: GameDebugFrame,
    prefs: DebugPreferences,
    activeKeys: Set<string>,
    labelSpecs: DebugLabelSpec[],
    labelsOn: boolean,
  ): void {
    if (!prefs.overlays.projectileGizmos) return;

    this.segmentCollector.clear();
    for (const projectile of frame.projectiles) {
      const tip = projectile.position.add(projectile.direction.scale(4));
      this.segmentCollector.add(projectile.position, tip);
      if (labelsOn && prefs.labels.projectiles) {
        labelSpecs.push({
          id: `prj_${projectile.id}`,
          category: "projectile",
          text: `${projectile.weaponId} (${projectile.team})`,
          position: projectile.position.add(new Vector3(0, 2, 0)),
          markerScale: 1.5,
        });
      }
    }

    this.linePool.set(
      scene,
      "batch_projectiles",
      this.segmentCollector.lines,
      COLOR_PROJECTILE,
      activeKeys,
    );
  }

  private renderAsteroidFallbacks(
    scene: Scene,
    frame: GameDebugFrame,
    prefs: DebugPreferences,
    activeKeys: Set<string>,
    labelSpecs: DebugLabelSpec[],
    labelsOn: boolean,
  ): void {
    if (!prefs.overlays.asteroidWireframes) return;

    for (const asteroid of frame.asteroids) {
      if (asteroid.usesMeshCollider) continue;
      this.shapePool.setSphere(
        scene,
        `asteroid_${asteroid.id}`,
        asteroid.position,
        asteroid.radius,
        COLOR_ASTEROID,
        activeKeys,
      );
      if (labelsOn && prefs.labels.asteroids) {
        labelSpecs.push({
          id: `ast_${asteroid.id}`,
          category: "asteroid",
          text: asteroid.id,
          position: asteroid.position.add(
            new Vector3(0, asteroid.radius + 3, 0),
          ),
        });
      }
    }
  }
}
