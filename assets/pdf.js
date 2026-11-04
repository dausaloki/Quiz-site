import { esc, cfg, pick, language, download, toast } from './shared.js';
import { clockText } from './exam-core.js';
let libraries;
function loadScript(src) { return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('PDF library load failed: ' + src)); document.head.append(s); }); }
async function libs() { if (!libraries) libraries = (async () => { if (!window.jspdf) await loadScript('assets/vendor/jspdf.umd.min.js'); if (!window.html2canvas) await loadScript('assets/vendor/html2canvas.min.js'); })(); return libraries; }
const text = (q, field) => pick(q, field, language());
const optionText = o => o[language()] || o.hi || o.en || '';
function chunks(value, size = 900) { const s = String(value || ''); if (!s) return []; const out = []; let rest = s; while (rest.length > size) { let at = rest.lastIndexOf(' ', size); if (at < size / 2) at = size; out.push(rest.slice(0, at)); rest = rest.slice(at).trim(); } if (rest) out.push(rest); return out; }
function items(r, mode) {
  const out = [];
  out.push(`<h2>${mode === 'summary' ? 'Result summary / परिणाम' : mode === 'explanations' ? 'Explanations / व्याख्या' : 'Answer key & solutions'}</h2><p><b>${esc(r.student_name)}</b> · ${esc(r.test_title)}</p><p style="font-size:11px">Attempt ID: ${esc(r.attempt_id)}</p><div><span class="pdf-metric">Marks: <b>${r.marks}/${r.total_marks}</b></span><span class="pdf-metric">Percentage: ${r.percentage}%</span><span class="pdf-metric">Accuracy: ${r.accuracy}%</span><span class="pdf-metric">Correct: ${r.correct_count}</span><span class="pdf-metric">Incorrect: ${r.wrong_count}</span><span class="pdf-metric">Unattempted: ${r.unattempted_count}</span><span class="pdf-metric">Attempted: ${r.attempted_count}/${r.total_questions}</span><span class="pdf-metric">Time: ${clockText(r.time_seconds * 1000)}</span><span class="pdf-metric">Rank: ${r.rank ?? '—'}</span></div>`);
  if (mode !== 'summary') for (const q of r.questions || []) {
    const prompt = text(q, 'prompt'), parts = chunks(prompt); const heading = `<h3>प्रश्न / Question ${q.position}</h3>`;
    parts.forEach((p, i) => out.push(`<div class="pdf-question">${i === 0 ? heading : ''}<p style="white-space:pre-wrap">${esc(p)}</p>${i === 0 && q.image_url ? `<img src="${esc(q.image_url)}" crossorigin="anonymous" alt="Question image">` : ''}</div>`));
    if (!parts.length) out.push(`<div class="pdf-question">${heading}</div>`);
    if (mode === 'answers') {
      out.push(`<div class="pdf-question">${(q.options || []).map((o, i) => `<p style="color:${i === q.correct_index ? '#176443' : i === q.selected_index ? '#9c3545' : '#13213a'}">(${String.fromCharCode(65 + i)}) ${esc(optionText(o))}${i === q.correct_index ? ' ✓ Correct' : i === q.selected_index ? ' ← Your answer' : ''}</p>`).join('')}<p><b>Your answer:</b> ${q.selected_index == null ? 'Unattempted' : String.fromCharCode(65 + q.selected_index)} · <b>Correct:</b> ${String.fromCharCode(65 + q.correct_index)} · ${esc(q.status)}</p></div>`);
    }
    if (mode === 'explanations') {
      const explanation = text(q, 'explanation') || 'व्याख्या उपलब्ध नहीं / No explanation supplied.';
      chunks(explanation).forEach((p, i) => out.push(`<div class="pdf-question">${i === 0 ? '<h3>व्याख्या / Explanation</h3>' : ''}<p style="white-space:pre-wrap">${esc(p)}</p></div>`));
      if (q.explanation_image_url) out.push(`<div class="pdf-question"><img src="${esc(q.explanation_image_url)}" crossorigin="anonymous" alt="Explanation image"></div>`);
      if (q.reference) chunks(q.reference, 1000).forEach(p => out.push(`<div class="pdf-question"><b>Reference:</b> ${esc(p)}</div>`));
    }
  }
  return out;
}
async function waitImages(root) { await Promise.all([...root.querySelectorAll('img')].map(img => new Promise(resolve => { const done = () => resolve(); const timer = setTimeout(() => { img.replaceWith(document.createTextNode('[Image unavailable]')); resolve(); }, 7000); if (img.complete) { clearTimeout(timer); done(); } else { img.onload = () => { clearTimeout(timer); done(); }; img.onerror = () => { clearTimeout(timer); img.replaceWith(document.createTextNode('[Image unavailable]')); resolve(); }; } }))); }
export async function buildResultPdf(result, mode = 'summary', onProgress = () => {}) {
  const s = result.settings || {};
  if (mode === 'summary' && !s.result_pdf_enabled) throw new Error('Result PDF is disabled by the owner.');
  if (mode === 'answers' && (!s.answer_key_pdf_enabled || !s.solutions_enabled)) throw new Error('Answer-key PDF is disabled by the owner.');
  if (mode === 'explanations' && (!s.explanation_pdf_enabled || !s.explanations_enabled || !s.solutions_enabled)) throw new Error('Explanation PDF is disabled by the owner.');
  await libs(); if (document.fonts?.ready) await document.fonts.ready;
  const root = document.createElement('div'); root.className = 'pdf-render'; root.setAttribute('aria-hidden', 'true'); document.body.append(root);
  const pages = []; let body;
  const newPage = () => { const page = document.createElement('section'); page.innerHTML = `<div style="border-bottom:3px solid #cba844;padding-bottom:12px;margin-bottom:18px"><h1>✍️ कलम से क्रांति ✍️</h1><p>${esc(result.test_title)}</p></div><div class="pdf-body"></div><div class="pdf-footer">✍️ कलम से क्रांति ✍️ · Telegram: @kalam_kranti<br>Owner: @lokesh_dausa · Instagram: @lokesh_dausa1 · Page ${pages.length + 1}</div>`; root.append(page); pages.push(page); body = page.querySelector('.pdf-body'); };
  try {
    newPage();
    for (const html of items(result, mode)) { const item = document.createElement('div'); item.innerHTML = html; body.append(item); if (body.scrollHeight > 900 && body.children.length > 1) { item.remove(); newPage(); body.append(item); } }
    await waitImages(root); const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    for (let i = 0; i < pages.length; i++) { onProgress(i + 1, pages.length); const canvas = await html2canvas(pages[i], { scale: 1.5, backgroundColor: '#ffffff', logging: false, useCORS: true, windowWidth: 1000 }); if (i) pdf.addPage(); pdf.addImage(canvas.toDataURL('image/jpeg', .88), 'JPEG', 0, 0, 210, 297); await new Promise(r => setTimeout(r, 0)); }
    pdf.setProperties({ title: `${result.test_title} — ${mode}`, subject: 'Kalam Se Kranti examination result', author: 'Kalam Se Kranti' }); return pdf.output('blob');
  } finally { root.remove(); }
}
export function pdfName(r, mode) { return `Kalam-Se-Kranti-${mode}-${String(r.attempt_id).slice(0, 8)}.pdf`; }
export function downloadPdf(blob, name) { download(blob, name); }
export function printPdf(blob, name) { const url = URL.createObjectURL(blob); const w = window.open(url, '_blank'); if (!w) { download(blob, name); toast('Popup blocked: PDF डाउनलोड किया गया। खोलकर Print करें।'); } setTimeout(() => URL.revokeObjectURL(url), 60000); }
export async function sharePdf(blob, name) { const file = new File([blob], name, { type: 'application/pdf' }); if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'कलम से क्रांति — Result', text: 'Telegram: @kalam_kranti' }); return; } catch (e) { if (e.name === 'AbortError') return; } } download(blob, name); toast('इस browser में file share उपलब्ध नहीं। PDF डाउनलोड करके साझा करें।'); }
