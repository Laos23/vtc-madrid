// Reglas comprobables de una pista propia (data/hints.json). Se usan en los tests y, como CLI,
// para revisar un lote: node tests/hint-rules.mjs <pistas.json> [<lote-de-entrada.json>]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const norm = text => String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const COMMON = new Set(['no', 'si', 'verdadero', 'falso', 'a', 'b', 'c', 'd']);
const LETTER = [/\b(?:[Oo]pci[oó]n|[Rr]espuesta|[Ll]etra)\s+[A-D]\b/, /(^|\s)[A-D]\)/];
const TELLS = /la (respuesta|opci[oó]n) (correcta|buena) es/i;
const REMISSION = /^(repasa|revisa|mira|consulta)\b[^.]{0,60}\.?$/i;

export function hintProblems(question, entry, sectionCount) {
  if (!entry) return ['falta la pista'];
  const problems = [];
  for (const field of ['concept', 'focus']) {
    const text = entry[field];
    if (typeof text !== 'string' || text.trim().length < 25 || text.length > 260) { problems.push(`${field}: debe tener entre 25 y 260 caracteres`); continue; }
    if (LETTER.some(rule => rule.test(text))) problems.push(`${field}: menciona una letra de opción`);
    if (TELLS.test(text)) problems.push(`${field}: anuncia la respuesta correcta`);
    const answer = norm(question.options.find(o => o.id === question.correct).text);
    const hint = ` ${norm(text)} `;
    if (answer.length >= 12 ? hint.includes(answer) : !COMMON.has(answer) && hint.includes(` ${answer} `)) problems.push(`${field}: contiene la respuesta correcta`);
  }
  if (entry.concept === entry.focus) problems.push('concept y focus son iguales');
  if (typeof entry.focus === 'string' && REMISSION.test(entry.focus.trim())) problems.push('focus: solo remite al temario, no da una pista concreta');
  if (entry.section !== null && !(Number.isInteger(entry.section) && entry.section >= 0 && entry.section < sectionCount)) problems.push(`section: debe ser null o un entero entre 0 y ${sectionCount - 1}`);
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const read = path => JSON.parse(readFileSync(path, 'utf8'));
  const data = new URL('../data/', import.meta.url);
  const content = read(new URL('content.json', data));
  const bank = new Map([...read(new URL('questions.json', data)), ...content.extras].map(q => [q.id, q]));
  const hints = read(process.argv[2]);
  const lines = [];
  for (const [id, entry] of Object.entries(hints)) {
    const q = bank.get(id);
    if (!q) { lines.push(`${id}: el id no existe en el banco`); continue; }
    for (const p of hintProblems(q, entry, content.modules.find(m => m.id === q.module).sections.length)) lines.push(`${id}: ${p}`);
  }
  if (process.argv[3]) for (const q of read(process.argv[3]).questions) if (!hints[q.id]) lines.push(`${q.id}: falta la pista`);
  console.log(lines.length ? lines.join('\n') : `OK: ${Object.keys(hints).length} pistas sin problemas`);
  process.exitCode = lines.length ? 1 : 0;
}
