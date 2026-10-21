# Temario gráfico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada sección del temario muestre para qué sirve, qué tipo de idea es cada punto y un esquema visual cuando el contenido lo permita, sin quitar ni alterar una sola palabra del texto actual.

**Architecture:** Los textos actuales de `data/content.json` (`title`, `body`, `bullets`) se congelan y no se tocan. Cada sección recibe campos editoriales nuevos y opcionales (`goal`, `kinds`, `highlight`, `visual`). Un módulo puro nuevo, `src/study.js`, convierte una sección en HTML; `study()` de `src/app.js` lo usa. Así `hints.js` sigue enlazando por índice y por las mismas palabras.

**Tech Stack:** JavaScript vanilla (módulos ES), CSS con los tokens de `:root` y `:root[data-theme=dark]`, `node --test`, Playwright para la verificación visual.

**Spec:** sin documento aparte. Decisiones tomadas en la conversación del 21/10/2026: el usuario ve el temario «muy junto, sin indicar para qué es cada cosa, como un libro», pide «algo más gráfico» sin quitar ni omitir temario, y ante las maquetas A/B/C dijo «haz el cambio» sin elegir. Decisión de Claude: híbrido. Las etiquetas por idea vienen de A, los esquemas según el contenido de B y el resaltado de palabras clave de C. El recuadro «En 10 segundos» de C queda fuera: duplicaría el texto.

## Global Constraints

- No cambiar el orden, los títulos, `body` ni `bullets` de ninguna sección. `hints.js` (`sectionFor`) y los enlaces `#temario/<módulo>/<sección>` dependen de ellos.
- Los campos nuevos solo pueden reformular datos que ya estén en la propia sección. No se añaden cifras, normas, fechas ni direcciones nuevas.
- Sin dependencias ni scripts externos. La CSP de `index.html` solo permite `'self'`. Los esquemas se hacen con HTML y CSS, y SVG en línea si hace falta.
- Colores solo mediante tokens del tema (`--surface`, `--line`, `--amber-soft`, etc.). Las insignias de etiqueta ambiental son la única excepción, con colores fijos de distintivo: CERO azul, ECO azul y verde, C verde, B amarilla. Contraste AA en claro y en oscuro.
- El texto funcional nunca baja de 12 px. Sin bordes laterales gruesos de acento.
- Sin commits ni push durante la ejecución: el usuario los pedirá.

## Review Focus

- Un texto del temario editado o borrado por accidente al añadir campos: el test de línea base (Tarea 1) falla.
- Un término de `highlight` contenido en otro, como `40 km` dentro de `menos de 40 km`, o que coincide dentro de otra palabra: produce `<mark>` anidados o HTML roto. Test en la Tarea 2.
- La pista de nivel 2 de la mascota («Abrir esa sección») debe seguir haciendo scroll a la sección correcta. Los `id="section-<i>"` no cambian (Tarea 3).
- Tablas y esquemas a 390 px de ancho: sin scroll horizontal de la página. Las tablas pasan a filas apiladas (Tarea 3).
- Tema oscuro: fichas de «Cuidado en el examen», `<mark>` e insignias legibles (Tarea 5).

---

### Task 1: Línea base que impide perder temario

**Files:**
- Create: `tests/fixtures/temario-base.json`, generado una sola vez desde el `data/content.json` actual: `[{module, sections:[{title, body, bullets}]}]`
- Create: `tests/temario.test.mjs`

**Interfaces:**
- Produces: `tests/fixtures/temario-base.json`, usado como fuente de verdad del texto en las tareas 2 y 4.

- [ ] **Step 1:** Generar la fixture con un `node -e` que lea `data/content.json` y escriba solo `id`, `title`, `body` y `bullets`, en el mismo orden.
- [ ] **Step 2:** Escribir el test `el temario conserva cada título, párrafo y punto de la línea base`. Para cada módulo y sección de la fixture: `assert.equal(section.title, base.title)`, `assert.deepEqual(section.body, base.body)` y `assert.deepEqual(section.bullets, base.bullets)`, además de igualdad en el número de secciones.
- [ ] **Step 3:** `node --test tests/temario.test.mjs`. Resultado esperado: PASS (es una guarda de regresión).

