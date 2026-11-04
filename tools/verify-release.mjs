import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const sha = b => createHash('sha256').update(b).digest('hex');
const checks = [];
const ok = (name, pass, detail = '') => { checks.push({ name, status: pass ? 'PASS' : 'FAIL', detail }); if (!pass) console.error('FAIL', name, detail); };
const required = [
  'index.html', 'admin.html', 'exam.html', 'result.html', 'leaderboard.html', 'history.html',
  'october-sujas-test-01.html', 'REFERENCE_ORIGINAL_UNCHANGED.html', 'REFERENCE_FEATURES.md',
  'config.js', 'config.example.js', 'package.json', 'package-lock.json', 'README_HI.md', 'TEST_REPORT.md',
  'assets/css/portal.css', 'assets/js/shared.js', 'assets/js/portal.js', 'assets/js/admin.js', 'assets/js/admin-forms.js', 'assets/js/admin-import.js', 'assets/js/exam.js', 'assets/js/exam-core.js', 'assets/js/result.js', 'assets/js/pdf.js', 'assets/js/leaderboard.js', 'assets/js/history.js', 'assets/js/import-parser.js',
  'assets/vendor/supabase.js', 'assets/vendor/jspdf.umd.min.js', 'assets/vendor/html2canvas.min.js',
  'assets/vendor/LICENSE-supabase-js.txt', 'assets/vendor/LICENSE-jspdf.txt', 'assets/vendor/LICENSE-html2canvas.txt',
  'supabase/schema.sql', 'supabase/config.toml', 'supabase/functions/exam/index.ts', 'supabase/functions/_shared/handler.js', 'supabase/functions/_shared/scoring.js',
  ...readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).map(f => `supabase/migrations/${f}`),
  'examples/mixed-format.txt', 'examples/needs-correction.txt', 'examples/questions.json',
  'tests/parser.test.mjs', 'tests/core.test.mjs', 'tests/scoring.test.mjs', 'tests/edge.test.mjs', 'tests/database.test.mjs', 'tests/db-harness.mjs', 'tests/browser.mjs', 'tests/browser-mock.js',
  'tools/vendor.mjs', 'tools/build-schema.mjs', 'tools/serve.py', 'tools/test-all.mjs', 'tools/verify-release.mjs',
  'docs/AUDIT_AND_MISSING_FEATURES.md', 'legacy/SHA256SUMS.txt'
];
for (const f of required) ok(`file:${f}`, existsSync(f));
for (const f of readdirSync('legacy/source-uploads')) ok(`legacy upload:${f}`, existsSync(join('legacy/source-uploads', f)));
const sums = readFileSync('legacy/SHA256SUMS.txt', 'utf8').trim().split('\n');
for (const line of sums) { const [hash, path] = line.split(/\s{2}/); ok(`hash:${path}`, existsSync(path) && sha(readFileSync(path)) === hash, hash); }
const migrations = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
const expected = '-- KALAM SE KRANTI: generated from migrations; edit migrations, then npm run build:schema.\n-- Run on a NEW/staging project first. Additive: legacy tables are not dropped.\n' + migrations.map(f => `\n-- ===== ${f} =====\n` + readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
ok('schema.sql matches migrations', readFileSync('supabase/schema.sql', 'utf8') === expected);
const config = readFileSync('config.js', 'utf8');
ok('config has no live credentials', !/service_role|eyJ[A-Za-z0-9_-]{20,}/.test(config) && /supabaseUrl:\s*''/.test(config));
ok('premium disabled by default in config', /premiumEnabled:\s*false/.test(config));
ok('premium disabled by default in SQL', migrations.some(f => /premium_enabled/.test(readFileSync(`supabase/migrations/${f}`, 'utf8')) && /false/.test(readFileSync(`supabase/migrations/${f}`, 'utf8'))));
const jsFiles = ['assets/js', 'tools', 'tests', 'supabase/functions/_shared'].flatMap(d => readdirSync(d).filter(f => /\.(mjs|js)$/.test(f)).map(f => join(d, f)));
const { spawnSync } = await import('node:child_process');
for (const f of jsFiles) { const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' }); ok(`syntax:${f}`, r.status === 0, r.stderr?.slice(0, 300)); }
ok('no .env or secret files packaged', !existsSync('.env') && !existsSync('.env.local'));
const report = { date: new Date().toISOString(), checks, pass: checks.filter(c => c.status === 'PASS').length, fail: checks.filter(c => c.status === 'FAIL').length };
writeFileSync('RELEASE_VERIFICATION.json', JSON.stringify(report, null, 2));
console.log(`Release verification: ${report.pass}/${checks.length} checks passed`);
if (report.fail) process.exitCode = 1;
