#!/usr/bin/env node
/**
 * Scans assets/audio/sfx and writes data/audio/sfx/registry.json with clip groups.
 * Prefers .wav over .ogg over .mp3 when multiple formats share a stem.
 * Run: npm run audio:registry
 */
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SFX_ROOT = path.join(__dirname, '../assets/audio/sfx');
const OUT_FILE = path.join(__dirname, '../data/audio/sfx/registry.json');

const FORMAT_PRIORITY = ['.wav', '.ogg', '.mp3'];

function groupKeyForFile(folderName, fileName) {
  const stem = fileName.replace(/\.[^.]+$/, '');
  const prefix = stem.replace(/_\d+$/, '');
  return `${folderName}/${prefix}`;
}

async function walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function pickPreferredFormat(files) {
  const byStem = new Map();
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const stem = path.basename(file, ext);
    const existing = byStem.get(stem);
    if (!existing) {
      byStem.set(stem, file);
      continue;
    }
    const existingExt = path.extname(existing).toLowerCase();
    if (FORMAT_PRIORITY.indexOf(ext) < FORMAT_PRIORITY.indexOf(existingExt)) {
      byStem.set(stem, file);
    }
  }
  return [...byStem.values()];
}

async function main() {
  const allFiles = await walkDir(SFX_ROOT);
  const groups = new Map();

  for (const fullPath of allFiles) {
    const rel = path.relative(SFX_ROOT, fullPath).replace(/\\/g, '/');
    const folder = path.dirname(rel);
    const fileName = path.basename(rel);
    const ext = path.extname(fileName).toLowerCase();
    if (!FORMAT_PRIORITY.includes(ext)) continue;

    const key = groupKeyForFile(folder === '.' ? path.basename(fileName, ext) : folder, fileName);
    const list = groups.get(key) ?? [];
    list.push(fullPath);
    groups.set(key, list);
  }

  const outputGroups = {};
  for (const [key, files] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const folder = key.includes('/') ? key.slice(0, key.indexOf('/')) : key;
    const chosen = pickPreferredFormat(files)
      .map((full) => path.basename(full))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    outputGroups[key] = {
      basePath: `audio/sfx/${folder}`,
      files: chosen,
    };
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    preferredFormats: FORMAT_PRIORITY,
    groups: outputGroups,
  };

  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${Object.keys(outputGroups).length} groups to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
