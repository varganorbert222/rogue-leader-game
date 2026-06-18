import { nextParticleSystemId } from './defaults';
import { normalizeParticleSystem } from './system-normalize';
import {
  findSlotInEffect,
  serializeEffectTree,
  syncEffectSystemsFromTree,
  walkTree,
} from './tree';
import type {
  ParticleEffectEditable,
  ParticleEffectTreeNode,
  ParticlePresetEntry,
  ParticlePresetRef,
  ParticlePresetRefMode,
  ParticleSystemEditable,
  ParticleSystemSlot,
} from './types';
export function isParticlePresetRef(value: unknown): value is ParticlePresetRef {
  if (!value || typeof value !== 'object') return false;
  const ref = value as ParticlePresetRef;
  return (
    typeof ref.presetId === 'string' &&
    typeof ref.systemId === 'string' &&
    (ref.mode === 'readonly' || ref.mode === 'edit')
  );
}

export function isParticleSystemSlot(value: unknown): value is ParticleSystemSlot {
  if (!value || typeof value !== 'object') return false;
  const slot = value as ParticleSystemSlot;
  if (typeof slot.id !== 'string' || typeof slot.name !== 'string') return false;
  if (slot.presetRef !== undefined && !isParticlePresetRef(slot.presetRef)) return false;
  return slot.presetRef !== undefined || slot.config !== undefined;
}

export function normalizeParticleSystemSlot(raw: unknown): ParticleSystemSlot {
  if (isParticleSystemSlot(raw)) {
    const slot = raw;
    return {
      id: slot.id,
      name: slot.name,
      presetRef: slot.presetRef
        ? {
            presetId: slot.presetRef.presetId,
            systemId: slot.presetRef.systemId,
            mode: slot.presetRef.mode,
          }
        : undefined,
      config: slot.config ? normalizeParticleSystem(slot.config) : undefined,
    };
  }

  const legacy = raw as Partial<ParticleSystemEditable> & { name?: string };
  const config = normalizeParticleSystem({
    ...legacy,
    name: legacy.name ?? 'Particle System',
  });
  return {
    id: config.id,
    name: config.name,
    config,
  };
}

export function serializeParticleSystemSlot(slot: ParticleSystemSlot): ParticleSystemSlot {
  if (slot.presetRef) {
    return {
      id: slot.id,
      name: slot.name,
      presetRef: { ...slot.presetRef },
    };
  }
  return {
    id: slot.id,
    name: slot.name,
    config: slot.config ? { ...slot.config } : undefined,
  };
}

export function serializeParticleEffect(effect: ParticleEffectEditable): ParticleEffectEditable {
  return {
    id: effect.id,
    name: effect.name,
    tree: serializeEffectTree(effect.tree),
    systems: [],
  };
}
export function serializeParticlePreset(preset: ParticlePresetEntry): ParticlePresetEntry {
  return {
    id: preset.id,
    label: preset.label,
    effect: serializeParticleEffect(preset.effect),
  };
}

function findCatalogSlot(
  catalog: readonly ParticlePresetEntry[],
  presetId: string,
  systemId: string,
): ParticleSystemSlot | null {
  const preset = catalog.find((entry) => entry.id === presetId);
  if (!preset) return null;

  let found: ParticleSystemSlot | null = null;
  walkTree(preset.effect.tree, (node) => {
    if (node.kind === 'particleSystem' && node.id === systemId && node.slot) {
      found = node.slot;
    }
  });
  return found;
}

/** Resolve a slot to editable particle config (follows reference chain). */
export function resolveParticleSystemSlot(
  slot: ParticleSystemSlot,
  catalog: readonly ParticlePresetEntry[],
  visiting = new Set<string>(),
): ParticleSystemEditable | null {
  if (slot.config && !slot.presetRef) {
    return { ...slot.config, id: slot.id, name: slot.name };
  }

  if (!slot.presetRef) {
    return slot.config ? { ...slot.config, id: slot.id, name: slot.name } : null;
  }

  const visitKey = `${slot.presetRef.presetId}:${slot.presetRef.systemId}`;
  if (visiting.has(visitKey)) return null;
  visiting.add(visitKey);

  const source = findCatalogSlot(catalog, slot.presetRef.presetId, slot.presetRef.systemId);
  if (!source) return null;

  const resolved = resolveParticleSystemSlot(source, catalog, visiting);
  if (!resolved) return null;

  return {
    ...resolved,
    id: slot.id,
    name: slot.name,
  };
}

export function resolveParticleEffect(
  effect: ParticleEffectEditable,
  catalog: readonly ParticlePresetEntry[],
): ParticleSystemEditable[] {
  const resolved: ParticleSystemEditable[] = [];
  for (const slot of effect.systems) {
    const config = resolveParticleSystemSlot(slot, catalog);
    if (config) resolved.push(config);
  }
  return resolved;
}

export function findSlotById(
  effect: ParticleEffectEditable,
  slotId: string,
): ParticleSystemSlot | null {
  return findSlotInEffect(effect, slotId);
}
export function isSlotReadonlyRef(slot: ParticleSystemSlot): boolean {
  return slot.presetRef?.mode === 'readonly';
}

