import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROFILES, initialProfiles, buildBackup, parseBackup } from '../src/profiles.js';
import { emptyState, validateBackup } from '../src/core.js';
import { hintPolicy, nextHint, discardedOption, sectionFor } from '../src/hints.js';

const bank = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url)));
const content = JSON.parse(readFileSync(new URL('../data/content.json', import.meta.url)));
const answered = () => {
  const q = bank[0];
  const s = emptyState();
  s.stats[q.id] = { seen: 2, answered: 2, correct: 1, wrong: 1, lastCorrect: false };
  s.bookmarks = [bank[1].id];
  s.readSections = ['1-0'];
  return s;
};

test('exactamente tres perfiles con los nombres pedidos', () => {
  assert.deepEqual(PROFILES, ['admin', 'invitado', 'joe']);
});

test('migración: el progreso único pasa a admin, sin duplicarse y sin tocar el original', () => {
  const legacy = answered();
  const before = structuredClone(legacy);
  const { meta, profiles, migrated } = initialProfiles({ meta: undefined, profiles: {}, legacy }, bank);
  assert.equal(migrated, true);
  assert.equal(meta.activeProfile, 'admin');
  assert.deepEqual(profiles.admin.stats, before.stats);
  assert.deepEqual(profiles.admin.bookmarks, before.bookmarks);
  assert.deepEqual(profiles.invitado, emptyState());
  assert.deepEqual(profiles.joe, emptyState());
  assert.deepEqual(legacy, before);
});

test('migración sin datos previos crea tres perfiles vacíos; con meta existente ignora el original', () => {
  const fresh = initialProfiles({ profiles: {}, legacy: undefined }, bank);
  assert.equal(fresh.migrated, true);
  for (const name of PROFILES) assert.deepEqual(fresh.profiles[name], emptyState());
  const stored = { meta: { version: 2, activeProfile: 'joe' }, profiles: { joe: answered() }, legacy: answered() };
  const r = initialProfiles(stored, bank);
  assert.equal(r.migrated, false);
  assert.equal(r.meta.activeProfile, 'joe');
  assert.deepEqual(r.profiles.admin, emptyState());
  assert.ok(r.profiles.joe.bookmarks.length);
});

test('perfil activo desconocido vuelve a admin', () => {
  const r = initialProfiles({ meta: { version: 2, activeProfile: 'root' }, profiles: {}, legacy: undefined }, bank);
  assert.equal(r.meta.activeProfile, 'admin');
});

test('preferencias por perfil: tema y mascota con valores iniciales y validados', () => {
  assert.equal(emptyState().preferences.theme, 'light');
  assert.equal(emptyState().preferences.mascot, true);
  const legacy = { ...emptyState(), preferences: { shuffle: false } };
  const { profiles } = initialProfiles({ profiles: {}, legacy }, bank);
  assert.equal(profiles.admin.preferences.shuffle, false);
  assert.equal(profiles.admin.preferences.theme, 'light');
  assert.equal(profiles.admin.preferences.mascot, true);
  for (const bad of [{ shuffle: true, theme: 'rojo' }, { shuffle: true, mascot: 'sí' }]) {
    assert.throws(() => validateBackup({ ...emptyState(), preferences: bad }, bank));
  }
  assert.equal(validateBackup({ ...emptyState(), preferences: { shuffle: true, theme: 'dark', mascot: false } }, bank).preferences.theme, 'dark');
});

test('copia nueva: lista perfiles, ida y vuelta sin pérdida ni mezcla', () => {
  const a = answered();
  const profiles = { admin: a, invitado: emptyState(), joe: emptyState() };
  profiles.joe.bookmarks = [bank[5].id];
  const backup = buildBackup({ version: 2, activeProfile: 'joe' }, profiles);
  assert.equal(backup.version, 2);
  assert.deepEqual(backup.includedProfiles, ['admin', 'invitado', 'joe']);
  const parsed = parseBackup(JSON.parse(JSON.stringify(backup)), bank);
  assert.equal(parsed.kind, 'profiles');
  assert.deepEqual(parsed.profiles.joe.bookmarks, [bank[5].id]);
  assert.deepEqual(parsed.profiles.admin.stats, a.stats);
  assert.deepEqual(parsed.profiles.invitado.bookmarks, []);
  assert.equal(parsed.activeProfile, 'joe');
});

