import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'desktop', 'data');
const outDir = path.join(rootDir, 'out');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const cleanAllProjectData = args.has('--all-project-data');
const keepOut = args.has('--keep-out');

const AUTO_PROJECT_PREFIXES = ['proj-e2e-', 'proj-integration-', 'proj-test-'];
const AUTO_FIXTURE_PREFIXES = ['proj-e2e-', 'proj-integration-', 'proj-test-'];

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function shouldCleanProjectDir(name) {
  if (!name.startsWith('proj-')) return false;
  if (cleanAllProjectData) return true;
  return AUTO_PROJECT_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function shouldCleanFixture(name) {
  if (!name.endsWith('.mp4')) return false;
  if (cleanAllProjectData) return true;
  return AUTO_FIXTURE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

async function removePath(targetPath, stats) {
  if (!(await exists(targetPath))) return;
  if (dryRun) {
    stats.removed.push(path.relative(rootDir, targetPath));
    return;
  }
  await fs.rm(targetPath, { recursive: true, force: true });
  stats.removed.push(path.relative(rootDir, targetPath));
}

async function cleanupRenderTemps(projectDir, stats) {
  const rendersDir = path.join(projectDir, 'renders');
  if (!(await exists(rendersDir))) return;
  const renderEntries = await fs.readdir(rendersDir, { withFileTypes: true });
  for (const entry of renderEntries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith('tmp-')) continue;
    await removePath(path.join(rendersDir, entry.name), stats);
  }
}

async function ensureDataSkeleton() {
  await fs.mkdir(dataDir, { recursive: true });
  const keepFile = path.join(dataDir, '.gitkeep');
  const readmeFile = path.join(dataDir, 'README.md');
  if (!(await exists(keepFile))) {
    await fs.writeFile(keepFile, '', 'utf8');
  }
  if (!(await exists(readmeFile))) {
    await fs.writeFile(
      readmeFile,
      [
        '# Desktop Data Directory',
        '',
        'Runtime artifacts for local projects and tests are generated here.',
        'Use `npm run clean:workspace` to remove stale generated artifacts.',
      ].join('\n'),
      'utf8',
    );
  }
}

async function main() {
  const stats = { removed: [] };

  if (!keepOut) {
    await removePath(outDir, stats);
  }

  if (await exists(dataDir)) {
    const entries = await fs.readdir(dataDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dataDir, entry.name);
      if (!entry.isDirectory()) continue;

      if (shouldCleanProjectDir(entry.name)) {
        await removePath(fullPath, stats);
        continue;
      }

      if (entry.name.startsWith('proj-')) {
        await cleanupRenderTemps(fullPath, stats);
      }
    }

    const fixturesDir = path.join(dataDir, 'test-fixtures');
    if (await exists(fixturesDir)) {
      const fixtureEntries = await fs.readdir(fixturesDir, { withFileTypes: true });
      for (const entry of fixtureEntries) {
        if (!entry.isFile()) continue;
        if (!shouldCleanFixture(entry.name)) continue;
        await removePath(path.join(fixturesDir, entry.name), stats);
      }
    }
  }

  await ensureDataSkeleton();

  const mode = dryRun ? 'DRY RUN' : 'DONE';
  console.log(`[clean:workspace] ${mode} | removed ${stats.removed.length} paths`);
  for (const item of stats.removed) {
    console.log(` - ${item}`);
  }
  if (stats.removed.length === 0) {
    console.log('No generated artifacts matched cleanup rules.');
  }
}

main().catch((error) => {
  console.error('[clean:workspace] failed:', error);
  process.exitCode = 1;
});
