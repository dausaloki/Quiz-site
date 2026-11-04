import { $, esc, client, configured, rpc, requireOwner, saveRow, deleteRow, uploadImage, toast, loading, downloadJSON, download, dateText, fmt, friendlyError, num } from './shared.js';
import { entityForm, readEntity, testForm, readTest, questionForm, readQuestion, optionEditor, settingsForm, TEST_DEFAULTS } from './admin-forms.js';
import { initImporter } from './admin-import.js';
const state = { user: null, subjects: [], topics: [], parts: [], tests: [], questions: [], settings: {}, stats: {}, results: [], section: 'dashboard', editingQuestion: null };
let importer;
const tableFor = { subject: 'portal_subjects', topic: 'portal_topics', part: 'portal_parts' };
function status(text, error = false) { $('adminStatus').textContent = text; $('adminStatus').classList.toggle('error', error); }
function showLogin() { state.user = null; $('loginPanel').hidden = false; $('dashboardShell').hidden = true; $('logout').hidden = true; }
function options(arr, placeholder = 'चुनें') { return `<option value="">${placeholder}</option>` + arr.map(x => `<option value="${esc(x.id)}">${esc(x.name || x.title)}</option>`).join(''); }
function fill(id, arr, placeholder) { const el = $(id), value = el.value; el.innerHTML = options(arr, placeholder); if (arr.some(x => x.id === value)) el.value = value; }
async function checkOwner(recovery = false) {
  if (!configured()) { showLogin(); status('Supabase config.js खाली है। README_HI.md के अनुसार public URL/anon key भरें। कोई live database अपने-आप नहीं बदला गया।'); return; }
  try { const user = await requireOwner(); if (!user) { showLogin(); status('Owner account से login करें। Public registration से owner अधिकार नहीं मिलते।'); return; }
    state.user = user; $('loginPanel').hidden = recovery; $('dashboardShell').hidden = false; $('logout').hidden = false; $('recoveryForm').hidden = !recovery;
    status(`${recovery ? 'Password recovery — नया password सेव करें। ' : ''}Owner verified: ${user.email}`); await reload(); showSection(state.section);
  } catch (e) { showLogin(); status(friendlyError(e), true); }
}
async function reload() {
  const names = ['subjects', 'topics', 'parts', 'tests'];
  const responses = await Promise.all([...names.map(n => client().from('portal_' + n).select('*').order(n === 'tests' ? 'created_at' : 'sort_order', { ascending: n !== 'tests' })), client().from('portal_settings').select('*'), rpc('portal_owner_stats')]);
  for (const r of responses.slice(0, 5)) if (r.error) throw r.error;
  names.forEach((n, i) => state[n] = responses[i].data || []); state.settings = Object.fromEntries((responses[4].data || []).map(x => [x.key, x.value])); state.stats = responses[5];
  renderAll(); if (state.section === 'questions') await loadQuestions(); importer?.refresh();
}
function renderAll() {
  const labels = { subjects: 'विषय', topics: 'टॉपिक', parts: 'पार्ट', tests: 'टेस्ट', questions: 'प्रश्न', students: 'विद्यार्थी', attempts: 'Attempts', published: 'Published', drafts: 'Draft' };
  $('stats').innerHTML = Object.entries(labels).map(([k, text]) => `<div class="stat"><span>${text}</span><b>${fmt(state.stats[k] || 0)}</b></div>`).join('');
  $('recentResults').innerHTML = state.stats.recent?.length ? resultTable(state.stats.recent) : '<p class="muted">अभी कोई submitted परिणाम नहीं।</p>';
  fill('topicSubject', state.subjects, 'विषय चुनें'); fill('partTopic', state.topics, 'टॉपिक चुनें');
  state.partOptions = state.parts.map(p => [p.id, `${state.subjects.find(s => s.id === state.topics.find(t => t.id === p.topic_id)?.subject_id)?.name || ''} → ${state.topics.find(t => t.id === p.topic_id)?.name || ''} → ${p.name}`]);
  for (const id of ['questionTest', 'resultsTest', 'analyticsTest']) fill(id, state.tests, id === 'resultsTest' ? 'सभी टेस्ट' : 'टेस्ट चुनें');
  renderEntities('subject'); renderEntities('topic'); renderEntities('part'); renderTests();
  if (!$('testForm')) $('testEditor').innerHTML = testForm({}, state.partOptions || []);
  $('settingsEditor').innerHTML = settingsForm(state.settings);
}
function renderEntities(kind) {
  const parent = kind === 'topic' ? $('topicSubject').value : kind === 'part' ? $('partTopic').value : '';
  const rows = state[kind + 's'].filter(x => kind === 'subject' || !parent || x[kind === 'topic' ? 'subject_id' : 'topic_id'] === parent);
  if (!$(`${kind}Form`)) $(`${kind}Editor`).innerHTML = entityForm(kind, kind === 'topic' ? { subject_id: parent } : kind === 'part' ? { topic_id: parent } : {});
  $(`${kind}List`).innerHTML = rows.length ? rows.map(x => `<article class="item"><div class="item-head"><div><h3>${esc(x.name)}</h3><span class="pill ${x.is_active ? 'green' : ''}">${x.is_active ? 'Published' : 'Draft'}</span> <span class="muted small">क्रम ${x.sort_order}</span></div><div class="actions"><button class="btn secondary small" data-action="edit-entity" data-kind="${kind}" data-id="${x.id}">Edit</button><button class="btn danger small" data-action="delete-entity" data-kind="${kind}" data-id="${x.id}">Delete</button></div></div>${x.description ? `<p class="muted small">${esc(x.description)}</p>` : ''}</article>`).join('') : '<div class="empty">कोई record नहीं। ऊपर फ़ॉर्म से जोड़ें।</div>';
}
function renderTests() {
  $('testList').innerHTML = state.tests.length ? state.tests.map(t => `<article class="item"><div class="item-head"><div><h3>${esc(t.title)}</h3><span class="pill ${t.is_published ? 'green' : 'gold'}">${t.is_published ? 'Published' : 'Draft'}</span> <span class="muted small">${t.question_count} प्रश्न · ${t.duration_minutes} min</span></div><div class="actions"><button class="btn secondary small" data-action="edit-test" data-id="${t.id}">Edit</button><button class="btn secondary small" data-action="test-questions" data-id="${t.id}">Questions</button><button class="btn secondary small" data-action="duplicate-test" data-id="${t.id}">Duplicate</button><button class="btn ghost small" data-action="publish-test" data-id="${t.id}">${t.is_published ? 'Unpublish' : 'Publish'}</button><button class="btn ghost small" data-action="toggle-board" data-id="${t.id}">Leaderboard ${t.leaderboard_published ? 'OFF' : 'ON'}</button><button class="btn secondary small" data-action="export-test" data-id="${t.id}">JSON</button><button class="btn danger small" data-action="delete-test" data-id="${t.id}">Delete</button></div></div></article>`).join('') : '<div class="empty">अभी कोई टेस्ट नहीं। नया टेस्ट बनाएँ या TXT import करें।</div>';
}
function showSection(name) {
  state.section = name; document.querySelectorAll('.admin-section').forEach(el => el.hidden = el.id !== 'section-' + name); document.querySelectorAll('[data-section]').forEach(el => el.classList.toggle('active', el.dataset.section === name));
  if (name === 'questions') loadQuestions().catch(e => toast(friendlyError(e), 'error'));
  if (name === 'results') loadResults().catch(e => toast(friendlyError(e), 'error'));
  if (name === 'activity') loadActivity().catch(e => toast(friendlyError(e), 'error'));
}
function editTest(id) { const t = state.tests.find(x => x.id === id); showSection('tests'); $('testEditor').innerHTML = testForm(t || {}, state.partOptions || []); $('testEditorDetails').open = true; $('testEditor').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
async function loadQuestions() {
  const id = $('questionTest').value; if (!id) { state.questions = []; $('questionList').innerHTML = '<div class="empty">पहले टेस्ट चुनें या बनाएँ।</div>'; $('questionEditor').innerHTML = ''; return; }
  const { data, error } = await client().from('portal_questions').select('*').eq('test_id', id).order('position'); if (error) throw error; state.questions = data || []; renderQuestions();
  if (!$('questionForm')) $('questionEditor').innerHTML = questionForm({}, state.tests.find(t => t.id === id));
}
function renderQuestions() {
  $('questionList').innerHTML = state.questions.length ? state.questions.map((q, i) => `<article class="item"><div class="item-head"><label class="check"><input type="checkbox" data-question-select value="${q.id}"><b>${q.position}. ${esc(q.prompt_hi || q.prompt_en)}</b></label><span class="pill ${q.explanation_hi || q.explanation_en ? 'green' : 'gold'}">${q.explanation_hi || q.explanation_en ? 'Explanation ✓' : 'Explanation missing'}</span></div><div class="actions"><button class="btn secondary small" data-action="edit-question" data-id="${q.id}">Edit</button><button class="btn secondary small" data-action="move-question" data-id="${q.id}" data-direction="-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn secondary small" data-action="move-question" data-id="${q.id}" data-direction="1" ${i === state.questions.length - 1 ? 'disabled' : ''}>↓</button><button class="btn danger small" data-action="delete-question" data-id="${q.id}">Delete</button></div></article>`).join('') : '<div class="empty">इस टेस्ट में प्रश्न नहीं हैं। TXT import करें या मैन्युअल प्रश्न जोड़ें।</div>';
}
function editQuestion(id) { const q = state.questions.find(x => x.id === id); state.editingQuestion = id || null; $('questionEditor').innerHTML = questionForm(q || {}, state.tests.find(t => t.id === $('questionTest').value)); $('questionEditorDetails').open = true; $('questionEditor').scrollIntoView({ behavior: 'smooth' }); }
async function reorder(id, direction) { const ids = state.questions.map(q => q.id), i = ids.indexOf(id), j = i + Number(direction); if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; await rpc('portal_reorder_questions', { p_test_id: $('questionTest').value, p_ids: ids }); await loadQuestions(); }
async function bulk(action) {
  const ids = [...document.querySelectorAll('[data-question-select]:checked')].map(x => x.value); if (!ids.length) return toast('पहले प्रश्न चुनें।');
  const patch = {}; if (action === 'bulk-marks') { const v = prompt('प्रत्येक चुने हुए प्रश्न के अंक (खाली करने के लिए 0 लिखें):'); if (v === null) return; patch.marks = Number(v) === 0 ? null : Number(v); }
  if (action === 'bulk-tags') { const v = prompt('जोड़ने के लिए tags, comma से अलग करें:'); if (!v) return; patch.add_tags = v.split(',').map(x => x.trim()).filter(Boolean); }
  if (action === 'bulk-delete' && !confirm(`${ids.length} प्रश्न हटाएँ? पुराने attempts के snapshots सुरक्षित रहेंगे।`)) return;
  await rpc('portal_bulk_questions', { p_test_id: $('questionTest').value, p_ids: ids, p_action: action === 'bulk-delete' ? 'delete' : 'patch', p_patch: patch }); await loadQuestions(); await reload(); toast('Bulk update पूरा हुआ।');
}
function resultTable(rows) { return `<div class="table-wrap"><table><thead><tr><th>विद्यार्थी</th><th>अंक</th><th>%</th><th>Accuracy</th><th>समय</th><th>Submitted</th><th>Attempt ID</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.student_name)}</td><td>${fmt(r.marks)} / ${fmt(r.total_marks)}</td><td>${r.percentage}%</td><td>${r.accuracy ?? '—'}%</td><td>${r.time_seconds ?? '—'}s</td><td>${esc(dateText(r.submitted_at))}</td><td class="small">${esc(r.attempt_id)}</td></tr>`).join('')}</tbody></table></div>`; }
async function loadResults() { let query = client().from('portal_results').select('*').order('submitted_at', { ascending: false }).limit(500); if ($('resultsTest').value) query = query.eq('test_id', $('resultsTest').value); const { data, error } = await query; if (error) throw error; state.results = data || []; $('resultsList').innerHTML = data.length ? resultTable(data) : '<div class="empty">इस filter में कोई result नहीं।</div>'; }
async function exportResults() { if (!state.results.length) await loadResults(); const cell = v => { let s = String(v ?? ''); if (/^[=+@-]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }; const keys = ['attempt_id', 'test_id', 'student_name', 'marks', 'total_marks', 'percentage', 'accuracy', 'correct_count', 'wrong_count', 'unattempted_count', 'time_seconds', 'submitted_at']; const csv = [keys.join(','), ...state.results.map(r => keys.map(k => cell(r[k])).join(','))].join('\r\n'); download(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), 'kalam-results.csv'); }
async function loadAnalytics() { const id = $('analyticsTest').value; if (!id) return toast('टेस्ट चुनें।'); const rows = await rpc('portal_question_analytics', { p_test_id: id }); $('analyticsContent').innerHTML = rows.length ? `<div class="notice">कठिनाई = गलत उत्तर / attempted responses. बिना प्रयास वाले प्रश्न denominator में नहीं हैं। केवल चुने हुए टेस्ट के attempts शामिल हैं।</div><div class="table-wrap"><table><tr><th>प्रश्न</th><th>Question</th><th>सही</th><th>गलत</th><th>छोड़े</th><th>कठिनाई</th></tr>${rows.map(r => `<tr><td>${r.position}</td><td>${esc(r.prompt)}</td><td>${r.correct}</td><td>${r.incorrect}</td><td>${r.unattempted}</td><td>${r.difficulty ?? '—'}%</td></tr>`).join('')}</table></div>` : '<div class="empty">इस टेस्ट के submitted results अभी नहीं हैं।</div>'; }
async function loadActivity() { const { data, error } = await client().from('portal_activity_logs').select('*').order('created_at', { ascending: false }).limit(200); if (error) throw error; $('activityList').innerHTML = data.length ? data.map(x => `<div class="item"><span class="pill">${esc(x.action)}</span> <b>${esc(x.entity)}</b> <span class="muted">${esc(x.details?.name || '')}</span><br><small class="muted">${esc(dateText(x.created_at))} · ${esc(x.owner_id || 'system')}</small></div>`).join('') : '<div class="empty">कोई गतिविधि नहीं।</div>'; }
async function exportTest(id) { const { data, error } = await client().from('portal_questions').select('*').eq('test_id', id).order('position'); if (error) throw error; downloadJSON(data, `kalam-questions-${id.slice(0, 8)}.json`); }
async function restore() { const file = $('restoreFile').files[0]; if (!file) throw new Error('पहले backup JSON चुनें।'); if (file.size > 15_000_000) throw new Error('Backup file too large (15 MB maximum).'); const data = JSON.parse(await file.text()); if (data.schema_version !== 1 || !Array.isArray(data.tests)) throw new Error('यह समर्थित content backup नहीं है।'); if (prompt(`Restore ${data.tests.length} tests और ${data.questions?.length || 0} questions? मौजूदा matching IDs अपडेट होंगी। पुष्टि के लिए RESTORE लिखें:`) !== 'RESTORE') return; const result = await rpc('portal_restore', { p_backup: data, p_confirm: 'RESTORE' }); await reload(); toast(`Restore complete: ${result.restored_questions} questions.`); }
async function handleAction(button) {
  const { action, id, kind } = button.dataset;
  if (action === 'refresh') { await reload(); toast('डेटा refresh हुआ।'); }
  else if (action === 'new-test') editTest(null);
  else if (action === 'edit-test') editTest(id);
  else if (action === 'test-questions') { showSection('questions'); $('questionTest').value = id; await loadQuestions(); }
  else if (action === 'duplicate-test') { const newId = await rpc('portal_duplicate_test', { p_test_id: id }); await reload(); editTest(newId); toast('Draft copy बनाई गई। Publish अलग से करें।'); }
  else if (action === 'publish-test' || action === 'toggle-board') { const t = state.tests.find(x => x.id === id); const patch = action === 'publish-test' ? { id, is_published: !t.is_published } : { id, leaderboard_published: !t.leaderboard_published, leaderboard_enabled: true }; if (patch.is_published && !confirm('प्रश्न और सही उत्तर जाँच लिए हैं? टेस्ट publish करें?')) return; await saveRow('portal_tests', patch); await reload(); toast('Status अपडेट हुआ।'); }
  else if (action === 'delete-test') { if (!confirm('टेस्ट और उसके प्रश्न हटाएँ? Attempt history होने पर deletion सुरक्षा के लिए रुकेगा।')) return; await deleteRow('portal_tests', id); await reload(); }
  else if (action === 'export-test') await exportTest(id);
  else if (action === 'edit-entity') { const row = state[kind + 's'].find(x => x.id === id); $(`${kind}Editor`).innerHTML = entityForm(kind, row); $(`${kind}Editor`).scrollIntoView({ behavior: 'smooth' }); }
  else if (action === 'delete-entity') { const row = state[kind + 's'].find(x => x.id === id); if (!confirm(`“${row.name}” हटाएँ? जुड़े records होने पर deletion रोका जाएगा।`)) return; await deleteRow(tableFor[kind], id); await reload(); }
  else if (action === 'new-question') editQuestion(null);
  else if (action === 'edit-question') editQuestion(id);
  else if (action === 'move-question') await reorder(id, button.dataset.direction);
  else if (action === 'delete-question') { if (!confirm('यह प्रश्न हटाएँ?')) return; await deleteRow('portal_questions', id); await loadQuestions(); await reload(); }
  else if (action?.startsWith('bulk-')) await bulk(action);
  else if (action === 'load-results') await loadResults();
  else if (action === 'export-results') await exportResults();
  else if (action === 'load-analytics') await loadAnalytics();
  else if (action === 'load-activity') await loadActivity();
  else if (action === 'backup') downloadJSON(await rpc('portal_backup'), 'kalam-content-backup.json');
  else if (action === 'restore') await restore();
}
function bind() {
  document.querySelectorAll('[data-section]').forEach(b => b.onclick = () => showSection(b.dataset.section));
  document.addEventListener('click', async e => { const b = e.target.closest('[data-action]'); if (!b || !state.user) return; loading(b, true); try { await handleAction(b); } catch (err) { status(friendlyError(err), true); toast(friendlyError(err), 'error'); } finally { if (b.isConnected) loading(b, false); } });
  $('loginForm').onsubmit = async e => { e.preventDefault(); const b = e.submitter; loading(b, true); try { const f = new FormData(e.target); const { error } = await client().auth.signInWithPassword({ email: f.get('email'), password: f.get('password') }); if (error) throw error; e.target.reset(); await checkOwner(); } catch (err) { status(friendlyError(err), true); } finally { loading(b, false); } };
  $('resetPassword').onclick = async () => { try { const email = $('loginForm').elements.email.value.trim(); if (!email) throw new Error('पहले email लिखें।'); const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: new URL('admin.html', location.href).href }); if (error) throw error; status('यदि account मौजूद है तो reset email भेजा गया है। Spam folder भी देखें।'); } catch (err) { status(friendlyError(err), true); } };
  $('recoveryForm').onsubmit = async e => { e.preventDefault(); try { const password = new FormData(e.target).get('password'); const { error } = await client().auth.updateUser({ password }); if (error) throw error; $('recoveryForm').hidden = true; $('loginPanel').hidden = true; status('Password अपडेट हुआ।'); } catch (err) { status(friendlyError(err), true); } };
  $('logout').onclick = async () => { const { error } = await client().auth.signOut(); if (error) return toast(error.message, 'error'); showLogin(); status('Securely logged out.'); };
  $('topicSubject').onchange = () => { $('topicEditor').innerHTML = entityForm('topic', { subject_id: $('topicSubject').value }); renderEntities('topic'); };
  $('partTopic').onchange = () => { $('partEditor').innerHTML = entityForm('part', { topic_id: $('partTopic').value }); renderEntities('part'); };
  $('questionTest').onchange = () => loadQuestions().catch(e => toast(e.message, 'error'));
  $('resultsTest').onchange = () => loadResults().catch(e => toast(e.message, 'error'));
  document.addEventListener('submit', async e => {
    const form = e.target, formId = form.getAttribute('id');
    if (!['subjectForm', 'topicForm', 'partForm', 'testForm', 'questionForm', 'settingsForm'].includes(formId)) return;
    e.preventDefault(); const b = e.submitter; loading(b, true);
    try {
      if (['subjectForm', 'topicForm', 'partForm'].includes(formId)) { const kind = form.dataset.kind, row = readEntity(form); if (form.elements.image?.files[0]) row.image_path = await uploadImage(form.elements.image.files[0], false); await saveRow(tableFor[kind], row); form.reset(); $(`${kind}Editor`).innerHTML = entityForm(kind); await reload(); }
      else if (formId === 'testForm') { const row = readTest(form); if (!row.part_id || !row.title) throw new Error('Part और Test title चुनें/भरें।'); const saved = await saveRow('portal_tests', row); await reload(); editTest(saved.id); }
      else if (formId === 'questionForm') { const old = state.questions.find(q => q.id === form.elements.id.value); const row = readQuestion(form, old?.position || Math.max(0, ...state.questions.map(q => q.position)) + 1); if (form.elements.image.files[0]) row.image_path = await uploadImage(form.elements.image.files[0], true); if (form.elements.explanation_image.files[0]) row.explanation_image_path = await uploadImage(form.elements.explanation_image.files[0], true); await saveRow('portal_questions', row); await loadQuestions(); editQuestion(null); await reload(); }
      else if (formId === 'settingsForm') { const f = new FormData(form); for (const key of ['announcement', 'registration_enabled', 'premium_enabled', 'maintenance_mode']) { const value = key === 'announcement' ? String(f.get(key) || '') : f.has(key); const { error } = await client().from('portal_settings').upsert({ key, value }); if (error) throw error; } await reload(); }
      toast('सहेज दिया गया / Saved.'); status('सहेज दिया गया / Saved.');
    } catch (err) { status(friendlyError(err), true); toast(friendlyError(err), 'error'); } finally { if (b?.isConnected) loading(b, false); }
  });
  $('questionEditor').onclick = e => { if (e.target.closest('[data-add-option]')) { const box = $('optionEditors'); if (box.children.length >= 8) return toast('अधिकतम 8 विकल्प।'); box.insertAdjacentHTML('beforeend', optionEditor({}, box.children.length)); } if (e.target.closest('[data-remove-option]')) { const box = $('optionEditors'); if (box.children.length <= 2) return toast('कम से कम 2 विकल्प जरूरी हैं।'); e.target.closest('[data-option]').remove(); [...box.children].forEach((r, i) => { r.querySelector('[type=radio]').value = i; }); } };
}
async function init() {
  bind(); importer = initImporter({ state, reload, status, editTest, showSection });
  if (!configured()) { showLogin(); status('Supabase सेटअप बाकी है। config.js में केवल public URL/anon key भरें और README_HI.md के अनुसार schema व exam function deploy करें। Live Supabase को छुआ नहीं गया है।'); return; }
  await checkOwner(); client().auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') showLogin(); if (event === 'PASSWORD_RECOVERY') setTimeout(() => checkOwner(true), 0); if (event === 'TOKEN_REFRESHED') setTimeout(() => requireOwner().catch(e => { showLogin(); status(friendlyError(e), true); }), 0); });
}
init().catch(e => { showLogin(); status(friendlyError(e), true); });
