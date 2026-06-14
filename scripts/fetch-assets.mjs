#!/usr/bin/env node
/**
 * Download the release assets zip and extract into ./assets/
 * Config: scripts/fetch-assets.config.json (override: ASSETS_ZIP_URL env)
 * Run: npm run assets:fetch
 */
import { execFileSync } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
} from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const ASSETS_DIR = path.join(REPO_ROOT, 'assets');
const CONFIG_PATH = path.join(__dirname, 'fetch-assets.config.json');

async function loadDownloadUrl() {
  const envUrl = process.env.ASSETS_ZIP_URL?.trim();
  if (envUrl) return envUrl;

  const raw = await readFile(CONFIG_PATH, 'utf8');
  const config = JSON.parse(raw);
  if (!config.url || typeof config.url !== 'string') {
    throw new Error(`Missing "url" in ${CONFIG_PATH}`);
  }
  return config.url;
}

async function downloadZip(url, destinationPath) {
  console.log(`Downloading ${url}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error('Download failed: empty response body');
  }

  await pipeline(response.body, createWriteStream(destinationPath));
  console.log(`Saved zip → ${destinationPath}`);
}

function extractZip(zipPath, destinationDir) {
  if (process.platform === 'win32') {
    const psZip = zipPath.replace(/'/g, "''");
    const psDest = destinationDir.replace(/'/g, "''");
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${psZip}' -DestinationPath '${psDest}' -Force`,
      ],
      { stdio: 'inherit' },
    );
    return;
  }

  execFileSync('unzip', ['-oq', zipPath, '-d', destinationDir], { stdio: 'inherit' });
}

async function resolveExtractedAssetsRoot(extractDir) {
  const names = await readdir(extractDir);
  if (names.length === 1 && names[0] === 'assets') {
    return path.join(extractDir, 'assets');
  }

  const assetMarkers = new Set(['models', 'audio', 'textures', 'terrain']);
  if (names.some((name) => assetMarkers.has(name))) {
    return extractDir;
  }

  for (const name of names) {
    const fullPath = path.join(extractDir, name);
    const info = await stat(fullPath);
    if (!info.isDirectory()) continue;
    const children = await readdir(fullPath);
    if (children.some((child) => assetMarkers.has(child))) {
      return fullPath;
    }
  }

  throw new Error(
    `Unrecognized zip layout in ${extractDir}. Expected an "assets/" folder or models/audio/textures at the top level.`,
  );
}

async function installAssets(sourceDir) {
  await mkdir(ASSETS_DIR, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'README.md') continue;
    const from = path.join(sourceDir, entry.name);
    const to = path.join(ASSETS_DIR, entry.name);
    await cp(from, to, { recursive: true, force: true });
  }
}

async function main() {
  const url = await loadDownloadUrl();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'rogue-leader-assets-'));
  const zipPath = path.join(tempRoot, 'assets.zip');
  const extractDir = path.join(tempRoot, 'extract');

  try {
    await downloadZip(url, zipPath);
    await mkdir(extractDir, { recursive: true });
    extractZip(zipPath, extractDir);

    const sourceDir = await resolveExtractedAssetsRoot(extractDir);
    console.log(`Installing assets from ${sourceDir}`);
    await installAssets(sourceDir);
    console.log(`Assets installed → ${ASSETS_DIR}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('[assets:fetch]', err instanceof Error ? err.message : err);
  process.exit(1);
});
