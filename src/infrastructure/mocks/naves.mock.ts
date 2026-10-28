import type {
  Nave,
  EstadoRegistroNave,
  PlanoEspacialNave,
  CeldaPlanoNave,
} from "@/domain/models/nave.model";
import { sincronizarNavesSupervisorDesdeNaves, getSupervisores } from "./auth.mock";
import { logClientWarn } from "@/lib/client-logger";

// ── Lista de Supervisores Disponibles en el Sistema ──────────────────────────

export const SUPERVISORES_DISPONIBLES = [
  "María Torres Guzmán",
  "Jorge Castillo Vera",
  "Elena Mora Salcedo",
];

export function obtenerSupervisoresDisponibles(): string[] {
  try {
    const deUsuarios = getSupervisores().map((s) => `${s.nombres} ${s.apellidos}`.trim());
    return Array.from(new Set([...SUPERVISORES_DISPONIBLES, ...deUsuarios]));
  } catch {
    return [...SUPERVISORES_DISPONIBLES];
  }
}

// ── Datos iniciales simulados (compatibilidad con mercado.mock.ts) ───────────

const navesData: Nave[] = [
  {
    id: "nave-a",
    nombre: "NAVE A",
    cantidadPuestos: 100,
    supervisores: ["María Torres Guzmán"],
    estadoRegistro: "Habilitado",
    limitePuestos: 100,
    puestos: [],
  },
  {
    id: "nave-b",
    nombre: "NAVE B",
    cantidadPuestos: 100,
    supervisores: ["María Torres Guzmán"],
    estadoRegistro: "Habilitado",
    limitePuestos: 100,
    puestos: [],
  },
  {
    id: "nave-c",
    nombre: "NAVE C",
    cantidadPuestos: 100,
    supervisores: ["Jorge Castillo Vera"],
    estadoRegistro: "Habilitado",
    limitePuestos: 100,
    puestos: [],
  },
  {
    id: "nave-d",
    nombre: "NAVE D",
    cantidadPuestos: 100,
    supervisores: ["Jorge Castillo Vera"],
    estadoRegistro: "Habilitado",
    limitePuestos: 100,
    puestos: [],
  },
  {
    id: "nave-e",
    nombre: "NAVE E",
    cantidadPuestos: 100,
    supervisores: ["Elena Mora Salcedo"],
    estadoRegistro: "Habilitado",
    limitePuestos: 100,
    puestos: [],
  },
];

// Naves operativas del mercado con comerciantes registrados en el mock
export const navesConComerciantes = new Set(["nave-a", "nave-b", "nave-c", "nave-d", "nave-e"]);

export function registrarNaveConComerciantes(naveId: string): void {
  navesConComerciantes.add(naveId);
}

// ── API CRUD Simulada ────────────────────────────────────────────────────────

/**
 * Obtiene el listado completo de naves registradas en el sistema.
 */
export function obtenerNaves(): Nave[] {
  return [...navesData];
}

/**
 * Obtiene una nave por su identificador único.
 */
export function obtenerNavePorId(id: string): Nave | null {
  return navesData.find((n) => n.id === id) ?? null;
}

/**
 * Crea una nueva nave con su capacidad inicial de puestos y supervisores asignados.
 */
export function crearNave(
  nombre: string,
  cantidadPuestos: number,
  supervisores: string[] = []
): Nave {
  const nombreLimpio = nombre.trim().toUpperCase();
  const slug = nombreLimpio
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const id = `nave-${slug || Date.now()}`;
  const cantidad = Math.max(1, Math.floor(cantidadPuestos));

  const nuevaNave: Nave = {
    id,
    nombre: nombreLimpio,
    cantidadPuestos: cantidad,
    supervisores: supervisores.length > 0 ? supervisores : [],
    estadoRegistro: "Habilitado",
    limitePuestos: cantidad,
    puestos: [],
  };

  navesData.push(nuevaNave);
  sincronizarNavesSupervisorDesdeNaves(navesData);
  return { ...nuevaNave };
}

/**
 * Actualiza los datos de una nave existente (nombre, capacidad y supervisores).
 */
