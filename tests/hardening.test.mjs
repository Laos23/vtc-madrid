import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { emptyState, validateBackup, finishSession } from '../src/core.js';
import { PROFILES, initialProfiles, buildBackup, parseBackup } from '../src/profiles.js';
import { nextHint, sectionFor } from '../src/hints.js';

const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const questions = read('questions');
const content = read('content');
const bank = [...questions, ...content.extras];
const ids = questions.slice(0, 3).map(q => q.id);
const session = extra => ({ id: 's', title: 't', kind: 'module', mode: 'exam', questionIds: ids, answers: {}, firstAnswers: {}, order: Object.fromEntries(ids.map(id => [id, ['a', 'b', 'c', 'd']])), index: 0, flagged: [], visited: [], startedAt: 1_700_000_000_000, ...extra });
const withActive = active => ({ ...emptyState(), active });

test('copias: campos de pausa y reloj se validan (simulacro nunca en pausa, números finitos)', () => {
  const strict = { kind: 'strict', deadline: 1_700_003_600_000 };
  assert.throws(() => validateBackup(withActive(session({ ...strict, paused: true })), bank));
  assert.throws(() => validateBackup(withActive(session({ paused: 'sí' })), bank));
  assert.throws(() => validateBackup(withActive(session({ paused: true, remainingMs: 'abc' })), bank));
  assert.throws(() => validateBackup(withActive(session({ paused: true, remainingMs: -5 })), bank));
  assert.throws(() => validateBackup(withActive(session({ elapsedMs: Infinity })), bank));
  assert.throws(() => validateBackup(withActive(session({ resumedAt: 'ayer' })), bank));
  assert.ok(validateBackup(withActive(session({ paused: true, remainingMs: null, elapsedMs: 5000, resumedAt: 1_700_000_000_000 })), bank).active);
  assert.ok(validateBackup(withActive(session({ ...strict, paused: false, elapsedMs: 0, resumedAt: 1_700_000_000_000 })), bank).active);
});

test('copias: fechas fuera del rango de Date se rechazan', () => {
  const done = s => ({ ...emptyState(), history: [{ ...s, finishedAt: 1_700_000_100_000 }] });
  assert.throws(() => validateBackup({ ...emptyState(), history: [{ ...session(), finishedAt: 1e20 }] }, bank));
  assert.throws(() => validateBackup(done(session({ startedAt: 1e300 })), bank));
  assert.throws(() => validateBackup(withActive(session({ deadline: 9e15 })), bank));
  assert.equal(validateBackup(done(session()), bank).history.length, 1);
});

test('copias: includedProfiles debe ser exactamente la lista de cuentas', () => {
  const ok = buildBackup({ version: 2, activeProfile: 'admin' }, Object.fromEntries(PROFILES.map(n => [n, emptyState()])));
  assert.throws(() => parseBackup({ ...ok, includedProfiles: ['admin,invitado,joe'] }, bank));
  assert.throws(() => parseBackup({ ...ok, includedProfiles: [['admin', 'invitado'], 'joe'] }, bank));
  assert.throws(() => parseBackup({ ...ok, includedProfiles: ['admin', 'admin', 'invitado', 'joe'] }, bank));
  assert.equal(parseBackup(ok, bank).kind, 'profiles');
});

test('copia antigua: indica qué preferencias trae para no pisar tema ni mascota de la cuenta', () => {
  assert.deepEqual(parseBackup({ ...emptyState(), preferences: { shuffle: false } }, bank).explicitPreferences, ['shuffle']);
  assert.deepEqual(parseBackup({ version: 1, stats: {}, history: [] }, bank).explicitPreferences, []);
  assert.deepEqual(parseBackup({ ...emptyState(), preferences: { shuffle: true, theme: 'dark' } }, bank).explicitPreferences, ['shuffle', 'theme']);
});

test('arranque: una cuenta dañada se repara o se aparta sin bloquear a las demás', () => {
  const admin = { ...emptyState(), bookmarks: [questions[0].id] };
  const joe = { ...emptyState(), stats: { 'of-no-existe': { seen: 1, answered: 1, correct: 1, wrong: 0 }, [questions[1].id]: { seen: 2, answered: 1, correct: 0, wrong: 1 } }, bookmarks: ['of-no-existe', questions[2].id], history: [{ ...session(), finishedAt: 1e20 }, { ...session({ id: 'ok' }), finishedAt: 1_700_000_100_000 }] };
  const r = initialProfiles({ meta: { version: 2, activeProfile: 'joe' }, profiles: { admin, joe, invitado: 'basura' } }, bank);
  assert.deepEqual(r.profiles.admin.bookmarks, admin.bookmarks);
  assert.deepEqual(Object.keys(r.profiles.joe.stats), [questions[1].id]);
  assert.deepEqual(r.profiles.joe.bookmarks, [questions[2].id]);
  assert.deepEqual(r.profiles.joe.history.map(s => s.id), ['ok']);
  assert.deepEqual(r.profiles.invitado, emptyState());
  assert.deepEqual(r.issues.map(i => [i.name, i.kind]), [['invitado', 'reset'], ['joe', 'repaired']]);
  assert.equal(r.issues.find(i => i.name === 'joe').raw, joe);
  assert.equal(r.meta.activeProfile, 'joe');
});

test('arranque: un progreso antiguo dañado se repara al migrar a admin', () => {
  const legacy = { ...emptyState(), stats: { 'of-no-existe': { seen: 1, answered: 0, correct: 0, wrong: 0 } }, bookmarks: [questions[0].id] };
  const r = initialProfiles({ profiles: {}, legacy }, bank);
  assert.equal(r.migrated, true);
  assert.deepEqual(r.profiles.admin.bookmarks, [questions[0].id]);
  assert.deepEqual(r.issues.map(i => [i.name, i.kind]), [['admin', 'repaired']]);
});

