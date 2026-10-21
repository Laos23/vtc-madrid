import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODULES, selectQuestions, grade, emptyState, finishSession, validateBackup } from '../src/core.js';
const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url),'utf8'));
const questions = read('questions');
const examples = read('examples');
const explanations = read('explanations');
const content = read('content');
const report = read('import-report');
const bank = [...questions,...content.extras];

test('ocho PDF completos: cada aparición conserva número y página, opciones y clave', () => {
  assert.equal(report.sources.length,8);
  assert.equal(report.totalOccurrences,442);
  assert.equal(questions.length,437);
  assert.equal(questions.reduce((n,q) => n+q.sources.length,0),442);
  for (const q of questions) {
    assert.equal(q.official,true);
    assert.ok(q.text.length>5);
    assert.deepEqual(q.options.map(o => o.id),['a','b','c','d']);
    assert.ok(q.options.every(o => o.text.trim().length>0));
    assert.ok(q.options.some(o => o.id===q.correct));
    assert.ok(q.sources.every(s => s.page>0 && s.number>0));
    assert.doesNotMatch(q.text+q.options.map(o => o.text).join(''),/CONSEJERÍA|Test ID:|Referencia:|Respuesta correcta|CORRECTA:/);
    assert.ok(explanations[q.id]?.text.length>50);
  }
});
test('cuatro pruebas originales mantienen 60 preguntas con distribución y orden correctos', () => {
  assert.equal(examples.length,4);
  for (const e of examples) {
    assert.equal(e.questionIds.length,60);
    assert.equal(new Set(e.questionIds).size,60);
    const qs = e.questionIds.map(id => questions.find(q => q.id===id));
    assert.ok(qs.every(Boolean));
    assert.deepEqual(MODULES.map(m => qs.filter(q => q.module===m.id).length),[12,18,18,12]);
    assert.deepEqual(qs.map(q => q.sources.find(s => s.file===e.file).number),Array.from({length:60},(_,i)=>i+1));
  }
});
test('EXTRA tiene su banco independiente y teoría cubre los cuatro módulos', () => {
  assert.equal(content.modules.length,4);
  assert.equal(content.extras.length,32);
  assert.equal(new Set(bank.map(q => q.id)).size,469);
  assert.ok(content.extras.every(q => !q.official && q.id.startsWith('extra-') && q.explanation.length>20));
  assert.deepEqual(MODULES.map(m => content.extras.filter(q => q.module===m.id).length),[8,8,8,8]);
});
test('ciclo real: seleccionar, corregir, exportar/restaurar y volver a entregar sin duplicación', () => {
  const state = emptyState();
  const qs = selectQuestions(questions,{}, {kind:'normal'});
  const answers = Object.fromEntries(qs.map(q => [q.id,q.correct]));
  state.active = {id:'roundtrip',title:'Test real',kind:'normal',mode:'exam',questionIds:qs.map(q=>q.id),answers,firstAnswers:{...answers},order:Object.fromEntries(qs.map(q=>[q.id,q.options.map(o=>o.id)])),index:0,visited:qs.map(q=>q.id),flagged:[],startedAt:Date.now(),deadline:null};
  const restored = validateBackup(JSON.parse(JSON.stringify(state)),bank);
  const result = finishSession(restored,bank);
  assert.equal(result.result.correct,60);
  assert.equal(result.result.passed,true);
  finishSession(restored,bank);
  assert.equal(restored.history.length,1);
  const copy = validateBackup(JSON.parse(JSON.stringify(restored)),bank);
  assert.equal(copy.history[0].result.correct,60);
  assert.equal(Object.values(copy.stats).reduce((n,s)=>n+s.answered,0),60);
});
test('blancos de una práctica parcial se contabilizan sin inventar módulos ausentes', () => {
  const qs = questions.filter(q=>q.module===2).slice(0,5);
  const result = grade(qs,{[qs[0].id]:qs[0].correct});
  assert.equal(result.modules.length,1);
  assert.equal(result.modules[0].min,3);
  assert.equal(result.blank,4);
  assert.equal(result.wrong,0);
});