export function actualizarNave(
  id: string,
  data: {
    nombre?: string;
    cantidadPuestos?: number;
    supervisores?: string[];
  }
): Nave | null {
  const index = navesData.findIndex((n) => n.id === id);
  if (index === -1) return null;

  const anterior = navesData[index];
  const nuevaCantidad =
    data.cantidadPuestos !== undefined
      ? Math.max(1, Math.floor(data.cantidadPuestos))
      : anterior.cantidadPuestos;

  // ── Lógica Simulada de Backend ──────────────────────────────────────────────
  // En un entorno real, el backend validaría que no se reduzcan puestos si hay
  // comerciantes asignados a los puestos eliminados.
  if (nuevaCantidad < anterior.cantidadPuestos) {
    logClientWarn(
      "MOCK:NAVES",
      `[SIMULACIÓN BACKEND] Reducción de puestos en ${anterior.nombre} de ${anterior.cantidadPuestos} a ${nuevaCantidad}. En un entorno real, el backend validaría que no se reduzcan puestos si hay comerciantes asignados a los puestos eliminados.`
    );
  }

  navesData[index] = {
    ...anterior,
    nombre: data.nombre ? data.nombre.trim().toUpperCase() : anterior.nombre,
    cantidadPuestos: nuevaCantidad,
    limitePuestos: nuevaCantidad,
    supervisores: data.supervisores !== undefined ? data.supervisores : anterior.supervisores,
  };

  sincronizarNavesSupervisorDesdeNaves(navesData);
  return { ...navesData[index] };
}

/**
 * Actualiza la cantidad de puestos disponibles en una nave existente (alias retrocompatible).
 */
export function actualizarPuestosNave(
  id: string,
  nuevaCantidad: number
): Nave | null {
  return actualizarNave(id, { cantidadPuestos: nuevaCantidad });
}

/**
 * Elimina una nave del sistema con validación de comerciantes asignados.
 */
export function eliminarNave(id: string): { exito: boolean; mensaje: string } {
  const index = navesData.findIndex((n) => n.id === id);
  if (index === -1) {
    return { exito: false, mensaje: "Nave no encontrada." };
  }

  const nave = navesData[index];

  // ── Validación de regla de negocio ────────────────────────────────────────
  // Si la nave tiene comerciantes asignados, rechazar la eliminación.
  if (navesConComerciantes.has(nave.id)) {
    return {
      exito: false,
      mensaje: "No se puede eliminar la nave porque tiene comerciantes asignados.",
    };
  }

  navesData.splice(index, 1);
  sincronizarNavesSupervisorDesdeNaves(navesData);
  return {
    exito: true,
    mensaje: `Nave ${nave.nombre} eliminada exitosamente.`,
  };
}

/**
 * Cambia el estado de registro de la nave (Habilitado / Deshabilitado) [Opcional].
 */
export function cambiarEstadoNave(
  id: string,
  nuevoEstado?: EstadoRegistroNave
): Nave | null {
  const index = navesData.findIndex((n) => n.id === id);
  if (index === -1) return null;

  const estadoActual = navesData[index].estadoRegistro;
  const estadoFinal =
    nuevoEstado ?? (estadoActual === "Habilitado" ? "Deshabilitado" : "Habilitado");

  navesData[index] = {
    ...navesData[index],
    estadoRegistro: estadoFinal,
  };

  return { ...navesData[index] };
}

/**
 * Sincroniza bidireccionalmente la asignación de un supervisor hacia las naves.
 * Actualiza la lista `supervisores` de cada nave en `navesData`:
 * - Si el ID o nombre de la nave está incluido en `navesAsignadas`, asegura que el nombre del supervisor esté en `supervisores`.
 * - Si no está incluido en `navesAsignadas`, remueve el nombre del supervisor (o su nombre previo si cambió).
 */
export function sincronizarSupervisorEnNaves(
  nombreSupervisor: string,
  navesAsignadas: string[],
  nombreAnterior?: string
): void {
  const nombreLimpio = nombreSupervisor.trim();
  const nombreAntLimpio = nombreAnterior ? nombreAnterior.trim() : "";

  for (const nave of navesData) {
    if (!nave.supervisores) {
      nave.supervisores = [];
    }

    const estaAsignada =
      navesAsignadas.includes(nave.id) ||
      (nave.nombre && navesAsignadas.includes(nave.nombre));

    if (estaAsignada) {
      // Si el supervisor cambió de nombre, retirar el nombre previo de la nave
      if (nombreAntLimpio && nombreAntLimpio.toLowerCase() !== nombreLimpio.toLowerCase()) {
        nave.supervisores = nave.supervisores.filter(
          (s) => s.trim().toLowerCase() !== nombreAntLimpio.toLowerCase()
        );
      }
      // Agregar el nuevo nombre si aún no figura
      const yaExiste = nave.supervisores.some(
        (s) => s.trim().toLowerCase() === nombreLimpio.toLowerCase()
      );
      if (!yaExiste && nombreLimpio) {
        nave.supervisores.push(nombreLimpio);
      }
    } else {
      // Remover al supervisor de esta nave si estaba presente
      nave.supervisores = nave.supervisores.filter((s) => {
        const sLimpio = s.trim().toLowerCase();
        const esActual = sLimpio === nombreLimpio.toLowerCase();
        const esAnterior = Boolean(nombreAntLimpio && sLimpio === nombreAntLimpio.toLowerCase());
        return !esActual && !esAnterior;
      });
    }
  }
}

