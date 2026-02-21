import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

if (!existsSync('out/portraits')) {
  mkdirSync('out/portraits', { recursive: true });
}

try {
  console.log('Fetching compositions...');
  const output = execSync('npx remotion compositions src/index.ts', { encoding: 'utf-8' });
  
  // Extract all portrait compositions
  const compRegex = /^([a-zA-Z0-9-]+-01-portrait)\s+/gm;
  const matches = [...output.matchAll(compRegex)];
  const compIds = matches.map(m => m[1]);
  
  console.log(`Found ${compIds.length} portrait compositions. Taking screenshots...`);

  let success = 0;
  for (const id of compIds) {
    try {
      execSync(`npx remotion still src/index.ts ${id} out/portraits/${id}.png --frame=60 --quiet`, { 
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      process.stdout.write('.');
      success++;
    } catch (e) {
      console.log(`\n❌ Failed to capture ${id}`);
    }
  }

  console.log(`\n✅ Successfully captured ${success}/${compIds.length} portrait screenshots in out/portraits/`);

} catch (err) {
  console.error('Error running screenshot script:', err);
}
