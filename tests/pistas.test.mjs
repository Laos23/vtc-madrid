import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextHint } from '../src/hints.js';
import { hintProblems } from './hint-rules.mjs';
const read = path => JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const content = read('../data/content.json');
const secs = content.modules.find(m => m.id===4).sections;
const order = ['a','b','c','d'];
const q = { id:'t-1', module:4, text:'¿Dónde se colocan los distintivos?', correct:'d', options:[{id:'a',text:'Ambos detrás.'},{id:'b',text:'Fuera de los cristales.'},{id:'c',text:'Arriba a la izquierda.'},{id:'d',text:'Arriba a la derecha delante y abajo a la izquierda detrás.'}] };
const custom = { concept:'C propia', focus:'F', section:2 };

test('nivel 1 usa la pista propia', () => {
  assert.deepEqual(nextHint(q,1,secs,order,custom),{level:1,text:'C propia'});
});
test('nivel 1 avisa del NO si la pista propia no lo hace', () => {
  const neg = {...q,text:'¿Cuál de estas afirmaciones NO es correcta?'};
  assert.equal(nextHint(neg,1,secs,order,custom).text,'Ojo: busca la opción que NO encaja. C propia');
  assert.equal(nextHint(neg,1,secs,order,{...custom,concept:'Aquí buscas la que NO vale.'}).text,'Aquí buscas la que NO vale.');
});
test('nivel 2 usa el foco y la sección propios', () => {
  assert.deepEqual(nextHint(q,2,secs,order,custom),{level:2,text:'F',section:2});
});
test('nivel 2 descarta una sección fuera de rango o nula', () => {
  for (const section of [99,-1,null,1.5]) assert.deepEqual(nextHint(q,2,secs,order,{...custom,section}),{level:2,text:'F'});
});
test('sin pista propia se mantiene el comportamiento actual', () => {
  assert.deepEqual(nextHint(q,1,secs,order),nextHint(q,1,secs,order,undefined));
  assert.match(nextHint(q,1,secs,order).text,/^Relee el enunciado/);
  assert.equal(nextHint(q,2,secs,order).level,2);
});
test('nivel 3 ignora la pista propia y nunca descarta la correcta', () => {
  const hint = nextHint(q,3,secs,order,custom);
  assert.equal(hint.level,3);
  assert.notEqual(hint.discard,q.correct);
});

test('hintProblems acepta una pista limpia', () => {
  const entry = { concept:'Los distintivos identifican el vehículo desde fuera: ¿pueden ir fuera de los cristales?', focus:'Mira el esquema de la sección 4.5 y fíjate en qué esquina de cada luna va cada uno.', section:4 };
  assert.deepEqual(hintProblems(q,entry,8),[]);
});
test('hintProblems detecta filtraciones, letras y pistas genéricas', () => {
  const ok = { concept:'Piensa en para qué sirve identificar el vehículo desde el exterior.', focus:'Fíjate en la posición que marca el esquema de cada luna en la sección 4.5.', section:4 };
  const grave = {...q,correct:'a',options:[{id:'a',text:'Muy grave.'},...q.options.slice(1)]};
  const cases = [
    [grave,{...ok,concept:'Piensa si esto es muy grave o solo leve, según el material.'}],
    [q,{...ok,focus:'Deberán ir ARRIBA a la derecha delante y abajo a la izquierda detrás, según el esquema.'}],
    [q,{...ok,concept:'Fíjate bien: la opción B no tiene sentido si piensas en la visibilidad.'}],
    [q,{...ok,concept:'La respuesta correcta es la que habla de las dos lunas del vehículo.'}],
    [q,{...ok,focus:ok.concept}],
    [q,{...ok,focus:'Repasa la sección 4.5.'}],
    [q,{...ok,section:8}],
    [q,{...ok,concept:'Corta.'}],
    [q,undefined]
  ];
  for (const [question,entry] of cases) assert.ok(hintProblems(question,entry,8).length>0,JSON.stringify(entry));
});
test('hintProblems no confunde la preposición «a» con una letra de opción', () => {
  const entry = { concept:'Piensa en la respuesta a esta situación desde la seguridad del pasajero.', focus:'Fíjate en lo que el temario dice sobre la visibilidad de los distintivos exteriores.', section:null };
  assert.deepEqual(hintProblems(q,entry,8),[]);
});
