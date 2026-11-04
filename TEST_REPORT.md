# TEST REPORT — Kalam Se Kranti FULL PROJECT

दिनांक: 2026-11-04 (Asia/Calcutta)  
स्थिति: **स्थानीय सत्यापन पूर्ण; live Supabase/GitHub deployment नहीं किया गया।**

## 1. सारांश

| Suite | कमांड | परिणाम |
|---|---|---:|
| Parser / Core / Scoring / Edge unit | `npm test` | **25/25 PASS** |
| PGlite migrations + RLS + exam engine | `npm run test:db` | **24/24 PASS** |
| Chromium + WebKit/iPhone + Android-width UI | `npm run test:browser` | **11/11 PASS** |
| Combined runner | `npm run test:all` | **3/3 suites PASS** |
| Release file/hash/schema/config checks | `npm run verify:release` | **117/117 PASS** (`RELEASE_VERIFICATION.json`) |

कच्चे logs: `test-results/unit-edge.log`, `test-results/database.log`, `test-results/browser.log`, `test-results/all-report.json`।  
Browser screenshots: `test-results/home-iphone.png` (यदि browser suite चला हो)।

## 2. वातावरण

- Node.js v20.20.2, npm 10.8.2, Python 3.13.16
- Playwright 1.56.1: Chromium 141.0.7390.37 (build 1194), WebKit 26.0 (build 2215)
- PGlite 0.3.14 (PostgreSQL WASM) — auth/storage stubs के साथ
- Static preview: `tools/serve.py` (0.0.0.0, no-store)
- कोई live Supabase URL/key उपयोग नहीं; browser tests में test-only transport mock।

## 3. Unit + Edge (25)

- Timer countdown/clock, palette states, auto-next skip, student validation, leaderboard tie ranking।
- Edge CORS allow/deny + preflight; capability/mobile hashing; caller JWT forwarding; service key browser में नहीं।
- Invalid action/secret/oversized body; private history/result auth; rate-limit 429; SQLSTATE 42501 → 403; private/public/HTTPS media signing।
- TXT/JSON/mapped import: 8 mixed-format questions, multiline explanations, references, images, variable options, BOM/CRLF, invalid retained, duplicates, oversized fail।
- Hindi prompt guard: `उत्तर निम्नलिखित…` को answer key नहीं माना जाता।
- Scoring: per-question negative ratio, marks override, max marks, all unattempted/incorrect।

## 4. Database (24)

- सभी 6 migrations apply; legacy `exam_results` row सुरक्षित।
- Anonymous published-only catalog; questions/owners/results direct read denied।
- Non-owner owner tools denied; settings write affectedRows=0।
- Owner allowlist self-read only; client insert denied।
- Exam payload hides keys; server negative marking; duplicate submit idempotent।
- Wrong secret/cross-test question rejected; start nonce idempotency।
- Draft/unpublished ancestors blocked; schedule server-enforced (`upcoming`)।
- Per-question deadline persisted, no reset on revisit, locks answers।
- Overall expiry auto-submits saved answers; later changes rejected।
- Practice mode explicit feedback exception।
- Immutable question/marking snapshots during active attempt।
- Solution/explanation/PDF switches enforced on result retrieval।
- Leaderboard test-scoped, consent anonymization, unpublish।
- Account-private history; guest capability cannot enumerate results।
- TXT import draft-only; invalid batch atomic rollback।
- Duplicate/reorder/bulk/analytics/backup-restore; restore publication ordering सुरक्षित।
- Premium default OFF; enabling requires active membership।
- Registration/maintenance switches; private/public storage policies।
- Distributed rate limit service-only।
- SQL ↔ JS scoring parity across marking patterns।
- **Owner read-only RLS** on attempts/answers/question_times/results/activity_logs; writes denied/0 rows।
- Bulk edit validates marks/tag payloads।

## 5. Browser / mobile (11)

