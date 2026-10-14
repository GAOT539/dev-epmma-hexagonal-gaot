import type { Nave, EstadoRegistroNave } from "@/domain/models/nave.model";
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
