// ── Infraestructura: Mock de Auditoría y Control de Supervisores ─────────────
/**
 * @file auditoria.mock.ts
 * Simula el repositorio de logs de auditoría y las sesiones de Control de Supervisores.
 * 
 * ¿Cómo funciona en el mock?
 * Almacena en memoria dos colecciones:
 * 1. logsGenerados: Registros de auditoría histórica del sistema (login, logout, cambios de puesto, etc.).
 * 2. sesionesControl: Sesiones detalladas de toma de lista de supervisores por nave y jornada,
 *    incluyendo trazabilidad de persistencia, modificaciones manuales posteriores, retrasos
 *    y radiografía individual por comerciante.
 * 
 * Conexión futura con el Backend Real:
 * - Logs de Auditoría: Se consumirán vía GET /api/v1/auditoria/logs con paginación y filtros en PostgreSQL.
 * - Control de Supervisores: Se gestionará en la tabla `control_supervisores` vinculada con `asistencia_sesion`
 *   y `asistencia_detalle`. Cada cambio en /listas emitirá eventos de dominio que la base de datos
 *   auditará con triggers o servicios de mensajería (Kafka/RabbitMQ/PgNotify).
 */

import type {
  LogAuditoria,
  SesionControlSupervisor,
  DetalleComercianteControl,
  EtiquetaControlSupervisor,
  ResumenSesionControl,
} from "@/domain/models/auditoria.model";
import type { FiltrosAuditoria, FiltrosControlSupervisor } from "@/domain/ports/auditoria.repository";
import type { EstadoAsistencia } from "@/domain/models/asistencia.model";
import { format, subDays, subHours, subMinutes, addMinutes } from "date-fns";

// ── Pool de Supervisores y Naves ─────────────────────────────────────────────

export const SUPERVISORES_CONTROL_POOL = [
  { id: "u-sup-01", nombre: "María Torres Guzmán", naves: [{ id: "nave-a", nombre: "NAVE A" }, { id: "nave-b", nombre: "NAVE B" }] },
  { id: "u-sup-02", nombre: "Jorge Castillo Vera", naves: [{ id: "nave-c", nombre: "NAVE C" }, { id: "nave-d", nombre: "NAVE D" }] },
  { id: "u-sup-03", nombre: "Elena Mora Salcedo", naves: [{ id: "nave-e", nombre: "NAVE E" }] },
];

const NOMBRES_MOCK = [
  "Luis", "María", "Carlos", "Ana", "Pedro", "Rosa", "Jorge", "Elena",
  "Marco", "Sofía", "Ricardo", "Patricia", "Fernando", "Carmen", "Diego",
  "Lucía", "Andrés", "Isabel", "Miguel", "Teresa", "Raúl", "Gloria",
];

