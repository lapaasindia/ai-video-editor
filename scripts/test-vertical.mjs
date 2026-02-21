import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

// verify that all registered templates in Root.tsx have both portrait and landscape Compositions
const rootContent = readFileSync('./src/Root.tsx', 'utf-8');
const portraitComps = (rootContent.match(/<Composition[^>]+id=\{`\$\{t\.id\}-portrait`\}/g) || []).length;
const landscapeComps = (rootContent.match(/<Composition[^>]+id=\{`\$\{t\.id\}-landscape`\}/g) || []).length;

console.log(`Root.tsx has ${portraitComps} portrait compositions and ${landscapeComps} landscape compositions configured.`);
