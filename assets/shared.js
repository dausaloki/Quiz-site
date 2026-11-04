export const $ = id => document.getElementById(id);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const cfg = () => window.PORTAL_CONFIG || {};
export const configured = () => Boolean(cfg().supabaseUrl && cfg().supabaseAnonKey && window.supabase?.createClient);
export const uuid = () => crypto.randomUUID();
export const num = (v, fallback = 0) => v === '' || v === null || v === undefined ? fallback : Number(v);
export const fmt = v => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(Number(v || 0));
export const dateText = v => v ? new Date(v).toLocaleString('hi-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const language = () => localStorage.getItem('kk3:language') === 'en' ? 'en' : 'hi';
export const pick = (obj, field, lang = language()) => obj?.[`${field}_${lang}`] || obj?.[`${field}_hi`] || obj?.[`${field}_en`] || '';
export const storage = { get(key, fallback = null) { try { return JSON.parse(localStorage.getItem('kk3:' + key)) ?? fallback; } catch { return fallback; } }, set(key, value) { try { localStorage.setItem('kk3:' + key, JSON.stringify(value)); } catch { toast('Device storage is full or unavailable. Keep this page open.', 'error'); } }, remove(key) { localStorage.removeItem('kk3:' + key); } };
let sb;
export function client() { if (!configured()) throw new Error('Supabase सेटअप बाकी है। config.js में Project URL और केवल public/anon key भरें। पुराना अक्टूबर टेस्ट बिना cloud सेटअप के उपलब्ध है।'); if (!sb) sb = window.supabase.createClient(cfg().supabaseUrl, cfg().supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); return sb; }
export async function rpc(name, args = {}) { const { data, error } = await client().rpc(name, args); if (error) throw new Error(friendlyError(error)); return data; }
export async function exam(action, payload = {}) {
  const { data, error } = await client().functions.invoke(cfg().examFunctionName || 'exam', { body: { action, ...payload } });
  if (error) { let message = error.message; try { const body = await error.context?.json(); if (body?.error) message = body.error; } catch {} throw new Error(friendlyError({ message })); }
  if (data?.error) throw new Error(friendlyError(data.error)); return data;
}
export function friendlyError(error) {
  const m = typeof error === 'string' ? error : error?.message || 'अनुरोध पूरा नहीं हुआ। दोबारा प्रयास करें।';
  if (/PGRST202|Could not find the function|schema cache/i.test(m)) return 'Database functions अभी इंस्टॉल नहीं हैं। README_HI.md के अनुसार supabase/schema.sql चलाएँ।';
  if (/Failed to fetch|NetworkError|fetch failed/i.test(m)) return 'सर्वर से संपर्क नहीं हुआ। इंटरनेट और Supabase URL/Edge Function जाँचें। आपका स्थानीय draft सुरक्षित है।';
  if (/JWT expired|session.*expired/i.test(m)) return 'Session समाप्त हो गई। दोबारा login करें।';
  if (/ATTEMPT_EXPIRED/.test(m)) return 'समय समाप्त हो गया। जमा हुए उत्तरों के साथ टेस्ट Submit करें।';
  if (/QUESTION_EXPIRED/.test(m)) return 'इस प्रश्न का समय समाप्त हो गया। अगला उपलब्ध प्रश्न खोलें।';
  return m.replace(/<[^>]*>/g, '');
}
export async function requireOwner() { const { data: { user }, error } = await client().auth.getUser(); if (error || !user) return null; const allowed = await rpc('portal_is_owner'); if (!allowed) { await client().auth.signOut(); throw new Error('यह अकाउंट owner allowlist में नहीं है। Access denied.'); } return user; }
export function publicMedia(path) { const s = String(path || ''); if (s.startsWith('portal-public/')) return `${cfg().supabaseUrl}/storage/v1/object/public/${s.slice('portal-public/'.length)}`; if (/^https:\/\//i.test(s) || /^assets\//.test(s)) return s; return ''; }
export function toast(message, type = 'info') { let el = $('kk-toast'); if (!el) { el = document.createElement('div'); el.id = 'kk-toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.append(el); } el.textContent = message; el.className = `show ${type}`; clearTimeout(el._timer); el._timer = setTimeout(() => el.className = '', 5500); }
export function loading(button, yes, label = 'कृपया प्रतीक्षा करें…') { if (!button) return; if (yes) { button.dataset.label = button.textContent; button.textContent = label; button.disabled = true; } else { button.textContent = button.dataset.label || button.textContent; button.disabled = false; } }
export function download(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
export function downloadJSON(value, filename) { download(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }), filename); }
export async function uploadImage(file, isPrivate = true) {
  if (!file) return '';
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('केवल PNG/JPEG/WebP, अधिकतम 5 MB।');
  const { data: { user } } = await client().auth.getUser(); if (!user) throw new Error('Login required');
  const bucket = isPrivate ? 'portal-private' : 'portal-public'; const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type]; const path = `${user.id}/${uuid()}.${ext}`;
  const { error } = await client().storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false }); if (error) throw error; return `${bucket}/${path}`;
}
export function bindLanguage(button) { if (!button) return; const paint = () => button.textContent = language() === 'hi' ? 'English' : 'हिंदी'; paint(); button.onclick = () => { localStorage.setItem('kk3:language', language() === 'hi' ? 'en' : 'hi'); paint(); document.dispatchEvent(new CustomEvent('kk-language')); }; }
export function setupShell() { const announcement = $('announcement'); if (announcement && configured()) rpc('portal_catalog').then(d => { const text = d.settings?.announcement || ''; announcement.textContent = text; announcement.hidden = !text; }).catch(() => {}); bindLanguage($('languageToggle')); }
export const ownerTables = new Set(['portal_subjects', 'portal_topics', 'portal_parts', 'portal_tests', 'portal_questions']);
export async function saveRow(table, row) { if (!ownerTables.has(table)) throw new Error('Invalid table'); const payload = { ...row }; const id = payload.id; delete payload.id; const query = id ? client().from(table).update(payload).eq('id', id) : client().from(table).insert(payload); const { data, error } = await query.select().single(); if (error) throw error; return data; }
export async function deleteRow(table, id) { if (!ownerTables.has(table)) throw new Error('Invalid table'); const { error } = await client().from(table).delete().eq('id', id); if (error) throw new Error(/foreign key/i.test(error.message) ? 'पहले इससे जुड़े records हटाएँ/archive करें। Attempt history सुरक्षित रखने के लिए deletion रोका गया है।' : error.message); }
export function errorMessage(el, error) { el.textContent = friendlyError(error); el.classList.add('error-text'); }
