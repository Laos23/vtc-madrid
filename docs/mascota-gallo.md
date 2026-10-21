# Mascota: gallo

Fecha: 21/10/2026. El usuario ha pedido una imagen de un gallo para que Claude tome referencia al crear la mascota acompañante. El robot azul adjuntado anteriormente es la referencia de estilo, no el personaje final.

## Integración realizada (Claude, 21/10/2026)

- **Imagen usada en la web:** `assets/mascota/gallo-256.png` (y `gallo-96.png`, disponible). Son la v4 aprobada recortada al contenido (1303×1145) y reducida con Pillow (LANCZOS). No se ha redibujado ni modificado el personaje: conserva su identidad de gallo adulto 2D con contorno grueso. El servidor solo publica estos dos archivos; las referencias v1–v4 no se sirven.
- **Dónde aparece:** en el inicio (con un bocadillo breve, en lugar del recorrido decorativo), en cada test dentro de un bloque propio bajo las respuestas (nunca superpuesto a la pregunta, las opciones ni los botones; comprobado en anchos de 320 a 1440 px) y en la página de resultado con una frase según APTO/NO APTO, escrita después de corregir.
- **Pistas (`src/hints.js`):** solo en Modo Estudio y antes de responder. Hasta tres niveles por pregunta, a petición: (1) cómo leer el enunciado; (2) qué parte del temario repasar, con enlace a la sección si hay una coincidencia clara o al módulo si no; (3) descartar una opción incorrecta, que queda tachada pero se puede seguir eligiendo. Nunca cita ni señala la correcta; hay pruebas que lo comprueban para todo el banco y órdenes barajados. Los niveles usados se guardan en la sesión y el resultado indica en cuántas preguntas se pidieron.
- **Atasco:** si una pregunta de estudio sigue sin responder a los 45 s, el gallo ofrece una pista una sola vez, sin mostrarla. En Modo Examen no hay pistas; a los 90 s recuerda una vez que se puede marcar la pregunta y volver. En el simulacro estricto no dice nada más que su mensaje fijo: sin pistas ni avisos.
- **Control:** interruptor «Mostrar el gallo durante los tests» en Configuración, por cuenta, activado por defecto. La «×» del bocadillo también lo desactiva (con aviso de dónde reactivarlo). Desactivado, no aparece en ninguna pantalla.
- **Movimiento y accesibilidad:** un único gesto (pequeño salto) al dar una pista nueva o al avisar; se desactiva con `prefers-reduced-motion`. Las pistas y avisos se anuncian a lectores de pantalla mediante una región `aria-live`. En tema oscuro la imagen lleva una sombra suave para separarla del fondo.

## Revisión del usuario: referencia vigente

**Referencia aprobada: `assets/mascota/gallo-referencia-v4.png`.** El usuario volvió a pedir «menos realista» tras la v3 y respondió «perfecto» a la v4. Esta revisión cambia a dibujo 2D con contorno grueso, formas grandes y pocos detalles, manteniendo el gallo adulto y su expresión con carácter. Creada con ImageGen; fondo transparente. Las versiones v1–v3 son historial.

## Requisitos de integración confirmados

- Mascota presente en la propia página para acompañar y apoyar al usuario cuando haga tests.
- Control en **Configuración** para activarla y desactivarla, conservando la elección.
- Bocadillos con pistas como apoyo cuando se atasque, según la idea original; evitar que oculten preguntas o respuestas. Sin pistas de respuesta en simulacro estricto.
- La aplicación debe ofrecer también selector de tema claro/oscuro y las cuentas locales sin contraseña `admin`, `invitado` y `joe`, con cambio mediante desplegable. Adaptar la presentación de la mascota a ambos temas y respetar la preferencia del perfil.
- Implementado el 21/10/2026: ver «Integración realizada» al principio de este documento.

### Prompt exacto v4

Completely REDRAW the rooster reference as an extremely simple FLAT 2D CARTOON MASCOT, like a clean hand-drawn TV animation cel or a bold vector game character. The user has twice said LESS REALISTIC. Make a dramatic visible change of style, not a subtle simplification. Absolutely NO 3D render, gradients, glossy highlights, lighting effects, realistic feather layers, fine texture, realistic feet or anatomy. Use thick uniform dark navy outlines, just 6 solid flat colors, smooth broad geometric shapes and at most ONE hard-edged shadow patch per large shape. Character design: unmistakable ADULT ROOSTER, proud upright pose and slightly cocky serious expression, medium head connected to a simple upright orange neck, small oval dark blue body, one orange wing represented by a single teardrop shape with one curved line, red comb with three chunky points, two simple red wattles, small sharp closed yellow triangular beak. One simple white oval eye with a small black pupil and one lowered eyebrow, no rendered iris, no huge baby eyes, no friendly smile. Tail is exactly THREE large curved dark blue/teal banana-like plumes with no interior feather detail. Two simple yellow stick-like legs with rounded three-toed feet, no scales or sharp claws. Short compact proportions for a desktop pet, clearly a rooster not a round baby chick. Full body facing right in a readable three-quarter/profile stance, wings folded, centered with generous transparent margin. The reference provides ONLY subject/color/attitude; deliberately discard its painterly realistic rendering. Finished image must look like a bold simple 2D sticker/icon character suitable for animation at 80 pixels, not a painted illustration. Single rooster, transparent background with true alpha. No text, accessories, props, ground, backdrop, border frame or speech bubbles.

