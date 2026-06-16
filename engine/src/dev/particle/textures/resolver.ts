import { Texture, type Scene } from '@babylonjs/core';
import type { ParticleAlbedoTextureEditable } from '../types';
import { resolveAlbedoTextureUrl, resolveParticleTextureUrlById } from './catalog';

const urlCache = new Map<string, Texture>();
const whiteTextureByScene = new WeakMap<Scene, Texture>();

const WHITE_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export function getWhiteParticleTexture(scene: Scene): Texture {
  let texture = whiteTextureByScene.get(scene);
  if (!texture) {
    texture = new Texture(WHITE_PIXEL, scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
    whiteTextureByScene.set(scene, texture);
  }
  return texture;
}

export function getCachedParticleTexture(scene: Scene, url: string): Texture {
  const key = `${scene.getUniqueId()}:${url}`;
  let texture = urlCache.get(key);
  if (!texture) {
    texture = new Texture(url, scene, undefined, false, undefined, undefined, undefined, url);
    texture.hasAlpha = true;
    urlCache.set(key, texture);
  }
  return texture;
}

export function resolveAlbedoParticleTexture(
  scene: Scene,
  albedo: ParticleAlbedoTextureEditable,
): Texture | null {
  const url = resolveAlbedoTextureUrl(albedo);
  if (!url) return null;
  return getCachedParticleTexture(scene, url);
}

export function resolveUrlParticleTexture(scene: Scene, url: string | null): Texture | null {
  if (!url) return null;
  return getCachedParticleTexture(scene, url);
}

export function resolveParticleTextureById(scene: Scene, textureId: string): Texture | null {
  const url = resolveParticleTextureUrlById(textureId);
  if (!url) return null;
  return getCachedParticleTexture(scene, url);
}

export function disposeParticleTextureCache(): void {
  for (const texture of urlCache.values()) {
    texture.dispose();
  }
  urlCache.clear();
}
