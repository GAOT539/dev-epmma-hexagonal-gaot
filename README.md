# EP-EMA — Sistema de Gestión Operativa, Catastro y Control de Asistencia

> **Empresa Pública – Empresa Municipal Mercado Mayorista de Ambato (EP-EMA)**  
> Plataforma tecnológica institucional para la administración integral de naves comerciales, catastro de comerciantes, planificación espacial mediante croquis modulares, control diario de asistencias con persistencia selectiva y auditoría operativa en tiempo real.

---

## 1. Encabezado e Identidad del Proyecto

El **Sistema de Gestión EP-EMA** es una solución digital diseñada para modernizar, automatizar y transparentar la operación diaria del Mercado Mayorista de Ambato. El sistema unifica la toma de listas en campo, la supervisión de jornales, la administración del catastro comercial y la delimitación arquitectónica del espacio físico de las naves.

### Estado Actual del Proyecto

| Fase del Proyecto | Estado | Madurez | Descripción |
| :--- | :---: | :---: | :--- |
| **Fase 1: Frontend & Simulación Operativa en Memoria** | **Completado y Auditado** | **100%** | Interfaz de usuario completa, responsiva (Mobile-First), modularizada bajo Arquitectura Hexagonal estricta. Validada con 0 errores TypeScript y 0 advertencias ESLint. Implementa persistencia selectiva en memoria, planificador espacial vectorial y exportación de reportes PDF. |
| **Fase 2: Backend API REST, Base de Datos MySQL y Servicios Transaccionales** | **En Construcción** | **Próxima Implementación** | Stack tecnológico 100% código abierto delimitado: Next.js Route Handlers (`/api/v1/*`), base de datos relacional MySQL 8.0, Prisma ORM, autenticación por Cookies HttpOnly con JWT (`jose`), cifrado de claves con `bcryptjs` y correos transaccionales vía Resend. |

---

## 2. Arquitectura del Sistema (Arquitectura Hexagonal — Ports & Adapters)

El sistema implementa de forma rigurosa la **Arquitectura Hexagonal (Puertos y Adaptadores)**, asegurando que las reglas del negocio permanezcan desacopladas de las tecnologías de interfaz, librerías externas y motores de persistencia.

```
                           ┌───────────────────────────────────────────────┐
                           │          CAPA DE PRESENTACIÓN (UI)            │
                           │   Next.js App Router (src/app / src/components)│
                           └──────────────────────┬────────────────────────┘
                                                  │ (invoca exclusivamente)
                                                  ▼
                           ┌───────────────────────────────────────────────┐
                           │             CAPA DE APLICACIÓN                │
                           │     Casos de Uso / Servicios Orquestadores    │
                           │            (src/application/services)         │
                           └──────────────┬──────────────────┬─────────────┘
                                          │                  │
               (consume e implementa)     │                  │ (depende de contratos)
                                          ▼                  ▼
┌───────────────────────────────────────────────┐   ┌───────────────────────────────────────────────┐
│            CAPA DE INFRAESTRUCTURA            │   │               CAPA DE DOMINIO                 │
│ Adaptadores, Repositorios Mocks / MySQL / API │──▶│   Modelos Puros y Puertos (Interfaces)        │
│             (src/infrastructure)              │   │                  (src/domain)                 │
└───────────────────────────────────────────────┘   └───────────────────────────────────────────────┘
```

### Estructura de las 4 Capas en `src/`

1. **Capa de Dominio (`src/domain/`):**
   - **Modelos Puros (`src/domain/models/`):** Define las entidades del negocio sin dependencias externas (`usuario.model.ts`, `nave.model.ts`, `comerciante.model.ts`, `asistencia.model.ts`, `auditoria.model.ts`).
   - **Puertos del Dominio (`src/domain/ports/`):** Contratos de interfaz que establecen las operaciones permitidas sobre los datos (`IUsuarioRepository`, `INaveRepository`, `IComercianteRepository`, `IAsistenciaRepository`, `IAuditoriaRepository`, `IImportadorRepository`).
