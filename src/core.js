export const MODULES = [
  { id: 1, name: 'Lengua castellana', short: 'Lengua', count: 12, min: 6, color: '#325acb' },
  { id: 2, name: 'Medio físico e itinerarios', short: 'Madrid e itinerarios', count: 18, min: 9, color: '#087f75' },
  { id: 3, name: 'Accesibilidad y servicio público', short: 'Atención y accesibilidad', count: 18, min: 9, color: '#97520a' },
  { id: 4, name: 'Marco jurídico VTC', short: 'Normativa', count: 12, min: 6, color: '#8052b5' }
];
export function shuffleOptions(options) {
  const result = [...options];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function selectQuestions(bank, stats, config) {
  let pool = bank.filter(q => !config.module || q.module === Number(config.module));
  if (config.kind === 'wrong') pool = pool.filter(q => stats[q.id]?.wrong > 0 && (config.includeRecovered || stats[q.id].lastCorrect !== true));
  if (config.kind === 'bookmarks') pool = pool.filter(q => config.bookmarks?.includes(q.id));
  const score = q => (q.difficulty || 1) + (stats[q.id]?.wrong || 0) * 2 + ((stats[q.id]?.wrong || 0) / Math.max(1, stats[q.id]?.answered || 0)) * 3;
  const ordered = shuffleOptions(pool).sort((a, b) => config.kind === 'strict' ? score(b) - score(a) : config.kind === 'wrong' ? (stats[b.id]?.wrong || 0) - (stats[a.id]?.wrong || 0) : (stats[a.id]?.seen || 0) - (stats[b.id]?.seen || 0));
  if (['normal', 'strict'].includes(config.kind)) {
    return MODULES.flatMap(m => {
      const selected = ordered.filter(q => q.module === m.id).slice(0, m.count);
      if (selected.length !== m.count) throw new Error(`No hay suficientes preguntas en ${m.name}.`);
      return selected;
    });
  }
  return ordered.slice(0, config.all ? ordered.length : Math.max(1, Number(config.count) || 12));
}

export function grade(questions, answers) {
  const modules = MODULES.map(m => {
    const qs = questions.filter(q => q.module === m.id);
    const correct = qs.filter(q => answers[q.id] === q.correct).length;
    const blank = qs.filter(q => !answers[q.id]).length;
    return { id: m.id, total: qs.length, correct, blank, wrong: qs.length - correct - blank, min: Math.ceil(qs.length / 2), passed: correct >= Math.ceil(qs.length / 2) };
  }).filter(m => m.total);
  return {
    total: questions.length,
    correct: modules.reduce((n, m) => n + m.correct, 0),
    wrong: modules.reduce((n, m) => n + m.wrong, 0),
    blank: modules.reduce((n, m) => n + m.blank, 0),
    modules, passed: modules.length > 0 && modules.every(m => m.passed)
  };
}

export function finishSession(state, bank, finishedAt = Date.now()) {
  const session = state.active;
  if (!session) return null;
  if (state.history.some(s => s.id === session.id)) { state.active = null; return null; }
  const questions = session.questionIds.map(id => bank.find(q => q.id === id)).filter(Boolean);
  const answers = session.mode === 'study' ? session.firstAnswers || session.answers : session.answers;
  const result = { ...session, answers: { ...answers }, finishedAt, result: grade(questions, answers) };
  for (const q of questions) {
    const stat = state.stats[q.id] ||= { seen: 0, answered: 0, correct: 0, wrong: 0 };
    if (!answers[q.id]) continue;
    stat.answered++;
    stat.lastCorrect = answers[q.id] === q.correct;
    stat.lastAnsweredAt = result.finishedAt;
    if (stat.lastCorrect) stat.correct++; else stat.wrong++;
  }
  state.history.unshift(result);
  state.active = null;
  return result;
}

export function emptyState() {
  return { version: 1, stats: {}, history: [], active: null, bookmarks: [], readSections: [], preferences: { shuffle: true, theme: 'light', mascot: true } };
}

export function validateBackup(value, bank) {
  const fail = () => { throw new Error('La copia no es válida o pertenece a otra versión. Tus datos actuales no se han cambiado.'); };
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const ids = new Set(bank.map(q => q.id));
  // Fechas dentro del rango que Date puede mostrar; un valor fuera de rango rompería el historial.
  const time = t => Number.isFinite(t) && Math.abs(t) <= 8.64e15;
  if (!object(value) || value.version !== 1 || !object(value.stats) || !Array.isArray(value.history) || value.history.length > 10000) fail();
  for (const [id, s] of Object.entries(value.stats)) {
    if (!ids.has(id) || !object(s)) fail();
    for (const key of ['seen', 'answered', 'correct', 'wrong']) if (!Number.isSafeInteger(s[key] ?? 0) || (s[key] ?? 0) < 0) fail();
    if ((s.correct || 0) + (s.wrong || 0) !== (s.answered || 0)) fail();
  }
  const checkSession = s => {
    if (!object(s) || typeof s.id !== 'string' || typeof s.title !== 'string' || !['study','exam'].includes(s.mode) || !time(s.startedAt) || !Array.isArray(s.questionIds) || !s.questionIds.length || s.questionIds.length > 1000 || new Set(s.questionIds).size !== s.questionIds.length || !s.questionIds.every(id => ids.has(id))) fail();
    if (!object(s.answers) || !object(s.firstAnswers) || !object(s.order) || !Array.isArray(s.visited) || !Array.isArray(s.flagged) || !Number.isInteger(s.index) || s.index < 0 || s.index >= s.questionIds.length) fail();
    for (const answers of [s.answers, s.firstAnswers]) for (const [id, a] of Object.entries(answers)) if (!s.questionIds.includes(id) || !['a','b','c','d'].includes(a)) fail();
    for (const id of s.questionIds) if (!Array.isArray(s.order[id]) || s.order[id].length !== 4 || [...s.order[id]].sort().join('') !== 'abcd') fail();
    if (![...s.visited, ...s.flagged].every(id => s.questionIds.includes(id))) fail();
    if (s.deadline != null && (!time(s.deadline) || s.deadline < s.startedAt)) fail();
    if (s.paused !== undefined && typeof s.paused !== 'boolean') fail();
    if (s.remainingMs != null && (!Number.isFinite(s.remainingMs) || s.remainingMs < 0)) fail();
    if (s.elapsedMs !== undefined && !Number.isFinite(s.elapsedMs)) fail();
    if (s.resumedAt !== undefined && !time(s.resumedAt)) fail();
    if ('hints' in s && (!object(s.hints) || !Object.entries(s.hints).every(([id, n]) => s.questionIds.includes(id) && [1, 2, 3].includes(n)))) fail();
    if (s.kind === 'strict' && (!time(s.deadline) || s.mode !== 'exam' || s.paused === true)) fail();
  };
  if (value.active != null) checkSession(value.active);
  for (const session of value.history) { checkSession(session); if (!time(session.finishedAt)) fail(); }
  if ('bookmarks' in value && (!Array.isArray(value.bookmarks) || !value.bookmarks.every(id => ids.has(id)))) fail();
  if ('readSections' in value && (!Array.isArray(value.readSections) || !value.readSections.every(id => typeof id === 'string'))) fail();
  if ('preferences' in value && (!object(value.preferences) || typeof value.preferences.shuffle !== 'boolean' || ('theme' in value.preferences && !['light', 'dark'].includes(value.preferences.theme)) || ('mascot' in value.preferences && typeof value.preferences.mascot !== 'boolean'))) fail();
  const result = { ...emptyState(), ...structuredClone(value) };
  result.preferences = { ...emptyState().preferences, ...result.preferences };
  result.history = result.history.map(s => ({ ...s, result: grade(s.questionIds.map(id => bank.find(q => q.id === id)), s.answers) }));
  return result;
}
