import { chromium, webkit, devices } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const mock = await readFile(new URL('./browser-mock.js', import.meta.url), 'utf8');
const sample = new URL('../examples/mixed-format.txt', import.meta.url);
const correction = new URL('../examples/needs-correction.txt', import.meta.url);
let BASE = process.env.BASE_URL || 'http://127.0.0.1:8091', server;
async function online() { try { return (await fetch(BASE + '/index.html')).ok; } catch { return false; } }
if (!await online()) { server = spawn('python3', ['tools/serve.py', '8091'], { stdio: 'ignore' }); for (let i = 0; i < 50 && !await online(); i++) await new Promise(r => setTimeout(r, 100)); }
if (!await online()) throw new Error('Local static test server did not start');
await mkdir('test-results', { recursive: true });
const report = [];
async function context(browser, mobile = false) {
  const c = await browser.newContext(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1360, height: 900 } }); c.setDefaultTimeout(12000);
  await c.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript', body: /october|REFERENCE/.test(new URL(route.request().url()).pathname) ? 'window.PORTAL_CONFIG={};' : "window.PORTAL_CONFIG={supabaseUrl:'https://local.test',supabaseAnonKey:'public-test',examFunctionName:'exam'};" }));
  await c.route('**/assets/vendor/supabase.js', route => route.fulfill({ contentType: 'application/javascript', body: mock }));
  await c.route('**/cdn.jsdelivr.net/npm/@supabase/**', route => route.fulfill({ contentType: 'application/javascript', body: mock }));
  await c.route('**/cdnjs.cloudflare.com/ajax/libs/html2canvas/**', async route => route.fulfill({ contentType: 'application/javascript', body: await readFile('assets/vendor/html2canvas.min.js', 'utf8') }));
  await c.route('**/cdnjs.cloudflare.com/ajax/libs/jspdf/**', async route => route.fulfill({ contentType: 'application/javascript', body: await readFile('assets/vendor/jspdf.umd.min.js', 'utf8') }));
  await c.route('**/fonts.googleapis.com/**', route => route.abort());
  await c.route('**/fonts.gstatic.com/**', route => route.abort());
  return c;
}
async function browserNewAndroid(browser) { const c = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); c.setDefaultTimeout(12000); await c.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript', body: /october|REFERENCE/.test(new URL(route.request().url()).pathname) ? 'window.PORTAL_CONFIG={};' : "window.PORTAL_CONFIG={supabaseUrl:'https://local.test',supabaseAnonKey:'public-test',examFunctionName:'exam'};" })); await c.route('**/assets/vendor/supabase.js', route => route.fulfill({ contentType: 'application/javascript', body: mock })); await c.route('**/fonts.googleapis.com/**', route => route.abort()); await c.route('**/fonts.gstatic.com/**', route => route.abort()); return c; }
async function run(name, fn) { try { await fn(); report.push({ name, status: 'PASS' }); console.log('PASS', name); } catch (e) { report.push({ name, status: 'FAIL', error: e.message }); console.error('FAIL', name, e.message); } }
const chromiumBrowser = await chromium.launch({ headless: true });
await run('Chromium: catalog hierarchy, search, filters and deep links', async () => {
  const c = await context(chromiumBrowser), p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/index.html'); await p.waitForSelector('#catalogContent .subject-card'); assert.match(await p.textContent('#catalogContent'), /राजस्थान GK/);
  await p.click('#catalogContent .subject-card button'); await p.waitForSelector('#catalogContent >> text=इतिहास'); await p.click('#catalogContent .subject-card button'); await p.waitForSelector('#catalogContent >> text=Part 1'); await p.click('#catalogContent .subject-card button'); await p.waitForSelector('#catalogContent a.btn'); assert.match(await p.getAttribute('#catalogContent a.btn', 'href'), /exam\.html\?id=test1/);
  await p.fill('#search', 'Mock'); assert.match(await p.textContent('#catalogContent'), /राजस्थान Mock Test 1/); await p.selectOption('#statusFilter', 'upcoming'); assert.match(await p.textContent('#catalogContent'), /कोई मेल खाता/);
  assert.deepEqual(errors, []); await c.close();
});
await run('Chromium: owner CRUD, full test builder and draft-only TXT import', async () => {
  const c = await context(chromiumBrowser), p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/admin.html'); await p.waitForSelector('#dashboardShell:not([hidden])'); assert.match(await p.textContent('#stats'), /विषय/);
  await p.click('[data-section=subjects]'); await p.fill('#subjectForm [name=name]', 'General Science'); await p.click('#subjectForm button[type=submit]'); await p.waitForSelector('#subjectList >> text=General Science');
  const sid = await p.evaluate(() => window.__kkTest.db.subjects.find(x => x.name === 'General Science').id);
  await p.click('[data-section=topics]'); await p.selectOption('#topicSubject', sid); await p.fill('#topicForm [name=name]', 'Physics'); await p.click('#topicForm button[type=submit]'); await p.waitForSelector('#topicList >> text=Physics');
  const tid = await p.evaluate(() => window.__kkTest.db.topics.find(x => x.name === 'Physics').id);
  await p.click('[data-section=parts]'); await p.selectOption('#partTopic', tid); await p.fill('#partForm [name=name]', 'Part A'); await p.click('#partForm button[type=submit]'); await p.waitForSelector('#partList >> text=Part A');
  const pid = await p.evaluate(() => window.__kkTest.db.parts.find(x => x.name === 'Part A').id);
  await p.click('[data-section=tests]'); await p.click('[data-action=new-test]'); await p.selectOption('#testForm [name=part_id]', pid); await p.fill('#testForm [name=title]', 'Science Import Test'); await p.click('#testForm button[type=submit]'); await p.waitForSelector('#testList >> text=Science Import Test');
  const testId = await p.evaluate(() => window.__kkTest.db.tests.find(x => x.title === 'Science Import Test').id);
  await p.click('[data-section=import]'); await p.setInputFiles('#importFile', sample.pathname); await p.click('#parseImport'); await p.waitForSelector('[data-import-question="7"]'); assert.match(await p.textContent('#importSummary'), /कुल पहचाने/); await p.selectOption('#importTarget', testId); await p.click('#saveImport'); await p.waitForFunction(() => window.__kkTest.db.imports.length === 1);
  const imported = await p.evaluate(() => window.__kkTest.db.imports[0]); assert.equal(imported.p_questions.length, 8); assert.equal(imported.p_questions[0].explanation_hi.includes('दूसरी पंक्ति'), true);
  const published = await p.evaluate(id => window.__kkTest.db.tests.find(x => x.id === id).is_published, testId); assert.equal(published, false);
  await p.click('[data-section=questions]'); await p.selectOption('#questionTest', testId); await p.waitForSelector('#questionList .item'); await p.click('#questionList [data-action=edit-question]'); await p.fill('#questionForm [name=explanation_hi]', 'सुधारी हुई व्याख्या'); await p.click('#questionForm button[type=submit]'); await p.waitForFunction(() => window.__kkTest.db.questions.some(q => q.explanation_hi === 'सुधारी हुई व्याख्या'));
  await p.click('[data-section=tests]'); await p.click(`[data-action=duplicate-test][data-id="${testId}"]`); await p.waitForFunction(id => window.__kkTest.db.tests.some(t => t.title === 'Science Import Test (copy)'), testId);
  assert.deepEqual(errors, []); await c.close();
});
await run('Chromium: invalid TXT retained, corrected in preview, never auto-saved', async () => {
  const c = await context(chromiumBrowser), p = await c.newPage(); await p.goto(BASE + '/admin.html'); await p.waitForSelector('#dashboardShell:not([hidden])'); await p.click('[data-section=import]'); await p.setInputFiles('#importFile', correction.pathname); await p.click('#parseImport'); await p.waitForSelector('[data-import-question="3"]'); assert.equal(await p.isDisabled('#saveImport'), true);
  await p.fill('[data-import-question="0"] [data-import-option="2"]', 'तीसरा'); await p.selectOption('[data-import-question="1"] [data-field=correct_index]', '0'); await p.waitForFunction(() => !document.getElementById('saveImport').disabled); assert.equal(await p.evaluate(() => window.__kkTest.db.imports.length), 0); await c.close();
});
await run('Chromium: exam navigation, review, resume, server submit, solutions and PDF', async () => {
  const c = await context(chromiumBrowser), p = await c.newPage(); p.on('dialog', d => d.accept()); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/exam.html?id=test1'); await p.waitForSelector('#intro:not([hidden])'); await p.fill('#startForm [name=name]', 'लोकेश'); await p.click('#startForm button[type=submit]'); await p.waitForSelector('#paper:not([hidden])');
  await p.click('#options .option:nth-child(2)'); await p.click('#next'); await p.waitForFunction(() => document.getElementById('counter').textContent.includes('2 / 2')); await p.click('#options .option:nth-child(1)'); await p.click('#review'); assert.match(await p.textContent('#review'), /★/);
  await p.click('#palette button:nth-child(1)'); await p.reload(); await p.waitForSelector('#resumePanel:not([hidden])'); await p.click('#resume'); await p.waitForSelector('#paper:not([hidden])'); assert.equal(await p.locator('#options .option.selected').count(), 1);
  await p.click('#submit'); await p.waitForURL(/result\.html/); await p.waitForSelector('#resultPanel:not([hidden])'); assert.match(await p.textContent('#resultMetrics'), /0.6667/); assert.match(await p.textContent('#solutions'), /विस्तृत व्याख्या/);
  const pdfSize = await p.evaluate(async () => { const m = await import('/assets/js/pdf.js'); const b = await m.buildResultPdf(window.__kkTest.db.result, 'explanations'); return b.size; }); assert.ok(pdfSize > 5000);
  const download = p.waitForEvent('download'); await p.click('#pdfDownload'); const file = await download; assert.match(file.suggestedFilename(), /\.pdf$/); assert.equal(await file.failure(), null);
  const shareDownload = p.waitForEvent('download'); await p.click('#pdfShare'); assert.match((await shareDownload).suggestedFilename(), /\.pdf$/);
  await p.evaluate(() => { window.open = () => null; }); const printDownload = p.waitForEvent('download'); await p.click('#pdfPrint'); assert.match((await printDownload).suggestedFilename(), /\.pdf$/);
  await p.goto(BASE + '/leaderboard.html?test=test1'); await p.waitForSelector('#board table'); assert.match(await p.textContent('#board'), /लोकेश/);
  await p.goto(BASE + '/history.html'); await p.waitForSelector('#localHistory'); assert.match(await p.textContent('#localHistory'), /राजस्थान Mock Test 1/);
  assert.deepEqual(errors, []); await c.close();
});
await run('Chromium: overall timer auto-submits without confirmation', async () => {
  const c = await context(chromiumBrowser), p = await c.newPage(); await p.goto(BASE + '/exam.html?id=test1&fast=1'); await p.waitForSelector('#intro:not([hidden])'); await p.fill('#startForm [name=name]', 'Timer Student'); await p.click('#startForm button[type=submit]'); await p.waitForURL(/result\.html/, { timeout: 10000 }); await p.waitForSelector('#resultPanel:not([hidden])'); await c.close();
});
await run('Chromium: leaderboard and private history pages', async () => {
  const c = await context(chromiumBrowser), p = await c.newPage(); await p.goto(BASE + '/leaderboard.html?test=test1'); await p.waitForSelector('#board'); assert.match(await p.textContent('#boardStatus'), /लोड|Test ID|प्रकाशित/); await p.goto(BASE + '/history.html'); await p.waitForSelector('#localHistory'); assert.match(await p.textContent('#localHistory'), /guest result|Guest|result/); await c.close();
});
await run('Chromium: legacy October exam, 50 questions, result and PDF remain intact', async () => {
  const c = await context(chromiumBrowser), p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/october-sujas-test-01.html'); await p.fill('#nm', 'Legacy Student'); await p.click('#go'); await p.click('#ag'); await p.waitForSelector('#exam.on'); assert.equal(await p.evaluate(() => Q.length), 50); await p.click('#op .opt:nth-child(3)'); await p.click('#star'); assert.equal(await p.textContent('#star'), '★'); await p.click('#sb'); await p.click('#dy'); await p.waitForSelector('#result.on', { timeout: 10000 });
  const size = await p.evaluate(async () => (await getPdf()).size); assert.ok(size > 10000); assert.ok(await p.evaluate(() => localStorage.getItem('nhg_sujas_oct_t01_v3'))); assert.deepEqual(errors, []); await c.close();
});
await run('Chromium: unauthorized owner account is blocked', async () => {
  const c = await context(chromiumBrowser), p = await c.newPage(); await p.goto(BASE + '/admin.html?blocked=1'); await p.waitForSelector('#loginPanel:not([hidden])'); assert.match(await p.textContent('#adminStatus'), /allowlist|Access denied/); assert.equal(await p.isVisible('#dashboardShell'), false); await c.close();
});
await run('Chromium: per-question deadline locks the palette and skips expired questions', async () => {
  const c = await context(chromiumBrowser), p = await c.newPage(); await p.goto(BASE + '/exam.html?id=test1&perq=1'); await p.waitForSelector('#intro:not([hidden])'); await p.fill('#startForm [name=name]', 'Per Question'); await p.click('#startForm button[type=submit]'); await p.waitForSelector('#paper:not([hidden])'); await p.waitForTimeout(1200); await p.click('#next'); await p.waitForFunction(() => document.getElementById('counter').textContent.includes('2 / 2')); assert.equal(await p.locator('#palette button.locked').count(), 1); await p.click('#palette button:nth-child(1)'); await p.waitForTimeout(300); assert.equal(await p.isDisabled('#options .option:nth-child(1)'), true); await c.close();
});
await run('Chromium/Android width: core pages fit a 360px viewport', async () => {
  const c = await browserNewAndroid(chromiumBrowser), p = await c.newPage();
  for (const path of ['/index.html', '/admin.html', '/exam.html?id=test1', '/leaderboard.html?test=test1', '/history.html', '/october-sujas-test-01.html']) { await p.goto(BASE + path); await p.waitForTimeout(350); const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.ok(overflow <= 2, `${path} overflow ${overflow}px`); }
  await c.close();
});
const webkitBrowser = await webkit.launch({ headless: true });
await run('WebKit/iPhone: homepage, admin, exam and legacy layouts have no horizontal overflow', async () => {
  const c = await context(webkitBrowser, true), p = await c.newPage();
  for (const path of ['/index.html', '/admin.html', '/exam.html?id=test1', '/october-sujas-test-01.html']) { await p.goto(BASE + path); await p.waitForTimeout(500); const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.ok(overflow <= 2, `${path} overflow ${overflow}px`); }
  await p.goto(BASE + '/index.html'); await p.screenshot({ path: 'test-results/home-iphone.png', fullPage: true }); await c.close();
});
await chromiumBrowser.close(); await webkitBrowser.close(); if (server) server.kill();
await writeFile('test-results/browser-report.json', JSON.stringify(report, null, 2));
const failed = report.filter(x => x.status === 'FAIL'); console.log(`\nBrowser checks: ${report.length - failed.length}/${report.length} passed`); if (failed.length) process.exitCode = 1;