export function isSlotEditRef(slot: ParticleSystemSlot): boolean {
  return slot.presetRef?.mode === 'edit';
}

export function createInlineSlot(config?: ParticleSystemEditable): ParticleSystemSlot {
  const system = config ?? normalizeParticleSystem({ name: 'Particle System' });
  return {
    id: system.id,
    name: system.name,
    config: system,
  };
}

export function createPresetRefSlot(
  presetId: string,
  systemId: string,
  mode: ParticlePresetRefMode,
  catalog: readonly ParticlePresetEntry[],
  name?: string,
): ParticleSystemSlot | null {
  const source = findCatalogSlot(catalog, presetId, systemId);
  if (!source) return null;

  return {
    id: nextParticleSystemId(),
    name: name ?? source.name,
    presetRef: { presetId, systemId, mode },
  };
}

export function cloneSlotAsInstance(
  slot: ParticleSystemSlot,
  catalog: readonly ParticlePresetEntry[],
): ParticleSystemSlot | null {
  const resolved = resolveParticleSystemSlot(slot, catalog);
  if (!resolved) return null;

  const copy = normalizeParticleSystem({
    ...JSON.parse(JSON.stringify(resolved)) as ParticleSystemEditable,
    id: nextParticleSystemId(),
    name: `${resolved.name} Copy`,
  });

  return {
    id: copy.id,
    name: copy.name,
    config: copy,
  };
}

export interface CatalogSystemOption {
  presetId: string;
  presetLabel: string;
  systemId: string;
  systemName: string;
  /** Full path inside the preset tree, e.g. `Group / Burst`. */
  modulePath: string;
  /** Display label, e.g. `Explosion › Burst`. */
  catalogLabel: string;
  /** Stable `${presetId}:${systemId}` key for pickers. */
  optionKey: string;
}

export function listCatalogSystemOptions(
  catalog: readonly ParticlePresetEntry[],
): CatalogSystemOption[] {
  const options: CatalogSystemOption[] = [];
  for (const preset of catalog) {
    listCatalogOptionsInTree(preset, preset.effect.tree, []);
  }
  return options;

  function listCatalogOptionsInTree(
    preset: ParticlePresetEntry,
    nodes: readonly ParticleEffectTreeNode[],
    ancestorNames: string[],
  ): void {
    for (const node of nodes) {
      const pathNames = [...ancestorNames, node.name];
      if (node.kind === 'particleSystem' && node.slot) {
        const modulePath = pathNames.join(' / ');
        options.push({
          presetId: preset.id,
          presetLabel: preset.label,
          systemId: node.id,
          systemName: node.slot.name,
          modulePath,
          catalogLabel: `${preset.label} › ${modulePath}`,
          optionKey: `${preset.id}:${node.id}`,
        });
      }
      if (node.children.length) {
        listCatalogOptionsInTree(preset, node.children, pathNames);
      }
    }
  }
}

function findInlineCatalogModule(
  catalog: readonly ParticlePresetEntry[],
  presetId: string,
  systemId: string,
  visiting = new Set<string>(),
): { preset: ParticlePresetEntry; node: ParticleEffectTreeNode } | null {
  const visitKey = `${presetId}:${systemId}`;
  if (visiting.has(visitKey)) return null;
  visiting.add(visitKey);

  const preset = catalog.find((entry) => entry.id === presetId);
  if (!preset) return null;

  let found: ParticleEffectTreeNode | undefined;
  walkTree(preset.effect.tree, (node) => {
    if (node.kind === 'particleSystem' && node.id === systemId) {
      found = node;
    }
  });
  if (!found || found.kind !== 'particleSystem') return null;
  const sourceSlot = found.slot;
  if (!sourceSlot) return null;

  if (sourceSlot.presetRef) {
    return findInlineCatalogModule(
      catalog,
      sourceSlot.presetRef.presetId,
      sourceSlot.presetRef.systemId,
      visiting,
    );
  }

  return { preset, node: found };
}

/** Write edited fields back to the catalog source preset (edit-mode refs only). */
export function writeEditRefToCatalog(
  slot: ParticleSystemSlot,
  config: ParticleSystemEditable,
  catalog: ParticlePresetEntry[],
): boolean {
  if (!slot.presetRef || slot.presetRef.mode !== 'edit') return false;

  const target = findInlineCatalogModule(
    catalog,
    slot.presetRef.presetId,
    slot.presetRef.systemId,
  );
  if (!target) return false;

  const { node, preset } = target;
  const sourceSlot = node.slot!;
  const normalized = normalizeParticleSystem({
    ...config,
    id: sourceSlot.config?.id ?? slot.presetRef.systemId,
    name: sourceSlot.name,
  });

  sourceSlot.config = normalized;
  node.name = sourceSlot.name;
  syncEffectSystemsFromTree(preset.effect);
  return true;
}

export function setSlotRefMode(slot: ParticleSystemSlot, mode: ParticlePresetRefMode): void {
  if (!slot.presetRef) return;
  slot.presetRef.mode = mode;
}
