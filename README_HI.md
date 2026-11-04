# ✍️ कलम से क्रांति ✍️ — FULL PROJECT (Hindi/English)

यह पैकेज **स्थानीय रूप से विकसित और सत्यापित** संस्करण है। इसमें मूल अक्टूबर सुजस टेस्ट और सभी अपलोड किए गए स्रोत बिना बदले सुरक्षित हैं, और नया Subject → Topic → Part → Test पोर्टल, Owner Admin Panel, Supabase schema/RLS, Edge Function, परीक्षा इंजन, PDF, leaderboard और history शामिल हैं।

> **महत्वपूर्ण:** इस पैकेज ने आपके GitHub या live Supabase project को **नहीं** छुआ है। `config.js` जानबूझकर खाली है। कोई service-role key, database password या निजी secret शामिल नहीं है। Live deployment से पहले staging project पर पूरा परीक्षण करें।

---

## 1. तुरंत लोकल प्रीव्यू (बिना Supabase)

```bash
cd kalam-se-kranti
python3 tools/serve.py 8080
# browser: http://localhost:8080
```

- नया पोर्टल/Admin/Exam cloud सेटअप के बिना **setup notice** दिखाएगा; यह सही व्यवहार है।
- **पुराना अक्टूबर टेस्ट** `october-sujas-test-01.html` बिना cloud के पूरा चलता है (50 प्रश्न, timer, palette, result, PDF)।
- Node.js 20+ चाहिए यदि आप tests/build चलाते हैं। केवल static preview के लिए Python काफी है।

## 2. फ़ाइल मानचित्र

| क्षेत्र | फ़ाइलें |
|---|---|
| Student portal | `index.html`, `assets/js/portal.js` |
| Owner admin | `admin.html`, `assets/js/admin.js`, `admin-forms.js`, `admin-import.js` |
| Exam | `exam.html`, `assets/js/exam.js`, `exam-core.js` |
| Result/PDF | `result.html`, `assets/js/result.js`, `pdf.js` |
| Leaderboard/History | `leaderboard.html/js`, `history.html/js` |
| Shared/theme | `assets/js/shared.js`, `assets/css/portal.css` |
| TXT/JSON importer | `assets/js/import-parser.js`, `examples/` |
| Supabase | `supabase/migrations/0001…0006.sql`, `supabase/schema.sql`, `supabase/config.toml` |
| Edge Function | `supabase/functions/exam/index.ts`, `_shared/handler.js`, `_shared/scoring.js` |
| Vendor (offline) | `assets/vendor/supabase.js`, `jspdf.umd.min.js`, `html2canvas.min.js` + licenses |
| संरक्षित मूल | `october-sujas-test-01.html`, `REFERENCE_ORIGINAL_UNCHANGED.html`, `REFERENCE_FEATURES.md`, `legacy/source-uploads/`, `legacy/SHA256SUMS.txt` |
| Tests | `tests/*.test.mjs`, `tests/browser.mjs`, `tests/db-harness.mjs` |
| Tools | `tools/serve.py`, `vendor.mjs`, `build-schema.mjs`, `test-all.mjs`, `verify-release.mjs` |
| Docs | `README_HI.md`, `TEST_REPORT.md`, `docs/AUDIT_AND_MISSING_FEATURES.md` |

## 3. Supabase सेटअप (मैनुअल — live पर स्वतः नहीं चला)

### 3.1 Schema

1. Supabase में **नया/staging project** बनाएँ।
2. SQL Editor में `supabase/schema.sql` चलाएँ। यह छह migrations का संयोजन है और **legacy tables को drop नहीं करता**।
3. क्रमशः migrations भी चला सकते हैं: `0001_schema` → `0002_security` → `0003_exam_engine` → `0004_owner_tools` → `0005_storage_and_guards` → `0006_bulk_edit`।
4. Storage buckets `portal-public` और `portal-private` migration से बनते हैं। Public bucket के thumbnails सार्वजनिक हैं; प्रश्न/व्याख्या images निजी bucket में signed URLs से खुलते हैं।

