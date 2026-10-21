# Traspaso completo a Claude — VTC Madrid

> Fecha: 21 de octubre de 2026 (Europe/Madrid).
> Carpeta: `C:\WEBS\VTC_web`.
> Destinatario: Claude Code o el agente que continúe el proyecto.
> Resumen: se ha construido una primera versión local funcional de la plataforma de estudio VTC. El usuario quiere que Claude asuma la continuidad utilizando este contexto, sin empezar de cero.
> **Publicación 21/10/2026:** a petición del usuario, repositorio público `Laos23/vtc-madrid` servido con GitHub Pages en https://laos23.github.io/vtc-madrid/ (rutas relativas, CSP en `<meta>`, `.nojekyll`). Sustituye la restricción anterior de «solo local»: el progreso sigue guardándose únicamente en el navegador de cada dispositivo. Ver `README.md`, «Desde cualquier sitio».
> **Actualización 21/10/2026 (Claude):** implementadas las tres cuentas locales, el tema claro/oscuro y la mascota gallo con pistas. Ver «Implementación de cuentas, temas y mascota» justo después de la sección de requisitos.

## Actualización prioritaria del usuario: mascota, temas y cuentas locales

**Petición más reciente, 21/10/2026. Esta sección prevalece sobre propuestas anteriores incompatibles.** Se conservan los requisitos tal como se documentaron; **ya están implementados** (ver la sección siguiente, «Implementación de cuentas, temas y mascota»).

### Mascota de apoyo en la página y durante los tests

- El usuario ha aprobado la imagen **`assets/mascota/gallo-referencia-v4.png`** con «perfecto». Esta es la referencia elegida: gallo adulto cartoon 2D simplificado, contorno grueso y expresión con carácter. Las v1–v3 son únicamente historial.
- Integrar la mascota en la propia página como acompañante y apoyo al hacer tests; no dejarla solo como imagen de referencia o ilustración del temario.
- Añadir en **Configuración** una opción clara para **activar o desactivar la mascota**. Respetar la elección del usuario y conservarla al volver a abrir la web.
- La idea previamente solicitada sigue vigente: un bocadillo con una pista cuando el usuario se atasque. No mostrar la solución de forma involuntaria ni interrumpir la lectura o tapar opciones y controles.
- Mantener el simulacro estricto sin ayuda que desvirtúe el examen: puede mostrarse el acompañante si está activado, pero las pistas sobre respuestas deben quedar deshabilitadas durante ese modo.
- No hace falta crear otra mascota: utilizar la v4 aprobada como base y conservar su identidad al crear poses o animaciones.

### Tema claro y oscuro

- Añadir en **Configuración** un selector explícito entre **tema claro** y **tema oscuro**.
- La elección es del usuario y debe guardarse para futuras visitas. Detectar el tema del sistema no sustituye al selector manual solicitado.
- Aplicar el tema a toda la interfaz, incluidos tests, temario, navegación, modales, respuestas, explicaciones y resultados. Mantener contraste y estados legibles en ambos temas.

### Tres cuentas locales sin contraseña

- Deben existir exactamente estas tres cuentas, con sus nombres escritos así: **`admin`**, **`invitado`**, **`joe`**.
- No necesitan contraseña, registro, correo, autenticación remota ni pantalla de inicio de sesión.
- Permitir cambiar entre ellas con un **desplegable visible en la página**, indicando siempre cuál está activa.
- Tratar las cuentas como perfiles locales para que cada una conserve su progreso, estadísticas, historial, errores, preguntas guardadas, secciones leídas y sesión en curso sin mezclarlos con los de las otras.
- Al cambiar de cuenta, guardar el estado de la saliente antes de mostrar la entrante. Conservar el funcionamiento del reloj absoluto de un simulacro que haya quedado iniciado.
- Recordar la cuenta seleccionada al recargar o volver a abrir la aplicación.
- El nombre `admin` no implica por sí solo permisos especiales: el usuario no ha solicitado un panel de administración ni una jerarquía de roles.

### Notas técnicas y criterios de aceptación para Claude

- Estos perfiles siguen siendo locales. La restricción anterior de no introducir cuentas por iniciativa propia no bloquea estas tres cuentas, que el usuario ahora ha pedido expresamente.
- Antes de cambiar el esquema de IndexedDB o de las copias, prever la migración del progreso único existente **sin borrarlo ni duplicarlo en los tres perfiles**. Como decisión técnica propuesta, asignarlo al perfil `admin` y dejar los otros dos vacíos, documentando esa migración.
- Como decisión técnica propuesta, conservar tema y activación de mascota por perfil. El usuario ha solicitado los controles; no ha fijado todavía su alcance por perfil ni valores iniciales.
- Las copias de seguridad deben indicar qué perfiles incluyen y restaurarse con validación. Mantener una vía de importación de las copias antiguas de un solo perfil.
- Verificar: cambio de cuentas y recarga sin pérdida ni mezcla de datos; persistencia de tema y mascota; funcionamiento de todos los modos de test en ambos temas; mascota oculta al desactivarla; ausencia de pistas en simulacro estricto.
- El encargo actual a Codex es **añadir estas instrucciones al `.md`**. No se debe presentar esta actualización documental como una implementación ya terminada.

## Implementación de cuentas, temas y mascota (Claude, 21/10/2026)

Plan y decisiones: `docs/superpowers/plans/2026-10-21-cuentas-temas-mascota.md`. Detalle de la mascota: `docs/mascota-gallo.md`. Uso: `README.md`.

### Qué se ha implementado