1. Catalog hierarchy Subject→Topic→Part→Test, search, filters, deep links।
2. Owner CRUD, full test builder, draft-only TXT import (8 questions), question explanation correction, duplicate test।
3. Invalid TXT retained, corrected in preview, never auto-saved।
4. Exam navigation/review/resume, server submit, solutions, **explicit PDF download**, share fallback download, print popup-blocked fallback, populated leaderboard, local history।
5. Overall timer auto-submit without confirmation।
6. Leaderboard/history empty-state pages।
7. Legacy October exam: 50 questions, answer, star, submit, result, PDF blob >10 KB, localStorage receipt।
8. Unauthorized owner account blocked (allowlist)।
9. Per-question deadline locks palette and skips expired questions।
10. Android 360×740: index/admin/exam/leaderboard/history/legacy no horizontal overflow।
11. WebKit/iPhone 390×844: index/admin/exam/legacy no horizontal overflow।

## 6. Browser verification में पकड़े और सुधारे गए वास्तविक bugs

- Admin forms में `name="id"` hidden input के कारण `form.id` shadow हो रहा था → submit handler अब `getAttribute('id')` उपयोग करता है। CRUD वास्तव में save होता है।
- `friendlyError()` में `/ATTEMPT_EXPIRED/` और `/QUESTION_EXPIRED/` regex literal truthy थे → हर error गलत संदेश दिखा रहा था; अब `.test(m)`।
- Exam overall timer `attempt.expires_at` पढ़ रहा था जबकि `attempt` केवल ID string था → `expiresAt` state जोड़ा; auto-submit सत्यापित।
- PDF में केवल print control था → अलग **डाउनलोड**, **Print**, **Share** buttons; A4 page CSS/pagination सुधारा।
- Question expired होने पर late local answer revert के लिए server progress refresh जोड़ा।
- Owner RLS को attempts/results/audit पर SELECT-only किया; सभी writes SECURITY DEFINER functions से।
- Submit scoring loop में `ans` प्रति प्रश्न reset स्पष्ट किया।
- Admin field IDs अद्वितीय; `document.partOptions` expando हटाकर state में लाया।
- Import duplicate warnings अब preview corrections के बाद पुनः गणना होते हैं।

## 7. मूल स्रोत संरक्षण

`legacy/SHA256SUMS.txt` में 13 प्रविष्टियाँ: 10 source uploads + root October/reference/checklist।  
मुख्य hashes:

- October/old index: `0ed841afbd872f342de3e46294436fa8fd05897de851682d8942d4e5cbf0fb0a`
- Reference original: `67f35fffc27c3739b6407a4e8cffc5e5e7830e9d1962a5f53e280de099546701`
- Latest index-2: `a711fb5ca9639e40d0b7e661091d886b293a972b1aa4e61252c8e398740558b7`
- Latest admin-2: `3c8513beb443d6ab919b8a7c4255b10fa5830c2d16538cb72f64c47b17852955`
- Latest exam: `e4ac860d6d41373b6d9574d40f39b3125c32889fb3e2c8755c77e0225ff30d89`

`npm run verify:release` प्रत्येक hash मिलाता है।

## 8. जो सत्यापित नहीं है (ईमानदार सीमाएँ)

- वास्तविक Supabase Auth (magic link/password), live RLS, deployed Edge Function, real Storage signed URLs।
- वास्तविक भुगतान/premium webhook; केवल entitlement architecture default OFF।
- प्रति-प्रश्न timer strict anti-cheat नहीं; sanitized payload में सभी प्रश्न होते हैं, server answer deadline lock enforce करता है।
- अत्यधिक बड़े PDF/images पर low-end device प्रदर्शन; production निगरानी/backups।
- GitHub Pages deployment; केवल local static preview और automated browsers।

## 9. पुनः चलाने की कमांड

```bash
npm install
npx playwright install chromium webkit
npx playwright install-deps chromium webkit   # Linux may need sudo
npm run test:all
npm run verify:release
```

यदि `test-results/` मौजूद नहीं है तो runner इसे बनाता है। Browser suite आवश्यकता पर port 8091 पर अस्थायी static server स्वयं शुरू/बंद करता है।
