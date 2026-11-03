# ✍️ कलम से क्रांति ✍️ — Multi-Subject Exam Portal

## इस वर्जन में क्या तैयार है
- नया Subject → Topic → Part → Test वाला विद्यार्थी होमपेज।
- Subject, Topic, Part और Test के लिए Cloud database संरचना।
- Owner-only Admin Login (Supabase Auth + `portal_owners` allowlist)।
- Owner Panel से Subject / Topic / Part जोड़ना और हटाना।
- Test JSON के रूप में बनाना, publish/unpublish और delete करना।
- अलग टेस्ट का अलग Test ID, समय, अंक, negative marking और प्रश्न।
- विद्यार्थी टेस्ट दे सकते हैं; समय समाप्त होने पर auto-submit, Previous/Next, Question Palette, Review Star, result summary।
- Cloud Results table में सबमिशन।
- पुराना October Sujas Test 01 अलग `october-sujas-test-01.html` फाइल में सुरक्षित है; उसके पुराने exam features नहीं हटाए गए।
- Telegram: `https://t.me/kalam_kranti`; Instagram: `@lokesh_dausa1`; Owner label: `@lokesh_dausa`.

## जरूरी: वेबसाइट पर Cloud चालू करने के लिए एक बार सेटअप
इस ZIP को GitHub पर डालने से पहले Supabase सेटअप पूरा करें। बिना config के नया cloud test catalog नहीं खुलेगा।

### 1. Supabase प्रोजेक्ट
1. https://supabase.com पर नया project बनाएं।
2. Project → SQL Editor → New query खोलें।
3. `supabase/schema.sql` की पूरी सामग्री paste करके Run करें।
4. Project Settings → API से Project URL और anon/public key कॉपी करें। **service_role key कभी भी वेबसाइट में न डालें।**

### 2. Owner अकाउंट
1. Supabase → Authentication → Users → Add user से अपना Owner email/password बनाएं।
2. उस user की UUID कॉपी करें।
3. SQL Editor में यह चलाएँ (UUID को अपने वास्तविक UUID से बदलें):
   `insert into public.portal_owners(user_id) values ('YOUR-AUTH-USER-UUID');`
4. Owner की अनुमति इसी allowlist से मिलती है। कोई दूसरा सामान्य user Admin Panel में login करके बदलाव नहीं कर सकेगा।

### 3. config.js
1. `config.example.js` को copy करके उसी folder में `config.js` नाम दें।
2. इसमें अपना Supabase Project URL और anon/public key भरें।
3. Telegram/Instagram links पहले से सेट हैं।
4. `config.js` को GitHub में commit करें। इसमें केवल anon/public key रखें, service_role या password नहीं।

### 4. GitHub Pages
- Repository root में `index.html`, `admin.html`, `exam.html`, `config.js`, `october-sujas-test-01.html` और `supabase/` folder रहें।
- Settings → Pages → Deploy from a branch → `main` → `/(root)` → Save।
- Build होने के बाद `https://dausaloki.github.io/Quiz-site/` खोलें।

## Owner Panel कैसे चलाएँ
1. वेबसाइट पर Owner / Admin Login दबाएँ।
2. Supabase Auth में बनाए गए Owner email/password से login करें।
3. पहले Subject जोड़ें।
4. फिर उस Subject का Topic जोड़ें।
5. फिर Topic के अंदर Part जोड़ें।
6. फिर Part चुनकर Test title, समय, marks और प्रश्न JSON डालें।
7. Published चालू रखकर Test सेव करें। अब वह विद्यार्थी होमपेज पर दिखेगा।

## Question JSON उदाहरण
```json
[
  {
    "question": "राजस्थान की राजधानी क्या है?",
    "options": ["जयपुर", "जोधपुर", "उदयपुर", "कोटा"],
    "correct_index": 0
  }
]
```
- `correct_index`: A=0, B=1, C=2, D=3.
- हर प्रश्न में ठीक 4 विकल्प जरूरी हैं।
- JSON में comma, quotes और brackets सही रखें।

## सुरक्षा और सीमाएँ
- Admin writes Supabase RLS + owner allowlist से सुरक्षित हैं।
- यह शुरुआती multi-test release है। Student score फिलहाल browser-side calculate होता है; गंभीर/उच्च-दांव परीक्षा के लिए server-side grading, anti-cheat, rate limiting और answer-key protection जोड़ना जरूरी है।
- Cloud database का public leaderboard सभी के लिए पढ़ने योग्य है; विद्यार्थियों को नाम दिखाने से पहले privacy/consent नियम तय करें।
- पुराने अक्टूबर टेस्ट का मूल exam engine जस का तस अलग फाइल में रखा है। नए generic engine में अभी पुराने PDF solutions/report के सभी उन्नत फीचर नहीं हैं; पुराने टेस्ट को उसी पुराने engine से खोलें।

## TXT से ऑटो टेस्ट बनाना
Owner Panel → Test Management में TXT file चुनें → “TXT अपलोड करके प्रश्न तैयार करें” दबाएँ। Parser प्रश्न, A/B/C/D विकल्प और उत्तर को JSON में बदल देगा। Preview जाँचें, Part/टेस्ट समय चुनें और “टेस्ट सेव करें” दबाएँ।

समर्थित TXT उदाहरण:
```text
1. राजस्थान की राजधानी क्या है?
A. जयपुर
B. जोधपुर
C. उदयपुर
D. कोटा
Answer: A

2. राजस्थान दिवस कब मनाया जाता है?
A. 26 जनवरी
B. 30 मार्च
C. 15 अगस्त
D. 1 नवंबर
उत्तर: B
```
हर प्रश्न में चारों विकल्प और सही उत्तर का संकेत (A/B/C/D) होना जरूरी है। बिना उत्तर वाली या अलग layout वाली फाइलों को अपलोड करने पर प्रश्न auto-detect नहीं होंगे; ऐसे TXT format का sample देकर parser में support जोड़ा जा सकता है।
