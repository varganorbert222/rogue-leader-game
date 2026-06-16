import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

spawn('npm', ['run', 'start', '--workspace=frontend'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
