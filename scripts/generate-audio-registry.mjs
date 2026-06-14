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