- **Cuentas `admin`, `invitado`, `joe`** (`src/profiles.js`, `src/storage.js`). Desplegable «Cuenta» en la barra superior; la activa se ve también en el pie del menú lateral. Sin contraseña ni permisos especiales. Cada cuenta guarda por separado progreso, estadísticas, historial, fallos, guardadas, secciones leídas, test en curso y preferencias (`shuffle`, `theme`, `mascot`). Al cambiar: se pausa la práctica en curso de la saliente, se vacía la cola de guardado, se relee la entrante de IndexedDB, todo se guarda antes de aplicar el cambio en pantalla (si falla, se queda en la cuenta anterior), se cierra un simulacro vencido con su hora límite y se recuerda la cuenta en `meta`. Con teclado, las flechas del desplegable solo previsualizan; cambia con Intro, al salir del control o con el ratón.
- **Migración:** si falta `meta`, el progreso de la clave `state` pasa a `admin` en una sola transacción; `invitado` y `joe` empiezan vacíos; `state` se deja intacto como respaldo y no se vuelve a leer.
- **Datos dañados:** una cuenta que no supera la validación ya no bloquea el arranque. Se conserva lo válido (o empieza vacía), el original se guarda en `respaldo:<cuenta>:<fecha ISO>` y se avisa.
- **Copias v2** `{app:'vtc-madrid', version:2, exportedAt, activeProfile, includedProfiles, profiles}`: exportar las tres o solo la activa; importar valida todo antes de tocar nada y reemplaza solo las cuentas incluidas. Las copias v1 se restauran en la cuenta activa. La validación cubre ahora pausa y reloj (`paused`, `remainingMs`, `elapsedMs`, `resumedAt`; un simulacro nunca puede venir en pausa) y fechas dentro del rango de `Date`. «Reiniciar progreso» afecta solo a la cuenta activa y conserva tema y mascota.
- **Tema claro/oscuro:** selector en Configuración, guardado por cuenta (inicial: claro). Todos los colores son variables en `:root` y `:root[data-theme=dark]` (`src/styles.css`), incluidos diálogo, campos, tablas, explicaciones, estados de respuesta, badges, aviso y avisos emergentes. `src/theme-boot.js` (externo por la CSP) aplica el tema cacheado antes de pintar. Hay reglas para el modo de alto contraste de Windows.
- **Mascota y pistas:** ver `docs/mascota-gallo.md`. Estudio: hasta 3 pistas a petición, nunca la respuesta; examen: sin pistas; simulacro estricto: sin pistas ni avisos. Con un simulacro en curso, el banco muestra un aviso (sin bloquear).
- **Otras correcciones de la revisión:** el servidor comprueba la lista de rutas permitidas sobre la ruta resuelta (antes `/src/..%2FHANDOFF.md` devolvía el archivo); las EXTRA tenían siempre la correcta en primera posición (ahora repartida 8/8/8/8, mismo ID `a` para no alterar historiales); el desplegable de preguntas tiene marcador y foco visibles; contraste AA en hover oscuro, opción descartada e interruptor apagado.

- **Varias pestañas con la misma cuenta:** cada cuenta tiene revisión (`rev:<cuenta>`); una escritura desfasada no se aplica, se recarga la versión guardada, se vuelve a aplicar la pausa de una práctica que esta pestaña ya no tiene delante y se conservan las respuestas ya dadas en la sesión (solo se añaden). `BroadcastChannel` mantiene las pestañas al día.
- **Teclado:** tras redibujar, el foco vuelve al control equivalente (opción, marcar, guardar, filtros, desplegables del banco abiertos); al cambiar de página pasa al contenido o a la pregunta.
- **Copias v1:** conservan el tema y la mascota de la cuenta si la copia no los trae.

### Verificación final (21/10/2026)

- `npm.cmd run check`: sintaxis de todos los módulos y **42 pruebas aprobadas** (`tests/core`, `data`, `profiles`, `hardening`). Estable en 10 ejecuciones seguidas tras corregir un fallo intermitente del test de servidor (colisión de puerto aleatorio; ahora usa el puerto 0 y el servidor informa del puerto real).
- **Tres rondas de revisión con agentes** (workflows: revisores por dimensión, recorridos Playwright en contextos desechables y verificador adversarial). Ronda 1: 36 hallazgos, 15 confirmados (ninguno alto), todos corregidos. Ronda 2: 15 confirmados (bajos/medios: pestañas, selector con teclado, foco, contraste), corregidos. Ronda 3: la regresión completa pasó en todo lo esencial; 8 casos límite (misma cuenta en dos pestañas, foco) corregidos y comprobados de nuevo en navegador.
- **Comprobado en navegador** (Chromium vía Playwright, siempre en contextos desechables): migración del progreso antiguo solo a `admin` con `state` intacto y sin repetirse al recargar; aislamiento de las tres cuentas y recuerdo de la activa; reloj absoluto del simulacro al cambiar de cuenta y recargar, entrega automática única con la hora límite; 60 preguntas 12/18/18/12 oficiales; pistas en estudio (3 niveles, la descartada nunca es la correcta, comprobado para todo el banco y órdenes barajados) y ninguna en examen ni simulacro (tampoco forzando la acción); avisos de atasco a 45 s / 90 s / ninguno con reloj simulado; copias v2/v1 y rechazo de copias inválidas sin tocar datos; HTML en copias mostrado como texto; cuentas dañadas reparadas y apartadas; tema claro y oscuro en todas las rutas a 1440 y 390 px sin desbordamiento; la mascota nunca se solapa con preguntas ni controles (320–1440 px); contraste AA calculado en ambos temas; modo de alto contraste; servidor (`/src/..%2FHANDOFF.md` → 403).
- **Impeccable** (`detect`): un único aviso `side-tab` en `styles.css:5`, falso positivo (el chevrón de 7 px del desplegable del banco).
- **No verificado:** el progreso real del navegador del usuario (nunca se tocó en las pruebas; la migración ocurrirá la primera vez que abra esta versión), lectores de pantalla reales, Firefox y Safari.

## 1. Encargo del usuario y orden de prioridades

El objetivo es una aplicación web **privada, local y personal** para preparar el permiso de conductor VTC de la Comunidad de Madrid, estudiar los cuatro módulos, practicar preguntas, simular el examen y conservar el progreso.

La conversación evolucionó así:

1. El usuario indicó que trabajaríamos en esta carpeta y que el contexto estaba en el `.md` de `temas`. Pidió analizar las skills, plugins y MCP de Codex y de Claude Code, y recomendar los necesarios. También pidió una web agradable y divertida, evitando una experiencia aburrida o monótona.
2. Se propuso una ruta de aprendizaje inspirada en Madrid, cuatro módulos con identidad visual, progreso visible, retos breves y pequeños hitos. Se sugirieron Impeccable, PDF, Superpowers, Playwright y accesibilidad como herramientas principales; ImageGen y Claude Mem como complementos.
3. El usuario aceptó la propuesta, pero precisó lo siguiente, que tiene prioridad sobre la propuesta inicial:

   > «quiero que tenga control total el usuario para usar la web»
   >
   > «este proyecto tiene que ser rapido, tenemos que crear la web y dejarla funcional YA»
   >
   > «luego ya le podremos añadir animaciones o una mascota asi como tiene codex, que si a lo mejor te quedas atascado en una pregunta te suelta un bocadillo de texto diciendote una pista, pero eso para más adelante»
   >
   > «el objetivo principal [...] es dejar la web funcionando y luego ya le agregaremos la parte de diseño»

