# Pistas por pregunta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la mascota dé, en los niveles 1 y 2, una pista escrita para cada pregunta concreta (437 oficiales + 32 EXTRA), con el enlace a la sección exacta del temario, sin revelar la respuesta.

**Architecture:** Un archivo de datos nuevo, `data/hints.json` (`{ "<id>": { concept, focus, section } }`), que `nextHint` usa cuando existe la entrada y que cae al comportamiento actual cuando no. Las pistas las escriben agentes por lotes de unas 30 preguntas. Otros dos agentes revisan cada lote con enfoques distintos (exactitud y asignación; filtración de la respuesta y redacción), y un agente final aplica las correcciones y pasa un comprobador determinista. Unos tests de datos garantizan la cobertura completa y que ninguna pista cite la respuesta.

**Tech Stack:** JavaScript vanilla (módulos ES), `node --test`, Workflow (agentes), Playwright.

**Spec:** conversación del 21-22/10/2026. El usuario aprobó la propuesta: pista 1 conceptual, que hace pensar sin señalar la correcta; pista 2 concreta, con enlace a la sección elegida a mano; pista 3 igual que ahora. Ejemplo aprobado, la pregunta de los distintivos VTC:
- Pista 1: «Los distintivos sirven para identificar el vehículo desde fuera. ¿Tiene sentido que vayan fuera de los cristales, o los dos detrás?»
- Pista 2: «Mira el esquema de la sección 4.5: fíjate en qué esquina de cada luna va cada distintivo.»

Pidió «que la pista sea concreta y no solo una predeterminada» y que haya agentes revisando las pistas «por si acaso está mal asignada o mal escrita».

## Global Constraints

- No revelar la respuesta: ninguna pista contiene el texto de la opción correcta, su letra, ni frases como «la correcta es».
- Si una pregunta pide la opción falsa o incorrecta (`NEGATIONS` de `hints.js`), la pista 1 debe avisar con «NO». El código lo antepone si falta.
- La clave es la del PDF. Donde `explanations[id].note` señala una discrepancia, la pista no afirma nada que contradiga la clave.
- `section` es el índice (base 0) dentro de `content.modules[q.module-1].sections`, o `null` si ninguna sección cubre el concepto. Con `null` se enlaza al temario del módulo.
- Español, tuteo y la voz del gallo: concreta, 1 o 2 frases y entre 25 y 260 caracteres por nivel.
- El simulacro estricto y el modo examen siguen sin pistas (`hintPolicy` no cambia).
- Sin commits ni push sin que el usuario lo pida al final. Se trabaja en la rama `pistas-por-pregunta`.

## Review Focus

- Si falla la carga de `data/hints.json` (archivo ausente o red caída), la app debe arrancar igual con las pistas genéricas (Tarea 1).
- Una entrada con `section` fuera de rango no debe generar un enlace roto (Tarea 1: se trata como `null`).
- Las respuestas cortas («Grave», «Abundante», «SO2») pueden filtrarse como palabra suelta; el comprobador lo detecta por palabra completa (Tarea 2).
- Preguntas casi iguales en lotes distintos pueden recibir pistas contradictorias; el revisor de exactitud compara con la explicación (Tarea 3), y un test limita los textos repetidos (Tarea 4).
- Una pista 2 que solo diga «repasa la sección X» vuelve a ser genérica; el comprobador exige que el texto no sea solo una remisión al temario (Tarea 2).

---

### Task 1: `nextHint` con pista propia y carga tolerante

**Files:**
- Modify: `src/hints.js` (`nextHint`)
- Modify: `src/app.js`, `init()` (carga de datos) y la llamada a `nextHint` (línea 343 aprox.)
- Test: `tests/pistas.test.mjs`

**Interfaces:**
- Produces: `nextHint(question, level, sections, order, custom?)`, donde `custom` es `{concept: string, focus: string, section: number|null}`.
  - Nivel 1 → `{level: 1, text}`: `custom.concept`, precedido de `'Ojo: busca la opción que NO encaja. '` si la pregunta es de negación y el concepto no contiene `/\bNO\b/`.
  - Nivel 2 → `{level: 2, text: custom.focus, section}`. Si `section` es un entero válido (`0 ≤ section < sections.length`) se incluye. Si no, la propiedad `section` se omite y el enlace va al módulo.
  - Nivel 3 y la ausencia de `custom`: igual que ahora.

- [ ] **Step 1: Tests que fallan**, en `tests/pistas.test.mjs`:
  - `nivel 1 usa la pista propia`: `nextHint(q,1,secs,order,{concept:'C propia',focus:'F',section:2}).text === 'C propia'`.
  - `nivel 1 avisa del NO si falta`: con `q.text='¿Cuál NO es correcta?'` el texto empieza por `'Ojo: busca la opción que NO encaja. '`. Con un `concept` que ya contiene `NO`, no se duplica.
  - `nivel 2 usa el foco y la sección propios`: `deepEqual(nextHint(q,2,secs,order,c), {level:2,text:'F',section:2})`.
  - `nivel 2 descarta una sección fuera de rango`: `section:99` → resultado sin la propiedad `section`.
  - `sin pista propia se mantiene el comportamiento actual`: `nextHint(q,1,secs,order)` es igual a `nextHint(q,1,secs,order,undefined)` y su texto coincide con el genérico actual.
  - `nivel 3 ignora la pista propia`: `.discard` distinto de `q.correct`.
