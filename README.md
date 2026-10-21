# VTC Madrid: aplicación local de estudio

## Abrir

Haz doble clic en **INICIAR.cmd**. Requiere Node.js (ya disponible en este equipo). También puedes ejecutar `npm.cmd start` o `node server.mjs` en esta carpeta y abrir **http://127.0.0.1:4173**. No requiere instalar paquetes ni claves de API. Mantén la ventana del servidor abierta.

El temario y las preguntas están incluidos; la web no necesita conexión a Internet para practicar. Los enlaces de consulta oficial sí la necesitan.

### Desde cualquier sitio (GitHub Pages)

También está publicada en **https://laos23.github.io/vtc-madrid/** (repositorio público `Laos23/vtc-madrid`). Es la misma web estática: no hay servidor de progreso ni cuentas en la nube.

- El progreso se guarda **en el navegador de cada dispositivo** y por dirección: lo que hagas en el móvil no aparece en el ordenador, y lo de `127.0.0.1:4173` no aparece en GitHub Pages. Para llevarlo de un sitio a otro: Configuración → «Exportar las tres cuentas» en el origen, y «Importar copia» en el destino.
- Las cuentas `admin`, `invitado` y `joe` existen en cada navegador por separado; quien abra el enlace solo ve su propio progreso, nunca el tuyo.
- Para publicar cambios: `git push` a la rama `main`; GitHub Pages la sirve tal cual (sin compilación).

## Funciones

- Temario por módulos y consulta libre del banco.
- Tests por módulo con longitud elegible o batería completa.
- Tests nuevos de 60 preguntas y cuatro ejemplos oficiales íntegros.
- Simulacro de 60 minutos, reparto 12/18/18/12 y APTO solo superando cada módulo.
- Modo estudio (corrección al responder) y examen (corrección al entregar).
- Repaso de errores pendientes o ya recuperados.
- Preguntas EXTRA separadas y etiquetadas.
- Navegación libre, marcar dudas, guardar preguntas, pausa de prácticas y reanudación.
- Historial con revisión por pregunta y módulo. Copias JSON para exportar/importar.
- **Tres cuentas locales** (`admin`, `invitado`, `joe`) con desplegable «Cuenta» en la barra superior.
- **Tema claro u oscuro** elegido en Configuración.
- **Mascota acompañante** (el gallo) con pistas en modo estudio; se activa o desactiva en Configuración.

## Cuentas locales

Hay exactamente tres cuentas: `admin`, `invitado` y `joe`. No tienen contraseña, registro ni conexión remota, y ninguna tiene permisos especiales: son perfiles de este navegador. Se cambia de cuenta con el desplegable «Cuenta» (arriba a la derecha); la cuenta activa aparece siempre en ese desplegable y en el pie del menú lateral. Con teclado, las flechas solo recorren las opciones: la cuenta cambia al pulsar Intro o al salir del desplegable (Escape lo deja como estaba).

Cada cuenta guarda por separado su progreso, estadísticas, historial, fallos, preguntas guardadas, secciones leídas, test en curso y preferencias (barajado, tema y mascota). Al cambiar de cuenta se guarda primero la saliente; una práctica en curso queda en pausa. El simulacro estricto no se pausa: su reloj sigue contando con la misma hora límite aunque cambies de cuenta o recargues, y se entrega automáticamente al volver a esa cuenta si ha vencido. La web recuerda la última cuenta usada.

**Migración:** la primera vez que se abre esta versión, el progreso único anterior pasa completo a `admin`; `invitado` y `joe` empiezan vacíos. El registro antiguo no se borra (sigue en IndexedDB como respaldo, clave `state`).

**Datos dañados:** si una cuenta guardada no se puede leer entera (por ejemplo, tras regenerar el banco con IDs distintos), la web no se bloquea: conserva todo lo válido de esa cuenta, guarda el contenido original aparte (clave `respaldo:<cuenta>:<fecha>`) y lo avisa. Las demás cuentas se abren con normalidad.

**Varias pestañas:** cada cuenta lleva un número de revisión. Una pestaña solo guarda si nadie ha cambiado esa cuenta desde la última vez que la leyó; si otra pestaña se adelantó, no sobrescribe nada: carga la versión guardada y avisa para que repitas tu última acción. Las pestañas se avisan entre sí al guardar y se actualizan solas cuando no estás en mitad de un test. Aun así, lo más cómodo es usar cada cuenta en una sola pestaña.

