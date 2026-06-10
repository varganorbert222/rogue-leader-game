import { Matrix, Vector3, type Scene } from '@babylonjs/core';

export interface HudScreenPoint {
  xPct: number;
  yPct: number;
  visible: boolean;
}

export function projectWorldToScreen(
  scene: Scene,
  worldPos: Vector3
): HudScreenPoint {
  const camera = scene.activeCamera;
  if (!camera) {
    return { xPct: 50, yPct: 50, visible: false };
  }

  const engine = scene.getEngine();
  const renderW = engine.getRenderWidth();
  const renderH = engine.getRenderHeight();
  const transformMatrix = scene.getTransformMatrix();
  const viewport = camera.viewport.toGlobal(renderW, renderH);
  const projected = Vector3.Project(
    worldPos,
    Matrix.Identity(),
    transformMatrix,
    viewport
  );

  const visible = projected.z >= 0 && projected.z <= 1;
  return {
    xPct: (projected.x / renderW) * 100,
    yPct: (projected.y / renderH) * 100,
    visible,
  };
}
