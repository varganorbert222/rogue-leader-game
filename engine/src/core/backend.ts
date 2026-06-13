import { Engine, WebGPUEngine, type AbstractEngine } from '@babylonjs/core';
import '@babylonjs/core/Audio/audioEngine';

export type GraphicsBackend = 'WebGPU' | 'WebGL2';

const ENGINE_OPTIONS = {
  audioEngine: true,
  preserveDrawingBuffer: true,
  stencil: true,
} as const;

/** Try WebGPU first, fall back to WebGL2. */
export async function createGraphicsEngine(
  canvas: HTMLCanvasElement
): Promise<{ engine: AbstractEngine; backend: GraphicsBackend }> {
  try {
    const webgpuSupported = await WebGPUEngine.IsSupportedAsync;
    if (webgpuSupported) {
      const webgpu = new WebGPUEngine(canvas, {
        antialias: true,
        adaptToDeviceRatio: true,
        ...ENGINE_OPTIONS,
      });
      await webgpu.initAsync();
      console.info('[Graphics] WebGPU');
      return { engine: webgpu, backend: 'WebGPU' };
    }
  } catch (err) {
    console.warn('[Graphics] WebGPU init failed, using WebGL2', err);
  }

  const engine = new Engine(canvas, true, {
    ...ENGINE_OPTIONS,
    adaptToDeviceRatio: true,
  });
  console.info('[Graphics] WebGL2');
  return { engine, backend: 'WebGL2' };
}
