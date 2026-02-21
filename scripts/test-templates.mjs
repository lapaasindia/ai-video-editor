import { execSync } from 'child_process';

try {
  const output = execSync('npx remotion compositions src/index.ts', { encoding: 'utf-8' });
  const compRegex = /^([a-zA-Z0-9-]+-01-(landscape|portrait))\s+/gm;
  const matches = [...output.matchAll(compRegex)];
  const compIds = matches.map(m => m[1]);
  
  const results = { total: compIds.length, success: 0, failed: 0, failures: [] };

  // Test the rest
  const toTest = compIds.slice(60);
  console.log(`Testing remaining ${toTest.length} compositions...`);

  for (const id of toTest) {
    try {
      execSync(`npx remotion render src/index.ts ${id} out/test-${id}.mp4 --frames=0-0 --quiet`, { 
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      process.stdout.write('.');
      results.success++;
    } catch (e) {
      console.log(`\n❌ ${id} FAILED!`);
      const errorOutput = e.stderr || e.stdout || e.message;
      results.failed++;
      results.failures.push({ id, error: errorOutput.split('\n').slice(0, 10).join('\n') });
    }
  }

  console.log('\n--- TEST RESULTS ---');
  console.log(`Total tested: ${toTest.length}`);
  console.log(`Success: ${results.success}`);
  console.log(`Failed: ${results.failed}`);
  
  if (results.failures.length > 0) {
    console.log('\nFailures:');
    results.failures.forEach(f => {
      console.log(`\n🔴 ${f.id}`);
      console.log(f.error);
    });
  }

} catch (err) {
  console.error('Error running tests:', err);
}
