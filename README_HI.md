# ✍️ कलम से क्रांति ✍️ — Exam Portal (Starter v1)

यह प्रोजेक्ट आपकी अपलोड की हुई `October_Sujas_Test_01 (2).html` को reference बनाकर तैयार किया गया है। मूल exam engine की सुविधाएँ बरकरार रखी गई हैं और ब्रांडिंग बदली गई है।

## मौजूदा परीक्षा फीचर (reference HTML से सुरक्षित)
- Welcome, rules, student name और exam start flow
- प्रति प्रश्न timer + कुल परीक्षा timer, auto-next / auto-submit
- Previous, Save & Next, answer select/deselect, question palette
- Answered / Not Answered / Not Visited / Starred status
- Star for review, submit confirmation, resume incomplete attempt
- LocalStorage save/restore, browser back/unload protection
- Result, marks, accuracy, rank, participant count और solutions review
- Leaderboard podium + ranking list; marks, accuracy, time के आधार पर rank
- PDF print/download/share, multi-page layout, watermark और answer highlighting
- Retake with a new attempt ID; old local attempt retained
- Responsive mobile/desktop layout, ticker, toast, loading and sound/celebration

## इस starter में जोड़ा गया
- नया नाम: ✍️ कलम से क्रांति ✍️
- Admin Panel (`admin.html`) with Supabase login
- Cloud test bank table + JSON question entry in Admin Panel
- Cloud leaderboard write/read bridge; cloud unavailable होने पर local leaderboard fallback
- Supabase schema + RLS policies

## महत्वपूर्ण स्थिति / अभी क्या बाकी है
1. Cloud features तभी चलेंगे जब Supabase project बनाकर `supabase/schema.sql` चलाएँ और `config.js` में URL + anon/publishable key डालें।
2. Admin account को Supabase Auth में बनाकर उसका UUID `admin_users` table में insert करना होगा।
3. Admin में बनाए गए test records cloud में सेव होते हैं; इस v1 starter में नए tests को public test selector से launch करने वाला dynamic question-loader अभी अगला integration चरण है। फिलहाल reference का October Sujas Test 01 exam अपने मूल 50-question bank के साथ चलता है।
4. Public leaderboard score data browser से भेजता है। Production में anti-cheat, server-side scoring/Edge Function, rate limiting और stricter RLS जोड़ना जरूरी है। Client HTML में मौजूद answer key को पूरी तरह छिपाने के लिए server-side grading अगला जरूरी चरण है।
5. Admin login के लिए Supabase Authentication में Email/Password enable करें।

## Local preview
`index.html` को browser में खोलें। Local exam features चलेंगे। Supabase cloud features के लिए project को static hosting (जैसे Vercel/Netlify) पर deploy करें और `config.js` सेट करें।

## Supabase setup
1. Supabase पर नया project बनाएं।
2. SQL Editor में `supabase/schema.sql` चलाएं।
3. Authentication → Users में admin user बनाएं।
4. उस user का UUID लेकर SQL चलाएं: `insert into public.admin_users(user_id) values ('UUID');`
5. `config.example.js` की कॉपी `config.js` नाम से बनाएं; Project URL और anon/publishable key भरें। Service Role key कभी frontend में न डालें।
6. `index.html`, `admin.html`, `config.js` और बाकी project files deploy करें।

## Project structure
- `index.html` — student exam portal (reference-based)
- `admin.html` — admin login, test bank editor, cloud results viewer
- `config.js` — local Supabase settings placeholder
- `config.example.js` — configuration template
- `supabase/schema.sql` — database and RLS setup
- `REFERENCE_FEATURES.md` — reference feature checklist

## Security note
Public score submission policies are a prototype convenience, not production-grade exam security. Before using for a high-stakes exam, move scoring and submission validation to a trusted server/Edge Function, avoid exposing correct answers to the browser, and add abuse prevention.