### Task 2: Renderizador puro `src/study.js`

**Files:**
- Create: `src/study.js`
- Test: `tests/temario.test.mjs`

**Interfaces:**
- Produces:
  - `export const KINDS = { clave: 'Dato clave', regla: 'Regla', ejemplo: 'Ejemplo', consejo: 'Consejo práctico', trampa: 'Cuidado en el examen' }`
  - `export const VISUALS = ['steps', 'badges', 'table', 'scale', 'timeline', 'compass', 'placement']`
  - `export function highlight(text: string, terms?: string[]): string`. Escapa el HTML y envuelve en `<mark>` cada aparición literal de cada término (distingue mayúsculas, gana el más largo, una sola pasada con alternancia de regex escapada, sin coincidir dentro de una palabra alfanumérica).
  - `export function renderVisual(visual?: object): string`. Devuelve `''` si no hay visual o el tipo es desconocido. Formas:
    - `steps {items:[{label,text}]}`, una lista ordenada con números.
    - `badges {items:[{label,tone:'cero'|'eco'|'c'|'b'|'neutral',text}]}`
    - `table {head:[...], rows:[[...]]}`, cuyas celdas llevan `data-label` con la cabecera para apilarse en móvil.
    - `scale {items:[{level:'leve'|'grave'|'muy-grave',text}]}`
    - `timeline {items:[{date,text}]}`
    - `compass {items:[{dir:'N'|'S'|'E'|'O',text}], center}`
    - `placement {items:[{glass:'delantera'|'trasera',corner:'arriba-derecha'|'abajo-izquierda',text}]}`
    - Todos aceptan `caption` opcional, que se muestra como título del esquema.
  - `export function renderSection(section, { anchor: string, number: string, actions?: string }): string`. Genera `<section id="${anchor}" class="topic">`: número y título, `actions` (HTML ya generado del botón «Marcar leída»), «Para qué te sirve» con `goal`, `body` como entradilla con `highlight`, `renderVisual(visual)` y las fichas, una por bullet, con la etiqueta `KINDS[kinds[i]]` (o sin etiqueta si falta) y el texto con `highlight`.
  - `study.js` define su propio `escape`, idéntico al de `app.js`, para seguir siendo importable desde Node sin el DOM.

- [ ] **Step 1: Tests que fallan**, en `tests/temario.test.mjs`:
  - `highlight escapa HTML y marca términos`: `highlight('a <b> ECO', ['ECO']) === 'a &lt;b&gt; <mark>ECO</mark>'`.
  - `highlight prefiere el término más largo y no anida`: `highlight('de menos de 40 km', ['40 km','menos de 40 km']) === 'de <mark>menos de 40 km</mark>'`.
  - `highlight no marca dentro de otra palabra`: `highlight('ECOlógico ECO', ['ECO']) === 'ECOlógico <mark>ECO</mark>'`.
  - `renderSection muestra todo el texto de la línea base`: para cada sección real, el texto plano de `renderSection(s,{anchor:'x',number:'1.1'})` (sin etiquetas, con entidades decodificadas y espacios normalizados) contiene cada `title`, `body[i]` y `bullets[i]` de la fixture.
  - `renderVisual ignora tipos desconocidos`: `renderVisual({type:'nope'}) === ''`.
- [ ] **Step 2:** `node --test tests/temario.test.mjs`. Esperado: FAIL, porque `src/study.js` no existe.
- [ ] **Step 3:** Implementar `src/study.js` con las firmas anteriores.
- [ ] **Step 4:** `node --test tests/temario.test.mjs`. Esperado: PASS.

### Task 3: Integración en la app y estilos

**Files:**
- Modify: `src/app.js`, `study()` (línea 231 aprox.) e import inicial
- Modify: `src/styles.css`, reglas `.study-*` y nuevas `.topic`, `.topic-goal`, `.topic-lead`, `.facts`, `.fact`, `.fact-tag`, `.visual` y sus variantes
- Modify: `package.json`, añadir `node --check src/study.js` al script `check`

**Interfaces:**
- Consumes: `renderSection` de la Tarea 2.

