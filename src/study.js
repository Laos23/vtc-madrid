// Temario: convierte cada sección de content.json en HTML. Los textos originales (title, body, bullets)
// se muestran íntegros; goal, kinds, highlight y visual solo añaden contexto y esquemas.
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const KINDS = { clave: 'Dato clave', regla: 'Regla', ejemplo: 'Ejemplo', consejo: 'Consejo práctico', trampa: 'Cuidado en el examen' };
export const VISUALS = ['steps', 'badges', 'table', 'scale', 'timeline', 'compass', 'placement'];
const TONES = ['cero', 'eco', 'c', 'b', 'neutral'];
const LEVELS = { leve: 'Leve', grave: 'Grave', 'muy-grave': 'Muy grave' };
const DIRECTIONS = { N: 'Norte', O: 'Oeste', E: 'Este', S: 'Sur' };
const GLASSES = { delantera: 'Luna delantera', trasera: 'Luna trasera' };

// Marca cada aparición literal de los términos; el más largo gana y nunca dentro de otra palabra.
export function highlight(text, terms = []) {
  const safe = escape(text);
  const list = [...new Set(terms)].filter(Boolean).map(escape).sort((a, b) => b.length - a.length);
  if (!list.length) return safe;
  // Sin lookbehind: el carácter previo se captura y se devuelve tal cual.
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${list.map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
  return safe.replace(pattern, (_, before, match) => `${before}<mark>${match}</mark>`);
}

const visuals = {
  steps: v => `<ol class="steps">${v.items.map(i => `<li><strong>${escape(i.label)}</strong><span>${escape(i.text)}</span></li>`).join('')}</ol>`,
  badges: v => `<ul class="badges">${v.items.map(i => `<li><span class="disc tone-${TONES.includes(i.tone) ? i.tone : 'neutral'}">${escape(i.label)}</span><span>${escape(i.text)}</span></li>`).join('')}</ul>`,
  table: v => `<div class="table-scroll"><table><thead><tr>${v.head.map(h => `<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${v.rows.map(r => `<tr>${r.map((cell, i) => `<td data-label="${escape(v.head[i])}">${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
  scale: v => `<ol class="scale">${v.items.map(i => `<li class="level-${LEVELS[i.level] ? i.level : 'leve'}"><strong>${LEVELS[i.level] || LEVELS.leve}</strong><span>${escape(i.text)}</span></li>`).join('')}</ol>`,
  timeline: v => `<ol class="timeline">${v.items.map(i => `<li><strong>${escape(i.date)}</strong><span>${escape(i.text)}</span></li>`).join('')}</ol>`,
  compass: v => `<div class="compass">${Object.entries(DIRECTIONS).map(([dir, name]) => {
    const items = v.items.filter(i => i.dir === dir);
    return items.length ? `<div class="compass-${dir.toLowerCase()}"><strong>${name}</strong>${items.map(i => `<span>${escape(i.text)}</span>`).join('')}</div>` : '';
  }).join('')}<div class="compass-center">${escape(v.center || '')}</div></div>${v.notes?.length ? `<ul class="visual-notes">${v.notes.map(n => `<li>${escape(n)}</li>`).join('')}</ul>` : ''}`,
  placement: v => `<div class="placement">${v.items.map(i => `<div class="glass"><strong>${GLASSES[i.glass] || escape(i.glass)}</strong><div class="pane" aria-hidden="true"><span class="marker at-${i.corner === 'abajo-izquierda' ? 'bottom-left' : 'top-right'}"></span></div><span>${escape(i.text)}</span></div>`).join('')}</div>`
};

export function renderVisual(visual) {
  if (!visual || !VISUALS.includes(visual.type)) return '';
  return `<figure class="visual visual-${visual.type}">${visual.caption ? `<figcaption>${escape(visual.caption)}</figcaption>` : ''}${visuals[visual.type](visual)}</figure>`;
}

// «Museo Sorolla: General Martínez Campos, 37» → término en negrita; el texto queda igual.
function factText(text, terms) {
  const cut = text.indexOf(': ');
  if (cut < 1 || cut > 45) return highlight(text, terms);
  return `<strong class="fact-term">${highlight(text.slice(0, cut + 1), terms)}</strong> ${highlight(text.slice(cut + 2), terms)}`;
}

export function renderSection(section, { anchor, number, actions = '' }) {
  const terms = section.highlight || [];
  const facts = (section.bullets || []).map((text, i) => {
    const kind = KINDS[section.kinds?.[i]] ? section.kinds[i] : '';
    return `<li class="fact${kind ? ` fact-${kind}` : ''}">${kind ? `<span class="fact-tag">${KINDS[kind]}</span>` : ''}<span class="fact-text">${factText(text, terms)}</span></li>`;
  }).join('');
  return `<section id="${escape(anchor)}" class="topic"><header class="topic-head"><span class="topic-number">${escape(number)}</span><h2>${escape(section.title)}</h2>${actions}</header>${section.goal ? `<p class="topic-goal"><strong>Para qué te sirve</strong> ${escape(section.goal)}</p>` : ''}${(section.body || []).map(p => `<p class="topic-lead">${highlight(p, terms)}</p>`).join('')}${renderVisual(section.visual)}${facts ? `<ul class="facts">${facts}</ul>` : ''}</section>`;
}
