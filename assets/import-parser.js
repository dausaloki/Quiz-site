/* Flexible, deterministic MCQ importer. No network calls and no silent question filtering. */
export const LIMITS = Object.freeze({ bytes: 2_000_000, questions: 1000, options: 8, regex: 180 });
const ANSWER = /^(?:correct\s*answer|correct\s*ans|answer|ans|सही\s*उत्तर|उत्तर)\s*(?:[:：\-–=]\s*)?(.*)$/i;
const EXPLAIN = /^(?:explanation|explain|solution|व्याख्या|हल|समाधान)\s*[:：\-–=]\s*(.*)$/i;
const SOURCE = /^(?:reference|source|स्रोत|संदर्भ)\s*[:：\-–=]\s*(.*)$/i;
const Q_NUMBER = /^(?:(?:q(?:uestion)?)\s*[.#:]?\s*(\d+)\s*[.)\]:\-]?\s*|प्रश्न\s*(\d+)?\s*[.):\-=]?\s*|(\d+)\s*[.)\]:\-]\s*)(.*)$/i;
const LETTER_OPTION = /^(?:\(\s*([A-Ha-h])\s*\)|([A-Ha-h])\s*[).:\-])\s*(.*)$/;
const NUMBER_OPTION = /^(?:\(\s*([1-8])\s*\)|([1-8])\s*[).:\-])\s*(.*)$/;
const DEV_DIGITS = '०१२३४५६७८९';
const clean = s => String(s ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const key = s => clean(s).toLocaleLowerCase().replace(/[।.?!,;:'"()[\]{}\-_*]/g, '');
const devToAscii = s => String(s).replace(/[०-९]/g, d => String(DEV_DIGITS.indexOf(d)));
export function hashText(text) { let h = 2166136261; for (const c of key(text)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }
export function safeMediaPath(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^https:\/\//i.test(s) || /^portal-(public|private)\/[^\s?#]+$/.test(s) || /^assets\/[^\s?#]+$/.test(s)) {
    if (!s.split('/').includes('..')) return s;
  }
  return null;
}
function questionMatch(text) {
  const m = text.match(Q_NUMBER);
  if (!m) return null;
  // A bare numeric option is handled separately. Devanagari/English words need a real prefix.
  return { number: m[1] || m[2] || m[3] || null, text: m[4] || '' };
}
function optionMatch(text) {
  let m = text.match(LETTER_OPTION);
  if (m) return { index: (m[1] || m[2]).toUpperCase().charCodeAt(0) - 65, label: (m[1] || m[2]).toUpperCase(), text: m[3] || '' };
  m = text.match(NUMBER_OPTION);
  if (m) return { index: Number(m[1] || m[2]) - 1, label: String(Number(m[1] || m[2])), text: m[3] || '' };
  return null;
}
function inlineOptions(text) {
  const re = /(?:^|\s)(?:\(([A-Ha-h]|[1-8])\)|([A-Ha-h]|[1-8])[).:])/g;
  const marks = []; let m;
  while ((m = re.exec(text))) marks.push({ index: m.index, end: re.lastIndex, label: m[1] || m[2] });
  if (marks.length < 2 || marks[0].index !== 0) return null;
  return marks.map((x, i) => {
    const raw = `${x.label}) ${text.slice(x.end, marks[i + 1]?.index ?? text.length).trim()}`;
    return optionMatch(raw);
  }).filter(Boolean);
}
function addOption(q, opt, line) {
  if (q._labels.has(opt.index)) { q.errors.push(`Duplicate option label ${opt.label} at line ${line}`); q._extraOptions.push(opt.text); }
  else { q._labels.add(opt.index); q.options[opt.index] = opt.text; }
  q._context = 'option'; q._optionIndex = opt.index;
}
function parseAnswer(raw, options) {
  let s = devToAscii(clean(raw)).replace(/^\*\*|\*\*$/g, '');
  s = s.replace(/^(?:option|विकल्प)\s*/i, '');
  const m = s.match(/^\(?([A-Ha-h1-8कखगघङचछज])\)?(?:[.)\]:\-]|\s|$)/);
  if (m) {
    const ch = m[1].toUpperCase();
    if (/^[A-H]$/.test(ch)) return ch.charCodeAt(0) - 65;
    if (/^[1-8]$/.test(ch)) return Number(ch) - 1;
    const i = 'कखगघङचछज'.indexOf(ch); if (i >= 0) return i;
  }
  const exact = options.findIndex(o => key(o) && key(o) === key(s));
  return exact >= 0 ? exact : null;
}
function newBlock(number, text, line) {
  return { source_number: number ? Number(number) : null, prompt: text, options: [], correct_index: null,
    explanation: '', reference: '', image_path: '', explanation_image_path: '', source_start: line, source_end: line, source_text: '',
    errors: [], warnings: [], _labels: new Set(), _extraOptions: [], _context: 'prompt', _optionIndex: -1, _answerRaw: null };
}
function finishBlock(q, all) {
  q.source_end = q._lastLine || q.source_start;
  q.options = Array.from({ length: q.options.length }, (_, i) => String(q.options[i] ?? '').trim());
  if (q._extraOptions.length) q.warnings.push('Duplicate-label continuation retained in source; correct the option manually.');
  if (q._answerRaw !== null) q.correct_index = parseAnswer(q._answerRaw, q.options);
  if (q._answerRaw !== null && q.correct_index === null) q.errors.push(`Unrecognized answer: ${q._answerRaw}`);
  if (q._answerRaw !== null && q.correct_index >= q.options.length) q.errors.push('Answer points to a missing option.');
  if (q._labels.size && (q._labels.size !== q.options.length || Math.max(...q._labels) !== q.options.length - 1)) q.errors.push('Option labels have a gap; a missing option may exist.');
  q.prompt = q.prompt.trim(); q.explanation = q.explanation.trim(); q.reference = q.reference.trim();
  q.duplicate_of = null;
  const fingerprint = hashText(q.prompt + '\n' + q.options.join('\n'));
  q.fingerprint = fingerprint;
  const prior = all.find(x => x.fingerprint === fingerprint);
  if (prior) { q.duplicate_of = prior.source_start; q.warnings.push(`Possible duplicate of question starting at line ${prior.source_start}. Both are retained.`); }
  all.push(q);
}
function append(q, text) {
  if (q._context === 'prompt') q.prompt += (q.prompt ? '\n' : '') + text;
  else if (q._context === 'option' && q._optionIndex >= 0) q.options[q._optionIndex] += '\n' + text;
  else if (q._context === 'explanation') q.explanation += (q.explanation ? '\n' : '') + text;
  else if (q._context === 'reference') q.reference += (q.reference ? '\n' : '') + text;
  else if (q._context === 'answer') { q._answerRaw += ' ' + text; q.warnings.push('Continuation after answer retained; verify the answer field.'); }
}
function imageField(q, value, explanation, line) {
  const path = safeMediaPath(value);
  if (path === null) { q.warnings.push(`Unsafe or unsupported image URL at line ${line}; original retained in source.`); return; }
  q[explanation ? 'explanation_image_path' : 'image_path'] = path;
}
export function parseTxt(input, options = {}) {
  if (typeof input !== 'string') throw new TypeError('TXT input must be a string.');
  if (new TextEncoder().encode(input).length > LIMITS.bytes) throw new Error('TXT exceeds the 2 MB limit. Split the file; no questions were imported.');
  const original = input;
  const normalized = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
  const lines = normalized.split('\n');
  if (lines.length > 40000) throw new Error('TXT has too many lines. Split it into smaller files.');
  const questions = [], preamble = [], diagnostics = []; let cur = null; let offset = 0;
  const flush = () => { if (cur) { finishBlock(cur, questions); cur = null; } };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], lineNo = i + 1;
    let text = raw.trim().replace(/^#{1,6}\s+/, '').replace(/^\*\*(.*)\*\*$/, '$1').trim();
    const start = offset; offset += raw.length + 1;
    if (!text) continue;
    const qm = questionMatch(text), om = optionMatch(text);
    const numeric = om && /^[1-8]$/.test(om.label);
    const nextQuestion = qm && (!numeric || !cur || cur._answerRaw !== null || cur._context === 'explanation' || cur._context === 'reference' ||
      (cur.options.filter(Boolean).length >= 2 && qm.number && cur.source_number && Number(qm.number) === cur.source_number + 1 && (/[?？]/.test(qm.text) || qm.text.length > 25)));
    if (nextQuestion) {
      flush(); cur = newBlock(qm.number, qm.text, lineNo); cur._offset = start;
      const inline = inlineOptions(cur.prompt);
      if (inline) { cur.prompt = ''; inline.forEach(o => addOption(cur, o, lineNo)); }
      else {
        const marker = cur.prompt.match(/\s(?:\([A-Ha-h1-8]\)|[A-Ha-h1-8][).:])/);
        if (marker) { const tail = cur.prompt.slice(marker.index + 1), split = inlineOptions(tail); if (split) { cur.prompt = cur.prompt.slice(0, marker.index).trim(); split.forEach(o => addOption(cur, o, lineNo)); } }
      }
      continue;
    }
    if (!cur) { preamble.push({ line: lineNo, text: raw }); continue; }
    cur._lastLine = lineNo;
    const inline = inlineOptions(text);
    if (inline && (cur._context === 'prompt' || cur._context === 'option')) { inline.forEach(o => addOption(cur, o, lineNo)); continue; }
    if (om) { addOption(cur, om, lineNo); continue; }
    let m = text.match(/^(?:(?:explanation|solution)\s*image|व्याख्या\s*चित्र)\s*[:：\-]\s*(.*)$/i);
    if (m) { imageField(cur, m[1], true, lineNo); continue; }
    m = text.match(/^(?:(?:question\s*)?image|चित्र)\s*[:：\-]\s*(.*)$/i);
    if (m) { imageField(cur, m[1], false, lineNo); continue; }
    m = text.match(/^!\[[^\]]*\]\(([^)]+)\)$/);
    if (m) { imageField(cur, m[1], cur._context === 'explanation', lineNo); continue; }
    m = text.match(ANSWER);
    // Do not mistake a prompt beginning “Answer the following…” for an answer declaration.
    const hindiPrompt = /^(?:उत्तर|सही\s*उत्तर)\s+(?:निम्न|दिए|बताइए|लिखिए|दीजिए|कथन)/i.test(text);
    if (m && !hindiPrompt && (/[:：\-–=]/.test(text.slice(0, 35)) || /^(?:correct\s*answer|correct\s*ans|ans|उत्तर|सही\s*उत्तर)\b/i.test(text) || /^[A-H1-8क-ज)(.\s]+$/i.test(m[1]))) {
      if (cur._answerRaw !== null) cur.warnings.push(`Multiple answer declarations at line ${lineNo}; the last is shown for correction.`);
      cur._answerRaw = m[1].trim(); cur._context = 'answer'; continue;
    }
    m = text.match(EXPLAIN); if (m) { cur.explanation += (cur.explanation ? '\n' : '') + m[1]; cur._context = 'explanation'; continue; }
    m = text.match(SOURCE); if (m) { cur.reference += (cur.reference ? '\n' : '') + m[1]; cur._context = 'reference'; continue; }
    append(cur, text);
  }
  flush();
  for (const q of questions) {
    const endOffset = q.source_end === lines.length ? normalized.length : lines.slice(0, q.source_end).join('\n').length;
    q.source_text = normalized.slice(q._offset || 0, endOffset).trim();
    for (const k of ['_labels', '_extraOptions', '_context', '_optionIndex', '_answerRaw', '_offset', '_lastLine']) delete q[k];
    const v = validateQuestion(q, options.existingQuestions || []);
    q.errors.push(...v.errors); q.warnings.push(...v.warnings);
    if (options.language) Object.assign(q, { language: options.language });
  }
  if (!questions.length) diagnostics.push({ level: 'error', message: 'No confident question boundaries found. Use manual field mapping; the entire original text is retained.' });
  if (preamble.length) diagnostics.push({ level: 'info', message: `${preamble.length} non-question lines before the first question are retained as preamble, not imported as questions.` });
  if (questions.length > LIMITS.questions) diagnostics.push({ level: 'error', message: `Detected ${questions.length} questions; split into batches of at most ${LIMITS.questions}. None were discarded.` });
  const numbers = questions.map(q => q.source_number).filter(Number.isFinite);
  if (new Set(numbers).size !== numbers.length) diagnostics.push({ level: 'warning', message: 'Repeated question numbers detected; source order is preserved.' });
  return { questions, preamble, diagnostics, original, summary: summarize(questions, diagnostics) };
}

