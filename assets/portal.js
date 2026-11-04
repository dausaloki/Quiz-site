import { $, esc, cfg, configured, rpc, publicMedia, dateText, setupShell, language, pick, friendlyError } from './shared.js';
let catalog = { subjects: [], topics: [], parts: [], tests: [], settings: {} };
let route = {};
function readRoute() { const p = new URLSearchParams(location.hash.slice(1)); route = { subject: p.get('subject') || '', topic: p.get('topic') || '', part: p.get('part') || '' }; }
function go(next) { route = { ...route, ...next }; const p = new URLSearchParams(); for (const [k, v] of Object.entries(route)) if (v) p.set(k, v); history.pushState(null, '', '#' + p.toString()); render(); }
function card({ title, description = '', image = '', tag = '', onClick, href, footer = '' }) {
  const el = document.createElement('article'); el.className = 'card subject-card';
  const src = publicMedia(image);
  el.innerHTML = `${src ? `<img loading="lazy" alt="">` : '<div class="subject-icon">📚</div>'}<div class="item-head"><h3>${esc(title)}</h3>${tag ? `<span class="pill gold">${esc(tag)}</span>` : ''}</div><p class="muted">${esc(description)}</p>${footer}<div class="actions">${href ? `<a class="btn ghost" href="${esc(href)}">टेस्ट देखें →</a>` : '<button class="btn ghost" type="button">खोलें →</button>'}</div>`;
  if (src) el.querySelector('img').src = src;
  if (onClick) el.querySelector('button').onclick = onClick;
  return el;
}
function grid(items) { const el = document.createElement('div'); el.className = 'grid'; el.append(...items); return el; }
function empty(text) { const el = document.createElement('div'); el.className = 'empty'; el.textContent = text; return el; }
function crumbs() {
  const box = $('crumb'); box.replaceChildren(); const add = (text, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = fn; box.append(b); };
  add('सभी विषय', () => go({ subject: '', topic: '', part: '' }));
  const s = catalog.subjects.find(x => x.id === route.subject), t = catalog.topics.find(x => x.id === route.topic), p = catalog.parts.find(x => x.id === route.part);
  if (s) { box.append(' / '); add(s.name, () => go({ topic: '', part: '' })); }
  if (t) { box.append(' / '); add(t.name, () => go({ part: '' })); }
  if (p) { box.append(' / '); box.append(p.name); }
}
function testCard(t) {
  const available = t.status === 'available'; const tag = t.status === 'upcoming' ? 'जल्द शुरू' : t.status === 'closed' ? 'समाप्त' : t.practice_mode ? 'Practice' : 'Test';
  const footer = `<p class="small muted">${t.question_count} प्रश्न · ${t.duration_minutes} मिनट${t.starts_at ? `<br>शुरू: ${esc(dateText(t.starts_at))}` : ''}${t.ends_at ? `<br>समाप्ति: ${esc(dateText(t.ends_at))}` : ''}</p>`;
  return card({ title: t.title, description: t.category, tag, footer, href: available ? `exam.html?id=${encodeURIComponent(t.id)}` : undefined, onClick: undefined });
}
function render() {
  readRoute(); crumbs(); const content = $('catalogContent'); content.replaceChildren();
  const query = $('search').value.trim().toLocaleLowerCase(), category = $('categoryFilter').value, status = $('statusFilter').value;
  if (query || category || status) {
    const match = x => `${x.name || x.title || ''} ${x.description || ''} ${x.category || ''}`.toLocaleLowerCase().includes(query);
    if (query) {
      const items = [...catalog.subjects.filter(match).map(s => card({ title: s.name, description: s.description, image: s.image_path, tag: 'विषय', onClick: () => { $('search').value = ''; go({ subject: s.id, topic: '', part: '' }); } })), ...catalog.topics.filter(match).map(t => card({ title: t.name, description: t.description, image: t.image_path, tag: 'टॉपिक', onClick: () => { $('search').value = ''; go({ subject: t.subject_id, topic: t.id, part: '' }); } }))];
      if (items.length) { const h = document.createElement('h3'); h.textContent = 'विषय और टॉपिक'; content.append(h, grid(items)); }
    }
    const tests = catalog.tests.filter(t => match(t) && (!category || t.category === category) && (!status || t.status === status) && (!route.part || t.part_id === route.part));
    const h = document.createElement('h3'); h.textContent = `${tests.length} टेस्ट`; content.append(h, tests.length ? grid(tests.map(testCard)) : empty('कोई मेल खाता टेस्ट नहीं मिला। खोज या filter बदलें।')); return;
  }
  const part = catalog.parts.find(x => x.id === route.part), topic = catalog.topics.find(x => x.id === route.topic), subject = catalog.subjects.find(x => x.id === route.subject);
  if (part) { const tests = catalog.tests.filter(t => t.part_id === part.id); content.append(tests.length ? grid(tests.map(testCard)) : empty('इस पार्ट में अभी कोई प्रकाशित टेस्ट नहीं है।')); }
  else if (topic) { const parts = catalog.parts.filter(p => p.topic_id === topic.id); content.append(parts.length ? grid(parts.map(p => card({ title: p.name, description: p.description, tag: 'Part', onClick: () => go({ part: p.id }) }))) : empty('इस टॉपिक में अभी पार्ट नहीं जोड़े गए हैं।')); }
  else if (subject) { const topics = catalog.topics.filter(t => t.subject_id === subject.id); content.append(topics.length ? grid(topics.map(t => card({ title: t.name, description: t.description, image: t.image_path, tag: 'टॉपिक', onClick: () => go({ topic: t.id, part: '' }) }))) : empty('इस विषय में अभी टॉपिक नहीं जोड़े गए हैं।')); }
  else content.append(catalog.subjects.length ? grid(catalog.subjects.map(s => card({ title: s.name, description: s.description, image: s.image_path, tag: 'विषय', onClick: () => go({ subject: s.id, topic: '', part: '' }) }))) : empty('अभी कोई विषय प्रकाशित नहीं है। Owner Panel से विषय, टॉपिक, पार्ट और टेस्ट जोड़ें।'));
  for (const el of content.querySelectorAll('.card')) { const a = el.querySelector('a.btn'); if (a?.getAttribute('href') === undefined) { const b = el.querySelector('button'); if (b && !b.onclick) { b.disabled = true; b.textContent = 'उपलब्ध नहीं'; } } }
}
async function init() {
  setupShell(); readRoute(); $('search').oninput = render; $('categoryFilter').onchange = render; $('statusFilter').onchange = render; window.addEventListener('popstate', render); document.addEventListener('kk-language', render);
  if (!configured()) { $('catalogStatus').textContent = 'Cloud सेटअप बाकी है। Owner को config.js और Supabase schema सेट करना है। कोई नकली विषय/टेस्ट नहीं दिखाया गया है। संरक्षित अक्टूबर सुजस टेस्ट ऊपर उपलब्ध है।'; render(); return; }
  try { catalog = await rpc('portal_catalog'); const categories = [...new Set(catalog.tests.map(t => t.category).filter(Boolean))]; for (const c of categories) { const o = document.createElement('option'); o.value = c; o.textContent = c; $('categoryFilter').append(o); } $('catalogStatus').hidden = true; if (catalog.settings.maintenance_mode) { $('catalogStatus').hidden = false; $('catalogStatus').textContent = 'Maintenance mode: नए attempts अस्थायी रूप से बंद हैं।'; } render(); }
  catch (e) { $('catalogStatus').textContent = friendlyError(e); $('catalogStatus').classList.add('error'); render(); }
}
init();
