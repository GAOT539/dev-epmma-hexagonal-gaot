// ── Infraestructura: Datos simulados del Mercado ──────────────────────────────

import type {
  Nave,
  Puesto,
  Comerciante,
  RegistroAsistencia,
  EstadoAsistencia,
  ObservacionDetalle,
  PermisoDetalle,
  TipoObservacion,
  ImportacionRegistro,
  ImportacionResultado,
  ReconciliacionResumen,
  CambioReconciliacion,
} from "@/domain/models/comerciante.model";
import { format, subDays, addDays, eachDayOfInterval } from "date-fns";
import {
  sincronizarControlAsistenciaManual,
  sincronizarControlPersistencia,
} from "./auditoria.mock";
import {
  obtenerNaves,
  obtenerNavePorId,
  crearNave as mockCrearNave,
  actualizarNave as mockActualizarNave,
  actualizarPuestosNave,
  eliminarNave,
  cambiarEstadoNave,
  obtenerSupervisoresDisponibles,
  registrarNaveConComerciantes,
  navesConComerciantes,
  obtenerPlanoNave,
  guardarPlanoNave,
  generarPlanoAutomatico,
} from "./naves.mock";

export {
  obtenerNaves,
  obtenerNavePorId,
  actualizarPuestosNave,
  eliminarNave,
  cambiarEstadoNave,
  obtenerSupervisoresDisponibles,
  registrarNaveConComerciantes,
  navesConComerciantes,
  obtenerPlanoNave,
  guardarPlanoNave,
  generarPlanoAutomatico,
};

// ── Pools de datos ───────────────────────────────────────────────────────────

const ACTIVIDADES = [
  "Frutas", "Legumbres", "Carnes", "Lácteos", "Granos y Cereales",
  "Mariscos", "Tubérculos", "Verduras", "Condimentos", "Abarrotes",
  "Flores", "Artesanías", "Comida Preparada", "Bebidas", "Plásticos",
];

const NOMBRES = [
  "Luis", "María", "Carlos", "Ana", "Pedro", "Rosa", "Jorge", "Elena",
  "Marco", "Sofía", "Ricardo", "Patricia", "Fernando", "Carmen", "Diego",
  "Lucía", "Andrés", "Isabel", "Miguel", "Teresa", "Raúl", "Gloria",
  "Oscar", "Daniela", "Héctor", "Verónica", "Esteban", "Adriana",
  "Gustavo", "Mónica",
];

const APELLIDOS = [
  "Martínez", "Ríos", "Salcedo", "Torres", "Vargas", "Guzmán",
  "Castillo", "Mora", "Pérez", "Mendoza", "Suárez", "López",
  "Medina", "Ruiz", "Sánchez", "Herrera", "Flores", "Paredes",
  "Cevallos", "Naranjo", "Villacís", "Córdova", "Barrionuevo",
  "Altamirano", "Quishpe", "Chávez", "Bonilla", "Acosta",
  "Caicedo", "Velasteguí",
];

// ── Textos de novedad para generación ────────────────────────────────────────

const TEXTOS_NOVEDAD = [
  "Puesto en mal estado, requiere mantenimiento urgente.",
  "Comerciante reporta problema con instalaciones eléctricas.",
  "Acumulación de basura en los alrededores del puesto.",
  "Fuga de agua detectada cerca del puesto.",
  "Comerciante solicitó cambio de puesto por conflicto con vecino.",
  "Producto en mal estado decomisado por inspección sanitaria.",
  "Puesto parcialmente dañado por incidente menor.",
  "Comerciante presenta documentación vencida.",
  "Bloqueo parcial del pasillo por mercadería fuera del puesto.",
  "Ruido excesivo reportado por comerciantes aledaños.",
];

// ── Seed determinístico ──────────────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function genCedula(index: number): string {
  return `18${String(10000000 + index).padStart(8, "0")}`;
}

function genCIU(index: number): string {
  return `CIU-${String(index + 1).padStart(5, "0")}`;
}

// ── Generación de datos ──────────────────────────────────────────────────────

const NAVES_CONFIG = [
  { id: "nave-a", nombre: "NAVE A" },
  { id: "nave-b", nombre: "NAVE B" },
  { id: "nave-c", nombre: "NAVE C" },
  { id: "nave-d", nombre: "NAVE D" },
  { id: "nave-e", nombre: "NAVE E" },
];

const LIMITE_PUESTOS = 100;

// Generar puestos y comerciantes
let comercianteIndex = 0;

function generarPuestosYComerciantes(): {
  puestos: Puesto[];
  comerciantes: Comerciante[];
} {
  const puestos: Puesto[] = [];
  const comerciantes: Comerciante[] = [];

  for (const nave of NAVES_CONFIG) {
    for (let j = 0; j < LIMITE_PUESTOS; j++) {
      const globalIndex = puestos.length;
      const letraNave = nave.nombre.replace(/^NAVE\s*/i, "").trim();
      const puestoId = `P-${letraNave}${String(globalIndex + 1).padStart(3, "0")}`;

      // ~85% ocupados, ~15% vacantes
      const esVacante = rand() < 0.15;

      if (esVacante) {
        puestos.push({
          id: puestoId,
          codigo: puestoId,
          naveId: nave.id,
          estado: "Vacante",
          comercianteId: null,
        });
      } else {
        const cedula = genCedula(comercianteIndex);
        const ciu = genCIU(comercianteIndex);
        const comId = `com-${String(comercianteIndex + 1).padStart(4, "0")}`;

        const comerciante: Comerciante = {
          idInterno: comId,
          ciu,
          cedula,
          contribuyente: `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`,
          actividad: pick(ACTIVIDADES),
          puestoId: puestoId,
          nave: nave.nombre.toUpperCase(),
          estadoRegistro: "Habilitado",
          creadoPor: "sistema",
        };

        comerciantes.push(comerciante);

        puestos.push({
          id: puestoId,
          codigo: puestoId,
          naveId: nave.id,
          estado: "Ocupado",
          comercianteId: comId,
        });

        comercianteIndex++;
      }
    }
  }

  return { puestos, comerciantes };
}

const { puestos: allPuestos, comerciantes: allComerciantes } =
  generarPuestosYComerciantes();

// ── Generar asistencia histórica (últimos 30 días) ──────────────────────────
// Regla de transición: Si ayer = Ausente reiterado -> hoy = Observacion

