import { Effect, type ParticleSystem } from '@babylonjs/core';

const SHADER_NAME = 'rogueParticleAlpha';
const FRAGMENT_KEY = `${SHADER_NAME}PixelShader`;

let shaderRegistered = false;

function registerAlphaParticleShader(): void {
  if (shaderRegistered) return;
  shaderRegistered = true;

  Effect.ShadersStore[FRAGMENT_KEY] = `
#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
varying vec2 vUV;
varying vec4 vColor;
uniform vec4 textureMask;
uniform float useAlphaCutoff;
uniform float alphaCutoff;
uniform sampler2D diffuseSampler;
#include<clipPlaneFragmentDeclaration>
#include<imageProcessingDeclaration>
#include<logDepthDeclaration>
#include<helperFunctions>
#include<imageProcessingFunctions>
#include<fogFragmentDeclaration>
void main(void) {
#include<clipPlaneFragment>
  vec4 textureColor = texture2D(diffuseSampler, vUV);
  vec4 baseColor = (textureColor * textureMask + (vec4(1., 1., 1., 1.) - textureMask)) * vColor;
  baseColor.a = textureColor.a * textureMask.a * vColor.a;
  if (useAlphaCutoff > 0.5 && baseColor.a < alphaCutoff) {
    discard;
  }
#include<logDepthFragment>
#include<fogFragment>(color, baseColor)
#ifdef IMAGEPROCESSINGPOSTPROCESS
  baseColor.rgb = toLinearSpace(baseColor.rgb);
#endif
  gl_FragColor = baseColor;
}
`;
}

export function applyAlphaBlendParticleEffect(
  ps: ParticleSystem,
  alphaCutoff: number | null,
): void {
  const scene = ps.getScene();
  if (!scene) return;

  registerAlphaParticleShader();

  const defines: string[] = [];
  ps.fillDefines(defines, ps.blendMode);

  const effect = scene.getEngine().createEffectForParticles(
    SHADER_NAME,
    ['useAlphaCutoff', 'alphaCutoff'],
    [],
    defines.join('\n'),
    undefined,
    undefined,
    undefined,
    ps,
  );

  effect.onBind = (effectInstance) => {
    effectInstance.setFloat('useAlphaCutoff', alphaCutoff !== null ? 1 : 0);
    effectInstance.setFloat('alphaCutoff', alphaCutoff ?? 0);
  };

  ps.setCustomEffect(effect, ps.blendMode);
}
