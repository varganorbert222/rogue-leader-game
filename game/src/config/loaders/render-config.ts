/**
 * Render / post-process tuning (`data/render.json`).
 *
 * - `bloom.weight`, `threshold`, … → global post-process bloom
 * - `bloom.projectiles.strength` → projectile emissive multiplier (sole glow knob)
 * - `bloom.emissive.strength` → ship emissive PBR multiplier
 *
 * Weapon colors and shapes live in `data/weapons/manifest.json` only.
 */
export interface BloomSourceStrength {
  strength: number;
}

export interface BloomConfig {
  enabled: boolean;
  weight: number;
  threshold: number;
  kernel: number;
  scale: number;
  projectiles: BloomSourceStrength;
  emissive: BloomSourceStrength;
}

export interface RenderConfig {
  bloom: BloomConfig;
}

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  bloom: {
    enabled: true,
    weight: 0.45,
    threshold: 0.55,
    kernel: 64,
    scale: 0.5,
    projectiles: { strength: 1.35 },
    emissive: { strength: 1.25 },
  },
};

export async function loadRenderConfig(url: string): Promise<RenderConfig> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load render config: ${url}`);
  const json = (await res.json()) as Partial<{
    bloom: Partial<BloomConfig> & {
      projectiles?: Partial<BloomSourceStrength>;
      emissive?: Partial<BloomSourceStrength>;
    };
  }>;
  return {
    bloom: {
      ...DEFAULT_RENDER_CONFIG.bloom,
      ...json.bloom,
      projectiles: {
        ...DEFAULT_RENDER_CONFIG.bloom.projectiles,
        ...json.bloom?.projectiles,
      },
      emissive: {
        ...DEFAULT_RENDER_CONFIG.bloom.emissive,
        ...json.bloom?.emissive,
      },
    },
  };
}