test('copia de un solo perfil incluye solo ese perfil', () => {
  const backup = buildBackup({ version: 2, activeProfile: 'invitado' }, { invitado: emptyState() }, ['invitado']);
  assert.deepEqual(backup.includedProfiles, ['invitado']);
  assert.deepEqual(Object.keys(parseBackup(backup, bank).profiles), ['invitado']);
});

test('copia antigua de un perfil se sigue aceptando', () => {
  const parsed = parseBackup({ ...answered(), exportedAt: 1 }, bank);
  assert.equal(parsed.kind, 'legacy');
  assert.ok(parsed.state.bookmarks.length);
});

test('copias nuevas inválidas se rechazan completas', () => {
  const ok = buildBackup({ version: 2, activeProfile: 'admin' }, { admin: emptyState(), invitado: emptyState(), joe: emptyState() });
  assert.throws(() => parseBackup({ ...ok, profiles: { ...ok.profiles, hacker: emptyState() } }, bank));
  assert.throws(() => parseBackup({ ...ok, profiles: { ...ok.profiles, joe: { version: 1, stats: { nope: {} }, history: [] } } }, bank));
  assert.throws(() => parseBackup({ ...ok, includedProfiles: ['admin'] }, bank));
  assert.throws(() => parseBackup({ ...ok, profiles: {} , includedProfiles: [] }, bank));
  assert.throws(() => parseBackup({ ...ok, version: 3 }, bank));
  assert.throws(() => parseBackup(null, bank));
});

test('la sesión en curso de cada perfil se conserva con su reloj absoluto', () => {
  const s = emptyState();
  const q = bank.slice(0, 2).map(x => x.id);
  s.active = { id: 'x', title: 't', kind: 'strict', mode: 'exam', questionIds: q, answers: {}, firstAnswers: {}, order: Object.fromEntries(q.map(id => [id, ['a', 'b', 'c', 'd']])), index: 0, flagged: [], visited: [], startedAt: 1000, deadline: 1000 + 3600000 };
  const backup = buildBackup({ version: 2, activeProfile: 'joe' }, { admin: emptyState(), invitado: emptyState(), joe: s });
  const parsed = parseBackup(structuredClone(backup), bank);
  assert.equal(parsed.profiles.joe.active.deadline, 3601000);
  assert.equal(parsed.profiles.admin.active, null);
});

test('pistas: solo con corrección inmediata; examen y simulacro estricto no ayudan', () => {
  assert.deepEqual(hintPolicy({ mode: 'study', kind: 'module' }), { hints: true, nudge: 'stuck' });
  assert.equal(hintPolicy({ mode: 'exam', kind: 'module' }).hints, false);
  assert.equal(hintPolicy({ mode: 'exam', kind: 'strict' }).hints, false);
  assert.equal(hintPolicy({ mode: 'exam', kind: 'strict' }).nudge, 'none');
  assert.equal(hintPolicy({ mode: 'study', kind: 'strict' }).hints, false);
  assert.equal(hintPolicy(null).hints, false);
});

test('pistas nunca revelan la respuesta ni citan la opción correcta', () => {
  const sections = content.modules.find(m => m.id === bank[0].module).sections;
  for (const q of bank.slice(0, 120)) {
    const order = ['a', 'b', 'c', 'd'];
    const mod = content.modules.find(m => m.id === q.module).sections;
    for (let level = 1; level <= 3; level++) {
      const hint = nextHint(q, level, mod, order);
      assert.ok(hint.text.length > 5);
      assert.notEqual(hint.discard, q.correct);
      assert.ok(!hint.text.includes(q.options.find(o => o.id === q.correct).text) || q.options.find(o => o.id === q.correct).text.length < 4);
    }
    assert.notEqual(discardedOption(q, order), q.correct);
  }
  assert.ok(sections.length);
});

test('sectionFor devuelve una sección del módulo correcto', () => {
  const q = bank.find(x => x.module === 4);
  const mod = content.modules.find(m => m.id === 4).sections;
  const idx = sectionFor(q, mod);
  assert.ok(idx >= 0 && idx < mod.length);
});

test('el nivel de pista sube hasta 3 y descarta una sola opción incorrecta', () => {
  const q = bank[3];
  const mod = content.modules.find(m => m.id === q.module).sections;
  assert.equal(nextHint(q, 1, mod, ['a', 'b', 'c', 'd']).discard, undefined);
  assert.equal(nextHint(q, 2, mod, ['a', 'b', 'c', 'd']).discard, undefined);
  assert.ok(nextHint(q, 3, mod, ['a', 'b', 'c', 'd']).discard);
});
