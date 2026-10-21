// Pistas de la mascota. Solo orientan: nunca citan la opción correcta ni la señalan.
// Enunciados que piden la opción falsa o la excepción: «NO» destacado, «¿qué/cuál… no…?»,
// «la respuesta incorrecta», «es falsa», «excepto/salvo». Un «no» suelto en el relato no cuenta.
const NEGATIONS = [
  /\bNO\b/,
  /(¿\s*(qu[eé]|cu[aá]l(es)?)|\b(qué|cuál(es)?|indique|señale?))(\s+(?!si\b)[^\s¿?,.]+){0,3}?\s+no\b/i,
  /\b(respuesta|opci[oó]n|afirmaci[oó]n|frase|oraci[oó]n)(\s+(es|son))?\s+(incorrect[ao]s?|fals[ao]s?)\b/i,
  /\b(es|son)\s+(incorrect[ao]s?|fals[ao]s?)\b/i,
  /\b(excepto|salvo)\b/i
];
const words = text => (String(text).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{5,}/g) || []);

// Estudio: pistas de contenido. Examen: solo ánimo general. Simulacro estricto: nada.
export function hintPolicy(session) {
  if (!session) return { hints: false, nudge: 'none' };
  if (session.kind === 'strict') return { hints: false, nudge: 'none' };
  if (session.mode === 'study') return { hints: true, nudge: 'stuck' };
  return { hints: false, nudge: 'calm' };
}

// Sección del temario que más palabras comparte con el enunciado (peso 2) y con las cuatro opciones
// por igual (peso 1, sin favorecer la correcta). Sin coincidencias claras devuelve null.
export function sectionFor(question, sections) {
  const stem = new Set(words(question.text));
  const options = new Set(question.options.flatMap(o => words(o.text)).filter(w => !stem.has(w)));
  let best = null, bestScore = 1;
  sections.forEach((s, i) => {
    const bag = new Set(words(`${s.title} ${(s.body || []).join(' ')} ${(s.bullets || []).join(' ')}`));
    let score = 0;
    for (const w of stem) if (bag.has(w)) score += 2;
    for (const w of options) if (bag.has(w)) score += 1;
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}

export function discardedOption(question, order) {
  const wrong = order.filter(id => id !== question.correct);
  let hash = 0;
  for (const c of question.id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return wrong[hash % wrong.length];
}

// level 1: cómo leer; 2: dónde repasar; 3: descartar una opción incorrecta.
export function nextHint(question, level, sections, order) {
  if (level <= 1) return { level: 1, text: NEGATIONS.some(rule => rule.test(question.text)) ? 'Fíjate en cómo está planteada: ¿pide lo verdadero o lo que NO lo es? Léela despacio.' : 'Relee el enunciado y descarta las opciones que lo contradigan. Una pista: busca las palabras clave.' };
  if (level === 2) {
    const section = sectionFor(question, sections);
    return section === null
      ? { level: 2, text: `Piensa en lo que has estudiado del módulo ${question.module} y en el sentido de cada opción: ¿cuál encaja con todo el enunciado?` }
      : { level: 2, section, text: `Te conviene repasar «${sections[section].title}» en el temario del módulo ${question.module}.` };
  }
  const discard = discardedOption(question, order);
  const letter = String.fromCharCode(65 + order.indexOf(discard));
  return { level: 3, discard, text: `Te quito una: la opción ${letter} no es la correcta. Decide entre las otras tres.` };
}