2. **Capa de Aplicación (`src/application/services/`):**
   - Orquesta los flujos de negocio e interactúa exclusivamente a través de los puertos del dominio (`auth.service.ts`, `usuario.service.ts`, `nave.service.ts`, `comerciante.service.ts`, `asistencia.service.ts`, `auditoria.service.ts`, `importador.service.ts`). Ningún componente visual accede directamente a la persistencia.
3. **Capa de Infraestructura (`src/infrastructure/`):**
   - Implementa los adaptadores de los repositorios (`*.repository.impl.ts`), el contexto de sesión (`auth-context.tsx`), los motores heurísticos de importación y los almacenes reactivos en memoria (`mocks/`), listos para conectarse con la base de datos MySQL y los endpoints REST.
4. **Capa de Presentación (`src/app/` y `src/components/`):**
   - Interfaz gráfica basada en Next.js App Router con enfoque *Mobile-First*. Cada pantalla divide su complejidad en subcarpetas planas de componentes (`components/`) para maximizar el *Code Splitting* y la reutilización visual.

### Árbol de Directorios del Repositorio

```text
dev-epmma-hexagonal-gaot/
├── public/                               # Recursos estáticos (iconos, imágenes institucionales)
├── src/
│   ├── app/                              # Capa de Presentación (Rutas de Next.js App Router)
│   │   ├── (auth)/                       # Grupo de autenticación
│   │   │   ├── layout.tsx                # Layout limpio de autenticación
│   │   │   └── login/page.tsx            # Pantalla de inicio de sesión y recuperación
│   │   ├── (panel)/                      # Panel administrativo y operativo
│   │   │   ├── auditoria/                # Módulo de Control de Supervisores
│   │   │   │   ├── components/           # ModalDetalleControl, badges, exportador PDF
│   │   │   │   └── page.tsx              # Vista principal de auditoría
│   │   │   ├── catastro/                 # Módulo de Catastro de Comerciantes
│   │   │   │   ├── components/           # Modales de alta, edición y detalle
│   │   │   │   └── page.tsx              # Directorio con tabla estandarizada
│   │   │   ├── configuracion/            # Módulo de Configuración del Sistema
│   │   │   │   ├── usuarios/page.tsx     # Gestión de usuarios del sistema (RBAC)
│   │   │   │   └── page.tsx              # Menú de configuración y cambio de clave
│   │   │   ├── ingreso-catastro/         # Módulo de Importación Masiva y Conciliación
│   │   │   │   ├── components/           # Visor de discrepancias y tabla preview
│   │   │   │   └── page.tsx              # Drag & drop de archivos .xlsx/.csv/.xml
│   │   │   ├── listas/                   # Módulo de Toma de Listas y Asistencia
│   │   │   │   ├── components/           # TablaAsistencia, CroquisAsistenciaView, ModalNovedad
│   │   │   │   └── page.tsx              # Orquestador con 3 vistas y persistencia
│   │   │   ├── naves/                    # Módulo de Naves y Planificador Espacial
│   │   │   │   ├── components/           # PlanificadorEspacial, ModalConfigurarCelda, exportador PDF
│   │   │   │   └── page.tsx              # CRUD de naves y editor de croquis
│   │   │   ├── reportes/                 # Módulo de Reportes Operativos
│   │   │   │   ├── components/           # Generador de reportes PDF tabular
│   │   │   │   └── page.tsx              # Filtros y tabla con cabecera fija #e6efe9
│   │   │   └── layout.tsx                # Layout del panel (Sidebar desktop y Bottom Nav móvil)
│   │   ├── error.tsx                     # Manejador global de excepciones
│   │   ├── globals.css                   # Estilos globales y tokens de diseño Tailwind
│   │   └── layout.tsx                    # Layout raíz del sistema
│   ├── application/                      # Capa de Aplicación (Casos de Uso)
│   │   └── services/                     # Servicios desacoplados de asistencia, naves, auth, etc.
│   ├── components/                       # Componentes compartidos de UI
│   │   └── ui/                           # Primitivas accesibles (@base-ui/react, shadcn)
│   ├── domain/                           # Capa de Dominio (Modelos y Puertos Puros)
│   │   ├── models/                       # Entidades y tipos de dominio
│   │   └── ports/                        # Interfaces de repositorios (IAsistenciaRepository, etc.)
│   ├── infrastructure/                   # Capa de Infraestructura (Adaptadores y Mocks)
│   │   ├── auth/                         # AuthContext y proveedores de sesión
│   │   ├── mocks/                        # Almacén en memoria, parser heurístico y seeds
│   │   └── repositories/                 # Implementaciones concretas de los puertos
│   └── lib/                              # Utilidades transversales (cn, formatters)
├── AGENTS.md                             # Reglas maestras del asistente IA para EP-EMA
├── package.json                          # Manifiesto de dependencias y scripts del proyecto
├── pnpm-lock.yaml                        # Bloqueo determinista de dependencias
├── tsconfig.json                         # Configuración estricta de TypeScript
└── README.md                             # Documentación técnica oficial del proyecto
```

