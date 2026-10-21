import { emptyState, validateBackup } from './core.js';

export const PROFILES = ['admin', 'invitado', 'joe'];
export const META_VERSION = 2;
const invalid = () => { throw new Error('La copia no es válida o pertenece a otra versión. Tus datos actuales no se han cambiado.'); };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const valid = (value, bank) => { try { return validateBackup(value, bank); } catch { return null; } };

// Rescata lo que se pueda de un progreso guardado que ya no supera la validación
// (por ejemplo, tras regenerar el banco y cambiar algún ID). Cada parte se valida por separado.
function repairState(raw, bank) {
  if (!object(raw)) return null;
  const base = emptyState();
  const ids = new Set(bank.map(q => q.id));
  const stats = object(raw.stats) ? Object.fromEntries(Object.entries(raw.stats).filter(([id, s]) => valid({ ...base, stats: { [id]: s } }, bank))) : {};
  const history = Array.isArray(raw.history) ? raw.history.filter(s => valid({ ...base, history: [s] }, bank)).slice(0, 10000) : [];
  const preferences = { ...base.preferences };
  if (object(raw.preferences)) {
    if (typeof raw.preferences.shuffle === 'boolean') preferences.shuffle = raw.preferences.shuffle;
    if (['light', 'dark'].includes(raw.preferences.theme)) preferences.theme = raw.preferences.theme;
    if (typeof raw.preferences.mascot === 'boolean') preferences.mascot = raw.preferences.mascot;
  }
  return valid({
    ...base, stats, history, preferences,
    active: raw.active != null && valid({ ...base, active: raw.active }, bank) ? raw.active : null,
    bookmarks: Array.isArray(raw.bookmarks) ? [...new Set(raw.bookmarks.filter(id => ids.has(id)))] : [],
    readSections: Array.isArray(raw.readSections) ? raw.readSections.filter(id => typeof id === 'string') : []
  }, bank);
}

function loadProfile(name, raw, bank) {
  const state = valid(raw, bank);
  if (state) return { state };
  const repaired = repairState(raw, bank);
  return repaired ? { state: repaired, issue: { name, kind: 'repaired', raw } } : { state: emptyState(), issue: { name, kind: 'reset', raw } };
}

// Carga los perfiles guardados. Sin metadatos (primer arranque tras la actualización) el progreso
// único anterior (`legacy`) pasa íntegro a admin; invitado y joe empiezan vacíos. El original no se toca.
// Una cuenta dañada nunca bloquea a las demás: se repara o empieza vacía, y su contenido original
// se devuelve en `issues` para guardarlo aparte antes de sobrescribirla.
export function initialProfiles(stored, bank) {
  const hasMeta = stored.meta?.version === META_VERSION;
  const profiles = {};
  const issues = [];
  for (const name of PROFILES) {
    const raw = stored.profiles?.[name] ?? (!hasMeta && name === 'admin' ? stored.legacy : undefined);
    if (raw === undefined) { profiles[name] = emptyState(); continue; }
    const loaded = loadProfile(name, raw, bank);
    profiles[name] = loaded.state;
    if (loaded.issue) issues.push(loaded.issue);
  }
  const active = PROFILES.includes(stored.meta?.activeProfile) ? stored.meta.activeProfile : 'admin';
  return { meta: { version: META_VERSION, activeProfile: active }, profiles, migrated: !hasMeta, issues };
}

// Relee una cuenta guardada (por ejemplo, modificada desde otra pestaña) con la misma tolerancia que al arrancar.
export function reloadProfile(name, raw, bank) {
  return raw === undefined ? { state: emptyState() } : loadProfile(name, raw, bank);
}

export function buildBackup(meta, profiles, only = PROFILES) {
  const included = PROFILES.filter(name => only.includes(name) && profiles[name]);
  return { app: 'vtc-madrid', version: META_VERSION, exportedAt: Date.now(), activeProfile: meta.activeProfile, includedProfiles: included, profiles: Object.fromEntries(included.map(name => [name, profiles[name]])) };
}

// Valida una copia completa antes de tocar ningún dato. Acepta copias nuevas (v2, con perfiles)
// y las antiguas de un solo perfil (v1).
export function parseBackup(value, bank) {
  if (!object(value)) invalid();
  // Las copias antiguas no traen tema ni mascota: se indica qué preferencias trae para conservar las demás de la cuenta.
  if (value.version === 1) return { kind: 'legacy', state: validateBackup(value, bank), explicitPreferences: object(value.preferences) ? Object.keys(value.preferences).filter(k => ['shuffle', 'theme', 'mascot'].includes(k)) : [] };
  if (value.version !== META_VERSION || !object(value.profiles) || !Array.isArray(value.includedProfiles)) invalid();
  const names = Object.keys(value.profiles);
  const listed = value.includedProfiles;
  if (!names.length || !names.every(n => PROFILES.includes(n))) invalid();
  if (listed.length !== names.length || new Set(listed).size !== listed.length || !listed.every(n => typeof n === 'string' && names.includes(n))) invalid();
  const profiles = {};
  for (const name of PROFILES) if (name in value.profiles) profiles[name] = validateBackup(value.profiles[name], bank);
  const activeProfile = names.includes(value.activeProfile) ? value.activeProfile : PROFILES.find(n => n in profiles);
  return { kind: 'profiles', profiles, activeProfile };
}