4. Se implementó y comprobó la primera versión. El último mensaje del usuario solicita reunir todo el contexto, instrucciones y planes en un `.md` para que Claude se encargue del proyecto. **Este es ese documento; no implica que las futuras ideas visuales ya estén implementadas o que debas construirlas todas inmediatamente.**

### Instrucciones operativas para continuar

- Trabaja sobre lo que ya existe. No vuelvas a hacer un proyecto vacío, una demostración o una landing page.
- Prioriza que el usuario pueda estudiar y hacer tests de verdad, con datos correctos y progreso fiable.
- Resuelve decisiones rutinarias y continúa el trabajo autorizado sin pedir confirmación a cada paso.
- Mantén todos los módulos y apartados disponibles. No impongas desbloqueos, niveles, rachas obligatorias ni un recorrido cerrado.
- El usuario elige materia, modo, longitud de práctica y cuándo continuar. La simulación estricta conserva las restricciones del examen real.
- Las animaciones, mascota y pistas son una **fase posterior**. No deben retrasar ni degradar lo funcional.
- No publiques, contrates servicios, añadas autenticación remota, pagos, bases remotas ni APIs de IA por iniciativa propia: el alcance acordado es local. Las tres cuentas locales solicitadas (`admin`, `invitado`, `joe`) sí forman parte de la próxima implementación.
- Conserva los PDF originales y el progreso del usuario. Usa perfiles desechables en pruebas que importen o reinicien datos.
- Usa español para la interfaz, contenidos y comunicación.

## 2. Estado actual: qué existe y qué se comprobó

### Implementado

- Inicio con acceso libre a todos los apartados y resumen de progreso.
- Temario de cuatro módulos, con **28 secciones** didácticas y marcado de lectura.
- **437 preguntas oficiales distintas**, procedentes de **442 apariciones** en ocho PDF; los duplicados exactos comparten ID y estadísticas, conservando las referencias a todas sus fuentes.
- **437 explicaciones didácticas** y **15 notas** de discrepancias o actualizaciones de las fuentes.
- **32 preguntas EXTRA**, ocho por módulo, identificadas como generadas con IA y practicadas aparte.
- Tests por módulo con cantidad configurable o batería completa.
- Tests nuevos de 60 preguntas respetando el reparto oficial.
- Las **cuatro pruebas oficiales de ejemplo**, cada una con sus 60 preguntas y el orden original de preguntas.
- Modal previo para elegir estudio/examen, tiempo opcional y barajado de opciones; el simulacro estricto entra en modo examen.
- Modo estudio con corrección inmediata y explicación; la primera respuesta es la que cuenta.
- Modo examen con respuestas modificables o borrables y corrección solo al entregar.
- Simulacro estricto de 60 minutos, selección por dificultad conceptual y errores personales, y entrega automática al agotarse el tiempo.
- Repaso de errores pendientes, con opción de incluir los ya recuperados.
- Navegación por cualquier número de pregunta, salto, anterior/siguiente y marcado de dudas.
- Guardado de preguntas para consultarlas desde el banco.
- Pausa y reanudación de prácticas. El simulacro estricto no se pausa; el reloj continúa al salir o cerrar la página.
- Historial con resultado por módulo y revisión filtrable de respuestas, errores, blancos y marcadas.
- Banco consultable con búsqueda, filtros por módulo, origen y estado. Consultar soluciones no modifica estadísticas de tests.
- Guardado automático en IndexedDB; exportación/importación de copias JSON y reinicio con confirmación.
- Interfaz responsive y funcional, con tema claro/oscuro, tres cuentas locales y mascota con pistas (21/10/2026, ver sección de implementación).
- Lanzador de Windows `INICIAR.cmd`.

### Evidencia registrada en la sesión de implementación

No son comprobaciones nuevas hechas por quien lea este documento; son las verificaciones realizadas el 21/10/2026:

- `npm.cmd run check` terminó correctamente: comprobación de sintaxis y **15 tests aprobados**.
- Servidor respondió HTTP 200 en `http://127.0.0.1:4173`.
- Playwright comprobó: modo estudio y explicación inmediata, examen sin feedback anticipado, cambio de respuesta, salto a pregunta 60, marcado, pausa, recarga/reanudación, entrega y aparición en historial.
- Se probó búsqueda de `GPS`, apertura del temario y práctica EXTRA.
- En un contexto de navegador desechable se comprobó que cambiar de una sesión activa a un repaso sin preguntas conserva la entrega anterior.
- En contexto desechable se adelantó el reloj de prueba 60 minutos: el simulacro no ofrecía pausa y se entregó automáticamente al vencimiento.
- En contexto desechable se probó exportación de copia, rechazo de copia con preferencias inválidas y restauración válida que sobrevivió a recargar.
- Se inspeccionaron capturas de escritorio a 1440 px y móvil a 390 px, sin desbordamiento horizontal en los recorridos comprobados.
- Se pidió abrir la URL en el panel de Codex; la herramienta devolvió `queued`. No confundir esto con confirmación de que el usuario llegó a verla en ese panel.

### Lo que no debe darse por garantizado

- No consta una validación posterior del usuario usando la aplicación por su cuenta.
- Las explicaciones y el temario son material didáctico creado para la plataforma. Tener cobertura de todos los IDs no demuestra que cada explicación sea exhaustiva o perfecta. Algunas usan reglas conceptuales compartidas; pueden mejorarse con ejemplos específicos.
- Los ocho PDF son muestras y ejemplos oficiales disponibles, no la totalidad garantizada de las posibles preguntas del examen real.
- No hay sincronización entre dispositivos, cuentas remotas, backend de progreso, servicio worker ni instalación PWA. Las tres cuentas son locales del navegador. La mascota tiene un único gesto animado; no hay más poses.
- El servidor estaba iniciado al terminar la implementación, pero puede haber terminado al cambiar de sesión. Compruébalo; no des por hecho que sigue activo.
- Varias pestañas: control optimista por revisión (`rev:<cuenta>` se comprueba dentro de la transacción). Si otra pestaña escribió antes, la escritura no se aplica: se recarga la cuenta guardada y se avisa; como mucho se pierde la última acción de la pestaña desfasada, nunca datos ya guardados. Las pestañas se avisan con `BroadcastChannel` y se sincronizan al recuperar el foco, salvo con un test en marcha.