### 3.2 Owner allowlist

केवल Supabase Auth से login करना owner अधिकार **नहीं** देता। Owner UUID को allowlist में डालें:

```sql
-- Supabase Dashboard → Authentication → Users से owner का UUID लें
insert into public.portal_owners (user_id) values ('OWNER-UUID-HERE');
```

- Public registration से कोई owner नहीं बन सकता।
- Owner केवल content/settings/memberships/import logs लिख सकता है।
- Attempts/answers/results/activity logs पर owner को भी केवल **SELECT** मिलता है; सभी writes SECURITY DEFINER functions से होते हैं।

### 3.3 Public config

`config.js` में केवल **public** मान भरें:

```js
window.PORTAL_CONFIG = {
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR-PUBLIC-ANON-KEY',
  examFunctionName: 'exam',
  premiumEnabled: false
};
```

`config.example.js` नमूना है। **service_role key कभी browser में न डालें।**

### 3.4 Edge Function

```bash
supabase functions deploy exam --no-verify-jwt
supabase secrets set \
  ALLOWED_ORIGINS="https://YOUR-USERNAME.github.io,http://localhost:8080" \
  RATE_LIMIT_PEPPER="$(openssl rand -hex 32)" \
  MOBILE_HASH_PEPPER="$(openssl rand -hex 32)"
```

- Function guest capability secret और mobile number को hash करके RPC को भेजता है।
- Caller का JWT आगे भेजा जाता है; service key केवल server-side rate-limit/media signing के लिए है।
- `ALLOWED_ORIGINS` में अपना static host जोड़ें। E2B/preview origin अलग हो तो उसे भी जोड़ें।
- Body limit 64 KiB; rate limits: start 12/min, अन्य 240/min प्रति hashed IP।

## 4. Owner Admin Panel उपयोग

1. **Subjects → Topics → Parts** बनाएँ। प्रकाशित/अप्रकाशित नियंत्रित करें।
2. **Tests** में नया test बनाएँ: अवधि, प्रति-प्रश्न सेकंड, अंक, negative ratio, max/passing marks, option count, schedule, visibility, practice/resume, solutions/explanations, PDF switches, leaderboard, premium flag।
3. **Import TXT/JSON**:
   - अलग-अलग layouts: `Q1.`, `1.`, `प्रश्न 1:`, options `(A)/A./1)`, answers `Answer:/Correct Answer:/उत्तर:`, explanations multiline।
   - JSON legacy/bilingual और explicit field mapping भी समर्थित।
   - Preview में हर प्रश्न, विकल्प, सही उत्तर, व्याख्या, reference, images, marks सुधारें।
   - गलत प्रश्न चुपचाप नहीं छोड़े जाते; errors सुधारने तक save disabled।
   - Import **हमेशा draft** में जाता है। Published test में import नहीं होगा।
4. **Questions**: manual edit, reorder, bulk marks/tags/delete, duplicate test, JSON export।
5. **Results/Analytics/Activity**: CSV export, question difficulty, audit log।
6. **Backup/Restore**: JSON backup; restore के लिए `RESTORE` टाइप करना अनिवार्य। Restore questions load होने के बाद ही publication पुनः लागू करता है।
7. **Settings**: announcement, registration, maintenance, premium enforcement (default OFF)।

## 5. परीक्षा, परिणाम, PDF

