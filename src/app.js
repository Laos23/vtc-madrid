import { MODULES, selectQuestions, shuffleOptions, finishSession, emptyState } from './core.js';
import { openStorage, saveAll, saveProfile, saveMeta, loadProfileRaw } from './storage.js';
import { PROFILES, initialProfiles, reloadProfile, buildBackup, parseBackup } from './profiles.js';
import { hintPolicy, nextHint } from './hints.js';
import { renderSection } from './study.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const date = value => new Intl.DateTimeFormat('es-ES', { dateStyle:'medium', timeStyle:'short' }).format(value);
const percentage = (a, b) => b ? Math.round(a / b * 100) : 0;
const clock = ms => `${Math.floor(Math.max(0, ms) / 60000).toString().padStart(2,'0')}:${Math.floor(Math.max(0, ms) / 1000 % 60).toString().padStart(2,'0')}`;
const paths = { home:'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10', book:'M4 4h6l2 2 2-2h6v16h-6l-2 2-2-2H4zM12 6v16', test:'M9 4h10v18H5V4h4M9 2h6v4H9zM8 11h8M8 15h8', timer:'M12 7v6l4 2M9 2h6M12 2v3M20 5l-2 2M21 14a9 9 0 1 1-18 0 9 9 0 0 1 18 0', retry:'M4 5v6h6M4 11a8 8 0 1 1 1 8', spark:'m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8z', chart:'M4 3v18h17M8 17v-5M13 17V8M18 17V5', settings:'M5 4v16M12 4v16M19 4v16M2 8h6M9 16h6M16 10h6', search:'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', arrow:'M4 12h16m-6-6 6 6-6 6', flag:'M5 22V3h14l-4 5 4 5H5', check:'m5 12 4 4L19 6', menu:'M4 6h16M4 12h16M4 18h16', close:'m6 6 12 12M18 6 6 18', user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0', bulb:'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3' };
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(paths[name] || paths.test).split('|').map(d => `<path d="${d}"/>`).join('')}</svg>`;
const button = (text, action, attrs = '', cls = 'button') => `<button class="${cls}" data-action="${action}" ${attrs}>${text}</button>`;
const badge = (text, cls = '') => `<span class="badge ${cls}">${escape(text)}</span>`;
const moduleName = id => MODULES.find(m => m.id === Number(id))?.name || 'Todos los módulos';
let bank = [], official = [], examples = [], content, explanations, report, hints = {}, state, meta, profiles, revs = {};
let route = '', filter = { module:'', query:'', source:'official', status:'' }, pendingConfig = null, pendingRestore = null, reviewFilter = 'all', saving = Promise.resolve(), lastSaved = true;
let navOpen = false, expiryRunning = false, saveRevision = 0, switching = false, nudgeTimer = null, hopNext = false, profileKeyNav = false, rendering = false;
// gens[cuenta] sube cada vez que la copia en memoria se sustituye por la guardada: las escrituras pendientes de antes se descartan.
const gens = {};
// Aviso a otras pestañas de este navegador cuando se guarda una cuenta.
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('vtc-madrid') : null;
const byId = new Map();
const nudged = new Set();
const MASCOT = 'assets/mascota/gallo-256.png';
const mascotImg = (size, cls = '') => `<img class="mascot-img ${cls}" src="${MASCOT}" width="${size}" height="${Math.round(size * 1145 / 1303)}" alt="" decoding="async">`;

function notify(text, error = false) {
  $('#toast').textContent = text;
  $('#toast').className = error ? 'show error' : 'show';
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { $('#toast').className = ''; }, 4500);
}
// Cola única de escrituras. Si otra pestaña cambió la cuenta antes (conflicto de revisión), no se sobrescribe nada:
// se carga la versión guardada y se avisa.
function queueSave(write) {
  const revision = ++saveRevision;
  lastSaved = false;
  const label = $('#save-status');
  if (label) label.textContent = 'Guardando…';
  saving = saving.catch(() => {}).then(write);
  saving.then(() => { if (revision !== saveRevision) return; lastSaved = true; if ($('#save-status')) $('#save-status').textContent = 'Progreso guardado'; }).catch(error => {
    if (error?.conflict) { reloadAfterConflict(error.profile); if (revision === saveRevision) { lastSaved = true; if ($('#save-status')) $('#save-status').textContent = 'Progreso guardado'; } return; }
    if (revision !== saveRevision) return;
    lastSaved = false; if ($('#save-status')) $('#save-status').textContent = 'Error al guardar'; notify('No se ha podido guardar. Exporta una copia antes de cerrar.', true);
  });
  return saving;
}
// Cada escritura va a la cuenta indicada al llamarla, aunque la cola se vacíe después de cambiar de cuenta.
function persistProfile(name, target) {
  const snapshot = structuredClone(target);
  const gen = gens[name] || 0;
  return queueSave(async () => {
    if ((gens[name] || 0) !== gen) return;
    revs[name] = await saveProfile(name, snapshot, revs[name] || 0);
    channel?.postMessage({ name, rev: revs[name] });
  });
}
function persist() { return persistProfile(meta.activeProfile, state); }
function persistMeta() {
  const snapshot = structuredClone(meta);
  return queueSave(() => saveMeta(snapshot));
}
// Escritura sin comprobar revisión (migración, restauración, reparación); actualiza las revisiones conocidas y avisa a otras pestañas.
async function saveAllTracked(metaValue, list, extra) {
  const updated = await saveAll(metaValue, list, extra);
  Object.assign(revs, updated);
  for (const [name, rev] of Object.entries(updated)) channel?.postMessage({ name, rev });
}
let conflictPending = Promise.resolve(), conflictNote = '';
// Añade a la sesión guardada las respuestas y pistas de esta pestaña que falten (solo añade: nunca cambia las de la otra pestaña).
function mergeSession(target, memory) {
  const a = target.active, m = memory?.active;
  if (!a || !m || a.id !== m.id) return false;
  let changed = false;
  for (const [id, value] of Object.entries(m.firstAnswers || {})) if (a.questionIds.includes(id) && !a.firstAnswers[id]) { a.firstAnswers[id] = value; changed = true; }
  for (const [id, value] of Object.entries(m.answers || {})) if (a.questionIds.includes(id) && !a.answers[id]) { a.answers[id] = value; changed = true; }
  for (const [id, level] of Object.entries(m.hints || {})) if (a.questionIds.includes(id) && (a.hints?.[id] || 0) < level) { a.hints = { ...(a.hints || {}), [id]: level }; changed = true; }
  return changed;
}
function reloadAfterConflict(name) {
  gens[name] = (gens[name] || 0) + 1;
  const memory = profiles[name];
  conflictPending = conflictPending.then(async () => {
    try {
      const { raw, rev } = await loadProfileRaw(name);
      const fresh = reloadProfile(name, raw, bank);
      const merged = mergeSession(fresh.state, memory);
      const paused = (name !== meta.activeProfile || route !== 'test' || document.hidden) && settle(fresh.state);
      profiles[name] = fresh.state;
      revs[name] = rev;
      if (fresh.issue) queueSave(() => saveAllTracked(null, { [name]: fresh.state }, quarantine([fresh.issue])));
      else if (merged || paused) persistProfile(name, fresh.state);
      if (name === meta.activeProfile) { state = fresh.state; applyPreferences(); render(); }
      conflictNote = `La cuenta ${name} se ha modificado en otra pestaña: se ha cargado la versión más reciente${merged ? ' conservando tus respuestas' : ''}. Repite tu última acción si no aparece.`;
      notify(conflictNote, true);
    } catch { notify('No se ha podido releer la cuenta. Recarga la página antes de seguir.', true); }
  });
  return conflictPending;
}
// Al cargar o entrar en una cuenta, una práctica que quedó corriendo pasa a pausa. El simulacro estricto no se pausa: su fecha límite es absoluta.
function settle(target) {
  const s = target.active;
  if (!s || s.kind === 'strict' || s.paused) return false;
  s.elapsedMs = (s.elapsedMs || 0) + Math.max(0, Date.now() - (s.resumedAt || Date.now()));
  s.remainingMs = s.deadline ? Math.max(0, s.deadline - Date.now()) : null;
  s.deadline = null;
  s.paused = true;
  return true;
}
function applyPreferences() {
  const theme = state.preferences.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e1521' : '#244d9b');
  try { localStorage.setItem('vtc-theme', theme); } catch {}
}
// Un simulacro que venció mientras la cuenta no estaba abierta se entrega con su hora límite.
function closeExpired(target) {
  const s = target.active;
  if (!s || s.paused || !s.deadline || s.deadline > Date.now()) return null;
  return finishSession(target, bank, s.deadline);
}
// Guarda aparte (sin borrar nada) el contenido original de una cuenta que hubo que reparar al cargarla.
const quarantine = issues => Object.fromEntries(issues.map(i => [`respaldo:${i.name}:${new Date().toISOString()}`, i.raw]));
const issueText = issues => issues.map(i => `${i.name}: ${i.kind === 'repaired' ? 'se han descartado datos ilegibles' : 'no se pudo leer y empieza vacía'}`).join('; ');
// El cambio de cuenta solo se aplica en memoria cuando ya está guardado; si algo falla, todo sigue como estaba.
async function switchProfile(name) {
  if (switching || !PROFILES.includes(name) || name === meta.activeProfile) return;
  switching = true;
  const previous = meta.activeProfile;
  try {
    conflictNote = '';
    if (state.active && !state.active.paused && state.active.kind !== 'strict') { pauseSession(); }
    await saving.catch(() => {});
    await conflictPending;
    await saving.catch(() => {});
    const { raw, rev } = await loadProfileRaw(name);
    const fresh = reloadProfile(name, raw, bank);
    const next = fresh.state;
    const expired = closeExpired(next);
    const settled = settle(next);
    const nextMeta = { ...meta, activeProfile: name };
    revs[name] = rev;
    if (fresh.issue || expired || settled) await saveAllTracked(nextMeta, { [name]: next }, fresh.issue ? quarantine([fresh.issue]) : {});
    else await saveMeta(nextMeta);
    meta.activeProfile = name;
    gens[name] = (gens[name] || 0) + 1;
    profiles[name] = state = next;
    pendingConfig = null; pendingRestore = null; reviewFilter = 'all';
    filter = { module:'', query:'', source:'official', status:'' };
    if ($('#modal').open) $('#modal').close();
    applyPreferences();
    render();
    if (document.activeElement === document.body) $('#profile-select')?.focus({ preventScroll:true });
    const message = `${conflictNote ? conflictNote + ' ' : ''}Cuenta activa: ${name}.${expired ? ' Su simulacro había terminado y se ha entregado con la hora límite.' : ''}${fresh.issue ? ` Aviso: ${issueText([fresh.issue])}; el original se ha guardado aparte.` : ''}`;
    notify(message, !!fresh.issue || !!conflictNote);
    announce(message);
  } catch {
    meta.activeProfile = previous;
    state = profiles[previous];
    render();
    notify('No se ha podido cambiar de cuenta. Sigues en ' + previous + '; inténtalo de nuevo.', true);
  } finally { switching = false; }
}
// Recoge lo que otra pestaña haya guardado en una cuenta. La activa no se toca si hay cambios sin guardar,
// un diálogo abierto o un test en marcha: en ese caso, la comprobación de revisión de la siguiente escritura protege los datos.
async function syncProfile(name, force = false) {
  const busy = () => switching || name === meta.activeProfile && (!lastSaved || !force && ($('#modal').open || !document.hidden && route === 'test' && state.active && !state.active.paused));
  if (busy()) return;
  try {
    const { raw, rev } = await loadProfileRaw(name);
    if (rev === (revs[name] || 0) || busy()) return;
    const fresh = reloadProfile(name, raw, bank);
    if (fresh.issue) return;
    if (document.hidden) settle(fresh.state);
    gens[name] = (gens[name] || 0) + 1;
    profiles[name] = fresh.state;
    revs[name] = rev;
    if (name === meta.activeProfile) { state = fresh.state; applyPreferences(); render(); }
    else if (route === 'ajustes') render();
  } catch {}
}
function navigate(target) { location.hash = target; }
function modal(title, body, actions) {
  const dialog = $('#modal');
  dialog.innerHTML = `<div class="modal-head"><h2 id="modal-title">${escape(title)}</h2>${button(icon('close'), 'close-modal', 'aria-label="Cerrar ventana"', 'icon-button')}</div>${body}<div class="modal-actions">${actions}</div>`;
  if (!dialog.open) dialog.showModal();
}
function confirmAction(title, text, action, label = 'Continuar') {
  modal(title, `<p>${escape(text)}</p>`, button('Cancelar','close-modal','','button secondary') + button(label,action));
}
function statSummary() {
  const stats = official.map(q => state.stats[q.id]).filter(Boolean);
  return { seen:stats.filter(s => s.seen > 0).length, answered:stats.reduce((n,s) => n+s.answered,0), correct:stats.reduce((n,s) => n+s.correct,0), wrong:official.filter(q => state.stats[q.id]?.wrong > 0 && state.stats[q.id]?.lastCorrect !== true).length };
}
function moduleProgress(m) {
  const qs = official.filter(q => q.module === m.id);
  const seen = qs.filter(q => state.stats[q.id]?.seen).length;
  const answered = qs.reduce((n,q) => n+(state.stats[q.id]?.answered || 0),0);
  const correct = qs.reduce((n,q) => n+(state.stats[q.id]?.correct || 0),0);
  return { total:qs.length, seen, answered, correct };
}
function shell(body, active) {
  const nav = [['inicio','home','Inicio'],['temario','book','Temario'],['modulos','test','Tests por módulos'],['normales','test','Tests de 60 preguntas'],['simulacro','timer','Simulacro oficial'],['fallos','retry','Repasar fallos'],['extra','spark','Preguntas EXTRA'],['banco','search','Banco de preguntas'],['progreso','chart','Mi progreso'],['ajustes','settings','Configuración']];
  const profileSwitch = `<label class="profile-switch" title="Cambiar de cuenta">${icon('user')}<span class="profile-label">Cuenta</span><select id="profile-select" aria-label="Cuenta activa">${PROFILES.map(p => `<option value="${p}" ${p === meta.activeProfile ? 'selected' : ''}>${p}</option>`).join('')}</select></label>`;
  $('#app').innerHTML = `<div class="layout ${navOpen ? 'nav-open' : ''}"><aside class="sidebar" aria-label="Menú principal"><a class="brand" href="#inicio"><span class="brand-symbol">V</span><span>VTC Madrid<small>Tu espacio de estudio</small></span></a><nav>${nav.map(([id,i,label]) => `<a href="#${id}" ${active === id ? 'aria-current="page"' : ''}>${icon(i)}<span>${label}</span></a>`).join('')}</nav><div class="sidebar-note">A tu ritmo.<br>Todos los módulos disponibles.<small>Cuenta activa: <strong>${escape(meta.activeProfile)}</strong> · Datos en este navegador</small></div></aside><div class="workspace"><header class="topbar">${button(icon('menu'),'menu','aria-label="Abrir menú" aria-expanded="'+navOpen+'"','icon-button mobile-menu')}<span class="local-status"><i></i> Espacio local y privado</span><div class="topbar-right"><span id="save-status" role="status">${lastSaved ? 'Progreso guardado' : 'Guardando…'}</span>${profileSwitch}${state.active && active !== 'test' ? '<a class="button small secondary" href="#test">Continuar test</a>' : ''}</div></header><main id="main" tabindex="-1">${body}</main><footer>VTC Madrid · Material de práctica personal <a href="https://www.comunidad.madrid/transporte/pruebas-conductor-vtc" target="_blank" rel="noopener noreferrer">Información oficial</a></footer></div></div>`;
}
function heading(title, description, actions = '') {
  return `<div class="page-heading"><div><h1>${escape(title)}</h1><p>${escape(description)}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
}
function moduleRows(action = 'configure') {
  return `<div class="module-list">${MODULES.map(m => {
    const p = moduleProgress(m);
    return `<article class="module-row" style="--module:${m.color}"><span class="module-number">${m.id}</span><div class="module-info"><h3>${escape(m.name)}</h3><p>${m.count} preguntas por test · ${m.min} aciertos para aprobar · ${p.total} en el banco</p><div class="progress-track" role="progressbar" aria-label="Cobertura de ${escape(m.short)}" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.seen}"><span style="width:${percentage(p.seen,p.total)}%;background:var(--module-fg)"></span></div><small>${p.seen} de ${p.total} preguntas vistas</small></div>${action === 'read' ? `<a class="button secondary" href="#temario/${m.id}">Estudiar</a>` : button('Practicar','configure',`data-kind="module" data-module="${m.id}"`,'button secondary')}</article>`;
  }).join('')}</div>`;
}
function home() {
  const s = statSummary();
  return `${heading('Hoy eliges tú el camino.', 'Estudia, practica o comprueba cómo vas. Todo está disponible desde el principio.')}<section class="welcome"><div><h2>Tu próximo paso al permiso VTC</h2><p>Cuatro módulos, un objetivo. Empieza por donde quieras y guarda tu sesión cuando necesites un descanso.</p><div class="inline-actions">${button('Elegir un módulo '+icon('arrow'),'go','data-to="modulos"')}<a class="button secondary" href="#simulacro">Hacer un simulacro</a></div></div>${state.preferences.mascot ? `<div class="welcome-mascot">${mascotImg(150,'is-idle')}<p class="speech">Te acompaño en los tests. En modo estudio, si te atascas, pídeme una pista.</p></div>` : '<div class="route-mark" aria-hidden="true"><span>Lengua</span><span>Madrid</span><span>Atención</span><span>Normativa</span></div>'}</section>${state.active ? `<section class="resume-banner"><div><h2>Tienes un test en curso</h2><p>${escape(state.active.title)} · ${Object.keys(state.active.answers).length}/${state.active.questionIds.length} respondidas${state.active.kind === 'strict' ? ' · El reloj sigue corriendo.' : ''}</p></div><a class="button" href="#test">Continuar</a></section>` : ''}<div class="metrics"><div><strong>${s.seen}<span> / ${official.length}</span></strong><p>Preguntas oficiales vistas</p></div><div><strong>${percentage(s.correct,s.answered)}<span>%</span></strong><p>Aciertos en tus respuestas</p></div><div><strong>${s.wrong}</strong><p>Preguntas por recuperar</p></div><div><strong>${state.history.length}</strong><p>Tests terminados</p></div></div><div class="section-heading"><h2>Tus cuatro módulos</h2><a href="#temario">Abrir temario</a></div>${moduleRows()}<section class="plain-note"><h2>Practica con material identificable</h2><p>${official.length} preguntas distintas extraídas de ${report.sources.length} PDF (${report.totalOccurrences} apariciones), con acceso a la fuente original. Las preguntas EXTRA están identificadas y se practican por separado.</p></section>`;
}
function practicePage(kind) {
  if (kind === 'modulos') return heading('Tests por módulos','Elige la materia y después decide el modo y la longitud del test.') + moduleRows();
  if (kind === 'normales') return heading('Tests de 60 preguntas','Reparto oficial: 12 de Lengua, 18 de Medio físico, 18 de Accesibilidad y 12 de Normativa.') + `<section class="feature-panel"><div>${icon('test')}<h2>Un test nuevo cada vez</h2><p>Las preguntas menos vistas tienen prioridad. Puedes elegir corrección inmediata o revisar todo al entregar.</p></div>${button('Preparar test','configure','data-kind="normal"')}</section><h2>Las cuatro pruebas oficiales de ejemplo</h2><p class="muted">Se conservan sus 60 preguntas y el orden de las preguntas del PDF. Tú eliges si barajar las opciones.</p><div class="example-list">${examples.map(e => `<article><div><h3>${escape(e.title)}</h3><p>60 preguntas · 4 módulos</p><a href="temas/${encodeURIComponent(e.file)}" target="_blank" rel="noopener">Ver PDF original</a></div>${button('Realizar prueba','configure',`data-kind="example" data-example="${e.id}"`,'button secondary')}</article>`).join('')}</div>`;
  if (kind === 'simulacro') return heading('Simulacro oficial','Comprueba tu preparación con las condiciones del examen.') + `<section class="feature-panel strict-panel"><div>${icon('timer')}<h2>60 preguntas. 60 minutos.</h2><p>Selecciona las preguntas de mayor dificultad conceptual y las que más te han costado. La corrección se muestra al entregar o al agotarse el tiempo.</p><ul><li>Reparto 12 / 18 / 18 / 12.</li><li>Mínimos por módulo: 6 / 9 / 9 / 6.</li><li>Los errores y las preguntas en blanco no restan.</li><li>Si un módulo no alcanza el mínimo, el resultado global es NO APTO.</li><li>Puedes cambiar respuestas, marcar dudas y saltar entre preguntas.</li></ul><p><strong>El reloj continúa aunque salgas o cierres la página.</strong></p></div>${button('Preparar simulacro','configure','data-kind="strict"')}</section><p class="muted">La dificultad es una estimación didáctica y personal, no una clasificación oficial.</p>`;
  if (kind === 'fallos') {
    const s = statSummary();
    return heading('Repasar fallos','Recupera las preguntas que te cuestan. Se priorizan las que acumulan más errores.') + `<section class="feature-panel"><div>${icon('retry')}<h2>${s.wrong ? `${s.wrong} preguntas por recuperar` : 'Cada fallo es una oportunidad para aprender'}</h2><p>${s.wrong ? 'Al responder correctamente en un nuevo test, una pregunta sale de la lista pendiente. Puedes incluir también errores ya recuperados.' : 'Cuando termines un test, los errores aparecerán aquí. También puedes volver a practicar errores que ya hayas recuperado.'}</p></div>${button('Configurar repaso','configure','data-kind="wrong"')}</section>`;
  }
  return heading('Preguntas EXTRA','Preguntas nuevas de práctica elaboradas con IA. No forman parte del banco oficial.') + `<section class="feature-panel extra-panel"><div>${icon('spark')}<h2>Amplía lo que sabes</h2><p>${content.extras.length} preguntas adicionales para practicar conceptos y situaciones con formulaciones diferentes. Sus resultados se guardan separados de la cobertura oficial.</p>${badge('EXTRA · Generadas con IA','extra')}</div>${button('Practicar EXTRA','configure','data-kind="extra"')}</section>`;
}
function study(moduleId) {
  if (!moduleId) return heading('Temario de estudio','Lee a tu ritmo, marca secciones como leídas y abre las preguntas cuando quieras.') + moduleRows('read') + `<p class="muted">Apuntes didácticos de apoyo elaborados para esta plataforma. Las fuentes oficiales y los PDF se pueden consultar en cada módulo.</p>`;
  const m = content.modules.find(m => m.id === Number(moduleId));
  if (!m) return home();
  return heading(m.title,'Consulta las secciones en el orden que prefieras.',button('Practicar este módulo','configure',`data-kind="module" data-module="${m.id}"`)) + `<a class="back-link" href="#temario">Volver al temario</a><div class="study-layout"><nav class="study-index" aria-label="Secciones del módulo">${m.sections.map((s,i) => `<a href="#" data-action="section-scroll" data-section="section-${i}"${state.readSections.includes(`${m.id}-${i}`) ? ' class="is-read"' : ''}><span class="index-number">${m.id}.${i+1}</span><span>${escape(s.title)}</span></a>`).join('')}</nav><article class="study-content">${m.sections.map((s,i) => renderSection(s,{anchor:`section-${i}`,number:`${m.id}.${i+1}`,actions:button(state.readSections.includes(`${m.id}-${i}`) ? icon('check')+' Leída' : 'Marcar leída','read',`data-id="${m.id}-${i}" aria-pressed="${state.readSections.includes(`${m.id}-${i}`)}"`,'button small secondary')})).join('')}<section><h2>Practica lo aprendido</h2><p>El banco completo del módulo te permite revisar cada solución y consultar el PDF.</p>${button('Ver preguntas del módulo','open-bank',`data-module="${m.id}"`,'button secondary')}</section><section><h2>Fuentes de consulta</h2><ul>${(content.sources || []).map(s => `<li><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.title)}</a></li>`).join('')}</ul></section></article></div>`;
}
function explanation(q) {
  const entry = explanations[q.id];
  const text = q.official ? entry?.text : q.explanation;
  return `<div class="explanation"><h3>Por qué es correcta</h3><p>${escape(text || 'La respuesta indicada es la que figura en la plantilla original. Consulta el PDF para revisar el contexto.')}</p>${entry?.note ? `<p class="source-warning"><strong>Observación sobre la fuente:</strong> ${escape(entry.note)}</p>` : ''}${q.official ? '<small>Explicación didáctica de la plataforma; la clave se conserva según el PDF.</small>' : '<small>Pregunta y explicación EXTRA elaboradas con IA.</small>'}</div>`;
}
function sourceLinks(q) {
  return q.sources?.map(s => `<a href="temas/${encodeURIComponent(s.file)}#page=${s.page}" target="_blank" rel="noopener noreferrer">${escape(s.file.replace('.pdf',''))} · pág. ${s.page}, pregunta ${s.number}</a>`).join('<br>') || '';
}
function bankQuestions() {
  const pool = filter.source === 'extra' ? content.extras : official;
  const query = filter.query.toLocaleLowerCase('es');
  const qs = pool.filter(q => (!filter.module || q.module === Number(filter.module)) && (!query || `${q.text} ${q.options.map(o => o.text).join(' ')}`.toLocaleLowerCase('es').includes(query)) && (!filter.status || (filter.status === 'bookmarks' ? state.bookmarks.includes(q.id) : filter.status === 'unseen' ? !state.stats[q.id]?.seen : state.stats[q.id]?.wrong > 0 && state.stats[q.id]?.lastCorrect !== true)));
  const strictRunning = state.active?.kind === 'strict' && state.active.deadline > Date.now();
  return heading('Banco de preguntas','Busca, consulta soluciones y guarda preguntas. Consultar aquí no altera tus estadísticas de tests.') + (strictRunning ? `<p class="notice" role="note"><strong>Tienes un simulacro en curso.</strong> El banco muestra las soluciones: si consultas ahora, el simulacro dejará de reflejar el examen real. <a href="#test">Volver al simulacro</a></p>` : '') + `<div class="filters"><label>Buscar<input id="bank-search" type="search" placeholder="Palabra, lugar o concepto…" value="${escape(filter.query)}"></label><label>Módulo<select id="bank-module"><option value="">Todos los módulos</option>${MODULES.map(m => `<option value="${m.id}" ${String(filter.module) === String(m.id) ? 'selected' : ''}>${m.id}. ${escape(m.short)}</option>`).join('')}</select></label><label>Banco<select id="bank-source"><option value="official" ${filter.source === 'official' ? 'selected' : ''}>Oficiales</option><option value="extra" ${filter.source === 'extra' ? 'selected' : ''}>EXTRA · IA</option></select></label><label>Estado<select id="bank-status">${[['','Todas'],['unseen','No vistas en tests'],['wrong','Fallos pendientes'],['bookmarks','Guardadas']].map(([id,t]) => `<option value="${id}" ${filter.status === id ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div><p class="muted" id="bank-count">${qs.length} preguntas encontradas</p><div class="question-library">${qs.length ? qs.map(q => `<details class="library-question" data-qid="${escape(q.id)}"><summary><span>${badge(q.official ? `Módulo ${q.module}` : `EXTRA · Módulo ${q.module}`,q.official ? '' : 'extra')} ${escape(q.text)}</span></summary><div class="library-body"><ol type="A">${q.options.map(o => `<li class="${o.id === q.correct ? 'correct-text' : ''}">${escape(o.text)}${o.id === q.correct ? ' <strong>— Correcta</strong>' : ''}</li>`).join('')}</ol>${explanation(q)}<div class="question-source">${sourceLinks(q)}</div>${button(state.bookmarks.includes(q.id) ? 'Quitar de guardadas' : 'Guardar pregunta','bookmark',`data-id="${q.id}"`,'button small secondary')}</div></details>`).join('') : '<div class="empty-state"><h2>No hay coincidencias</h2><p>Prueba otra búsqueda o cambia los filtros.</p></div>'}</div>`;
}
function progress() {
  const s = statSummary();
  return heading('Mi progreso','El historial conserva los intentos terminados y las respuestas para revisarlos.') + `<div class="metrics"><div><strong>${state.history.length}</strong><p>Tests terminados</p></div><div><strong>${percentage(s.seen,official.length)}%</strong><p>Banco oficial recorrido</p></div><div><strong>${percentage(s.correct,s.answered)}%</strong><p>Aciertos oficiales</p></div><div><strong>${state.bookmarks.length}</strong><p>Preguntas guardadas</p></div></div><h2>Cobertura por módulo</h2>${moduleRows()}<div class="section-heading"><h2>Historial de intentos</h2><a href="#ajustes">Exportar mis datos</a></div>${state.history.length ? `<div class="table-wrap"><table><thead><tr><th>Test</th><th>Fecha</th><th>Modo</th><th>Aciertos</th><th>Resultado</th><th>Revisión</th></tr></thead><tbody>${state.history.map(s => `<tr><td>${escape(s.title)}</td><td>${date(s.finishedAt)}</td><td>${s.mode === 'study' ? 'Estudio' : 'Examen'}</td><td>${s.result.correct}/${s.result.total}</td><td>${badge(s.result.passed ? 'APTO' : 'NO APTO',s.result.passed ? 'success' : 'danger')}</td><td><a href="#resultado/${encodeURIComponent(s.id)}">Revisar</a></td></tr>`).join('')}</tbody></table></div>` : `<section class="empty-state"><h2>Tu primer intento empieza cuando tú quieras</h2><p>Al entregar un test aparecerán aquí el resultado y las respuestas.</p><a class="button" href="#modulos">Elegir módulo</a></section>`}`;
}
function settings() {
  const p = state.preferences;
  const counts = PROFILES.map(name => `${name}: ${profiles[name].history.length} intentos`).join(' · ');
  return heading('Configuración','Tu cuenta, el aspecto de la web, la mascota y tus datos. Todo se guarda en esta cuenta.') + `<div class="settings-sections"><section aria-labelledby="set-look"><h2 id="set-look">Apariencia</h2><fieldset class="theme-field"><legend>Tema de la interfaz</legend><div class="segmented"><label><input type="radio" name="theme" value="light" ${p.theme !== 'dark' ? 'checked' : ''}><span>Claro</span></label><label><input type="radio" name="theme" value="dark" ${p.theme === 'dark' ? 'checked' : ''}><span>Oscuro</span></label></div></fieldset><p>Se aplica a toda la web y se recuerda para la cuenta <strong>${escape(meta.activeProfile)}</strong>.</p></section><section class="mascot-settings" aria-labelledby="set-mascot"><div class="mascot-settings-art">${mascotImg(110)}</div><div><h2 id="set-mascot">Mascota acompañante</h2><label class="switch-row"><input type="checkbox" role="switch" id="mascot-toggle" ${p.mascot ? 'checked' : ''}><span class="switch" aria-hidden="true"></span><span>Mostrar el gallo durante los tests</span></label><ul class="compact-list"><li><strong>Modo Estudio:</strong> si te atascas, puedes pedirle hasta tres pistas. Nunca te dice la respuesta.</li><li><strong>Modo Examen:</strong> solo te acompaña; no da pistas sobre las preguntas.</li><li><strong>Simulacro estricto:</strong> sin pistas ni ayudas, como en el examen real.</li></ul></div></section><section aria-labelledby="set-account"><h2 id="set-account">Cuentas locales</h2><p>Estás usando <strong>${escape(meta.activeProfile)}</strong>. Cambia de cuenta con el desplegable «Cuenta» de la barra superior. Cada cuenta (admin, invitado y joe) guarda por separado su progreso, historial, fallos, preguntas guardadas, test en curso, tema y mascota. No usan contraseña y ninguna tiene permisos especiales.</p><p class="small-text">${escape(counts)}</p></section><section aria-labelledby="set-practice"><h2 id="set-practice">Opciones de práctica</h2><label class="check-row"><input type="checkbox" id="default-shuffle" ${p.shuffle ? 'checked' : ''}> Barajar opciones de respuesta por defecto</label><p>Puedes cambiarlo antes de cada test. La corrección siempre sigue el contenido de la respuesta, aunque cambie su letra visible.</p></section><section aria-labelledby="set-data"><h2 id="set-data">Copias de seguridad</h2><p>El progreso se guarda automáticamente en este navegador. Se guarda solo para esta dirección (<strong>${escape(location.origin + location.pathname)}</strong>) y este navegador: otra dirección, otro navegador u otro dispositivo empiezan vacíos. Para llevar tu progreso de uno a otro, exporta una copia aquí e impórtala allí. Borrar los datos del navegador también borra este progreso.</p><p>La copia completa incluye las tres cuentas; también puedes exportar solo la cuenta activa. Cada copia indica qué cuentas contiene. No se envía nada a Internet. Las copias antiguas (anteriores a las cuentas) se pueden importar y se restauran en la cuenta activa.</p><div class="inline-actions">${button('Exportar las tres cuentas','export','data-scope="all"')}${button(`Exportar solo ${escape(meta.activeProfile)}`,'export','data-scope="active"','button secondary')}${button('Importar copia','import','','button secondary')}<input type="file" id="import-file" accept="application/json,.json" hidden></div></section><section><h2>Material original</h2><p>Importación de ${report.sources.length} PDF: ${report.totalOccurrences} apariciones, ${official.length} preguntas distintas. Se han comprobado las cuatro opciones y la clave de todas las preguntas importadas. Las claves se conservan incluso cuando la fuente tiene una posible errata, que se indica en la explicación.</p><div class="source-list">${report.sources.map(s => `<a href="temas/${encodeURIComponent(s.file)}" target="_blank" rel="noopener">${escape(s.file)} <span>${s.questions} preguntas</span></a>`).join('')}</div></section><section class="danger-zone"><h2>Reiniciar el progreso de ${escape(meta.activeProfile)}</h2><p>Borra los intentos, estadísticas, preguntas guardadas, secciones leídas y la sesión en curso de esta cuenta. Las otras cuentas, el tema y la mascota no cambian. Exporta una copia antes si quieres conservarlos.</p>${button('Reiniciar progreso','reset-confirm','','button danger secondary')}</section></div>`;
}
function configure(config) {
  pendingConfig = config;
  const strict = config.kind === 'strict';
  const fixed = ['normal','strict','example'].includes(config.kind);
  const title = strict ? 'Preparar simulacro' : config.kind === 'example' ? examples.find(e => e.id === config.example)?.title : config.kind === 'module' ? moduleName(config.module) : config.kind === 'extra' ? 'Preparar preguntas EXTRA' : 'Preparar repaso de fallos';
  const defaultCount = config.module ? MODULES.find(m => m.id === Number(config.module)).count : 10;
  modal(title, `<form id="config-form">${strict ? '<p>60 minutos, sin corrección hasta entregar. El reloj sigue corriendo si sales.</p>' : `<fieldset><legend>¿Cómo quieres practicar?</legend><label class="mode-choice"><input type="radio" name="mode" value="study" checked><span><strong>Modo Estudio</strong><small>Corrección y explicación al responder. Cuenta la primera respuesta.</small></span></label><label class="mode-choice"><input type="radio" name="mode" value="exam"><span><strong>Modo Examen</strong><small>Cambia tus respuestas libremente y revisa la corrección al entregar.</small></span></label></fieldset>`}${!fixed ? `<div class="form-grid"><label>Número de preguntas<select name="count">${[5,10,12,18,20,30].map(n => `<option value="${n}" ${n === defaultCount ? 'selected' : ''}>${n} preguntas</option>`).join('')}<option value="all">Batería completa</option></select></label>${!config.module ? `<label>Módulo<select name="module"><option value="">Todos</option>${MODULES.map(m => `<option value="${m.id}">${m.id}. ${escape(m.short)}</option>`).join('')}</select></label>` : ''}</div>` : '<p><strong>60 preguntas</strong> · Reparto 12 / 18 / 18 / 12.</p>'}${!strict ? '<label>Tiempo<select name="minutes"><option value="0">Sin límite de tiempo</option><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">60 minutos</option></select></label>' : ''}<label class="check-row"><input type="checkbox" name="shuffle" ${state.preferences.shuffle ? 'checked' : ''}> Barajar opciones de respuesta</label>${config.kind === 'wrong' ? '<label class="check-row"><input type="checkbox" name="recovered"> Incluir errores ya recuperados</label>' : ''}<p class="muted small-text">${!fixed ? 'Si el banco tiene menos preguntas, se utilizarán todas las disponibles. ' : ''}No hay módulos bloqueados ni un recorrido obligatorio.</p></form>`, button('Cancelar','close-modal','','button secondary')+button('Comenzar','start'));
}
function startConfigured() {
  const data = new FormData($('#config-form'));
  const config = { ...pendingConfig, mode:pendingConfig.kind === 'strict' ? 'exam' : data.get('mode'), count:data.get('count'), all:data.get('count') === 'all', module:pendingConfig.module || Number(data.get('module')) || null, shuffle:data.has('shuffle'), includeRecovered:data.has('recovered'), minutes:pendingConfig.kind === 'strict' ? 60 : Number(data.get('minutes')) };
  $('#modal').close();
  if (state.active) {
    pendingConfig = config;
    confirmAction('Ya tienes un test en curso','Puedes continuar el test actual o entregar sus respuestas y comenzar el nuevo. Se conservará el resultado en el historial.','replace-session','Entregar y comenzar');
    return;
  }
  startSession(config);
}
function startSession(config) {
  const pool = config.kind === 'extra' ? content.extras : official;
  let questions;
  try {
    questions = config.kind === 'example' ? examples.find(e => e.id === config.example).questionIds.map(id => byId.get(id)) : selectQuestions(pool, state.stats, config);
  } catch (error) { notify(error.message,true); return; }
  if (!questions.length) { notify('No hay preguntas para esa selección. Cambia el módulo o incluye errores ya recuperados.'); return; }
  const title = config.kind === 'example' ? examples.find(e => e.id === config.example).title : config.kind === 'strict' ? 'Simulacro oficial' : config.kind === 'normal' ? 'Test de 60 preguntas' : config.kind === 'extra' ? 'Práctica EXTRA' : config.kind === 'wrong' ? 'Repaso de fallos' : moduleName(config.module);
  const startedAt = Date.now();
  state.active = { id:crypto.randomUUID(), title, kind:config.kind, mode:config.mode, questionIds:questions.map(q => q.id), answers:{}, firstAnswers:{}, order:Object.fromEntries(questions.map(q => [q.id,(config.shuffle ? shuffleOptions(q.options) : q.options).map(o => o.id)])), index:0, flagged:[], visited:[], startedAt, deadline:config.minutes ? startedAt + config.minutes*60000 : null, elapsedMs:0, resumedAt:startedAt, paused:false };
  persist();
  if (location.hash === '#test') render(); else navigate('test');
}
function pauseSession() {
  const s = state.active;
  if (!s || s.kind === 'strict' || s.paused) return;
  s.elapsedMs = (s.elapsedMs || 0) + Date.now() - s.resumedAt;
  s.remainingMs = s.deadline ? Math.max(0,s.deadline-Date.now()) : null;
  s.deadline = null;
  s.paused = true;
  persist();
}
function resumeSession() {
  const s = state.active;
  if (!s?.paused) return;
  s.resumedAt = Date.now();
  s.deadline = Number.isFinite(s.remainingMs) ? Date.now()+Math.max(0,s.remainingMs) : null;
  s.paused = false;
  persist(); render();
}
function coach(s, q, revealed, selected, hint, policy) {
  if (!state.preferences.mascot) return '';
  let text, actions = '';
  if (policy.nudge === 'none') text = 'Simulacro estricto: aquí no doy pistas, como en el examen real. Te acompaño sin molestar.';
  else if (!policy.hints) text = 'Modo Examen: no doy pistas para que el resultado sea real. Si dudas, márcala y vuelve después.';
  else if (revealed) text = selected === q.correct ? '¡Bien visto! Lee la explicación para fijarlo.' : 'Sin prisa: la explicación te ayuda a no repetir el error.';
  else if (hint) {
    text = hint.text;
    if (hint.level === 2) actions += `<a class="button small text-button" href="#temario/${q.module}${hint.section != null ? `/${hint.section}` : ''}" title="La práctica queda en pausa y la retomas desde «Continuar test»">${hint.section != null ? 'Abrir esa sección' : 'Abrir el temario del módulo'}</a>`;
    if (hint.level < 3) actions += button(`${icon('bulb')} Otra pista <span class="hint-count">${hint.level}/3</span>`,'hint','','button small secondary');
  } else { text = 'Estoy aquí si me necesitas. Las pistas te orientan; la respuesta la eliges tú.'; actions = button(`${icon('bulb')} Pedir una pista`,'hint','','button small secondary'); }
  const hop = hopNext && hint && !revealed;
  hopNext = false;
  return `<aside class="coach${hint && !revealed ? ' has-hint' : ''}${hop ? ' hop' : ''}" aria-label="Mascota acompañante">${mascotImg(64,'coach-img')}<div class="coach-bubble"><p id="coach-bubble">${escape(text)}</p>${actions ? `<div class="coach-actions">${actions}</div>` : ''}</div>${button(icon('close'),'mascot-off','aria-label="Ocultar la mascota (puedes reactivarla en Configuración)" title="Ocultar mascota"','icon-button coach-close')}</aside>`;
}
function testPage() {
  const s = state.active;
  if (!s) return heading('No hay un test en curso','Elige qué quieres practicar.') + moduleRows();
  if (s.paused) return heading('Test en pausa',s.title) + `<section class="empty-state"><h2>Todo está guardado</h2><p>${Object.keys(s.answers).length} de ${s.questionIds.length} preguntas respondidas. Puedes continuar cuando quieras.</p>${button('Continuar test','resume')}</section>`;
  const q = byId.get(s.questionIds[s.index]);
  if (!s.visited.includes(q.id)) {
    s.visited.push(q.id);
    const stat = state.stats[q.id] ||= {seen:0,answered:0,correct:0,wrong:0};
    stat.seen++;
    persist();
  }
  const selected = s.answers[q.id];
  const revealed = s.mode === 'study' && !!selected;
  const answered = Object.keys(s.answers).length;
  const policy = hintPolicy(s);
  const sections = content.modules.find(m => m.id === q.module)?.sections || [];
  const hintLevel = policy.hints ? s.hints?.[q.id] || 0 : 0;
  const hint = hintLevel ? nextHint(q, hintLevel, sections, s.order[q.id], hints[q.id]) : null;
  const discard = !revealed && hintLevel >= 3 ? hint.discard : null;
  return `${heading(s.title,`${s.mode === 'study' ? 'Modo Estudio · Corrección inmediata' : 'Modo Examen · Corrección al entregar'}${s.kind === 'extra' ? ' · Preguntas generadas con IA' : ''}`,`<span class="timer" id="timer">${clock(s.deadline ? s.deadline-Date.now() : (s.elapsedMs||0)+Date.now()-s.resumedAt)}</span>`)}<div class="test-layout"><section class="test-question"><div class="question-top">${badge(q.official ? `Módulo ${q.module} · ${MODULES[q.module-1].short}` : `EXTRA · Módulo ${q.module}`,q.official ? '' : 'extra')}<span>Pregunta ${s.index+1} de ${s.questionIds.length}</span></div><h2 id="question-title" tabindex="-1">${escape(q.text)}</h2><div class="answers" role="group" aria-labelledby="question-title">${s.order[q.id].map((id,i) => {
    const option = q.options.find(o => o.id === id);
    const cls = revealed && id === q.correct ? ' correct' : revealed && id === selected ? ' incorrect' : id === selected ? ' selected' : id === discard ? ' discarded' : '';
    return button(`<span class="answer-letter">${String.fromCharCode(65+i)}</span><span>${escape(option.text)}</span>${revealed && id === q.correct ? '<strong class="answer-mark">Correcta</strong>' : revealed && id === selected ? '<strong class="answer-mark">Tu respuesta</strong>' : id === discard ? '<span class="answer-mark">Descartada por la pista</span>' : ''}`,'answer',`data-id="${id}" aria-pressed="${id === selected}" ${revealed ? 'disabled' : ''}`,'answer'+cls);
  }).join('')}</div>${revealed ? `<div class="answer-feedback ${selected === q.correct ? 'is-correct' : 'is-wrong'}" role="status"><strong>${selected === q.correct ? 'Respuesta correcta' : 'Esta vez no ha sido correcta'}</strong>${explanation(q)}<div class="question-source">${sourceLinks(q)}</div></div>` : ''}${coach(s, q, revealed, selected, hint, policy)}<div class="question-tools">${button(icon('flag')+(s.flagged.includes(q.id) ? ' Marcada para revisar' : ' Marcar para revisar'),'flag',`aria-pressed="${s.flagged.includes(q.id)}"`,'button small secondary')}${button(state.bookmarks.includes(q.id) ? 'Quitar de guardadas' : 'Guardar pregunta','bookmark',`data-id="${q.id}"`,'button small secondary')}${s.mode === 'exam' && selected ? button('Dejar en blanco','clear-answer','','button small text-button') : ''}</div><div class="test-controls">${button('Anterior','previous',s.index === 0 ? 'disabled' : '','button secondary')}${s.index < s.questionIds.length-1 ? button(selected ? 'Siguiente' : 'Saltar pregunta','next') : button('Revisar y entregar','finish-confirm')}</div></section><aside class="test-overview"><h2>Tu test</h2><p>${answered} respondidas · ${s.questionIds.length-answered} en blanco</p><div class="question-grid">${s.questionIds.map((id,i) => button(String(i+1),'jump',`data-index="${i}" aria-label="Pregunta ${i+1}${s.answers[id] ? ', respondida' : ', en blanco'}${s.flagged.includes(id) ? ', marcada para revisar' : ''}" ${i === s.index ? 'aria-current="step"' : ''}`,'question-dot'+(s.answers[id] ? ' answered' : '')+(s.flagged.includes(id) ? ' flagged' : ''))).join('')}</div><p class="small-text muted">Relleno: respondida · Borde naranja: marcada. Pulsa cualquier número para navegar.</p><div class="overview-actions">${button('Entregar test','finish-confirm')}${s.kind !== 'strict' ? button('Pausar y guardar','pause','','button secondary') : '<a class="button secondary" href="#inicio">Salir (el reloj sigue)</a>'}</div>${s.mode === 'study' ? '<p class="small-text muted">Cuenta tu primera respuesta. Puedes volver a cualquier pregunta para revisar la explicación.</p>' : ''}</aside></div>`;
}
function resultPage(id) {
  const session = state.history.find(s => s.id === id);
  if (!session) return progress();
  const r = session.result;
  const qs = session.questionIds.map(id => byId.get(id));
  const reviewed = qs.filter(q => reviewFilter === 'all' || reviewFilter === 'wrong' && session.answers[q.id] && session.answers[q.id] !== q.correct || reviewFilter === 'blank' && !session.answers[q.id] || reviewFilter === 'flagged' && session.flagged.includes(q.id));
  return heading('Resultado del test',`${session.title} · ${date(session.finishedAt)} · ${session.mode === 'study' ? 'Estudio' : 'Examen'}`,`<a class="button secondary" href="#progreso">Ver historial</a>`) + `<section class="result-summary ${r.passed ? 'passed' : 'failed'}"><div><span class="result-label">${r.passed ? 'APTO' : 'NO APTO'}</span><p>${r.passed ? 'Has alcanzado el mínimo en todos los módulos de este test.' : 'Algún módulo de este test no ha alcanzado el mínimo.'}</p>${session.questionIds.length !== 60 ? '<small>Resultado de práctica calculado sobre las preguntas realizadas.</small>' : ''}${Object.keys(session.hints || {}).length ? `<small>Pediste pistas en ${Object.keys(session.hints).length} ${Object.keys(session.hints).length === 1 ? 'pregunta' : 'preguntas'}.</small>` : ''}</div><div class="result-numbers"><strong>${r.correct}<span> / ${r.total}</span></strong><p>${r.wrong} errores · ${r.blank} en blanco</p></div></section>${state.preferences.mascot ? `<aside class="coach coach-result" aria-label="Mascota acompañante">${mascotImg(64,'coach-img')}<div class="coach-bubble"><p>${r.passed ? 'Buen trabajo. Repasa los errores que queden para fijar lo aprendido.' : 'Aún no, pero ya sabes dónde mirar: empieza por los módulos que no llegan al mínimo.'}</p></div></aside>` : ''}<div class="result-modules">${r.modules.map(m => `<article><h3>${escape(MODULES[m.id-1].short)}</h3><p><strong>${m.correct}/${m.total}</strong> · mínimo ${m.min}</p>${badge(m.passed ? 'APTO' : 'NO APTO',m.passed ? 'success' : 'danger')}</article>`).join('')}</div><div class="section-heading"><h2>Revisa tus respuestas</h2><label>Mostrar<select id="review-filter">${[['all','Todas'],['wrong','Solo errores'],['blank','En blanco'],['flagged','Marcadas']].map(([value,label]) => `<option value="${value}" ${value === reviewFilter ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><div class="question-library">${reviewed.map(q => `<details class="library-question" data-qid="${escape(q.id)}"><summary><span>${badge(!session.answers[q.id] ? 'En blanco' : session.answers[q.id] === q.correct ? 'Correcta' : 'Error',!session.answers[q.id] ? '' : session.answers[q.id] === q.correct ? 'success' : 'danger')} ${q.official ? '' : badge('EXTRA','extra')} ${escape(q.text)}</span></summary><div class="library-body"><ol type="A">${session.order[q.id].map(id => { const o = q.options.find(o => o.id === id); return `<li class="${id === q.correct ? 'correct-text' : id === session.answers[q.id] ? 'wrong-text' : ''}">${escape(o.text)}${id === q.correct ? ' <strong>— Correcta</strong>' : ''}${id === session.answers[q.id] ? ' <strong>— Tu respuesta</strong>' : ''}</li>`; }).join('')}</ol>${explanation(q)}<div class="question-source">${sourceLinks(q)}</div></div></details>`).join('') || '<p class="empty-state">No hay preguntas en esta selección.</p>'}</div>`;
}
// Identifica el control enfocado para volver a enfocarlo después de redibujar la página.
function focusKey(el) {
  if (!el || el === document.body || !$('#app')?.contains(el)) return null;
  const caret = typeof el.selectionStart === 'number' ? [el.selectionStart, el.selectionEnd] : null;
  if (el.id) return { selector:`#${CSS.escape(el.id)}`, caret };
  if (el.dataset.action) return { selector:['action','id','index','kind','module','example','scope','to'].filter(k => el.dataset[k] != null).map(k => `[data-${k}="${CSS.escape(el.dataset[k])}"]`).join('') };
  if (el.name && el.type === 'radio') return { selector:`input[name="${CSS.escape(el.name)}"][value="${CSS.escape(el.value)}"]` };
  if (el.tagName === 'SUMMARY' && el.parentElement?.dataset.qid) return { selector:`details[data-qid="${CSS.escape(el.parentElement.dataset.qid)}"] > summary` };
  if (el.tagName === 'A' && el.getAttribute('href')) { const area = el.closest('.sidebar') ? '.sidebar' : el.closest('.topbar') ? '.topbar' : 'main'; return { selector:`${area} a[href="${CSS.escape(el.getAttribute('href'))}"]`, sidebar: area === '.sidebar' }; }
  return null;
}
function restoreFocus(key) {
  if (!key || document.activeElement && document.activeElement !== document.body) return;
  const el = $(key.selector);
  if (!el || el.disabled) return;
  el.focus({ preventScroll:true });
  if (key.caret && el.setSelectionRange) el.setSelectionRange(...key.caret);
}
function render() {
  const focus = focusKey(document.activeElement);
  const parts = (location.hash.slice(1) || 'inicio').split('/');
  const page = parts[0];
  const previousRoute = route;
  const routeChanged = route !== page;
  const openDetails = routeChanged ? [] : [...document.querySelectorAll('details[data-qid][open]')].map(d => d.dataset.qid);
  if (route === 'test' && page !== 'test') pauseSession();
  route = page;
  navOpen = false;
  let body;
  if (page === 'inicio') body = home();
  else if (['modulos','normales','simulacro','fallos','extra'].includes(page)) body = practicePage(page);
  else if (page === 'temario') body = study(parts[1]);
  else if (page === 'banco') body = bankQuestions();
  else if (page === 'progreso') body = progress();
  else if (page === 'ajustes') body = settings();
  else if (page === 'test') body = testPage();
  else if (page === 'resultado') body = resultPage(decodeURIComponent(parts[1] || ''));
  else body = home();
  rendering = true;
  try { shell(body,page); } finally { rendering = false; }
  profileKeyNav = false;
  for (const id of openDetails) document.querySelector(`details[data-qid="${CSS.escape(id)}"]`)?.setAttribute('open', '');
  // Al cambiar de página el foco pasa al contenido nuevo (o a la pregunta, en un test), salvo si se navegaba por el menú.
  if (routeChanged && previousRoute && !focus?.sidebar) (page === 'test' && $('#question-title') || $('#main'))?.focus({ preventScroll:true });
  else restoreFocus(focus);
  scheduleNudge();
  document.title = `${page === 'test' ? state.active?.title || 'Test' : ({inicio:'Inicio',temario:'Temario',modulos:'Tests por módulos',normales:'Tests de 60',simulacro:'Simulacro',fallos:'Repasar fallos',extra:'Preguntas EXTRA',banco:'Banco de preguntas',progreso:'Mi progreso',ajustes:'Configuración',resultado:'Resultado'})[page] || 'Inicio'} · VTC Madrid`;
}
// Si llevas un rato sin responder la misma pregunta, la mascota lo menciona una sola vez. Nunca da la pista por su cuenta.
function scheduleNudge() {
  clearTimeout(nudgeTimer);
  const s = state.active;
  if (route !== 'test' || !s || s.paused || !state.preferences.mascot) return;
  const policy = hintPolicy(s);
  if (policy.nudge === 'none') return;
  const id = s.questionIds[s.index];
  const key = `${meta.activeProfile}:${s.id}:${id}`;
  if (s.answers[id] || s.hints?.[id] || nudged.has(key)) return;
  nudgeTimer = setTimeout(() => {
    if (document.hidden || $('#modal').open || state.active !== s || s.paused || s.questionIds[s.index] !== id || s.answers[id] || !$('#coach-bubble')) return;
    nudged.add(key);
    const text = policy.nudge === 'stuck' ? '¿Te has atascado? Si quieres, te doy una pista. Tú decides.' : 'Si dudas, márcala para revisar y sigue: puedes volver cuando quieras.';
    $('#coach-bubble').textContent = text;
    $('.coach')?.classList.add('is-talking');
    announce(text);
  }, policy.nudge === 'stuck' ? 45000 : 90000);
}
function announce(text) {
  const live = $('#sr-live');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 50);
}
function scrollToSection() {
  const [page, , section] = location.hash.slice(1).split('/');
  const target = page === 'temario' && section != null ? document.getElementById(`section-${section}`) : null;
  if (target) target.scrollIntoView(); else window.scrollTo({ top:0 });
}
async function exportBackup(scope) {
  const only = scope === 'active' ? [meta.activeProfile] : PROFILES;
  await saving.catch(() => {});
  for (const name of only) await syncProfile(name, true);
  const backup = buildBackup(meta, profiles, only);
  const blob = new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`vtc-madrid-copia-${only.length === 1 ? only[0] : 'cuentas'}-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  notify(`Copia exportada: ${backup.includedProfiles.join(', ')}.`);
}
async function restoreBackup() {
  const data = pendingRestore;
  pendingRestore = null;
  $('#modal').close();
  if (data.kind === 'legacy') data.state.preferences = { ...state.preferences, ...Object.fromEntries(data.explicitPreferences.map(k => [k, data.state.preferences[k]])) };
  const restored = data.kind === 'legacy' ? { [meta.activeProfile]: data.state } : data.profiles;
  for (const st of Object.values(restored)) settle(st);
  switching = true;
  try {
    await queueSave(() => saveAllTracked(null, restored));
  } catch { notify('No se ha podido restaurar la copia. Tus datos actuales no se han cambiado.', true); return; }
  finally { switching = false; }
  for (const name of Object.keys(restored)) gens[name] = (gens[name] || 0) + 1;
  Object.assign(profiles, restored);
  state = profiles[meta.activeProfile];
  applyPreferences();
  render();
  notify(`Copia restaurada: ${Object.keys(restored).join(', ')}.`);
}
function submit() {
  if (!state.active) return;
  const deadline = state.active.deadline;
  const result = finishSession(state,bank,deadline && deadline < Date.now() ? deadline : Date.now());
  persist();
  $('#modal').close();
  reviewFilter = 'all';
  if (result) navigate(`resultado/${result.id}`);
}
function updateQuestion(index) {
  const s = state.active;
  if (!s || s.paused) return;
  s.index = Math.min(s.questionIds.length-1,Math.max(0,index));
  persist(); render();
  $('#question-title')?.focus({preventScroll:true});
  window.scrollTo({ top:0 });
}
document.addEventListener('click', event => {
  if (event.target.closest('.skip')) { event.preventDefault(); $('#main')?.focus(); return; }
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  event.preventDefault();
  if (switching) return;
  const action = target.dataset.action;
  const s = state?.active;
  if (action === 'reload') location.reload();
  if (action === 'menu') { navOpen = !navOpen; $('.layout').classList.toggle('nav-open',navOpen); target.setAttribute('aria-expanded',String(navOpen)); }
  if (action === 'close-modal') $('#modal').close();
  if (action === 'go') navigate(target.dataset.to);
  if (action === 'configure') configure({kind:target.dataset.kind,module:Number(target.dataset.module)||null,example:target.dataset.example});
  if (action === 'start') startConfigured();
  if (action === 'replace-session') { const config = pendingConfig; finishSession(state,bank); persist(); $('#modal').close(); render(); startSession(config); }
  if (action === 'resume') { resumeSession(); $('#question-title')?.focus({preventScroll:true}); }
  if (action === 'pause') { pauseSession(); render(); $('[data-action="resume"]')?.focus({preventScroll:true}); }
  if (action === 'answer' && s && !s.paused) {
    if (s.deadline && Date.now() >= s.deadline) { submit(); return; }
    const id = s.questionIds[s.index];
    if (s.mode === 'study' && s.firstAnswers[id]) return;
    s.answers[id] = target.dataset.id;
    s.firstAnswers[id] ||= target.dataset.id;
    persist(); render();
    if (document.activeElement === document.body) ($('.test-controls [data-action="next"]') || $('.test-controls [data-action="finish-confirm"]'))?.focus({preventScroll:true});
  }
  if (action === 'clear-answer' && s?.mode === 'exam') { delete s.answers[s.questionIds[s.index]]; persist(); render(); $('.answers .answer')?.focus({preventScroll:true}); }
  if (action === 'next') updateQuestion(s.index+1);
  if (action === 'previous') updateQuestion(s.index-1);
  if (action === 'jump') updateQuestion(Number(target.dataset.index));
  if (action === 'flag' && s) { const id = s.questionIds[s.index]; s.flagged = s.flagged.includes(id) ? s.flagged.filter(x => x !== id) : [...s.flagged,id]; persist(); render(); }
  if (action === 'bookmark') { const id = target.dataset.id; state.bookmarks = state.bookmarks.includes(id) ? state.bookmarks.filter(x => x !== id) : [...state.bookmarks,id]; persist(); if (route === 'banco') { target.textContent = state.bookmarks.includes(id) ? 'Quitar de guardadas' : 'Guardar pregunta'; } else render(); }
  if (action === 'finish-confirm' && s) confirmAction('Entregar test',`Has respondido ${Object.keys(s.answers).length} de ${s.questionIds.length} preguntas. Quedarán ${s.questionIds.length-Object.keys(s.answers).length} en blanco. ¿Quieres entregar y ver la corrección?`,'finish','Entregar y corregir');
  if (action === 'finish') submit();
  if (action === 'read') { const id = target.dataset.id; state.readSections = state.readSections.includes(id) ? state.readSections.filter(x => x !== id) : [...state.readSections,id]; persist(); target.innerHTML = state.readSections.includes(id) ? icon('check')+' Leída' : 'Marcar leída'; target.setAttribute('aria-pressed',String(state.readSections.includes(id))); document.querySelector(`.study-index [data-section="section-${id.split('-')[1]}"]`)?.classList.toggle('is-read',state.readSections.includes(id)); }
  if (action === 'section-scroll') document.getElementById(target.dataset.section)?.scrollIntoView();
  if (action === 'open-bank') { filter.module = target.dataset.module; navigate('banco'); }
  if (action === 'export') exportBackup(target.dataset.scope);
  if (action === 'hint' && s && !s.paused) {
    const id = s.questionIds[s.index];
    if (!hintPolicy(s).hints || s.answers[id] || (s.hints?.[id] || 0) >= 3) return;
    s.hints = { ...(s.hints || {}), [id]: (s.hints?.[id] || 0) + 1 };
    hopNext = true;
    persist(); render();
    announce($('#coach-bubble')?.textContent || '');
    ($('.coach [data-action="hint"]') || $('#question-title'))?.focus({preventScroll:true});
  }
  if (action === 'mascot-off') { state.preferences.mascot = false; persist(); render(); notify('Mascota oculta. Puedes volver a activarla en Configuración.'); $('#question-title')?.focus({preventScroll:true}); }
  if (action === 'import') $('#import-file').click();
  if (action === 'reset-confirm') confirmAction(`Reiniciar el progreso de ${meta.activeProfile}`,`Se borrarán los intentos, estadísticas, preguntas guardadas, secciones leídas y el test en curso de la cuenta ${meta.activeProfile}. Las otras cuentas no cambian. Esta acción no se puede deshacer sin una copia.`,'reset','Borrar el progreso');
  if (action === 'reset') { state = { ...emptyState(), preferences:{ ...state.preferences } }; profiles[meta.activeProfile] = state; persist(); $('#modal').close(); render(); notify(`Progreso de ${meta.activeProfile} reiniciado.`); }
  if (action === 'restore' && pendingRestore) restoreBackup();
});
document.addEventListener('change', async event => {
  const target = event.target;
  if (target.id === 'bank-module') { filter.module = target.value; render(); }
  if (target.id === 'bank-source') { filter.source = target.value; render(); }
  if (target.id === 'bank-status') { filter.status = target.value; render(); }
  if (target.id === 'review-filter') { reviewFilter = target.value; render(); }
  if (target.id === 'default-shuffle') { state.preferences.shuffle = target.checked; persist(); }
  if (target.id === 'profile-select' && !profileKeyNav) switchProfile(target.value);
  if (target.name === 'theme' && target.checked) { state.preferences.theme = target.value === 'dark' ? 'dark' : 'light'; persist(); applyPreferences(); notify(`Tema ${target.value === 'dark' ? 'oscuro' : 'claro'} guardado para ${meta.activeProfile}.`); }
  if (target.id === 'mascot-toggle') { state.preferences.mascot = target.checked; persist(); notify(target.checked ? 'Mascota activada.' : 'Mascota desactivada.'); }
  if (target.id === 'import-file' && target.files[0]) {
    try {
      if (target.files[0].size > 20000000) throw new Error('La copia supera el límite de 20 MB.');
      let parsed;
      try { parsed = JSON.parse(await target.files[0].text()); } catch { throw new Error('El archivo no es una copia JSON válida. Tus datos actuales no se han cambiado.'); }
      pendingRestore = parseBackup(parsed,bank);
      if (pendingRestore.kind === 'legacy') confirmAction('Restaurar copia antigua',`Es una copia anterior a las cuentas, con ${pendingRestore.state.history.length} intentos. Se restaurará solo en la cuenta activa (${meta.activeProfile}) y reemplazará su progreso. Las otras cuentas no cambian. Exporta primero si quieres conservar los datos actuales.`,'restore','Restaurar en '+meta.activeProfile);
      else confirmAction('Restaurar copia',`Esta copia contiene: ${Object.entries(pendingRestore.profiles).map(([n,st]) => `${n} (${st.history.length} intentos)`).join(', ')}. Reemplazará el progreso de esas cuentas; las que no aparecen no cambian. Exporta primero si quieres conservar los datos actuales.`,'restore','Restaurar copia');
    } catch (error) { pendingRestore = null; notify(error.message,true); }
    target.value = '';
  }
});
document.addEventListener('input', event => {
  if (event.target.id !== 'bank-search') return;
  filter.query = event.target.value;
  clearTimeout(filter.timer);
  filter.timer = setTimeout(() => {
    if (route !== 'banco') return;
    const focused = document.activeElement?.id === 'bank-search';
    const caret = $('#bank-search')?.selectionStart;
    render();
    if (focused) { $('#bank-search').focus(); $('#bank-search').setSelectionRange(caret,caret); }
  },200);
});
document.addEventListener('keydown', event => {
  if (event.target.id !== 'profile-select') return;
  if (event.key === 'Enter') { event.preventDefault(); profileKeyNav = false; switchProfile(event.target.value); return; }
  if (event.key === 'Escape') { profileKeyNav = false; event.target.value = meta.activeProfile; return; }
  if (!event.altKey && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(event.key) || /^\w$/.test(event.key)) profileKeyNav = true;
});
document.addEventListener('pointerdown', event => { if (event.target.closest?.('#profile-select')) profileKeyNav = false; });
$('#modal').addEventListener('close', () => { if (state) PROFILES.forEach(name => syncProfile(name)); });
document.addEventListener('focusout', event => {
  if (event.target.id !== 'profile-select' || rendering) return;
  profileKeyNav = false;
  if (event.target.value !== meta.activeProfile) switchProfile(event.target.value);
});
window.addEventListener('hashchange', () => { $('#modal').close(); render(); scrollToSection(); });
window.addEventListener('beforeunload', event => { if (!lastSaved) { event.preventDefault(); event.returnValue=''; } });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state?.active && state.active.kind !== 'strict') { pauseSession(); if (route === 'test') render(); }
  if (!document.hidden && state) PROFILES.forEach(name => syncProfile(name));
});
window.addEventListener('focus', () => { if (state) PROFILES.forEach(name => syncProfile(name)); });
channel?.addEventListener('message', ({ data }) => { if (state && PROFILES.includes(data?.name) && data.rev !== revs[data.name]) syncProfile(data.name); });

async function init() {
  try {
    const load = async name => { const response = await fetch(`data/${name}.json`); if (!response.ok) throw new Error(`No se ha podido cargar ${name}.`); return response.json(); };
    [official, examples, content, explanations, report, hints] = await Promise.all([...['questions','examples','content','explanations','import-report'].map(load), load('hints').catch(() => ({}))]);
    bank = [...official,...content.extras];
    bank.forEach(q => byId.set(q.id,q));
    const stored = await openStorage();
    revs = stored.revs;
    const loaded = initialProfiles(stored, bank);
    ({ meta, profiles } = loaded);
    const expired = PROFILES.filter(name => closeExpired(profiles[name]));
    const changed = new Set([...PROFILES.filter(name => settle(profiles[name])), ...expired, ...loaded.issues.map(i => i.name)]);
    if (loaded.migrated) await saveAllTracked(meta, profiles, quarantine(loaded.issues));
    else if (changed.size) await saveAllTracked(meta, Object.fromEntries([...changed].map(name => [name, profiles[name]])), quarantine(loaded.issues));
    state = profiles[meta.activeProfile];
    applyPreferences();
    render();
    scrollToSection();
    if (loaded.issues.length) notify(`Aviso: ${issueText(loaded.issues)}. El contenido original se ha guardado aparte en este navegador.`, true);
    else if (expired.includes(meta.activeProfile)) notify('Tu simulacro había terminado: se ha entregado con su hora límite.');
    setInterval(() => {
      const s = state.active;
      if (!s || s.paused) return;
      const remaining = s.deadline ? s.deadline-Date.now() : (s.elapsedMs||0)+Date.now()-s.resumedAt;
      if ($('#timer')) { $('#timer').textContent = clock(remaining); $('#timer').classList.toggle('urgent',!!s.deadline && remaining < 300000); }
      if (s.deadline && remaining <= 0 && !expiryRunning && !switching) { expiryRunning=true; submit(); notify('Tiempo agotado. El test se ha entregado automáticamente.'); expiryRunning=false; }
    },1000);
  } catch (error) {
    $('#app').innerHTML = `<main class="loading"><h1>No se ha podido abrir tu espacio</h1><p>${escape(error.message)}</p><p>Comprueba que has iniciado INICIAR.cmd y que el almacenamiento del navegador está disponible. No se han borrado tus datos.</p><button class="button" data-action="reload">Reintentar</button></main>`;
  }
}
init();
