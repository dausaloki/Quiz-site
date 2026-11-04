import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('test-results', { recursive: true });
const steps = [['unit+edge', ['test']], ['database', ['run', 'test:db']], ['browser', ['run', 'test:browser']]];
const results = [];
for (const [name, args] of steps) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync('npm', args, { encoding: 'utf8', env: process.env, maxBuffer: 32 * 1024 * 1024 });
  const output = (r.stdout || '') + (r.stderr || '');
  writeFileSync(`test-results/${name.replace('+', '-')}.log`, output);
  process.stdout.write(output);
  results.push({ name, status: r.status === 0 ? 'PASS' : 'FAIL', exitCode: r.status });
}
writeFileSync('test-results/all-report.json', JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
const failed = results.filter(x => x.status === 'FAIL');
console.log(`\nOverall: ${results.length - failed.length}/${results.length} suites passed`);
if (failed.length) process.exitCode = 1;
