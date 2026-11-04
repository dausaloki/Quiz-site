import { $, esc, rpc, saveRow, uploadImage, toast, loading, friendlyError, num } from './shared.js';
import { parseTxt, parseJsonQuestions, parseMappedBlocks, validateQuestion, summarize, normalizeQuestion, LIMITS } from './import-parser.js';
import { TEST_DEFAULTS } from './admin-forms.js';
export function initImporter(ctx) {
  let questions = [], original = '', filename = '', diagnostics = [], preamble = [], language = 'hi';
  const draft = () => ({ prompt: '', options: ['', '', '', ''], correct_index: null, explanation: '', reference: '', image_path: '', explanation_image_path: '', tags: [], marks: null, language, errors: [], warnings: [], source_text: 'Manually entered question', source_start: null });
  function validate() {
    const seen = new Map();
    for (const q of questions) { const v = validateQuestion(q, []); q.errors = v.errors; q.warnings = [...(q.sourceWarnings || []), ...v.warnings].filter(w => !/Possible duplicate/i.test(w)); q.duplicate_of = null; const key = String(q.prompt || '').trim().toLocaleLowerCase() + '\n' + q.options.map(o => String(o || '').trim().toLocaleLowerCase()).join('\n'); if (seen.has(key)) { q.duplicate_of = seen.get(key); q.warnings.push(`Possible duplicate of preview question ${seen.get(key) + 1}. Both are retained.`); } else seen.set(key, questions.indexOf(q)); }
    const target = ctx.state.tests.find(t => t.id === $('importTarget').value), count = target ? target.option_count : Number($('importOptionCount').value);
    if (count > 0) for (const q of questions) if (q.options.length !== count) q.errors.push(`इस टेस्ट में ठीक ${count} विकल्प चाहिए।`);
    if (questions.length > LIMITS.questions) diagnostics = [{ level: 'error', message: 'अधिकतम 1000 प्रश्न प्रति import।' }];
    paintSummary();
  }
  function paintSummary() {
    const s = summarize(questions, diagnostics); const labels = { total: 'कुल पहचाने', valid: 'सही parsed', missing_answers: 'उत्तर बाकी', missing_options: 'विकल्प बाकी', missing_explanations: 'व्याख्या बाकी', duplicates: 'संभावित duplicate', parsing_errors: 'त्रुटियाँ' };
    $('importSummary').innerHTML = Object.entries(labels).map(([k, v]) => `<div><span>${v}</span><b>${s[k]}</b></div>`).join('');
    $('importSavePanel').hidden = !questions.length; $('saveImport').disabled = !questions.length || s.parsing_errors > 0;
    $('importDiagnostics').innerHTML = diagnostics.map(d => `<div class="notice ${d.level === 'error' ? 'error' : ''}">${esc(d.message)}</div>`).join('');
    return s;
  }
  function accept(result, name) {
    questions = result.questions; original = result.original; filename = name; diagnostics = result.diagnostics || []; preamble = result.preamble || [];
    for (const q of questions) { q.language = language; q.sourceWarnings = [...q.warnings]; }
    $('importOriginal').textContent = original + (preamble.length ? '\n\n--- Preamble (not silently imported) ---\n' + preamble.map(x => `${x.line}: ${x.text}`).join('\n') : '');
    $('importOriginalDetails').hidden = !original; $('mappingSource').value = original;
    if (!questions.length) $('mappingPanel').hidden = false;
    if (!$('importTitle').value) $('importTitle').value = name.replace(/\.(txt|json)$/i, '');
    validate(); render(); $('importStatus').textContent = `${questions.length} प्रश्न पहचाने गए। नीचे प्रत्येक प्रश्न, विकल्प, उत्तर और व्याख्या जाँचें। त्रुटियाँ सुधारने के बाद ही draft सेव होगा।`;
  }
  function render() {
    $('importPreview').innerHTML = questions.map((q, i) => `<article class="card editor-card ${q.errors.length ? 'has-error' : ''}" data-import-question="${i}"><div class="item-head"><h3>प्रश्न ${i + 1}${q.source_start ? ` <small class="muted">· source line ${q.source_start}</small>` : ''}</h3><div class="actions"><button class="btn secondary small" data-import-move="-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn secondary small" data-import-move="1" ${i === questions.length - 1 ? 'disabled' : ''}>↓</button><button class="btn danger small" data-import-remove>हटाएँ</button></div></div><label>प्रश्न / Question</label><textarea data-field="prompt" rows="3">${esc(q.prompt)}</textarea><label>विकल्प / Options</label><div>${q.options.map((o, j) => `<div class="toolbar" style="margin:5px 0"><input data-import-option="${j}" value="${esc(o)}" aria-label="Question ${i + 1} option ${j + 1}"><button class="btn secondary small" data-import-remove-option="${j}" aria-label="Remove option">×</button></div>`).join('')}</div><button class="btn secondary small" data-import-add-option>+ विकल्प</button><div class="form-grid" style="margin-top:14px"><div><label>सही उत्तर *</label><select data-field="correct_index"><option value="">— उत्तर चुनें —</option>${q.options.map((_, j) => `<option value="${j}" ${q.correct_index === j ? 'selected' : ''}>${String.fromCharCode(65 + j)} / ${j + 1}</option>`).join('')}</select></div><div><label>अंक (खाली = test default)</label><input data-field="marks" type="number" min="0.0001" step="0.0001" value="${esc(q.marks ?? '')}"></div></div><label>व्याख्या / Explanation (वैकल्पिक, multiline)</label><textarea data-field="explanation" rows="4">${esc(q.explanation)}</textarea><label>Reference / स्रोत</label><input data-field="reference" value="${esc(q.reference)}"><div class="form-grid"><div><label>प्रश्न image URL/path</label><input data-field="image_path" value="${esc(q.image_path)}"><input type="file" data-import-image="image_path" accept="image/png,image/jpeg,image/webp" aria-label="Upload question image"></div><div><label>व्याख्या image URL/path</label><input data-field="explanation_image_path" value="${esc(q.explanation_image_path)}"><input type="file" data-import-image="explanation_image_path" accept="image/png,image/jpeg,image/webp" aria-label="Upload explanation image"></div></div><div data-validation>${validationHTML(q)}</div><details><summary>मूल TXT / source block देखें</summary><pre>${esc(q.source_text || q.prompt)}</pre></details></article>`).join('');
    paintSummary();
  }
  function validationHTML(q) { return `${q.errors.map(x => `<p class="error-text small">⚠ ${esc(x)}</p>`).join('')}${q.warnings.map(x => `<p class="gold small">ⓘ ${esc(x)}</p>`).join('')}`; }
  function updateCard(card, q) { card.classList.toggle('has-error', q.errors.length > 0); card.querySelector('[data-validation]').innerHTML = validationHTML(q); }
  async function parseFile() {
    const file = $('importFile').files[0]; if (!file) throw new Error('पहले TXT या JSON फ़ाइल चुनें।'); if (file.size > LIMITS.bytes) throw new Error('फ़ाइल 2 MB से बड़ी है। छोटे भागों में import करें।');
    language = $('importLanguage').value; const text = await file.text();
    const result = /\.json$/i.test(file.name) ? parseJsonQuestions(text, language) : parseTxt(text, { language, existingQuestions: [] }); accept(result, file.name);
  }
  async function save() {
    validate(); const summary = paintSummary(); if (!questions.length || summary.parsing_errors) throw new Error('सभी parsing errors सुधारें; कोई invalid प्रश्न चुपचाप नहीं छोड़ा जाएगा।');
    if (summary.duplicates && !confirm(`${summary.duplicates} संभावित duplicate हैं। फिर भी सभी प्रश्न सेव करें?`)) return;
    let target = ctx.state.tests.find(t => t.id === $('importTarget').value); const mode = target ? $('importMode').value : 'replace';
    if (!target) { const part = $('importPart').value, title = $('importTitle').value.trim(), duration = num($('importDuration').value); if (!part || !title || duration <= 0) throw new Error('नए draft के लिए Part, title और अवधि भरें।'); target = await saveRow('portal_tests', { ...TEST_DEFAULTS, part_id: part, title, duration_minutes: duration, option_count: Number($('importOptionCount').value), default_language: language, is_published: false }); }
    if (target.is_published) throw new Error('Published टेस्ट में import नहीं होगा। पहले unpublish करें।');
    const canonical = questions.map(q => { const n = normalizeQuestion(q, language); delete n.id; return n; });
    const result = await rpc('portal_import_questions', { p_test_id: target.id, p_questions: canonical, p_mode: mode, p_filename: filename || 'manual-entry.txt', p_source: original || questions.map(q => q.source_text || q.prompt).join('\n\n'), p_summary: summary });
    await ctx.reload(); questions = []; original = ''; diagnostics = []; preamble = []; render(); $('importOriginalDetails').hidden = true; $('importStatus').textContent = `${result.imported} प्रश्न draft में सेव हुए (कुल ${result.question_count})। Test ID: ${result.test_id}. अभी publish नहीं हुआ। Test Builder में settings और explanations जाँचकर अलग से Publish करें।`; toast('Import saved as DRAFT.'); ctx.showSection('tests'); ctx.editTest(result.test_id);
  }
  function refresh() {
    const targetValue = $('importTarget').value, partValue = $('importPart').value;
    $('importTarget').innerHTML = '<option value="">+ नया draft test</option>' + ctx.state.tests.filter(t => !t.is_published).map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('');
    $('importPart').innerHTML = '<option value="">पार्ट चुनें</option>' + ctx.state.parts.map(p => `<option value="${p.id}">${esc(p.name)} · ${esc(ctx.state.topics.find(t => t.id === p.topic_id)?.name || '')}</option>`).join('');
    if ([...$('importTarget').options].some(o => o.value === targetValue)) $('importTarget').value = targetValue;
    if ([...$('importPart').options].some(o => o.value === partValue)) $('importPart').value = partValue;
    $('importNewFields').hidden = Boolean($('importTarget').value); validate();
  }
  const safe = fn => async e => { const b = e.currentTarget; loading(b, true); try { await fn(e); } catch (err) { $('importStatus').textContent = friendlyError(err); $('importStatus').classList.add('error'); toast(friendlyError(err), 'error'); } finally { if (b.isConnected) loading(b, false); } };
  $('parseImport').onclick = safe(parseFile); $('saveImport').onclick = safe(save);
  $('showMapping').onclick = () => { $('mappingPanel').hidden = !$('mappingPanel').hidden; if (!$('mappingSource').value) $('mappingSource').value = original; };
  $('manualQuestion').onclick = () => { language = $('importLanguage').value; questions.push(draft()); validate(); render(); $('importPreview').lastElementChild?.scrollIntoView({ behavior: 'smooth' }); };
  $('applyMapping').onclick = safe(async () => { language = $('importLanguage').value; const result = parseMappedBlocks($('mappingSource').value, { question: $('mapQuestion').value, option: $('mapOption').value, answer: $('mapAnswer').value, explanation: $('mapExplanation').value, separator: $('mapSeparator').value }); accept(result, filename || 'mapped-import.txt'); });
  $('importTarget').onchange = refresh; $('importOptionCount').onchange = () => { validate(); [...$('importPreview').children].forEach((c, i) => updateCard(c, questions[i])); };
  $('importPreview').addEventListener('input', e => { const card = e.target.closest('[data-import-question]'); if (!card) return; const q = questions[Number(card.dataset.importQuestion)], field = e.target.dataset.field; if (e.target.dataset.importOption !== undefined) q.options[Number(e.target.dataset.importOption)] = e.target.value; else if (field) q[field] = field === 'correct_index' ? e.target.value === '' ? null : Number(e.target.value) : field === 'marks' ? e.target.value === '' ? null : Number(e.target.value) : e.target.value; validate(); updateCard(card, q); });
  $('importPreview').addEventListener('change', async e => { const field = e.target.dataset.importImage; if (!field || !e.target.files[0]) return; const card = e.target.closest('[data-import-question]'), q = questions[Number(card.dataset.importQuestion)]; try { q[field] = await uploadImage(e.target.files[0], true); card.querySelector(`[data-field="${field}"]`).value = q[field]; validate(); updateCard(card, q); toast('Private image uploaded.'); } catch (err) { toast(friendlyError(err), 'error'); } });
  $('importPreview').addEventListener('click', e => { const card = e.target.closest('[data-import-question]'); if (!card) return; const i = Number(card.dataset.importQuestion), q = questions[i]; let structural = false;
    if (e.target.closest('[data-import-remove]')) { if (!confirm('यह preview प्रश्न हटाएँ? मूल TXT ऊपर सुरक्षित रहेगा।')) return; questions.splice(i, 1); structural = true; }
    else if (e.target.closest('[data-import-move]')) { const j = i + Number(e.target.closest('[data-import-move]').dataset.importMove); if (j >= 0 && j < questions.length) { [questions[i], questions[j]] = [questions[j], questions[i]]; structural = true; } }
    else if (e.target.closest('[data-import-add-option]')) { if (q.options.length >= 8) return toast('अधिकतम 8 विकल्प।'); q.options.push(''); structural = true; }
    else if (e.target.closest('[data-import-remove-option]')) { if (q.options.length <= 2) return toast('कम से कम 2 विकल्प।'); const j = Number(e.target.closest('[data-import-remove-option]').dataset.importRemoveOption); q.options.splice(j, 1); if (q.correct_index === j) q.correct_index = null; else if (q.correct_index > j) q.correct_index--; structural = true; }
    if (structural) { validate(); render(); }
  });
  refresh(); return { refresh };
}
