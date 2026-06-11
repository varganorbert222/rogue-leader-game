#!/usr/bin/env node
/**
 * Scans assets/audio/sfx and writes registry.json with clip groups.
 * Prefers .wav over .ogg over .mp3 when multiple formats share a stem.
 * Run: npm run audio:registry
 */
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SFX_ROOT = path.join(__dirname, '../assets/audio/sfx');
const OUT_FILE = path.join(SFX_ROOT, 'registry.json');
const FORMAT_RANK = ['.wav', '.ogg', '.mp3'];
const IGNORE = new Set(['registry.json', '.gitkeep']);

function rankExt(ext) {
  const i = FORMAT_RANK.indexOf(ext.toLowerCase());
  return i >= 0 ? i : 99;
}

function stem(filename) {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(0, dot) : filename;
}

function classify(folder, filename) {
  const s = filename.toLowerCase();
  switch (folder) {
    case 'asteroid':
      return 'asteroid/explosion';
    case 'bullet':
      if (s.includes('_hit_') || s.includes('_hit.')) return 'bullet/hit';
      if (s.includes('_whoosh_') || s.includes('whoosh')) return 'bullet/whoosh';
      return null;
    case 'cannon':
      if (s.startsWith('rebel_cannon')) return 'cannon/rebel';
      if (s.startsWith('imperial_cannon')) return 'cannon/imperial';
      return null;
    case 'rebel_cannon':
      if (s.startsWith('rebel_cannon')) return 'cannon/rebel';
      if (s.startsWith('imperial_cannon')) return 'cannon/imperial';
      return null;
    case 'explosion':
      if (s.startsWith('fighter_explosion')) return 'explosion/fighter';
      return null;
    case 'projectile':
    case 'missile':
      if (s.startsWith('missile_hit') || s.includes('proton') || s.includes('torpedo')) {
        return 'projectile/missile_hit';
      }
      return null;
    case 'tie_fighter':
      if (s.includes('engine')) return 'tie_fighter/engine';
      if (s.includes('inbound')) return 'tie_fighter/inbound';
      return null;
    case 'xwing':
      if (s.includes('engine')) return 'xwing/engine';
      if (s.includes('inbound')) return 'xwing/inbound';
      if (s.includes('sfoil')) return 'xwing/sfoil';
      return null;
    case 'ui':
      return `ui/${stem(filename)}`;
    default:
      return null;
  }
}

async function scanFolder(folder) {
  const dir = path.join(SFX_ROOT, folder);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && !IGNORE.has(e.name))
    .map((e) => ({ folder, name: e.name }));
}

function dedupeByStem(files) {
  const byStem = new Map();
  for (const file of files) {
    const s = stem(file);
    const ext = file.slice(file.lastIndexOf('.'));
    const prev = byStem.get(s);
    if (!prev || rankExt(ext) < rankExt(prev.ext)) {
      byStem.set(s, { file, ext });
    }
  }
  return [...byStem.values()].map((v) => v.file).sort();
}

async function main() {
  const top = await readdir(SFX_ROOT, { withFileTypes: true });
  const folders = top.filter((e) => e.isDirectory()).map((e) => e.name);

  const grouped = new Map();
  for (const folder of folders) {
    const files = await scanFolder(folder);
    for (const { folder: f, name } of files) {
      const groupId = classify(f, name);
      if (!groupId) continue;
      const list = grouped.get(groupId) ?? [];
      list.push(name);
      grouped.set(groupId, list);
    }
  }

  const groups = {};
  for (const [groupId, files] of grouped.entries()) {
    const folder = groupId.split('/')[0];
    groups[groupId] = {
      basePath: `audio/sfx/${folder}`,
      files: dedupeByStem(files),
    };
  }

  const registry = {
    version: 1,
    generatedAt: new Date().toISOString(),
    preferredFormats: FORMAT_RANK,
    groups,
  };

  await writeFile(OUT_FILE, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${Object.keys(groups).length} clip groups → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