const APELLIDOS_MOCK = [
  "Martínez", "Ríos", "Salcedo", "Torres", "Vargas", "Guzmán",
  "Castillo", "Mora", "Pérez", "Mendoza", "Suárez", "López",
  "Medina", "Ruiz", "Sánchez", "Herrera", "Flores", "Paredes",
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(789);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

// ── Generador de Comerciantes para Detalle de Control ─────────────────────────

function generarDetallesComerciantes(
  naveLetra: string,
  totalPuestos: number,
  metodoBase: "MANUAL" | "PERSISTENCIA",
  fechaIso: string,
  modificarAlgunos: boolean = false
): { detalles: DetalleComercianteControl[]; resumen: ResumenSesionControl } {
  const detalles: DetalleComercianteControl[] = [];
  let presentes = 0;
  let ausentes = 0;
  let permisos = 0;
  let faltantes = 0;

  for (let i = 1; i <= totalPuestos; i++) {
    const puestoStr = `P-${naveLetra}${String(i).padStart(3, "0")}`;
    const ciuStr = `CIU-${naveLetra}${String(1000 + i)}`;
    const cedulaStr = `180${String(3000000 + i * 17)}`;
    const nombreCompleto = `${pick(NOMBRES_MOCK)} ${pick(APELLIDOS_MOCK)} ${pick(APELLIDOS_MOCK)}`;

    let estado: EstadoAsistencia;
    let metodo: DetalleComercianteControl["metodo"] = metodoBase;
    const r = rand();

    if (modificarAlgunos && (i === 3 || i === 7 || i === 12)) {
      // Modificados manualmente tras persistencia
      metodo = "MODIFICADO_TRAS_PERSISTENCIA";
      estado = i % 2 === 0 ? "Presente" : "Ausente";
    } else if (r < 0.72) {
      estado = "Presente";
    } else if (r < 0.88) {
      estado = "Ausente";
    } else if (r < 0.95) {
      estado = "Permiso";
    } else {
      estado = "Pendiente";
      metodo = "FALTANTE";
    }

    if (estado === "Presente") presentes++;
    else if (estado === "Ausente") ausentes++;
    else if (estado === "Permiso") permisos++;
    else faltantes++;

    const horaBase = new Date(fechaIso);
    const horaRegistro =
      estado !== "Pendiente"
        ? format(addMinutes(horaBase, Math.floor(rand() * 45)), "hh:mm a")
        : undefined;

    detalles.push({
      comercianteId: `com-${naveLetra.toLowerCase()}-${String(i).padStart(3, "0")}`,
      ciu: ciuStr,
      cedula: cedulaStr,
      contribuyente: nombreCompleto,
      puesto: puestoStr,
      estado,
      horaRegistro,
      metodo,
    });
  }

  const tomados = presentes + ausentes + permisos;
  const resumen: ResumenSesionControl = {
    totalOcupados: totalPuestos,
    tomados,
    presentes,
    ausentes,
    permisos,
    faltantes,
  };

  return { detalles, resumen };
}

// ── Generador de Sesiones Iniciales de Control de Supervisores ────────────────

function generarSesionesIniciales(): SesionControlSupervisor[] {
  const sesiones: SesionControlSupervisor[] = [];
  const hoy = new Date();

  // Escenario 1: Normal / En fecha (Lunes o hace 4 días a las 15:00)
  const fechaE1 = subDays(hoy, 4);
  const fechaE1Str = format(fechaE1, "yyyy-MM-dd");
  const tsInicioE1 = new Date(fechaE1);
  tsInicioE1.setHours(15, 0, 0, 0);

  const { detalles: detE1, resumen: resE1 } = generarDetallesComerciantes("A", 40, "MANUAL", tsInicioE1.toISOString());
  const etiquetasE1: EtiquetaControlSupervisor[] = ["EN_FECHA"];
  if (resE1.faltantes === 0) etiquetasE1.push("COMPLETA");
  else etiquetasE1.push("INCOMPLETA");

  sesiones.push({
    id: "sesion-ctrl-001",
    supervisorId: "u-sup-01",
    supervisorNombre: "María Torres Guzmán",
    naveId: "nave-a",
    naveNombre: "NAVE A",
    fechaJornada: fechaE1Str,
    timestampInicio: tsInicioE1.toISOString(),
    accion: "Inicio Toma de Lista",
    esPersistencia: false,
    modificadoTrasPersistencia: false,
    tieneRetraso: false,
    etiquetas: etiquetasE1,
    resumen: resE1,
    detallesComerciantes: detE1,
  });

  // Escenario 2: Registro por Persistencia (Hace 3 días, arrastrado de hace 4 días)
  const fechaE2 = subDays(hoy, 3);
  const fechaE2Str = format(fechaE2, "yyyy-MM-dd");
  const tsInicioE2 = new Date(fechaE2);
  tsInicioE2.setHours(8, 30, 0, 0);

  const { detalles: detE2, resumen: resE2 } = generarDetallesComerciantes("A", 40, "PERSISTENCIA", tsInicioE2.toISOString());
  // En persistencia pura todos quedan cubiertos
  resE2.faltantes = 0;
  resE2.tomados = resE2.totalOcupados;

  sesiones.push({
    id: "sesion-ctrl-002",
    supervisorId: "u-sup-01",
    supervisorNombre: "María Torres Guzmán",
    naveId: "nave-a",
    naveNombre: "NAVE A",
    fechaJornada: fechaE2Str,
    timestampInicio: tsInicioE2.toISOString(),
    accion: "Registro por Persistencia",
    esPersistencia: true,
    fechaOrigenPersistencia: fechaE1Str,
    comentarioPersistencia: "Feria ciudadana / mantenimiento en nave, se mantiene asistencia del lunes",
    modificadoTrasPersistencia: false,
    tieneRetraso: false,
    etiquetas: ["CON_PERSISTENCIA", "COMPLETA"],
    resumen: resE2,
    detallesComerciantes: detE2.map((d) => ({ ...d, metodo: "PERSISTENCIA", estado: d.estado === "Pendiente" ? "Presente" : d.estado })),
  });

  // Escenario 3: Persistencia + Modificación manual posterior (Hace 1 día)
  const fechaE3 = subDays(hoy, 1);
  const fechaE3Str = format(fechaE3, "yyyy-MM-dd");
  const tsInicioE3 = new Date(fechaE3);
  tsInicioE3.setHours(9, 15, 0, 0);
  const tsModifE3 = new Date(fechaE3);
  tsModifE3.setHours(14, 45, 0, 0);

  const { detalles: detE3, resumen: resE3 } = generarDetallesComerciantes("B", 35, "PERSISTENCIA", tsInicioE3.toISOString(), true);
  resE3.faltantes = 0;
  resE3.tomados = resE3.totalOcupados;

  sesiones.push({
    id: "sesion-ctrl-003",
    supervisorId: "u-sup-01",
    supervisorNombre: "María Torres Guzmán",
    naveId: "nave-b",
    naveNombre: "NAVE B",
    fechaJornada: fechaE3Str,
    timestampInicio: tsInicioE3.toISOString(),
    timestampUltimaModificacion: tsModifE3.toISOString(),
    accion: "Registro por Persistencia con modificaciones",
    esPersistencia: true,
    fechaOrigenPersistencia: fechaE2Str,
    comentarioPersistencia: "Arrastre operativo matutino. Reajuste de 3 comerciantes por ingreso vespertino.",
    modificadoTrasPersistencia: true,
    tieneRetraso: false,
    etiquetas: ["CON_PERSISTENCIA", "MODIFICADO_TRAS_PERSISTENCIA", "COMPLETA"],
    resumen: resE3,
    detallesComerciantes: detE3.map((d) => ({
      ...d,
      estado: d.estado === "Pendiente" ? "Presente" : d.estado,
    })),
  });

  // Escenario 4: Toma de Lista Manual con Retraso (Jornada de hace 5 días, registrada ayer)
  const fechaE4Jornada = subDays(hoy, 5);
  const fechaE4JornadaStr = format(fechaE4Jornada, "yyyy-MM-dd");
  const tsInicioE4 = new Date(subDays(hoy, 1));
  tsInicioE4.setHours(16, 20, 0, 0);

  const { detalles: detE4, resumen: resE4 } = generarDetallesComerciantes("C", 45, "MANUAL", tsInicioE4.toISOString());

  sesiones.push({
    id: "sesion-ctrl-004",
    supervisorId: "u-sup-02",
    supervisorNombre: "Jorge Castillo Vera",
    naveId: "nave-c",
    naveNombre: "NAVE C",
    fechaJornada: fechaE4JornadaStr,
    timestampInicio: tsInicioE4.toISOString(),
    accion: "Toma de Lista Manual Retroactiva",
    esPersistencia: false,
    modificadoTrasPersistencia: false,
    tieneRetraso: true,
    detalleRetraso: `Lista de jornada ${fechaE4JornadaStr} registrada manualmente 4 días después`,
    etiquetas: ["CON_RETRASO", resE4.faltantes === 0 ? "COMPLETA" : "INCOMPLETA"],
    resumen: resE4,
    detallesComerciantes: detE4,
  });

  // Sesión adicional: Nave D con Jorge Castillo Vera (Hace 2 días)
  const fechaE5 = subDays(hoy, 2);
  const fechaE5Str = format(fechaE5, "yyyy-MM-dd");
  const tsInicioE5 = new Date(fechaE5);
  tsInicioE5.setHours(11, 0, 0, 0);
  const { detalles: detE5, resumen: resE5 } = generarDetallesComerciantes("D", 30, "MANUAL", tsInicioE5.toISOString());

  sesiones.push({
    id: "sesion-ctrl-005",
    supervisorId: "u-sup-02",
    supervisorNombre: "Jorge Castillo Vera",
    naveId: "nave-d",
    naveNombre: "NAVE D",
    fechaJornada: fechaE5Str,
    timestampInicio: tsInicioE5.toISOString(),
    accion: "Inicio Toma de Lista",
    esPersistencia: false,
    modificadoTrasPersistencia: false,
    tieneRetraso: false,
    etiquetas: ["EN_FECHA", resE5.faltantes === 0 ? "COMPLETA" : "INCOMPLETA"],
    resumen: resE5,
    detallesComerciantes: detE5,
  });

  // Sesión adicional: Nave E con Elena Mora Salcedo (Hoy)
  const fechaE6 = hoy;
  const fechaE6Str = format(fechaE6, "yyyy-MM-dd");
  const tsInicioE6 = new Date(fechaE6);
  tsInicioE6.setHours(7, 45, 0, 0);
  const { detalles: detE6, resumen: resE6 } = generarDetallesComerciantes("E", 35, "MANUAL", tsInicioE6.toISOString());

  sesiones.push({
    id: "sesion-ctrl-006",
    supervisorId: "u-sup-03",
    supervisorNombre: "Elena Mora Salcedo",
    naveId: "nave-e",
    naveNombre: "NAVE E",
    fechaJornada: fechaE6Str,
    timestampInicio: tsInicioE6.toISOString(),
    accion: "Inicio Toma de Lista",
    esPersistencia: false,
    modificadoTrasPersistencia: false,
    tieneRetraso: false,
    etiquetas: ["EN_FECHA", resE6.faltantes === 0 ? "COMPLETA" : "INCOMPLETA"],
    resumen: resE6,
    detallesComerciantes: detE6,
  });

  return sesiones.sort(
    (a, b) => new Date(b.timestampInicio).getTime() - new Date(a.timestampInicio).getTime()
  );
}

const sesionesControlMock: SesionControlSupervisor[] = generarSesionesIniciales();

// ── Logs de Auditoría Genérica (compatibilidad existente) ────────────────────

const ACCIONES_AUDITORIA = [
  "LOGIN", "LOGOUT", "CAMBIO_ESTADO", "IMPORTACION_XML",
  "CAMBIO_CONTRASEÑA", "ASIGNACION_PERMISO", "MODIFICACION_PUESTO",
  "CONSULTA_REPORTE", "EXPORTACION_PDF", "CONFIGURACION_ACTUALIZADA",
];

const USUARIOS_AUDITORIA = [
  { id: "u-super", nombre: "Administrador Sistema" },
  { id: "u-tic-01", nombre: "Carlos Medina Ruiz" },
  { id: "u-dir-01", nombre: "Patricia Sánchez López" },
  { id: "u-jefe-01", nombre: "Roberto Vargas Mendoza" },
  { id: "u-sup-01", nombre: "María Torres Guzmán" },
  { id: "u-sup-02", nombre: "Jorge Castillo Vera" },
  { id: "u-sup-03", nombre: "Elena Mora Salcedo" },
];

function generarLogs(): LogAuditoria[] {
  const logs: LogAuditoria[] = [];
  const ahora = new Date();

  for (let i = 0; i < 40; i++) {
    const usuario = pick(USUARIOS_AUDITORIA);
    const accion = pick(ACCIONES_AUDITORIA);
    const horasAtras = Math.floor(rand() * 720);
    const timestamp = subMinutes(subHours(ahora, horasAtras), Math.floor(rand() * 60));

    logs.push({
      id: `log-${String(i + 1).padStart(3, "0")}`,
      timestamp: timestamp.toISOString(),
      usuarioId: usuario.id,
      usuarioNombre: usuario.nombre,
      accion,
      detalle: `Acción ${accion} ejecutada por ${usuario.nombre}.`,
    });
  }

  return logs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

const logsGenerados: LogAuditoria[] = generarLogs();

// ── API Pública del Mock ─────────────────────────────────────────────────────

/**
 * Devuelve todos los logs de auditoría tradicionales.
 */
export function getLogs(): LogAuditoria[] {
  return logsGenerados;
}

/**
 * Filtra los logs de auditoría por texto, usuario y rango de fechas.
 */
export function getLogsFiltrados(filtros: FiltrosAuditoria): LogAuditoria[] {
  return logsGenerados.filter((log) => {
    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase();
      const match =
        log.accion.toLowerCase().includes(q) ||
        log.detalle.toLowerCase().includes(q) ||
        log.usuarioNombre.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filtros.usuarioId && log.usuarioId !== filtros.usuarioId) return false;
    if (filtros.fechaDesde) {
      const f = format(new Date(log.timestamp), "yyyy-MM-dd");
      if (f < filtros.fechaDesde) return false;
    }
    if (filtros.fechaHasta) {
      const f = format(new Date(log.timestamp), "yyyy-MM-dd");
      if (f > filtros.fechaHasta) return false;
    }
    return true;
  });
}

/**
 * Agrega un nuevo registro al log histórico en memoria.
 */
export function agregarLog(log: Omit<LogAuditoria, "id" | "timestamp">) {
  logsGenerados.unshift({
    ...log,
    id: `log-${String(logsGenerados.length + 1).padStart(3, "0")}`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Consulta y filtra las sesiones de Control de Supervisores.
 * 
 * Permite buscar por texto (supervisor, nave, acción, comentario), filtrar por supervisor
 * y restringir por rango de fechas (fecha de lista / jornada).
 */
export function getSesionesControl(filtros: FiltrosControlSupervisor): SesionControlSupervisor[] {
  return sesionesControlMock.filter((sesion) => {
    if (filtros.supervisorId && filtros.supervisorId !== "TODOS") {
      if (sesion.supervisorId !== filtros.supervisorId) return false;
    }

    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase().trim();
      const match =
        sesion.supervisorNombre.toLowerCase().includes(q) ||
        sesion.naveNombre.toLowerCase().includes(q) ||
        sesion.accion.toLowerCase().includes(q) ||
        (sesion.comentarioPersistencia?.toLowerCase().includes(q) ?? false) ||
        (sesion.detalleRetraso?.toLowerCase().includes(q) ?? false);
      if (!match) return false;
    }

    if (filtros.fechaDesde && sesion.fechaJornada < filtros.fechaDesde) {
      return false;
    }

    if (filtros.fechaHasta && sesion.fechaJornada > filtros.fechaHasta) {
      return false;
    }

    return true;
  });
}

/**
 * Registra o reemplaza directamente una sesión completa de control de supervisor.
 */
export function registrarSesionControl(sesion: SesionControlSupervisor): void {
  const idx = sesionesControlMock.findIndex(
    (s) => s.naveId === sesion.naveId && s.fechaJornada === sesion.fechaJornada
  );
  if (idx >= 0) {
    sesionesControlMock[idx] = sesion;
  } else {
    sesionesControlMock.unshift(sesion);
  }
}

/**
 * Sincroniza en tiempo real cuando un supervisor modifica manualmente un comerciante en /listas.
 * 
 * Reglas de negocio aplicadas:
 * 1. Si no existe sesión para esa nave y jornada, la crea como "Inicio Toma de Lista".
 * 2. Si la jornada es anterior a hoy (fechaJornada < hoyStr), la marca automáticamente como CON_RETRASO.
 * 3. Si la jornada fue cubierta previamente con persistencia, añade automáticamente MODIFICADO_TRAS_PERSISTENCIA.
 * 4. Actualiza el estado y hora de registro del comerciante específico.
 * 5. Recalcula el resumen (presentes, ausentes, permisos, faltantes) y actualiza el badge COMPLETA / INCOMPLETA.
 */
export function sincronizarControlAsistenciaManual(params: {
  naveId: string;
  naveNombre: string;
  supervisorId?: string;
  supervisorNombre?: string;
  fechaJornada: string;
  comercianteId: string;
  ciu?: string;
  cedula?: string;
  contribuyente?: string;
  puesto?: string;
  nuevoEstado: EstadoAsistencia;
}): void {
  const hoyStr = format(new Date(), "yyyy-MM-dd");
  const ahoraIso = new Date().toISOString();
  const horaRegistroStr = format(new Date(), "hh:mm a");

  let sesion = sesionesControlMock.find(
    (s) => s.naveId === params.naveId && s.fechaJornada === params.fechaJornada
  );

  const supId = params.supervisorId || "u-sup-01";
  const supNombre = params.supervisorNombre || "Supervisor Asignado";

  if (!sesion) {
    const tieneRetraso = params.fechaJornada < hoyStr;
    const etiquetas: EtiquetaControlSupervisor[] = tieneRetraso
      ? ["CON_RETRASO"]
      : ["EN_FECHA"];

    sesion = {
      id: `sesion-ctrl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      supervisorId: supId,
      supervisorNombre: supNombre,
      naveId: params.naveId,
      naveNombre: params.naveNombre,
      fechaJornada: params.fechaJornada,
      timestampInicio: ahoraIso,
      timestampUltimaModificacion: ahoraIso,
      accion: tieneRetraso ? "Toma de Lista Manual Retroactiva" : "Inicio Toma de Lista",
      esPersistencia: false,
      modificadoTrasPersistencia: false,
      tieneRetraso,
      detalleRetraso: tieneRetraso
        ? `Lista de jornada ${params.fechaJornada} iniciada con posterioridad`
        : undefined,
      etiquetas,
      resumen: {
        totalOcupados: 1,
        tomados: params.nuevoEstado !== "Pendiente" ? 1 : 0,
        presentes: params.nuevoEstado === "Presente" ? 1 : 0,
        ausentes: params.nuevoEstado === "Ausente" ? 1 : 0,
        permisos: params.nuevoEstado === "Permiso" ? 1 : 0,
        faltantes: params.nuevoEstado === "Pendiente" ? 1 : 0,
      },
      detallesComerciantes: [
        {
          comercianteId: params.comercianteId,
          ciu: params.ciu || "CIU-S/N",
          cedula: params.cedula || "S/C",
          contribuyente: params.contribuyente || "Comerciante",
          puesto: params.puesto || "P-001",
          estado: params.nuevoEstado,
          horaRegistro: horaRegistroStr,
          metodo: "MANUAL",
        },
      ],
    };
    sesionesControlMock.unshift(sesion);
    return;
  }

  // Si ya existía la sesión
  sesion.timestampUltimaModificacion = ahoraIso;

  // Si era persistencia y se modifica manualmente
  if (sesion.esPersistencia) {
    sesion.modificadoTrasPersistencia = true;
    if (!sesion.etiquetas.includes("MODIFICADO_TRAS_PERSISTENCIA")) {
      sesion.etiquetas.push("MODIFICADO_TRAS_PERSISTENCIA");
    }
  }

  // Buscar si el comerciante ya está en la lista de detalles
  const detalleIdx = sesion.detallesComerciantes.findIndex(
    (d) => d.comercianteId === params.comercianteId
  );

  const metodoFinal = sesion.esPersistencia
    ? "MODIFICADO_TRAS_PERSISTENCIA"
    : "MANUAL";

  if (detalleIdx >= 0) {
    sesion.detallesComerciantes[detalleIdx] = {
      ...sesion.detallesComerciantes[detalleIdx],
      estado: params.nuevoEstado,
      horaRegistro: horaRegistroStr,
      metodo: metodoFinal,
    };
  } else {
    sesion.detallesComerciantes.push({
      comercianteId: params.comercianteId,
      ciu: params.ciu || "CIU-S/N",
      cedula: params.cedula || "S/C",
      contribuyente: params.contribuyente || "Comerciante",
      puesto: params.puesto || "P-001",
      estado: params.nuevoEstado,
      horaRegistro: horaRegistroStr,
      metodo: metodoFinal,
    });
  }

  // Recalcular métricas de resumen
  let pres = 0;
  let aus = 0;
  let perm = 0;
  let falt = 0;

  for (const det of sesion.detallesComerciantes) {
    if (det.estado === "Presente") pres++;
    else if (det.estado === "Ausente") aus++;
    else if (det.estado === "Permiso") perm++;
    else falt++;
  }

  sesion.resumen = {
    totalOcupados: sesion.detallesComerciantes.length,
    tomados: pres + aus + perm,
    presentes: pres,
    ausentes: aus,
    permisos: perm,
    faltantes: falt,
  };

  // Actualizar etiquetas de completitud
  sesion.etiquetas = sesion.etiquetas.filter(
    (e) => e !== "COMPLETA" && e !== "INCOMPLETA"
  );
  if (falt === 0) {
    sesion.etiquetas.push("COMPLETA");
  } else {
    sesion.etiquetas.push("INCOMPLETA");
  }
}

/**
 * Registra o actualiza sesiones de control tras un arrastre masivo por persistencia.
 * 
 * ¿Cómo funciona en el mock?
 * 1. Procesa cada fecha destino cubierta por el arrastre.
 * 2. REGLA ESTRICTA DE PERSISTENCIA (SOLO PENDIENTES):
 *    - Los comerciantes que ya tenían toma manual en la jornada conservan su método "MANUAL",
 *      su estado inalterado y su hora original de registro.
 *    - Solo los comerciantes que estaban en "Pendiente" (o sin registro previo) y fueron completados
 *      por persistencia se etiquetan con método "PERSISTENCIA" y la hora del lote.
 * 3. Se recalculan las métricas agregadas (tomados, presentes, ausentes, permisos, faltantes)
 *    y se añade la etiqueta CON_PERSISTENCIA a la sesión.
 * 
 * Conexión futura con el backend real:
 * Se registrará en la tabla `control_supervisores` vinculada con `asistencia_sesion_detalle`.
 * Cada detalle de comerciante mantendrá el campo `metodo_registro` ('MANUAL' o 'PERSISTENCIA')
 * para garantizar la trazabilidad y auditoría de la autoría de cada marcación.
 */
export function sincronizarControlPersistencia(params: {
  naveId: string;
  naveNombre: string;
  supervisorId?: string;
  supervisorNombre: string;
  fechaOrigen: string;
  fechasDestino: string[];
  comentario?: string;
  mapeoPorFecha: Record<
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
  >;
}): void {
  const ahoraIso = new Date().toISOString();
  const horaRegistroStr = format(new Date(), "hh:mm a");

  for (const fDestino of params.fechasDestino) {
    const idx = sesionesControlMock.findIndex(
      (s) => s.naveId === params.naveId && s.fechaJornada === fDestino
    );

    const mapeoComerciantes = params.mapeoPorFecha[fDestino] ?? [];

    let presentes = 0;
    let ausentes = 0;
    let permisos = 0;
    let faltantes = 0;

    const sesionExistente = idx >= 0 ? sesionesControlMock[idx] : null;

    const detallesComerciantes: DetalleComercianteControl[] = mapeoComerciantes.map((c) => {
      if (c.estado === "Presente") presentes++;
      else if (c.estado === "Ausente") ausentes++;
      else if (c.estado === "Permiso") permisos++;
      else faltantes++;

      // Si en la sesión existente ya existía registro con hora previa, preservarla si es MANUAL
      const detallePrevio = sesionExistente?.detallesComerciantes.find(
        (d) => d.comercianteId === c.comercianteId
      );

      const horaFinal =
        c.metodo === "MANUAL" && detallePrevio?.horaRegistro
          ? detallePrevio.horaRegistro
          : horaRegistroStr;

      return {
        comercianteId: c.comercianteId,
        ciu: c.ciu,
        cedula: c.cedula,
        contribuyente: c.contribuyente,
        puesto: c.puesto,
        estado: c.estado,
        horaRegistro: horaFinal,
        metodo: c.metodo,
      };
    });

    const tomados = presentes + ausentes + permisos;
    const etiquetas: EtiquetaControlSupervisor[] = ["CON_PERSISTENCIA"];
    if (faltantes === 0) etiquetas.push("COMPLETA");
    else etiquetas.push("INCOMPLETA");

    const nuevaSesion: SesionControlSupervisor = {
      id: sesionExistente?.id || `sesion-ctrl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      supervisorId: params.supervisorId || sesionExistente?.supervisorId || "u-sup-01",
      supervisorNombre: params.supervisorNombre || sesionExistente?.supervisorNombre || "Supervisor Asignado",
      naveId: params.naveId,
      naveNombre: params.naveNombre,
      fechaJornada: fDestino,
      timestampInicio: sesionExistente?.timestampInicio || ahoraIso,
      timestampUltimaModificacion: ahoraIso,
      accion: "Registro por Persistencia",
      esPersistencia: true,
      fechaOrigenPersistencia: params.fechaOrigen,
      comentarioPersistencia: params.comentario,
      modificadoTrasPersistencia: sesionExistente?.modificadoTrasPersistencia ?? false,
      tieneRetraso: sesionExistente?.tieneRetraso ?? false,
      detalleRetraso: sesionExistente?.detalleRetraso,
      etiquetas,
      resumen: {
        totalOcupados: mapeoComerciantes.length,
        tomados,
        presentes,
        ausentes,
        permisos,
        faltantes,
      },
      detallesComerciantes,
    };

    if (idx >= 0) {
      sesionesControlMock[idx] = nuevaSesion;
    } else {
      sesionesControlMock.unshift(nuevaSesion);
    }
  }
}
