<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
1. Límite de Alcance (Restricción de Backend)

Trabaja únicamente en el Frontend.

Prohibido crear conexiones a bases de datos reales, endpoints de API reales o código de servidor backend.

Toda la persistencia de datos y lógica de negocio debe funcionar 100% en memoria utilizando datos simulados (Mocks).

2. Respeto Estricto a la Arquitectura Hexagonal
El código debe dividirse rigurosamente en tres capas. Está prohibido mezclar responsabilidades:

Capa de Dominio (src/domain/): Aquí solo viven las interfaces puras, tipos y modelos de datos (ej. Comerciante, Usuario, EstadoAsistencia). Cero dependencias de React o de bases de datos.

Capa de Infraestructura / Adaptadores (src/infrastructure/): Aquí viven los Mocks (mercado.mock.ts, auth.mock.ts). Toda la lógica de CRUD (crear, leer, actualizar, eliminar datos en memoria) y la autenticación se manejan aquí. La UI solo debe llamar a estas funciones exportadas.

Capa de Presentación (src/app/ y src/components/): Exclusiva para la Interfaz de Usuario. Los componentes de React no deben contener lógica de negocio ni mutar datos directamente; solo deben consumir los modelos del Dominio y ejecutar las funciones de la Infraestructura.

3. Reglas de Diseño y UI/UX

Mobile-First: El diseño debe verse perfecto primero en dispositivos móviles y escalar a ancho completo (w-full) de forma fluida en monitores de escritorio.

Usa los colores institucionales definidos en la configuración de Tailwind (institucional-green, etc.).

Utiliza patrones modernos: Modales (Dialog) que no se cierren por accidente, tablas responsivas y DateRangePicker para calendarios.

4. Formato de Entrega de Código

No recortes el código: Cuando generes un bloque modificado, entrégalo completo. No uses comentarios flojos como // ...resto del código.

Devuelve únicamente los bloques de código que necesitan ser modificados o creados.

Finaliza siempre tu respuesta con un breve análisis de 3 viñetas explicando el impacto de los cambios.