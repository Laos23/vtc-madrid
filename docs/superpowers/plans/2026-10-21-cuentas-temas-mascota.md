# Cuentas locales, tema claro/oscuro y mascota: plan de implementación

> **Para agentes:** plan ejecutado en la propia sesión (modo nativo) por petición expresa del usuario de no pedir confirmación por cada decisión rutinaria. Los pasos usan casillas (`- [ ]`). No hay repositorio Git: no hay pasos de commit.

**Objetivo:** añadir tres cuentas locales (`admin`, `invitado`, `joe`), selector manual de tema claro/oscuro y la mascota gallo con pistas, sin perder el progreso existente ni romper las reglas del examen.

**Arquitectura:** se mantiene el stack (módulos ES nativos, servidor Node estático, IndexedDB). La lógica pura nueva vive en `src/profiles.js` (cuentas, migración, copias) y `src/hints.js` (política y texto de pistas), probada con `node:test`. `src/app.js` solo la conecta a la interfaz. El tema se resuelve con variables CSS bajo `:root` y `:root[data-theme=dark]`.

**Tecnología:** JavaScript ES2022, IndexedDB, CSS con `color-mix`, `node:test`, Playwright MCP para recorridos reales.

**Especificación:** `HANDOFF.md`, sección «Actualización prioritaria del usuario: mascota, temas y cuentas locales», y `docs/mascota-gallo.md`. Referencia visual aprobada: `assets/mascota/gallo-referencia-v4.png`.

## Restricciones globales

- Exactamente tres cuentas: `admin`, `invitado`, `joe`. Sin contraseña, registro, correo ni autenticación remota. `admin` sin permisos especiales.
- Migración: el progreso único actual pasa a `admin`; `invitado` y `joe` empiezan vacíos. No se duplica ni se borra el original.
- Tema y mascota se guardan **por cuenta**. Valores iniciales (decisión de Claude): tema claro, mascota activada.
- Copias: indicar qué cuentas incluyen, validar antes de sustituir y seguir aceptando las copias antiguas de un perfil.
- Simulacro estricto: sin pistas sobre respuestas; reloj absoluto que no se reinicia al recargar ni al cambiar de cuenta.
- Se mantienen: separación oficiales/EXTRA, reparto 12/18/18/12, mínimos 6/9/9/6, entrega idempotente, primera respuesta en estudio.
- La mascota conserva la identidad de la v4 (gallo adulto cartoon 2D, contorno grueso). Sin redibujar: solo recorte y escalado.
- Las pruebas que sustituyen o borran datos se hacen en contextos de navegador desechables.

## Decisiones (de Claude, sin bloquear al usuario)

| Tema | Decisión |
|---|---|
| Almacenamiento | Misma base `vtc-madrid` v1 y almacén `app`. Claves nuevas `meta` y `profile:<cuenta>`; `state` (antiguo) se conserva intacto como respaldo y solo se lee si falta `meta`. No hace falta subir la versión de IndexedDB. |
| Escritura | `persist()` captura la cuenta activa en el momento de la llamada; la cola de guardado nunca escribe en otra cuenta tras un cambio. Migración y restauración usan una sola transacción (`saveAll`). |
| Cambio de cuenta | Pausa la práctica en curso de la saliente, espera la cola, guarda `meta`, carga la entrante y pausa cualquier práctica que hubiera quedado corriendo. El simulacro no se pausa. |
| Pistas | Estudio: 3 niveles (cómo leer, sección del temario, descartar una opción incorrecta). Examen: sin pistas; un aviso neutro tras 90 s. Estricto: nada. Aviso de atasco tras 45 s, una vez por pregunta, sin mostrar la pista por sí solo. |
| Ubicación de la mascota | Dentro del flujo, bajo las respuestas (nunca superpuesta). Inicio y resultados con un bocadillo breve. |
| Copias | v2 `{app, version:2, exportedAt, activeProfile, includedProfiles, profiles}`; exportar las tres o solo la activa. v1 se restaura en la cuenta activa. |
| Reinicio | Solo la cuenta activa; conserva su tema y mascota. |
| Destello de tema | `src/theme-boot.js` (script externo por la CSP) aplica el tema cacheado en `localStorage` antes de pintar; la preferencia real sigue en la cuenta. |

## Review Focus