---

## 3. Stack Tecnológico Completo (100% Código Abierto)

### A. Stack Frontend (Implementado y Activo en Fase 1)

- **Framework Principal:** [Next.js](https://nextjs.org/) `16.3.2` (App Router) sobre [React](https://react.dev/) `19.2.8`.
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/) `5.x` con tipado estricto en todas las capas.
- **Diseño y Estilos:** [Tailwind CSS](https://tailwindcss.com/) `v4` con paleta institucional corporativa y variables CSS nativas.
- **Primitivas de Accesibilidad:** [@base-ui/react](https://base-ui.com/) y componentes adaptados de [shadcn/ui](https://ui.shadcn.com/).
- **Iconografía:** [Lucide React](https://lucide.dev/) `1.33.0`.
- **Notificaciones Reactivas:** [Sonner](https://sonner.emilkowal.ski/) `2.0.8`.
- **Manejo de Fechas y Localización:** [date-fns](https://date-fns.org/) `v4.4.0` con localización en español (`es`) y [react-day-picker](https://daypicker.dev/) `10.0.1`.
- **Generación Vectorial de PDFs:** [jsPDF](https://github.com/parallax/jsPDF) `4.2.1` con el complemento [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) `5.0.8`.
- **Procesamiento de Archivos:** [SheetJS (xlsx)](https://sheetjs.com/) `0.18.5` complementado con un motor heurístico para `.xlsx`, `.xls`, `.csv` y `.xml`.

### B. Stack Backend e Infraestructura (Delimitado y Planificado — Fase 2)

- **Arquitectura de API:** Endpoints REST nativos integrados en Next.js Route Handlers (`src/app/api/v1/...`).
- **Motor de Base de Datos:** **MySQL 8.0** (Open Source - GPL v2), contenedorizado en Docker para desarrollo y desplegado de forma nativa en producción.
- **Visualizador Administrativo Local:** **phpMyAdmin** en contenedor Docker (`http://localhost:8080`).
- **Mapeo Objeto-Relacional (ORM):** **Prisma ORM** (Open Source - Apache 2.0) para modelado de tipos, migraciones declarativas y transacciones ACID.
- **Autenticación y Seguridad de Sesión:** **JSON Web Tokens (JWT)** generados y validados mediante la librería abierta **`jose`** almacenados en Cookies seguras `HttpOnly`, `SameSite=Lax`.
- **Protección de Rutas (Server-Side):** `src/middleware.ts` en Next.js para interceptar peticiones hacia `/api/v1/*` y rutas del panel según roles.
- **Criptografía de Credenciales:** Hashing unidireccional con **`bcryptjs`** y factor de coste (salt rounds) institucional.
- **Servicio de Correo Transaccional:** Integración con **Resend** para notificaciones de cuenta y recuperación de contraseñas.

---

## 4. Módulos del Sistema y Funcionalidades Implementadas (Frontend)

### 4.1. Toma de Listas (`/listas`)
- **Marcación Rápida y Estado por Defecto:** Los puestos ocupados inician automáticamente en estado `"Presente"`. Con un solo toque, el supervisor puede alternar entre `"Presente"`, `"Ausente"` y `"Permiso"`.
- **Bloqueo Histórico en Fechas Pasadas:** Al seleccionar una fecha anterior a la actual, el sistema bloquea automáticamente la edición, permitiendo únicamente la consulta histórica de asistencias, permisos y novedades.
- **Persistencia Selectiva (`Registrar con Persistencia`):**
  - Permite arrastrar el pase de lista tomando como referencia el último día registrado (hasta 30 días hacia atrás).
  - Comerciantes modificados manualmente durante el día actual no son sobreescritos.
  - Permisos vigentes por rango de fechas se respetan rigurosamente.
  - Los puestos que estuvieron ausentes en la jornada de origen se asignan a `"Ausente"`, y los demás a `"Presente"`.
  - Cero arrastre de observaciones: las novedades del día anterior no contaminan la nueva jornada.
- **Tres Tipos de Novedades / Observaciones:**
  - `ObservacionesGeneral`: Anotaciones administrativas generales del puesto.
  - `Citaciones`: Citaciones con validación obligatoria de número de documento/referencia.
  - `Notificación`: Notificaciones formales con número de documento obligatorio.
- **Gestión Integral de Permisos:** Registro de permisos con fecha de inicio, fecha de fin y motivo, actualizando el estado de la asistencia dentro del rango establecido y alertando si existen solapamientos.
- **Conmutador Unificado de 3 Vistas con Preferencia por Usuario:**
  - Rotación secuencial mediante un único botón entre: **Vista Lista**, **Vista Cuadrícula (Treemap)** y **Vista Croquis**.
  - La **Vista Croquis** se habilita dinámicamente únicamente cuando la nave cuenta con el 100% de sus puestos ubicados en el plano espacial. En esta vista, los puestos reflejan su color de asistencia y las áreas de servicio (baños, parqueaderos, accesos) se presentan en gris neutro no interactivo.
  - La preferencia de vista se almacena de forma aislada por usuario (`ep_ema_view_mode_${user.id}`), garantizando que las preferencias de un operador no afecten a otros usuarios en el mismo terminal.

### 4.2. Gestión de Naves y Planificador Espacial Interactivo (`/naves`)
- **Catálogo de Naves y Control de Cupos:** Visualización tabular de naves indicando puestos ocupados frente a capacidad autorizada (`ocupados / cantidadPuestos`). Se valida que la capacidad no pueda reducirse por debajo de los puestos actualmente asignados.
- **Planificador Espacial (Croquis Vectorial):**
  - **Modo Ver vs. Modo Editar:** En modo *Ver*, se ocultan las coordenadas y las celdas vacías actúan como pasillos continuos limpios. En modo *Editar*, se despliegan guías de coordenadas, paleta de herramientas y funciones de arrastre.
  - **Candado de Capacidad Estricto:** Validación reactiva que impide colocar más celdas tipo `PUESTO` que el límite fijado en la nave.
  - **6 Herramientas de Modelado:** `PUESTO` (comercial), `VACIO` (pasillo), `PARQUEADERO`, `DELIMITACION` (accesos cardinales), `ANOTACION` y `BANO`.
  - **Puestos Modulares (`rowSpan` × `colSpan`):** Selector gráfico matricial para dimensionar puestos de gran tamaño, absorbiendo y limpiando automáticamente celdas solapadas.
  - **Reubicación Gráfica (Drag & Drop):** Traslado intuitivo de puestos arrastrando celdas en la cuadrícula, acotando bloques modulares a los límites del plano sin dejar celdas ocultas debajo.
  - **Aislamiento de Plantillas:** La `NAVE A` cuenta con una plantilla arquitectónica inicial de 16 filas × 12 columnas; las demás naves (`NAVE B` a `NAVE E`) inician con lienzo en blanco (12 × 12) para diagramación independiente.
  - **Exportación a PDF en 1 Hoja A4 Horizontal:** Generación de croquis vectorial con cálculo de *Bounding Box* que ajusta de forma exacta las celdas utilizadas a una única página horizontal con membrete institucional.

### 4.3. Control de Supervisores (`/auditoria`)
- **Monitoreo en Tiempo Real:** Supervisión de las tomas de lista ejecutadas, con filtros por texto, supervisor y rango de fechas con validación temporal.
- **Insignias Semánticas de Auditoría:**
  - `En Fecha`: Registro efectuado en tiempo oportuno.
  - `Con Persistencia`: Asistencia registrada mediante el arrastre transaccional de persistencia.
  - `Modificado tras Persistencia`: Registro corregido manualmente con posterioridad a la persistencia.
  - `Con Retraso`: Registro ejecutado fuera del horario operativo establecido.
- **Modal de Radiografía Operativa y Exportación:** Apertura de auditoría detallada con lista nominal de comerciantes, método de marcación, hora exacta y exportación a actas PDF (individual por sesión o consolidado por rango de fechas).

### 4.4. Reportes Operativos (`/reportes`)
- **Filtros Avanzados:** Filtrado por nave (restringido automáticamente para supervisores), buscador de contribuyentes/cédula/CIU y selectores de fecha de inicio y fin.
- **Modos "Incluir Observaciones" y "Solo Observaciones":**
  - Al activar *"Solo Observaciones"*, se listan exclusivamente los puestos con novedades, citaciones, notificaciones o permisos.
  - Cada observación se formatea con su salto de línea (`\n`), visualizándose en renglones independientes en la tabla y ajustándose automáticamente en las celdas del reporte PDF exportado.
- **Tabla Estandarizada:** Cabecera fija opaca en color `#e6efe9` con tipografía oscura, evitando transparencias durante el desplazamiento vertical y horizontal.

### 4.5. Catastro de Comerciantes (`/catastro`)
- **Directorio Nominal y Puestos:** Registro de comerciantes con Cédula, CIU, Contribuyente, Nave, Puesto y Giro/Actividad comercial.
- **Estandarización Visual:** Tabla de ancho y alto completo con scroll interno y cabecera fija `#e6efe9`.
- **Restricción RBAC para Supervisores:** Los supervisores tienen acceso de solo lectura en este módulo; se ocultan el botón de creación y la columna de acciones.

### 4.6. Ingreso de Catastro e Importación Masiva (`/ingreso-catastro`)
- **Recepción Multiformato:** Interfaz Drag & Drop compatible con archivos `.xlsx`, `.xls`, `.csv` y `.xml`.
- **Parser Heurístico Inteligente:** Algoritmo que filtra metadatos irrelevantes (páginas, encabezados, metros cuadrados), normaliza cédulas de 9 dígitos a 10 dígitos (anteponiendo el '0') y deduce códigos de puesto y nombres de nave.
- **Motor de Reconciliación Mensual:** Análisis predictivo previo a la importación que clasifica los registros en altas nuevas, modificaciones de datos, cambios de puesto y puestos liberados.

### 4.7. Autenticación y Configuración (`/login`, `/configuracion`, `/configuracion/usuarios`)
- **Autenticación con Validación de Complejidad:** Soporte de acceso por cédula o alias institucional. Obligatoriedad de cambio de contraseña en el primer acceso.
- **Flujo de Recuperación de Contraseña:** Modal para solicitar restablecimiento mediante usuario, cédula o correo electrónico, documentado y preparado para el envío de claves temporales mediante **Resend**.
- **Gestión de Usuarios (RBAC):** CRUD de cuentas de usuario exclusivo para `SUPERADMIN` y `TIC`, con captura de correo electrónico y asignación opcional de naves a supervisores con sincronización bidireccional.

---

## 5. Matriz de Control de Acceso Basado en Roles (RBAC) y Usuarios de Prueba

### Matriz de Accesos por Rol

| Módulo / Funcionalidad | SUPERADMIN | TIC | DIRECTOR | JEFE_OPERATIVO | SUPERVISOR |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Toma de Listas (`/listas`)** | Edición Total | Edición Total | Solo Lectura | Solo Lectura | Edición (Naves Asignadas) |
| **Planificador de Naves (`/naves`)** | Acceso Total | Acceso Total | Consulta y CRUD | Consulta y CRUD | ❌ Sin Acceso |
| **Auditoría de Supervisores (`/auditoria`)** | Acceso Total | Acceso Total | Acceso Total | Acceso Total | ❌ Sin Acceso |
| **Reportes Operativos (`/reportes`)** | Acceso Total | Acceso Total | Acceso Total | Acceso Total | Filtrado por Naves Asignadas |
| **Catastro de Comerciantes (`/catastro`)** | CRUD Total | CRUD Total | CRUD Total | CRUD Total | Solo Lectura (Sin Acciones) |
| **Ingreso de Catastro (`/ingreso-catastro`)** | Acceso Total | Acceso Total | Acceso Total | Acceso Total | Restringido a Naves Asignadas |
| **Gestión de Usuarios (`/configuracion/usuarios`)** | Acceso Total | Acceso Total | ❌ Sin Acceso | ❌ Sin Acceso | ❌ Sin Acceso |
| **Cambio de Contraseña Personal** | Sí | Sí | Sí | Sí | Sí |

> **Notas de Seguridad Operativa:**
> 1. El rol `TIC` cuenta con acceso total irrestricto a todos los módulos del sistema (incluyendo `/naves`), permitiéndole brindar soporte técnico integral y supervisión global.
> 2. Al crear o modificar un usuario con rol `SUPERVISOR`, la asignación de naves es **opcional**; si no se asignan naves de inmediato, el usuario podrá ser habilitado operativamente de forma posterior.

### Usuarios de Prueba (Entorno de Desarrollo)

Contraseña global para todos los perfiles de prueba: **`1500888985*admin`**

| Alias de Acceso | Cédula Registrada | Nombre Completo | Rol Asignado | Naves Asignadas |
| :--- | :--- | :--- | :--- | :--- |
| **`admin`** | `1801234567` | Administrador General EP-EMA | `SUPERADMIN` | Acceso Global |
| **`tic`** | `1801234568` | Carlos Medina Ruiz | `TIC` | Acceso Global |
| **`director`** | `1802345678` | Dra. Silvia Morales Vinueza | `DIRECTOR` | Acceso Global (Solo Lectura en Listas) |
| **`jefe`** | `1803456789` | Ing. Patricio Velasco Ortiz | `JEFE_OPERATIVO` | Acceso Global (Solo Lectura en Listas) |
| **`supervisor`** | `1804567890` | María Torres Guzmán | `SUPERVISOR` | NAVE A, NAVE B |

---

## 6. 🚧 Arquitectura Backend e Infraestructura de Datos (En Construcción)

Esta sección define las especificaciones técnicas y los contratos preparados para la ejecución de la **Fase 2 (Backend, MySQL y Servicios Transaccionales)**.

### 6.1. Contenedorización Local (`docker-compose.yml`) `[PENDIENTE DE IMPLEMENTACIÓN]`

Espacio reservado para el despliegue del entorno de base de datos relacional en desarrollo mediante Docker Compose:

- **Servicio `db`:** Imagen oficial `mysql:8.0` con volumen persistente en `./docker/mysql-data`, puerto mapeado `3306:3306`, conjunto de caracteres `utf8mb4` y cotejamiento `utf8mb4_unicode_ci`.
- **Servicio `phpmyadmin`:** Imagen oficial `phpmyadmin/phpmyadmin` enlazada al contenedor `db`, expuesta en el puerto `8080` (`http://localhost:8080`) para administración y depuración visual de tablas.

### 6.2. Variables de Entorno (`.env.example`) `[PENDIENTE DE IMPLEMENTACIÓN]`

Plantilla prevista para la configuración del entorno en raíz:

```env
# ── Entorno de Ejecución
NODE_ENV=development
PORT=3000

# ── Base de Datos Relacional (MySQL 8.0)
DATABASE_URL="mysql://epmma_user:epmma_secret_2026@localhost:3306/epmma_mercado"

# ── Autenticación y Criptografía (JWT con librería 'jose')
JWT_SECRET="epmma_jwt_super_secret_key_minimum_32_characters_long_2026"
JWT_EXPIRES_IN="8h"

# ── Servicio de Correo Transaccional (Resend)
RESEND_API_KEY="re_sample_key_for_epmma_notifications"
EMAIL_FROM="EP-EMA Notificaciones <no-reply@ep-ema.gob.ec>"
```

### 6.3. Esquema Relacional Prisma (`prisma/schema.prisma`) y Migraciones `[PENDIENTE DE IMPLEMENTACIÓN]`

Estructura de entidades relacionales que reemplazarán los almacenes en memoria actuales:
- `Usuario` (`id`, `cedula`, `nombres`, `apellidos`, `correo`, `passwordHash`, `rol`, `estado`, `mustChangePassword`, `creadoEn`).
- `Nave` (`id`, `nombre`, `cantidadPuestos`, `estadoRegistro`, `limitePuestos`).
- `NaveSupervisor` (`naveId`, `usuarioId` - Relación N:M).
- `Puesto` (`id`, `codigo`, `naveId`, `comercianteId`, `estado`).
- `PlanoNave` (`id`, `naveId`, `filas`, `columnas`, `actualizadoEn`).
- `CeldaPlano` (`id`, `planoId`, `fila`, `columna`, `tipo`, `codigoPuesto`, `rowSpan`, `colSpan`, `colorZona`, `texto`).
- `Comerciante` (`id`, `idInterno`, `ciu`, `cedula`, `contribuyente`, `actividad`, `estado`).
- `Asistencia` (`id`, `comercianteId`, `puestoId`, `fecha`, `estado`, `metodo`, `supervisorId`, `timestamp`).
- `ObservacionAsistencia` (`id`, `asistenciaId`, `tipo`, `texto`, `numeroDocumento`, `fechaHora`).
- `PermisoAsistencia` (`id`, `comercianteId`, `fechaAsignacion`, `fechaInicio`, `fechaFin`, `motivo`).
- `SesionControl` (`id`, `fechaJornada`, `timestampInicio`, `supervisorId`, `naveId`, `accion`, `resumenTotal`, `resumenPresentes`, `resumenAusentes`, `resumenPermisos`).

Comandos de ciclo de vida de base de datos planificados:
- `pnpm prisma generate`: Generación del cliente tipado de Prisma.
- `pnpm prisma migrate dev --name init`: Ejecución y versionamiento de migraciones SQL.
- `pnpm prisma db seed`: Poblado automatizado de tablas a partir de los datos maestros iniciales.

### 6.4. Seguridad Server-Side (`src/middleware.ts`, `jose` y `bcryptjs`) `[PENDIENTE DE IMPLEMENTACIÓN]`

Mecanismo planificado para protección en el servidor:
- **Generación de Token:** Al autenticarse en `/api/v1/auth/login`, se firma un JWT con `jose` conteniendo `{ sub, cedula, rol, navesAsignadas }`.
- **Cookies Seguras:** El token se almacena en una cookie `token` con flags `HttpOnly`, `Secure` (en producción), `SameSite=Lax` y expiración en 8 horas.
- **Middleware Global (`src/middleware.ts`):** Valida la firma del token en cada solicitud. Redirige a `/login` si la cookie es inexistente o inválida y bloquea con código HTTP `403 Forbidden` si el rol no tiene privilegios para la ruta o endpoint invocado.

### 6.5. Catálogo de Endpoints API REST (`/api/v1/*`) `[PENDIENTE DE IMPLEMENTACIÓN]`

Contratos de API REST planificados en Next.js Route Handlers:

| Método | Endpoint | Descripción | Roles Autorizados |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Autenticación de credenciales y expedición de cookie JWT | Público |
| `POST` | `/api/v1/auth/logout` | Revocación y eliminación de cookie de sesión | Autenticado |
| `POST` | `/api/v1/auth/forgot-password` | Solicitud de restablecimiento vía correo con Resend | Público |
| `POST` | `/api/v1/auth/change-password` | Cambio de contraseña obligatoria o personal | Autenticado |
| `GET` | `/api/v1/usuarios` | Listado general de usuarios | `SUPERADMIN`, `TIC` |
| `POST` | `/api/v1/usuarios` | Creación de usuario y sincronización de supervisores | `SUPERADMIN`, `TIC` |
| `PUT` | `/api/v1/usuarios/:id` | Modificación de datos y roles de usuario | `SUPERADMIN`, `TIC` |
| `GET` | `/api/v1/naves` | Listado de naves con cupos y supervisores | Todos los roles |
| `POST` | `/api/v1/naves` | Creación de nave comercial | `SUPERADMIN`, `TIC`, `DIRECTOR`, `JEFE_OPERATIVO` |
| `GET` | `/api/v1/naves/:id/plano` | Obtención de matriz de celdas del plano espacial | Todos los roles |
| `PUT` | `/api/v1/naves/:id/plano` | Guardado de celdas con candado de capacidad | `SUPERADMIN`, `TIC`, `DIRECTOR`, `JEFE_OPERATIVO` |
| `GET` | `/api/v1/comerciantes` | Catastro de comerciantes filtrado por nave | Todos los roles |
| `POST` | `/api/v1/catastro/reconciliar` | Previsualización y cálculo de diferencias de importación | `SUPERADMIN`, `TIC`, `DIRECTOR`, `JEFE_OPERATIVO`, `SUPERVISOR` |
| `POST` | `/api/v1/catastro/importar` | Confirmación e inserción de la conciliación mensual | `SUPERADMIN`, `TIC`, `DIRECTOR`, `JEFE_OPERATIVO`, `SUPERVISOR` |
| `GET` | `/api/v1/asistencia` | Consulta de asistencias por fecha y nave | Todos los roles |
| `POST` | `/api/v1/asistencia/marcar` | Marcación atómica de estado (`Presente`, `Ausente`) | `SUPERADMIN`, `TIC`, `SUPERVISOR` |
| `POST` | `/api/v1/asistencia/persistencia` | Ejecución transaccional de persistencia selectiva | `SUPERADMIN`, `TIC`, `SUPERVISOR` |
| `POST` | `/api/v1/asistencia/novedad` | Inserción de Observación, Citación o Notificación | `SUPERADMIN`, `TIC`, `SUPERVISOR` |
| `POST` | `/api/v1/asistencia/permiso` | Asignación de permiso por rango de fechas | `SUPERADMIN`, `TIC`, `SUPERVISOR` |
| `GET` | `/api/v1/auditoria/sesiones` | Consulta de sesiones de control con filtros y badges | `SUPERADMIN`, `TIC`, `DIRECTOR`, `JEFE_OPERATIVO` |

---

## 7. Comandos de Instalación, Ejecución y Calidad

### Comandos de Desarrollo Actuales (Frontend Activo)

El proyecto utiliza **`pnpm`** como gestor de paquetes de alto rendimiento:

```bash
# Instalación limpia de dependencias
pnpm install

# Iniciar servidor de desarrollo local con recarga en caliente
pnpm dev

# Verificación estática de tipos en TypeScript (0 errores tolerados)
npx tsc --noEmit

# Ejecución del linter institucional ESLint (0 advertencias toleradas)
pnpm lint

# Compilación y empaquetado para producción
pnpm build

# Ejecución del servidor compilado en producción
pnpm start
```

### Comandos Planificados para la Fase 2 (Docker & Prisma) `[PENDIENTE DE IMPLEMENTACIÓN]`

```bash
# ── Gestión de Contenedores de Base de Datos
docker compose up -d                 # Iniciar MySQL 8.0 y phpMyAdmin en segundo plano
docker compose down                  # Detener contenedores sin borrar volumen de datos
docker compose ps                    # Verificar estado de los servicios (puertos 3306 y 8080)

# ── Gestión del ORM Prisma
pnpm prisma generate                 # Generar cliente TypeScript de Prisma
pnpm prisma migrate dev              # Crear y aplicar migraciones en base de datos
pnpm prisma db seed                  # Cargar semillas maestras iniciales
pnpm prisma studio                   # Abrir interfaz gráfica alternativa de Prisma
```

---

## 8. Licencia y Derechos Institucionales

Este proyecto ha sido desarrollado exclusivamente para la **Empresa Pública – Empresa Municipal Mercado Mayorista de Ambato (EP-EMA)**.  
Todos los derechos reservados © 2026 EP-EMA. Prohibida su copia, distribución o reproducción no autorizada.
