/** Build sibling `_LODX` path from a LOD0 (or any `_LODn`) GLB path. */
export function buildSiblingLodPath(basePath: string, lodIndex: number): string | null {
  if (lodIndex < 0) return null;
  if (lodIndex === 0) return basePath;

  if (/_LOD\d+\b/i.test(basePath)) {
    return basePath.replace(/_LOD\d+\b/i, `_LOD${lodIndex}`);
  }

  if (/\.glb$/i.test(basePath)) {
    return basePath.replace(/\.glb$/i, `_LOD${lodIndex}.glb`);
  }

  return `${basePath}_LOD${lodIndex}`;
}

export async function discoverSiblingLodPaths(
  probe: (relativePath: string) => Promise<boolean>,
  lod0Path: string,
  maxLevels = 8,
): Promise<string[]> {
  const paths = [lod0Path];

  for (let index = 1; index < maxLevels; index++) {
    const candidate = buildSiblingLodPath(lod0Path, index);
    if (!candidate || candidate === lod0Path) break;
    if (!(await probe(candidate))) break;
    paths.push(candidate);
  }

  return paths;
}
