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