- [ ] **Step 1:** `study(moduleId)` llama a `renderSection(s, { anchor: \`section-${i}\`, number: \`${m.id}.${i+1}\`, actions: <botón Marcar leída actual> })`. El índice lateral muestra el número `m.id.i+1` y una marca si la sección está leída. El resto de la página (cabecera, «Practica lo aprendido», fuentes) queda igual.
- [ ] **Step 2:** CSS. Cada sección es una tarjeta con aire entre secciones. La entradilla va a 1rem. Las fichas en rejilla `repeat(auto-fit,minmax(260px,1fr))`, con la etiqueta en una pastilla tintada por tipo: `trampa` en tonos ámbar o rojo, `clave` en verde, `regla` en azul, `ejemplo` en morado y `consejo` neutro. `mark` usa los tokens ámbar. A ≤640 px las tablas se apilan con `td::before{content:attr(data-label)}`. Las reglas `@media print` muestran las fichas y los esquemas.
- [ ] **Step 3:** `npm run check`. Esperado: todos los tests en PASS.
- [ ] **Step 4:** Con `npm start` y Playwright en un contexto desechable, abrir `#temario/2` y comprobar que hay una sección `.topic` por sección y que no hay errores en consola. Abrir `#temario/3/3`, que debe hacer scroll a «La conducta PAS».

### Task 4: Contenido editorial de las 29 secciones

**Files:**
- Modify: `data/content.json`, añadiendo solo `goal`, `kinds`, `highlight` y `visual` a cada sección
- Test: `tests/temario.test.mjs`

- [ ] **Step 1: Test que falla**, `cada sección tiene metadatos editoriales válidos`:
  - `goal` es un string de 20 a 140 caracteres.
  - `kinds.length === bullets.length` y cada valor está en `KINDS`.
  - Cada término de `highlight` aparece literalmente en `title`, `body` o `bullets` de su sección.
  - `visual`, si existe, tiene `type` en `VISUALS` y `items` o `rows` no vacíos.
- [ ] **Step 2:** `node --test tests/temario.test.mjs`. Esperado: FAIL por falta de `goal`.
- [ ] **Step 3:** Rellenar los cuatro módulos. Esquema asignado (los datos salen solo de la sección):
  - M1: [0] steps de lectura; [1] table tiempo/ejemplo; [2] table estructura/ejemplo; [3] table preposición/relación; [4] table sinónimos/antónimos; [5] table expresión/significado.
  - M2: [0] steps antes/durante/si hay duda; [1] table quiero/menú; [2] compass (N Castellana y Plaza de Castilla, O Boadilla, S Aranjuez y A-4; El Escorial y Chamartín como notas, porque la sección no da su dirección); [3] y [4] table lugar/dato; [5] badges CERO/ECO/C/B; [6] badges neutros de los contaminantes.
  - M3: [0] sin esquema; [1] table discapacidad/cómo ayudar; [2] sin esquema; [3] steps PAS; [4] steps consciencia/respiración/112 y DEA/RCP o PLS; [5] y [6] table situación/qué hacer.
  - M4: [0] table norma/qué regula; [1] table autorización frente a permiso del conductor; [2] steps requisitos/examen/expedición y tasa/vigencia 5 años/renovación; [3] steps contratar/comunicar/hoja de ruta; [4] placement de distintivos; [5] sin esquema; [6] scale grave/muy grave; [7] timeline Decreto 5/2024, Decreto 59/2026 y 3 de noviembre de 2026.
- [ ] **Step 4:** `npm run check`. Esperado: todo en PASS, incluida la línea base de la Tarea 1.

### Task 5: Verificación visual y accesibilidad

- [ ] **Step 1:** Capturas con Playwright de `#temario/1` a `#temario/4` en tema claro y oscuro, a 1280 y 390 px de ancho. Esperado: sin scroll horizontal (`document.documentElement.scrollWidth <= innerWidth`), sin texto cortado y esquemas legibles.
- [ ] **Step 2:** Medir el contraste de `.fact-tag`, `mark` e insignias en ambos temas (≥4.5:1).
- [ ] **Step 3:** En un test de estudio, pedir pista de nivel 2 y pulsar «Abrir esa sección». Esperado: llega a la sección correcta.