## 3. Reglas funcionales que deben mantenerse

### Evaluación

| Módulo | Materia | Preguntas de examen | Mínimo de aciertos |
|---|---|---:|---:|
| 1 | Lengua castellana | 12 | 6 |
| 2 | Medio físico, navegación e itinerarios | 18 | 9 |
| 3 | Accesibilidad y servicio público | 18 | 9 |
| 4 | Marco jurídico VTC | 12 | 6 |

- Examen completo: 60 preguntas, cuatro opciones y una solución por pregunta; 60 minutos en simulacro estricto.
- Fallos y blancos no restan.
- APTO global solo si se alcanza el mínimo **en cada módulo**. Un total alto no compensa un módulo suspenso.
- En prácticas de longitud personalizada se usa `ceil(preguntas del módulo / 2)` como mínimo de práctica; se identifica como resultado de práctica.
- En estudio cuenta la primera respuesta: ver la solución y luego cambiarla no debe inflar el resultado. En examen se permite editar antes de entregar.
- Entregar dos veces no debe duplicar historial ni estadísticas.

### Selección y opciones

- Tests normales y por módulo: priorizar preguntas menos vistas; aleatorizar empates.
- Simulacro: priorizar dificultad conceptual estimada y errores personales. Es una estimación de la plataforma, no una dificultad oficial certificada.
- Barajar opciones conservando sus IDs: la solución no depende de la letra visible después del barajado.
- Las pruebas de ejemplo conservan su secuencia original de preguntas; el usuario puede barajar opciones.
- No mezclar EXTRA con oficiales en los tests oficiales ni en la cobertura oficial.

### Libertad y persistencia

- Sin bloqueos de módulos ni progresión obligatoria.
- Permitir saltar, revisar, marcar dudas y dejar blancos.
- Guardar posición, orden de opciones, respuestas y marcado para no cambiar el test al recargar.
- El reloj estricto se basa en una fecha límite absoluta y no se reinicia al recargar.
- Una copia inválida debe rechazarse antes de sustituir el estado.
- No borrar datos para poder probar un cambio: crear un contexto de navegador aislado.

## 4. Arquitectura decidida y cómo arrancar

La propuesta inicial mencionó React + TypeScript + Vite y Dexie. **Eso no es el stack implementado.** Para cumplir la prioridad de rapidez y evitar descargas, se eligió:

- JavaScript con módulos ES nativos.
- HTML y CSS propios.
- Servidor estático con Node.js y módulos nativos (`http`, `fs`, `path`).
- IndexedDB nativo para persistencia del progreso.
- Ficheros JSON incluidos para preguntas, teoría, explicaciones, pruebas y reporte de importación.
- Python con `pypdf` solo para regenerar el banco desde PDF, no para usar la web.
- Tests con `node:test`, sin frameworks ni dependencias de instalación.

No necesitas migrar a React ni instalar paquetes para continuar. Cambiar de stack ahora añadiría trabajo sin una necesidad funcional demostrada.

### Windows / PowerShell

```powershell
Set-Location 'C:\WEBS\VTC_web'
node server.mjs
```

Abrir `http://127.0.0.1:4173`.

Alternativas: doble clic en `INICIAR.cmd`, `npm.cmd start` o `npm.cmd run dev`.

```powershell
npm.cmd test
npm.cmd run check
```

- Node detectado en esta máquina durante la implementación: `v24.18.0`.
- Se usa `npm.cmd` para evitar problemas con la política de scripts de PowerShell.
- No ejecutar `npm install` por rutina: `package.json` no tiene dependencias.
- El servidor escucha en `127.0.0.1`, puerto 4173; `PORT` permite elegir otro, pero **cambiar el origen también cambia el almacenamiento visible del navegador**.
- Si el puerto está ocupado, comprueba si ya sirve esta web. No cierres procesos ajenos indiscriminadamente.
- No había carpeta `.git` en el proyecto al implementar. No hay commit, rama, PR ni despliegue creado.

### Ubicación real de los datos del usuario

El progreso no está en un archivo de la carpeta: está en IndexedDB del navegador, base `vtc-madrid` (versión 1), almacén `app`. Claves: `meta` (`{version:2, activeProfile}`), `profile:admin`, `profile:invitado`, `profile:joe`; `rev:<cuenta>` (revisión de cada cuenta, sube en cada escritura); `state` es el progreso único anterior, conservado intacto tras migrarlo a `admin`; `respaldo:<cuenta>:<fecha>` solo aparece si hubo que reparar una cuenta. La caché `localStorage['vtc-theme']` solo evita un destello al cargar.

Usar el mismo origen `http://127.0.0.1:4173` y perfil. `localhost`, otro puerto, otro navegador o perfil no comparten automáticamente esos datos. Borrar datos del navegador los elimina; la copia exportada es el medio de respaldo y traslado.

