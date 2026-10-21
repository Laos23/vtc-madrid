import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KINDS, VISUALS, highlight, renderSection, renderVisual } from '../src/study.js';
const read = path => JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const content = read('../data/content.json');
const base = read('./fixtures/temario-base.json');
const entities = { '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&#39;':"'" };
const plain = html => html.replace(/<[^>]*>/g,'').replace(/&(amp|lt|gt|quot|#39);/g,e => entities[e]).replace(/\s+/g,' ');
const squash = text => text.replace(/\s+/g,' ');

test('el temario conserva cada título, párrafo y punto de la línea base', () => {
  assert.equal(content.modules.length,base.length);
  for (const b of base) {
    const m = content.modules.find(m => m.id===b.module);
    assert.ok(m,`falta el módulo ${b.module}`);
    assert.equal(m.sections.length,b.sections.length);
    b.sections.forEach((bs,i) => {
      const s = m.sections[i];
      assert.equal(s.title,bs.title);
      assert.deepEqual(s.body || [],bs.body);
      assert.deepEqual(s.bullets || [],bs.bullets);
    });
  }
});
test('highlight escapa HTML y marca términos', () => {
  assert.equal(highlight('a <b> ECO',['ECO']),'a &lt;b&gt; <mark>ECO</mark>');
});
test('highlight prefiere el término más largo y no anida', () => {
  assert.equal(highlight('de menos de 40 km',['40 km','menos de 40 km']),'de <mark>menos de 40 km</mark>');
});
test('highlight no marca dentro de otra palabra', () => {
  assert.equal(highlight('ECOlógico ECO',['ECO']),'ECOlógico <mark>ECO</mark>');
});
test('renderSection muestra todo el texto de la línea base', () => {
  for (const b of base) {
    const m = content.modules.find(m => m.id===b.module);
    b.sections.forEach((bs,i) => {
      const text = plain(renderSection(m.sections[i],{anchor:`section-${i}`,number:`${b.module}.${i+1}`}));
      for (const piece of [bs.title,...bs.body,...bs.bullets]) assert.ok(text.includes(squash(piece)),`falta en ${b.module}.${i+1}: ${piece}`);
    });
  }
});
test('renderSection indica para qué sirve la sección y el tipo de cada punto', () => {
  const html = renderSection({title:'T',goal:'Saber G',body:['b'],bullets:['x','y'],kinds:['trampa','clave']},{anchor:'section-0',number:'1.1',actions:'<button>Leer</button>'});
  assert.match(html,/id="section-0"/);
  assert.match(html,/<button>Leer<\/button>/);
  const text = plain(html);
  for (const piece of ['1.1','Para qué te sirve','Saber G','Cuidado en el examen','Dato clave']) assert.ok(text.includes(piece),piece);
});
test('renderVisual muestra el texto de cada tipo de esquema', () => {
  const samples = [
    {type:'steps',items:[{label:'Proteger',text:'Evita otro accidente'}]},
    {type:'badges',items:[{label:'CERO',tone:'cero',text:'eléctricos'}]},
    {type:'table',head:['Tiempo','Ejemplo'],rows:[['Presente','conduzco']]},
    {type:'scale',items:[{level:'muy-grave',text:'inicio fuera del ámbito'}]},
    {type:'timeline',items:[{date:'2024',text:'Decreto 5/2024'}]},
    {type:'compass',center:'Madrid',items:[{dir:'N',text:'Plaza de Castilla'}]},
    {type:'placement',items:[{glass:'delantera',corner:'arriba-derecha',text:'distintivo'}]}
  ];
  for (const v of samples) {
    const text = plain(renderVisual({...v,caption:'Esquema'}));
    const pieces = v.rows ? [...v.head,...v.rows.flat()] : v.items.flatMap(i => [i.label,i.text,i.date].filter(Boolean));
    for (const piece of ['Esquema',...pieces]) assert.ok(text.includes(piece),`${v.type}: ${piece}`);
  }
});
test('renderVisual ignora esquemas ausentes o desconocidos', () => {
  assert.equal(renderVisual(undefined),'');
  assert.equal(renderVisual({type:'nope',items:[{text:'x'}]}),'');
});
test('cada sección tiene metadatos editoriales válidos', () => {
  for (const m of content.modules) m.sections.forEach((s,i) => {
    const where = `${m.id}.${i+1} ${s.title}`;
    assert.equal(typeof s.goal,'string',`${where}: falta goal`);
    assert.ok(s.goal.length>=20 && s.goal.length<=140,`${where}: goal de ${s.goal.length} caracteres`);
    assert.equal(s.kinds?.length,s.bullets.length,`${where}: kinds no cuadra con bullets`);
    assert.ok(s.kinds.every(k => k in KINDS),`${where}: kind desconocido`);
    const text = [s.title,...s.body,...s.bullets].join(' ');
    for (const term of s.highlight || []) assert.ok(text.includes(term),`${where}: «${term}» no aparece en la sección`);
    if (s.visual) {
      assert.ok(VISUALS.includes(s.visual.type),`${where}: esquema ${s.visual.type}`);
      assert.ok((s.visual.items || s.visual.rows || []).length>0,`${where}: esquema vacío`);
    }
  });
});
test('renderSection destaca el término inicial de los puntos «término: explicación»', () => {
  const long = 'Una frase muy larga que supera el límite de cuarenta y cinco: algo';
  const html = renderSection({title:'T',bullets:['Museo Sorolla: General Martínez Campos, 37','Sin dos puntos',long]},{anchor:'a',number:'1.1'});
  assert.match(html,/<strong class="fact-term">Museo Sorolla:<\/strong> General Martínez Campos, 37/);
  assert.equal(html.match(/fact-term/g).length,1);
  assert.ok(plain(html).includes(long));
});
test('la tabla no reutiliza la clase de su figura (evita doble scroll horizontal)', () => {
  const html = renderVisual({type:'table',head:['A','B'],rows:[['1','2']]});
  assert.equal((html.match(/class="[^"]*\bvisual-table\b/g) || []).length,1);
});
test('study.js no usa lookbehind en regex (Safari anterior a 16.4 no lo admite)', () => {
  assert.doesNotMatch(readFileSync(new URL('../src/study.js',import.meta.url),'utf8'),/\(\?<[!=]/);
});
test('highlight marca al inicio del texto y tras puntuación', () => {
  assert.equal(highlight('ECO, eco y (ECO).',['ECO']),'<mark>ECO</mark>, eco y (<mark>ECO</mark>).');
});