- Student नाम (वैकल्पिक mobile) से guest attempt शुरू कर सकता है; signed-in account history भी मिलती है।
- Server deadlines authoritative हैं; overall timer समाप्त होने पर auto-submit।
- प्रति-प्रश्न timer पहली बार खोलने पर शुरू होता है, revisit पर reset नहीं होता।
- Palette: answered / visited / review / answered+review / locked / current।
- Submit से पहले उत्तर बदल सकते हैं; server negative marking और idempotent submit लागू करता है।
- Result में solutions/explanations owner switches के अनुसार; Hindi PDF canvas rendering से बनती है।
- PDF controls: **डाउनलोड**, **Print/खोलें**, **Share** (Web Share API, fallback download)।
- Leaderboard test-scoped है; बिना consent नाम `Student` रहता है; owner unpublish कर सकता है।
- Guest result उसी browser की access secret से खुलता है; केवल Attempt ID जानने से कोई और result नहीं पढ़ सकता।

## 6. Premium Membership architecture (default OFF)

- `portal_memberships` table और `portal_tests.is_premium` flag मौजूद हैं।
- Global `premium_enabled` setting default **false** है।
- चालू करने पर premium test के लिए active membership आवश्यक होगी।
- **Payment gateway/webhook इस release में शामिल नहीं है।** यह केवल entitlement architecture है।

## 7. Tests और verification

```bash
npm install
npm run build:vendor      # vendor bundles (पहले से included)
npm run build:schema      # schema.sql regenerate
npm test                  # parser/core/scoring/Edge unit tests
npm run test:db           # PGlite में migrations + RLS + exam engine
npm run test:browser      # Chromium + WebKit/iPhone + Android-width UI
npm run test:all          # तीनों suites, logs test-results/ में
npm run verify:release    # files, hashes, schema freshness, config safety
```

- Browser tests Supabase transport को **test-only mock** से बदलते हैं; live project से संपर्क नहीं होता।
- PGlite harness auth/storage stubs उपयोग करता है; यह वास्तविक Supabase Auth का पूर्ण विकल्प नहीं है।
- `TEST_REPORT.md` में नवीनतम परिणाम और सीमाएँ देखें।
- `legacy/SHA256SUMS.txt` मूल अपलोड्स की byte-level पहचान रखता है।

## 8. सुरक्षा मॉडल (संक्षेप)

- RLS: anonymous केवल published catalog; प्रश्न/उत्तर सीधे tables से नहीं, केवल RPC से।
- Active attempt payload में correct_index/explanation नहीं होते (practice mode अपवाद)।
- Capability secret SHA-256 hashed; mobile peppered hash।
- Owner allowlist + SECURITY DEFINER owner checks; audit logs केवल functions लिखते हैं।
- Private media signed URLs (1 घंटा); public thumbnails अलग bucket।
- CORS allowlist, body size limit, distributed rate limit।
- कोई hardcoded production subject/test नहीं; examples केवल `examples/` में।

## 9. ज्ञात सीमाएँ / ईमानदार स्थिति

- **Live Supabase/Auth/Edge deployment सत्यापित नहीं** है क्योंकि credentials/approval नहीं दिए गए।
- प्रति-प्रश्न timer strict anti-cheat नहीं है: sanitized payload में सभी प्रश्न होते हैं; server केवल answer lock/deadline enforce करता है।
- Guest access secret localStorage में है; browser data साफ़ होने पर guest result नहीं खुलेगा। Signed-in history अनुशंसित।
- PDF बड़े images/लंबी explanations पर device पर समय ले सकती है; popup blocked होने पर download fallback है।
- वास्तविक भुगतान, ईमेल templates, और प्रोडक्शन निगरानी इस पैकेज का हिस्सा नहीं हैं।

## 10. मूल_feature संरक्षण

- `REFERENCE_ORIGINAL_UNCHANGED.html` और `october-sujas-test-01.html` के SHA-256 `legacy/SHA256SUMS.txt` से मिलाए जा सकते हैं।
- सभी 10 स्रोत अपलोड `legacy/source-uploads/` में byte-for-byte सुरक्षित हैं।
- पुराना अक्टूबर टेस्ट नए पोर्टल से अलग चलता रहता है; नया portal बिना config के कोई नकली test नहीं दिखाता।

---

Owner: @lokesh_dausa · Telegram: @kalam_kranti · Instagram: @lokesh_dausa1