## 5. Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `HANDOFF.md` | Este traspaso, requisitos y contexto de la conversación. |
| `temas/especificaciones_del_proyecto_vtc_web_claude_md.md` | Especificación original; se reproduce íntegra al final de este documento. |
| `temas/*.pdf` | Ocho fuentes oficiales originales. No modificarlas. |
| `index.html` | Entrada, idioma, metadatos, CSS, módulo principal, modal y avisos. |
| `src/app.js` | UI, navegación por hash, configuración de tests, sesión, cronómetro, revisión, filtros, copias y eventos. |
| `src/core.js` | `MODULES`, `selectQuestions`, `shuffleOptions`, `grade`, `finishSession`, `emptyState`, `validateBackup`. |
| `src/storage.js` | Apertura de IndexedDB; lectura de `meta`, `state`, cuentas y revisiones; `saveAll` atómico, `saveProfile` con comprobación de revisión, `saveMeta`, `loadProfileRaw`. |
| `src/profiles.js` | `PROFILES`, migración (`initialProfiles`), reparación de cuentas dañadas, `reloadProfile`, copias v2 (`buildBackup`, `parseBackup`). |
| `src/hints.js` | Política de pistas por modo (`hintPolicy`), niveles (`nextHint`), `sectionFor`, `discardedOption`. |
| `src/theme-boot.js` | Aplica el tema cacheado antes de pintar. |
| `src/styles.css` | Tokens de color de ambos temas, componentes, estados, accesibilidad visual, alto contraste y responsive. |
| `assets/mascota/gallo-256.png`, `gallo-96.png` | Mascota servida por la web (v4 recortada y reducida). Las `gallo-referencia*.png` no se sirven. |
| `server.mjs` | Servidor estático local y cabeceras. No es un backend de progreso. |
| `INICIAR.cmd` | Lanzador local de Windows. |
| `package.json` | Comandos `start`, `dev`, `test`, `check`; tipo `module`. |
| `favicon.svg` | Icono básico del proyecto. |
| `data/questions.json` | Banco oficial de 437 preguntas, claves, dificultad y referencias. |
| `data/examples.json` | Cuatro listas ordenadas de 60 IDs de los ejemplos oficiales. |
| `data/import-report.json` | Cantidades y SHA-256 de los ocho PDF; trazabilidad de la importación. |
| `data/content.json` | Cuatro módulos, 28 secciones, 32 EXTRA y enlaces a fuentes. |
| `data/explanations.json` | Explicación por ID oficial y notas sobre posibles erratas/cambios. |
| `scripts/extract.py` | Extracción reproducible con `pypdf`; valida cantidades, opciones y claves. |
| `scripts/enrich-content.mjs` | Generación reproducible de teoría, EXTRA y explicaciones. Si mejoras contenido, actualiza también este generador cuando proceda para no perder mejoras al regenerar. |
| `tests/core.test.mjs` | Reparto, prioridad de exposición/dificultad, notas, entrega e importación. |
| `tests/data.test.mjs` | Integridad de las ocho fuentes, ejemplos, EXTRA y ciclo de copia/restauración. |
| `tests/profiles.test.mjs` | Cuentas, migración, preferencias, copias v1/v2, pistas sin revelar la respuesta. |
| `tests/hardening.test.mjs` | Regresiones de la revisión: validación de reloj/fechas, cuentas dañadas, `includedProfiles`, hora de entrega del simulacro vencido, pistas, posición de la correcta en EXTRA y servidor. |
| `docs/superpowers/plans/2026-10-21-vtc-local.md` | Plan ejecutado, decisiones y evidencias de validación. |
| `docs/superpowers/plans/2026-10-21-cuentas-temas-mascota.md` | Plan y decisiones de cuentas, tema y mascota. |
| `README.md` | Instrucciones de uso, persistencia y comandos. |
| `.playwright-mcp/` | Capturas y snapshots generados en pruebas. No son contenido del producto. |
| `.gitignore` | Exclusiones básicas para dependencias, temporales y logs. |

### Contratos importantes

Pregunta: `{ id, module, text, options:[{id,text}], correct, official, sources?, difficulty, explanation? }`.

`correct` refiere al ID original `a`/`b`/`c`/`d`, no al lugar de la opción barajada. `sources` identifica `file`, `page` y `number`.

Estado de cada cuenta: `{ version:1, stats, history, active, bookmarks, readSections, preferences:{shuffle, theme:'light'|'dark', mascot:boolean} }`. Las preferencias que falten se completan con `{shuffle:true, theme:'light', mascot:true}`.

Una sesión conserva `questionIds`, `answers`, `firstAnswers`, `order`, `index`, `flagged`, `visited`, `startedAt`, `deadline`, campos de pausa/tiempo y, opcionalmente, `hints` (`{idPregunta: 1|2|3}`). No cambies IDs ni esquemas sin considerar las copias y el progreso existentes.

Las rutas principales son `#inicio`, `#temario`, `#temario/1`, `#modulos`, `#normales`, `#simulacro`, `#fallos`, `#extra`, `#banco`, `#progreso`, `#ajustes` (Configuración), `#test`, `#resultado/<id>` y `#temario/<módulo>/<sección>`.

## 6. Datos oficiales, discrepancias y trazabilidad

Inventario importado:

| PDF | Preguntas |
|---|---:|
| `ejemplo-prueba-i.pdf` | 60 |
| `ejemplo-prueba-ii.pdf` | 60 |
| `ejemplo-prueba-iii.pdf` | 60 |
| `ejemplo-prueba-iv.pdf` | 60 |
| Muestra módulo I | 50 |
| Muestra módulo II | 50 |
| Muestra módulo III | 51 |
| Muestra módulo IV | 51 |
| Total de apariciones | 442 |

Preguntas distintas por módulo: M1 **98**, M2 **121**, M3 **120**, M4 **98**.

Se mantienen las claves tal como aparecen en los PDF, incluso cuando parecen equivocadas. La explicación contiene una nota para no enseñar un error como regla general. No cambies silenciosamente las claves.

Ejemplos detectados: el umbral de discapacidad del 1% en una clave frente al umbral general del 33%; confundir la Ley estatal 16/1987 con la autonómica 20/1998; formulaciones restrictivas sobre distintivo CERO; asociaciones culturales discutibles; categorías sancionadoras de supuestos próximos.

El contenido incorporó referencias al Decreto 59/2026 y a nuevos distintivos anunciados desde el 03/11/2026. Son datos recogidos durante esta sesión, no una garantía de vigencia futura. Antes de modificar normativa o primeros auxilios, consulta fuentes primarias actualizadas y conserva la distinción entre respuesta del PDF y explicación didáctica.

Fuentes enlazadas dentro de `data/content.json`: Comunidad de Madrid (pruebas, permisos y autorizaciones VTC), BOCM (Decretos 5/2024 y 59/2026), BOE (Ley 7/2021, RDL 1/2013 y RD 1544/2007), DGT (distintivos), Cruz Roja (conducta PAS).

### Regeneración

```powershell
python scripts/extract.py
node scripts/enrich-content.mjs
npm.cmd run check
```

La primera orden requiere `pypdf`. En esta sesión se usó el Python incluido en el runtime de Codex porque ese paquete ya estaba disponible allí. El Python global no tiene necesariamente los mismos paquetes. No regeneres por rutina ni sobrescribas mejoras de contenido sin revisar diferencias.

