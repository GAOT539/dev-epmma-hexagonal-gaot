# EP-EMA — Sistema de Gestión Operativa, Catastro y Control de Asistencia

> **Empresa Pública – Empresa Municipal Mercado Mayorista de Ambato (EP-EMA)**  
> Plataforma tecnológica institucional para la administración integral de naves comerciales, catastro de comerciantes, planificación espacial mediante croquis modulares, control diario de asistencias con persistencia selectiva, auditoría operativa en tiempo real y persistencia relacional transaccional en MySQL 8.0.

---

## 1. Encabezado e Identidad del Proyecto

El **Sistema de Gestión EP-EMA** es una solución digital integral de grado empresarial diseñada para modernizar, automatizar y transparentar la operación diaria del Mercado Mayorista de Ambato. El sistema unifica la toma de listas en campo, la supervisión de jornales, la administración del catastro comercial, la delimitación arquitectónica del espacio físico de las naves y la auditoría operativa continua bajo un esquema de alta concurrencia y máxima tolerancia a fallos.

### Estado Actual del Proyecto

| Fase del Proyecto | Estado | Madurez | Descripción |
| :--- | :---: | :---: | :--- |
| **Fase 1: Frontend & Simulación Operativa en Memoria** | **Completado y Auditado** | **100%** | Interfaz de usuario completa, responsiva (*Mobile-First*), modularizada bajo Arquitectura Hexagonal estricta. Validada con 0 errores TypeScript y 0 advertencias ESLint. Implementa persistencia selectiva en memoria, planificador espacial vectorial y exportación de reportes PDF. |
| **Fase 2: Backend API REST, Base de Datos MySQL y Servicios Transaccionales** | **Completado, Optimizado y Auditado** | **100%** | Arquitectura backend robusta desacoplada mediante Next.js Route Handlers (`/api/v1/*`), base de datos relacional MySQL 8.0 nativa y contenedorizada con Docker, Prisma ORM 6.19.3, autenticación perimetral mediante cookies `HttpOnly` y JWT con `jose`, cifrado criptográfico `bcryptjs`, servicio transaccional de correo con Gmail SMTP (Nodemailer), motor de reconciliación catastral mensual en 4 pasos y servicio de auto-asistencia diaria a las 02:00 AM (Ecuador). |
| **Fase 3: Auditoría de Ciberseguridad, RBAC Multi-Tenant y Optimización de Concurrencia (14+ Usuarios)** | **Completado y Verificado** | **100%** | Blindaje de seguridad en `src/middleware.ts` y capa de autorización multi-tenant por naves asignadas para rol SUPERVISOR. Mitigación contra ataques IDOR en cambio de contraseñas, no exposición de credenciales temporales en respuestas HTTP, generador CSPRNG de contraseñas seguras con Fisher-Yates, optimización de concurrencia mediante Fast-Path (60s), Single-Flight Lock (0 ms), cliente singleton global de Prisma y soporte nativo de colación en español (`utf8mb4_spanish_ci`) para la coexistencia de `NAVE Ñ` y `NAVE N`. |

---

## 2. Arquitectura del Sistema (Arquitectura Hexagonal — Ports & Adapters)

El sistema implementa de forma rigurosa la **Arquitectura Hexagonal (Puertos y Adaptadores)**, asegurando que las reglas del negocio permanezcan 100% desacopladas de las tecnologías de interfaz gráfica, librerías auxiliares y motores de base de datos relacional.

```text
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
│ Adaptadores Repositorios MySQL 8.0 / Prisma   │──▶│   Modelos Puros y Puertos (Interfaces)        │
│ API REST (/api/v1/*) / Parsers / Criptografía │   │                  (src/domain)                 │
│             (src/infrastructure)              │   │                                               │
└───────────────────────────────────────────────┘   └───────────────────────────────────────────────┘
```

### Estructura de las 4 Capas en `src/`

1. **Capa de Dominio (`src/domain/`):**
   - **Modelos Puros (`src/domain/models/`):** Entidades y tipos esenciales del negocio libres de dependencias de infraestructura (`usuario.model.ts`, `nave.model.ts`, `comerciante.model.ts`, `asistencia.model.ts`, `auditoria.model.ts`).
   - **Puertos del Dominio (`src/domain/ports/`):** Contratos de interfaz independientes que norman el acceso y persistencia (`IUsuarioRepository`, `INaveRepository`, `IComercianteRepository`, `IAsistenciaRepository`, `IAuditoriaRepository`, `IImportadorRepository`).
2. **Capa de Aplicación (`src/application/services/`):**
   - Casos de uso institucionales que orquestan el flujo de datos (`auth.service.ts`, `usuario.service.ts`, `nave.service.ts`, `comerciante.service.ts`, `asistencia.service.ts`, `auditoria.service.ts`, `importador.service.ts`). La interfaz visual no interactúa jamás directamente con la base de datos ni con las APIs de bajo nivel.
3. **Capa de Infraestructura (`src/infrastructure/`):**
   - **100% Desconectada de Mocks y Conectada a Base de Datos Real:** Las operaciones de producción son ejecutadas por los adaptadores relacionales (`*.repository.impl.ts`) que consumen las API Routes REST (`/api/v1/*`), respaldadas por Prisma ORM sobre MySQL 8.0.
   - Provee la gestión de sesiones seguras (`auth/`), utilidades criptográficas, servicios transaccionales de reconciliación en base de datos (`database/`), parsers heurísticos multiformato (`parsers/`) y cliente de correos (`mail/`).
4. **Capa de Presentación (`src/app/` y `src/components/`):**
   - Vistas optimizadas en Next.js App Router con enfoque integral *Mobile-First*, subcomponentes desacoplados, estilos Tailwind CSS institucionales y accesibilidad garantizada.

### Árbol de Directorios del Repositorio

