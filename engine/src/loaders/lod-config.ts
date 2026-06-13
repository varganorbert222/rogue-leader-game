/** Per-level LOD source — manual GLB path or auto-generated simplification quality (0–1). */
export type LodLevelDef =
  | string
  | { path: string }
  | { auto: number };

export interface LodConfig {
  /** `none` = single mesh, no LOD switching (cull only). */
  mode?: 'manual' | 'auto' | 'mixed' | 'none';
  /** Ordered manual GLB paths (legacy / shorthand). */
  paths?: string[];
  /** Mixed manual + auto levels; overrides `paths` when set. */
  levels?: LodLevelDef[];
  /** Switch to next lower LOD when screen coverage drops below each value (%). Unity-style. */
  screenThresholds?: number[];
  /** Hide mesh when screen coverage drops below this % (default 2). */
  cullScreenPercent?: number;
  /** Base GLB when `mode` is `none` or full-auto (defaults to first `paths` entry). */
  basePath?: string;
  /** Qualities for auto-generated levels after base (full-auto / opt-in simplify). */
  autoQualities?: number[];
  /** Probe `_LOD1`, `_LOD2`, … siblings when only LOD0 is listed (default true). */
  discoverSiblingLods?: boolean;
  /** Generate simplified LODs from LOD0 when no manual `_LODX` files exist (opt-in). */
  enableAutoSimplify?: boolean;
}

export type LodManifestValue = string[] | LodConfig;

export interface ResolvedLodLevel {
  kind: 'manual' | 'auto';
  path?: string;
  quality?: number;
}

export interface ResolvedLodPlan {
  mode: 'manual' | 'auto' | 'mixed' | 'none';
  levels: ResolvedLodLevel[];
  screenThresholds: number[];
  cullScreenPercent: number;
  discoverSiblingLods: boolean;
  enableAutoSimplify: boolean;
  autoQualities: number[];
}

export const DEFAULT_CULL_SCREEN_PERCENT = 2;

const DEFAULT_AUTO_QUALITIES = [0.55, 0.3, 0.12];

function parseLevelDef(def: LodLevelDef): ResolvedLodLevel {
  if (typeof def === 'string') {
    return { kind: 'manual', path: def };
  }
  if ('path' in def) {
    return { kind: 'manual', path: def.path };
  }
  return { kind: 'auto', quality: def.auto };
}

/** Unity-like default transition heights for N LOD groups (length N − 1, descending). */
export function defaultScreenThresholds(levelCount: number): number[] {
  if (levelCount <= 1) return [];
  const thresholds: number[] = [];
  for (let i = 0; i < levelCount - 1; i++) {
    thresholds.push(60 * Math.pow(0.45, i));
  }
  return thresholds;
}

export function resolveLodPlan(lod: LodManifestValue | undefined): ResolvedLodPlan {
  if (!lod) {
    return {
      mode: 'none',
      levels: [],
      screenThresholds: [],
      cullScreenPercent: DEFAULT_CULL_SCREEN_PERCENT,
      discoverSiblingLods: true,
      enableAutoSimplify: false,
      autoQualities: DEFAULT_AUTO_QUALITIES,
    };
  }

  if (Array.isArray(lod)) {
    const levels = lod.map((path) => ({ kind: 'manual' as const, path }));
    return {
      mode: 'manual',
      levels,
      screenThresholds: defaultScreenThresholds(levels.length),
      cullScreenPercent: DEFAULT_CULL_SCREEN_PERCENT,
      discoverSiblingLods: true,
      enableAutoSimplify: false,
      autoQualities: DEFAULT_AUTO_QUALITIES,
    };
  }

  const cullScreenPercent = lod.cullScreenPercent ?? DEFAULT_CULL_SCREEN_PERCENT;
  const mode = lod.mode ?? 'manual';
  const discoverSiblingLods = lod.discoverSiblingLods ?? true;
  const autoQualities = lod.autoQualities ?? DEFAULT_AUTO_QUALITIES;
  const enableAutoSimplify = lod.enableAutoSimplify ?? mode === 'auto';

  if (mode === 'none') {
    const basePath = lod.basePath ?? lod.paths?.[0];
    const levels = basePath ? [{ kind: 'manual' as const, path: basePath }] : [];
    return {
      mode: 'none',
      levels,
      screenThresholds: [],
      cullScreenPercent,
      discoverSiblingLods,
      enableAutoSimplify: lod.enableAutoSimplify ?? false,
      autoQualities,
    };
  }

  if (lod.levels?.length) {
    const levels = lod.levels.map(parseLevelDef);
    const hasAuto = levels.some((l) => l.kind === 'auto');
    const hasManual = levels.some((l) => l.kind === 'manual');
    const resolvedMode =
      mode === 'mixed' || mode === 'auto' || mode === 'manual'
        ? hasAuto && hasManual
          ? 'mixed'
          : hasAuto
            ? 'auto'
            : 'manual'
        : hasAuto && hasManual
          ? 'mixed'
          : hasAuto
            ? 'auto'
            : 'manual';

    return {
      mode: resolvedMode,
      levels,
      screenThresholds: lod.screenThresholds ?? defaultScreenThresholds(levels.length),
      cullScreenPercent,
      discoverSiblingLods,
      enableAutoSimplify,
      autoQualities,
    };
  }

  if (mode === 'auto') {
    const basePath = lod.basePath ?? lod.paths?.[0];
    if (!basePath) {
      return {
        mode: 'none',
        levels: [],
        screenThresholds: [],
        cullScreenPercent,
        discoverSiblingLods,
        enableAutoSimplify: false,
        autoQualities,
      };
    }
    const qualities = lod.autoQualities ?? DEFAULT_AUTO_QUALITIES;
    const levels: ResolvedLodLevel[] = [
      { kind: 'manual', path: basePath },
      ...qualities.map((quality) => ({ kind: 'auto' as const, quality })),
    ];
    return {
      mode: 'auto',
      levels,
      screenThresholds: lod.screenThresholds ?? defaultScreenThresholds(levels.length),
      cullScreenPercent,
      discoverSiblingLods,
      enableAutoSimplify: true,
      autoQualities: qualities,
    };
  }

  const paths = lod.paths ?? (lod.basePath ? [lod.basePath] : []);
  const levels = paths.map((path) => ({ kind: 'manual' as const, path }));
  return {
    mode: 'manual',
    levels,
    screenThresholds: lod.screenThresholds ?? defaultScreenThresholds(levels.length),
    cullScreenPercent,
    discoverSiblingLods,
    enableAutoSimplify: lod.enableAutoSimplify ?? false,
    autoQualities,
  };
}
