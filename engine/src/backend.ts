import { Engine, WebGPUEngine, type AbstractEngine } from '@babylonjs/core';

export type GraphicsBackend = 'WebGPU' | 'WebGL2';

/** Try WebGPU first, fall back to WebGL2. */
export async function createGraphicsEngine(
  canvas: HTMLCanvasElement
): Promise<{ engine: AbstractEngine; backend: GraphicsBackend }> {
  try {
    const webgpuSupported = await WebGPUEngine.IsSupportedAsync;
    if (webgpuSupported) {
      const webgpu = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true });
      await webgpu.initAsync();
      console.info('[Graphics] WebGPU');
      return { engine: webgpu, backend: 'WebGPU' };
    }
  } catch (err) {
    console.warn('[Graphics] WebGPU init failed, using WebGL2', err);
  }

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    adaptToDeviceRatio: true,
  });
  console.info('[Graphics] WebGL2');
  return { engine, backend: 'WebGL2' };
}