```text
dev-epmma-hexagonal-gaot/
├── docker-compose.yml                     # Contenedores MySQL 8.0 (3307:3306) y phpMyAdmin (8080)
├── prisma/
│   ├── schema.prisma                     # Esquema relacional de 7 modelos con índices de alto rendimiento
│   └── seed.ts                           # Sembrado maestro limpio de producción (SUPERADMIN y NAVE A)
├── public/                               # Activos institucionales estáticos (logos, isotipos, favicon)
├── src/
│   ├── instrumentation.ts                # Hook de arranque del servidor (colación MySQL y asistencia 2 AM)
│   ├── middleware.ts                     # Seguridad perimetral, verificación JWT y RBAC de API Routes
│   ├── app/                              # Capa de Presentación y Route Handlers Backend
│   │   ├── (auth)/                       # Módulo de Autenticación
│   │   │   ├── layout.tsx                # Layout limpio institucional
│   │   │   └── login/page.tsx            # Pantalla de acceso y recuperación de contraseñas
│   │   ├── (panel)/                      # Módulos del Panel Administrativo y Operativo
│   │   │   ├── auditoria/                # Auditoría de Sesiones y Control de Supervisores
│   │   │   ├── catastro/                 # Directorio Nominal y Catastro de Comerciantes
│   │   │   ├── configuracion/            # Configuración General y Gestión de Usuarios (RBAC)
│   │   │   ├── ingreso-catastro/         # Importador Multiformato y Reconciliación Mensual
│   │   │   ├── listas/                   # Toma de Listas y Asistencia Diaria
│   │   │   ├── naves/                    # Planificador Espacial y Gestión de Puestos
│   │   │   ├── reportes/                 # Reportes Operativos Tabulares y Descarga PDF
│   │   │   └── layout.tsx                # Shell del panel con Sidebar y Bottom Navigation
│   │   ├── api/                          # Endpoints REST Backend (Next.js Route Handlers)
│   │   │   └── v1/
│   │   │       ├── asistencia/           # Consulta, marcación diaria, persistencia, novedades y permisos
│   │   │       │   ├── route.ts          # GET (consulta) y POST (marcación de asistencia)
│   │   │       │   ├── observaciones/    # POST y DELETE de observaciones, citaciones y notificaciones
│   │   │       │   ├── permisos/         # POST y DELETE de permisos por rango de fechas
│   │   │       │   └── persistencia/     # POST de persistencia selectiva transaccional
│   │   │       ├── auditoria/
│   │   │       │   └── sesiones/         # GET de sesiones de control con filtros y badges
│   │   │       ├── auth/                 # Ciclo de vida de autenticación y credenciales
│   │   │       │   ├── change-password/  # POST cambio de contraseña (anti-IDOR y primer login)
│   │   │       │   ├── forgot-password/  # POST generación CSPRNG y envío por correo Gmail SMTP
│   │   │       │   ├── login/            # POST autenticación y expedición de Cookie JWT
│   │   │       │   ├── logout/           # POST revocación de Cookie HttpOnly
│   │   │       │   └── me/               # GET perfil y sesión del usuario activo
│   │   │       ├── catastro/             # Motor transaccional de importación catastral
│   │   │       │   ├── importar/         # POST confirmación e inserción por lotes en BD
│   │   │       │   └── simular/          # POST previsualización y cálculo de diferencias en 4 pasos
│   │   │       ├── comerciantes/         # CRUD de comerciantes y asignaciones
│   │   │       │   ├── route.ts          # GET listado y POST alta de comerciante
│   │   │       │   └── [id]/             # GET detalle, PUT actualización y DELETE baja lógica
│   │   │       ├── naves/                # Catálogo de naves, planos y puestos
│   │   │       │   ├── route.ts          # GET catálogo y POST creación de nave
│   │   │       │   └── [id]/
│   │   │       │       ├── route.ts      # GET detalle, PUT modificación y DELETE baja de nave
│   │   │       │       ├── plano/        # GET y PUT de matriz espacial (planoJson)
│   │   │       │       └── puestos/      # PUT sincronización atómica y renombre de puestos
│   │   │       └── usuarios/             # Gestión institucional de cuentas (RBAC)
│   │   │           ├── route.ts          # GET directorio y POST registro de usuarios
│   │   │           └── [id]/
│   │   │               ├── route.ts      # GET detalle, PUT actualización y DELETE baja
│   │   │               └── reset-password/# POST reseteo institucional a contraseña inicial ${cedula}*
│   │   ├── error.tsx                     # Manejador de excepciones no controladas
│   │   ├── globals.css                   # Sistema de diseño Tailwind CSS y paleta corporativa
│   │   └── layout.tsx                    # Layout raíz del sistema
│   ├── application/                      # Capa de Aplicación (Casos de Uso)
│   │   └── services/                     # Servicios desacoplados (auth, asistencia, naves, etc.)
│   ├── components/                       # Componentes compartidos de Interfaz de Usuario
│   │   └── ui/                           # Primitivas accesibles (@base-ui/react, shadcn)
│   ├── domain/                           # Capa de Dominio (Modelos Puros y Contratos)
│   │   ├── models/                       # Entidades y tipos de negocio puros
│   │   └── ports/                        # Interfaces de repositorios (IAsistenciaRepository, etc.)
│   ├── infrastructure/                   # Capa de Infraestructura (Adaptadores y Servicios)
│   │   ├── auth/                         # Autenticación, JWT, hashing, CSPRNG y autorización
│   │   │   ├── auth-context.tsx          # Proveedor reactivo de contexto de autenticación
│   │   │   ├── authorization.ts          # Verificación multi-tenant y aislamiento por naves
│   │   │   ├── jwt.utils.ts              # Firma y decodificación de tokens con 'jose'
│   │   │   ├── password.utils.ts         # Hashing bcryptjs y generador seguro CSPRNG Fisher-Yates
│   │   │   └── password-policy.utils.ts  # Reglas de complejidad institucional de contraseñas
│   │   ├── database/                     # Persistencia MySQL 8.0 y servicios de base de datos
│   │   │   ├── prisma.ts                 # Cliente singleton global de Prisma ORM
│   │   │   ├── catastro-reconciliacion.service.ts # Algoritmo de conciliación en 4 pasos
│   │   │   ├── daily-attendance.service.ts # Servicio diario de asistencia 02:00 AM y locks
│   │   │   └── nave-puestos-sync.service.ts # Sincronización de puestos y colación en español
│   │   ├── mail/                         # Notificaciones transaccionales
│   │   │   └── smtp.service.ts           # Servicio de correo institucional Gmail SMTP con Nodemailer
│   │   ├── parsers/                      # Parsers heurísticos de archivos
│   │   │   └── catastro-file.parser.ts   # Motor de análisis para .xlsx, .xls, .csv y .xml
│   │   └── repositories/                 # 6 Adaptadores concretos de repositorios
│   │       ├── asistencia.repository.impl.ts
│   │       ├── auditoria.repository.impl.ts
│   │       ├── comerciante.repository.impl.ts
│   │       ├── importador.repository.impl.ts
│   │       ├── nave.repository.impl.ts
│   │       └── usuario.repository.impl.ts
│   └── lib/                              # Utilidades transversales (formatters, classnames)
├── AGENTS.md                             # Reglas maestras del asistente IA para EP-EMA
├── package.json                          # Manifiesto de dependencias y scripts oficiales
├── pnpm-lock.yaml                        # Bloqueo estricto y determinista de dependencias
├── tsconfig.json                         # Configuración rigurosa de TypeScript 5
└── README.md                             # Documentación técnica maestra del proyecto
```