### Historial de revisiones anteriores

Historial de v3: «bien pero no tan realista». `assets/mascota/gallo-referencia-v3.png` fue generada con ImageGen a partir de la v2: mantiene gallo adulto y carácter, con formas cartoon más simples, volumen suave, cola de pocas plumas grandes, patas lisas y sin detalle anatómico realista. Fue sustituida por la v4 aprobada.

Prompt de la v3: Redesign the adult rooster as a simple stylized cartoon desktop mascot. Keep the confident upright adult silhouette, red comb and wattles, pointed closed yellow beak, orange-red neck, dark blue body and sweeping blue-teal tail. Use clean large smooth shapes, simplified grouped feathers, three chunky curved tail feathers, smooth yellow legs and rounded toes without realistic scales or claws. Medium cartoon eye and subtly lowered brow, self-assured and slightly cheeky, not babyish or angry. Polished soft 3D cartoon shading, legible at 96px. Full body, three-quarter side view, folded wings, centered, genuine transparent background. No scenery, text, props or bubble. Generated with built-in ImageGen.

El usuario corrigió la primera propuesta: «no tan amigable, que parezca un gallo y no un pollo». La segunda propuesta fue **`assets/mascota/gallo-referencia-v2.png`**, creada con ImageGen a partir de la primera imagen. Su dirección era: gallo adulto, cuello erguido, cabeza proporcionada, mirada más seria, pico cerrado, cresta dentada, patas largas con espolones y gran cola azul verdosa. Plumaje naranja rojizo y pecho oscuro. Mantener transparencia. La primera versión se conserva solo como historial; sus ojos enormes y proporciones de pollito no representan la preferencia actual.

Prompt de revisión: Redesign as a confident adult rooster, less friendly and babyish, with a smaller head, long upright neck, proud chest, strong scaly legs and spurs, closed pointed beak, small sharp amber eyes and slightly stern self-assured look. Prominent red serrated comb and wattles, rusty orange pointed neck feathers, reddish brown wings, navy-black breast and long flowing iridescent blue-green sickle tail. Stylized polished game companion with fine dark contour and soft volume. Full body three-quarter side pose, folded wings, transparent background. No baby proportions, kawaii eyes, smiling mouth, waving gesture, text, props or scenery.

## Archivo de la primera versión (historial)

`assets/mascota/gallo-referencia.png`: PNG con transparencia real. Generado con la herramienta integrada ImageGen, usando la imagen del robot como referencia visual. Es historial: la web usa la v4 (ver «Integración realizada»).

## Identidad visual de la primera versión (historial; sustituida por la v4)

Gallo compacto y redondeado, cabeza grande, ojos expresivos, cresta y barbillas rojas, pico y patas amarillos, plumaje marfil y dorado y cola azul. Cuerpo completo, pose de tres cuartos, un ala levantada. Expresión amable y despierta. Acabado de personaje de videojuego/juguete con volumen suave y contorno fino, legible al reducirlo.

Para variantes y animaciones futuras, conservar estos rasgos, proporciones y colores. La imagen es una referencia inicial: no presupone que el usuario haya aprobado el resultado definitivo de todas las poses.

## Comportamiento solicitado (implementado)

La mascota acompañará al usuario y podrá mostrar un bocadillo con una pista si se atasca en una pregunta. Mantener la prioridad de funcionamiento, el control del usuario y la fidelidad del simulacro estricto. Implementado el 21/10/2026; detalles en «Integración realizada». Quedan abiertas, si el usuario las pide, poses adicionales derivadas de la v4.

## Prompt usado

Create a single original ROOSTER desktop companion character as a visual reference for a future educational web-app mascot. Use the provided small blue robot image ONLY as the reference for the visual language: adorable compact toy-like proportions, oversized round head and squat plump body, tiny limbs, charming readable face, softly shaded 3D volume with a very fine dark contour and slightly pixel-art/game-sprite inspired edge treatment. Replace the robot subject entirely with an unmistakable rooster, NOT a robot with a rooster hat. One complete full-body character, standing upright in a relaxed friendly three-quarter front pose, both feet visible, one little wing slightly lifted in a welcoming gesture. Rounded red comb and red wattles, short golden yellow beak, expressive large dark eyes with bright small highlights and a kind clever expression, warm ivory and golden feathers, small curved deep-blue tail feathers echoing the blue of the reference. Keep feather shapes simple and rounded, a cohesive limited palette, no realistic feather detail. A companion for an adult studying driving tests: friendly and encouraging, never aggressive or a loud caricature. Highly recognizable silhouette and face readable when scaled to 80–120px. Center the rooster with generous clear padding on all sides. Genuine transparent background, no ground plane, no backdrop, no scenery, no text, no logos, no labels, no speech bubble, no additional characters, no contact sheet, no accessories. Deliver a polished high-resolution PNG-style isolated mascot concept suitable for Claude to use as the consistent character reference for later animations. Match the reference's friendly physical toy/game companion feeling.