## 7. Intentos fallidos y correcciones: evita repetirlos

### Instalación / entorno

- Se consultó `npm view vite version`; no produjo respuesta a tiempo. Se decidió trabajar sin dependencias para cumplir la urgencia. No se demostró un fallo permanente de npm; tampoco es necesario volver a intentarlo para usar este proyecto.
- `import pymupdf` falló con `ModuleNotFoundError: No module named 'pymupdf'`. Se utilizó `pypdf`, disponible en el runtime incluido. No vuelvas a instalar o depender de PyMuPDF para este importador sin necesidad.
- El primer servidor iniciado dentro del sandbox no era accesible desde el navegador. PowerShell informó «Intento de acceso a un socket no permitido por sus permisos de acceso». Tras iniciar el mismo servidor con permiso de ejecución fuera del sandbox, HTTP y Playwright funcionaron. Si se repite, revisa permisos/entorno antes de modificar la app.

### Importador PDF

- Un detector sensible a mayúsculas encontró 51 preguntas pero 50 claves en la muestra IV: una decía `Correcta: A`. Se corrigió la búsqueda para ignorar mayúsculas.
- Un patrón demasiado amplio encontró 61 claves en la prueba III porque interpretaba `opción correcta:` seguido de `a)` como una clave. Se ancló el marcador `CORRECTA:` al principio de línea, conservando `Respuesta correcta` también tras referencias en la misma línea.
- Resultado final: todos los bloques tienen cuatro opciones y una clave; las cuatro pruebas tienen exactamente las preguntas 1 a 60. No relajes estas validaciones para ocultar un error de importación.

### Fallos encontrados por revisión y ya corregidos

1. `validateBackup` aceptaba `bookmarks:null`, `readSections:null` y `preferences:null`, que podían bloquear la UI al restaurar. Ahora valida tipo de colecciones y `preferences.shuffle`; hay test de regresión.
2. Al entregar una sesión para iniciar otra, si la nueva selección estaba vacía, la entrega anterior no se persistía. Se añadió persistencia y render antes de intentar iniciar la nueva. El caso pasó en navegador aislado.
3. El indicador de guardado podía decir «guardado» cuando aún quedaban escrituras en cola. Se añadió `saveRevision` para que solo la última operación marque el estado como guardado.

### Pruebas y revisión automática

- Una prueba que pulsaba «Borrar mi progreso» en el perfil principal fue rechazada por la revisión automática por riesgo de destrucción de datos. **No se ejecutó.** Se continuó con contextos desechables creados mediante `browser.newContext()`, sin borrar el perfil original. Mantén este criterio.
- Una prueba de copias falló inicialmente porque `waitForSelector('#import-file')` esperaba visibilidad, pero el input de archivo es deliberadamente oculto. Se cambió a `{state:'attached'}`; el flujo de exportación/importación pasó. No era un fallo de la aplicación.
- El detector Impeccable produjo una advertencia estética `dark-glow` por una sombra en el diálogo. No es un fallo funcional demostrado; se aplazó el pulido visual conforme a la prioridad del usuario. No afirmes que todo control estético quedó limpio.

## 8. Skills, plugins y MCP revisados

El inventario de Claude Code se leyó en su configuración local. Estos plugins figuraban habilitados:

- `impeccable@impeccable`.
- `frontend-design@anthropic-plugin-directory`.
- `playwright@claude-plugins-official`.
- `superpowers@claude-plugins-official`.
- `claude-mem@thedotmack`.
- `caveman@caveman`.
- `claude-security@claude-plugins-official`.
- `security-guidance@claude-plugins-official`.

Los manifiestos mostraron los MCP de Playwright y Claude Mem (`mcp-search`). También figuraba un MCP personalizado `discord-betbase`, sin utilidad identificada para esta web. Que un plugin esté configurado no prueba que su servidor esté operativo en una sesión nueva.

Codex disponía de herramientas de terminal/archivos, Playwright, búsqueda web, ImageGen, Claude Mem y apertura de vistas; también de servicios como GitHub y Sites. No se necesitó conectar servicios nuevos, publicar ni instalar plugins.

Recomendación de uso:

| Necesidad | Herramientas adecuadas |
|---|---|
| Mejoras de funcionalidad | Terminal, pruebas Node, depuración enfocada, Superpowers cuando aporte valor. |
| Validación del uso real | Playwright, preferiblemente contextos desechables para datos. |
| Fidelidad documental | Skill PDF y `pypdf`; verificar contra los originales. |
| Diseño posterior | Impeccable como guía principal; Frontend Design como revisión complementaria. |
| Accesibilidad | Skill Accessibility y comprobaciones de teclado/contraste. |
| Contenido normativo | Navegación y fuentes oficiales actualizadas. |
| Continuidad | Claude Mem si está disponible, sin depender de él para entender este archivo. |
| Mascota e ilustraciones futuras | ImageGen o herramientas apropiadas, cuando se aborde esa fase. |
| Revisión de seguridad | Claude Security de forma acotada si procede. |

No apiles todas las skills visuales: las de landing pages, scroll cinematográfico, marketing, SEO o clones no son prioritarias para esta aplicación personal de estudio.

## 9. Próximos pasos para Claude

**Estado (21/10/2026):** los requisitos de la sección «Actualización prioritaria del usuario: mascota, temas y cuentas locales» están implementados y verificados (ver «Implementación de cuentas, temas y mascota» y «Verificación final»). Los puntos 7 y 8 siguientes se conservan como historial. Siguientes pasos razonables, solo si el usuario los pide: más poses de la mascota derivadas de la v4, revisar las explicaciones genéricas y los casos con `note`, y un bloqueo explícito entre pestañas.