export function emptyQuestion(language = 'hi') {
  return { prompt_hi: '', prompt_en: '', options: Array.from({ length: 4 }, () => ({ hi: '', en: '' })), correct_index: null,
    explanation_hi: '', explanation_en: '', reference: '', image_path: '', explanation_image_path: '', tags: [], marks: null, language };
}
export function normalizeQuestion(input, language = 'hi') {
  const q = emptyQuestion(language);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Each JSON question must be an object.');
  const lang = input.language === 'en' ? 'en' : language;
  q.prompt_hi = String(input.prompt_hi ?? (lang === 'hi' ? input.prompt ?? input.question ?? '' : ''));
  q.prompt_en = String(input.prompt_en ?? (lang === 'en' ? input.prompt ?? input.question ?? '' : ''));
  const sourceOptions = Array.isArray(input.options) ? input.options : [];
  q.options = sourceOptions.map(o => typeof o === 'object' && o !== null ? { hi: String(o.hi ?? ''), en: String(o.en ?? '') } : { hi: lang === 'hi' ? String(o ?? '') : '', en: lang === 'en' ? String(o ?? '') : '' });
  q.correct_index = input.correct_index === null || input.correct_index === undefined || input.correct_index === '' ? null : Number(input.correct_index);
  q.explanation_hi = String(input.explanation_hi ?? (lang === 'hi' ? input.explanation ?? '' : ''));
  q.explanation_en = String(input.explanation_en ?? (lang === 'en' ? input.explanation ?? '' : ''));
  for (const k of ['reference', 'image_path', 'explanation_image_path']) q[k] = String(input[k] ?? '');
  q.tags = Array.isArray(input.tags) ? input.tags.map(String) : typeof input.tags === 'string' ? input.tags.split(',').map(x => x.trim()).filter(Boolean) : [];
  q.marks = input.marks === null || input.marks === undefined || input.marks === '' ? null : Number(input.marks);
  q.language = lang;
  return q;
}
export function toDraftQuestion(q, language = 'hi') {
  const n = normalizeQuestion(q, language);
  const lang = q.language === 'en' ? 'en' : language;
  const text = s => String(s || '').trim();
  n.prompt = text(q.prompt ?? q[`prompt_${lang}`] ?? q.prompt_hi ?? q.prompt_en);
  n.options = (q.options || []).map(o => text(typeof o === 'string' ? o : o?.[lang] || o?.hi || o?.en));
  n.explanation = text(q.explanation ?? q[`explanation_${lang}`] ?? q.explanation_hi ?? q.explanation_en);
  return n;
}
export function validateQuestion(input, existing = []) {
  const q = toDraftQuestion(input, input.language || 'hi'), errors = [], warnings = [];
  if (!q.prompt) errors.push('Question text is missing.');
  if (q.prompt.length > 20000) errors.push('Question text exceeds 20,000 characters.');
  if (q.options.length < 2 || q.options.length > LIMITS.options) errors.push('Provide 2–8 options (and match the test option-count setting).');
  if ([...q.options].some(o => !o)) errors.push('One or more options are missing.');
  if (q.options.some(o => o.length > 4000)) errors.push('An option exceeds 4,000 characters.');
  if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= q.options.length) errors.push('Select one valid correct answer.');
  if (!q.explanation) warnings.push('Explanation is missing; import is still allowed.');
  if (new Set(q.options.filter(Boolean).map(key)).size !== q.options.filter(Boolean).length) warnings.push('Two options have the same text.');
  for (const k of ['image_path', 'explanation_image_path']) if (safeMediaPath(q[k]) === null) errors.push(`${k}: use HTTPS or a portal-public/ or portal-private/ storage path.`);
  if (q.marks !== null && (!Number.isFinite(q.marks) || q.marks <= 0)) errors.push('Question marks must be positive or blank.');
  if (q.tags.length > 30 || q.tags.some(t => t.length > 100)) errors.push('Use at most 30 tags, each up to 100 characters.');
  const fingerprint = hashText(q.prompt + '\n' + q.options.join('\n'));
  if (existing.some(x => hashText(toDraftQuestion(x).prompt + '\n' + toDraftQuestion(x).options.join('\n')) === fingerprint)) warnings.push('Possible duplicate of an existing question; it has not been discarded.');
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], fingerprint };
}
export function summarize(questions, diagnostics = []) {
  const valid = q => validateQuestion(q).errors.length === 0;
  return { total: questions.length, valid: questions.filter(valid).length,
    missing_answers: questions.filter(q => !Number.isInteger(q.correct_index) || q.correct_index < 0).length,
    missing_options: questions.filter(q => q.options.length < 2 || [...q.options].some(o => !(typeof o === 'string' ? o : o?.hi || o?.en))).length,
    missing_explanations: questions.filter(q => !String(q.explanation ?? q.explanation_hi ?? q.explanation_en ?? '').trim()).length,
    duplicates: questions.filter(q => q.duplicate_of || q.warnings?.some(w => /duplicate of/i.test(w))).length,
    parsing_errors: questions.filter(q => !valid(q)).length + diagnostics.filter(d => d.level === 'error').length };
}
export function parseJsonQuestions(text, language = 'hi') {
  const data = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!Array.isArray(data)) throw new Error('JSON must be an array of question objects.');
  if (data.length > LIMITS.questions) throw new Error('Maximum 1000 questions per import.');
  const questions = data.map((x, i) => {
    const q = normalizeQuestion(x, language); const d = toDraftQuestion(q, language);
    Object.assign(d, { source_number: i + 1, source_text: JSON.stringify(x, null, 2), source_start: i + 1, source_end: i + 1, errors: [], warnings: [] });
    const v = validateQuestion(q); d.errors = v.errors; d.warnings = v.warnings; d.fingerprint = v.fingerprint; return d;
  });
  return { questions, preamble: [], diagnostics: [], original: text, summary: summarize(questions) };
}
export function parseMappedBlocks(text, mapping) {
  // Owner-supplied field labels are literal labels, not executable regular expressions.
  if (new TextEncoder().encode(text).length > LIMITS.bytes) throw new Error('Input exceeds 2 MB.');
  const escape = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const separator = mapping.separator === 'blank' ? /\n\s*\n/ : new RegExp('^' + escape(mapping.separator || '---') + '\\s*$', 'm');
  const blocks = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(separator).filter(x => x.trim());
  const labels = { question: mapping.question || 'Question:', option: mapping.option || '', answer: mapping.answer || 'Answer:', explanation: mapping.explanation || 'Explanation:' };
  const questions = [];
  blocks.forEach((block, i) => {
    const q = newBlock(i + 1, '', i + 1); q.source_text = block;
    let context = 'prompt';
    for (const raw of block.split('\n')) {
      const line = raw.trim(); if (!line) { append(q, ''); continue; }
      if (labels.question && line.startsWith(labels.question)) { q.prompt += line.slice(labels.question.length).trim(); context = 'prompt'; continue; }
      if (labels.answer && line.startsWith(labels.answer)) { q._answerRaw = line.slice(labels.answer.length).trim(); context = 'answer'; continue; }
      if (labels.explanation && line.startsWith(labels.explanation)) { q.explanation += line.slice(labels.explanation.length).trim(); context = 'explanation'; continue; }
      const om = labels.option ? optionMatch(line.replace(new RegExp('^' + escape(labels.option)), '')) : optionMatch(line);
      if (om) { addOption(q, om, i + 1); continue; }
      append(q, line);
    }
    finishBlock(q, questions);
    for (const k of ['_labels', '_extraOptions', '_context', '_optionIndex', '_answerRaw', '_lastLine']) delete q[k];
    const v = validateQuestion(q); q.errors.push(...v.errors); q.warnings.push(...v.warnings);
  });
  return { questions, original: text, preamble: [], diagnostics: questions.length ? [] : [{ level: 'error', message: 'No blocks matched. Edit the mapping or use the manual question editor.' }], summary: summarize(questions) };
}
if (typeof window !== 'undefined') window.KKImport = { parseTxt, parseJsonQuestions, parseMappedBlocks, normalizeQuestion, emptyQuestion, toDraftQuestion, validateQuestion, summarize, safeMediaPath, LIMITS };