function generarAsistenciaHistorica(): Map<string, RegistroAsistencia[]> {
  const map = new Map<string, RegistroAsistencia[]>();
  const hoy = new Date();

  for (const comerciante of allComerciantes) {
    for (let d = 30; d >= 0; d--) {
      const fecha = format(subDays(hoy, d), "yyyy-MM-dd");
      const key = fecha;

      let estado: EstadoAsistencia;
      let observacionTexto: string | undefined = undefined;
      let observacion: string | undefined = undefined;

      // Distribución aleatoria (sin estado Pendiente)
      const r = rand();
      if (r < 0.78) estado = "Presente";
      else if (r < 0.92) estado = "Ausente";
      else estado = "Permiso";

      // Observaciones como metadatos puros independientes del estado
      const tieneObs = rand() < 0.15;
      if (tieneObs) {
        observacion = "Novedad registrada";
        observacionTexto = pick(TEXTOS_NOVEDAD);
      } else if (estado === "Permiso") {
        observacion = "Permiso concedido";
      }

      const observaciones: ObservacionDetalle[] = [];
      if (observacionTexto) {
        observaciones.push({
          id: `obs-hist-${comerciante.idInterno}-${fecha}-1`,
          tipo: "ObservacionesGeneral",
          texto: observacionTexto,
          fechaHora: "07:30 AM",
        });
      }

      const permisos: PermisoDetalle[] = [];
      if (estado === "Permiso") {
        permisos.push({
          id: `perm-hist-${comerciante.idInterno}-${fecha}-1`,
          motivo: observacion || "Permiso concedido",
          fechaAsignacion: fecha,
          fechaInicio: fecha,
          fechaFin: format(subDays(hoy, Math.max(0, d - 2)), "yyyy-MM-dd"),
          fecha,
        });
      }

      const registro: RegistroAsistencia = {
        id: `asist-${comerciante.idInterno}-${fecha}`,
        comercianteId: comerciante.idInterno,
        puestoId: comerciante.puestoId ?? "",
        fecha,
        estado,
        observacion,
        observacionTexto,
        permisoInicio: estado === "Permiso" ? fecha : undefined,
        permisoFin:
          estado === "Permiso"
            ? format(subDays(hoy, Math.max(0, d - 2)), "yyyy-MM-dd")
            : undefined,
        observaciones,
        permisos,
      };

      const existing = map.get(key) ?? [];
      existing.push(registro);
      map.set(key, existing);
    }
  }

  return map;
}

const asistenciaHistorica = generarAsistenciaHistorica();

// ── API pública ──────────────────────────────────────────────────────────────

export function getNaves(): Nave[] {
  const naves = obtenerNaves();
  return naves.map((nc) => {
    const puestosNave = allPuestos.filter((p) => p.naveId === nc.id);
    if (puestosNave.length < nc.cantidadPuestos) {
      sincronizarPuestosNave(nc.id, nc.cantidadPuestos, nc.nombre);
    }
    return {
      id: nc.id,
      nombre: nc.nombre,
      cantidadPuestos: nc.cantidadPuestos,
      supervisores: nc.supervisores ?? [],
      estadoRegistro: nc.estadoRegistro,
      limitePuestos: nc.cantidadPuestos ?? LIMITE_PUESTOS,
      puestos: allPuestos.filter((p) => p.naveId === nc.id),
    };
  });
}

export function getPuestosPorNave(naveId: string): Puesto[] {
  return allPuestos.filter((p) => p.naveId === naveId);
}

export function getComerciantes(): Comerciante[] {
  return allComerciantes.filter(c => c.estadoRegistro !== "Deshabilitado");
}

export const obtenerComerciantes = getComerciantes;

export function getComerciantePorId(id: string): Comerciante | null {
  return allComerciantes.find((c) => c.idInterno === id && c.estadoRegistro !== "Deshabilitado") ?? null;
}

export function getComerciantePorPuesto(puestoId: string): Comerciante | null {
  return allComerciantes.find((c) => c.puestoId === puestoId && c.estadoRegistro !== "Deshabilitado") ?? null;
}

export function getAsistenciaPorFecha(fecha: string): RegistroAsistencia[] {
  return asistenciaHistorica.get(fecha) ?? [];
}

export function getAsistenciaComerciantePorFecha(
  comercianteId: string,
  fecha: string
): RegistroAsistencia | null {
  const registros = asistenciaHistorica.get(fecha) ?? [];
  return registros.find((r) => r.comercianteId === comercianteId) ?? null;
}

