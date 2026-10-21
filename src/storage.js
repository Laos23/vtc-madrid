const DB_NAME = 'vtc-madrid';
const PROFILE_KEYS = ['admin', 'invitado', 'joe'];
let database;
const get = (store, key) => new Promise((resolve, reject) => {
  const request = store.get(key);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

// Claves del almacén `app`: `state` = progreso único de la versión anterior (se conserva como respaldo),
// `meta` = cuenta activa, `profile:<nombre>` = progreso de cada cuenta, `rev:<nombre>` = número de revisión
// de esa cuenta (sube en cada escritura; permite detectar cambios hechos desde otra pestaña).
export async function openStorage() {
  database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('app');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const store = database.transaction('app').objectStore('app');
  const [meta, legacy, ...saved] = await Promise.all([get(store, 'meta'), get(store, 'state'), ...PROFILE_KEYS.flatMap(n => [get(store, `profile:${n}`), get(store, `rev:${n}`)])]);
  const profiles = {}, revs = {};
  PROFILE_KEYS.forEach((n, i) => { if (saved[2 * i] !== undefined) profiles[n] = saved[2 * i]; revs[n] = saved[2 * i + 1] || 0; });
  return { meta, legacy, profiles, revs };
}

// Una sola transacción: o se guarda todo (meta + los perfiles indicados + claves extra) o nada.
// Sobrescribe sin comprobar la revisión (migración, restauración de copias, reparación) y devuelve las revisiones nuevas.
// `extra` se usa para apartar, sin borrarlo, el contenido original de una cuenta que hubo que reparar.
export function saveAll(meta, profiles, extra = {}) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction('app', 'readwrite');
    const store = tx.objectStore('app');
    const revs = {};
    for (const [key, value] of Object.entries(extra)) store.put(structuredClone(value), key);
    if (meta) store.put(structuredClone(meta), 'meta');
    for (const [name, state] of Object.entries(profiles)) {
      store.put(structuredClone(state), `profile:${name}`);
      const request = store.get(`rev:${name}`);
      request.onsuccess = () => { revs[name] = (request.result || 0) + 1; store.put(revs[name], `rev:${name}`); };
    }
    tx.oncomplete = () => resolve(revs);
    tx.onabort = () => reject(tx.error || new Error('Guardado interrumpido.'));
  });
}

// Guarda una cuenta solo si nadie la ha cambiado desde la revisión `expectedRev` que conoce esta pestaña.
// Si otra pestaña escribió antes, no toca nada y rechaza con `conflict: true`.
export function saveProfile(name, state, expectedRev) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction('app', 'readwrite');
    const store = tx.objectStore('app');
    let next, conflict = false;
    const request = store.get(`rev:${name}`);
    request.onsuccess = () => {
      const current = request.result || 0;
      if (current !== expectedRev) { conflict = true; tx.abort(); return; }
      next = current + 1;
      store.put(structuredClone(state), `profile:${name}`);
      store.put(next, `rev:${name}`);
    };
    tx.oncomplete = () => resolve(next);
    tx.onabort = () => reject(conflict ? Object.assign(new Error('La cuenta ha cambiado en otra pestaña.'), { conflict: true, profile: name }) : tx.error || new Error('Guardado interrumpido.'));
  });
}
export const saveMeta = meta => new Promise((resolve, reject) => {
  const tx = database.transaction('app', 'readwrite');
  tx.objectStore('app').put(structuredClone(meta), 'meta');
  tx.oncomplete = resolve;
  tx.onabort = () => reject(tx.error || new Error('Guardado interrumpido.'));
});
// Lectura fresca de una cuenta y su revisión: otra pestaña puede haberla modificado desde que se cargó esta.
export async function loadProfileRaw(name) {
  const store = database.transaction('app').objectStore('app');
  const [raw, rev] = await Promise.all([get(store, `profile:${name}`), get(store, `rev:${name}`)]);
  return { raw, rev: rev || 0 };
}
