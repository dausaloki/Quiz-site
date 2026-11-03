# Reference HTML — feature preservation checklist

- [x] Welcome / branding / test details / student name
- [x] Exam rules and agree/start
- [x] Exam header, total timer, per-question timer, progress bar
- [x] Question and options A-D; select/deselect answer
- [x] Previous / Save & Next / Submit
- [x] Question palette and direct navigation
- [x] Answered, not answered, not visited, starred/review states
- [x] Star/unstar review
- [x] Per-question timeout auto-advance (as in reference)
- [x] Total-time auto-submit
- [x] Submit confirmation with attempted/unattempted/starred counts
- [x] Result metrics and rank / participant count
- [x] Solutions review with selected and correct options
- [x] Local leaderboard, podium and ranking rules
- [x] PDF generation, print/download/share, watermark, page numbering
- [x] Retake with a fresh attempt ID
- [x] LocalStorage restore/resume and navigation protection
- [x] Mobile/desktop responsive UI, ticker, toast, loading and celebration
- [x] Local leaderboard fallback + cloud sync bridge added
- [x] Admin page and Supabase test-bank storage scaffold added

## Reference behavior retained as-is
- Reference test contains 50 questions, 50 minutes total, 60 seconds per question, 1 mark per correct answer, no negative marking.
- Question data and answer key remain embedded in the reference-based browser app. This is convenient for a prototype but not secure for a real competitive exam.
- Original local storage cleanup/migration statements in the reference script are retained.
