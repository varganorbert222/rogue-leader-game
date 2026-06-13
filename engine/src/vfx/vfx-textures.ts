import { Scene, Texture } from '@babylonjs/core';

const FLARE_URL = 'https://assets.babylonjs.com/textures/flare.png';

let flareTexture: Texture | null = null;

export function preloadVfxTextures(scene: Scene): Promise<void> {
  if (flareTexture) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    flareTexture = new Texture(
      FLARE_URL,
      scene,
      undefined,
      false,
      undefined,
      () => {
        flareTexture!.hasAlpha = true;
        resolve();
      },
      () => resolve()
    );
  });
}

export function getFlareTexture(scene: Scene): Texture {
  if (!flareTexture) {
    flareTexture = new Texture(FLARE_URL, scene);
  }
  flareTexture.hasAlpha = true;
  return flareTexture;
}
