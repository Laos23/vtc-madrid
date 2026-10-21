import test from 'node:test';
import assert from 'node:assert/strict';
import { selectQuestions, grade, shuffleOptions, finishSession, validateBackup } from '../src/core.js';

const bank = Array.from({ length: 100 }, (_, i) => ({
  id: `q${i}`, module: Math.floor(i / 25) + 1, correct: 'a', difficulty: i % 3,
  options: ['a', 'b', 'c', 'd'].map(id => ({ id, text: id }))
}));

test('examen completo respeta 12/18/18/12 sin duplicados', () => {
  const picked = selectQuestions(bank, {}, { kind: 'normal' });
  assert.equal(picked.length, 60);
  assert.deepEqual([1, 2, 3, 4].map(m => picked.filter(q => q.module === m).length), [12, 18, 18, 12]);
  assert.equal(new Set(picked.map(q => q.id)).size, 60);
});
test('preguntas menos vistas preceden a las ya practicadas', () => {
  const stats = Object.fromEntries(bank.slice(0, 10).map(q => [q.id, { seen: 8 }]));
  const picked = selectQuestions(bank, stats, { kind: 'module', module: 1, count: 12 });
  assert.equal(picked.length, 12);
  assert.ok(picked.every(q => Number(q.id.slice(1)) >= 10));
});
test('simulacro prioriza dificultad conceptual y errores personales', () => {
  const picked = selectQuestions(bank, { q0: { wrong: 20, answered: 20 } }, { kind: 'strict' });
  assert.ok(picked.some(q => q.id === 'q0'));
});
test('falladas no inventa preguntas cuando aún no hay errores', () => {
  assert.deepEqual(selectQuestions(bank, {}, { kind: 'wrong', count: 10 }), []);
});
test('barajar conserva los identificadores y la respuesta correcta', () => {
  const options = shuffleOptions(bank[0].options);
  assert.deepEqual(options.map(o => o.id).sort(), ['a', 'b', 'c', 'd']);
  assert.equal(options.find(o => o.id === bank[0].correct).text, 'a');
});
test('un solo módulo suspenso impide APTO aunque el total sea alto', () => {
  const picked = selectQuestions(bank, {}, { kind: 'normal' });
  const answers = Object.fromEntries(picked.map(q => [q.id, 'a']));
  picked.filter(q => q.module === 1).slice(0, 7).forEach(q => { answers[q.id] = 'b'; });
  const result = grade(picked, answers);
  assert.equal(result.correct, 53);
  assert.equal(result.passed, false);
  assert.equal(result.modules[0].correct, 5);
});
test('blancos y errores no descuentan; mínimos exactos aprueban', () => {
  const picked = selectQuestions(bank, {}, { kind: 'normal' });
  const answers = {};
  for (const m of [1, 2, 3, 4]) picked.filter(q => q.module === m).slice(0, m === 1 || m === 4 ? 6 : 9).forEach(q => { answers[q.id] = 'a'; });
  const result = grade(picked, answers);
  assert.equal(result.correct, 30);
  assert.equal(result.blank, 30);
  assert.equal(result.passed, true);
});
test('entrega es idempotente y guarda primera respuesta del modo estudio', () => {
  const state = { stats: {}, history: [], active: { id: 's1', questionIds: ['q0'], answers: { q0: 'b' }, firstAnswers: { q0: 'b' }, startedAt: Date.now(), kind: 'module', mode: 'study', title: 'Prueba' } };
  finishSession(state, bank);
  finishSession(state, bank);
  assert.equal(state.history.length, 1);
  assert.equal(state.stats.q0.wrong, 1);
});
test('copia corrupta y pregunta desconocida se rechazan antes de reemplazar datos', () => {
  assert.throws(() => validateBackup({ version: 1, stats: {}, history: 'bad' }, bank));
  assert.throws(() => validateBackup({ version: 1, stats: {}, history: [], active: { questionIds: ['unknown'] } }, bank));
  assert.throws(() => validateBackup({ version: 1, stats: { q0: { seen: -2 } }, history: [] }, bank));
  assert.equal(validateBackup({ version: 1, stats: {}, history: [], active: null }, bank).version, 1);
});
test('una copia con colecciones nulas o preferencias corruptas se rechaza', () => {
  const base = {version:1,stats:{},history:[],active:null};
  for (const bad of [{bookmarks:null},{readSections:null},{preferences:null},{preferences:{shuffle:'sí'}}]) {
    assert.throws(() => validateBackup({...base,...bad},bank));
  }
});
