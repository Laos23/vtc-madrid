import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hintProblems } from './hint-rules.mjs';
const read = path => JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const content = read('../data/content.json');
const bank = [...read('../data/questions.json'),...content.extras];
const hints = read('../data/hints.json');

test('todas las preguntas tienen una pista propia válida', () => {
  assert.equal(bank.length,469);
  const problems = bank.flatMap(q => hintProblems(q,hints[q.id],content.modules.find(m => m.id===q.module).sections.length).map(p => `${q.id}: ${p}`));
  assert.deepEqual(problems,[]);
  assert.deepEqual(Object.keys(hints).filter(id => !bank.some(q => q.id===id)),[]);
});
test('las pistas no se repiten como plantilla', () => {
  for (const field of ['concept','focus']) {
    const counts = {};
    for (const entry of Object.values(hints)) counts[entry[field]] = (counts[entry[field]] || 0) + 1;
    assert.deepEqual(Object.entries(counts).filter(([,n]) => n>2),[],field);
  }
});
