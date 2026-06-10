async function assetExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (head.ok) return true;
  } catch {
    /* try GET fallback */
  }

  try {
    const get = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    return get.ok || get.status === 206;
  } catch {
    return false;
  }
}

/** Probe meteor_01.glb, meteor_02.glb, … until none match. */
export async function discoverNumberedGlbVariants(
  baseUrl: string,
  directory: string,
  prefix: string,
  pad = 2,
  maxProbe = 99
): Promise<string[]> {
  const found: string[] = [];
  const dir = directory.replace(/\/+$/, '');

  let consecutiveMisses = 0;
  for (let i = 1; i <= maxProbe; i++) {
    const suffix = String(i).padStart(pad, '0');
    const rel = `${dir}/${prefix}_${suffix}.glb`;
    const url = `${baseUrl}/${rel}`;
    if (await assetExists(url)) {
      found.push(rel);
      consecutiveMisses = 0;
    } else {
      consecutiveMisses++;
      if (found.length > 0 && consecutiveMisses >= 5) break;
    }
  }

  return found;
}