- [ ] **Step 2:** `node --test tests/pistas.test.mjs`. Esperado: FAIL.
- [ ] **Step 3:** Implementar en `src/hints.js`. En `app.js`: `hints` se carga en `init()` con `load('hints').catch(() => ({}))` y se pasa `hints[q.id]` como quinto argumento.
- [ ] **Step 4:** `npm run check`. Esperado: PASS.

### Task 2: Reglas comprobables de una pista

**Files:**
- Create: `tests/hint-rules.mjs`, módulo de test y CLI

**Interfaces:**
- Produces:
  - `export function hintProblems(question, entry, sectionCount): string[]`. Devuelve la lista vacía si la pista es válida.
  - CLI: `node tests/hint-rules.mjs <archivo.json>`, que imprime `id: problema` por línea y sale con código 1 si hay problemas.
- Reglas:
  - Hay entrada.
  - `concept` y `focus` son strings de 25 a 260 caracteres y distintos entre sí.
  - `section` es `null` o un entero en `[0, sectionCount)`.
  - El texto no menciona letras de opción: `/\b(opci[oó]n|respuesta|letra)\s+[A-D]\b/i` y `/(^|\s)[A-D]\)/`.
  - Sin `/la (respuesta|opci[oó]n) (correcta|buena) es/i`.
  - Sin filtración de la respuesta. Se normaliza: minúsculas, sin tildes ni puntuación, espacios simples. Si la opción correcta normalizada tiene ≥12 caracteres, no puede ser subcadena de la pista. Si es más corta y no está en `{no, si, verdadero, falso, a, b, c, d}`, no puede aparecer como palabra completa.
  - `focus` no es una mera remisión: no puede ajustarse a `/^(repasa|revisa|mira|consulta)\b[^.]{0,60}\.?$/i` sin más contenido.

- [ ] **Step 1:** Escribir en `tests/pistas.test.mjs` el test `hintProblems detecta filtraciones y letras` con casos fijos: correcta «Muy grave» y pista «…es muy grave…» → problema; correcta larga citada → problema; «la opción B» → problema; pista limpia → `[]`.
- [ ] **Step 2:** Ejecutar. Esperado: FAIL, porque el módulo no existe.
- [ ] **Step 3:** Implementar `tests/hint-rules.mjs`.
- [ ] **Step 4:** Ejecutar. Esperado: PASS.

### Task 3: Escritura y revisión de las 469 pistas (Workflow)

**Files:**
- Create (scratchpad, fuera del repo): `hints-in/chunk-XX.json` (entrada de cada lote) y `hints-out/chunk-XX.json` (salida, `{id: {concept, focus, section}}`).

- [ ] **Step 1:** Preparar 16 lotes con un script de Node. Cada lote es de un solo módulo y lleva unas 30 preguntas, con `{id, module, text, options, correct, explanation, note}` y las secciones del módulo (`index, title, goal, body, bullets`). Las EXTRA van en los lotes de su módulo.
- [ ] **Step 2:** Workflow `pipeline` por lote:
  1. Escritor: escribe `hints-out/chunk-XX.json`.
  2. Dos revisores en paralelo. El de exactitud y asignación comprueba la coherencia con la clave y la explicación y que la sección sea la correcta. El de filtración y redacción comprueba que no revele la respuesta, que el español sea natural, que siga el ejemplo y que sea concreta. Devuelven `{issues:[{id, field, problem, fix}]}`.
  3. Corrector: aplica las correcciones al archivo y ejecuta `node tests/hint-rules.mjs <archivo>` hasta que salga con código 0. Devuelve `{fixed, remaining}`.
- [ ] **Step 3:** Esperado: 16 lotes con `remaining: 0` y 469 ids en total.

### Task 4: Datos fusionados y tests de cobertura

**Files:**
- Create: `data/hints.json`
- Test: `tests/pistas.test.mjs`

- [ ] **Step 1:** Test `todas las preguntas tienen una pista propia válida`: para cada `q` del banco (469), `hintProblems(q, hints[q.id], secciones del módulo)` devuelve `[]`. Test `las pistas no se repiten como plantilla`: ningún `concept` ni `focus` aparece más de 2 veces.
- [ ] **Step 2:** Ejecutar. Esperado: FAIL, porque `data/hints.json` no existe.
- [ ] **Step 3:** Fusionar `hints-out/*.json` en `data/hints.json` (formato `JSON.stringify(x,null,2)`, ids en el orden del banco).
- [ ] **Step 4:** `npm run check`. Esperado: PASS.

### Task 5: Verificación en el navegador

- [ ] **Step 1:** Con Playwright en un contexto desechable, hacer un test de estudio del módulo 4. La pista 1 y la 2 deben mostrar el texto de `hints.json` para esa pregunta, y «Abrir esa sección» debe llevar a la sección de `section`.
- [ ] **Step 2:** En modo examen no se ofrecen pistas. Bloqueando `data/hints.json` (route abort), la app arranca y da la pista genérica.
