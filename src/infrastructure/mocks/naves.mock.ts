import type {
  Nave,
  EstadoRegistroNave,
  PlanoEspacialNave,
  CeldaPlanoNave,
} from "@/domain/models/nave.model";
import { sincronizarNavesSupervisorDesdeNaves, getSupervisores } from "./auth.mock";

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
    console.warn(
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
 * Clave oficial: "ep_ema_planos_naves"
 */
const STORAGE_KEY_PLANOS = "ep_ema_planos_naves";
const planosCache: Record<string, PlanoEspacialNave> = {};

function cargarPlanosDesdeStorage(): Record<string, PlanoEspacialNave> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLANOS);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PlanoEspacialNave>;
  } catch (error) {
    console.warn("[PlanoNaves] Error al leer planos de localStorage:", error);
    return {};
  }
}

function persistirPlanosEnStorage(planos: Record<string, PlanoEspacialNave>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PLANOS, JSON.stringify(planos));
  } catch (error) {
    console.warn("[PlanoNaves] Error al guardar planos en localStorage:", error);
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DOCUMENTACIÓN DE INTEGRACIÓN BACKEND REAL (PostgreSQL / Supabase / Prisma)
 * ─────────────────────────────────────────────────────────────────────────────
 * En la arquitectura definitiva de EP-EMA, la matriz espacial de cada nave
 * puede modelarse bajo dos estrategias principales según el motor relacional:
 *
 * Estrategia 1 (Enfoque Documental JSONB - Rápido y Flexible):
 * -------------------------------------------------------------
 * Se añade una columna `plano_json JSONB` a la tabla `naves`:
 * ```sql
 * ALTER TABLE naves ADD COLUMN plano_json JSONB;
 * COMMENT ON COLUMN naves.plano_json IS 'Representación matricial completa de celdas, filas y columnas';
 * ```
 * Ventajas: Escritura atómica del croquis completo en una sola transacción,
 * serialización directa con TypeScript (`PlanoEspacialNave`).
 *
 * Estrategia 2 (Enfoque Relacional Normalizado con Índices Espaciales):
 * ---------------------------------------------------------------------
 * Se crea una tabla específica `nave_celdas_plano` para auditoría celda por celda:
 * ```sql
 * CREATE TABLE nave_celdas_plano (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   nave_id VARCHAR(50) NOT NULL REFERENCES naves(id) ON DELETE CASCADE,
 *   fila INT NOT NULL,
 *   columna INT NOT NULL,
 *   tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('PUESTO', 'VACIO', 'PARQUEADERO', 'DELIMITACION', 'ANOTACION')),
 *   codigo_puesto VARCHAR(50),
 *   texto TEXT,
 *   subtexto TEXT,
 *   color_zona VARCHAR(20),
 *   creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   CONSTRAINT uq_nave_celda UNIQUE (nave_id, fila, columna)
 * );
 * CREATE INDEX idx_nave_celdas_puesto ON nave_celdas_plano(nave_id, codigo_puesto);
 * CREATE INDEX idx_nave_celdas_coords ON nave_celdas_plano(nave_id, fila, columna);
 * ```
 * En el backend Nest.js / Node.js, `guardarPlanoNave` ejecutará una transacción SQL:
 * `DELETE FROM nave_celdas_plano WHERE nave_id = $1` seguido de un `INSERT INTO nave_celdas_plano (...) VALUES (...)`
 * validando que `COUNT(*) FILTER (WHERE tipo = 'PUESTO') <= naves.cantidad_puestos`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Genera automáticamente un plano estructurado realista inspirado en las
 * naves físicas de EP-EMA cuando una nave no cuenta aún con un plano personalizado.
 *
 * Estructura predeterminada:
 * - Matriz de 14 filas x 12 columnas.
 * - Fila 0: Delimitaciones espaciales ("NORTE", cabecera de sección, "SUR").
 * - Bloques de 2 filas de puestos (tipo: "PUESTO") numerados secuencialmente
 *   según la capacidad de la nave, separados cada 2 filas por 1 fila de "VACIO"
 *   (pasillo horizontal) y una columna central (columna 5) de "VACIO" (pasillo vertical).
 * - Perímetro inferior: Muestra áreas de parqueadero ("PARQUEADERO DE CARGA") y anotación ("PUERTA LANFORT").
 */
export function generarPlanoAutomatico(naveId: string): PlanoEspacialNave {
  const nave = obtenerNavePorId(naveId);
  const totalPuestos = nave?.cantidadPuestos ?? 100;
  const nombreNave = nave?.nombre ?? "NAVE";
  const seccion = nombreNave.replace(/^NAVE\s*/i, "").trim();

  const filas = 14;
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
          });
        } else if (c >= 3 && c <= 8) {
          celdas.push({
            fila: r,
            columna: c,
            tipo: "DELIMITACION",
            texto: `SECCIÓN ${seccion || "COMERCIAL"}`,
            subtexto: "ZONA MAYORISTA",
            colorZona: "azul",
          });
        } else {
          celdas.push({
            fila: r,
            columna: c,
            tipo: "DELIMITACION",
            texto: "SUR",
            subtexto: "SALIDA VEHICULAR",
            colorZona: "azul",
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
          });
        } else if (c >= 9 && c <= 11) {
          celdas.push({
            fila: r,
            columna: c,
            tipo: "ANOTACION",
            texto: "PUERTA LANFORT",
            subtexto: "BATERÍA SANITARIA",
            colorZona: "naranja",
          });
        } else {
          celdas.push({
            fila: r,
            columna: c,
            tipo: "VACIO",
          });
        }
        continue;
      }

      // 3. Pasillos Horizontales de Circulación (cada 2 filas de puestos)
      // Filas 3, 6, 9 y 12 actúan como corredores horizontales
      if (r === 3 || r === 6 || r === 9 || r === 12) {
        celdas.push({
          fila: r,
          columna: c,
          tipo: "VACIO",
        });
        continue;
      }

      // 4. Pasillo Vertical Central (Columna 5)
      if (c === 5) {
        celdas.push({
          fila: r,
          columna: c,
          tipo: "VACIO",
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
        });
        puestoActual++;
      } else {
        // Si ya se cubrió el cupo de la nave, el resto queda como pasillo o espacio libre
        celdas.push({
          fila: r,
          columna: c,
          tipo: "VACIO",
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

  // Guardar en caché y sincronizar con localStorage
  planosCache[naveId] = plano;
  const persisted = cargarPlanosDesdeStorage();
  persisted[naveId] = plano;
  persistirPlanosEnStorage(persisted);

  return { ...plano };
}

/**
 * Obtiene el plano espacial de una nave.
 * Consulta primero la caché en memoria, luego `localStorage` y, si aún no existe,
 * genera el plano predeterminado automáticamente.
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
 * Validación Estricta de Capacidad:
 * - Cuenta cuántas celdas tienen `tipo === "PUESTO"`.
 * - Si supera `nave.cantidadPuestos`, lanza un error impidiendo el guardado.
 * - Las celdas de tipo "VACIO", "PARQUEADERO", "DELIMITACION" y "ANOTACION"
 *   NO consumen cupo del límite de puestos de la nave.
 */
export function guardarPlanoNave(
  naveId: string,
  plano: PlanoEspacialNave
): PlanoEspacialNave {
  const nave = obtenerNavePorId(naveId);
  const limiteMaximo = nave ? nave.cantidadPuestos : 100;

  // Conteo de puestos físicos en la matriz
  const puestosEnPlano = plano.celdas.filter((c) => c.tipo === "PUESTO").length;

  if (puestosEnPlano > limiteMaximo) {
    throw new Error(
      `No se puede guardar el plano: la cantidad de puestos ubicados (${puestosEnPlano}) excede la capacidad máxima registrada de la nave (${limiteMaximo} puestos).`
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

