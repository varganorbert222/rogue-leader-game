import { Effect, type ParticleSystem } from '@babylonjs/core';
import type { Vec3Editable } from '../../shared/editable-primitives';
import { resolveUrlParticleTexture } from '../textures/resolver';

const SHADER_NAME = 'rogueParticleEmission';
const FRAGMENT_KEY = `${SHADER_NAME}PixelShader`;

let shaderRegistered = false;

function registerEmissionParticleShader(): void {
  if (shaderRegistered) return;
  shaderRegistered = true;

  Effect.ShadersStore[FRAGMENT_KEY] = `
#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
varying vec2 vUV;
varying vec4 vColor;
uniform vec4 textureMask;
uniform vec3 emissionTint;
uniform float useEmissionMap;
uniform sampler2D diffuseSampler;
uniform sampler2D emissionSampler;
#include<clipPlaneFragmentDeclaration>
#include<imageProcessingDeclaration>
#include<logDepthDeclaration>
#include<helperFunctions>
#include<imageProcessingFunctions>
#include<fogFragmentDeclaration>
void main(void) {
#include<clipPlaneFragment>
  vec4 albedoSample = texture2D(diffuseSampler, vUV);
  vec4 emissionSample = texture2D(emissionSampler, vUV) * vec4(emissionTint, 1.0);
  vec4 textureColor = albedoSample + emissionSample * useEmissionMap;
  vec4 baseColor = (textureColor * textureMask + (vec4(1., 1., 1., 1.) - textureMask)) * vColor;
#ifdef BLENDMULTIPLYMODE
  float sourceAlpha = vColor.a * textureColor.a;
  baseColor.rgb = baseColor.rgb * sourceAlpha + vec3(1.0) * (1.0 - sourceAlpha);
#endif
#include<logDepthFragment>
#include<fogFragment>(color, baseColor)
#ifdef IMAGEPROCESSINGPOSTPROCESS
  baseColor.rgb = toLinearSpace(baseColor.rgb);
#endif
  gl_FragColor = baseColor;
}
`;
}

export interface ParticleEmissionEffectBinding {
  emissionTint: Vec3Editable;
  emissionTextureUrl: string | null;
}

export function applyParticleEmissionEffect(
  ps: ParticleSystem,
  binding: ParticleEmissionEffectBinding,
): void {
  const scene = ps.getScene();
  if (!scene) return;

  if (!binding.emissionTextureUrl) {
    ps.setCustomEffect(null, ps.blendMode);
    return;
  }

  registerEmissionParticleShader();

  const defines: string[] = [];
  ps.fillDefines(defines, ps.blendMode);

  const effect = scene.getEngine().createEffectForParticles(
    SHADER_NAME,
    ['emissionTint', 'useEmissionMap'],
    ['emissionSampler'],
    defines.join('\n'),
    undefined,
    undefined,
    undefined,
    ps,
  );

  const emissionTexture = resolveUrlParticleTexture(scene, binding.emissionTextureUrl);
  const tint = binding.emissionTint;

  effect.onBind = (effectInstance) => {
    effectInstance.setFloat3('emissionTint', tint.x, tint.y, tint.z);
    effectInstance.setFloat('useEmissionMap', emissionTexture ? 1 : 0);
    if (emissionTexture) {
      effectInstance.setTexture('emissionSampler', emissionTexture);
    }
  };

  ps.setCustomEffect(effect, ps.blendMode);
}

/** Apply HDR emission tint via textureMask when no emission map shader is active. */
export function applyParticleEmissionTint(
  ps: ParticleSystem,
  color: Vec3Editable,
  useHdrMask: boolean,
): void {
  if (!useHdrMask) {
    ps.textureMask.set(1, 1, 1, 1);
    return;
  }
  ps.textureMask.set(color.x, color.y, color.z, 1);
}
