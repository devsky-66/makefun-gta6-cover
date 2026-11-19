// Vice Cover Maker — build entry point (gta6-cover-art-01).
// Copies app/ and screenshots/ into the output directory and writes
// dossier.json via the vendored make.fun library. Node 22 stdlib only,
// erasable TypeScript so `node main.ts` runs it with no build step.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-app.ts';

// The scorer may invoke this file from any working directory (e.g.
// `node /bot/main.ts`), so every path below is anchored to this file's
// location via import.meta.url — never to process.cwd(). The output
// directory is the only path that still honours the caller's cwd, and
// only when MAKEFUN_OUTPUT_DIR is not set.
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : resolve('output');

const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};

function listFilesSorted(dir: string): string[] {
  const found: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (st.isFile()) found.push(p);
    }
  };
  walk(dir);
  return found;
}

function copyTree(srcDir: string, destDir: string): number {
  mkdirSync(destDir, { recursive: true });
  const files = listFilesSorted(srcDir);
  for (const file of files) {
    const rel = file.slice(srcDir.length + 1);
    const dest = join(destDir, rel);
    mkdirSync(join(dest, '..'), { recursive: true });
    cpSync(file, dest);
  }
  return files.length;
}

function main(): void {
  // Repo root is the directory holding this file, not the caller's cwd.
  const repoRoot = dirname(fileURLToPath(import.meta.url));
  const appDir = join(repoRoot, 'app');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(appDir) || !statSync(appDir).isDirectory()) {
    throw new Error('app/ directory is missing next to main.ts');
  }
  if (!existsSync(join(appDir, 'index.html'))) {
    throw new Error('app/index.html is missing — the entry page is required');
  }
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
    throw new Error('screenshots/ directory is missing next to main.ts');
  }
  // Fresh output every run so stale files can never leak into the dossier.
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const appFiles = copyTree(appDir, join(OUTPUT_DIR, 'app'));
  const shotFiles = copyTree(shotsDir, join(OUTPUT_DIR, 'screenshots'));
  const dossier = buildDossier(OUTPUT_DIR, DOSSIER_CAPS);
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);
  console.log(`copied ${appFiles} app files and ${shotFiles} screenshots`);
  console.log(`wrote ${join(OUTPUT_DIR, 'dossier.json')} (${dossier.length} bytes)`);
}

main();