export function getAsistenciaComercianteRango(
  comercianteId: string,
  fechaInicio: string,
  fechaFin: string
): RegistroAsistencia[] {
  const resultado: RegistroAsistencia[] = [];
  asistenciaHistorica.forEach((registros, fecha) => {
    if (fecha >= fechaInicio && fecha <= fechaFin) {
      const reg = registros.find((r) => r.comercianteId === comercianteId);
      if (reg) resultado.push(reg);
    }
  });
  return resultado.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function getAsistenciaNaveRango(
  naveId: string,
  fechaInicio: string,
  fechaFin: string
): RegistroAsistencia[] {
  const puestosNave = new Set(
    allPuestos.filter((p) => p.naveId === naveId).map((p) => p.id)
  );
  const resultado: RegistroAsistencia[] = [];
  asistenciaHistorica.forEach((registros, fecha) => {
    if (fecha >= fechaInicio && fecha <= fechaFin) {
      resultado.push(
        ...registros.filter((r) => puestosNave.has(r.puestoId))
      );
    }
  });
  return resultado.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function getAsistenciaRango(
  fechaInicio: string,
  fechaFin: string
): RegistroAsistencia[] {
  const resultado: RegistroAsistencia[] = [];
  asistenciaHistorica.forEach((registros, fecha) => {
    if (fecha >= fechaInicio && fecha <= fechaFin) {
      resultado.push(...registros);
    }
  });
  return resultado.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function getTotalPuestos(): number {
  return allPuestos.length;
}

export function getPuestosOcupados(): number {
  return allPuestos.filter((p) => p.estado === "Ocupado").length;
}

export function getPuestosVacantes(): number {
  return allPuestos.filter((p) => p.estado === "Vacante").length;
}

// ── Estado mutable en memoria (para cambios en la sesión) ───────────────────

const asistenciaOverrides = new Map<string, EstadoAsistencia>();

export function setEstadoAsistencia(
  comercianteId: string,
  fecha: string,
  estado: EstadoAsistencia,
  observacion?: string,
  observacionTexto?: string
) {
  const key = `${comercianteId}:${fecha}`;
  asistenciaOverrides.set(key, estado);

  // También actualizar el histórico
  const registros = asistenciaHistorica.get(fecha) ?? [];
  const idx = registros.findIndex((r) => r.comercianteId === comercianteId);
  if (idx >= 0) {
    const regActual = registros[idx];
    const observaciones = regActual.observaciones ? [...regActual.observaciones] : [];
    if (observacionTexto) {
      observaciones.push({
        id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tipo: "ObservacionesGeneral",
        texto: observacionTexto,
        fechaHora: format(new Date(), "hh:mm a"),
      });
    }
    registros[idx] = {
      ...regActual,
      estado,
      observacion: observacion !== undefined ? observacion : regActual.observacion,
      observacionTexto: observacionTexto !== undefined ? observacionTexto : regActual.observacionTexto,
      observaciones,
    };
  } else {
    const comerciante = getComerciantePorId(comercianteId);
    const observaciones: ObservacionDetalle[] = [];
    if (observacionTexto) {
      observaciones.push({
        id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tipo: "ObservacionesGeneral",
        texto: observacionTexto,
        fechaHora: format(new Date(), "hh:mm a"),
      });
    }
    registros.push({
      id: `asist-${comercianteId}-${fecha}`,
      comercianteId,
      puestoId: comerciante?.puestoId ?? "",
      fecha,
      estado,
      observacion,
      observacionTexto,
      observaciones,
      permisos: [],
    });
    asistenciaHistorica.set(fecha, registros);
  }

  // Sincronización en vivo con Control de Supervisores (auditoria.mock.ts)
  try {
    const com = getComerciantePorId(comercianteId);
    if (com) {
      const naveNombre = com.nave || "NAVE A";
      const navesList = getNaves();
      const naveObj = navesList.find(
        (n) =>
          n.nombre.toUpperCase() === naveNombre.toUpperCase() ||
          n.id === naveNombre.toLowerCase()
      );
      const naveIdFinal = naveObj?.id || naveNombre.toLowerCase().replace(/\s+/g, "-");
      const supervisorNombre = naveObj?.supervisores?.[0] || "Supervisor Asignado";

      sincronizarControlAsistenciaManual({
        naveId: naveIdFinal,
        naveNombre: naveObj?.nombre || naveNombre,
        supervisorNombre,
        fechaJornada: fecha,
        comercianteId,
        ciu: com.ciu,
        cedula: com.cedula,
        contribuyente: com.contribuyente,
        puesto: com.puestoId || "",
        nuevoEstado: estado,
      });
    }
  } catch {
    // Tolerante ante llamadas tempranas de inicio
  }
}

/**
 * Registra asistencia masiva mediante persistencia desde la última fecha con toma registrada.
 * 
 * Reglas de negocio vigentes:
 * 1. Por defecto todo comerciante con puesto ocupado se asume en estado "Presente" en la jornada actual.
 * 2. Al ejecutar la persistencia en el día actual:
 *    - Toma como referencia el último día registrado anterior (fechaOrigen).
 *    - Ignora por completo las observaciones (las observaciones son manuales por día y nunca se arrastran).
 *    - Los permisos NO se expanden por persistencia: se rigen estrictamente por sus fechas de vigencia
 *      (fechaInicio a fechaFin). Si un comerciante tenía Permiso ayer y hoy expiró, hoy queda en Presente.
 *      Si hoy tiene un permiso vigente, conserva Permiso.
 *    - Transición de Estado: Como todos parten en Presente por defecto hoy, la persistencia toma del último
 *      día registrado a quienes estuvieron en "Ausente" y los pasa a "Ausente" hoy (conservando Presente para
 *      los demás y respetando si alguno fue modificado manualmente hoy).
 * 
 * Conexión futura con backend real:
 * Se invocará vía POST /api/v1/asistencia/persistencia con payload:
 * { naveId, fechaHasta, supervisorNombre, comentario }.
 * El backend ejecutará la transacción actualizando a "Ausente" a aquellos comerciantes que
 * en la jornada anterior estuvieron ausentes y que hoy no cuenten con permiso vigente ni override manual.
 */
export function registrarAsistenciaConPersistenciaMock(
  naveId: string,
  fechaHasta: string,
  supervisorNombre: string,
  comentario?: string
): { fechaOrigen: string; diasCubiertos: number } {
  const navesList = getNaves();
  const nave = navesList.find(
    (n) => n.id === naveId || n.nombre.toLowerCase() === naveId.toLowerCase()
  );
  const naveNombre = nave?.nombre || naveId.toUpperCase();

  // 1. Identificar comerciantes de la nave
  const comerciantesNave = allComerciantes.filter(
    (c) =>
      (c.nave ?? "").toUpperCase() === naveNombre.toUpperCase() ||
      (c.nave ?? "").toLowerCase() === naveId.toLowerCase()
  );

  if (comerciantesNave.length === 0) {
    throw new Error(`No se encontraron comerciantes activos en la nave ${naveNombre}.`);
  }

  // 2. Buscar hacia atrás la fechaOrigen (último día con toma real)
  const fechaHastaDate = new Date(fechaHasta + "T00:00:00");
  let fechaOrigen: string | null = null;

  for (let d = 1; d <= 30; d++) {
    const fStr = format(subDays(fechaHastaDate, d), "yyyy-MM-dd");
    const regs = asistenciaHistorica.get(fStr);
    if (regs && regs.length > 0) {
      const tieneTomaReal = regs.some(
        (r) =>
          comerciantesNave.some((c) => c.idInterno === r.comercianteId) &&
          (r.estado === "Presente" || r.estado === "Ausente")
      );
      if (tieneTomaReal) {
        fechaOrigen = fStr;
        break;
      }
    }
  }

  // Si no se encontró en los últimos 30 días, tomar el día inmediatamente anterior
  if (!fechaOrigen) {
    fechaOrigen = format(subDays(fechaHastaDate, 1), "yyyy-MM-dd");
  }

  // 3. Generar intervalo [fechaOrigen + 1 día, fechaHasta]
  const fechaOrigenDate = new Date(fechaOrigen + "T00:00:00");
  const fechaInicioIntervalo = addDays(fechaOrigenDate, 1);

  if (fechaInicioIntervalo > fechaHastaDate) {
    return { fechaOrigen, diasCubiertos: 0 };
  }

  const fechasIntervalo = eachDayOfInterval({
    start: fechaInicioIntervalo,
    end: fechaHastaDate,
  }).map((d) => format(d, "yyyy-MM-dd"));

  const regsOrigen = asistenciaHistorica.get(fechaOrigen) ?? [];

  // Mapeo detallado por cada fecha destino para el Control de Supervisores
  const mapeoPorFecha: Record<
    string,
    Array<{
      comercianteId: string;
      ciu: string;
      cedula: string;
      contribuyente: string;
      puesto: string;
      estado: EstadoAsistencia;
      metodo: "MANUAL" | "PERSISTENCIA";
    }>
  > = {};

  for (const fechaDestino of fechasIntervalo) {
    let regsDestino = asistenciaHistorica.get(fechaDestino);
    if (!regsDestino) {
      regsDestino = [];
      asistenciaHistorica.set(fechaDestino, regsDestino);
    }

    const comerciantesMapeadosFecha: Array<{
      comercianteId: string;
      ciu: string;
      cedula: string;
      contribuyente: string;
      puesto: string;
      estado: EstadoAsistencia;
      metodo: "MANUAL" | "PERSISTENCIA";
    }> = [];

    for (const comerciante of comerciantesNave) {
      const regDestinoExistente = regsDestino.find(
        (r) => r.comercianteId === comerciante.idInterno
      );

      const overrideKey = `${comerciante.idInterno}:${fechaDestino}`;
      const tieneOverrideManual = asistenciaOverrides.has(overrideKey);

      // ── REGLA 1: Comerciantes ya modificados manualmente hoy NO se tocan ──
      if (tieneOverrideManual && regDestinoExistente) {
        comerciantesMapeadosFecha.push({
          comercianteId: comerciante.idInterno,
          ciu: comerciante.ciu,
          cedula: comerciante.cedula,
          contribuyente: comerciante.contribuyente,
          puesto: comerciante.puestoId ?? "",
          estado: regDestinoExistente.estado,
          metodo: "MANUAL",
        });
        continue;
      }

      // ── REGLA 2: Permisos se rigen por su propia vigencia por rango de fechas ──
      const tienePermisoActivo =
        (regDestinoExistente?.estado === "Permiso" && regDestinoExistente.permisos?.some((p) => p.fechaInicio <= fechaDestino && p.fechaFin >= fechaDestino)) ||
        asistenciaOverrides.get(overrideKey) === "Permiso";

      let estadoFinal: EstadoAsistencia = "Presente";

      if (tienePermisoActivo) {
        estadoFinal = "Permiso";
      } else {
        // En el día anterior (fechaOrigen): si estaba Ausente, se pasa a Ausente hoy
        const regOrigen = regsOrigen.find((r) => r.comercianteId === comerciante.idInterno);
        if (regOrigen && regOrigen.estado === "Ausente") {
          estadoFinal = "Ausente";
        } else {
          estadoFinal = "Presente";
        }
      }

      // Cero observaciones arrastradas: las observaciones nunca se copian
      if (regDestinoExistente) {
        regDestinoExistente.estado = estadoFinal;
        regDestinoExistente.observacion = undefined;
        regDestinoExistente.observacionTexto = undefined;
        regDestinoExistente.observaciones = [];
      } else {
        regsDestino.push({
          id: `asist-${comerciante.idInterno}-${fechaDestino}`,
          comercianteId: comerciante.idInterno,
          puestoId: comerciante.puestoId ?? "",
          fecha: fechaDestino,
          estado: estadoFinal,
          observaciones: [],
          permisos: [],
        });
      }

      comerciantesMapeadosFecha.push({
        comercianteId: comerciante.idInterno,
        ciu: comerciante.ciu,
        cedula: comerciante.cedula,
        contribuyente: comerciante.contribuyente,
        puesto: comerciante.puestoId ?? "",
        estado: estadoFinal,
        metodo: "PERSISTENCIA",
      });
    }

    mapeoPorFecha[fechaDestino] = comerciantesMapeadosFecha;
  }

  // 4. Sincronizar con Control de Supervisores (auditoria.mock.ts)
  sincronizarControlPersistencia({
    naveId,
    naveNombre,
    supervisorNombre,
    fechaOrigen,
    fechasDestino: fechasIntervalo,
    comentario,
    mapeoPorFecha,
  });

  return {
    fechaOrigen,
    diasCubiertos: fechasIntervalo.length,
  };
}

export function agregarObservacionMock(
  comercianteId: string,
  fecha: string,
  texto: string,
  tipo: TipoObservacion = "ObservacionesGeneral",
  numeroDocumento?: string,
  fechaHora?: string
): ObservacionDetalle {
  if (
    (tipo === "Citaciones" || tipo === "Notificación") &&
    !numeroDocumento?.trim()
  ) {
    throw new Error(
      "El número de referencia o documento es obligatorio para Citaciones y Notificaciones."
    );
  }

  let registros = asistenciaHistorica.get(fecha);
  if (!registros) {
    registros = [];
    asistenciaHistorica.set(fecha, registros);
  }
  let reg = registros.find((r) => r.comercianteId === comercianteId);
  if (!reg) {
    const comerciante = getComerciantePorId(comercianteId);
    reg = {
      id: `asist-${comercianteId}-${fecha}`,
      comercianteId,
      puestoId: comerciante?.puestoId ?? "",
      fecha,
      estado: "Presente",
      observaciones: [],
      permisos: [],
    };
    registros.push(reg);
  }
  if (!reg.observaciones) {
    reg.observaciones = [];
  }
  const nuevaObs: ObservacionDetalle = {
    id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tipo,
    numeroDocumento: numeroDocumento?.trim() || undefined,
    texto,
    fechaHora: fechaHora || format(new Date(), "hh:mm a"),
  };
  reg.observaciones.push(nuevaObs);
  // Requerimiento: "Observación" es un metadato aditivo, NO muta el estado principal
  return nuevaObs;
}

export function eliminarObservacionMock(
  comercianteId: string,
  fecha: string,
  observacionId: string
): void {
  const registros = asistenciaHistorica.get(fecha);
  if (!registros) return;
  const reg = registros.find((r) => r.comercianteId === comercianteId);
  if (!reg || !reg.observaciones) return;
  reg.observaciones = reg.observaciones.filter((o) => o.id !== observacionId);
  if (reg.observaciones.length > 0) {
    const ultima = reg.observaciones[reg.observaciones.length - 1];
    reg.observacion = ultima.texto;
    reg.observacionTexto = ultima.texto;
  } else {
    reg.observacion = undefined;
    reg.observacionTexto = undefined;
  }
}

export function agregarPermisoMock(
  comercianteId: string,
  fechaAsignacion: string,
  motivo: string,
  fechaInicio: string,
  fechaFin: string
): PermisoDetalle {
  let registros = asistenciaHistorica.get(fechaAsignacion);
  if (!registros) {
    registros = [];
    asistenciaHistorica.set(fechaAsignacion, registros);
  }
  let reg = registros.find((r) => r.comercianteId === comercianteId);
  if (!reg) {
    const comerciante = getComerciantePorId(comercianteId);
    reg = {
      id: `asist-${comercianteId}-${fechaAsignacion}`,
      comercianteId,
      puestoId: comerciante?.puestoId ?? "",
      fecha: fechaAsignacion,
      estado: "Presente",
      observaciones: [],
      permisos: [],
    };
    registros.push(reg);
  }
  if (!reg.permisos) {
    reg.permisos = [];
  }
  const yaExiste = reg.permisos.some(
    (p) => p.fechaInicio === fechaInicio && p.fechaFin === fechaFin
  );
  if (yaExiste) {
    throw new Error("Ya existe un permiso registrado para este rango de fechas.");
  }

  const nuevoPermiso: PermisoDetalle = {
    id: `perm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    motivo,
    fechaAsignacion,
    fechaInicio,
    fechaFin,
    fecha: fechaAsignacion,
  };
  reg.permisos.push(nuevoPermiso);

  // Marcar los días dentro del rango como Permiso
  const startDate = new Date(fechaInicio + "T00:00:00");
  const endDate = new Date(fechaFin + "T00:00:00");
  const current = new Date(startDate);

  while (current <= endDate) {
    const dStr = format(current, "yyyy-MM-dd");
    let dRegs = asistenciaHistorica.get(dStr);
    if (!dRegs) {
      dRegs = [];
      asistenciaHistorica.set(dStr, dRegs);
    }
    const dReg = dRegs.find((r) => r.comercianteId === comercianteId);
    if (dReg) {
      dReg.estado = "Permiso";
      dReg.permisoInicio = fechaInicio;
      dReg.permisoFin = fechaFin;
      if (!dReg.permisos) dReg.permisos = [];
      if (!dReg.permisos.some((p) => p.id === nuevoPermiso.id)) {
        dReg.permisos.push(nuevoPermiso);
      }
    } else {
      const com = getComerciantePorId(comercianteId);
      dRegs.push({
        id: `asist-${comercianteId}-${dStr}`,
        comercianteId,
        puestoId: com?.puestoId ?? "",
        fecha: dStr,
        estado: "Permiso",
        observacion: motivo,
        permisoInicio: fechaInicio,
        permisoFin: fechaFin,
        observaciones: [],
        permisos: [nuevoPermiso],
      });
    }
    asistenciaOverrides.set(`${comercianteId}:${dStr}`, "Permiso");
    current.setDate(current.getDate() + 1);
  }

  return nuevoPermiso;
}

export function eliminarPermisoMock(
  comercianteId: string,
  fecha: string,
  permisoId: string
): void {
  asistenciaHistorica.forEach((regs, f) => {
    const reg = regs.find((r) => r.comercianteId === comercianteId);
    if (reg?.permisos) {
      reg.permisos = reg.permisos.filter((p) => p.id !== permisoId);
      if (reg.permisos.length === 0 && reg.estado === "Permiso") {
        reg.estado = "Presente";
        reg.permisoInicio = undefined;
        reg.permisoFin = undefined;
        reg.observacion = undefined;
        asistenciaOverrides.delete(`${comercianteId}:${f}`);
      }
    }
  });
}

export function getEstadoOverride(
  comercianteId: string,
  fecha: string
): EstadoAsistencia | null {
  return asistenciaOverrides.get(`${comercianteId}:${fecha}`) ?? null;
}

export function setPermisoComercianteRango(
  comercianteId: string,
  inicio: string,
  fin: string,
  motivo: string = "Permiso concedido"
) {
  // Marcar todos los días del rango como Permiso
  const startDate = new Date(inicio + "T00:00:00");
  const endDate = new Date(fin + "T00:00:00");
  const current = new Date(startDate);

  while (current <= endDate) {
    const fecha = format(current, "yyyy-MM-dd");
    try {
      agregarPermisoMock(comercianteId, fecha, motivo, inicio, fin);
    } catch {
      // Si ya existía un permiso para esa fecha exacta en el bucle, ignorar duplicado de rango
    }
    current.setDate(current.getDate() + 1);
  }
}

// ── CRUD de Comerciantes (para el módulo TIC) ────────────────────────────────

let nextComerciante = allComerciantes.length + 1;

export function agregarComerciante(data: {
  ciu: string;
  contribuyente: string;
  actividad: string;
  naveId?: string;
  puestoId: string | null;
  cedula?: string;
  nave?: string;
  estadoRegistro?: "Habilitado" | "Deshabilitado";
}): Comerciante {
  const comId = `com-${String(nextComerciante++).padStart(4, "0")}`;
  const cedula = data.cedula || genCedula(nextComerciante);

  // 1. Detección o auto-creación de Nave
  let naveEncontrada: Nave | null = null;
  const navesExistentes = obtenerNaves();
  const nombreBuscado = (data.nave || "").trim().toUpperCase();
  const idBuscado = (data.naveId || "").trim();

  if (idBuscado) {
    naveEncontrada = navesExistentes.find((n) => n.id === idBuscado) ?? null;
  }
  if (!naveEncontrada && nombreBuscado) {
    naveEncontrada = navesExistentes.find(
      (n) => n.nombre.trim().toUpperCase() === nombreBuscado
    ) ?? null;
  }

  if (!naveEncontrada && (nombreBuscado || idBuscado)) {
    const nombreCrear = data.nave?.trim() || `NAVE ${idBuscado.toUpperCase()}`;
    naveEncontrada = crearNave(nombreCrear, 100);
  }

  const naveFinalNombre = naveEncontrada?.nombre || data.nave;
  const naveIdFinal = naveEncontrada ? naveEncontrada.id : (data.naveId || "nave-a");

  // 2. Manejo y auto-creación de Puesto
  if (data.puestoId && data.puestoId !== "-") {
    const puestoCodigo = data.puestoId.trim();

    let puesto = allPuestos.find(
      (p) =>
        p.naveId === naveIdFinal &&
        (p.codigo.toUpperCase() === puestoCodigo.toUpperCase() || p.id === puestoCodigo)
    );

    if (!puesto) {
      const puestoUnicoId = `${naveIdFinal}-${puestoCodigo}`;
      puesto = {
        id: puestoUnicoId,
        codigo: puestoCodigo,
        naveId: naveIdFinal,
        estado: "Ocupado",
        comercianteId: comId,
      };
      allPuestos.push(puesto);
    } else {
      puesto.estado = "Ocupado";
      puesto.comercianteId = comId;
    }

    if (naveEncontrada) {
      registrarNaveConComerciantes(naveEncontrada.id);
    }
  }

  const comerciante: Comerciante = {
    idInterno: comId,
    ciu: data.ciu,
    cedula,
    contribuyente: data.contribuyente,
    actividad: data.actividad,
    puestoId: data.puestoId && data.puestoId !== "-" ? data.puestoId : null,
    nave: naveFinalNombre,
    estadoRegistro: data.estadoRegistro ?? "Habilitado",
    creadoPor: "sistema",
  };

  allComerciantes.push(comerciante);

  return comerciante;
}

export function editarComerciante(
  idInterno: string,
  data: {
    ciu?: string;
    contribuyente?: string;
    actividad?: string;
    naveId?: string;
    puestoId?: string | null;
    nave?: string;
    cedula?: string;
    estadoRegistro?: "Habilitado" | "Deshabilitado";
    deshabilitadoPor?: string;
    modificadoPor?: string;
  }
): Comerciante | null {
  const idx = allComerciantes.findIndex((c) => c.idInterno === idInterno);
  if (idx === -1) return null;

  const old = allComerciantes[idx];

  // Si cambió de puesto, liberar el anterior y asignar el nuevo
  if (data.puestoId && data.puestoId !== old.puestoId) {
    const oldPuesto = allPuestos.find((p) => p.id === old.puestoId);
    if (oldPuesto) {
      oldPuesto.estado = "Vacante";
      oldPuesto.comercianteId = null;
    }
    const newPuesto = allPuestos.find((p) => p.id === data.puestoId);
    if (newPuesto) {
      newPuesto.estado = "Ocupado";
      newPuesto.comercianteId = old.idInterno;
    }
  }

  allComerciantes[idx] = {
    ...old,
    ...(data.ciu !== undefined && { ciu: data.ciu }),
    ...(data.contribuyente !== undefined && { contribuyente: data.contribuyente }),
    ...(data.actividad !== undefined && { actividad: data.actividad }),
    ...(data.puestoId !== undefined && { puestoId: data.puestoId }),
    ...(data.estadoRegistro !== undefined && { estadoRegistro: data.estadoRegistro }),
    ...(data.deshabilitadoPor !== undefined && { deshabilitadoPor: data.deshabilitadoPor }),
  };

  return allComerciantes[idx];
}

export function eliminarComerciante(idInterno: string): boolean {
  const idx = allComerciantes.findIndex((c) => c.idInterno === idInterno);
  if (idx === -1) return false;

  const com = allComerciantes[idx];

  // Soft delete en lugar de borrar
  com.estadoRegistro = "Deshabilitado";
  com.deshabilitadoPor = "sistema";

  // Liberar puesto
  if (com.puestoId) {
    const puesto = allPuestos.find((p) => p.id === com.puestoId);
    if (puesto) {
      puesto.estado = "Vacante";
      puesto.comercianteId = null;
    }
    com.puestoId = null;
  }
  
  return true;
}

/** Obtener puestos vacantes para una nave específica */
export function getPuestosVacantesPorNave(naveId: string): Puesto[] {
  return allPuestos.filter(
    (p) => p.naveId === naveId && p.estado === "Vacante"
  );
}

// ── Sincronización de Capacidad y Puestos ────────────────────────────────────

export function sincronizarPuestosNave(
  naveId: string,
  cantidadPuestos: number,
  nombreNave?: string
): void {
  const nave = obtenerNavePorId(naveId);
  const nombre = nombreNave || nave?.nombre || naveId;
  const slug =
    nombre
      .toUpperCase()
      .replace(/^NAVE\s*/i, "")
      .replace(/[^A-Z0-9]/g, "") || naveId.replace(/^nave-/, "").toUpperCase();

  const puestosExistentes = allPuestos.filter((p) => p.naveId === naveId);
  const cantidadDeseada = Math.max(1, Math.floor(cantidadPuestos));

  if (puestosExistentes.length < cantidadDeseada) {
    const faltantes = cantidadDeseada - puestosExistentes.length;
    let maxIdx = 0;
    puestosExistentes.forEach((p) => {
      const match = p.codigo.match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxIdx) maxIdx = num;
      }
    });

    for (let i = 1; i <= faltantes; i++) {
      const numPuesto = maxIdx + i;
      const codigoPuesto = `P-${slug}${String(numPuesto).padStart(3, "0")}`;
      const idPuesto = `${naveId}-${codigoPuesto}`;
      allPuestos.push({
        id: idPuesto,
        codigo: codigoPuesto,
        naveId,
        estado: "Vacante",
        comercianteId: null,
      });
    }
  } else if (puestosExistentes.length > cantidadDeseada) {
    const excedente = puestosExistentes.length - cantidadDeseada;
    let eliminados = 0;

    for (let i = allPuestos.length - 1; i >= 0 && eliminados < excedente; i--) {
      const p = allPuestos[i];
      if (p.naveId === naveId && p.estado === "Vacante" && !p.comercianteId) {
        allPuestos.splice(i, 1);
        eliminados++;
      }
    }
  }
}

export function crearNave(
  nombre: string,
  cantidadPuestos: number,
  supervisores: string[] = []
): Nave {
  const nueva = mockCrearNave(nombre, cantidadPuestos, supervisores);
  sincronizarPuestosNave(nueva.id, nueva.cantidadPuestos, nueva.nombre);
  return nueva;
}

export function actualizarNave(
  id: string,
  data: {
    nombre?: string;
    cantidadPuestos?: number;
    supervisores?: string[];
  }
): Nave | null {
  const actualizada = mockActualizarNave(id, data);
  if (actualizada) {
    if (data.cantidadPuestos !== undefined) {
      sincronizarPuestosNave(actualizada.id, actualizada.cantidadPuestos, actualizada.nombre);
    }
    if (data.nombre) {
      const nuevoNombreUpper = data.nombre.trim().toUpperCase();
      allComerciantes.forEach((c) => {
        if (c.nave?.toUpperCase() === actualizada.nombre.toUpperCase()) {
          c.nave = nuevoNombreUpper;
        }
      });
    }
  }
  return actualizada;
}

// ── Motor de Reconciliación Mensual de Catastro ──────────────────────────────

function normalizarCodigoPuesto(cod: string): string {
  if (!cod || cod === "-") return "";
  let clean = cod.trim().toUpperCase();
  clean = clean.replace(/^P-[A-Z0-9]+-?/i, "").replace(/^P-/i, "");
  if (/^0+(\d+)$/.test(clean)) {
    clean = clean.replace(/^0+/, "");
  }
  return clean;
}

function sonCodigosPuestoEquivalentes(cod1: string, cod2: string): boolean {
  if (!cod1 || !cod2 || cod1 === "-" || cod2 === "-") return false;
  const upper1 = cod1.trim().toUpperCase();
  const upper2 = cod2.trim().toUpperCase();
  if (upper1 === upper2) return true;
  const n1 = normalizarCodigoPuesto(upper1);
  const n2 = normalizarCodigoPuesto(upper2);
  return n1.length > 0 && n1 === n2;
}

export function analizarReconciliacion(
  registros: ImportacionRegistro[]
): ReconciliacionResumen {
  const regConNave = registros.find((r) => r.nave && r.nave !== "NO DEFINIDA");
  const naveDetectada = (regConNave?.nave || "NO DEFINIDA").trim().toUpperCase();

  const navesExistentes = obtenerNaves();
  const naveEncontrada = navesExistentes.find(
    (n) => n.nombre.trim().toUpperCase() === naveDetectada
  ) ?? null;

  if (!naveEncontrada) {
    const totalOcupados = registros.length;
    const capacidadNave = Math.max(totalOcupados, 100);
    const totalVacantes = Math.max(0, capacidadNave - totalOcupados);
    const cambiosDetectados: CambioReconciliacion[] = registros.map((r) => ({
      tipo: "NUEVO",
      puesto: r.puesto || "-",
      nuevo: r.nombre,
      detalle: `Nuevo comerciante ${r.nombre} asignado al puesto ${r.puesto || "-"}`,
    }));

    return {
      naveDetectada,
      esNaveNueva: true,
      capacidadNave,
      totalOcupados,
      totalVacantes,
      cambiosDetectados,
    };
  }

  // Nave existente
  const puestosNave = allPuestos.filter((p) => p.naveId === naveEncontrada.id);
  const puestosDeNaveIds = new Set(puestosNave.map((p) => p.id));
  const comerciantesNave = allComerciantes.filter(
    (c) =>
      c.estadoRegistro !== "Deshabilitado" &&
      (c.nave?.trim().toUpperCase() === naveDetectada ||
        (c.puestoId &&
          (puestosDeNaveIds.has(c.puestoId) ||
            puestosNave.some((p) => p.codigo === c.puestoId))))
  );

  const totalOcupados = registros.length;
  const capacidadNave = Math.max(naveEncontrada.cantidadPuestos, totalOcupados);
  const totalVacantes = Math.max(0, capacidadNave - totalOcupados);
  const cambiosDetectados: CambioReconciliacion[] = [];

  const cedulasEnArchivo = new Set(registros.map((r) => r.cedula));
  const cedulasVistas = new Set<string>();

  for (const reg of registros) {
    if (cedulasVistas.has(reg.cedula)) continue;
    cedulasVistas.add(reg.cedula);

    const comMismaCedula = comerciantesNave.find((c) => c.cedula === reg.cedula);
    const puestoActual = puestosNave.find(
      (p) =>
        sonCodigosPuestoEquivalentes(p.codigo, reg.puesto) ||
        p.id === reg.puesto ||
        p.codigo.toUpperCase() === (reg.puesto || "").toUpperCase()
    );
    const ocupanteActualPuesto =
      puestoActual && puestoActual.comercianteId
        ? comerciantesNave.find((c) => c.idInterno === puestoActual.comercianteId)
        : null;

    if (comMismaCedula) {
      const puestoAnterior = comMismaCedula.puestoId || "-";
      if (!sonCodigosPuestoEquivalentes(puestoAnterior, reg.puesto)) {
        cambiosDetectados.push({
          tipo: "CAMBIO_PUESTO",
          puesto: reg.puesto,
          anterior: puestoAnterior,
          nuevo: reg.puesto,
          detalle: `Puesto actualizado de ${puestoAnterior} a ${reg.puesto} para ${reg.nombre}`,
        });
      } else if (
        comMismaCedula.contribuyente.trim().toUpperCase() !== reg.nombre.trim().toUpperCase() ||
        comMismaCedula.actividad.trim().toUpperCase() !== reg.actividad.trim().toUpperCase()
      ) {
        cambiosDetectados.push({
          tipo: "ACTUALIZACION",
          puesto: reg.puesto,
          anterior: `${comMismaCedula.contribuyente} (${comMismaCedula.actividad})`,
          nuevo: `${reg.nombre} (${reg.actividad})`,
          detalle: `Datos actualizados para ${reg.nombre} (${reg.actividad})`,
        });
      }
    } else if (ocupanteActualPuesto && ocupanteActualPuesto.cedula !== reg.cedula) {
      cambiosDetectados.push({
        tipo: "REEMPLAZO_OCUPANTE",
        puesto: reg.puesto,
        anterior: ocupanteActualPuesto.contribuyente,
        nuevo: reg.nombre,
        detalle: `Puesto ${reg.puesto}: Se reemplazó a ${ocupanteActualPuesto.contribuyente} por ${reg.nombre}`,
      });
    } else {
      cambiosDetectados.push({
        tipo: "NUEVO",
        puesto: reg.puesto,
        nuevo: reg.nombre,
        detalle: `Nuevo comerciante ${reg.nombre} asignado al puesto ${reg.puesto}`,
      });
    }
  }

  // Puestos que pasan a vacantes (comerciantes anteriores que no vinieron en el nuevo archivo)
  const comerciantesSalientes = comerciantesNave.filter(
    (c) => !cedulasEnArchivo.has(c.cedula)
  );

  for (const comSaliente of comerciantesSalientes) {
    cambiosDetectados.push({
      tipo: "VACANTE",
      puesto: comSaliente.puestoId || "S/N",
      anterior: comSaliente.contribuyente,
      detalle: `Puesto ${comSaliente.puestoId || "S/N"} queda Vacante (anterior ocupante: ${comSaliente.contribuyente})`,
    });
  }

  return {
    naveDetectada,
    esNaveNueva: false,
    capacidadNave,
    totalOcupados,
    totalVacantes,
    cambiosDetectados,
  };
}

export function ejecutarReconciliacionImportacion(
  registros: ImportacionRegistro[]
): ImportacionResultado {
  const reconciliacion = analizarReconciliacion(registros);
  const errores: { fila: number; mensaje: string }[] = [];
  let exitosos = 0;

  const naveDetectada = reconciliacion.naveDetectada;
  let naveActual = obtenerNaves().find(
    (n) => n.nombre.trim().toUpperCase() === naveDetectada
  );

  if (!naveActual) {
    naveActual = crearNave(naveDetectada, reconciliacion.capacidadNave);
  } else if (naveActual.cantidadPuestos < reconciliacion.capacidadNave) {
    actualizarNave(naveActual.id, { cantidadPuestos: reconciliacion.capacidadNave });
  }

  const naveIdFinal = naveActual.id;
  const puestosNave = allPuestos.filter((p) => p.naveId === naveIdFinal);
  const puestosDeNaveIds = new Set(puestosNave.map((p) => p.id));
  const cedulasEnArchivo = new Set(registros.map((r) => r.cedula));

  // Desvincular comerciantes salientes de sus puestos
  const comerciantesNave = allComerciantes.filter(
    (c) =>
      c.estadoRegistro !== "Deshabilitado" &&
      (c.nave?.trim().toUpperCase() === naveDetectada ||
        (c.puestoId &&
          (puestosDeNaveIds.has(c.puestoId) ||
            puestosNave.some((p) => p.codigo === c.puestoId))))
  );

  for (const com of comerciantesNave) {
    if (!cedulasEnArchivo.has(com.cedula)) {
      const puestoAnterior = allPuestos.find(
        (p) =>
          p.naveId === naveIdFinal &&
          (p.comercianteId === com.idInterno ||
            p.id === com.puestoId ||
            p.codigo === com.puestoId)
      );
      if (puestoAnterior) {
        puestoAnterior.estado = "Vacante";
        puestoAnterior.comercianteId = null;
      }
      com.puestoId = null;
    }
  }

  // Insertar o actualizar comerciantes del archivo
  for (let i = 0; i < registros.length; i++) {
    const reg = registros[i];
    const nombre = (reg.nombre || reg.contribuyente || "").trim();
    if (
      !nombre ||
      nombre.toUpperCase() === "SIN NOMBRE" ||
      !reg.cedula ||
      reg.cedula === "-"
    ) {
      errores.push({
        fila: i + 1,
        mensaje: "El campo Nombre y Cédula son obligatorios.",
      });
      continue;
    }

    try {
      const comExistente = allComerciantes.find((c) => c.cedula === reg.cedula);
      const puestoCodigo = reg.puesto && reg.puesto !== "-" ? reg.puesto.trim() : null;

      let puestoTarget = puestoCodigo
        ? allPuestos.find(
            (p) =>
              p.naveId === naveIdFinal &&
              (sonCodigosPuestoEquivalentes(p.codigo, puestoCodigo) ||
                p.codigo.toUpperCase() === puestoCodigo.toUpperCase() ||
                p.id === puestoCodigo)
          )
        : null;

      if (!puestoTarget && puestoCodigo) {
        const puestoUnicoId = `${naveIdFinal}-${puestoCodigo}`;
        puestoTarget = {
          id: puestoUnicoId,
          codigo: puestoCodigo,
          naveId: naveIdFinal,
          estado: "Ocupado",
          comercianteId: null,
        };
        allPuestos.push(puestoTarget);
      }

      if (comExistente) {
        // Liberar puesto anterior si cambió
        if (
          comExistente.puestoId &&
          puestoTarget &&
          comExistente.puestoId !== puestoTarget.codigo &&
          comExistente.puestoId !== puestoTarget.id
        ) {
          const prevP = allPuestos.find(
            (p) =>
              p.naveId === naveIdFinal &&
              (p.id === comExistente?.puestoId || p.codigo === comExistente?.puestoId)
          );
          if (prevP) {
            prevP.estado = "Vacante";
            prevP.comercianteId = null;
          }
        }

        comExistente.contribuyente = nombre;
        comExistente.actividad = reg.actividad || "GENERAL";
        comExistente.nave = naveActual.nombre;
        comExistente.puestoId = puestoCodigo;
        comExistente.estadoRegistro = "Habilitado";

        if (puestoTarget) {
          puestoTarget.estado = "Ocupado";
          puestoTarget.comercianteId = comExistente.idInterno;
        }
      } else {
        // Si el puesto estaba ocupado por otro, desvincular al anterior
        if (puestoTarget && puestoTarget.comercianteId) {
          const ocupanteAnterior = allComerciantes.find(
            (c) => c.idInterno === puestoTarget?.comercianteId
          );
          if (ocupanteAnterior) {
            ocupanteAnterior.puestoId = null;
          }
        }

        agregarComerciante({
          ciu: reg.ciu || "-",
          cedula: reg.cedula,
          contribuyente: nombre,
          actividad: reg.actividad || "GENERAL",
          nave: naveActual.nombre,
          puestoId: puestoCodigo,
          estadoRegistro: "Habilitado",
        });
      }

      exitosos++;
    } catch {
      errores.push({
        fila: i + 1,
        mensaje: `Error al persistir comerciante "${nombre}"`,
      });
    }
  }

  sincronizarPuestosNave(naveIdFinal, reconciliacion.capacidadNave, naveActual.nombre);
  registrarNaveConComerciantes(naveIdFinal);

  return {
    exitosos,
    errores,
    reconciliacion,
  };
}