1. Cambiar de cuenta con una práctica o simulacro en marcha: la sesión debe quedar en la cuenta de origen, con su reloj intacto.
2. Copia v2 manipulada (cuenta desconocida, `includedProfiles` incoherente, ID de pregunta inexistente, HTML en títulos): rechazo completo o texto escapado, sin tocar datos.
3. Opciones barajadas y recarga: la opción descartada por la pista nunca es la correcta y sigue siendo la misma.
4. Tema oscuro en superficies nativas (diálogo, selects, tablas, `details`) y estados de respuesta: contraste AA.
5. Móvil (390 px): barra superior con el desplegable de cuenta sin desbordar; la mascota no tapa controles.

---

### Task 1: Núcleo de cuentas y copias

**Archivos:** crear `src/profiles.js`; modificar `src/core.js` (`emptyState`, `validateBackup`); test `tests/profiles.test.mjs`.

**Interfaces producidas:** `PROFILES: string[]`; `initialProfiles({meta, profiles, legacy}, bank) -> {meta, profiles, migrated}`; `buildBackup(meta, profiles, only?) -> object`; `parseBackup(value, bank) -> {kind:'legacy', state} | {kind:'profiles', profiles, activeProfile}`.

- [x] Tests: tres nombres exactos; migración a `admin` sin tocar el original; meta existente ignora `state`; cuenta activa desconocida vuelve a `admin`; preferencias `theme`/`mascot` por defecto y validadas; ida y vuelta v2; copia de una sola cuenta; v1 aceptada; v2 inválidas rechazadas; reloj del simulacro conservado; entregas aisladas por cuenta.
- [x] Implementación y `npm.cmd test` en verde.

### Task 2: Pistas

**Archivos:** crear `src/hints.js`; tests en `tests/profiles.test.mjs`.

**Interfaces producidas:** `hintPolicy(session) -> {hints:boolean, nudge:'stuck'|'calm'|'none'}`; `nextHint(question, level, sections, order) -> {level, text, section?, discard?}`; `discardedOption(question, order) -> optionId`; `sectionFor(question, sections) -> index`.

- [x] Tests: estudio permite pistas; examen y estricto no; ninguna pista descarta ni cita la correcta; nivel 3 descarta una sola opción.

### Task 3: Persistencia por cuenta

**Archivos:** `src/storage.js`. **Produce:** `openStorage() -> {meta, legacy, profiles}`, `saveAll(meta, profiles)`, `saveProfile(name, state)`, `saveMeta(meta)`.

- [x] Reescrito; verificado en navegador desechable (migración y recarga).

### Task 4: Interfaz

**Archivos:** `src/app.js`, `src/styles.css`, `index.html`, `src/theme-boot.js`, `server.mjs`, `assets/mascota/gallo-96.png`, `assets/mascota/gallo-256.png`, `package.json` (`check`).

- [x] Desplegable «Cuenta» en la barra superior y cuenta activa en el menú lateral.
- [x] Configuración: tema (Claro/Oscuro), interruptor de mascota, explicación de cuentas, exportar todas/solo la activa, importar v1/v2, reinicio de la cuenta activa.
- [x] Variables de color para ambos temas en toda la hoja de estilos.
- [x] Mascota en inicio, tests (`coach()`), resultados; pistas, descarte, aviso de atasco, anuncio para lectores de pantalla, «×» para ocultarla.
- [x] Enlace profundo `#temario/<módulo>/<sección>` desde la pista de nivel 2.
- [x] El servidor publica solo `gallo-96.png` y `gallo-256.png`.

### Task 5: Revisión y verificación

- [x] Workflow: 5 revisores por dimensión (persistencia, pistas, tema, accesibilidad, seguridad/regresiones), 3 recorridos Playwright en contextos desechables y verificador adversarial.
- [x] Corregir los hallazgos confirmados y añadir pruebas de regresión donde aplique.
- [x] Verificación final: `npm.cmd run check`, recorridos de escritorio y móvil en ambos temas.
- [x] Documentación: `README.md`, `HANDOFF.md`, `docs/mascota-gallo.md`.

## Resultado

- Implementado todo lo anterior. 42 pruebas `node:test` en verde (`npm.cmd run check`).
- Tres rondas de revisión y verificación con agentes; los hallazgos confirmados se corrigieron. Los añadidos más relevantes no previstos al inicio: control optimista por revisión entre pestañas (`rev:<cuenta>` + `BroadcastChannel`), reparación sin bloqueo de cuentas dañadas (`respaldo:<cuenta>:<fecha>`), validación de los campos de pausa y reloj de las copias, servidor con la lista de rutas comprobada sobre la ruta resuelta, EXTRA con la correcta repartida 8/8/8/8 y foco conservado tras cada redibujado.
- Evidencia detallada: `HANDOFF.md`, sección «Verificación final».