test('migración sin datos previos deja las tres cuentas exactamente vacías', () => {
  const r = initialProfiles({ profiles: {}, legacy: undefined }, bank);
  for (const name of PROFILES) assert.deepEqual(r.profiles[name], emptyState());
  assert.deepEqual(r.issues, []);
});

test('entregar en una cuenta no altera las otras cuentas cargadas', () => {
  const { profiles } = initialProfiles({ profiles: { admin: { ...emptyState(), bookmarks: [questions[0].id] }, joe: { ...emptyState(), bookmarks: [questions[3].id] } }, meta: { version: 2, activeProfile: 'joe' } }, bank);
  const before = structuredClone({ admin: profiles.admin, invitado: profiles.invitado });
  const q = questions[0];
  profiles.joe.active = session({ id: 'z', mode: 'study', questionIds: [q.id], answers: { [q.id]: q.correct }, firstAnswers: { [q.id]: q.correct }, order: { [q.id]: ['a', 'b', 'c', 'd'] } });
  finishSession(profiles.joe, bank);
  assert.equal(profiles.joe.history.length, 1);
  assert.equal(profiles.joe.stats[q.id].correct, 1);
  assert.deepEqual({ admin: profiles.admin, invitado: profiles.invitado }, before);
});

test('simulacro vencido se registra con la hora límite, no con la de regreso', () => {
  const st = withActive(session({ kind: 'strict', deadline: 1_700_003_600_000 }));
  const r = finishSession(st, bank, 1_700_003_600_000);
  assert.equal(r.finishedAt, 1_700_003_600_000);
  assert.equal(st.history[0].finishedAt, 1_700_003_600_000);
});

test('pista de nivel 2 sin sección relacionada no apunta a una sección al azar', () => {
  const q = questions[0];
  const sections = content.modules.find(m => m.id === q.module).sections;
  const unrelated = { ...q, text: 'zzzz qqqq', options: q.options.map(o => ({ ...o, text: 'xxxx' })) };
  assert.equal(sectionFor(unrelated, sections), null);
  const hint = nextHint(unrelated, 2, sections, ['a', 'b', 'c', 'd']);
  assert.equal(hint.section, undefined);
  assert.match(hint.text, /módulo/);
});

test('pista de nivel 1: solo sugiere la forma negativa si el enunciado la pide', () => {
  const base = { id: 'x', module: 1, correct: 'a', options: ['a', 'b', 'c', 'd'].map(id => ({ id, text: id })) };
  assert.match(nextHint({ ...base, text: '¿Cuál de estas opciones NO es correcta?' }, 1, [], []).text, /NO/);
  assert.match(nextHint({ ...base, text: 'Señala la respuesta incorrecta' }, 1, [], []).text, /NO/);
  assert.doesNotMatch(nextHint({ ...base, text: 'Un pasajero no habla español, ¿qué haces?' }, 1, [], []).text, /NO/);
  for (const text of ['¿Qué palabra no guarda relación con el resto?', '¿Qué pareja de palabras no significan lo mismo?', 'De las calles que se citan, indique cuál no confluye en la plaza de Castilla.', '¿Qué no se debe hacer en una epistaxis?', '¿Qué documento no sustituye el permiso de conductor VTC?', 'Todas son correctas excepto:']) {
    assert.match(nextHint({ ...base, text }, 1, [], []).text, /NO/, text);
  }
  assert.doesNotMatch(nextHint({ ...base, text: '¿Qué debes hacer si el GPS te lleva por una ruta incorrecta?' }, 1, [], []).text, /NO/);
});

test('EXTRA: la correcta no ocupa siempre la misma posición y conserva su ID y texto', () => {
  const positions = content.extras.map(q => q.options.findIndex(o => o.id === q.correct));
  assert.ok(new Set(positions).size >= 3, `posiciones: ${positions}`);
  for (const q of content.extras) {
    assert.equal(q.correct, 'a');
    assert.deepEqual(q.options.map(o => o.id).sort(), ['a', 'b', 'c', 'd']);
  }
});

test('rutas relativas: la web funciona tanto en la raíz local como en una subcarpeta de GitHub Pages', () => {
  for (const file of ['../index.html', '../src/app.js']) {
    const text = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /["'`(]\/(src|data|temas|assets|favicon)/, file);
  }
});

test('servidor: solo publica lo permitido, también con separadores codificados', async () => {
  // Puerto 0: el sistema asigna uno libre y el servidor lo indica al arrancar (sin colisiones entre ejecuciones).
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((resolve, reject) => { child.stdout.once('data', chunk => resolve(String(chunk).match(/:(\d+)/)[1])); child.stderr.once('data', chunk => reject(new Error(String(chunk)))); child.once('error', reject); setTimeout(() => reject(new Error('servidor sin arrancar')), 5000); });
    const status = async path => (await fetch(`http://127.0.0.1:${port}${path}`)).status;
    assert.equal(await status('/'), 200);
    assert.equal(await status('/assets/mascota/gallo-256.png'), 200);
    assert.equal(await status('/assets/mascota/gallo-referencia-v4.png'), 403);
    for (const path of ['/src/..%2Fassets%2Fmascota%2Fgallo-referencia-v4.png', '/src/..%2FHANDOFF.md', '/src/..%5Cserver.mjs', '/temas/..%2Fpackage.json', '/data/..%2F..%2Fx', '/src/%00app.js']) {
      assert.ok([403, 404].includes(await status(path)), path);
    }
  } finally { child.kill(); }
});
