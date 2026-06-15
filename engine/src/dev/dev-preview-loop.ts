import type { Camera } from '@babylonjs/core';
import type { BabylonHost } from '../core/babylon-host';

export function startDevPreviewRenderLoop(
  host: BabylonHost,
  options: {
    onUpdate?: (dt: number) => void;
    getCamera?: () => Camera | null;
    updateAxisGizmo?: (camera: Camera) => void;
  },
): void {
  host.startRenderLoop((dt) => {
    options.onUpdate?.(dt);
    const camera = options.getCamera?.() ?? null;
    if (camera && options.updateAxisGizmo) {
      options.updateAxisGizmo(camera);
    }
  });
}