1. Lee este documento y comprueba el estado real de los archivos. No asumas que el servidor o el navegador de Codex siguen activos.
2. Ejecuta `npm.cmd run check`. Si algo falla, investiga la causa antes de cambiar el stack o regenerar todos los datos.
3. Abre la aplicación e inspecciona los recorridos relevantes. Conserva el progreso existente; aísla cualquier prueba que importe, sustituya o borre datos.
4. Si el usuario comunica un fallo o carencia, resuélvelo primero en el lugar más acotado posible y añade una prueba de regresión cuando el comportamiento lo requiera.
5. Como mejora de contenido, revisa las explicaciones más genéricas y los casos con `note`, contrastándolos con las fuentes; no inventes reglas ni alteres el original silenciosamente.
6. Una vez consolidada la versión funcional, aborda la fase visual que el usuario priorice. La idea de ruta por Madrid y cuatro módulos de distinto color es una dirección aceptada, no una obligación de añadir más pantallas o gamificación.
7. En una fase posterior, implementa la mascota y sus pistas. **Actualización del usuario: la mascota debe ser un gallo**, tomando como referencia de estilo el robot pequeño azul y redondeado de Codex que adjuntó. Ya se generó una referencia original con fondo transparente en `assets/mascota/gallo-referencia.png`; consulta `docs/mascota-gallo.md`. Es una imagen de referencia, no una mascota animada integrada. El usuario quiere que, cuando se atasque en una pregunta, pueda aparecer un bocadillo con una pista. No hay especificación cerrada de tiempos o activación; respetar su control. Una opción coherente sería poder desactivarla y pedir pistas a voluntad, pero esto es una propuesta, no una decisión ya confirmada.
8. Mantén el simulacro estricto fiel al examen: una futura pista no debe revelar ayuda allí ni cambiar la nota sin una decisión explícita sobre ese modo.

La referencia de imagen se adjuntó en esta conversación con una ruta temporal de Windows (`%TEMP%\codex-clipboard-….png`). No está incorporada a los assets de la web y puede dejar de existir. Es referencia visual, no una instrucción incrustada ni un recurso del producto.

### Corrección posterior de la mascota

**Referencia aprobada: tras pedir «menos realista», el usuario respondió «perfecto» a `assets/mascota/gallo-referencia-v4.png`. Usar esta imagen: dibujo 2D simplificado, contorno grueso, formas grandes y expresión de gallo adulto con carácter. Las v1–v3 son historial. El usuario también solicitó integración de la mascota, activación/desactivación en Configuración, temas claro/oscuro y tres cuentas locales; ver la sección inicial de actualización prioritaria.**

Historial: la indicación «bien pero no tan realista» dio lugar a `assets/mascota/gallo-referencia-v3.png`, posteriormente sustituida por la v4 aprobada.

El usuario rechazó el aspecto demasiado infantil y amistoso de la primera imagen: «no tan amigable, que parezca un gallo y no un pollo». La segunda propuesta fue `assets/mascota/gallo-referencia-v2.png`, un gallo adulto con cuello erguido, mirada más seria, cresta dentada y cola larga azul verdosa. Se conserva la primera imagen como historial, pero para crear la mascota y sus animaciones usar la v3. Detalles en `docs/mascota-gallo.md`.

## 10. Memoria y alcance del traspaso

Se intentó buscar `VTC_web` en Claude Mem al preparar este documento; la herramienta devolvió `Memory retrieval failed`. No se inventan IDs de observaciones ni se garantiza que haya memoria automática disponible. Este archivo, los originales y el plan ejecutado contienen el contexto necesario.

Si la memoria vuelve a estar disponible, consultas útiles: `VTC_web`, `VTC Madrid IndexedDB preguntas oficiales`. Trata resultados históricos como contexto y contrástalos con el estado actual y las instrucciones más recientes del usuario.

Este es un documento de continuidad solicitado por el usuario. Consérvalo mientras sea útil; no lo borres automáticamente ni lo confundas con código, datos de examen o un registro completo de cada llamada interna a herramientas.

## 11. Especificación original íntegra

El contenido siguiente se copia del documento de `temas` para que este traspaso sea autosuficiente. Es la especificación inicial del proyecto. Las aclaraciones posteriores del usuario, recogidas arriba, fijan la prioridad de ejecución y aplazan mascota/animaciones; no conviertas las ideas futuras en requisitos ya realizados.

---


# Proyecto: Plataforma de Estudio y Simulador de Examen VTC (Comunidad de Madrid)

## 1. Contexto y Objetivo del Proyecto

El objetivo es crear una aplicación web de uso **privado y local** diseñada para el estudio del temario y la realización de tests (estilo DGT / Todotest) para obtener el **Permiso de Conductor de VTC de la Comunidad de Madrid**.

Tienes total libertad para diseñar y decidir la arquitectura técnica, el stack, la organización de carpetas y la estructura de archivos del proyecto, teniendo en cuenta únicamente que es para uso personal de estudio en local y debe persistir el progreso del usuario (historial de preguntas vistas, aciertos, fallos y estadísticas).

## 2. Entorno Actual y Material de Origen (PDFs Oficiales)