// ── PERSISTENCIA Y GESTIÓN ESPACIAL DEL PLANO DE NAVES (EP-EMA) ───────────────

/**
 * Persistencia en Memoria y LocalStorage para Planos de Naves.
 * Clave oficial versión 2: "ep_ema_planos_naves_v2"
 * (Garantiza que NAVE A inicie con su plantilla preconfigurada y NAVE B, C, D, E en blanco).
 */
const STORAGE_KEY_PLANOS = "ep_ema_planos_naves_v3";
const planosCache: Record<string, PlanoEspacialNave> = {};

function cargarPlanosDesdeStorage(): Record<string, PlanoEspacialNave> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLANOS);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PlanoEspacialNave>;
  } catch (error) {
    logClientWarn("MOCK:PLANOS", "Error al leer planos de localStorage", error);
    return {};
  }
}

function persistirPlanosEnStorage(planos: Record<string, PlanoEspacialNave>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PLANOS, JSON.stringify(planos));
  } catch (error) {
    logClientWarn("MOCK:PLANOS", "Error al guardar planos en localStorage", error);
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DOCUMENTACIÓN DE INTEGRACIÓN BACKEND REAL (PostgreSQL / Supabase / Prisma)
 * REQUISITOS TÉCNICOS PARA PLANOS MODULARES Y PERSISTENCIA ATÓMICA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. Endpoints de la API REST / GraphQL:
 *    - `GET /api/v1/naves/:id/plano`:
 *      Retorna el objeto `PlanoEspacialNave`. Si la nave no posee aún un croquis
 *      persistido en base de datos:
 *      * Para "nave-a": retorna la plantilla arquitectónica predeterminada.
 *      * Para cualquier otra nave ("nave-b", "nave-c", etc.): retorna un lienzo
 *        100% en blanco (matriz con celdas de tipo "VACIO").
 *
 *    - `PUT /api/v1/naves/:id/plano`:
 *      Recibe `{ filas, columnas, celdas }` y ejecuta un guardado transaccional
 *      atómico. Si se agregan, mueven o eliminan filas/columnas, o se reubican
 *      puestos con Drag & Drop, el estado completo de la nave se sobreescribe.
 *
 * 2. Estrategias de Almacenamiento en PostgreSQL:
 *
 *    Estrategia A (Columna Documental JSONB - Recomendada para Alta Agilidad):
 *    ```sql
 *    ALTER TABLE naves ADD COLUMN IF NOT EXISTS plano_json JSONB;
 *    COMMENT ON COLUMN naves.plano_json IS 'Matriz espacial completa: { filas, columnas, celdas: [{ fila, columna, tipo, codigoPuesto, rowSpan, colSpan, texto, subtexto, colorZona }] }';
 *    ```
 *    Ventaja: Permite almacenar módulos con `rowSpan` y `colSpan`, notas y pasillos
 *    en una sola columna atómica sin bloqueos relacionales entre tablas.
 *
 *    Estrategia B (Tabla Relacional Normalizada para Auditoría Celda por Celda):
 *    ```sql
 *    CREATE TABLE IF NOT EXISTS nave_celdas_plano (
 *      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *      nave_id VARCHAR(50) NOT NULL REFERENCES naves(id) ON DELETE CASCADE,
 *      fila INT NOT NULL,
 *      columna INT NOT NULL,
 *      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('PUESTO', 'VACIO', 'PARQUEADERO', 'DELIMITACION', 'ANOTACION', 'BANO')),
 *      codigo_puesto VARCHAR(50),
 *      texto TEXT,
 *      subtexto TEXT,
 *      color_zona VARCHAR(20),
 *      row_span INT NOT NULL DEFAULT 1,
 *      col_span INT NOT NULL DEFAULT 1,
 *      creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *      actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *      CONSTRAINT uq_nave_celda UNIQUE (nave_id, fila, columna)
 *    );
 *    CREATE INDEX IF NOT EXISTS idx_nave_celdas_puesto ON nave_celdas_plano(nave_id, codigo_puesto);
 *    CREATE INDEX IF NOT EXISTS idx_nave_celdas_coords ON nave_celdas_plano(nave_id, fila, columna);
 *    ```
 *
 * 3. Regla Estricta de Negocio y Validación de Capacidad Modular:
 *    - Un mismo comerciante o puesto puede ocupar múltiples celdas (ej. A2 y A3) mediante
 *      `rowSpan` / `colSpan` o compartiendo el mismo `codigo_puesto`.
 *    - En el backend, la validación de cupo debe contar códigos de puesto ÚNICOS:
 *      ```sql
 *      SELECT COUNT(DISTINCT codigo_puesto) FROM nave_celdas_plano
 *      WHERE nave_id = $1 AND tipo = 'PUESTO' AND codigo_puesto IS NOT NULL;
 *      ```
 *      Si `COUNT(DISTINCT codigo_puesto) > naves.cantidad_puestos`, la transacción
 *      debe ser rechazada con código HTTP 400 (Bad Request).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Genera el plano inicial de una nave:
 * - Para "nave-a": genera la plantilla física detallada de EP-EMA (16 filas × 12 columnas).
 * - Para el resto de naves ("nave-b", "nave-c", etc.): genera un lienzo 100% en blanco
 *   (12 filas × 12 columnas de tipo "VACIO"), permitiendo diseñar cada nave desde cero.
 */
export function generarPlanoAutomatico(naveId: string): PlanoEspacialNave {
  const nave = obtenerNavePorId(naveId);
  const esNaveA =
    naveId === "nave-a" ||
    (nave?.nombre && nave.nombre.trim().toUpperCase() === "NAVE A");

  // ── Si NO es NAVE A: generar lienzo 100% en blanco ────────────────────────
  if (!esNaveA) {
    const filas = 12;
    const columnas = 12;
    const celdas: CeldaPlanoNave[] = [];

    for (let r = 0; r < filas; r++) {
      for (let c = 0; c < columnas; c++) {
        celdas.push({
          fila: r,
          columna: c,
          tipo: "VACIO",
          rowSpan: 1,
          colSpan: 1,
        });
      }
    }

    const planoBlanco: PlanoEspacialNave = {
      naveId,
      filas,
      columnas,
      celdas,
      actualizadoEn: new Date().toISOString(),
    };

    planosCache[naveId] = planoBlanco;
    const persisted = cargarPlanosDesdeStorage();
    persisted[naveId] = planoBlanco;
    persistirPlanosEnStorage(persisted);

    return { ...planoBlanco };
  }

  // ── Si es NAVE A: plantilla arquitectónica estructurada ────────────────────
  const totalPuestos = nave?.cantidadPuestos ?? 100;
  const filas = 16;
  const columnas = 12;
  const celdas: CeldaPlanoNave[] = [];

  let puestoActual = 1;

  for (let r = 0; r < filas; r++) {
    for (let c = 0; c < columnas; c++) {
      // 1. Fila Superior (Cabecera y Delimitaciones Espaciales)
      if (r === 0) {
        if (c >= 0 && c <= 2) {
          celdas.push({
            fila: r,
            columna: c,
            tipo: "DELIMITACION",
            texto: "NORTE",
            subtexto: "ACCESO PRINCIPAL",
            colorZona: "azul",
            rowSpan: 1,
            colSpan: 1,
          });
        } else if (c >= 3 && c <= 8) {
          celdas.push({
            fila: r,
            columna: c,
            tipo: "DELIMITACION",
            texto: "SECCIÓN A",
            subtexto: "ZONA MAYORISTA",
            colorZona: "azul",
            rowSpan: 1,
            colSpan: 1,
          });
        } else {
          celdas.push({
            fila: r,
            columna: c,
            tipo: "DELIMITACION",
            texto: "SUR",
            subtexto: "SALIDA VEHICULAR",
            colorZona: "azul",
            rowSpan: 1,
            colSpan: 1,
          });
        }
        continue;
      }

      // 2. Fila Inferior (Perímetro de Servicios y Parqueadero)
      if (r === filas - 1) {
        if (c >= 0 && c <= 2) {
          celdas.push({
            fila: r,
            columna: c,
            tipo: "PARQUEADERO",
            texto: "PARQUEADERO DE CARGA",
            subtexto: "CAMIONES / DESCARGA",
            colorZona: "rosado",
            rowSpan: 1,
            colSpan: 1,
          });
        } else if (c >= 9 && c <= 11) {
          celdas.push({
            fila: r,
            columna: c,
            tipo: "ANOTACION",
            texto: "PUERTA LANFORT",
            subtexto: "BATERÍA SANITARIA",
            colorZona: "naranja",
            rowSpan: 1,
            colSpan: 1,
          });
        } else {
          celdas.push({
            fila: r,
            columna: c,
            tipo: "VACIO",
            rowSpan: 1,
            colSpan: 1,
          });
        }
        continue;
      }

      // 3. Pasillos Horizontales de Circulación (cada 2 filas de puestos)
      if (r === 3 || r === 6 || r === 9 || r === 12) {
        celdas.push({
          fila: r,
          columna: c,
          tipo: "VACIO",
          rowSpan: 1,
          colSpan: 1,
        });
        continue;
      }

      // 4. Pasillo Vertical Central (Columna 5)
      if (c === 5) {
        celdas.push({
          fila: r,
          columna: c,
          tipo: "VACIO",
          rowSpan: 1,
          colSpan: 1,
        });
        continue;
      }

      // 5. Ubicación de Puestos Comerciales
      if (puestoActual <= totalPuestos) {
        celdas.push({
          fila: r,
          columna: c,
          tipo: "PUESTO",
          codigoPuesto: String(puestoActual),
          subtexto: "MÓDULO ESTÁNDAR",
          rowSpan: 1,
          colSpan: 1,
        });
        puestoActual++;
      } else {
        celdas.push({
          fila: r,
          columna: c,
          tipo: "VACIO",
          rowSpan: 1,
          colSpan: 1,
        });
      }
    }
  }

  const plano: PlanoEspacialNave = {
    naveId,
    filas,
    columnas,
    celdas,
    actualizadoEn: new Date().toISOString(),
  };

  planosCache[naveId] = plano;
  const persisted = cargarPlanosDesdeStorage();
  persisted[naveId] = plano;
  persistirPlanosEnStorage(persisted);

  return { ...plano };
}

/**
 * Obtiene el plano espacial de una nave.
 * Consulta primero la caché en memoria, luego `localStorage` y, si aún no existe,
 * genera el plano correspondiente (plantilla para Nave A o lienzo en blanco para otras).
 */
export function obtenerPlanoNave(naveId: string): PlanoEspacialNave {
  if (planosCache[naveId]) {
    return { ...planosCache[naveId] };
  }

  const persisted = cargarPlanosDesdeStorage();
  if (persisted[naveId]) {
    planosCache[naveId] = persisted[naveId];
    return { ...persisted[naveId] };
  }

  return generarPlanoAutomatico(naveId);
}

/**
 * Guarda o actualiza la distribución del plano espacial de una nave.
 *
 * Validación Inteligente de Capacidad (Soporte Modular):
 * - Cuenta códigos de puestos ÚNICOS en la matriz (`Set` de `codigoPuesto`).
 * - Un puesto que ocupa varias celdas (mediante `rowSpan` o repetición) cuenta como 1 cupo.
 * - Si supera `nave.cantidadPuestos`, lanza un error descriptivo impidiendo el guardado.
 */
export function guardarPlanoNave(
  naveId: string,
  plano: PlanoEspacialNave
): PlanoEspacialNave {
  const nave = obtenerNavePorId(naveId);
  const limiteMaximo = nave ? nave.cantidadPuestos : 100;

  // Conteo de puestos únicos en la matriz
  const codigosPuestosUnicos = new Set(
    plano.celdas
      .filter((c) => c.tipo === "PUESTO" && c.codigoPuesto?.trim())
      .map((c) => c.codigoPuesto!.trim().toUpperCase())
  );

  const totalPuestosUnicos = codigosPuestosUnicos.size;

  if (totalPuestosUnicos > limiteMaximo) {
    throw new Error(
      `No se puede guardar el plano: la cantidad de puestos únicos ubicados (${totalPuestosUnicos}) excede la capacidad máxima registrada de la nave (${limiteMaximo} puestos).`
    );
  }

  const planoActualizado: PlanoEspacialNave = {
    ...plano,
    naveId,
    actualizadoEn: new Date().toISOString(),
  };

  planosCache[naveId] = planoActualizado;
  const persisted = cargarPlanosDesdeStorage();
  persisted[naveId] = planoActualizado;
  persistirPlanosEnStorage(persisted);

  return { ...planoActualizado };
}

