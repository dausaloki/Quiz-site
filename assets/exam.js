import { $, esc, cfg, configured, rpc, exam, storage, uuid, pick, language, toast, loading, friendlyError, fmt } from './shared.js';
import { remainingMs, clockText, paletteState, nextAvailableIndex, validStudent, createAttemptSecret } from './exam-core.js';
const testId = new URLSearchParams(location.search).get('id');
let test, attempt, expiresAt = null, questions = [], settings = {}, answers = {}, review = [], visited = [], times = {}, feedback = {}, current = 0, offset = 0;
let receipt = null, active = false, submitting = false, submitted = false, interval = null, chain = Promise.resolve(), pending = {}, lastAuto = '', progressTask = Promise.resolve();
const now = () => Date.now() + offset;
const qid = () => questions[current]?.id;
const indices = ids => questions.map((q, i) => ids.includes(q.id) ? i : -1).filter(i => i >= 0);
const ids = indexes => indexes.map(i => questions[i]?.id).filter(Boolean);
function status(text, error = false) { $('examStatus').textContent = text; $('examStatus').hidden = !text; $('examStatus').classList.toggle('error', error); }
function cache() { if (!attempt) return; storage.set('attempt:' + attempt, { test_id: testId, current_index: current, answers, review_ids: ids(review), visited_ids: ids(visited), feedback, pending }); }
function absorb(data) {
  if (!data?.questions || !data.settings) return;
  attempt = data.attempt_id; expiresAt = data.expires_at; questions = data.questions; settings = data.settings; answers = { ...(data.answers || {}), ...pending }; times = data.question_times || {};
  review = indices(data.review_ids || []); visited = indices(data.visited_ids || []); current = Math.min(data.current_index || 0, questions.length - 1);
  offset = new Date(data.server_now).getTime() - Date.now(); if (!visited.includes(current)) visited.push(current);
  if (data.status === 'submitted') { submitted = true; active = false; }
  cache();
}
function saveState(text, error = false) { $('saveStatus').textContent = text; $('saveStatus').classList.toggle('error-text', error); $('retrySync').hidden = !Object.keys(pending).length; }
function enqueue(operation) {
  saveState('सर्वर पर सेव हो रहा है…');
  const task = chain.then(operation);
  chain = task.catch(() => {}).then(() => {});
  task.then(() => { if (!Object.keys(pending).length) saveState('उत्तर सर्वर पर सेव हैं ✓'); }).catch(e => saveState('कुछ उत्तर sync नहीं हुए। दोबारा प्रयास करें।', true));
  return task;
}
async function sendAnswer(questionId, option) {
  try { const data = await exam('answer', { attempt_id: attempt, secret: receipt.secret, question_id: questionId, option_index: option }); delete pending[questionId]; if (data.feedback && Object.keys(data.feedback).length) { feedback[questionId] = data.feedback; renderQuestion(); } cache(); }
  catch (e) { if (/QUESTION_EXPIRED|ATTEMPT_EXPIRED|ATTEMPT_SUBMITTED/.test(e.message)) { delete pending[questionId]; if (times[questionId]) times[questionId].locked = true; if (/QUESTION_EXPIRED/.test(e.message)) { try { const data = await exam('progress', { attempt_id: attempt, secret: receipt.secret, current_index: current, review_ids: ids(review), visited_ids: ids(visited) }); if (data.questions) { answers = { ...(data.answers || {}), ...pending }; times = data.question_times || times; } } catch {} } cache(); if (/ATTEMPT_EXPIRED/.test(e.message)) await submitAttempt(true); } throw e; }
}
function progress(index) {
  current = index; if (!visited.includes(index)) visited.push(index); cache(); render();
  progressTask = enqueue(async () => { const data = await exam('progress', { attempt_id: attempt, secret: receipt.secret, current_index: index, review_ids: ids(review), visited_ids: ids(visited) }); if (data.status === 'submitted') return toResult(); absorb(data); render(); });
  return progressTask;
}
function render() { if (!active) return; $('studentLabel').textContent = '👤 ' + (receipt?.name || attempt?.student_name || ''); $('counter').textContent = `प्रश्न ${current + 1} / ${questions.length}`; $('progressBar').style.width = `${Object.values(answers).filter(x => x !== null && x !== undefined).length / questions.length * 100}%`; renderQuestion(); renderPalette(); tick(); }
function renderQuestion() {
  if (!active) return; const q = questions[current], lang = language(), locked = times[q.id]?.locked || remainingMs(times[q.id]?.deadline_at, now()) <= 0;
  $('questionNumber').textContent = `QUESTION ${String(current + 1).padStart(2, '0')}${locked ? ' · समय समाप्त' : ''}`;
  $('questionText').textContent = pick(q, 'prompt', lang); const image = $('questionImage'); image.hidden = !q.image_url; if (q.image_url) image.src = q.image_url;
  $('options').replaceChildren(); q.options.forEach((o, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'option' + (answers[q.id] === i ? ' selected' : ''); b.disabled = locked || submitting; b.setAttribute('aria-pressed', String(answers[q.id] === i)); b.innerHTML = `<span class="option-letter">${String.fromCharCode(65 + i)}</span><span>${esc(o[lang] || o.hi || o.en)}</span>`; b.onclick = () => choose(i); $('options').append(b); });
  $('previous').disabled = current === 0; $('next').textContent = current === questions.length - 1 ? 'अंतिम प्रश्न ✓' : 'Save & Next →'; $('review').textContent = review.includes(current) ? '★ Marked for Review' : '☆ Mark for Review';
  const f = feedback[q.id], box = $('practiceFeedback'); box.hidden = !f; if (f) { box.textContent = `सही उत्तर: ${String.fromCharCode(65 + Number(f.correct_index))}. ${pick(f, 'explanation', lang)}${f.reference ? '\nस्रोत: ' + f.reference : ''}`; box.classList.toggle('success', answers[q.id] === f.correct_index); }
}
function renderPalette() { $('palette').replaceChildren(); questions.forEach((q, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = i + 1; b.className = paletteState(i, questions.map(x => answers[x.id]), review, visited) + (i === current ? ' current' : '') + (times[q.id]?.locked ? ' locked' : ''); b.setAttribute('aria-label', `प्रश्न ${i + 1}, ${paletteState(i, questions.map(x => answers[x.id]), review, visited)}`); b.onclick = () => progress(i).catch(e => toast(friendlyError(e), 'error')); $('palette').append(b); }); }
async function choose(option) {
  const id = qid(), value = answers[id] === option ? null : option; answers[id] = value; pending[id] = value; cache(); renderQuestion(); renderPalette();
  try { await enqueue(() => sendAnswer(id, value)); } catch (e) { toast(friendlyError(e), 'error'); }
}
function tick() {
  if (!active || submitted) return; const left = remainingMs(expiresAt, now()); $('overallTimer').textContent = clockText(left); $('overallTimer').classList.toggle('urgent', left < 60000);
  const qt = times[qid()]?.deadline_at, qleft = remainingMs(qt, now()); $('questionTimer').textContent = qt ? 'प्रश्न: ' + clockText(qleft) : ''; $('questionTimer').classList.toggle('urgent', qt && qleft < 10000);
  if (left <= 0) { submitAttempt(true).catch(e => { status(friendlyError(e), true); toast('Auto-submit sync नहीं हुआ। Retry Submit दबाएँ।', 'error'); }); return; }
  if (qt && qleft <= 0 && lastAuto !== qid()) { lastAuto = qid(); times[qid()].locked = true; const next = nextAvailableIndex(times, questions, current, now()); renderQuestion(); renderPalette(); if (next !== null) progress(next).catch(e => toast(friendlyError(e), 'error')); else toast('सभी प्रश्नों का समय समाप्त। टेस्ट Submit करें।'); }
}
async function flushPending() { await chain; for (const [id, value] of Object.entries(pending)) { try { await sendAnswer(id, value); } catch (e) { if (!/QUESTION_EXPIRED|ATTEMPT_EXPIRED|ATTEMPT_SUBMITTED/.test(e.message)) throw e; } } cache(); }
async function submitAttempt(auto = false) {
  if (submitting || submitted) return; if (!auto && !confirm(`टेस्ट Submit करें?\nउत्तर दिए: ${Object.values(answers).filter(x => x !== null && x !== undefined).length}/${questions.length}\nMarked for review: ${review.length}\nSubmit के बाद उत्तर नहीं बदल सकते।`)) return;
  submitting = true; active = false; clearInterval(interval); status('उत्तर sync करके सर्वर पर score निकाला जा रहा है…'); $('submit').disabled = true;
  try {
    try { await flushPending(); } catch (e) { if (!auto && !confirm('कुछ उत्तर sync नहीं हुए। केवल सर्वर पर सेव उत्तरों के साथ Submit करें?')) { submitting = false; active = true; $('submit').disabled = false; interval = setInterval(tick, 250); status('Unsynced उत्तर बाकी हैं। Retry Sync दबाएँ।', true); return; } }
    const result = await exam('submit', { attempt_id: attempt, secret: receipt.secret }); storage.set('result:' + attempt, result); storage.set('receipt:' + attempt, receipt); if (storage.get('current:' + testId)?.attempt_id === attempt) storage.remove('current:' + testId); storage.remove('start:' + testId); storage.remove('attempt:' + attempt); submitted = true;
    await celebrate(); location.href = `result.html?attempt=${encodeURIComponent(attempt)}`;
  } catch (e) { submitting = false; active = true; $('submit').disabled = false; status('Submit पूरा नहीं हुआ: ' + friendlyError(e) + ' दोबारा Submit दबाएँ; duplicate result नहीं बनेगा।', true); interval = setInterval(tick, 250); }
}
function toResult() { submitted = true; active = false; clearInterval(interval); location.href = `result.html?attempt=${encodeURIComponent(attempt)}`; }
async function begin(resume = false) {
  if (!testId) throw new Error('Test ID missing');
  if (resume) { receipt = storage.get('current:' + testId); if (!receipt) throw new Error('No saved attempt'); const saved = storage.get('attempt:' + receipt.attempt_id, {}); pending = saved.pending || {}; feedback = saved.feedback || {};
    const data = await exam('progress', { attempt_id: receipt.attempt_id, secret: receipt.secret, current_index: saved.current_index || 0, review_ids: saved.review_ids || [], visited_ids: saved.visited_ids || [] }); if (data.status === 'submitted') { absorb(data); return toResult(); } absorb(data);
  } else {
    const f = new FormData($('startForm')), name = String(f.get('name') || '').trim(), mobile = String(f.get('mobile') || '').trim(), error = validStudent(name, mobile); if (error) throw new Error(error);
    let request = storage.get('start:' + testId); if (!request) { request = { test_id: testId, name, mobile, leaderboard_consent: f.has('consent'), client_nonce: uuid(), secret: createAttemptSecret() }; storage.set('start:' + testId, request); }
    const data = await exam('start', request); if (data.status === 'submitted') { absorb(data); receipt = { attempt_id: attempt, test_id: testId, secret: request.secret, name }; storage.set('receipt:' + attempt, receipt); return toResult(); }
    absorb(data); receipt = { attempt_id: attempt, test_id: testId, secret: request.secret, name }; storage.set('receipt:' + attempt, receipt); storage.set('current:' + testId, receipt); storage.remove('start:' + testId); pending = {};
  }
  active = true; submitted = false; $('intro').hidden = true; $('paper').hidden = false; status(''); render(); clearInterval(interval); interval = setInterval(tick, 250);
  if (remainingMs(expiresAt, now()) <= 0) await submitAttempt(true); else if (Object.keys(pending).length) retrySync();
}
async function retrySync() { try { await progress(current); await flushPending(); saveState('सभी उत्तर सर्वर पर सेव हैं ✓'); toast('Sync पूरा हुआ।'); } catch (e) { saveState('Sync बाकी है। Internet जाँचें।', true); toast(friendlyError(e), 'error'); } }
function paintIntro() { $('testTitle').textContent = test.title; $('instructions').textContent = pick(test, 'instructions', language()) || 'समय समाप्त होने पर टेस्ट स्वतः Submit होगा।'; $('testMetrics').innerHTML = [['प्रश्न', test.question_count], ['मिनट', test.duration_minutes], ['सही उत्तर के अंक', test.marks_per_question], ['Negative ratio', test.negative_ratio]].map(([a, b]) => `<div><span>${a}</span><b>${esc(b)}</b></div>`).join(''); }
async function init() {
  if (!configured()) { status('Cloud config खाली है। नया टेस्ट शुरू करने के लिए Owner को Supabase सेटअप करना होगा। पुराना अक्टूबर टेस्ट अलग उपलब्ध है।', true); return; }
  if (!testId) { status('टेस्ट ID नहीं मिली। होमपेज से टेस्ट चुनें।', true); return; }
  try { test = await rpc('portal_get_test', { p_test_id: testId }); if (!test) throw new Error('यह टेस्ट प्रकाशित नहीं है या उपलब्ध नहीं है।'); paintIntro(); status(''); $('intro').hidden = false;
    const saved = storage.get('current:' + testId); if (saved && test.resume_enabled) { $('resumePanel').hidden = false; $('resume').onclick = async e => { loading(e.currentTarget, true); try { await begin(true); } catch (err) { status(friendlyError(err), true); loading(e.currentTarget, false); } }; }
    if (test.status !== 'available') { $('startForm').hidden = true; status(test.status === 'upcoming' ? 'यह टेस्ट अभी शुरू नहीं हुआ। Homepage पर निर्धारित समय देखें।' : 'यह टेस्ट समाप्त हो चुका है।', true); }
  } catch (e) { status(friendlyError(e), true); }
  $('startForm').onsubmit = async e => { e.preventDefault(); const b = e.submitter; loading(b, true); try { await begin(false); } catch (err) { status(friendlyError(err), true); loading(b, false); } };
  $('previous').onclick = () => progress(Math.max(0, current - 1)).catch(e => toast(friendlyError(e), 'error'));
  $('next').onclick = () => { if (current < questions.length - 1) { const next = nextAvailableIndex(times, questions, current, now()); if (next !== null) progress(next).catch(e => toast(friendlyError(e), 'error')); } else toast('यह अंतिम प्रश्न है। तैयार हों तो Submit करें।'); };
  $('review').onclick = async () => { review = review.includes(current) ? review.filter(i => i !== current) : [...review, current]; render(); try { await progress(current); } catch (e) { toast(friendlyError(e), 'error'); } };
  $('submit').onclick = () => submitAttempt(false).catch(e => status(friendlyError(e), true)); $('retrySync').onclick = retrySync;
  document.addEventListener('kk-language', () => { if (test) paintIntro(); render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && active) { tick(); if (navigator.onLine) retrySync(); } });
  window.addEventListener('online', () => { if (active) retrySync(); });
  window.addEventListener('beforeunload', e => { if (active && !submitted) { e.preventDefault(); e.returnValue = ''; } });
}
async function celebrate() { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; const el = document.createElement('div'); el.className = 'success-mark'; el.textContent = '✓'; el.style.cssText = 'position:fixed;left:calc(50% - 35px);top:40%;z-index:100;background:#102b25;box-shadow:0 15px 70px #0009'; document.body.append(el); try { const ctx = new AudioContext(); const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 660; g.gain.value = .035; o.start(); o.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + .2); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .4); o.stop(ctx.currentTime + .4); setTimeout(() => ctx.close(), 600); } catch {} await new Promise(r => setTimeout(r, 850)); el.remove(); }
init();