## Tema y mascota

En **Configuración** puedes elegir **Claro** u **Oscuro**; se aplica a toda la web y se guarda en la cuenta activa. Cada cuenta recuerda su propio tema.

El gallo acompaña en el inicio, durante los tests y en los resultados. Nunca se superpone a la pregunta, las respuestas ni los botones: ocupa un espacio propio bajo las respuestas.

- **Modo Estudio:** puedes pedirle hasta tres pistas por pregunta: cómo leer el enunciado, qué parte del temario repasar (con enlace a la sección si hay una clara o al módulo si no) y, por último, descartar una opción incorrecta. Nunca señala la correcta. Si llevas 45 segundos sin responder, te ofrece una pista una sola vez; no la muestra hasta que la pides.
- **Modo Examen:** no da pistas sobre las preguntas. Como mucho, tras 90 segundos en la misma pregunta, recuerda una vez que puedes marcarla y volver luego.
- **Simulacro estricto:** sin pistas ni avisos, como en el examen real. Si durante el simulacro abres el banco de preguntas, un aviso recuerda que consultar soluciones invalida el simulacro (no se bloquea: tú decides).

Se desactiva con el interruptor de Configuración o con la «×» de su bocadillo; la elección se guarda en la cuenta activa. El resultado de un test indica en cuántas preguntas se pidieron pistas.

## Datos y copias

El progreso se almacena en **IndexedDB del navegador** (base `vtc-madrid`, almacén `app`; claves `meta`, `profile:admin`, `profile:invitado`, `profile:joe` y sus contadores `rev:<cuenta>`), no en la carpeta. Usa la misma dirección y perfil del navegador; otro navegador no comparte automáticamente los datos. No se utilizan cuentas remotas ni analítica.

Desde Configuración puedes **exportar las tres cuentas** o **solo la cuenta activa**. Cada copia (versión 2) indica en `includedProfiles` qué cuentas contiene; al importarla se valida completa antes de tocar nada y solo se reemplazan las cuentas incluidas. Las **copias antiguas** (versión 1, de un solo perfil) se siguen aceptando y se restauran en la cuenta activa. «Reiniciar progreso» borra solo la cuenta activa y conserva su tema y mascota.

El simulacro estricto sigue contando al salir o cerrar la página y se entrega al regresar si ha vencido. Las prácticas se pueden pausar. En modo estudio cuenta la primera respuesta, para evitar inflar las estadísticas después de ver la solución. En examen se pueden cambiar y borrar respuestas antes de entregar. Consultar soluciones en el banco no cuenta como practicar.

## Fuentes y contenido

`data/import-report.json` contiene el inventario y SHA-256 de los ocho PDF: 442 apariciones y 437 preguntas distintas. `data/examples.json` conserva las cuatro secuencias originales de 60 preguntas. Los duplicados exactos comparten estadísticas; se conservan todas sus referencias documentales.

Las claves oficiales se mantienen como aparecen en los PDF. Las explicaciones y apuntes son material didáctico de la plataforma, no documentos oficiales. Las posibles inconsistencias de las plantillas se identifican en las explicaciones. Las EXTRA son preguntas nuevas elaboradas con IA; su opción correcta conserva el ID `a`, pero aparece repartida entre las cuatro posiciones cuando no se barajan las opciones.

Para volver a importar las fuentes: `python scripts/extract.py` (necesita `pypdf`). La aplicación ya incluye el resultado y no necesita Python para funcionar.

La mascota usa `assets/mascota/gallo-256.png`, una versión reducida y recortada de la referencia aprobada `gallo-referencia-v4.png` (sin redibujar). El servidor local solo publica `gallo-96.png` y `gallo-256.png` de esa carpeta; en GitHub Pages, en cambio, todo el repositorio es público.

## Verificación

`npm.cmd test` ejecuta las pruebas del motor, de integridad del banco, de cuentas, copias y pistas. `npm.cmd run check` añade comprobaciones de sintaxis. No hay proceso de compilación: se sirven módulos JavaScript nativos.
