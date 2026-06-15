export const HIERARCHY_GENERATED_META_KEY = 'hierarchyGenerated';

type MetadataNode = { metadata?: Record<string, unknown> | null };

/** Mark a Babylon node as runtime-generated (not from the source GLB hierarchy). */
export function markSceneNodeGenerated(node: MetadataNode): void {
  node.metadata = { ...(node.metadata ?? {}), [HIERARCHY_GENERATED_META_KEY]: true };
}

export function isGeneratedNodeName(name: string): boolean {
  const normalized = name.toLowerCase();
  if (normalized.endsWith('_visual')) return true;
  if (normalized.endsWith('_cockpit')) return true;
  if (normalized.startsWith('placeholder_')) return true;
  if (/_lod\d+_auto\b/i.test(name)) return true;
  if (/_lod\d+_fb\b/i.test(name)) return true;
  if (/_lod\d+_auto_fb\b/i.test(name)) return true;
  return false;
}

/** True when the node was created at runtime rather than imported from the source asset. */
export function isSceneNodeGenerated(node: MetadataNode & { name?: string }): boolean {
  if (node.metadata?.[HIERARCHY_GENERATED_META_KEY] === true) return true;
  const name = node.name ?? '';
  if (!name) return false;
  if (isGeneratedNodeName(name)) return true;
  return false;
}