El directorio raíz del proyecto es:
`C:\WEBS\VTC_web\`

Dentro de la subcarpeta `C:\WEBS\VTC_web\temas\` se encuentran **8 archivos PDF oficiales** publicados por la Comunidad de Madrid con baterías de preguntas de muestra, pruebas completas de ejemplo y sus respectivas plantillas de respuestas:

1. `ejemplo-prueba-i.pdf` (Ejemplo oficial completo de Prueba I)
2. `ejemplo-prueba-ii.pdf` (Ejemplo oficial completo de Prueba II)
3. `ejemplo-prueba-iii.pdf` (Ejemplo oficial completo de Prueba III)
4. `ejemplo-prueba-iv.pdf` (Ejemplo oficial completo de Prueba IV)
5. `muestra_modulo_i_-_conocimientos_de_...pdf` (Batería oficial del Módulo 1: Lengua Castellana)
6. `muestra_modulo_ii_-_conocimientos_del...pdf` (Batería oficial del Módulo 2: Medio Físico)
7. `muestra_modulo_iii_-_conocimientos_de...pdf` (Batería oficial del Módulo 3: Accesibilidad y Servicio Público)
8. `muestra_modulo_iv_-_conocimientos_de...pdf` (Batería oficial del Módulo 4: Marco Jurídico VTC)

El 100% de las preguntas y respuestas contenidas en estos 8 PDFs deben extraerse e integrarse fielmente en la plataforma como el banco de preguntas oficial, incluyendo una explicación didáctica para cada pregunta que ayude a entender el porqué de la respuesta correcta.

## 3. Reglas Oficiales de Evaluación (Criterios de la Comunidad de Madrid)

El sistema de calificación del simulador debe regirse estrictamente por la normativa oficial del examen de la Comunidad de Madrid:

* **Duración máxima del examen completo:** 60 minutos.
* **Formato:** 60 preguntas tipo test con **4 opciones de respuesta cada una** (solo una es válida).
* **Penalización por errores:** **Los fallos NO restan puntos**, ni tampoco las preguntas dejadas en blanco. Únicamente se contabilizan las respuestas correctas.
* **Calificación por módulos (APTO / NO APTO):**
  La nota final es **"APTO"** o **"NO APTO"**. Para obtener el **"APTO"**, es obligatorio alcanzar el **mínimo de respuestas correctas en TODOS y cada uno de los 4 módulos por separado**. Si se suspende un solo módulo, la calificación global será **"NO APTO"** independientemente del total de aciertos.

| Módulo | Materia Oficial | Nº Preguntas en Examen | Mínimo para Aprobar (50%) |
| :--- | :--- | :--- | :--- |
| **Módulo 1** | Conocimiento de la lengua castellana: gramática y léxico | **12 preguntas** | **6 correctas** |
| **Módulo 2** | Conocimiento del medio físico: sistemas de navegación, itinerarios y destinos de interés, etc. | **18 preguntas** | **9 correctas** |
| **Módulo 3** | Conocimiento de la accesibilidad y servicio público: atención al cliente, usuarios con discapacidad, menores de edad y animales domésticos, etc. | **18 preguntas** | **9 correctas** |
| **Módulo 4** | Conocimiento del marco jurídico aplicable a la actividad de transporte de viajeros | **12 preguntas** | **6 correctas** |
| **TOTAL** | **Examen Completo VTC Madrid** | **60 preguntas** | **Superar el mínimo en los 4 módulos** |

## 4. Lógica de Aleatoriedad Inteligente (Cobertura Total sin Memorización)

Para evitar que el estudiante memorice las respuestas por su orden de aparición, pero evitando a la vez el problema del azar puro (hacer 10 o 12 tests y que haya preguntas que no salgan nunca), el sistema de selección de preguntas debe cumplir lo siguiente:

1. **Prioridad a preguntas no vistas (o menos vistas):** Al generar un test aleatorio, el sistema debe dar prioridad a las preguntas que menos veces hayan salido hasta ese momento, barajándolas entre sí. De este modo se garantiza que tras varios tests se haya recorrido el 100% del banco de preguntas sin dejar ninguna atrás, pero siempre en un orden impredecible.
2. **Aleatoriedad en las opciones de respuesta:** El orden de las 4 opciones de respuesta también debe barajarse en cada intento para obligar a leer el contenido y no memorizar la letra de la opción correcta.

## 5. Apartados y Funcionalidades Requeridas en la Web

### A. Sección de Temario de Estudio
Un apartado de estudio estructurado en torno a los **4 módulos oficiales** (Lengua castellana, Medio físico e itinerarios de Madrid, Accesibilidad/Atención al cliente/Primeros auxilios, y Marco Jurídico VTC / Decreto 5/2024), que cubra toda la teoría necesaria para responder tanto las preguntas oficiales como posibles variantes del examen.

### B. Ventana Emergente (Modal) de Selección de Modo: Estudio vs. Examen
Antes de comenzar a responder las preguntas de un test (salvo en el simulacro de Examen Oficial estricto), debe mostrarse una **ventana emergente centrada en pantalla** que permita al usuario elegir cómo quiere realizar ese test:
* **Modo Estudio:** Al seleccionar una respuesta, se indica al instante si es correcta o incorrecta y se muestra en ese mismo momento una explicación clara y adecuada.
* **Modo Examen:** No se muestra si la respuesta está bien o mal ni se muestran las explicaciones mientras se responde. Todo el feedback, el desglose de aciertos/fallos y las explicaciones se muestran únicamente cuando el usuario pulsa en **"Entregar examen"**.

### C. Los 5 Apartados de Tests

1. **Tests por Módulos:**
   * Permite practicar un módulo concreto (Módulo 1, 2, 3 o 4).
   * Dado que el banco por módulo es acotado y no procede hacer tests de 60 de un solo módulo, debe permitir hacer tests adaptados al tamaño oficial de cada módulo (12 o 18 preguntas según corresponda, priorizando las no vistas) o repasar la batería del módulo.
   * Incluye la ventana emergente previa para elegir **Modo Estudio** o **Modo Examen**.

2. **Tests Normales (60 preguntas):**
   * Genera tests de **60 preguntas oficiales** respetando el reparto oficial (12 del M1, 18 del M2, 18 del M3 y 12 del M4) mediante el sistema de aleatoriedad inteligente, además de permitir realizar las 4 pruebas oficiales de ejemplo íntegras.
   * Incluye la ventana emergente previa para elegir **Modo Estudio** o **Modo Examen**.

3. **Exámenes Oficiales (Simulacro Estricto con las Preguntas Más Difíciles):**
   * Funciona directamente como el examen real: **60 preguntas** repartidas según los criterios oficiales (12 / 18 / 18 / 12) y un **cronómetro de 60 minutos**.
   * **Criterio de dificultad:** Para este modo se deben seleccionar las preguntas más difíciles del banco oficial (combinando aquellas de mayor complejidad conceptual/normativa y las que más suelen costar al usuario).
   * No muestra correcciones ni explicaciones hasta darle a **"Entregar"** (o agotarse el tiempo). Al entregar, muestra el resultado detallado por módulos y la calificación final de **APTO / NO APTO** según los criterios oficiales.

4. **Test de Preguntas Más Falladas:**
   * Un apartado específico que recopila automáticamente las preguntas que el usuario ha fallado en tests anteriores, priorizando las que acumulan más errores, para poder practicarlas hasta dominarlas (con ventana emergente para elegir Modo Estudio o Modo Examen).

5. **Apartado de Preguntas "EXTRA" (Generadas por IA - Separado de las Oficiales):**
   * Basándote en el contexto de este documento, el temario oficial de la Comunidad de Madrid y el estilo de los PDFs, debes crear un banco adicional de preguntas nuevas para ampliar el estudio.
   * **Regla de separación estricta:** Estas preguntas deben estar en un apartado propio e independiente y estar **señalizadas expresamente como `"EXTRA"`** para no mezclar ni confundir nunca las preguntas oficiales de la Comunidad de Madrid con las generadas por la IA.
