import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const templatesDir = path.join(rootDir, 'src', 'templates');
const rootFile = path.join(rootDir, 'src', 'Root.tsx');

async function walkTsxFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkTsxFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseRootTemplateImports(content) {
  const imports = [];
  for (const match of content.matchAll(/import\s+'\.\/(templates\/[^']+)';/g)) {
    imports.push(match[1]);
  }
  return imports;
}

async function main() {
  const templateFiles = (await walkTsxFiles(templatesDir))
    .map((file) => path.relative(path.join(rootDir, 'src'), file).replace(/\.tsx$/, ''))
    .sort();

  const rootContent = await fs.readFile(rootFile, 'utf8');
  const rootImports = parseRootTemplateImports(rootContent).sort();

  const missingInRoot = templateFiles.filter((template) => !rootImports.includes(template));
  const missingTemplateFile = rootImports.filter((template) => !templateFiles.includes(template));

  const missingRegisterCall = [];
  for (const file of templateFiles) {
    const fullPath = path.join(rootDir, 'src', `${file}.tsx`);
    const content = await fs.readFile(fullPath, 'utf8');
    if (!content.includes('registerTemplate(')) {
      missingRegisterCall.push(file);
    }
  }

  const hasError =
    missingInRoot.length > 0 ||
    missingTemplateFile.length > 0 ||
    missingRegisterCall.length > 0;

  console.log(`Templates found: ${templateFiles.length}`);
  console.log(`Root imports found: ${rootImports.length}`);

  if (missingInRoot.length > 0) {
    console.log('\nMissing imports in src/Root.tsx:');
    for (const item of missingInRoot) {
      console.log(` - ${item}`);
    }
  }

  if (missingTemplateFile.length > 0) {
    console.log('\nStale imports in src/Root.tsx (file not found):');
    for (const item of missingTemplateFile) {
      console.log(` - ${item}`);
    }
  }

  if (missingRegisterCall.length > 0) {
    console.log('\nTemplate files without registerTemplate():');
    for (const item of missingRegisterCall) {
      console.log(` - ${item}`);
    }
  }

  if (hasError) {
    console.log('\n[templates:check] FAILED');
    process.exitCode = 1;
    return;
  }

  console.log('\n[templates:check] OK: all template files are imported and registered.');
}

main().catch((error) => {
  console.error('[templates:check] failed unexpectedly:', error);
  process.exitCode = 1;
});