---

## 3. Stack Tecnológico Completo (100% Código Abierto)

### A. Stack Frontend (Implementado y Activo en Fase 1)

- **Framework Principal:** [Next.js](https://nextjs.org/) `16.3.2` (App Router) sobre [React](https://react.dev/) `19.2.8`.
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/) `5.x` con tipado riguroso en todas las capas del sistema.
- **Diseño y Estilos:** [Tailwind CSS](https://tailwindcss.com/) `v4` con paleta institucional corporativa y variables CSS nativas.
- **Primitivas de Accesibilidad:** [@base-ui/react](https://base-ui.com/) `1.7.0` y componentes adaptados de [shadcn/ui](https://ui.shadcn.com/) `4.19.0`.
- **Iconografía:** [Lucide React](https://lucide.dev/) `1.33.0`.
- **Notificaciones Reactivas:** [Sonner](https://sonner.emilkowal.ski/) `2.0.8`.
- **Manejo de Fechas y Localización:** [date-fns](https://date-fns.org/) `4.4.0` con localización en español (`es`) y [react-day-picker](https://daypicker.dev/) `10.0.1`.
- **Generación Vectorial de PDFs:** [jsPDF](https://github.com/parallax/jsPDF) `4.2.1` complementado con [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) `5.0.8`.
- **Procesamiento de Archivos:** [SheetJS (xlsx)](https://sheetjs.com/) `0.18.5` integrado a motor heurístico institucional.

### B. Stack Backend, Persistencia y Seguridad (Implementado y Activo — Fase 2)

- **Arquitectura de API:** Endpoints REST nativos integrados en Next.js Route Handlers (`src/app/api/v1/*`).
- **Motor de Base de Datos:** **MySQL 8.0** relacional, configurado con cotejamiento en español (`utf8mb4_spanish_ci`), expuesto en el puerto `3307:3306` vía Docker para desarrollo y listo para despliegue nativo en producción.
- **Visualizador Administrativo:** **phpMyAdmin** en contenedor Docker (`http://localhost:8080`) enlazado a la red interna de base de datos.
- **Mapeo Objeto-Relacional (ORM):** **Prisma ORM** (`@prisma/client` y `prisma` `6.19.3`) para modelado relacional, tipado estricto, migraciones SQL e índices compuestos.
- **Autenticación y Criptografía de Sesión:** **JSON Web Tokens (JWT)** firmados y verificados con la librería abierta **`jose`** `6.2.12`, transportados mediante cookies estrictamente seguras con banderas `HttpOnly`, `SameSite=Lax` y expiración en 8 horas.
- **Criptografía de Credenciales:** Hashing unidireccional con **`bcryptjs`** `3.0.3` con factor de coste de 10 rondas de salado.
- **Generador Criptográfico Seguro:** Generación de contraseñas temporales aleatorias de 16 caracteres mediante CSPRNG nativo (`crypto.randomInt`) con algoritmo de barajado Fisher-Yates.
- **Servicio de Correo Transaccional:** Notificaciones de credenciales y restablecimiento de contraseñas mediante **Nodemailer** vía **Gmail SMTP**.
- **Ejecución y Sembrado TypeScript:** **`tsx`** `4.23.15` para la ejecución nativa de semillas y scripts de base de datos (`prisma/seed.ts`).

---

## 4. Módulos del Sistema y Funcionalidades Implementadas

### 4.1. Toma de Listas (`/listas`)

- **Marcación Rápida y Estado por Defecto:** Los puestos ocupados inician automáticamente en estado `"Presente"`. Con un solo toque, el supervisor puede alternar secuencialmente entre `"Presente"`, `"Ausente"` y `"Permiso"`.
- **Bloqueo Histórico en Fechas Pasadas:** Al seleccionar una fecha anterior a la actual, el sistema bloquea automáticamente la edición, permitiendo únicamente la consulta histórica de asistencias, permisos y novedades sin riesgo de alteración retroactiva.
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
- **Independencia Arquitectónica entre Puesto Físico y Contribuyente en el Croquis:**
  - En la diagramación espacial, las celdas de tipo `PUESTO` representan la infraestructura fija del mercado y muestran su **código completo sin truncamiento (`...`)**, completamente limpios de nombres, cédulas o giros comerciales del contribuyente.
  - La relación entre el comerciante y el puesto es dinámica y desacoplada, preservando la inmutabilidad de la cuadrícula física ante rotaciones o sustituciones de comerciantes.
- **Modal Interactivo "Gestión de Puestos" (`ModalPuestosNave.tsx`):**
  - Permite visualizar la totalidad de puestos de la nave, su estado (`Ocupado` o `Vacante`), el comerciante asignado y renombrar códigos de puestos de forma individual o masiva por lotes.
  - Al renombrar un código de puesto (por ejemplo de `01` a `BODEGA N-A-01`), el sistema ejecuta una **sincronización atómica triple** en base de datos:
    1. Actualiza el registro en la tabla `puestos` (`codigo`).
    2. Actualiza la referencia del comerciante vinculado en `comerciantes.puestoId`.
    3. Reemplaza el identificador en la matriz espacial JSON del croquis (`planos_naves.planoJson`), garantizando total coherencia visual y relacional.
- **Planificador Espacial (Croquis Vectorial):**
  - **Modo Ver vs. Modo Editar:** En modo *Ver*, se ocultan las coordenadas y las celdas vacías actúan como pasillos continuos limpios. En modo *Editar*, se despliegan guías de coordenadas, paleta de herramientas y funciones de arrastre.
  - **Candado de Capacidad Estricto:** Validación reactiva que impide colocar más celdas tipo `PUESTO` que el límite fijado en la nave.
  - **6 Herramientas de Modelado:** `PUESTO` (comercial), `VACIO` (pasillo), `PARQUEADERO`, `DELIMITACION` (accesos cardinales), `ANOTACION` y `BANO`.
  - **Puestos Modulares (`rowSpan` × `colSpan`):** Selector gráfico matricial para dimensionar puestos de gran tamaño, absorbiendo y limpiando automáticamente celdas solapadas.
  - **Reubicación Gráfica (Drag & Drop):** Traslado intuitivo de puestos arrastrando celdas en la cuadrícula, acotando bloques modulares a los límites del plano sin dejar celdas ocultas debajo.
  - **Aislamiento de Plantillas:** La `NAVE A` cuenta con una plantilla arquitectónica inicial de 12 filas × 12 columnas; las demás naves (`NAVE B` a `NAVE E`) inician con lienzo en blanco para diagramación independiente.
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

El motor de importación y reconciliación catastral implementa capacidades analíticas avanzadas para procesar de forma automatizada los archivos emitidos por los sistemas de rentas y catastro institucional:

- **Carga Múltiple de Archivos Simultáneos:** Interfaz interactiva Drag & Drop compatible con lotes de archivos en formatos `.xlsx`, `.xls`, `.csv` y `.xml`.
- **Soporte para Reportes Separados de Bodegas/Locales (`REN04_950`) y Puestos Numéricos (`ren04278`):**
  - Cuando un archivo corresponde exclusivamente a bodegas o locales y coincide con una nave que posee puestos fijos (o viceversa), el sistema despliega un **Selector Interactivo de Modo**:
    1. **Unificar en la misma nave:** Mantiene bodegas y puestos en la misma entidad de nave sin sobreescribir ni pasar a vacante la sección complementaria.
    2. **Separar como nave independiente:** Permite crear una nueva nave especializada (ej. `NAVE A - BODEGAS`) preservando la independencia operativa.
- **Desglose Automático de Celdas Multi-Puesto con Guion:**
  - Celdas que agrupan códigos puramente numéricos como `024-027`, `039-040` o `058-063` son detectadas y desglosadas automáticamente en puestos físicos individuales (`024` y `027`), asignando ambos registros al mismo contribuyente sin colisiones de unicidad.
  - **Protección de Códigos Estructurados:** Códigos institucionales que incluyen guiones como prefijos o sufijos de nave (tales como `N-A-10`, `BODEGA N-A-01`, `N-02A-H`, `ZCF-01`) son blindados íntegramente y tratados como un único puesto físico.
- **Diferenciación Estricta de Sufijos Alfanuméricos:**
  - El comparador heurístico separa de forma estricta el número base del sufijo alfanumérico. Códigos como `N-A-01` y `N-A-01A`, o `060` y `060A`, son reconocidos como puestos físicos 100% independientes, impidiendo fusiones erróneas.
- **Algoritmo de Reconciliación Mensual en 4 Pasos (Inmutabilidad de Puestos):**
  - **Paso 1 (Emparejamiento de Contribuyentes Existentes):**
    - *Subpaso 1A (Mismo Puesto):* Identifica al comerciante por nombre completo normalizado o cédula que permanece en el mismo puesto. Detecta variaciones en giro comercial o CIU y genera una novedad de tipo `ACTUALIZACION`.
    - *Subpaso 1B (Cambio de Puesto):* Detecta si un comerciante ya registrado se mudó a otro puesto dentro de la misma nave, registrando el cambio como `CAMBIO_PUESTO`.
  - **Paso 2 (Nuevos Contribuyentes y Reemplazos):**
    - *Subpaso 2A (Reemplazo en Puesto Existente):* Si un puesto físico ya existía pero ahora lo ocupa una persona distinta, se registra como `REEMPLAZO_OCUPANTE`, liberando al titular saliente y asociando al nuevo comerciante.
    - *Subpaso 2B (Asignación a Vacantes):* Asigna contribuyentes nuevos a puestos vacantes disponibles en la sección correspondiente.
    - *Subpaso 2C (Expansión Dinámica de Puestos):* Si el archivo contiene más registros que los puestos actualmente registrados, se agregan como puestos nuevos incrementando dinámicamente la capacidad real de la nave, sin imponer límites artificiales fijos.
  - **Paso 3 (Puestos que Pasan a Vacante):**
    - Puestos físicos cuyo contribuyente ya no figura en el archivo entrante y no recibieron reemplazo pasan automáticamente al estado `"Vacante"`, manteniendo intacta su existencia física y su posición en el plano espacial de `/naves`.
  - **Paso 4 (Conteo Real de Capacidad):**
    - Calcula la capacidad total sumando exclusivamente los puestos reales ocupados y vacantes, erradicando números predeterminados artificiales.
- **Panel "NAVE NO ENCONTRADA — SELECCIONE MANUAL":**
  - Si el parser no logra deducir una coincidencia unívoca con las naves registradas en el sistema, se despliega un panel de advertencia con dos opciones inmediatas:
    - **Opción 1:** Seleccionar manualmente una nave existente desde un menú desplegable para ejecutar la reconciliación sobre sus puestos.
    - **Opción 2:** Escribir el nombre deseado y pulsar **"Crear Nueva Nave"**, instanciando la nave y sus puestos de forma inmediata en la base de datos.

### 4.7. Autenticación y Configuración (`/login`, `/configuracion`, `/configuracion/usuarios`)

- **Autenticación con Validación de Complejidad:** Acceso mediante cédula o alias institucional (`admin`, `tic`).
- **Ciclo de Vida de Primer Ingreso:** Las cuentas creadas con contraseña temporal poseen la bandera `mustChangePassword: true`, lo que dispara un modal ineludible en el primer inicio de sesión exigiendo establecer una clave personal segura.
- **Gestión de Cuentas (RBAC):** Módulo exclusivo para `SUPERADMIN` y `TIC` con alta de usuarios, asignación opcional de naves a supervisores, edición de datos personales y restablecimiento administrativo de contraseñas.

---

## 5. Matriz de Control de Acceso Basado en Roles (RBAC) y Credenciales de Producción

### Matriz Oficial de Permisos por Rol

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
> 3. Los usuarios con rol `SUPERVISOR` son aislados estrictamente a sus naves tanto en la interfaz de usuario como en las API Routes backend (`authorization.ts`).

### Credenciales y Datos Maestros Iniciales de Producción (`npx prisma db seed`)

El script oficial de inicialización (`prisma/seed.ts`) siembra un entorno de producción limpio, determinista e idempotente con los siguientes datos reales:

1. **Usuario Maestro Único (`SUPERADMIN`):**
   - **Alias de Acceso / Cédula:** `admin`
   - **Contraseña Inicial de Producción:** `1500888985*admin`
   - **Nombre:** Administrador Sistema
   - **Correo Electrónico:** `admin@ep-ema.gob.ec`
   - **Bandera `mustChangePassword`:** `false`
2. **Infraestructura Real Inicial de `NAVE A`:**
   - **Capacidad Autorizada:** 33 puestos físicos.
   - **Puestos Físicos y Comerciantes Vinculados:** 33 puestos con sus códigos reales de catastro institucional divididos en sus categorías operativas:
     - 13 Bodegas: `BODEGA N-A-01` a `BODEGA N-A-12` (incluyendo `BODEGA N-A-07A`).
     - 14 Cubículos: `CUBICULO N-A-01` a `CUBICULO N-A-15` (actividades de alimentos preparados, jugos y hornado).
     - 6 Núcleos: `NUCLEO N-A-0`, `NUCLEO N-A-001`, `NUCLEO N-A-002`, `NUCLEO N-A-003`, `N-A-04` y `NUCLEO N-A-08`.
   - **Plano Espacial Vectorial:** Croquis matricial de 12 filas × 12 columnas con celdas de puestos modulares dimensionadas y ubicadas exactamente según el diseño institucional.
   - **Asistencia Inicial del Día:** Todos los 33 puestos ocupados inicializados en estado `"Presente"` para la fecha actual de Ecuador.

### Ciclo de Vida de Credenciales y Seguridad de Usuarios

- **Creación de Nuevos Usuarios (`/configuracion/usuarios`):**
  - Al dar de alta un usuario desde el panel administrativo, el sistema asigna como contraseña temporal inicial `${cedula}*`.
  - Se activa automáticamente la bandera `mustChangePassword: true`. En su primer login, el usuario es interceptado por un modal obligatorio que le impide navegar hasta establecer una nueva contraseña de al menos 8 caracteres con mayúsculas, números y caracteres especiales.
- **Restablecimiento Administrativo de Contraseña (`/api/v1/usuarios/[id]/reset-password`):**
  - El administrador puede resetear la clave del colaborador a `${cedula}*`, restableciendo `mustChangePassword = true`.
- **Recuperación Autónoma con Envío de Correo (`/api/v1/auth/forgot-password`):**
  - Genera una contraseña temporal aleatoria de 16 caracteres de alta entropía utilizando un generador pseudoaleatorio criptográficamente seguro (CSPRNG vía `crypto.randomInt`) con algoritmo de barajado Fisher-Yates, garantizando caracteres en todos los subconjuntos exigidos.
  - La clave se hashea en base de datos y se transmite de forma cifrada al correo registrado del usuario mediante **Gmail SMTP (Nodemailer)**. La contraseña en texto plano **jamás se devuelve en la respuesta HTTP**.

---

## 6. Arquitectura Backend, Persistencia Relacional y Ciberseguridad

Esta sección documenta la implementación real, optimizada y verificada de la arquitectura backend, los servicios de base de datos MySQL y los mecanismos de protección perimetral y concurrencia.

### 6.1. Contenedorización Local (`docker-compose.yml`)

El proyecto cuenta con un entorno de servicios relacionales orquestado mediante Docker Compose:

```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: ep_ema_mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ep_ema_root_pass
      MYSQL_DATABASE: ep_ema_db
      MYSQL_USER: ep_ema_user
      MYSQL_PASSWORD: ep_ema_pass
    ports:
      - "3307:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    command: --default-authentication-plugin=mysql_native_password --character-set-server=utf8mb4 --collation-server=utf8mb4_spanish_ci

  phpmyadmin:
    image: phpmyadmin:latest
    container_name: ep_ema_phpmyadmin
    restart: always
    environment:
      PMA_HOST: mysql
      PMA_PORT: 3306
      PMA_USER: ep_ema_user
      PMA_PASSWORD: ep_ema_pass
      UPLOAD_LIMIT: 64M
    ports:
      - "8080:80"
    depends_on:
      - mysql

volumes:
  mysql_data:
    driver: local
```

- **Servicio `ep_ema_mysql`:** Expuesto en el puerto del anfitrión `3307` (mapeado al puerto interno `3306`) para evitar conflictos con instancias nativas de MySQL o MariaDB instaladas previamente en el sistema operativo.
- **Servicio `ep_ema_phpmyadmin`:** Disponible en `http://localhost:8080` para administración, consulta y depuración visual inmediata de las tablas.

### 6.2. Auto-Configuración de Colación en Español (`utf8mb4_spanish_ci`) y Soporte NAVE Ñ vs. NAVE N

En el idioma español y en la nomenclatura institucional del Mercado Mayorista de Ambato, la letra **`Ñ`** es una letra del alfabeto completamente distinta de la **`N`**. Bajo el cotejamiento por defecto de MySQL (`utf8mb4_0900_ai_ci` o `utf8mb4_general_ci`), MySQL colapsa la `Ñ` en `N`, provocando que un registro `"NAVE Ñ"` sea considerado un duplicado prohibido de `"NAVE N"` en campos con restricción `@unique`.

Para resolver este desafío tanto en desarrollo como en servidores MySQL nativos de producción (con o sin Docker):
1. El servicio `nave-puestos-sync.service.ts` implementa la función `asegurarColacionEspanolEnBD()`, la cual consulta el catálogo `information_schema.COLUMNS` para inspeccionar la colación de `naves.nombre` y `comerciantes.nave`.
2. Si las columnas no utilizan colación española, ejecuta automáticamente la instrucción DDL:
   ```sql
   ALTER TABLE `naves` MODIFY `nombre` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci NOT NULL;
   ALTER TABLE `comerciantes` MODIFY `nave` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci NULL;
   ```
3. Esta verificación se ejecuta automáticamente en tres puntos críticos:
   - Al arrancar el servidor Next.js a través del hook institucional `src/instrumentation.ts`.
   - Al ejecutar el sembrado inicial `prisma/seed.ts`.
   - Antes de crear o importar cualquier nave en `/api/v1/naves` y `/api/v1/catastro/importar`.
4. El generador de slugs (`generarSlugNave`) transforma `"NAVE Ñ"` en el identificador canónico `"nave-nh"` y `"NAVE N"` en `"nave-n"`, asegurando coexistencia pacífica e integridad referencial absoluta.

### 6.3. Esquema Relacional Prisma (`prisma/schema.prisma`) e Índices de Alto Rendimiento

El modelo de datos implementa 7 entidades normalizadas en MySQL con índices compuestos diseñados para soportar consultas concurrentes en submilisegundos:

1. **`Usuario` (`usuarios`):** Credenciales de acceso, rol institucional (`SUPERADMIN`, `TIC`, `DIRECTOR`, `JEFE_OPERATIVO`, `SUPERVISOR`), bandera `mustChangePassword`, hash bcrypt y arreglo JSON de `navesAsignadas`.
2. **`Nave` (`naves`):** Catálogo de pabellones comerciales con nombre único, capacidad autorizada (`cantidadPuestos`), límite máximo (`limitePuestos`), supervisores asignados y estado de registro.
3. **`PlanoNave` (`planos_naves`):** Relación 1:1 con `Nave`, almacena las dimensiones matriciales (`filas`, `columnas`) y la estructura vectorial completa de celdas en el campo `planoJson`.
4. **`Puesto` (`puestos`):** Puestos físicos fijos del mercado vinculados a su nave.
   - *Índices compuestos:* `@@index([naveId, codigo])`, `@@index([naveId])`, `@@index([naveId, estado])`.
5. **`Comerciante` (`comerciantes`):** Catastro nominal con cédula, CIU, nombre o razón social, actividad comercial, nave y puesto asignado.
   - *Índices compuestos:* `@@index([cedula])`, `@@index([ciu])`, `@@index([estadoRegistro])`, `@@index([nave, estadoRegistro])`.
6. **`RegistroAsistencia` (`registros_asistencia`):** Marcaciones diarias de jornales. Contiene estado (`Presente`, `Ausente`, `Permiso`, `Vacante`), fechas de permisos, novedades y arreglos JSON de observaciones y permisos históricos.
   - *Restricción de unicidad e índices:* `@@unique([comercianteId, fecha])`, `@@index([fecha])`, `@@index([puestoId])`, `@@index([fecha, puestoId])`.
7. **`SesionControlSupervisor` (`sesiones_control_supervisor`):** Registro inmutable de auditoría para cada toma de lista. Almacena supervisor, nave, jornada, hora de inicio, hora de última modificación, banderas de persistencia o retraso, etiquetas semánticas, resumen cuantitativo y radiografía nominal completa en JSON.
   - *Índices compuestos:* `@@index([supervisorId])`, `@@index([naveId])`, `@@index([fechaJornada])`, `@@index([naveId, fechaJornada])`.

### 6.4. Servicio Automático de Asistencia Diaria (02:00 AM Ecuador + Catch-Up en Arranque)

Para garantizar que los supervisores de campo encuentren la jornada operativa lista al iniciar su turno en la madrugada:
- **Ejecución Programada:** El servicio `daily-attendance.service.ts` configura un temporizador diario que se dispara exactamente a las **02:00:00 AM** en la zona horaria oficial de Ecuador (`America/Guayaquil`).
- **Resiliencia y Catch-Up en Arranque:** A través de `src/instrumentation.ts`, al encender o reiniciar el servidor Next.js, se invoca de inmediato `asegurarAsistenciaInicialDelDia()`. Si la jornada actual de hoy aún no cuenta con sus registros de asistencia creados, se inicializan de forma transparente.
- **Reglas de Integridad Estricta:**
  - Consulta todos los puestos en estado `"Ocupado"` con comerciantes habilitados.
  - Asigna estado `"Presente"`, salvo que el comerciante cuente con un permiso vigente para la fecha actual, en cuyo caso asigna `"Permiso"`.
  - Es **100% idempotente**: no duplica registros gracias a la restricción `@@unique([comercianteId, fecha])`.
  - **Cero alteración histórica:** Jamás toca fechas pasadas ni futuras, y no sobreescribe ninguna marcación manual realizada previamente durante el día.

### 6.5. Ingeniería de Alto Rendimiento y Concurrencia (Para 14+ Usuarios Simultáneos)

El sistema fue diseñado y optimizado para soportar la operación simultánea de más de 14 supervisores y directivos marcando asistencias, consultando auditorías y generando reportes en paralelo:

1. **Fast-Path en Memoria (60 segundos):**
   - El servicio de asistencia diaria mantiene marcas de tiempo en el contexto global (`globalThis.__epmma_last_sync_timestamp`). Si múltiples peticiones solicitan verificar la asistencia de la jornada en un intervalo inferior a 60 segundos, el sistema responde en **0 ms** sin ejecutar consultas innecesarias a la base de datos.
2. **Single-Flight Lock (Prevención de Solapamiento):**
   - Si dos o más solicitudes concurrentes activan la verificación de asistencia antes de que se complete el ciclo, el sistema utiliza un candado `globalThis.__epmma_sync_in_flight` que devuelve la misma `Promise` compartida a todos los hilos en espera, eliminando contenciones y bloqueos de tabla en MySQL.
3. **Inserciones Masivas por Lotes (`createMany`):**
   - Al importar catastros mensuales de 100 o más comerciantes, las inserciones de nuevos puestos y comerciantes se ejecutan en bloques transaccionales por lote (`prisma.puesto.createMany` y `prisma.comerciante.createMany`), reduciendo el tiempo de importación de varios segundos a menos de 200 ms.
4. **Actualización O(1) de Sesiones de Control de Supervisores:**
   - Cada marcación individual en `/api/v1/asistencia` localiza la sesión de control abierta del supervisor para esa nave y fecha en una sola consulta indexada (`naveId_fechaJornada`), actualizando los contadores de resumen en tiempo constante $O(1)$.
5. **Cliente Singleton Global de Prisma:**
   - Implementado en `src/infrastructure/database/prisma.ts` sobre el objeto global de NodeJS, previniendo la fuga o agotamiento del pool de conexiones MySQL durante recargas en caliente (*Hot Module Replacement*) en desarrollo y picos de tráfico en producción.

### 6.6. Seguridad Perimetral (`src/middleware.ts`) y Autorización Multi-Tenant (`authorization.ts`)

La seguridad del sistema está estratificada en dos niveles de inspección profunda:

1. **Filtro Perimetral Server-Side (`src/middleware.ts`):**
   - Intercepta todas las llamadas dirigidas a `/api/v1/*`.
   - Permite el paso público únicamente a `/api/v1/auth/login`, `/api/v1/auth/forgot-password` y `/api/v1/auth/logout`.
   - Extrae y valida el JWT firmado con clave secreta institucional desde las cookies `HttpOnly` (`ep_ema_auth_token`) o desde el encabezado `Authorization: Bearer <token>`.
   - Aplica control de acceso según método HTTP:
     - Endpoints `/api/v1/usuarios/*`: restringidos a `SUPERADMIN` y `TIC`.
     - Endpoints `/api/v1/auditoria/*`: restringidos a `SUPERADMIN`, `TIC`, `DIRECTOR` y `JEFE_OPERATIVO`.
     - Modificaciones `POST`, `PUT`, `DELETE` en naves y comerciantes: restringidas a `SUPERADMIN` y `TIC`.
     - Importación y simulación de catastro: restringidas a `SUPERADMIN`, `TIC` y `SUPERVISOR`.
     - Marcaciones en `/api/v1/asistencia`: restringidas a `SUPERADMIN`, `TIC`, `JEFE_OPERATIVO` y `SUPERVISOR` (bloqueando a `DIRECTOR`, quien posee rol de solo lectura).
   - Inyecta headers de contexto limpios (`x-user-id`, `x-user-cedula`, `x-user-rol`, `x-user-naves`) para su consumo inmediato en los Route Handlers.
2. **Autorización Multi-Tenant por Naves (`authorization.ts`):**
   - Los supervisores están confinados estrictamente a las naves registradas en su perfil (`user.navesAsignadas` o `nave.supervisores`).
   - Las funciones `userCanAccessNave`, `userCanAccessComerciante` y `getAccessibleNaveIds` validan en tiempo de ejecución cada lectura o mutación en la base de datos, impidiendo que un supervisor registre listas o consulte información de naves ajenas.
3. **Protección Anti-IDOR en `/api/v1/auth/change-password`:**
   - La API Route rechaza cualquier intento de un usuario de alterar la contraseña de un tercero (`targetUserId !== userId`), a menos que el emisor cuente con el rol `SUPERADMIN` o `TIC`.
4. **No Exposición de Contraseñas Temporales:**
   - Los endpoints de restablecimiento y creación de usuarios jamás retornan contraseñas en texto claro dentro del cuerpo de la respuesta JSON, mitigando la interceptación en clientes o registros de proxies intermedios.

### 6.7. Catálogo Completo de los 21 Endpoints API REST (`/api/v1/*`)

A continuación se detalla la matriz técnica de las 21 familias de endpoints REST implementadas en Next.js Route Handlers:

| # | Método(s) | Ruta del Endpoint | Descripción Funcional | Roles Autorizados |
| :-: | :--- | :--- | :--- | :--- |
| **1** | `POST` | `/api/v1/auth/login` | Autenticación por cédula/alias, verificación bcrypt y expedición de Cookie JWT | Público |
| **2** | `POST` | `/api/v1/auth/logout` | Revocación y expiración inmediata de la Cookie de sesión | Autenticado |
| **3** | `GET` | `/api/v1/auth/me` | Obtención del perfil, rol y naves asignadas de la sesión activa | Autenticado |
| **4** | `POST` | `/api/v1/auth/change-password` | Cambio de contraseña (voluntario o primer login obligatorio) con protección anti-IDOR | Autenticado |
| **5** | `POST` | `/api/v1/auth/forgot-password` | Generación CSPRNG de clave temporal segura de 16 chars y envío vía Gmail SMTP | Público |
| **6** | `GET`, `POST` | `/api/v1/usuarios` | Listado general de usuarios y creación de nuevas cuentas institucionales | `SUPERADMIN`, `TIC` |
| **7** | `GET`, `PUT`, `DELETE` | `/api/v1/usuarios/[id]` | Consulta de detalle, actualización de datos/rol y baja lógica de usuario | `SUPERADMIN`, `TIC` |
| **8** | `POST` | `/api/v1/usuarios/[id]/reset-password` | Restablecimiento administrativo de clave a contraseña temporal `${cedula}*` | `SUPERADMIN`, `TIC` |
| **9** | `GET`, `POST` | `/api/v1/naves` | Consulta del catálogo de naves con conteo de cupos y registro de nueva nave | GET: Todos \| POST: `SUPERADMIN`, `TIC` |
| **10** | `GET`, `PUT`, `DELETE` | `/api/v1/naves/[id]` | Consulta detallada, actualización de capacidad/nombre y eliminación de nave | GET: Todos \| PUT/DEL: `SUPERADMIN`, `TIC` |
| **11** | `GET`, `PUT` | `/api/v1/naves/[id]/plano` | Lectura y actualización de la matriz espacial de celdas (`planoJson`) con candado | GET: Todos \| PUT: `SUPERADMIN`, `TIC`, `DIRECTOR`, `JEFE_OPERATIVO` |
| **12** | `PUT` | `/api/v1/naves/[id]/puestos` | Renombre individual o masivo de puestos con sincronización atómica triple en BD | `SUPERADMIN`, `TIC` |
| **13** | `GET`, `POST` | `/api/v1/comerciantes` | Catastro de comerciantes filtrado por nave y alta nominal de contribuyente | GET: Todos \| POST: `SUPERADMIN`, `TIC` |
| **14** | `GET`, `PUT`, `DELETE` | `/api/v1/comerciantes/[id]` | Consulta, actualización de giro/datos y baja lógica de comerciante | GET: Todos \| PUT/DEL: `SUPERADMIN`, `TIC` |
| **15** | `POST` | `/api/v1/catastro/simular` | Previsualización y análisis de diferencias en 4 pasos sin persistir en BD | `SUPERADMIN`, `TIC`, `SUPERVISOR` |
| **16** | `POST` | `/api/v1/catastro/importar` | Confirmación e inserción transaccional por lotes de la conciliación mensual | `SUPERADMIN`, `TIC`, `SUPERVISOR` |
| **17** | `GET`, `POST` | `/api/v1/asistencia` | Consulta de asistencias por nave/fecha y marcación atómica (`Presente`, `Ausente`) | GET: Todos \| POST: `SUPERADMIN`, `TIC`, `JEFE_OPERATIVO`, `SUPERVISOR` |
| **18** | `POST` | `/api/v1/asistencia/persistencia` | Ejecución de persistencia selectiva arrastrando la jornada de referencia | `SUPERADMIN`, `TIC`, `JEFE_OPERATIVO`, `SUPERVISOR` |
| **19** | `POST`, `DELETE` | `/api/v1/asistencia/observaciones` | Inserción y eliminación de novedades (`ObservacionesGeneral`, `Citaciones`, `Notificacion`) | `SUPERADMIN`, `TIC`, `JEFE_OPERATIVO`, `SUPERVISOR` |
| **20** | `POST`, `DELETE` | `/api/v1/asistencia/permisos` | Registro y anulación de permisos por rango de fechas para comerciantes | `SUPERADMIN`, `TIC`, `JEFE_OPERATIVO`, `SUPERVISOR` |
| **21** | `GET` | `/api/v1/auditoria/sesiones` | Consulta de sesiones de control con filtros, insignias semánticas y exportación | `SUPERADMIN`, `TIC`, `DIRECTOR`, `JEFE_OPERATIVO` |

---

## 7. Comandos de Instalación, Despliegue Local y Producción

### 7.1. Flujo de Puesta en Marcha desde Cero (Entorno de Desarrollo)

Para levantar el entorno completo con su base de datos relacional y servidor de desarrollo:

```bash
# 1. Clonar el repositorio y acceder a la raíz
cd dev-epmma-hexagonal-gaot

# 2. Instalar dependencias con pnpm
pnpm install

# 3. Iniciar los contenedores de MySQL 8.0 y phpMyAdmin en segundo plano
docker compose up -d

# 4. Sincronizar el esquema relacional con la base de datos MySQL
npx prisma db push

# 5. Ejecutar el sembrado maestro de producción (SUPERADMIN y NAVE A)
npx prisma db seed

# 6. Iniciar el servidor de desarrollo local con recarga en caliente
pnpm dev
```

El sistema estará disponible en los siguientes puertos locales:
- **Aplicación Web EP-EMA:** `http://localhost:3000`
- **Gestor Visual phpMyAdmin:** `http://localhost:8080`
- **Base de Datos MySQL 8.0:** `localhost:3307` (Usuario: `ep_ema_user` / Contraseña: `ep_ema_pass` / Base: `ep_ema_db`)

### 7.2. Verificación de Calidad y Tipado

```bash
# Verificación estática estricta en TypeScript (0 errores tolerados)
npx tsc --noEmit

# Auditoría de reglas de estilo con ESLint (0 advertencias toleradas)
pnpm lint
```

### 7.3. Despliegue en Servidor MySQL Nativo de Producción

En un servidor institucional de producción (ej. Ubuntu Server / Debian / RHEL) con una base de datos MySQL 8.0 dedicada:

1. **Configurar las Variables de Entorno (`.env`):**
   ```env
   NODE_ENV=production
   PORT=3000

   # Conexión al servidor MySQL de producción (especificando utf8mb4)
   DATABASE_URL="mysql://usuario_prod:clave_robusta_2026@127.0.0.1:3306/epmma_mercado"

   # Clave secreta robusta para firma criptográfica de tokens JWT
   JWT_SECRET="epmma_jwt_super_secret_key_minimum_32_characters_long_2026"

   # Credenciales de correo transaccional con Gmail SMTP
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="465"
   SMTP_SECURE="true"
   SMTP_USER="sistema.epema@gmail.com"
   SMTP_PASS="tu_contraseña_de_aplicacion_aqui"
   EMAIL_FROM="EP-EMA Sistema de Gestión <sistema.epema@gmail.com>"
   ```

2. **Compilación y Arranque del Servidor:**
   ```bash
   # Generar el cliente de Prisma para producción
   npx prisma generate

   # Aplicar el esquema relacional sobre el MySQL de producción
   npx prisma db push

   # Opcional: Ejecutar sembrado si es instalación inicial limpia
   npx prisma db seed

   # Compilar la aplicación optimizada para producción
   pnpm build

   # Iniciar el servidor Next.js en producción
   pnpm start
   ```

---

## 8. Licencia y Derechos Institucionales

Este proyecto ha sido desarrollado exclusivamente para la **Empresa Pública – Empresa Municipal Mercado Mayorista de Ambato (EP-EMA)**.  
Todos los derechos reservados © 2026 EP-EMA. Prohibida su copia, distribución o reproducción no autorizada.
