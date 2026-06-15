import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

/** Locate monorepo root `.env` whether cwd is repo root or `apps/api`. */
export function findRootEnvPath(): string | null {
  let dir = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

/** Load `.env` before any config is parsed (local dev / test only). */
export function loadRootEnv(): string | null {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  const path = findRootEnvPath();
  if (path) {
    config({ path, override: false });
  }
  return path;
}

export const loadedEnvPath = loadRootEnv();
