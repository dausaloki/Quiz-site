export function remainingMs(deadline, now = Date.now()) { return deadline ? Math.max(0, new Date(deadline).getTime() - now) : Infinity; }
export function clockText(ms) { const s = Math.ceil(Math.max(0, ms) / 1000); const h = Math.floor(s / 3600); return (h ? String(h).padStart(2, '0') + ':' : '') + String(Math.floor(s / 60) % (h ? 60 : Infinity)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
export function paletteState(i, answers, review, visited) { const answered = answers[i] !== null && answers[i] !== undefined && answers[i] >= 0; const starred = review.includes(i); if (answered && starred) return 'answered-review'; if (answered) return 'answered'; if (starred) return 'review'; return visited.includes(i) ? 'visited' : 'unvisited'; }
export function nextAvailableIndex(times, questions, from, now = Date.now()) { for (let step = 1; step <= questions.length; step++) { const i = (from + step) % questions.length; const t = times[questions[i].id]; if (!t?.locked && remainingMs(t?.deadline_at, now) > 0) return i; } return null; }
export function scoreAnswers(questions, answers, settings) {
  let raw = 0, total = 0, correct = 0, incorrect = 0, unattempted = 0;
  const details = questions.map(q => { const selected = answers[q.id] ?? null; const marks = Number(q.marks ?? settings.marks_per_question ?? 1); total += marks; let status;
    if (selected === null || selected === undefined) { unattempted++; status = 'unattempted'; }
    else if (selected === q.correct_index) { correct++; raw += marks; status = 'correct'; }
    else { incorrect++; raw -= marks * Number(settings.negative_ratio || 0); status = 'incorrect'; }
    return { question_id: q.id, selected_index: selected, correct_index: q.correct_index, status };
  });
  const round = (n, d = 4) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;
  const marks = round(settings.max_marks == null ? raw : Math.min(raw, Number(settings.max_marks)));
  return { marks, total_marks: round(total), percentage: total ? round(marks / total * 100, 2) : 0, accuracy: correct + incorrect ? round(correct / (correct + incorrect) * 100, 2) : 0, correct_count: correct, wrong_count: incorrect, unattempted_count: unattempted, attempted_count: correct + incorrect, total_questions: questions.length, passed: marks >= Number(settings.passing_marks || 0), questions: details };
}
export function validStudent(name, mobile = '') { if (!String(name).trim() || String(name).trim().length > 80) return 'नाम 1–80 अक्षरों का लिखें / Enter a name (1–80 characters).'; if (mobile && !/^\+?[0-9\s-]{8,16}$/.test(mobile)) return 'मोबाइल नंबर वैकल्पिक है; सही नंबर लिखें या खाली छोड़ें।'; return ''; }
export function rankRows(rows) { const sorted = [...rows].sort((a, b) => b.marks - a.marks || b.accuracy - a.accuracy || a.time_seconds - b.time_seconds || new Date(a.submitted_at) - new Date(b.submitted_at)); let rank = 0; return sorted.map((r, i) => { const p = sorted[i - 1]; if (!p || r.marks !== p.marks || r.accuracy !== p.accuracy || r.time_seconds !== p.time_seconds) rank = i + 1; return { ...r, rank }; }); }
export function createAttemptSecret() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
