import type { CockpitConfig, CockpitInputResponseConfig, ResolvedCockpitConfig } from '../loaders/cockpit-config';
import {
  DEFAULT_COCKPIT_CONFIG,
  DEFAULT_COCKPIT_FOV_DEG,
  DEFAULT_COCKPIT_INPUT_RESPONSE,
  resolveCockpitConfig,
  suggestCockpitModelPath,
} from '../loaders/cockpit-config';
import { degToRad, radToDeg } from '../math';
import type { AssetManifest, ShipManifestEntry } from '../loaders/asset-manifest';
import type { LodEditorModelEntry } from './lod-editor-types';

export interface CockpitEditableInputResponse {
  maxInputOffsetRight: number;
  maxInputOffsetUp: number;
  maxInputOffsetBack: number;
  smoothTime: number;
}

export interface CockpitEditableConfig {
  localOffset: [number, number, number];
  localRotationDeg: [number, number, number];
  lookYawLimitDeg: number;
  lookPitchLimitDeg: number;
  fovDeg: number;
  modelPath: string;
  inputResponse: CockpitEditableInputResponse;
}

export interface CockpitPreviewMotion {
  pitchRate: number;
  yawRate: number;
  thrust: number;
}

function inputResponseToEditable(
  inputResponse: CockpitInputResponseConfig,
): CockpitEditableInputResponse {
  return {
    maxInputOffsetRight: inputResponse.maxInputOffset[0],
    maxInputOffsetUp: inputResponse.maxInputOffset[1],
    maxInputOffsetBack: inputResponse.maxInputOffset[2],
    smoothTime: inputResponse.smoothTime,
  };
}

function inputResponseFromEditable(
  editable: CockpitEditableInputResponse,
): CockpitInputResponseConfig {
  return {
    maxInputOffset: [
      editable.maxInputOffsetRight,
      editable.maxInputOffsetUp,
      editable.maxInputOffsetBack,
    ],
    smoothTime: editable.smoothTime,
  };
}

export function listCockpitEditorShips(manifest: AssetManifest): LodEditorModelEntry[] {
  return Object.entries(manifest.ships)
    .map(([id, ship]) => ({
      id,
      kind: 'ship' as const,
      label: `Ship · ${id}`,
      scale: ship.scale,
      lod: ship.lod,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function cockpitManifestToEditable(
  entry: ShipManifestEntry,
): CockpitEditableConfig {
  const resolved = resolveCockpitConfig(entry) ?? DEFAULT_COCKPIT_CONFIG;
  return {
    localOffset: [...resolved.localOffset],
    localRotationDeg: [...resolved.localRotationDeg],
    lookYawLimitDeg: radToDeg(resolved.lookLimits.yaw),
    lookPitchLimitDeg: radToDeg(resolved.lookLimits.pitch),
    fovDeg: radToDeg(resolved.fov),
    modelPath: resolved.modelPath ?? suggestCockpitModelPath(entry) ?? '',
    inputResponse: inputResponseToEditable(resolved.inputResponse),
  };
}

export function editableToResolvedCockpitConfig(
  editable: CockpitEditableConfig,
): ResolvedCockpitConfig {
  return {
    localOffset: [...editable.localOffset],
    localRotationDeg: [...editable.localRotationDeg],
    lookLimits: {
      yaw: degToRad(editable.lookYawLimitDeg),
      pitch: degToRad(editable.lookPitchLimitDeg),
    },
    fov: degToRad(editable.fovDeg),
    inputResponse: inputResponseFromEditable(editable.inputResponse),
    modelPath: editable.modelPath.trim() || null,
  };
}

export function editableToManifestCockpit(editable: CockpitEditableConfig): CockpitConfig {
  const manifest: CockpitConfig = {
    localOffset: [...editable.localOffset],
    localRotationDeg: [...editable.localRotationDeg],
    lookLimits: {
      yaw: degToRad(editable.lookYawLimitDeg),
      pitch: degToRad(editable.lookPitchLimitDeg),
    },
    fov: degToRad(editable.fovDeg),
    inputResponse: inputResponseFromEditable(editable.inputResponse),
  };
  if (editable.modelPath.trim()) {
    manifest.modelPath = editable.modelPath.trim();
  }
  return manifest;
}

export function defaultCockpitEditable(entry: ShipManifestEntry): CockpitEditableConfig {
  if (entry.cockpit) {
    return cockpitManifestToEditable(entry);
  }
  const resolved = DEFAULT_COCKPIT_CONFIG;
  return {
    localOffset: [...resolved.localOffset],
    localRotationDeg: [...resolved.localRotationDeg],
    lookYawLimitDeg: radToDeg(resolved.lookLimits.yaw),
    lookPitchLimitDeg: radToDeg(resolved.lookLimits.pitch),
    fovDeg: DEFAULT_COCKPIT_FOV_DEG,
    modelPath: suggestCockpitModelPath(entry) ?? '',
    inputResponse: inputResponseToEditable(DEFAULT_COCKPIT_INPUT_RESPONSE),
  };
}

/** Map preview WASD motion rates to normalized stick for cockpit offset. */
export function previewMotionToVehicleInput(motion: CockpitPreviewMotion) {
  const STICK_RATE = 0.9;
  return {
    pitch: Math.max(-1, Math.min(1, motion.pitchRate / STICK_RATE)),
    yaw: Math.max(-1, Math.min(1, motion.yawRate / STICK_RATE)),
    throttle: Math.max(-1, Math.min(1, motion.thrust)),
    roll: 0,
  };
}
